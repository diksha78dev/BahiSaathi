"""
BahiSaathi — Ledger service

The business rules of the app, in one place. Routers handle HTTP; this file
decides what actually happens. Manual entries and AI-scanned entries both go
through create_entry(), so they behave identically.
"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import Customer, LedgerEntry, OcrScan, PaymentStatus, ScanStatus
from app.schemas.schemas import CustomerResponse


# ── Customers ───────────────────────────────────────────────────

def find_customer_by_name(db: Session, user_id: UUID, name: str) -> Optional[Customer]:
    return db.query(Customer).filter(
        Customer.user_id == user_id,
        Customer.name_normalized == name.strip().lower(),
    ).first()


def find_or_create_customer(db: Session, user_id: UUID, name: Optional[str]) -> Optional[Customer]:
    """Match "Ramesh" / "ramesh " to one customer; create them if new. Empty name → None (walk-in)."""
    if not name or not name.strip():
        return None
    customer = find_customer_by_name(db, user_id, name)
    if customer is None:
        customer = Customer(user_id=user_id, name=name.strip(), name_normalized=name.strip().lower())
        db.add(customer)
        db.flush()  # assigns customer.id now, without committing yet
    return customer


def _unpaid_total():
    """SQL expression: sum of udhaar entry amounts (0 if none)."""
    return func.coalesce(
        func.sum(LedgerEntry.amount).filter(LedgerEntry.payment_status == PaymentStatus.udhaar),
        0.0,
    )


def list_customers_with_dues(db: Session, user_id: UUID, only_owing: bool = False) -> list[CustomerResponse]:
    """
    Every customer with their outstanding dues, calculated in one query:
    customers LEFT JOIN their entries, summing the unpaid amounts.
    only_owing=True → just customers who owe money, highest dues first.
    """
    dues = _unpaid_total().label("total_dues")
    query = (
        db.query(Customer, dues)
        .outerjoin(LedgerEntry, LedgerEntry.customer_id == Customer.id)
        .filter(Customer.user_id == user_id)
        .group_by(Customer.id)
    )
    if only_owing:
        query = query.having(dues > 0).order_by(dues.desc())
    else:
        query = query.order_by(Customer.name)

    return [to_customer_response(customer, total) for customer, total in query.all()]


def get_customer_dues(db: Session, customer_id: UUID) -> float:
    return db.query(_unpaid_total()).filter(LedgerEntry.customer_id == customer_id).scalar()


def to_customer_response(customer: Customer, total_dues: float) -> CustomerResponse:
    return CustomerResponse(
        id=customer.id,
        name=customer.name,
        phone=customer.phone,
        notes=customer.notes,
        total_dues=float(total_dues),
        created_at=customer.created_at,
    )


# ── Entries ─────────────────────────────────────────────────────

def create_entry(
    db: Session,
    user_id: UUID,
    *,
    item_name: str,
    amount: float,
    customer_name: Optional[str] = None,
    quantity: Optional[float] = None,
    unit: Optional[str] = None,
    transaction_date: Optional[date] = None,
    payment_status: PaymentStatus = PaymentStatus.udhaar,
    is_manual: bool,
    confidence_score: Optional[float] = None,
    ocr_scan_id: Optional[UUID] = None,
) -> LedgerEntry:
    """Add one ledger line (caller commits). Used by both manual entry and AI scans."""
    customer = find_or_create_customer(db, user_id, customer_name)
    entry = LedgerEntry(
        user_id=user_id,
        customer_id=customer.id if customer else None,
        ocr_scan_id=ocr_scan_id,
        item_name=item_name.strip(),
        quantity=quantity,
        unit=unit or None,
        amount=amount,
        transaction_date=transaction_date or date.today(),
        payment_status=payment_status,
        paid_at=datetime.utcnow() if payment_status == PaymentStatus.paid else None,
        is_manual=is_manual,
        confidence_score=confidence_score,
    )
    db.add(entry)
    return entry


def mark_entry_paid(entry: LedgerEntry) -> None:
    entry.payment_status = PaymentStatus.paid
    entry.paid_at = datetime.utcnow()


# ── Scans ───────────────────────────────────────────────────────

# A scan never writes to the ledger by itself. The AI produces a DRAFT, the
# shopkeeper corrects it, and only confirm_scan() turns it into real entries:
#
#   upload ─► extract_scan()  ─► needs_review ─► confirm_scan() ─► completed
#                                      └──────► discard_scan() ─► discarded

def find_saved_scan_with_same_image(db: Session, user_id: UUID, image_hash: str) -> Optional[OcrScan]:
    """A previously CONFIRMED scan of the exact same photo, if any."""
    return db.query(OcrScan).filter(
        OcrScan.user_id == user_id,
        OcrScan.image_hash == image_hash,
        OcrScan.status == ScanStatus.completed,
    ).first()


def extract_scan(db: Session, scan: OcrScan) -> None:
    """
    Run the AI on an uploaded photo and keep its result as a draft on the scan.
    Never raises: on any failure the scan is marked failed with the reason,
    so the frontend can show it.
    """
    try:
        # Imported here so a broken AI dependency only breaks scanning, not the whole API
        from app.ai.extractor import extract_entries

        result = extract_entries(scan.image_path)
        scan.extracted_entries = [
            {
                "customer_name": item.customer_name,
                "item_name": item.item_name,
                "quantity": item.quantity,
                "unit": item.unit,
                "amount": item.amount_inr,
                "transaction_date": item.transaction_date.isoformat() if item.transaction_date else None,
                "payment_status": item.payment_status.value,
                "confidence": item.confidence,
            }
            for item in result.entries
        ]
        scan.status = ScanStatus.needs_review
        scan.raw_ocr_text = result.raw_text
        scan.detected_language = result.detected_language
    except Exception as error:
        scan.status = ScanStatus.failed
        scan.error_message = str(error)

    scan.processed_at = datetime.utcnow()
    db.commit()


def confirm_scan(db: Session, scan: OcrScan, entries: list) -> None:
    """Save the shopkeeper-reviewed lines to the ledger (all or nothing — caller commits)."""
    for line in entries:
        create_entry(
            db,
            scan.user_id,
            customer_name=line.customer_name,
            item_name=line.item_name,
            quantity=line.quantity,
            unit=line.unit,
            amount=line.amount,
            transaction_date=line.transaction_date,
            payment_status=line.payment_status,
            is_manual=False,
            confidence_score=line.confidence,
            ocr_scan_id=scan.id,
        )
    scan.status = ScanStatus.completed
    scan.entries_extracted = len(entries)


def discard_scan(scan: OcrScan) -> None:
    scan.status = ScanStatus.discarded

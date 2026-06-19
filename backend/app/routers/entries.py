"""
BahiSaathi — Entries Router

Endpoints:
  GET    /entries/                    → list all entries (paginated)
  POST   /entries/manual              → add an entry by typing (no photo)
  POST   /entries/upload-scan         → upload photo → AI extracts entries
  GET    /entries/scan/{scan_id}      → check status of a scan
  PATCH  /entries/{entry_id}/mark-paid → mark a udhaar entry as paid
  DELETE /entries/{entry_id}          → delete an entry
"""

import os
import shutil
import uuid
from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.models import (
    Customer, LedgerEntry, OcrScan,
    PaymentStatus, ScanStatus, User,
)
from app.schemas.schemas import (
    LedgerEntryManualRequest,
    LedgerEntryResponse,
    OcrScanResponse,
)
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/entries", tags=["Ledger Entries"])

# Where uploaded images are saved locally
# In Module 8 (deploy), this moves to cloud storage
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── List entries ─────────────────────────────────────────────────

@router.get(
    "/",
    response_model=List[LedgerEntryResponse],
    summary="List all ledger entries"
)
def list_entries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50,
    status_filter: str = None,    # "paid" or "udhaar" — optional filter
):
    """
    Get all ledger entries for the logged-in shop owner.
    Most recent entries first.

    Optional query params:
      ?status_filter=udhaar   → only unpaid entries
      ?status_filter=paid     → only paid entries
      ?skip=0&limit=50        → pagination
    """
    query = db.query(LedgerEntry).filter(LedgerEntry.user_id == current_user.id)

    if status_filter == "udhaar":
        query = query.filter(LedgerEntry.payment_status == PaymentStatus.udhaar)
    elif status_filter == "paid":
        query = query.filter(LedgerEntry.payment_status == PaymentStatus.paid)

    entries = query.order_by(LedgerEntry.created_at.desc()).offset(skip).limit(limit).all()
    return entries


# ── Manual entry ─────────────────────────────────────────────────

@router.post(
    "/manual",
    response_model=LedgerEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an entry manually (no photo)"
)
def add_manual_entry(
    request: LedgerEntryManualRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a single ledger entry by typing it in.
    Used when the shopkeeper wants to add an entry without a photo.

    If customer_id is provided, validates it belongs to this shop.
    If payment_status is 'udhaar', adds amount to customer's total_dues.
    """
    # Validate customer belongs to this user
    if request.customer_id:
        customer = db.query(Customer).filter(
            Customer.id      == request.customer_id,
            Customer.user_id == current_user.id
        ).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found.")
    else:
        customer = None

    payment_status = (
        PaymentStatus.paid if request.payment_status == "paid"
        else PaymentStatus.udhaar
    )

    entry = LedgerEntry(
        user_id          = current_user.id,
        customer_id      = request.customer_id,
        item_name        = request.item_name.strip(),
        quantity         = request.quantity,
        unit             = request.unit,
        amount           = request.amount,
        transaction_date = request.transaction_date,
        payment_status   = payment_status,
        is_manual        = True,            # manually typed, not AI-extracted
        confidence_score = 1.0,            # human entered = 100% confidence
    )
    db.add(entry)

    # Update customer dues if this is a credit entry
    if customer and payment_status == PaymentStatus.udhaar:
        customer.total_dues += request.amount

    db.commit()
    db.refresh(entry)
    return entry


# ── Upload scan ──────────────────────────────────────────────────

@router.post(
    "/upload-scan",
    response_model=OcrScanResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload a ledger photo for AI extraction"
)
async def upload_scan(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a photo of a handwritten ledger page.

    What happens:
      1. Validates file type (JPEG / PNG / WebP only)
      2. Saves image to disk with a unique filename
      3. Creates an OcrScan record (status = pending)
      4. Calls Gemini AI to extract entries
      5. Saves extracted entries to ledger_entries table
      6. Updates scan status to completed (or failed)
      7. Returns the scan record

    Status 202 = "Accepted" — we received it and processed it.

    Note: In production this would be async (background task).
    For MVP we process synchronously — simpler to debug.
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, and WebP images are accepted."
        )

    # Save image with unique filename to avoid conflicts
    extension = file.filename.split(".")[-1].lower()
    filename  = f"{uuid.uuid4()}.{extension}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create scan record in DB (starts as pending)
    scan = OcrScan(
        user_id    = current_user.id,
        image_path = file_path,
        status     = ScanStatus.pending,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # Call AI extractor (Module 4 completes this)
    # We import here to avoid circular imports at module load time
    try:
        from app.ai.extractor import extract_and_save
        extract_and_save(scan.id, file_path, current_user.id, db)
        db.refresh(scan)
    except ImportError:
        # Module 4 not built yet — scan stays as pending, that's fine
        pass
    except Exception as e:
        # AI failed — scan marked as failed inside extract_and_save
        # We still return the scan record so frontend can show the error
        db.refresh(scan)

    return scan


# ── Scan status ──────────────────────────────────────────────────

@router.get(
    "/scan/{scan_id}",
    response_model=OcrScanResponse,
    summary="Check status of an OCR scan"
)
def get_scan_status(
    scan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check the status of a previously uploaded scan.
    Returns: pending / completed / failed + entries_extracted count.
    """
    scan = db.query(OcrScan).filter(
        OcrScan.id      == scan_id,
        OcrScan.user_id == current_user.id
    ).first()

    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return scan


# ── Mark paid ────────────────────────────────────────────────────

@router.patch(
    "/{entry_id}/mark-paid",
    response_model=LedgerEntryResponse,
    summary="Mark a udhaar entry as paid"
)
def mark_entry_paid(
    entry_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark an unpaid (udhaar) entry as paid.

    Two things happen atomically:
      1. entry.payment_status → paid, entry.paid_at → now
      2. customer.total_dues  → reduced by entry.amount

    Atomic means both happen in one DB commit — you can't have
    one without the other (no inconsistent state).
    """
    entry = db.query(LedgerEntry).filter(
        LedgerEntry.id      == entry_id,
        LedgerEntry.user_id == current_user.id
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")

    if entry.payment_status == PaymentStatus.paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This entry is already marked as paid."
        )

    # Update entry
    entry.payment_status = PaymentStatus.paid
    entry.paid_at        = datetime.utcnow()

    # Update customer dues
    if entry.customer_id:
        customer = db.query(Customer).filter(
            Customer.id == entry.customer_id
        ).first()
        if customer:
            customer.total_dues = max(0.0, customer.total_dues - entry.amount)

    db.commit()
    db.refresh(entry)
    return entry


# ── Delete entry ─────────────────────────────────────────────────

@router.delete(
    "/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a ledger entry"
)
def delete_entry(
    entry_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a ledger entry.
    If the entry was udhaar, also reduces customer's total_dues.
    """
    entry = db.query(LedgerEntry).filter(
        LedgerEntry.id      == entry_id,
        LedgerEntry.user_id == current_user.id
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")

    # If udhaar entry is being deleted, reverse the dues
    if entry.payment_status == PaymentStatus.udhaar and entry.customer_id:
        customer = db.query(Customer).filter(
            Customer.id == entry.customer_id
        ).first()
        if customer:
            customer.total_dues = max(0.0, customer.total_dues - entry.amount)

    db.delete(entry)
    db.commit()
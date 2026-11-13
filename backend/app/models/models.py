"""
BahiSaathi — Database models (SQLAlchemy)

4 tables:
  users           → one row = one shop owner account
  customers       → people the shopkeeper sells to
  ledger_entries  → one row = one line in the bahi (the heart of the app)
  ocr_scans       → one row = one uploaded photo + the AI result

Relationships:
  users     (1) ──► (many) customers, ledger_entries, ocr_scans
  customers (1) ──► (many) ledger_entries
  ocr_scans (1) ──► (many) ledger_entries

A customer's outstanding dues are NOT stored — they are always calculated
as the sum of that customer's unpaid (udhaar) entries. One source of truth,
so the number can never drift out of sync.
"""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database.connection import Base


# ── Enums (str-based so they serialise to plain strings in JSON) ─

class PaymentStatus(str, enum.Enum):
    udhaar = "udhaar"  # on credit — customer still owes this amount
    paid = "paid"      # settled


class ScanStatus(str, enum.Enum):
    pending = "pending"      # image saved, AI not finished
    completed = "completed"  # entries extracted and saved
    failed = "failed"        # AI step errored — see error_message


# ── users ────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_name = Column(String(200), nullable=False)
    owner_name = Column(String(200), nullable=False)
    phone = Column(String(15), unique=True, nullable=False, index=True)  # login id, digits only
    hashed_password = Column(String(255), nullable=False)
    preferred_language = Column(String(5), default="hi", nullable=False)  # hi / mr / en
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    customers = relationship("Customer", back_populates="user")
    ocr_scans = relationship("OcrScan", back_populates="user")


# ── customers ────────────────────────────────────────────────────

class Customer(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    # Lowercased name, used to match "Ramesh" / "ramesh" / "RAMESH" as one customer
    name_normalized = Column(String(200), nullable=False, index=True)
    phone = Column(String(15), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="customers")
    ledger_entries = relationship("LedgerEntry", back_populates="customer")


# ── ledger_entries ───────────────────────────────────────────────

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Nullable: walk-in sales have no customer; manual entries have no scan
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    ocr_scan_id = Column(UUID(as_uuid=True), ForeignKey("ocr_scans.id", ondelete="SET NULL"), nullable=True)

    item_name = Column(String(300), nullable=False)
    quantity = Column(Float, nullable=True)
    unit = Column(String(50), nullable=True)  # kg, litre, piece...
    amount = Column(Float, nullable=False)    # INR

    # The date written in the bahi — reports group by this, not by created_at
    transaction_date = Column(Date, default=date.today, nullable=False, index=True)

    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.udhaar, nullable=False, index=True)
    paid_at = Column(DateTime, nullable=True)

    is_manual = Column(Boolean, default=False, nullable=False)  # True = typed in, False = AI extracted
    confidence_score = Column(Float, nullable=True)             # AI confidence 0.0–1.0 (1.0 for manual)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    customer = relationship("Customer", back_populates="ledger_entries")
    ocr_scan = relationship("OcrScan", back_populates="ledger_entries")

    @property
    def customer_name(self):
        """Lets the API response include the customer's name directly."""
        return self.customer.name if self.customer else None


# ── ocr_scans ────────────────────────────────────────────────────

class OcrScan(Base):
    __tablename__ = "ocr_scans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    image_path = Column(String(500), nullable=False)
    raw_ocr_text = Column(Text, nullable=True)  # Gemini's raw reply, kept for debugging
    entries_extracted = Column(Integer, default=0, nullable=False)
    status = Column(Enum(ScanStatus), default=ScanStatus.pending, nullable=False, index=True)
    error_message = Column(Text, nullable=True)
    detected_language = Column(String(10), nullable=True)  # "en" or "mixed" (has Devanagari)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="ocr_scans")
    ledger_entries = relationship("LedgerEntry", back_populates="ocr_scan")

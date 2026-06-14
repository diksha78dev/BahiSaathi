"""
BahiSaathi — Database models (SQLAlchemy)

4 tables:
  users           → one row = one kirana shop owner account
  customers       → people the shopkeeper sells to
  ledger_entries  → individual transaction lines (the heart of the app)
  ocr_scans       → every photo upload + AI extraction audit trail

Relationships:
  users       (1) ──► (many) customers
  users       (1) ──► (many) ocr_scans
  customers   (1) ──► (many) ledger_entries
  ocr_scans   (1) ──► (many) ledger_entries
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime,
    Enum, Float, ForeignKey, Integer, String, Text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database.connection import Base


# ─────────────────────────────────────────────
# Enums — fixed allowed values for status columns
# ─────────────────────────────────────────────

class PaymentStatus(enum.Enum):
    """
    udhaar = credit / not yet paid (most common in kirana stores)
    paid   = customer has settled this entry
    """
    udhaar = "udhaar"
    paid   = "paid"


class ScanStatus(enum.Enum):
    """
    Tracks where a photo upload is in the AI pipeline.
    pending   → image saved, AI not started yet
    completed → entries extracted and saved to DB
    failed    → AI call errored out
    """
    pending   = "pending"
    completed = "completed"
    failed    = "failed"


# ─────────────────────────────────────────────
# Table 1: users
# One row = one shop owner account
# ─────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    # UUID primary key — safer than integer IDs when exposed in APIs
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    shop_name  = Column(String(200), nullable=False)
    owner_name = Column(String(200), nullable=False)

    # Phone is the login identifier — no email required (common in India)
    phone          = Column(String(15), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)  # bcrypt hash, never plain text

    # hi = Hindi, mr = Marathi, en = English
    preferred_language = Column(String(5), default="hi", nullable=False)

    is_active  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # SQLAlchemy relationships — lets you do user.customers, user.ocr_scans
    customers = relationship("Customer", back_populates="user", lazy="select")
    ocr_scans = relationship("OcrScan",  back_populates="user", lazy="select")

    def __repr__(self):
        return f"<User phone={self.phone} shop={self.shop_name}>"


# ─────────────────────────────────────────────
# Table 2: customers
# One row = one person the shopkeeper sells to
# ─────────────────────────────────────────────

class Customer(Base):
    __tablename__ = "customers"

    id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)

    # Name as written in the ledger — can be Hindi/Marathi
    name            = Column(String(200), nullable=False)

    # Lowercase English version for search/dedup (AI fills this)
    # Example: "रमेश" → "ramesh"
    name_normalized = Column(String(200), nullable=True, index=True)

    phone      = Column(String(15), nullable=True)

    # Running total of unpaid dues — updated automatically when entries are added/paid
    total_dues = Column(Float, default=0.0, nullable=False)

    notes      = Column(Text, nullable=True)   # e.g. "pays every Sunday"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user           = relationship("User", back_populates="customers")
    ledger_entries = relationship("LedgerEntry", back_populates="customer", lazy="select")

    def __repr__(self):
        return f"<Customer name={self.name} dues=₹{self.total_dues}>"


# ─────────────────────────────────────────────
# Table 3: ledger_entries
# The core table — one row = one transaction line from the bahi
# ─────────────────────────────────────────────

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Which shop, which customer, which scan produced this entry
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id",      ondelete="CASCADE"),  nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id",  ondelete="SET NULL"), nullable=True,  index=True)
    ocr_scan_id = Column(UUID(as_uuid=True), ForeignKey("ocr_scans.id",  ondelete="SET NULL"), nullable=True)

    # Why customer_id and ocr_scan_id are nullable:
    #   customer_id  → some lines have no customer name written
    #   ocr_scan_id  → manually added entries won't have a scan

    # Transaction data extracted by AI (or entered manually)
    item_name            = Column(String(300), nullable=False)
    item_name_normalized = Column(String(300), nullable=True)   # English version
    quantity             = Column(Float,       nullable=True)    # e.g. 2.5
    unit                 = Column(String(50),  nullable=True)    # kg, litre, piece...
    amount               = Column(Float,       nullable=False)   # INR

    # Date written in the ledger (may differ from created_at if entered late)
    transaction_date = Column(Date, nullable=True)

    payment_status = Column(
        Enum(PaymentStatus),
        default=PaymentStatus.udhaar,
        nullable=False,
        index=True
    )
    paid_at = Column(DateTime, nullable=True)   # when customer paid

    # AI audit fields
    raw_text         = Column(Text,  nullable=True)  # original line from the ledger image
    is_manual        = Column(Boolean, default=False) # True = user typed this, False = AI extracted
    confidence_score = Column(Float,  nullable=True)  # 0.0–1.0, AI's confidence

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user       = relationship("User")
    customer   = relationship("Customer", back_populates="ledger_entries")
    ocr_scan   = relationship("OcrScan",  back_populates="ledger_entries")

    def __repr__(self):
        return f"<LedgerEntry item={self.item_name} amt=₹{self.amount} status={self.payment_status.value}>"


# ─────────────────────────────────────────────
# Table 4: ocr_scans
# One row = one photo upload — audit trail for every AI extraction
# ─────────────────────────────────────────────

class OcrScan(Base):
    __tablename__ = "ocr_scans"

    id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)

    image_path       = Column(String(500), nullable=False)   # local path or cloud URL
    raw_ocr_text     = Column(Text,        nullable=True)    # raw text Gemini returned
    entries_extracted = Column(Integer,    default=0)        # how many entries were saved

    status = Column(
        Enum(ScanStatus),
        default=ScanStatus.pending,
        nullable=False,
        index=True
    )
    error_message     = Column(Text,      nullable=True)   # filled if status = failed
    detected_language = Column(String(10), nullable=True)  # hi, mr, en, mixed

    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)         # when AI finished

    user           = relationship("User",        back_populates="ocr_scans")
    ledger_entries = relationship("LedgerEntry", back_populates="ocr_scan", lazy="select")

    def __repr__(self):
        return f"<OcrScan id={self.id} status={self.status.value} entries={self.entries_extracted}>"
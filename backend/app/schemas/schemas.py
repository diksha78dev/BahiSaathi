"""
BahiSaathi — API schemas (Pydantic)

These describe the JSON the API accepts and returns. They are separate from
the database models so the API never leaks internal fields (like
hashed_password) and so input is validated before it reaches the database.

Naming: XxxRequest = what the client sends, XxxResponse = what the API returns.
"""

import re
from datetime import date, datetime
from typing import Annotated, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.models.models import PaymentStatus, ScanStatus

# Reusable field types
NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
OptionalStr = Optional[Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]]


def normalize_phone(value: str) -> str:
    """Keep digits only and use the last 10 — "+91 98765-43210" → "9876543210"."""
    digits = re.sub(r"\D", "", value)
    if len(digits) < 10:
        raise ValueError("Phone number must have at least 10 digits")
    return digits[-10:]


# ── Auth ────────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    shop_name: NonEmptyStr
    owner_name: NonEmptyStr
    phone: str
    password: Annotated[str, Field(min_length=6)]
    preferred_language: Literal["hi", "mr", "en"] = "hi"

    _phone = field_validator("phone")(normalize_phone)


class UserLoginRequest(BaseModel):
    phone: str
    password: str

    _phone = field_validator("phone")(normalize_phone)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # read directly from the SQLAlchemy object

    id: UUID
    shop_name: str
    owner_name: str
    phone: str
    preferred_language: str
    created_at: datetime


# ── Customers ───────────────────────────────────────────────────

class CustomerCreateRequest(BaseModel):
    name: NonEmptyStr
    phone: OptionalStr = None
    notes: Optional[str] = None


class CustomerUpdateRequest(BaseModel):
    """PATCH — only the fields that are sent get updated."""
    name: Optional[NonEmptyStr] = None
    phone: OptionalStr = None
    notes: Optional[str] = None


class CustomerResponse(BaseModel):
    id: UUID
    name: str
    phone: Optional[str]
    notes: Optional[str]
    total_dues: float  # calculated: sum of this customer's unpaid entries
    created_at: datetime


# ── Ledger entries ──────────────────────────────────────────────

class LedgerEntryManualRequest(BaseModel):
    """An entry typed in by the shopkeeper. customer_name is matched to an
    existing customer (case-insensitive) or creates a new one; leave it empty
    for a walk-in sale."""
    customer_name: OptionalStr = None
    item_name: NonEmptyStr
    quantity: Optional[Annotated[float, Field(gt=0)]] = None
    unit: OptionalStr = None
    amount: Annotated[float, Field(gt=0)]
    transaction_date: Optional[date] = None  # defaults to today
    payment_status: PaymentStatus = PaymentStatus.udhaar


class LedgerEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    item_name: str
    quantity: Optional[float]
    unit: Optional[str]
    amount: float
    transaction_date: date
    payment_status: PaymentStatus
    customer_id: Optional[UUID]
    customer_name: Optional[str]
    is_manual: bool
    confidence_score: Optional[float]
    created_at: datetime


# ── Scans ───────────────────────────────────────────────────────

class OcrScanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: ScanStatus
    entries_extracted: int
    detected_language: Optional[str]
    error_message: Optional[str]
    created_at: datetime


# ── Reports ─────────────────────────────────────────────────────

class DashboardStatsResponse(BaseModel):
    total_sales_this_month: float
    total_udhaar: float
    total_customers: int
    scans_this_month: int


class MonthlySummaryResponse(BaseModel):
    month: str  # "2026-11"
    total_sales: float
    total_udhaar: float
    total_paid: float
    entry_count: int

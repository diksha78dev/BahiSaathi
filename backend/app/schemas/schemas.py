"""
BahiSaathi — Pydantic Schemas

These define the shape of data at the API boundary.
Two important rules:
  1. These are NOT database models — they only describe what the API accepts/returns.
  2. Never include hashed_password in any response schema.

Pattern:
  XxxRequest  → what the client sends TO your API
  XxxResponse → what your API sends BACK to the client
"""

from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
from enum import Enum


# ─────────────────────────────────────────────
# Auth schemas
# ─────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    shop_name: str
    owner_name: str
    phone: str                        # "+91XXXXXXXXXX" or "9XXXXXXXXX"
    password: str
    preferred_language: str = "hi"   # hi / mr / en

    @field_validator("phone")
    @classmethod
    def phone_must_be_digits(cls, v):
        digits = v.replace("+", "").replace("-", "").replace(" ", "")
        if not digits.isdigit() or len(digits) < 10:
            raise ValueError("Phone must have at least 10 digits")
        return v

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserLoginRequest(BaseModel):
    phone: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    shop_name: str
    owner_name: str
    phone: str
    preferred_language: str
    created_at: datetime

    # from_attributes=True lets Pydantic read from SQLAlchemy model attributes
    # (previously called orm_mode=True in Pydantic v1)
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Customer schemas
# ─────────────────────────────────────────────

class CustomerCreateRequest(BaseModel):
    name: str
    phone: Optional[str] = None
    notes: Optional[str] = None


class CustomerUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class CustomerResponse(BaseModel):
    id: UUID
    name: str
    phone: Optional[str]
    total_dues: float
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Ledger entry schemas
# ─────────────────────────────────────────────

class PaymentStatusEnum(str, Enum):
    udhaar = "udhaar"
    paid   = "paid"


class LedgerEntryManualRequest(BaseModel):
    """For when the shopkeeper types an entry manually (no photo)."""
    customer_id:      Optional[UUID]             = None
    item_name:        str
    quantity:         Optional[float]            = None
    unit:             Optional[str]              = None
    amount:           float
    transaction_date: Optional[date]             = None
    payment_status:   PaymentStatusEnum          = PaymentStatusEnum.udhaar


class LedgerEntryResponse(BaseModel):
    id:               UUID
    item_name:        str
    quantity:         Optional[float]
    unit:             Optional[str]
    amount:           float
    transaction_date: Optional[date]
    payment_status:   PaymentStatusEnum
    customer_id:      Optional[UUID]
    is_manual:        bool
    confidence_score: Optional[float]
    created_at:       datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# OCR scan schemas
# ─────────────────────────────────────────────

class OcrScanResponse(BaseModel):
    id:                UUID
    status:            str
    entries_extracted: int
    detected_language: Optional[str]
    error_message:     Optional[str]
    created_at:        datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Report schemas
# ─────────────────────────────────────────────

class MonthlySummaryResponse(BaseModel):
    month:        str     # "2024-06"
    total_sales:  float
    total_udhaar: float
    total_paid:   float
    entry_count:  int


class DashboardStatsResponse(BaseModel):
    total_sales_this_month: float
    total_udhaar:           float
    total_customers:        int
    scans_this_month:       int
"""
BahiSaathi — Report routes

  GET /reports/dashboard              → the four numbers on the home screen
  GET /reports/dues                   → customers who owe money, highest first
  GET /reports/monthly/{year}/{month} → summary for one month
  GET /reports/monthly-list?months=6  → summaries for the last N months

Monthly figures are grouped by each entry's transaction_date (the date in the bahi).
"""

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.models import Customer, LedgerEntry, OcrScan, PaymentStatus, User
from app.schemas.schemas import CustomerResponse, DashboardStatsResponse, MonthlySummaryResponse
from app.services import ledger_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])


def sum_amount(status_filter: PaymentStatus | None = None):
    """SQL: SUM(amount), optionally only for one payment status; 0 when there are no rows."""
    total = func.sum(LedgerEntry.amount)
    if status_filter:
        total = total.filter(LedgerEntry.payment_status == status_filter)
    return func.coalesce(total, 0.0)


def month_summary(db: Session, user_id, year: int, month: int) -> MonthlySummaryResponse:
    total_sales, total_udhaar, total_paid, entry_count = db.query(
        sum_amount(),
        sum_amount(PaymentStatus.udhaar),
        sum_amount(PaymentStatus.paid),
        func.count(LedgerEntry.id),
    ).filter(
        LedgerEntry.user_id == user_id,
        extract("year", LedgerEntry.transaction_date) == year,
        extract("month", LedgerEntry.transaction_date) == month,
    ).one()

    return MonthlySummaryResponse(
        month=f"{year}-{month:02d}",
        total_sales=total_sales,
        total_udhaar=total_udhaar,
        total_paid=total_paid,
        entry_count=entry_count,
    )


def previous_months(count: int) -> list[tuple[int, int]]:
    """[(year, month), ...] for this month and the count-1 before it, newest first."""
    today = date.today()
    months = []
    for offset in range(count):
        index = today.year * 12 + (today.month - 1) - offset  # months since year 0
        months.append((index // 12, index % 12 + 1))
    return months


@router.get("/dashboard", response_model=DashboardStatsResponse)
def dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    this_month = month_summary(db, current_user.id, today.year, today.month)

    total_udhaar = db.query(sum_amount(PaymentStatus.udhaar)).filter(LedgerEntry.user_id == current_user.id).scalar()
    total_customers = db.query(func.count(Customer.id)).filter(Customer.user_id == current_user.id).scalar()

    month_start = datetime(today.year, today.month, 1)
    scans_this_month = db.query(func.count(OcrScan.id)).filter(
        OcrScan.user_id == current_user.id,
        OcrScan.created_at >= month_start,
    ).scalar()

    return DashboardStatsResponse(
        total_sales_this_month=this_month.total_sales,
        total_udhaar=total_udhaar,  # all-time outstanding, not just this month
        total_customers=total_customers,
        scans_this_month=scans_this_month,
    )


@router.get("/dues", response_model=list[CustomerResponse])
def customers_with_dues(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return ledger_service.list_customers_with_dues(db, current_user.id, only_owing=True)


@router.get("/monthly/{year}/{month}", response_model=MonthlySummaryResponse)
def monthly_summary(
    year: int = Path(ge=2000, le=2100),
    month: int = Path(ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return month_summary(db, current_user.id, year, month)


@router.get("/monthly-list", response_model=list[MonthlySummaryResponse])
def monthly_list(
    months: int = Query(default=6, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return [month_summary(db, current_user.id, year, month) for year, month in previous_months(months)]

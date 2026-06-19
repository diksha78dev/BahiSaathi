"""
BahiSaathi — Reports Router

Endpoints:
  GET /reports/dashboard              → stats for the home screen
  GET /reports/monthly/{year}/{month} → sales summary for one month
  GET /reports/dues                   → all customers with outstanding dues
  GET /reports/monthly-list           → last 6 months at a glance
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.models import Customer, LedgerEntry, OcrScan, PaymentStatus, User
from app.schemas.schemas import (
    CustomerResponse,
    DashboardStatsResponse,
    MonthlySummaryResponse,
)
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])


# ── Dashboard stats ──────────────────────────────────────────────

@router.get(
    "/dashboard",
    response_model=DashboardStatsResponse,
    summary="Home screen stats"
)
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Four numbers for the home screen:
      - Total sales this month (sum of all entry amounts)
      - Total udhaar outstanding (sum of all unpaid amounts)
      - Total customers registered
      - Number of scans uploaded this month

    This endpoint is called every time the dashboard loads.
    All four values come from one DB query each — fast and simple.
    """
    now   = datetime.utcnow()
    year  = now.year
    month = now.month

    # Sales this month = sum of all entry amounts for current month
    sales_result = db.query(func.sum(LedgerEntry.amount)).filter(
        LedgerEntry.user_id == current_user.id,
        extract("year",  LedgerEntry.created_at) == year,
        extract("month", LedgerEntry.created_at) == month,
    ).scalar()
    total_sales = float(sales_result or 0)

    # Total udhaar = sum of all unpaid entries (any time, not just this month)
    udhaar_result = db.query(func.sum(LedgerEntry.amount)).filter(
        LedgerEntry.user_id        == current_user.id,
        LedgerEntry.payment_status == PaymentStatus.udhaar,
    ).scalar()
    total_udhaar = float(udhaar_result or 0)

    # Total customers
    total_customers = db.query(func.count(Customer.id)).filter(
        Customer.user_id == current_user.id
    ).scalar()

    # Scans this month
    scans_result = db.query(func.count(OcrScan.id)).filter(
        OcrScan.user_id == current_user.id,
        extract("year",  OcrScan.created_at) == year,
        extract("month", OcrScan.created_at) == month,
    ).scalar()

    return DashboardStatsResponse(
        total_sales_this_month = total_sales,
        total_udhaar           = total_udhaar,
        total_customers        = int(total_customers or 0),
        scans_this_month       = int(scans_result or 0),
    )


# ── Monthly summary ──────────────────────────────────────────────

@router.get(
    "/monthly/{year}/{month}",
    response_model=MonthlySummaryResponse,
    summary="Sales summary for a specific month"
)
def monthly_summary(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sales breakdown for a given month.
    Example: GET /reports/monthly/2024/6

    Returns:
      total_sales  = all transactions that month
      total_udhaar = unpaid portion
      total_paid   = paid portion
      entry_count  = number of line items
    """
    if not (1 <= month <= 12):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12.")

    entries = db.query(LedgerEntry).filter(
        LedgerEntry.user_id == current_user.id,
        extract("year",  LedgerEntry.created_at) == year,
        extract("month", LedgerEntry.created_at) == month,
    ).all()

    total_sales  = sum(e.amount for e in entries)
    total_udhaar = sum(e.amount for e in entries if e.payment_status == PaymentStatus.udhaar)
    total_paid   = sum(e.amount for e in entries if e.payment_status == PaymentStatus.paid)

    return MonthlySummaryResponse(
        month        = f"{year}-{month:02d}",
        total_sales  = total_sales,
        total_udhaar = total_udhaar,
        total_paid   = total_paid,
        entry_count  = len(entries),
    )


# ── Last 6 months ────────────────────────────────────────────────

@router.get(
    "/monthly-list",
    response_model=List[MonthlySummaryResponse],
    summary="Last 6 months at a glance"
)
def monthly_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns a summary for each of the last 6 months.
    Used by the reports screen to show a trend table.
    Most recent month first.
    """
    from datetime import date
    from dateutil.relativedelta import relativedelta  # noqa — installed with python-dateutil

    results = []
    now = datetime.utcnow()

    for i in range(6):
        # Go back i months from today
        target = now.replace(day=1) - __import__("datetime").timedelta(days=1) * (i * 30)
        y, m = target.year, target.month

        entries = db.query(LedgerEntry).filter(
            LedgerEntry.user_id == current_user.id,
            extract("year",  LedgerEntry.created_at) == y,
            extract("month", LedgerEntry.created_at) == m,
        ).all()

        results.append(MonthlySummaryResponse(
            month        = f"{y}-{m:02d}",
            total_sales  = sum(e.amount for e in entries),
            total_udhaar = sum(e.amount for e in entries if e.payment_status == PaymentStatus.udhaar),
            total_paid   = sum(e.amount for e in entries if e.payment_status == PaymentStatus.paid),
            entry_count  = len(entries),
        ))

    return results


# ── Customers with dues ──────────────────────────────────────────

@router.get(
    "/dues",
    response_model=List[CustomerResponse],
    summary="All customers with outstanding dues"
)
def customers_with_dues(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all customers who owe money, ordered by highest dues first.
    This is the "Udhari List" screen in the frontend.
    """
    customers = db.query(Customer).filter(
        Customer.user_id   == current_user.id,
        Customer.total_dues > 0
    ).order_by(Customer.total_dues.desc()).all()

    return customers
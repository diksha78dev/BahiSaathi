"""
BahiSaathi — Customers Router

Endpoints:
  POST   /customers/          → create a new customer
  GET    /customers/          → list all customers for this shop
  GET    /customers/{id}      → get one customer + their entries
  PATCH  /customers/{id}      → update customer details
  DELETE /customers/{id}      → delete customer (only if no dues)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database.connection import get_db
from app.models.models import User, Customer, LedgerEntry
from app.schemas.schemas import (
    CustomerCreateRequest,
    CustomerUpdateRequest,
    CustomerResponse,
)
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.post(
    "/",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new customer"
)
def create_customer(
    request: CustomerCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a new customer to this shop.

    Why check for duplicates?
    A shopkeeper might accidentally add "Ramesh" twice. We check
    using name_normalized (lowercase) so "Ramesh" and "ramesh" are treated
    as the same customer.
    """
    name_norm = request.name.lower().strip()

    existing = db.query(Customer).filter(
        Customer.user_id == current_user.id,
        Customer.name_normalized == name_norm
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Customer '{request.name}' already exists."
        )

    customer = Customer(
        user_id         = current_user.id,
        name            = request.name.strip(),
        name_normalized = name_norm,
        phone           = request.phone,
        notes           = request.notes,
        total_dues      = 0.0,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get(
    "/",
    response_model=List[CustomerResponse],
    summary="List all customers"
)
def list_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Get all customers for the logged-in shop owner.
    Ordered by name alphabetically.
    skip + limit enable pagination if there are many customers.
    """
    customers = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .order_by(Customer.name)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return customers


@router.get(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Get one customer"
)
def get_customer(
    customer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a single customer by ID.
    Returns 404 if the customer doesn't exist or belongs to another shop.
    """
    customer = db.query(Customer).filter(
        Customer.id      == customer_id,
        Customer.user_id == current_user.id
    ).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return customer


@router.patch(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Update customer details"
)
def update_customer(
    customer_id: UUID,
    request: CustomerUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a customer's name, phone, or notes.
    Only updates fields that are actually sent — others stay unchanged.

    This is PATCH not PUT — partial update.
    PUT would require sending the full object every time.
    PATCH lets you send only what changed.
    """
    customer = db.query(Customer).filter(
        Customer.id      == customer_id,
        Customer.user_id == current_user.id
    ).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    if request.name is not None:
        customer.name            = request.name.strip()
        customer.name_normalized = request.name.lower().strip()

    if request.phone is not None:
        customer.phone = request.phone

    if request.notes is not None:
        customer.notes = request.notes

    db.commit()
    db.refresh(customer)
    return customer


@router.delete(
    "/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a customer"
)
def delete_customer(
    customer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a customer.
    Blocked if the customer has outstanding dues — must settle first.

    Status 204 = "No Content" — success, but nothing to return.
    """
    customer = db.query(Customer).filter(
        Customer.id      == customer_id,
        Customer.user_id == current_user.id
    ).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    if customer.total_dues > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete customer with ₹{customer.total_dues:.2f} outstanding dues."
        )

    db.delete(customer)
    db.commit()
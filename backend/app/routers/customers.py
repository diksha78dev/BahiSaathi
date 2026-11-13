"""
BahiSaathi — Customer routes

  POST   /customers/      → add a customer
  GET    /customers/      → list customers (with their dues)
  GET    /customers/{id}  → one customer
  PATCH  /customers/{id}  → update name / phone / notes
  DELETE /customers/{id}  → delete (only when they owe nothing)
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.models import Customer, User
from app.schemas.schemas import CustomerCreateRequest, CustomerResponse, CustomerUpdateRequest
from app.services import ledger_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/customers", tags=["Customers"])


def get_own_customer(db: Session, customer_id: UUID, user: User) -> Customer:
    """Load a customer that belongs to this user, or 404."""
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.user_id == user.id).first()
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found.")
    return customer


def ensure_name_is_free(db: Session, user: User, name: str, current_id: UUID | None = None) -> None:
    existing = ledger_service.find_customer_by_name(db, user.id, name)
    if existing and existing.id != current_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Customer '{name}' already exists.")


@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    request: CustomerCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_name_is_free(db, current_user, request.name)
    customer = Customer(
        user_id=current_user.id,
        name=request.name,
        name_normalized=request.name.lower(),
        phone=request.phone,
        notes=request.notes,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return ledger_service.to_customer_response(customer, total_dues=0)


@router.get("/", response_model=list[CustomerResponse])
def list_customers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return ledger_service.list_customers_with_dues(db, current_user.id)


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    customer = get_own_customer(db, customer_id, current_user)
    return ledger_service.to_customer_response(customer, ledger_service.get_customer_dues(db, customer.id))


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: UUID,
    request: CustomerUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = get_own_customer(db, customer_id, current_user)
    changes = request.model_dump(exclude_unset=True)  # only the fields the client sent

    if "name" in changes:
        ensure_name_is_free(db, current_user, changes["name"], current_id=customer.id)
        customer.name_normalized = changes["name"].lower()
    for field, value in changes.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return ledger_service.to_customer_response(customer, ledger_service.get_customer_dues(db, customer.id))


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    customer = get_own_customer(db, customer_id, current_user)
    dues = ledger_service.get_customer_dues(db, customer.id)
    if dues > 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot delete a customer who owes ₹{dues:.2f}. Settle the dues first.")
    db.delete(customer)
    db.commit()

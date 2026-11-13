"""
BahiSaathi — Ledger entry routes

  GET    /entries/                     → list entries (newest first)
  POST   /entries/manual               → add an entry by typing it
  POST   /entries/upload-scan          → upload a bahi photo → AI extracts entries
  GET    /entries/scan/{scan_id}       → status of a scan
  PATCH  /entries/{entry_id}/mark-paid → mark an udhaar entry as paid
  DELETE /entries/{entry_id}           → delete an entry
"""

import os
import uuid
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.config import MAX_UPLOAD_MB, UPLOAD_DIR
from app.database.connection import get_db
from app.models.models import LedgerEntry, OcrScan, PaymentStatus, User
from app.schemas.schemas import LedgerEntryManualRequest, LedgerEntryResponse, OcrScanResponse
from app.services import ledger_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/entries", tags=["Ledger Entries"])

# Accepted image types → file extension to save with
ALLOWED_IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def get_own_entry(db: Session, entry_id: UUID, user: User) -> LedgerEntry:
    """Load an entry that belongs to this user, or 404."""
    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id, LedgerEntry.user_id == user.id).first()
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found.")
    return entry


@router.get("/", response_model=list[LedgerEntryResponse])
def list_entries(
    payment_status: Optional[PaymentStatus] = None,  # ?payment_status=udhaar
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(LedgerEntry)
        .options(joinedload(LedgerEntry.customer))  # load customer names in the same query
        .filter(LedgerEntry.user_id == current_user.id)
    )
    if payment_status:
        query = query.filter(LedgerEntry.payment_status == payment_status)
    return query.order_by(LedgerEntry.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/manual", response_model=LedgerEntryResponse, status_code=status.HTTP_201_CREATED)
def add_manual_entry(
    request: LedgerEntryManualRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = ledger_service.create_entry(
        db,
        current_user.id,
        **request.model_dump(),
        is_manual=True,
        confidence_score=1.0,  # typed by a human
    )
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/upload-scan", response_model=OcrScanResponse, status_code=status.HTTP_201_CREATED)
async def upload_scan(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Save the photo, run the AI on it, and return the scan record.
    If the AI fails, the scan comes back with status "failed" and an error_message.
    (Processing is synchronous for now — simple to follow and debug.)
    """
    extension = ALLOWED_IMAGE_TYPES.get(file.content_type)
    if extension is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only JPEG, PNG and WebP images are accepted.")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Image must be {MAX_UPLOAD_MB} MB or smaller.")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    image_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}.{extension}")
    with open(image_path, "wb") as saved:
        saved.write(contents)

    scan = OcrScan(user_id=current_user.id, image_path=image_path)
    db.add(scan)
    db.commit()

    ledger_service.process_scan(db, scan)
    db.refresh(scan)
    return scan


@router.get("/scan/{scan_id}", response_model=OcrScanResponse)
def get_scan(scan_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    scan = db.query(OcrScan).filter(OcrScan.id == scan_id, OcrScan.user_id == current_user.id).first()
    if not scan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found.")
    return scan


@router.patch("/{entry_id}/mark-paid", response_model=LedgerEntryResponse)
def mark_paid(entry_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    entry = get_own_entry(db, entry_id, current_user)
    if entry.payment_status == PaymentStatus.paid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This entry is already marked as paid.")

    ledger_service.mark_entry_paid(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.delete(get_own_entry(db, entry_id, current_user))
    db.commit()

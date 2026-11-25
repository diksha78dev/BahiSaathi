"""
BahiSaathi — Auth routes

  POST /auth/register  → create a shop owner account
  POST /auth/login     → check phone + password, return a JWT
  GET  /auth/me        → the logged-in user's profile
  PATCH /auth/me       → update shop name / owner name / preferred language
  POST /auth/change-password → set a new password (needs the current one)
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.models import User
from app.schemas.schemas import (
    ChangePasswordRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
    UserUpdateRequest,
)
from app.services import auth_service
from app.services.auth_service import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(request: UserRegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.phone == request.phone).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This phone number is already registered. Please log in.")

    user = User(
        shop_name=request.shop_name,
        owner_name=request.owner_name,
        phone=request.phone,
        hashed_password=hash_password(request.password),
        preferred_language=request.preferred_language,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(request: UserLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == request.phone).first()

    # Same message for "no such phone" and "wrong password" — don't reveal which
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect phone number or password.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")

    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    request: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # exclude_none: a field left out (or sent as null) keeps its current value —
    # these columns are required, so null can never mean "clear it".
    # The user comes from the token, so one account can never edit another.
    return auth_service.update_profile(db, current_user, request.model_dump(exclude_none=True))


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Asking for the current password means a stolen token alone can't lock the owner out.
    # 400, not 401: the token is fine, and the frontend logs the user out on any 401.
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect.")
    if request.new_password == request.current_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must be different from the current one.")

    auth_service.change_password(db, current_user, request.new_password)
    # Existing tokens stay valid until they expire (no token blacklist in this app).
    return Response(status_code=status.HTTP_204_NO_CONTENT)

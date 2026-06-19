"""
BahiSaathi — Auth Router

Endpoints:
  POST /auth/register  → create a new shop owner account
  POST /auth/login     → verify credentials, return JWT token
  GET  /auth/me        → return current logged-in user's profile
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm

from app.database.connection import get_db
from app.models.models import User
from app.schemas.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserResponse,
)
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

# prefix="/auth" means all routes in this file start with /auth
# tags=["Authentication"] groups them in the /docs UI
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new shop owner"
)
def register(request: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new kirana shop owner.

    Flow:
      1. Check if phone number already exists → reject if yes
      2. Hash the password
      3. Insert new User row
      4. Return the user data (without password)

    Status 201 = "Created" (more accurate than 200 for new resource creation)
    """
    # Step 1: Check for duplicate phone
    existing = db.query(User).filter(User.phone == request.phone).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This phone number is already registered. Please log in instead."
        )

    # Step 2 + 3: Hash password and create user
    new_user = User(
        shop_name          = request.shop_name,
        owner_name         = request.owner_name,
        phone              = request.phone,
        hashed_password    = hash_password(request.password),
        preferred_language = request.preferred_language,
    )
    db.add(new_user)
    db.commit()

    # db.refresh() reloads the object from DB so generated fields
    # like id and created_at are available in the response
    db.refresh(new_user)

    return new_user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and get JWT token"
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    phone = form_data.username
    password = form_data.password

    user = db.query(User).filter(User.phone == phone).first()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated."
        )

    token = create_access_token(user.id)

    return {
        "access_token": token,
        "token_type": "bearer"
    }

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile"
)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the logged-in user's profile.
    Requires a valid JWT token in the Authorization header.

    This endpoint is useful for:
      - The frontend to load user info after login
      - Verifying that a token is still valid
    """
    return current_user
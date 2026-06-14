"""
BahiSaathi — Auth Service

Owns two responsibilities:
  1. Password hashing (bcrypt via passlib)
  2. JWT token creation and verification (python-jose)

Why separate from the router?
  The router handles HTTP — what comes in, what goes out.
  This service handles the actual security logic.
  If you ever change from JWT to sessions, you change only this file.
"""

import os
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.models import User

# ── Password hashing setup ──────────────────────────────────────

# CryptContext configures which algorithm to use.
# bcrypt is intentionally slow (makes brute-force attacks impractical).
# deprecated="auto" means old hashes are auto-upgraded on next login.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """
    Convert plain text → bcrypt hash.
    Example: "mypassword123" → "$2b$12$abc...xyz"
    The hash is different every time even for the same input (bcrypt adds salt).
    """
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Check if a plain password matches the stored hash.
    Returns True if correct, False if wrong.
    Never compare strings directly — use this function.
    """
    return pwd_context.verify(plain_password, hashed_password)


# ── JWT token setup ─────────────────────────────────────────────

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-in-production")
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7   # 7 days


def create_access_token(user_id: UUID) -> str:
    """
    Create a JWT token containing the user's ID.

    A JWT has 3 parts separated by dots: header.payload.signature
      header    = {"alg": "HS256", "typ": "JWT"}
      payload   = {"sub": "user-uuid-here", "exp": 1234567890}
      signature = HMAC-SHA256(header + payload, SECRET_KEY)

    The signature is what makes it tamper-proof.
    If anyone changes the payload, the signature won't match and verification fails.
    """
    expire  = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# OAuth2PasswordBearer tells FastAPI:
# "Tokens come in the Authorization header as 'Bearer <token>'"
# The tokenUrl is where clients go to GET a token (our login endpoint)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str          = Depends(oauth2_scheme),
    db:    Session      = Depends(get_db)
) -> User:
    """
    FastAPI dependency — call this in any route that requires login.

    What it does:
      1. Extracts the Bearer token from the Authorization header
      2. Decodes and verifies the JWT signature
      3. Reads the user_id from the payload
      4. Looks up the User in the database
      5. Returns the User object, or raises 401 if anything fails

    Usage in any protected route:
        from app.services.auth_service import get_current_user

        @router.get("/entries")
        def list_entries(current_user: User = Depends(get_current_user)):
            # current_user is the logged-in User object
            ...

    If the token is missing, expired, or tampered → FastAPI auto-returns 401.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception

    return user
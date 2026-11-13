"""
BahiSaathi — Auth service

Two responsibilities, kept out of the routers:
  1. Password hashing (passlib)
  2. JWT creation / verification, and the get_current_user dependency
"""

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, SECRET_KEY
from app.database.connection import get_db
from app.models.models import User

# ── Passwords ───────────────────────────────────────────────────
# New hashes use pbkdf2_sha256 (pure Python, works on every OS).
# bcrypt is listed so older bcrypt hashes still verify where bcrypt is installed.
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # Unknown/unloadable hash scheme — treat as a wrong password
        return False


# ── Tokens ──────────────────────────────────────────────────────

def create_access_token(user_id: UUID) -> str:
    """Signed JWT whose "sub" (subject) is the user's id."""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=JWT_ALGORITHM)


# Reads "Authorization: Bearer <token>". In /docs, click "Authorize" and paste a token.
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency for protected routes:
    token → verify signature + expiry → load user → return it, else 401.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise unauthorized

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user

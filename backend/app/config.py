"""
BahiSaathi — App configuration

Every setting the backend needs lives here, read from environment variables
(loaded from backend/.env in development). Nothing else in the codebase reads
os.getenv directly, so this file is the one place to look for "what can I
configure?".

Required settings have no default: if they are missing the app refuses to
start, instead of silently running with an insecure fallback.
"""

import os

from dotenv import load_dotenv

load_dotenv()


def _required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable {name}. "
            f"Copy backend/.env.example to backend/.env and fill it in."
        )
    return value


# ── Database ────────────────────────────────────────────────────
DATABASE_URL = _required("DATABASE_URL")

# ── Auth (JWT) ──────────────────────────────────────────────────
SECRET_KEY = _required("SECRET_KEY")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24 * 7))  # 7 days

# ── CORS ────────────────────────────────────────────────────────
# Comma-separated list of frontend URLs allowed to call this API
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

# ── AI (Gemini) ─────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")  # optional: scans fail with a clear message without it
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# ── Uploads ─────────────────────────────────────────────────────
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", 5))

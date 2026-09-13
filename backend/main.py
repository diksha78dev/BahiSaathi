"""
BahiSaathi — FastAPI Application Entry Point

Run with:
  uvicorn main:app --reload

Docs:
  http://localhost:8000/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.routers import auth, entries, customers, reports

app = FastAPI(
    title="BahiSaathi AI",
    description=(
        "AI-powered handwritten ledger digitization for Indian kirana stores.\n\n"
        "Upload a photo of your bahi notebook → AI extracts entries automatically.\n"
        "Tracks dues, generates monthly summaries, works in Hindi/Marathi/English."
    ),
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve uploaded images as static files ────────────────────────
# This lets the frontend display ledger photos using a direct URL.
# Example: http://localhost:8000/uploads/abc123.jpg
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ── Routers ──────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(entries.router)
app.include_router(customers.router)
app.include_router(reports.router)


# ── Health check ─────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "app":    "BahiSaathi AI",
        "version": "0.2.0",
        "docs":   "/docs",
        "endpoints": {
            "auth":      ["/auth/register", "/auth/login", "/auth/me"],
            "entries":   ["/entries/", "/entries/manual", "/entries/upload-scan"],
            "customers": ["/customers/"],
            "reports":   ["/reports/dashboard", "/reports/dues", "/reports/monthly/{year}/{month}"],
        }
    }


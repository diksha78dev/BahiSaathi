"""
BahiSaathi — FastAPI Application Entry Point

This file:
  1. Creates the FastAPI app instance
  2. Adds CORS middleware (allows your React frontend to call this API)
  3. Registers all routers (auth, entries, customers, reports)
  4. Defines the root health-check endpoint

Run with:
  uvicorn main:app --reload

Then open:
  http://localhost:8000        → health check
  http://localhost:8000/docs  → Swagger UI (interactive API docs)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth

# ── App instance ────────────────────────────────────────────────

app = FastAPI(
    title="BahiSaathi AI",
    description=(
        "AI-powered handwritten ledger digitization for Indian kirana stores. "
        "Upload a photo of your bahi notebook and get structured entries automatically."
    ),
    version="0.1.0",
    docs_url="/docs",        # Swagger UI
    redoc_url="/redoc",      # Alternative docs UI
)

# ── CORS middleware ─────────────────────────────────────────────
#
# CORS (Cross-Origin Resource Sharing) is a browser security policy.
# By default, a browser blocks JS from site A calling an API on site B.
# Adding this middleware tells the browser "it's ok, I allow these origins."
#
# In development: allow_origins=["*"] means allow everyone.
# In production (Module 8): replace "*" with your actual Vercel URL.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # TODO Module 8: replace with ["https://your-app.vercel.app"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ────────────────────────────────────────────
#
# Each router is a collection of related endpoints.
# We add more routers in Module 3 (entries, customers, reports).

app.include_router(auth.router)

# Module 3 — uncomment these when you create them:
# from app.routers import entries, customers, reports
# app.include_router(entries.router)
# app.include_router(customers.router)
# app.include_router(reports.router)


# ── Root endpoint ───────────────────────────────────────────────

@app.get("/", tags=["Health"])
def health_check():
    """
    Health check endpoint.
    Used by Railway (deployment) to verify the server is running.
    Also useful to quickly check if your backend is up.
    """
    return {
        "status": "ok",
        "app": "BahiSaathi AI",
        "version": "0.1.0",
        "docs": "/docs"
    }
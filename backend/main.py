"""
BahiSaathi — FastAPI entry point

Run (from backend/, venv active):   uvicorn main:app --reload
Interactive API docs:               http://localhost:8000/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import auth, customers, entries, reports

app = FastAPI(
    title="BahiSaathi AI",
    description="Digitise handwritten kirana ledgers: upload a bahi photo, AI extracts the entries, dues are tracked automatically.",
    version="0.3.0",
)

# Allow the React frontend (a different origin/port) to call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(entries.router)
app.include_router(customers.router)
app.include_router(reports.router)


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "docs": "/docs"}

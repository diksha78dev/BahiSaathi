"""
BahiSaathi — Create database tables

Usage (from backend/, with the venv active):
    python -m app.database.init_db

Safe to run repeatedly: create_all() skips tables that already exist.
"""

from app.database.connection import Base, engine
from app.models import models  # noqa: F401 — importing registers the tables on Base


def init_db():
    Base.metadata.create_all(bind=engine)
    print("Tables ready:", ", ".join(Base.metadata.tables.keys()))


if __name__ == "__main__":
    init_db()

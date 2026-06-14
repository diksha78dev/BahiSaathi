"""
BahiSaathi — Database connection
Reads DATABASE_URL from .env and creates the SQLAlchemy engine.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()  # reads your .env file automatically

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/bahisaathi_db"
)

# engine = the actual connection pool to PostgreSQL
# pool_pre_ping=True: checks connection health before each use
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# SessionLocal: call this to get one DB session per request
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base: all your models inherit from this
Base = declarative_base()


def get_db():
    """
    FastAPI dependency — gives each request its own DB session.
    The finally block closes the session even if an error occurs.

    Usage inside any FastAPI route:
        from app.database.connection import get_db
        from sqlalchemy.orm import Session
        from fastapi import Depends

        @router.get("/something")
        def my_route(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
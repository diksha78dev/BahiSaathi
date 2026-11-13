"""
BahiSaathi — Database connection

Creates the SQLAlchemy engine from DATABASE_URL and provides get_db(),
a FastAPI dependency that gives each request its own session.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import DATABASE_URL

# pool_pre_ping: test each pooled connection before use, so a restarted
# database doesn't cause "connection closed" errors
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# All models inherit from Base
Base = declarative_base()


def get_db():
    """Yield a DB session for one request and always close it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

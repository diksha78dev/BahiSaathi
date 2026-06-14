"""
BahiSaathi — Database initialiser
Run this ONCE to create all tables in PostgreSQL.

Usage (from inside the backend/ folder, with venv active):
    python -m app.database.init_db

Safe to run multiple times — create_all() skips tables that already exist.
"""

from app.database.connection import engine, Base

# These imports register the models with Base.metadata
# Without them, create_all() doesn't know these tables exist
from app.models.models import User, Customer, LedgerEntry, OcrScan  # noqa: F401


def init_db():
    print("\n🚀 BahiSaathi — Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("\n✅ Done! Tables created:")
    for table_name in Base.metadata.tables.keys():
        print(f"   ✓ {table_name}")
    print("\nYou can verify these in pgAdmin under:")
    print("  Servers → PostgreSQL → Databases → bahisaathi_db → Schemas → public → Tables\n")


if __name__ == "__main__":
    init_db()
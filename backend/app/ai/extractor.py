"""
BahiSaathi — Gemini Vision Extractor  (Module 4)

Pipeline:
  image file path
    → PIL Image object
    → Gemini 1.5 Flash (vision + text prompt)
    → raw JSON string
    → list of ExtractedEntry (Pydantic validated)
    → saved to ledger_entries table
    → customer dues updated
    → OcrScan status → completed / failed

Why Gemini 1.5 Flash?
  - Free tier is generous (15 requests/min, 1500/day)
  - Supports image input natively via the Python SDK
  - Understands Hindi/Marathi/English mixed text
  - No base64 encoding needed — SDK accepts PIL Image directly
"""

import json
import os
from datetime import datetime, date
from typing import List, Optional

import google.generativeai as genai
from PIL import Image
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.models import (
    Customer,
    LedgerEntry,
    OcrScan,
    PaymentStatus,
    ScanStatus,
)
from dotenv import load_dotenv

load_dotenv()
# ── Gemini setup ─────────────────────────────────────────────────
# Configure runs once at import time.
# The API key is read from your .env file via python-dotenv (loaded in connection.py)
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# gemini-1.5-flash: fastest and cheapest multimodal model
# good enough for ledger extraction — save gemini-1.5-pro for complex cases
model = genai.GenerativeModel("gemini-2.5-flash")


# ── Extraction prompt ────────────────────────────────────────────
#
# This is the most important part of the AI layer.
# A vague prompt → unusable output.
# A precise prompt → clean JSON you can parse directly.
#
# Key techniques used here:
#   1. Role assignment ("You are an expert...")
#   2. Explicit field list with types
#   3. Examples of Hindi/Marathi vocabulary to recognise
#   4. "Return ONLY valid JSON" — critical, prevents markdown wrapping
#   5. Fallback instruction (empty array if unreadable)

EXTRACTION_PROMPT = """You are an expert ledger entry extractor for Indian kirana (grocery) stores.

The image shows a page from a handwritten "bahi" (account) notebook.
Text may be in Hindi, Marathi, English, or a mixture of all three scripts.

Your job: Extract EVERY transaction entry visible on the page.

For each entry, return a JSON object with EXACTLY these fields:
  - customer_name   : string or null  (the buyer's name if written)
  - item_name       : string          (what was sold — keep original language)
  - quantity        : number or null  (numeric amount only)
  - unit            : string or null  (kg, g, litre, ml, piece, dozen, etc.)
  - amount_inr      : number          (price in Indian Rupees — must be a NUMBER not string)
  - transaction_date: string or null  (format: "YYYY-MM-DD" — if only day/month written, use current year)
  - payment_status  : string          ("paid" or "udhaar" — default to "udhaar" if unclear)
  - confidence      : number          (your confidence 0.0 to 1.0)

Hindi / Marathi vocabulary reference:
  उधार / उधाऱ / उधारी = udhaar (credit, not yet paid)
  नकद / कॅश / जमा    = paid
  किलो / kg / KG      = kilograms
  लिटर / L / ltr      = litres
  पाव                 = 250 grams (quarter kg)
  अर्धा              = 500 grams (half kg)
  रु / Rs / ₹         = Rupees

IMPORTANT RULES:
  1. Return ONLY a valid JSON array — no explanation, no markdown, no code fences
  2. Every entry MUST have item_name and amount_inr
  3. If a field is missing or unreadable, use null (not empty string)
  4. amount_inr must always be a number (e.g. 90.0 not "90")
  5. If the entire page is unreadable, return exactly: []

Example of correct output (2 entries):
[
  {
    "customer_name": "Ramesh",
    "item_name": "Wheat flour",
    "quantity": 2,
    "unit": "kg",
    "amount_inr": 90,
    "transaction_date": "2024-06-15",
    "payment_status": "udhaar",
    "confidence": 0.95
  },
  {
    "customer_name": null,
    "item_name": "चाय पत्ती",
    "quantity": 500,
    "unit": "g",
    "amount_inr": 60,
    "transaction_date": null,
    "payment_status": "paid",
    "confidence": 0.88
  }
]"""


# ── Data model for one extracted entry ───────────────────────────
#
# This is a Pydantic model used ONLY for validating AI output.
# It is NOT a database model.
# After validation, we convert it to a LedgerEntry (SQLAlchemy model).

class ExtractedEntry(BaseModel):
    customer_name:    Optional[str]   = None
    item_name:        str
    quantity:         Optional[float] = None
    unit:             Optional[str]   = None
    amount_inr:       float
    transaction_date: Optional[str]   = None
    payment_status:   str             = "udhaar"
    confidence:       Optional[float] = None


# ── Step 1: Call Gemini Vision ────────────────────────────────────

def call_gemini(image_path: str) -> str:
    """
    Open the image and send it to Gemini 1.5 Flash along with the prompt.

    Why PIL Image and not base64?
    The google-generativeai SDK accepts PIL Image objects directly.
    This is simpler and avoids the overhead of base64 encoding.

    Returns: raw text response from Gemini (should be a JSON array string)
    """
    img = Image.open(image_path)

    # generate_content accepts a list: [text_prompt, image]
    # or [image, text_prompt] — order doesn't matter for Gemini
    response = model.generate_content([EXTRACTION_PROMPT, img])

    return response.text


# ── Step 2: Parse Gemini's response ──────────────────────────────

def parse_response(raw_text: str) -> List[ExtractedEntry]:
    """
    Convert Gemini's raw text → list of validated ExtractedEntry objects.

    Defensive parsing handles 3 common Gemini quirks:
      1. Wraps JSON in ```json ... ``` markdown fences
      2. Returns a single object {} instead of an array [{}]
      3. Returns invalid JSON (we catch and return empty list)

    If parsing fails, we return [] — the scan will be marked as failed
    but the server won't crash.
    """
    clean = raw_text.strip()

    # Strip markdown code fences if present
    # Gemini sometimes does this even when told not to
    if "```" in clean:
        # Split on ``` and find the piece that looks like JSON
        parts = clean.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()    # remove "json" label
            if part.startswith("[") or part.startswith("{"):
                clean = part
                break

    try:
        data = json.loads(clean)

        # If Gemini returned a single object instead of array, wrap it
        if isinstance(data, dict):
            data = [data]

        if not isinstance(data, list):
            print(f"[Gemini] Unexpected response type: {type(data)}")
            return []

        entries = []
        for item in data:
            if not isinstance(item, dict):
                continue
            try:
                entries.append(ExtractedEntry(**item))
            except Exception as e:
                # Skip this entry if it doesn't fit the schema
                print(f"[Gemini] Skipping malformed entry: {e} — {item}")
                continue

        return entries

    except json.JSONDecodeError as e:
        print(f"[Gemini] JSON parse failed: {e}")
        print(f"[Gemini] Raw response was: {raw_text[:500]}")
        return []


# ── Step 3: Resolve or create customer ───────────────────────────

def get_or_create_customer(
    db: Session,
    user_id,
    name: str
) -> Optional[Customer]:
    """
    Find an existing customer by normalised name, or create a new one.

    Why normalise?
    A shopkeeper might write "Ramesh", "ramesh", or "RAMESH" across different
    pages. We lowercase and strip before comparing so all three match the
    same customer row.

    db.flush() assigns the new customer an ID immediately without committing
    the full transaction — so we can use customer.id for the entry FK
    before the final db.commit().
    """
    if not name or not name.strip():
        return None

    name_norm = name.lower().strip()

    existing = db.query(Customer).filter(
        Customer.user_id        == user_id,
        Customer.name_normalized == name_norm
    ).first()

    if existing:
        return existing

    # Customer doesn't exist yet — create them
    new_customer = Customer(
        user_id         = user_id,
        name            = name.strip(),
        name_normalized = name_norm,
        total_dues      = 0.0,
    )
    db.add(new_customer)
    db.flush()   # assigns ID without full commit
    return new_customer


# ── Step 4: Save entries to database ─────────────────────────────

def save_entries(
    db: Session,
    user_id,
    scan_id,
    entries: List[ExtractedEntry]
) -> int:
    """
    Convert each ExtractedEntry → LedgerEntry row and save to DB.
    Also updates customer.total_dues for udhaar entries.
    Returns the count of successfully saved entries.
    """
    saved_count = 0

    for entry in entries:

        # Resolve customer (find existing or create new)
        customer = get_or_create_customer(db, user_id, entry.customer_name)

        # Parse transaction date string → Python date object
        txn_date = None
        if entry.transaction_date:
            try:
                txn_date = date.fromisoformat(entry.transaction_date)
            except ValueError:
                # Date string from Gemini was invalid — store null
                pass

        # Map string → PaymentStatus enum
        pay_status = (
            PaymentStatus.paid
            if entry.payment_status and entry.payment_status.lower() == "paid"
            else PaymentStatus.udhaar
        )

        # Create the DB row
        ledger_entry = LedgerEntry(
            user_id          = user_id,
            customer_id      = customer.id if customer else None,
            ocr_scan_id      = scan_id,
            item_name        = entry.item_name.strip(),
            quantity         = entry.quantity,
            unit             = entry.unit,
            amount           = entry.amount_inr,
            transaction_date = txn_date,
            payment_status   = pay_status,
            raw_text         = entry.customer_name,   # store original name for audit
            confidence_score = entry.confidence,
            is_manual        = False,                 # AI extracted, not manual
        )
        db.add(ledger_entry)

        # Update customer's running dues total
        if customer and pay_status == PaymentStatus.udhaar:
            customer.total_dues = (customer.total_dues or 0) + entry.amount_inr

        saved_count += 1

    # One commit for all entries + customer updates = atomic
    # Either all save or none save — no partial state
    db.commit()
    return saved_count


# ── Master function: called from entries router ───────────────────

def extract_and_save(scan_id, image_path: str, user_id, db: Session):
    """
    Full pipeline — this is the only function entries.py calls.

    Flow:
      1. Load scan record from DB
      2. Call Gemini Vision
      3. Parse response
      4. Save entries to DB
      5. Update scan status → completed or failed

    All errors are caught here — the server never crashes from an AI failure.
    The error message is stored in scan.error_message for debugging.
    """
    # Load the scan record
    scan = db.query(OcrScan).filter(OcrScan.id == scan_id).first()
    if not scan:
        print(f"[Gemini] Scan {scan_id} not found in DB")
        return

    try:
        print(f"[Gemini] Starting extraction for scan {scan_id}")

        # Step 1: Call Gemini Vision
        raw_text = call_gemini(image_path)
        scan.raw_ocr_text = raw_text
        print(f"[Gemini] Raw response length: {len(raw_text)} chars")

        # Step 2: Parse the response
        entries = parse_response(raw_text)
        print(f"[Gemini] Parsed {len(entries)} entries")

        # Step 3: Save to DB
        count = save_entries(db, user_id, scan_id, entries)

        # Step 4: Update scan record as completed
        scan.status            = ScanStatus.completed
        scan.entries_extracted = count
        scan.processed_at      = datetime.utcnow()

        # Detect language from the raw text (simple heuristic)
        # Devanagari Unicode block: U+0900 to U+097F
        has_devanagari = any('\u0900' <= ch <= '\u097F' for ch in raw_text)
        scan.detected_language = "mixed" if has_devanagari else "en"

        print(f"[Gemini] Done — saved {count} entries, status: completed")

    except Exception as ex:
        # Something went wrong — mark scan as failed, store error
        scan.status        = ScanStatus.failed
        scan.error_message = str(ex)
        print(f"[Gemini] Extraction failed for scan {scan_id}: {ex}")

    # Commit the scan status update
    db.commit()
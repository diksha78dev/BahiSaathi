"""
BahiSaathi — Gemini ledger extractor

One job: photo of a bahi page → list of validated entries.
It does not touch the database; ledger_service.extract_scan() stores the result
as a draft for the shopkeeper to review.

  image ──► straighten (EXIF) ──► Gemini (vision, JSON mode) ──► JSON text ──► ExtractedEntry objects
"""

import json
import logging
from dataclasses import dataclass
from datetime import date
from typing import Optional

from google import genai
from google.genai import types
from PIL import Image, ImageOps
from pydantic import BaseModel, ValidationError, field_validator

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.models.models import PaymentStatus

logger = logging.getLogger(__name__)

PROMPT_TEMPLATE = """You read handwritten "bahi" (ledger) pages from Indian kirana (grocery) stores.
Text may be in Hindi, Marathi, English, or a mix of scripts. Today's date is {today}.

Extract EVERY transaction line on the page as a JSON array. Each item has exactly these fields:
  customer_name    : string or null   (buyer's name if written)
  item_name        : string           (what was sold, in the original language)
  quantity         : number or null
  unit             : string or null   (kg, g, litre, ml, piece, dozen...)
  amount_inr       : number           (price in rupees)
  transaction_date : "YYYY-MM-DD" or null  (if only day/month is written, use the year of today's date)
  payment_status   : "udhaar" or "paid"    (use "udhaar" if unclear)
  confidence       : number 0.0–1.0   (how sure you are about this line)

Vocabulary: उधार/उधारी = udhaar (credit) · नकद/कॅश/जमा/पैसे दिले/दिले = paid · किलो = kg ·
लिटर = litre · पाव = 250 g · अर्धा = 500 g · रु/Rs/₹ = rupees.

Rules:
- A customer's name applies to every line under it (often numbered 1., 2., ...) until the
  next name appears — repeat the name on each of those lines.
- Column headings (e.g. माल / पैसे / Item / Amount) are not transactions.
- Every item must have item_name and amount_inr; use null for unreadable fields.
- If nothing is readable return [].
"""


class ExtractedEntry(BaseModel):
    """One line as read by the AI, validated before it is saved."""
    customer_name: Optional[str] = None
    item_name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    amount_inr: float
    transaction_date: Optional[date] = None
    payment_status: PaymentStatus = PaymentStatus.udhaar
    confidence: Optional[float] = None

    @field_validator("transaction_date", mode="before")
    @classmethod
    def ignore_bad_date(cls, value):
        # A misread date shouldn't drop the whole line — fall back to "no date" (→ today)
        try:
            return date.fromisoformat(value) if value else None
        except (TypeError, ValueError):
            return None

    @field_validator("payment_status", mode="before")
    @classmethod
    def default_to_udhaar(cls, value):
        return PaymentStatus.paid if str(value).strip().lower() == "paid" else PaymentStatus.udhaar


@dataclass
class ExtractionResult:
    entries: list[ExtractedEntry]
    raw_text: str
    detected_language: str  # "mixed" if any Devanagari script, else "en"


def extract_entries(image_path: str) -> ExtractionResult:
    """Send the image to Gemini and return the validated entries. Raises on API/JSON errors."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set in backend/.env")

    client = genai.Client(api_key=GEMINI_API_KEY)
    with Image.open(image_path) as photo:
        # Phones often save photos sideways plus an EXIF "rotate me" flag.
        # Apply that rotation so the AI sees the page upright.
        image = ImageOps.exif_transpose(photo)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[PROMPT_TEMPLATE.format(today=date.today().isoformat()), image],
            # JSON mode: Gemini returns raw JSON, no markdown fences to strip
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )

    raw_text = response.text or ""
    data = json.loads(raw_text)
    if isinstance(data, dict):  # a single entry instead of a list
        data = [data]
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON array from Gemini, got {type(data).__name__}")

    entries = []
    for item in data:
        try:
            entries.append(ExtractedEntry.model_validate(item))
        except ValidationError as error:
            logger.warning("Skipping unreadable line %s: %s", item, error)

    has_devanagari = any("ऀ" <= ch <= "ॿ" for ch in raw_text)
    return ExtractionResult(entries=entries, raw_text=raw_text, detected_language="mixed" if has_devanagari else "en")

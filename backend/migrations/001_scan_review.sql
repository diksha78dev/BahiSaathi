-- 001 — Review AI scans before saving (Step 2)
--
-- Only needed for databases created BEFORE this change; a fresh database gets
-- all of this from init_db.py (Base.metadata.create_all). Safe to run twice.
-- Purely additive: no existing rows or columns are changed.
--
-- Run:  psql "$DATABASE_URL" -f migrations/001_scan_review.sql

-- New scan states: draft waiting for the shopkeeper, and draft thrown away
ALTER TYPE scanstatus ADD VALUE IF NOT EXISTS 'needs_review';
ALTER TYPE scanstatus ADD VALUE IF NOT EXISTS 'discarded';

-- The AI's draft lines, kept on the scan until confirmed
ALTER TABLE ocr_scans ADD COLUMN IF NOT EXISTS extracted_entries JSONB;

-- Fingerprint of the photo, to refuse saving the exact same photo twice
ALTER TABLE ocr_scans ADD COLUMN IF NOT EXISTS image_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS ix_ocr_scans_image_hash ON ocr_scans (image_hash);

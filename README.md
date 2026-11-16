# BahiSaathi AI 🧾

> AI-powered handwritten ledger digitization for Indian kirana store owners

## Problem
Small kirana store owners keep handwritten "bahi" notebooks. Tracking who owes
what (udhaar), understanding sales, and month-end totals all happen by hand.

## Solution
- 📸 Photograph a ledger page
- 🤖 Gemini reads it and extracts each line (customer, item, quantity, amount, date, paid/udhaar)
- 📊 Dues per customer and monthly totals are calculated automatically
- 🌐 Works with Hindi, Marathi, English and mixed-script handwriting

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite, React Router, Axios, Framer Motion |
| Backend | FastAPI (Python 3.11), Pydantic v2 |
| Database | PostgreSQL + SQLAlchemy 2 |
| AI | Google Gemini 2.5 Flash (vision, JSON mode) via `google-genai` |
| Auth | JWT (python-jose), pbkdf2-sha256 password hashing (passlib) |
| Deployment (planned) | Railway (backend) · Vercel (frontend) |

## Build Status
- [x] Module 1 — Project setup + database schema
- [x] Module 2 — FastAPI + JWT auth
- [x] Module 3 — Core API routes
- [x] Module 4 — Gemini AI extractor
- [x] Module 5 — React + auth UI
- [x] Module 6 — Dashboard UI
- [ ] Module 7 — Customers & Reports pages
- [ ] Module 8 — Deploy

---

## How it works

### Architecture
```
React (Vite, :5173)                         FastAPI (:8000)                    PostgreSQL
───────────────────                         ───────────────                    ──────────
pages/ + components/   ── uses ──►  api/*.js  ──HTTP + JWT──►  routers/   ──►  services/  ──►  models/
(UI only, props)                   (1 function                 (HTTP only:     (business      (tables)
                                    per endpoint)               validate,       rules)
                                                                call service)      │
                                                                                   └──► ai/extractor.py ──► Gemini
```

**Backend layers** (`backend/app/`)
| Folder | Responsibility |
|--------|----------------|
| `config.py` | Every setting, read from environment variables. Required ones (DB URL, secret key) stop the app at startup if missing. |
| `models/` | SQLAlchemy tables: `users`, `customers`, `ledger_entries`, `ocr_scans` |
| `schemas/` | Pydantic request/response shapes — validates input, hides internal fields |
| `routers/` | HTTP endpoints only: parse request → call service → return response |
| `services/` | Business rules: auth/JWT (`auth_service`), entries/customers/dues/scans (`ledger_service`) |
| `ai/` | Gemini call: image in → validated entries out. Never touches the database |

**Frontend layers** (`frontend/src/`)
| Folder | Responsibility |
|--------|----------------|
| `api/` | `client.js` (Axios + token + error messages) and one small file per backend router |
| `context/` + `hooks/useAuth` | Who is logged in; login / register / logout |
| `hooks/useDashboardData` | Loads stats, entries, dues, customers in parallel; `reload()` refreshes all |
| `pages/` | Screens. `Dashboard` owns data + actions and passes them down as props |
| `components/` | Presentational pieces (stat cards, lists, form, upload, scan review) |
| `utils/format.js` | ₹ / date / quantity formatting |
| `utils/entryForm.js` | Form strings ⇄ API entry, shared by the manual form and the scan review |

### Request flows

**Login**
1. `POST /auth/login {phone, password}` → backend normalises the phone (last 10 digits), verifies the hash, returns a JWT.
2. Frontend stores the token in `localStorage`; `client.js` adds `Authorization: Bearer <token>` to every request.
3. Protected routes use the `get_current_user` dependency: verify token → load user → 401 if anything is wrong. On a 401 the frontend clears the token and goes to `/login`.

**Manual entry**
`POST /entries/manual {customer_name?, item_name, amount, ...}` → `ledger_service.create_entry()` finds the
customer case-insensitively ("Ramesh" = "ramesh ") or creates them, then saves the entry. Blank name = walk-in sale.

**Photo scan (AI reads → shopkeeper checks → then saved)**
```
upload ─► pending ─► needs_review ─► confirm ─► completed   (entries now in the ledger)
             │             └───────► discard ─► discarded   (nothing saved)
             └──► failed (reason shown in the UI)
```
1. `POST /entries/upload-scan` (multipart image) → type and size checked → SHA-256 of the photo compared with this
   shop's saved scans (exact same photo already saved → `409`, no AI call spent) → image saved → `OcrScan` row.
2. `ledger_service.extract_scan()` → `extractor.extract_entries()` straightens the photo (EXIF rotation) and asks
   Gemini for a JSON array → each line validated → kept as a **draft** in `ocr_scans.extracted_entries`.
   **Nothing is written to the ledger yet.** The scan comes back as `needs_review` with the draft.
3. The dashboard shows the draft in `ScanReview`: every field editable, lines can be removed or added, lines the AI
   was unsure about (confidence < 0.85) are highlighted.
4. `POST /entries/scan/{id}/confirm {entries}` saves the reviewed lines through the **same** `create_entry()` as
   manual entries. `POST /entries/scan/{id}/discard` throws the draft away. Either works once (`409` after that).

Why review first: in real-photo tests Gemini read clear pages 7/7 correctly, but a sideways photo put one item under
the wrong customer, and re-scanning a page silently doubled the dues. A wrong ledger costs the shopkeeper real money,
so a human confirms before anything is saved.

### Design decisions worth knowing
- **Dues are calculated, never stored.** A customer's dues = `SUM(amount)` of their `udhaar` entries, done in SQL.
  There's no running total to keep in sync, so marking paid or deleting an entry can't leave dues wrong.
- **Reports group by `transaction_date`** (the date written in the bahi), which defaults to today.
- **One code path for manual and AI entries** (`create_entry`), so both behave the same.
- **AI output is a suggestion, not data.** Scans are reviewed by the shopkeeper before they touch the ledger.
- **No hardcoded secrets or URLs** — everything comes from `.env` (see the `.env.example` files).
- **Uploaded photos are private** — saved on disk, not served publicly.

---

## API
Interactive docs with "Try it out": http://localhost:8000/docs (click **Authorize** and paste a token from `/auth/login`).

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | Create a shop account |
| POST | `/auth/login` | Get a JWT |
| GET | `/auth/me` | Current user |
| GET | `/entries/?payment_status=udhaar` | List entries (newest first) |
| POST | `/entries/manual` | Add an entry |
| POST | `/entries/upload-scan` | Upload a bahi photo → AI draft to review (nothing saved yet) |
| GET | `/entries/scan/{id}` | Scan status and draft |
| POST | `/entries/scan/{id}/confirm` | Save the reviewed lines to the ledger |
| POST | `/entries/scan/{id}/discard` | Throw the draft away |
| PATCH | `/entries/{id}/mark-paid` | Mark an udhaar entry paid |
| DELETE | `/entries/{id}` | Delete an entry |
| GET/POST | `/customers/` | List (with dues) / create customers |
| GET/PATCH/DELETE | `/customers/{id}` | One customer (delete only if no dues) |
| GET | `/reports/dashboard` | Home-screen stats |
| GET | `/reports/dues` | Customers who owe money |
| GET | `/reports/monthly/{year}/{month}` | One month's totals |
| GET | `/reports/monthly-list?months=6` | Last N months |

---

## Local Setup

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env         # then fill in DATABASE_URL, SECRET_KEY, GEMINI_API_KEY
python -m app.database.init_db
uvicorn main:app --reload
```
`init_db` creates every table for a new database. A database created before a schema change needs the matching
file in `backend/migrations/` (additive, safe to run twice), e.g. `psql "<DATABASE_URL>" -f migrations/001_scan_review.sql`.

### Frontend
```bash
cd frontend
npm install
copy .env.example .env         # VITE_API_URL=http://localhost:8000
npm run dev                    # http://localhost:5173
```

---

## Deployment (free tier)

```
Browser ──► Vercel (React build) ──► Render (FastAPI) ──► Neon (PostgreSQL)
                                          └──► Gemini API
```

| Part | Host | Config in repo | Notes |
|------|------|----------------|-------|
| Database | Neon free plan | — | Permanent, 1 GB. Sleeps after 5 min idle, wakes on the next query. |
| Backend | Render free web service | `render.yaml` | Sleeps after 15 min idle; the first request then takes ~1 min. Tables are created on start (`init_db`). |
| Frontend | Vercel Hobby | `frontend/vercel.json` | Rewrites every path to `index.html` so refreshing `/dashboard` works. |

Environment variables (set in each dashboard, never committed):
- **Render:** `DATABASE_URL` (Neon connection string), `GEMINI_API_KEY`, `CORS_ORIGINS` (the Vercel URL).
  `SECRET_KEY` is generated by Render.
- **Vercel:** `VITE_API_URL` (the Render URL). Vite bakes it into the build, so redeploy after changing it.

Uploaded photos are read within the same request, so Render's temporary disk is fine: nothing needs a photo after
the scan returns.

## Developer
**Diksha** — B.Tech CSE, RIT Islampur (2023–2027)
GitHub: [@diksha78dev](https://github.com/diksha78dev)

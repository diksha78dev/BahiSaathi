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
| `components/` | Presentational pieces (stat cards, lists, form, upload) |
| `utils/format.js` | ₹ / date / quantity formatting |

### Request flows

**Login**
1. `POST /auth/login {phone, password}` → backend normalises the phone (last 10 digits), verifies the hash, returns a JWT.
2. Frontend stores the token in `localStorage`; `client.js` adds `Authorization: Bearer <token>` to every request.
3. Protected routes use the `get_current_user` dependency: verify token → load user → 401 if anything is wrong. On a 401 the frontend clears the token and goes to `/login`.

**Manual entry**
`POST /entries/manual {customer_name?, item_name, amount, ...}` → `ledger_service.create_entry()` finds the
customer case-insensitively ("Ramesh" = "ramesh ") or creates them, then saves the entry. Blank name = walk-in sale.

**Photo scan**
`POST /entries/upload-scan` (multipart image) → type and size checked → image saved → `OcrScan` row (pending) →
`ledger_service.process_scan()` → `extractor.extract_entries()` asks Gemini for a JSON array → each line validated →
saved through the **same** `create_entry()` as manual entries → scan marked `completed` (or `failed` with the reason,
which the UI shows).

### Design decisions worth knowing
- **Dues are calculated, never stored.** A customer's dues = `SUM(amount)` of their `udhaar` entries, done in SQL.
  There's no running total to keep in sync, so marking paid or deleting an entry can't leave dues wrong.
- **Reports group by `transaction_date`** (the date written in the bahi), which defaults to today.
- **One code path for manual and AI entries** (`create_entry`), so both behave the same.
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
| POST | `/entries/upload-scan` | Upload a bahi photo for AI extraction |
| GET | `/entries/scan/{id}` | Scan status |
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

### Frontend
```bash
cd frontend
npm install
copy .env.example .env         # VITE_API_URL=http://localhost:8000
npm run dev                    # http://localhost:5173
```

## Developer
**Diksha** — B.Tech CSE, RIT Islampur (2023–2027)
GitHub: [@diksha78dev](https://github.com/diksha78dev)

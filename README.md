# BahiSaathi AI 🧾

> AI-powered handwritten ledger digitization for Indian kirana store owners

## Problem
Small kirana store owners maintain handwritten "bahi" notebooks. They struggle
with tracking dues, understanding sales data, and GST filing. No existing app
solves this for vernacular, low-tech users.

## Solution
- 📸 Click a photo of your handwritten ledger page
- 🤖 AI extracts entries (item, quantity, amount, customer, date)
- 📊 Auto-generates monthly summaries and flags overdue dues
- 🌐 Works in Hindi, Marathi, and English mixed input

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite) → React Native (Expo) |
| Backend | FastAPI (Python) |
| AI | Gemini 1.5 Flash Vision |
| Database | PostgreSQL + SQLAlchemy |
| Deployment | Railway (backend) · Vercel (frontend) |

## Build Status
- [x] Module 1 — Project setup + Database schema
- [ ] Module 2 — FastAPI + Auth
- [ ] Module 3 — Core API routes
- [ ] Module 4 — Gemini AI layer
- [ ] Module 5 — React + Auth UI
- [ ] Module 6 — Dashboard UI
- [ ] Module 7 — Reports + wiring
- [ ] Module 8 — Deploy

## Local Setup

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements.txt
cp .env.example .env        # fill in your values
python -m app.database.init_db
uvicorn main:app --reload
```

### Frontend (Module 5+)
```bash
cd frontend
npm install
npm run dev
```

## API Docs
After running the backend: http://localhost:8000/docs

## Developer
**Diksha** — B.Tech CSE, RIT Islampur (2023–2027)  
GitHub: [@diksha78dev](https://github.com/diksha78dev)
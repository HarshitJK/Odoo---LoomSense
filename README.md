# LoomSense — Textile Production & Profit Intelligence Platform

LoomSense connects the full lifecycle of a textile order
(raw material → production → workforce → quality → buyer tracking → profitability)
so the owner can see exactly where every rupee of profit was made or lost.

**Read [`context.md`](context.md) first — it is the source of truth for scope, features and naming.**

## Architecture

```
React (Vite + Tailwind)  ──REST + WebSocket──>  FastAPI  ──PyMongo──>  MongoDB
```

- `frontend/` — React app (works on mock data in `src/mocks/` until APIs are ready)
- `backend/` — FastAPI app (routes, models, services, WebSocket)
- `docs/` — architecture and API notes

More detail: [`docs/architecture.md`](docs/architecture.md), [`docs/api.md`](docs/api.md).

## Prerequisites

Node.js 18+, Python 3.10+, and MongoDB (local or Atlas).

## MongoDB setup

Either run MongoDB locally (default `mongodb://localhost:27017`) or create a free
MongoDB Atlas cluster and use its connection string. The API still starts without
MongoDB; database routes will return HTTP 503 until it is reachable.

## Environment variables

Copy `.env.example` to `backend/.env` (never commit it).

| Variable | Where | Default |
|---|---|---|
| `MONGODB_URI` | backend | `mongodb://localhost:27017` |
| `MONGODB_DB_NAME` | backend | `loomsense` |
| `CORS_ORIGINS` | backend | `http://localhost:5173` |
| `VITE_API_URL` | frontend (`frontend/.env`) | `http://localhost:8000` |

## Run the backend

```bash
cd backend
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

API: http://localhost:8000 — interactive docs: http://localhost:8000/docs — health: http://localhost:8000/api/health

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## Team workflow

| Dev | Branch | Owns |
|---|---|---|
| 1 (advanced) | `backend-core` | FastAPI, MongoDB, costing/profit engines, simulator, WebSockets |
| 2 | `frontend-dashboard` | Owner Dashboard, Production Control Tower, charts, machine cards, order tables |
| 3 | `frontend-operations` | Inventory, Workers, Quality form, Fabric Passport, Buyer Tracking |

- Branch from `dev`; open PRs into `dev`; `main` is for demo-ready code only.
- Commit style: `feat: ...`, `fix: ...`, `ui: ...`.
- Frontend uses mock data first; switch to API calls once endpoints exist.
- Never commit `.env`, credentials or API keys.

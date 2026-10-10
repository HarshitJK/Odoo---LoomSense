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
| `DB_NAME` | backend | `loomsense` |
| `CORS_ORIGINS` | backend | `http://localhost:5173` (add your deployed frontend URL) |
| `PASSPORT_BASE_URL` | backend | `http://localhost:5173` (QR codes point here) |
| `ADMIN_KEY` | backend | unset = `POST /api/demo/reset` disabled |
| `SIMULATOR_AUTOSTART` | backend | `true` |
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

Load demo data once with `python -m app.seed`. API: http://localhost:8000 — interactive docs: http://localhost:8000/docs — health: http://localhost:8000/api/health

## Demo

- `python demo_flow.py` (in `backend/`, server running) plays the whole story from `context.md` section 15 through the API
  and prints each step. With `ADMIN_KEY` set it first resets the data.
- `POST /api/demo/reset` with header `X-Admin-Key` re-seeds instantly between demo runs.
- `python ws_check.py` prints the first five live machine messages.

## Tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest            # uses a separate "loomsense_test" database
python smoke_test.py        # against a running server (writes a few test records; re-seed afterwards)
```

## Deploy (Render + MongoDB Atlas)

`render.yaml` defines one web service (root `backend`): build `pip install -r requirements.txt`, start
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set `MONGODB_URI`, `CORS_ORIGINS` and `PASSPORT_BASE_URL` in the Render
dashboard, then run `python -m app.seed` once against Atlas (locally with the Atlas URI) or call `POST /api/demo/reset`.
Keep exactly one instance: the machine simulator and WebSocket connections live inside the process.

## Run with Docker

**Prerequisites:** Docker Desktop (or Docker Engine with Compose v2.24+). Nothing else: no Node, Python or MongoDB needed.

```bash
docker compose up --build
```

That starts MongoDB, loads the demo data (only if the database is empty), then the backend and the frontend. No `.env` file is needed.

| What | URL |
|---|---|
| App | http://localhost:5173 |
| API / docs | http://localhost:8000 · http://localhost:8000/docs |
| MongoDB (Compass) | `mongodb://localhost:27017` |
| Public pages | http://localhost:5173/passport/RL10092 · http://localhost:5173/track/ORD104 |

Stop with `docker compose down` (data stays in the `mongo-data` volume; `down -v` deletes it).

### Machine data: two modes
- **Simulator mode (default).** The built-in simulator moves the seeded machines, so `/production` and the WebSocket update right after start.
- **Feeder mode.** Shows "real machines send data to LoomSense": `backend/machine_feeder.py` replays `backend/sample_data/machine_readings.json` (30 readings; W04 goes DOWN, W01 finishes ORD104) to `POST /api/machines/{id}/readings`. The simulator must be off, otherwise both would move the same machines:
  ```bash
  SIMULATOR_AUTOSTART=false docker compose --profile feeder up --build
  ```
  (PowerShell: `$env:SIMULATOR_AUTOSTART="false"; docker compose --profile feeder up --build`, or put `SIMULATOR_AUTOSTART=false` in `.env`.) `FEEDER_DELAY_SECONDS` sets the pause between readings.

### Resetting the demo data
- `docker compose run --rm -e FORCE_SEED=true seed` reloads the demo data (the normal start never overwrites data entered by hand).
- Or `curl -X POST http://localhost:8000/api/demo/reset -H "X-Admin-Key: change-me"` (uses `ADMIN_KEY`).

### Phone on the same wifi (passports, buyer tracking)
Use your computer's LAN IP everywhere the browser needs it. In `.env`:
```
VITE_API_URL=http://192.168.1.20:8000
CORS_ORIGINS=http://192.168.1.20:5173
PASSPORT_BASE_URL=http://192.168.1.20:5173
```
then `docker compose up --build` and open `http://192.168.1.20:5173` on the phone (allow ports 5173 and 8000 in the firewall).

### MongoDB Atlas instead of the local database
Set `MONGODB_URI=mongodb+srv://...` in `.env`, then `docker compose -f docker-compose.yml -f docker-compose.atlas.yml up --build`. The local mongo container is not started.

### Troubleshooting
- **Port already in use:** change `FRONTEND_PORT`, `BACKEND_PORT` or `MONGO_PORT` in `.env` (a local MongoDB on 27017 needs `MONGO_PORT=27018`). If you change `BACKEND_PORT`, also change `VITE_API_URL`, `CORS_ORIGINS` and `PASSPORT_BASE_URL` to match.
- **CORS error in the browser console:** the address in the address bar must be listed in `CORS_ORIGINS` (scheme, host and port).
- **Frontend still calls the old API address:** `VITE_API_URL` is baked in at build time. Run `docker compose up --build` (or `docker compose build frontend`) after changing it.
- **Do not scale the backend:** the simulator and WebSockets live inside the process; run exactly one instance.

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

## Known limitations

- **No authentication.** Only `POST /api/demo/reset` is protected (by `ADMIN_KEY`). Every other endpoint, including internal finance data, is open; CORS is the only barrier. Add auth before real use.
- **One instance only.** The simulator and WebSocket connections are in-process. Scaling out would duplicate the simulator. On a free Render plan the service sleeps when idle, which also pauses the simulator.
- **Not tested on Atlas or Render.** Everything was run against a local MongoDB. The dashboard answers in about 40 ms locally using about 9 queries; on Atlas, latency per query will dominate (expect well under a second, but this is not measured).
- **Simulated factory.** Machine data is generated, not read from hardware. One real second counts as one factory minute, and orders sharing two machines (ORD108) split their metres between them.
- **Provisional margins.** An order still in production compares full revenue with partial cost, so its margin looks high (`provisional: true`). Monthly totals count revenue pro-rata instead.
- **Seed economics.** With 0.59 kg of yarn per metre at ₹180/kg, the seeded revenues had to be raised (ORD104 is ₹356,000) to give sensible margins. The rework material loss uses the full yarn value, so 120 m costs ₹14,532, not about ₹4,180; set `REWORK_MATERIAL_LOSS_SHARE` (about 0.19) in `config.py` to match the context example.
- **Dates.** The dashboard and monthly trend use the server's current month, and the seed dates run July to October 2026, so they look empty from about February 2027 unless the seed dates are moved.
- **Simple data model.** No delete endpoints, no pagination, order status is free text, and stored order costs only refresh when the API changes something (reads always recompute, but a hand-edited database can leave stored values stale).
- **Demo reset wipes everything**, including any data created through the API.

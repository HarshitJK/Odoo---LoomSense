# Updated LoomSense implementation

The current implementation preserves FastAPI, PyMongo/MongoDB, React/Vite/Tailwind,
the Python machine simulator, WebSockets, passports, QC, attendance and leakage analysis.
The following describes the current contract and supersedes older unauthenticated demo examples below.

## Run locally (PowerShell)

From the repository root:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
# Set JWT_SECRET (32+ random characters) and all three SEED_*_PASSWORD values (12+ characters).
# Keep the existing .env instead if already configured; add the four new settings to it.
docker compose up --build
```

Open http://localhost:5173/login. Accounts: `owner@loomsense.demo`,
`manager@loomsense.demo`, `qc@loomsense.demo`; passwords are the values you configured.
Docker seeds only an empty database. For existing data it runs a non-destructive token/user migration.
Do not use FORCE_SEED on data you want to preserve.

Without Docker, with MongoDB already running:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt -r requirements-dev.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
# Set MONGODB_URI, JWT_SECRET and all SEED_*_PASSWORD values.
python -m app.migrate
# For a NEW disposable demo database only (this replaces demo collections):
python -m app.seed
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Verification:

```powershell
cd backend
python -m pytest -q
cd ../frontend
npm test
npm run build
```

Tests use an isolated mongomock database and real JWT authentication. No test connects to your
configured MongoDB. The in-memory tests do not prove replica-set transaction or deployment behavior.

## Judge walkthrough

1. Log in as owner; open Orders, create an order, run readiness, review yarn shortage and projected costs/margin, then accept.
2. Receive yarn from Inventory / Add Purchase; choose a new batch if its price or supplier differs.
3. Open order details, reserve matching yarn, assign an idle machine, and open Production to watch live output.
4. Record attendance in Workers; record QC in Quality; open the fabric passport/QR.
5. In Orders, open the secure buyer tracking link and record a dated buyer payment.
6. Open the owner dashboard / MONTH-END / CLOSE BOOKS; compare September and October 2026.
7. Review bills, regular/overtime wages, output by machine, lifetime order profitability and leakage.

Demo data has six orders, five buyers, six machines, ten workers, five yarn batches,
163 attendance entries, seven QC records, purchases, production history, payments,
partial/unpaid orders and high/low-margin examples. ORD091 starts in September and has
October production, wages and rework; tests additionally record its October buyer payment.

## Accounting and access

Monthly books use activity dates: buyer transaction date, attendance date, purchase date,
production event timestamp, QC date and operating expense date. Never use orderDate to assign
a whole order to a month. Production history captures runtime, unit costs and efficiency;
attendance captures the wage rate. Historical machine totals never use current machine counters.
Machine records and consumption are aggregated by minute; simulator runtime is accelerated factory time.

`netCashResult` is the requested compatibility field for buyer cash received minus incurred bills,
wages and operating/rework cost estimates. This is a management balance, not bank cash flow or
statutory accrual profit. Supplier cash paid is separately dated as `supplierPaymentsMade`.
Production value is an estimate, not additional cash or recognized revenue. Rework estimates
must not also be entered as ordinary wages/expenses for the same activity.
Lifetime order cost uses consumed material + attributed labour + recorded machine cost + rework + other.
Purchases do not add to order costs. In-progress order margins are provisional.

Owner: all internal access. Manager: orders/readiness, inventory, machines, operational QC;
projected acceptance economics are explicitly allowed, actual order costs/profit and owner finance are not.
Worker/QC: quality entry, safe order/machine/batch picklists and passports. Payroll/attendance administration
is owner-only; worker self-attendance is not exposed. Sidebar and backend checks enforce these roles.
JWTs expire after eight hours; passwords use salted scrypt. Serve over HTTPS outside local development.
WebSockets require an initial JSON message `{ "token": "<JWT>" }` before any snapshot.
Public tracking accepts only random order trackingToken values, never predictable order IDs.

## Deployment / limitations

Set JWT_SECRET in Render (blueprint generates it); run `python -m app.migrate` with the configurable
seed passwords once to create users on an existing database. Keep one API process/instance: simulator,
WebSocket connections and operational locks are process-local. Feeder requires FEEDER_TOKEN from manager login. API smoke/demo scripts accept LOOMSENSE_TOKEN or log in with SEED_OWNER_PASSWORD; ws_check.py requires LOOMSENSE_TOKEN.
Machine control reset restores health without rewinding financial history. Full demo reset remains owner + admin-key protected.
Legacy orders keep their costing fallback; missing historical machine output is not invented. Re-seed only a disposable demo
or import verified historical activity for complete older month reports. Dates of machine activity are UTC minute buckets.
The current machine source is a Python simulator; future PLC/IoT sources may use MQTT, OPC-UA or Modbus.
There is no tax/GST ledger, bank reconciliation, payroll disbursement ledger, month locking, or production-grade login throttling.
Cross-collection operational writes currently require the single-process deployment and are not fully transactional across process crashes.

---

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
| `TRACKING_BASE_URL` | backend | defaults to `PASSPORT_BASE_URL` (buyer tracking links `/track/<token>` point here) |
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
| Public pages | http://localhost:5173/passport/RL10092 · the buyer link shown on the Orders page (`/track/<token>`; the seed prints the ORD104 link) |

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

## Scanning QR codes

Open **Scan QR** in the sidebar (or the "Scan a roll QR" button on the Quality page), or go to `/scan`. It reads the QR code on a Fabric Passport (or an order tracking link) and opens that page.

- **Camera:** tap *Start camera*. Browsers only allow the live camera on **HTTPS or `localhost`**. On plain HTTP over a LAN address (for example `http://192.168.1.20:5173` on a phone) the camera button is disabled; use one of the two fallbacks below, or serve the app over HTTPS.
- **Scan from image:** pick a photo or screenshot that contains the QR code. This works on any address.
- **Type or paste:** enter a roll id (`RL10092` or `RL-10092`), an order id (`ORD104`), or a full passport or tracking link.

Only the path of a scanned link is used, so a QR printed with `localhost` or a LAN IP still opens the app on the address you are on now. Unknown codes never navigate, and a roll that does not exist shows "Roll … not found". The QR on the passport page uses error correction level M with a quiet margin. Set `PASSPORT_BASE_URL` (backend) to the address people will actually use, because that is what the printed QR image from `GET /api/passport/{rollId}/qr` contains. Unit tests for the link parser: `npm test` in `frontend/`.

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

- **Single process only.** The simulator and WebSocket connections are in-process. Scaling out would duplicate the simulator. On a free Render plan the service sleeps when idle, which also pauses the simulator.
- **Workers do not have their own logins.** Worker attendance is entered by the owner or production manager; there is no worker self-service portal.
- **No GST or bank reconciliation.** The system tracks rupee costs and profit using a management-accounting estimate. GST ledger, bank disbursement ledger and statutory revenue recognition are not implemented.
- **Simulated machine data.** Production metres come from a Python simulator (1 real second = 1 factory minute). In production, replace with real PLC / IoT readings via `POST /api/machines/{id}/readings` (same endpoint).
- **Provisional margins.** An order still in production compares full revenue with partial cost, so its margin looks high (`provisional: true`). Monthly totals count earned revenue pro-rata to production progress.
- **Dates.** The dashboard and monthly trend use the server's current month, and the seed dates run July–October 2026. From about February 2027 the seeded months will be out of the 4-month window; move the seed dates to keep them visible.
- **Not tested on Atlas or Render.** Everything was developed against a local MongoDB. The dashboard answers in about 40 ms locally (about 9 queries); on Atlas, latency per query dominates.
- **Demo reset wipes everything**, including any orders or quality records created during the demo. Use `POST /api/demo/reset` (with `X-Admin-Key`) between runs.

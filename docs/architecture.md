# Architecture

One React app, one FastAPI service, one MongoDB database.

```
React (Vite)  ──REST /api/*──────────────┐
   │                                     ▼
   └────WebSocket /ws/machines───►  FastAPI (single process)  ──PyMongo──►  MongoDB
                                         ▲   │
                         asyncio task    │   └─ services/ (costing, profitability, readiness, tracking, QR)
                         machine simulator ┘
```

## Data flow of one order

```
Order created ─► readiness check (stock vs 0.59 kg/m, projected cost and margin)
      │
      ▼
Machine assigned ─► Simulator tick (every 3 s) ─► machine + order producedMeters ─► order costs recomputed
      │                                                         │
      │                                                         └─► WebSocket machine_update ─► Production dashboard
      ▼
Workers log hours ─► attendance ─► labour cost of the order (overtime x 1.5) ─┐
Quality roll (REWORK, affectedMeters) ─► rework cost impact ─────────────────┤
Buyer payment ─► paidAmount / pending                                         ▼
                                                      costing → profitability → finance dashboard + profit leakage
Order status + producedMeters ─► tracking ─► public buyer page;   roll ─► public passport + QR
```

Every write that changes an order's inputs (order edit, attendance, quality roll, machine assignment, simulator tick,
payment) calls `profitability.refresh_order`, which stores `costs`, `profit`, `margin` and `paidAmount` on the order.
Read endpoints recompute from the raw records, so they are always right even if a stored value is stale.

## Backend layout (`backend/app`)
- `routes/` thin handlers: validate input, call a service, return JSON. `main.py` wires routers, CORS, error handlers
  (all errors are `{"detail": ...}`) and the simulator task (lifespan).
- `services/` business logic. `costing.load_data()` loads the 7 collections once so a dashboard request costs about
  9 database queries however many orders exist.
- `models/` Pydantic schemas and request bodies, `database.py` the single MongoClient, `seed.py` demo data, `config.py` env settings.
- `websocket/machines.py` connection manager: one slow or broken client never blocks the others.
- Public endpoints (`/api/passport/*`, `/api/buyer/track/*`) build their answers from allow-listed fields only, and a test fails
  if any cost, revenue, profit, margin, wage, supplier or alert key ever appears.

## Machine simulator
Runs inside the API process (no separate worker), so deployment is one service. `productionRate` is metres per hour; one real second
counts as one factory minute, so a 112 m/h machine adds about 5.6 m per tick. When an order reaches its quantity it moves to
`QUALITY_CHECK`, its machines go `IDLE`, and an `order_completed` event is broadcast. Controls (`POST /api/machines/simulate`):
start, stop, reset, failure, and a speed multiplier. It can later be replaced by real PLC / IoT telemetry that updates the same
`machines` collection.

## Deployment
`uvicorn app.main:app --host 0.0.0.0 --port $PORT` (see `backend/Procfile` and `render.yaml`) with MongoDB Atlas.
Run **one** instance only: the simulator and WebSocket connections live in the process memory.
Required variables: `MONGODB_URI`; useful: `DB_NAME`, `CORS_ORIGINS`, `PASSPORT_BASE_URL`, `ADMIN_KEY`, `SIMULATOR_AUTOSTART`.

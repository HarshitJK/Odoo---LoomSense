# Current architecture additions

Buyer Order → Readiness Check → Raw Material Reservation → Production → Machine + Labour Cost Attribution
→ QC / Rework → Fabric Passport → Dispatch → Buyer Tracking → Buyer Payment → True Order Cost
→ Month-End Closing → Profit / Leakage Analysis.

The six feature areas remain profitability, raw material/readiness, live production, passports/quality,
attendance/wages and buyer tracking. The API remains Python FastAPI/PyMongo; browser remains React/Vite/Tailwind.
The existing simulator emits live WebSocket state plus minute-aggregated durable production records.

New collections: counters (atomic readable ID sequences), users (scrypt password hashes, roles), materialPurchases (bills plus dated payment entries),
machineProductionEvents (dated meters/runtime/cost), materialConsumption (dated consumed kg/unit cost),
materialReservations (stock held per order/batch), operatingExpenses (dated costs).
Existing orders gain trackingToken, timestamps and history-completeness flags. Attendance captures hourlyRate.
History flags distinguish verified new/seeded history from unknown older activity; migration never reconstructs
past production from today's mutable machine state. Supplier bills never become order consumption costs.

Authentication is implemented in services/auth.py and route dependencies. The manager may view projected
acceptance economics but cannot access owner financial dashboards or actual order profits. QC uses safe
picklists and stripped financial responses. Public passport/tracking response allowlists are preserved.
WebSocket clients authenticate before receiving a snapshot. Run a single API instance.

The month_end service groups actual dated records, not orderDate. The books show buyer cash less incurred
costs and separately dated supplier cash paid. Lifetime order margins and provisional work-in-progress values
are labelled separately. This is management accounting rather than a full statutory/cash ledger.

Telemetry currently comes from the Python simulator; replace its input later with PLC/IoT readings via MQTT,
OPC-UA or Modbus. Real industrial integration, bank reconciliation, transactional crash recovery and historical
imports remain outside this hackathon implementation.

---

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


## Dashboard accrual basis

The dashboard and monthly trend share profitability.monthly_summary. Earned revenue is
sum(order revenue / ordered metres * dated producedMetersDelta). Material cost is dated
materialConsumption.cost, never supplier bills. Labour, machine runtime, quality loss and
operating expenses are incurred in the selected month, using the month-end service's date rules.
All orders with activity are included, including cost-only activity and unassigned factory overhead;
we do not discard costs just because an order earns no revenue that month. Cash-only orders do not
contribute earned revenue. Net profit = earned revenue - these costs; margin = profit / revenue,
or zero when revenue is zero. Missing legacy production history is not reconstructed.
This is a production-value management estimate, not statutory revenue recognition. Repeated output
on restart is currently measured as production; a full returns/reversal ledger is outside scope.

GET /api/finance/month-end remains buyer cash less purchased-material bills and incurred operating
costs, with supplier cash separate. Lifetime order profit remains full contract revenue less lifetime
costs and is provisional while production is incomplete. Cash received from buyers is the selected
month's buyerPayments; Still to collect is paymentsPending across all orders. The redundant lifetime
paymentsReceived dashboard field was removed. No buyer-payment rebalance is needed: seeded accrual
months all exceed -20%; regression tests verify this independently of payment timing.

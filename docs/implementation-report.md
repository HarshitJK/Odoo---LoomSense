# Implementation handoff

## Features and fixes

- Functional Orders page: creation after readiness review, expected margin, details, stage updates, material reservation, machine assignment, secure tracking links, dated buyer payments and owner true-cost detail.
- Supplier purchase bills with inventory receipt, calculated totals/status, duplicate-invoice protection and separately dated later payments.
- Month-end books based on transaction/work/purchase/production/QC/expense dates; lifetime order profit kept separate. A September order with October activity is covered by regression tests.
- Durable minute production history and consumption; recorded machine costs and wage rates survive later rate or assignment changes. Stock reservations do not count as consumption.
- JWT login, salted scrypt hashes, owner/manager/QC dependencies, protected frontend routes, hidden role-inappropriate navigation, authenticated WebSockets and filtered QC responses.
- Secure random tracking tokens replace public order-ID credentials; QR scanning preserves token case and punctuation.
- Expanded multi-month seed, non-destructive migration for existing installations, atomic readable ID counters, updated Docker/Render configuration and authenticated helper scripts.

## API changes

Added POST /api/auth/login, GET /api/auth/me; GET/POST /api/purchases;
GET/PATCH /api/purchases/{purchase_id}; GET /api/purchases/monthly;
GET /api/finance/month-end; POST /api/finance/expenses;
GET /api/machines/monthly-summary; POST /api/orders/{order_id}/reserve;
GET /api/quality/options. Buyer tracking now takes tracking_token. Internal routes and
WebSocket snapshots now require authentication. Finance dashboard/monthly preserve their
response structure while using activity dates. See api.md for role and field contracts.

## Database

Added users, materialPurchases, machineProductionEvents, materialConsumption,
materialReservations, operatingExpenses, counters. Orders add trackingToken, timestamps,
and history-completeness flags. Attendance adds historical hourlyRate; inventory adds
reservedKg and receipt IDs. Existing financial/public response conventions are preserved
except the intentional public tracking credential change.

## Verification

- Backend: 66 tests passed, including all prior suites with the intentional auth/tracking changes,
  cross-month accounting, supplier bills vs consumed cost, historical rates, JWT expiry,
  public field filtering, authorization, reservations and WebSocket access.
- Frontend: 11 tests passed; production Vite build passed. Existing large-bundle warning remains.
- Both backend and frontend Docker images built; the final backend image imported and generated OpenAPI in a network-isolated container. Local-MongoDB and Atlas Compose configurations validated.
- Python compilation, FastAPI OpenAPI route checks, seed fixtures and git diff whitespace checks passed.
- Tests use mongomock; no working database was reseeded. Interactive browser walkthrough and
  live Atlas integration were not performed.

## Remaining limitations

- Month-end netCashResult is buyer receipts less incurred costs, not a bank statement or statutory
  profit. Supplier disbursements are separately dated; wages/machine/rework are accrued estimates.
- Unknown pre-migration machine history is not reconstructed. Legacy order costing retains its fallback.
- Single API process is required. Cross-collection writes are not fully atomic over a process crash;
  high-availability deployment needs MongoDB transactions/reconciliation.
- No GST/tax, bank reconciliation, payroll payment ledger, production-grade rate limiting, or locked months.
- Worker/QC has quality/picklist/passport access; attendance/payroll administration remains owner-only.
- Seed dates intentionally span July–October 2026. Full seed/reset is only for disposable demo data.

## Local startup

See the first section of ../README.md for exact PowerShell commands for Docker and separate
Python/Vite terminals. Configure JWT_SECRET (32+ characters) and the three SEED_*_PASSWORD
values (12+ characters). Run python -m app.migrate on existing data; run python -m app.seed
only for a disposable demo database. Open http://localhost:5173/login.

## Files changed

- `.env.example`
- `README.md`
- `backend/.env.example`
- `backend/app/main.py`
- `backend/app/migrate.py`
- `backend/app/models/attendance.py`
- `backend/app/models/machine.py`
- `backend/app/models/order.py`
- `backend/app/models/purchase.py`
- `backend/app/models/transaction.py`
- `backend/app/routes/auth.py`
- `backend/app/routes/buyers.py`
- `backend/app/routes/finance.py`
- `backend/app/routes/machines.py`
- `backend/app/routes/orders.py`
- `backend/app/routes/purchases.py`
- `backend/app/routes/quality.py`
- `backend/app/routes/workers.py`
- `backend/app/seed.py`
- `backend/app/services/auth.py`
- `backend/app/services/costing.py`
- `backend/app/services/machine_simulator.py`
- `backend/app/services/materials.py`
- `backend/app/services/month_end.py`
- `backend/app/services/order_readiness.py`
- `backend/app/services/production_history.py`
- `backend/app/services/profitability.py`
- `backend/app/services/purchases.py`
- `backend/app/utils/ids.py`
- `backend/app/websocket/machines.py`
- `backend/demo_flow.py`
- `backend/docker_seed.py`
- `backend/machine_feeder.py`
- `backend/requirements-dev.txt`
- `backend/requirements.txt`
- `backend/smoke_test.py`
- `backend/tests/conftest.py`
- `backend/tests/test_hardening.py`
- `backend/tests/test_month_end_auth.py`
- `backend/tests/test_phase5.py`
- `backend/tests/test_simulator.py`
- `backend/ws_check.py`
- `context.md`
- `docker-compose.yml`
- `docs/api.md`
- `docs/architecture.md`
- `frontend/src/App.jsx`
- `frontend/src/api/client.js`
- `frontend/src/components/MonthEndBooks.jsx`
- `frontend/src/components/ProtectedRoute.jsx`
- `frontend/src/components/PurchaseRegister.jsx`
- `frontend/src/components/buyer/TrackSearchCard.jsx`
- `frontend/src/components/layout/Navbar.jsx`
- `frontend/src/components/layout/Sidebar.jsx`
- `frontend/src/components/orders/ReadinessResult.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/hooks/useMachineSocket.js`
- `frontend/src/pages/BuyerTrackingPage.jsx`
- `frontend/src/pages/InventoryPage.jsx`
- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/pages/OrdersPage.jsx`
- `frontend/src/pages/OwnerDashboard.jsx`
- `frontend/src/pages/QualityPage.jsx`
- `frontend/src/utils/parseScan.js`
- `frontend/src/utils/parseScan.test.js`
- `render.yaml`
- `docs/implementation-report.md`

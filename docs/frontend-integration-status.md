# Frontend integration status

Every page now reads the live API. Each page was loaded in a headless browser against a seeded backend
(`python -m app.seed`, API on :8000, `npm run dev` on :5173), and the numbers on screen were compared with the endpoint output.
Endpoint details are in [api.md](api.md).

## How data loading works
- `src/hooks/useApi.js` returns `{ data, loading, error, reload }` for a GET endpoint. Pages use it instead of calling axios themselves.
- If a call fails, the page shows `ApiErrorBanner` (endpoint, HTTP status or message, and a **Retry** button) and an empty state. It never falls back to mock data.
- Mock data in `src/mocks/` is used **only** when `VITE_USE_MOCKS=true` (see `frontend/.env.example`, default `false`). Pages then show a "Using mock data" badge and make no API calls (except actions such as the readiness check, quality form and attendance form, which always call the API).

## Pages

| Page / route | Data source | Endpoints |
|---|---|---|
| `/` OwnerDashboard | **Live API** | `GET /api/finance/dashboard` (KPIs, cost breakdown, most / least profitable), `GET /api/finance/monthly` (chart and trend arrows), `GET /api/finance/profit-leakage` (leakage panel), `GET /api/orders` (profit table) |
| `/orders` OrdersPage | **Placeholder heading only** (no data, no mock) | Not built yet: needs `GET /api/orders` and `GET /api/orders/{id}/readiness` |
| `/inventory` InventoryPage | **Live API** | `GET /api/inventory` (uses the server's `lowStock` flag) |
| Readiness checker (on `/inventory`) | **Live API** | `POST /api/orders/readiness-check`; shows server validation errors |
| `/production` ProductionPage | **Live API + WebSocket** | `GET /api/machines` for the first paint, then `WS /ws/machines` (`snapshot`, `machine_update`, `event`). Costs use the server's `orderMachineCost`, `costPerMeter` and `runtimeToday`. Shows Live / Reconnecting and the latest event |
| `/workers` WorkersPage | **Live API** | `GET /api/workers` (monthly hours and wages), `GET /api/workers/wages/summary` (cards and labour cost per order), `GET /api/finance/profit-leakage` (insight banner), `GET /api/orders` and `GET /api/machines` (form options), `POST /api/attendance`; refetches after logging hours |
| `/quality` QualityPage | **Live API** | `GET /api/quality`, `GET /api/orders`, `GET /api/inventory`, `GET /api/machines` (dropdowns), `POST /api/quality` (shows the server's `impact`, `marginBefore` → `marginAfter`) |
| `/passport/:rollId` FabricPassportPage | **Live API (public)** | `GET /api/passport/{rollId}`; shows passport fields only. 404 shows "Roll Not Found" |
| `/track`, `/track/:orderId` BuyerTrackingPage | **Live API (public)** | `GET /api/buyer/track/{orderId}`; accepts `ORD104` and `ORD-104`; 404 shows "Tracking ID Not Found" |

## Still not on the API, and why
- **`/orders`** is only a heading. Nobody built the page; the data is available from the API.
- **Defect names** in the quality form (`Weft break`, `Hole`, ...) are a fixed list in `QualityForm.jsx`; the API stores free text and has no endpoint for defect types.
- **Order profit table** (`OrderProfitTable.jsx`) still adds up the cost lines itself (`trueOrderCost`) from `GET /api/orders`. The dashboard endpoint's `orders[]` has `totalCost` if it should be switched.
- **"Total Metres Today"** on the production page sums each machine's `producedMeters`, which is the order total so far, not today's output.
- **Mock files** (`src/mocks/*.js`) remain for `VITE_USE_MOCKS=true` only. In that mode the Workers page shows ₹0 wages (the old mock has no month totals).
- **`src/utils/calculations.js`** is still used for machine progress in mock mode and for the profit table.

## Notes
- `api/quality.js` no longer has `fetchRollById`: the passport page uses the public endpoint (`api/passport.js`) so no cost fields reach it.
- `GET /api/workers` gained `hoursThisMonth`, `overtimeThisMonth`, `wageThisMonth` (and an optional `?month=YYYY-MM`) for the Workers page.
- Duplicate components (`StatusBadge`, `ProgressBar`, `KpiCard`) in `buyer/`, `quality/`, `workers/` were left as they are.
- The production bundle is about 760 kB; routes can be lazy-loaded later.

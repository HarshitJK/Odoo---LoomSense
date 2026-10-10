# Frontend integration status

State after merging `sabeetha` and `monica` into `main`, checked by reading the code and by loading every route in a headless
browser against a seeded backend (`python -m app.seed`, API on :8000, `npm run dev` on :5173). "Fallback" means the page
silently switches to mock data (or shows an offline banner) when the API call fails. Endpoints are described in [api.md](api.md).

| Page / route | Data source today | Endpoint it should use |
|---|---|---|
| `/` OwnerDashboard | **Mixed.** The order table reads `GET /api/orders` (fallback: `mocks/orders.js`). The KPI cards, revenue/cost chart, cost-breakdown chart and the profit-leakage panel come from `mocks/finance.js` (October shows ₹5,40,000 revenue, which is not in the database). | `GET /api/finance/dashboard` (`kpis`, `costBreakdown`, `mostProfitableOrder`, `leastProfitableOrder`, `orders`), `GET /api/finance/monthly` for the chart, `GET /api/finance/profit-leakage` for the panel. The dashboard `orders[]` also has `profit`, `margin`, `provisional`, `pendingAmount`, so the separate `/api/orders` call can go. |
| `/orders` OrdersPage | Placeholder heading only. | `GET /api/orders`, plus `GET /api/orders/{id}/readiness` per row. |
| `/inventory` InventoryPage | **API** `GET /api/inventory` (fallback: mock). It computes low stock itself. | Same endpoint; use the server's `lowStock` flag. |
| Order readiness checker (on `/inventory`) | **Local calculation** over the inventory list, with its own guessed projections. | `POST /api/orders/readiness-check` with `{quantityMeters, colour, fabricType, expectedRevenue}`; it returns `requiredYarnKg`, `shortageKg`, `status`, projected costs and `projectedMargin`/`warning`. |
| `/production` ProductionPage | **API** `GET /api/machines` once (fallback: mock), then a local fake timer adds metres every 3 s. The WebSocket hook is not used. The card shows "Order cost so far ₹0" and "₹0.00 / metre" because it computes cost as `costPerHour × runtimeHours` and the API field is `runtimeToday`. | `WS /ws/machines` through `hooks/useMachineSocket.js` (`snapshot`, `machine_update`, `event` messages; the hook currently keeps only the last message and assumes the old demo payload). Use the API's `orderMachineCost`, `costPerMeter`, `runtimeToday`, `estimatedCompletion`, `progress` instead of recomputing. Demo controls: `POST /api/machines/simulate`. |
| `/workers` WorkersPage | **API** `GET /api/workers` (fallback: mock) for names, shifts and rates. Hours are set to 0, so every wage figure shows ₹0. Labour-cost-per-order cards and the insight banner use mock data. `POST /api/attendance` is wired for the form. | `GET /api/workers/wages/summary?month=YYYY-MM` for regular wages, overtime pay, total and `labourCostPerOrder[]`. Keep `GET /api/workers` for the list. |
| `/quality` QualityPage | **API** `GET /api/quality` and `POST /api/quality` (fallback: mock). The form's order, machine and yarn-batch dropdowns are mock lists (`ORD098`, `YB79`, `YB88` do not exist in the database). The form never sends `affectedMeters`, so the server cannot calculate the cost impact, and `DefectCostImpact` computes its own number. | Dropdowns from `GET /api/orders`, `GET /api/machines`, `GET /api/inventory`. Send `affectedMeters` and show the response's `impact`, `marginBefore` and `marginAfter`. |
| `/passport/:rollId` FabricPassportPage | **API** `GET /api/quality/{rollId}` (fallback: mock). This is the internal endpoint: it returns `reworkCost` and `impact`, and the page shows the production time as midnight because it reads `date`. | `GET /api/passport/{rollId}`: public, no cost fields, has `producedAt`, `qualityStatus`, `reworkStatus` and `buyerName`. The QR code can also come from `GET /api/passport/{rollId}/qr` (or be generated client-side with `qrcode.react`, as now). |
| `/track`, `/track/:orderId` BuyerTrackingPage | **Mock only** (`mocks/buyerTracking.js`; shows ORD104 at 78% while the database says 73%). The sample links ORD098 / ORD091 are also mock ids. | `GET /api/buyer/track/{orderId}` (accepts `ORD104` or `ORD-104`; 404 `detail` is a friendly message). It returns `progress`, `currentStage`, `stages[]` (`DONE` / `IN_PROGRESS` / `PENDING`), `expectedCompletion`, `qualityStatus`, `dispatchStatus`. |

## Notes for whoever wires this up
- **Machine objects:** every field the production page needs is already in the API response. See "Machine object" in [api.md](api.md).
- **IDs:** the backend uses `ORD104`, `RL10092`; display them with a hyphen in the UI if wanted.
- **Money:** the API sends plain INR numbers; format them with `utils/formatCurrency.js`.
- **Errors:** API errors are `{"detail": "text"}`; show `detail` directly.
- **Offline fallback:** pages that silently fall back to mock data make a broken integration look fine. Prefer an error banner.
- **Duplicate components:** `StatusBadge`, `ProgressBar` and `KpiCard` exist in more than one folder (`buyer/`, `quality/`, `workers/`). They were left as they are.
- **Bundle:** the build prints a chunk-size warning (about 760 kB); routes can be lazy-loaded later.

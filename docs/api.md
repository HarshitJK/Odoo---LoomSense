# LoomSense API

Base URL `http://localhost:8000` · interactive docs at `/docs` · full example responses in [api-examples.md](api-examples.md).

**Conventions.** JSON is camelCase. IDs have no hyphens (`ORD104`, `RL10092`, `YB82`, `W01`); lookups of orders and rolls
also accept `ORD-104` / `ord-104`. Money is INR, percentages have 1 decimal. No response contains `_id`.
Errors are always `{"detail": "message"}`: 404 not found, 409 already exists / not allowed, 422 invalid body or query
(`detail` is readable text, `errors` holds the raw list), 403 bad admin key, 503 MongoDB down, 500 unexpected.

## Orders, machines, inventory, workers
| Method | Path | Notes |
|---|---|---|
| GET | `/api/orders?status=` | List. Each order has `costs`, `profit`, `margin`, `paidAmount` (kept in sync by the server) |
| GET / PATCH | `/api/orders/{id}` | PATCH any of `status, producedMeters, revenue, machineId, deadline, yarnBatch, yarnConsumedKg, otherCost...` |
| POST | `/api/orders` | `{buyerName, quantityMeters>0, fabricType, colour, revenue}` → id generated, status `NEW` |
| GET | `/api/orders/{id}/cost` | Live `costs{rawMaterial,labour,machine,rework,other}`, `totalCost`, `labourHours`, `workerCount` |
| GET | `/api/orders/{id}/readiness` | Material check + projected margin of an existing order |
| POST | `/api/orders/readiness-check` | Same for a new order: `{quantityMeters, colour, fabricType, expectedRevenue}` |
| GET | `/api/machines`, `/api/machines/{id}` | Live machine object (below) |
| PATCH | `/api/machines/{id}` | `status` (`RUNNING`/`IDLE`/`DOWN`), `currentOrderId`, `productionRate` |
| POST | `/api/machines/{id}/readings` | A machine reports `{temperature, productionRate, efficiency, producedMetersDelta, status?, timestamp?}`. Updates the machine and its order's `producedMeters` (finishing the order moves it to `QUALITY_CHECK`), recomputes costs and broadcasts the usual `machine_update` over the WebSocket. 404 unknown machine, 422 bad values. Used by `backend/machine_feeder.py` |
| POST | `/api/machines/simulate` | `{action: start\|stop\|reset\|failure, machineId?, speed?}` (speed 0–100) |
| GET / POST | `/api/inventory` | Items carry `lowStock` (under 300 kg). POST needs `batchId` |
| PATCH | `/api/inventory/{batchId}` | `material, colour, quantityKg, costPerKg, supplier` |
| GET / POST | `/api/workers?month=2026-10` | GET adds `latestAssignment` and this month's `hoursThisMonth`, `overtimeThisMonth`, `wageThisMonth` (hours × rate + overtime × rate × 1.5; month defaults to current). POST needs `workerId`, `name` |
| POST | `/api/attendance` | `{workerId, orderId, machineId, hoursWorked, overtimeHours, date?}`; updates the order's labour cost |
| GET | `/api/workers/wages/summary?month=2026-10` | Regular wages, overtime pay, total, `labourCostPerOrder[]` |

Readiness response: `requiredYarnKg, availableKg, shortageKg, status` (`MATERIAL_READY` / `CANNOT_START_FULL_PRODUCTION`),
`projectedMaterialCost, projectedLabourCost, projectedMachineCost, projectedCost, projectedProfit, projectedMargin, warning`.

Machine object (REST and WebSocket): `machineId, name, status, currentOrderId, producedMeters, targetMeters, progress,
productionRate, efficiency, temperature, costPerHour, costPerMeter, orderMachineCost, estimatedCompletion, runtimeToday`.
`productionRate` is 0 unless `RUNNING`. A machine that finished its order goes `IDLE` but keeps `currentOrderId`.

## Quality, passport, buyer, payments
| Method | Path | Notes |
|---|---|---|
| GET | `/api/quality`, `/api/quality/{rollId}` | Internal view incl. `reworkCost` and `impact`; list is newest first |
| POST | `/api/quality` | `{orderId, machineId, yarnBatch, shift, status, defects[], affectedMeters, reworkStatus}`; `rollId` generated |
| GET | `/api/passport/{rollId}` | **Public.** `rollId, orderId, buyerName, yarnBatch, machineId, shift, producedAt, qualityStatus, defects, reworkStatus` |
| GET | `/api/passport/{rollId}/qr` | **Public.** PNG QR pointing to `{PASSPORT_BASE_URL}/passport/{rollId}` |
| GET | `/api/buyer/track/{orderId}` | **Public, buyer-safe.** `orderId, buyerName, fabricType, colour, quantityMeters, progress, currentStage, stages[], expectedCompletion, qualityStatus, dispatchStatus` |
| POST | `/api/transactions` | `{orderId, amount, type?: BUYER_PAYMENT, date?}`; a buyer payment raises the order's `paidAmount` |

`status` is `PASSED`/`FAILED`/`REWORK`/`PENDING`. For `FAILED`/`REWORK` with `affectedMeters`, the response adds
`impact{additionalLabour, machineCost, materialLoss, total}`, `marginBefore`, `marginAfter`; the total becomes the roll's
`reworkCost` and flows into the order cost. `stages[]` is six `{name, state: DONE|IN_PROGRESS|PENDING}` (Weaving also has `progress`).
`qualityStatus` for buyers is `NOT_STARTED`, `PENDING`, `PASSED` or `IN_REVIEW`.

## Finance
| Method | Path | Notes |
|---|---|---|
| GET | `/api/finance/dashboard?month=2026-10` | `kpis`, `costBreakdown`, `mostProfitableOrder`, `leastProfitableOrder`, `orders[]` |
| GET | `/api/finance/monthly` | Last 4 months: `month, label, revenue, cost, profit, margin` |
| GET | `/api/finance/orders/{id}` | `revenue, costs, totalCost, profit, margin, belowTarget, paidAmount, pendingAmount, provisional` |
| GET | `/api/finance/profit-leakage?order_id=` | `expectedMargin, actualMargin, leaks[{label, amount}], recommendation`; default = lowest-margin finished order |

Formulas: true cost = raw material + labour + machine + rework + other; profit = revenue − cost; margin = profit ÷ revenue × 100.
Labour = hours × rate + overtime × rate × 1.5. Machine = metres ÷ rate × costPerHour. Raw material = 0.59 kg/m × costPerKg.
Target margin 25%, leakage benchmark 28%. An order still in production has `provisional: true` (full revenue vs partial cost);
monthly totals count its revenue pro-rata to progress.

## Demo and system
| Method | Path | Notes |
|---|---|---|
| GET | `/`, `/api/health` | `/api/health` → `{"status":"ok","database":"connected"}` (503 if MongoDB is down) |
| POST | `/api/demo/reset` | Header `X-Admin-Key: <ADMIN_KEY>`. Re-runs the seed. 403 if the key is wrong or `ADMIN_KEY` is unset |

## WebSocket `WS /ws/machines`
Server → client only, JSON. On connect a `snapshot`, then every 3 s a `machine_update` while the simulator runs (nothing while stopped):
`{"type": "machine_update", "timestamp": "...", "simulator": {"running": true, "speed": 1.0}, "machines": [<machine object>, ...]}`.
Events: `{"type": "event", "event": "order_completed" | "machine_failure" | "simulator_started" | "simulator_stopped" | "demo_reset", "machineId", "orderId", "message", "timestamp"}`.
If MongoDB is down on connect, the first message is `{"type": "error", "message": ...}`.

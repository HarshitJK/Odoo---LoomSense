# LoomSense API: example responses

The short reference is [api.md](api.md); this file has full example responses for each endpoint.
Base URL: `http://localhost:8000` · Interactive docs: `/docs`.
JSON uses camelCase. IDs have no hyphens (`ORD104`, `RL10092`, `YB82`, `W01`). Money is in INR.
No response contains MongoDB `_id`. Errors look like `{"detail": "Order NOPE not found"}`:
404 = id not found, 409 = id already exists, 422 = invalid body, 503 = MongoDB down.

## Health
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Pings MongoDB |

```json
{"status": "ok", "database": "connected"}
```

## Orders
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/orders?status=WEAVING` | List orders; `status` filter optional |
| GET | `/api/orders/{order_id}` | One order |
| POST | `/api/orders` | Create order (id generated, status `NEW`). Required: `buyerName`, `quantityMeters` |
| PATCH | `/api/orders/{order_id}` | Update only the fields you send |

Order (also the example for GET one / POST / PATCH response):
```json
{"orderId": "ORD104", "buyerId": "BUY001", "buyerName": "ABC Garments", "fabricType": "Cotton",
 "colour": "Navy Blue", "quantityMeters": 2000.0, "producedMeters": 1460.0, "status": "WEAVING",
 "orderDate": "2026-10-01", "machineId": "W01", "deadline": "2026-10-15T18:00:00", "revenue": 356000.0, "yarnBatch": "YB82", "yarnConsumedKg": null, "otherCost": 4000.0,
 "costs": {"rawMaterial": 155052.0, "labour": 22995.0, "machine": 7821.43, "rework": 0.0, "other": 4000.0},
 "profit": 166131.57, "margin": 46.7}
```
`costs`, `profit` and `margin` are computed by the server (see Costing below) and re-computed whenever an order is created or patched, or when attendance, quality rolls or machine assignments for it change. Optional inputs: `yarnBatch`, `yarnConsumedKg` (default: 0.59 kg per metre produced), `otherCost`.

POST body example: `{"buyerName": "ABC Garments", "fabricType": "Cotton", "colour": "Navy Blue", "quantityMeters": 2000, "revenue": 180000}`
PATCH body example: `{"status": "QUALITY_CHECK", "producedMeters": 2000}`

## Machines

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/machines` | List machines (W01-W06) with live production fields |
| GET | `/api/machines/{machine_id}` | One machine |
| PATCH | `/api/machines/{machine_id}` | Update `status`, `currentOrderId`, `productionRate` (returns the machine object) |
| POST | `/api/machines/simulate` | Demo controls for the machine simulator (see below) |

Machine object (same shape in REST and WebSocket):
```json
{"machineId": "W01", "name": "Weaving Machine 01", "status": "RUNNING", "currentOrderId": "ORD104",
 "producedMeters": 1494.7, "targetMeters": 2000.0, "progress": 74.7, "productionRate": 112.0,
 "efficiency": 0.92, "temperature": 55.4, "costPerHour": 600.0, "costPerMeter": 5.36,
 "orderMachineCost": 8007.16, "estimatedCompletion": "2026-10-10T17:05:23", "runtimeToday": 6.65}
```
- `status` is `RUNNING`, `IDLE` or `DOWN`. `productionRate` (metres per hour) is 0 unless the machine is `RUNNING`.
- `progress` is `producedMeters / targetMeters` in %, capped at 100. `costPerMeter` = `costPerHour / rate` (INR).
- `orderMachineCost` is the machine cost attributed so far to `currentOrderId` (`producedMeters / rate x costPerHour`).
- `estimatedCompletion` is when the order finishes at the current combined rate of its running machines; `null` if the machine is not running.
- `runtimeToday` is in hours. A machine that finished its order goes `IDLE` but keeps `currentOrderId` so its cost stays attributed to that order.
- Two machines (W02, W04) share order ORD108, so their `producedMeters` are shares of the order total.

### Simulator

The simulator is an asyncio task inside the API process. Every 3 seconds each `RUNNING` machine advances by about `productionRate x 3 s / 3600 x 60` metres (2-8 m for the seeded machines; 1 real second counts as 1 factory minute), temperature is jittered between 55 and 70 and efficiency between 0.85 and 0.95. The linked order's `producedMeters` is updated and its machine cost, profit and margin are recomputed. When an order reaches `quantityMeters` it moves to `QUALITY_CHECK`, its machines go `IDLE`, and an `order_completed` event is sent. Set `SIMULATOR_AUTOSTART=false` to start it paused.

`POST /api/machines/simulate`

| Body field | Meaning |
|---|---|
| `action` | `start`, `stop`, `reset` or `failure` (required) |
| `machineId` | Optional. `start`/`stop` without it start/stop the whole simulator; with it, one machine. `failure` without it fails a random running machine |
| `speed` | Optional speed multiplier, greater than 0 and at most 100 (e.g. `20` to finish orders quickly in a demo) |

- `start` with a `machineId` needs an order assigned (409 otherwise). `reset` restores the seeded machines (or one machine) and the produced metres and status of their orders. `failure` sets the machine to `DOWN`.
- Errors: 404 unknown machine, 409 not allowed, 422 invalid body.

```json
{"action": "start", "speed": 20}
```
Response:
```json
{"running": true, "speed": 20.0, "message": "Simulator started"}
```

## WebSocket

`WS /ws/machines` (e.g. `ws://localhost:8000/ws/machines`). Server to client only; anything the client sends is ignored.

1. On connect: a `snapshot` message with all machines.
2. Every 3 seconds while the simulator runs: a `machine_update` message with all machines. When the simulator is stopped, updates stop.
3. Events when something notable happens: `order_completed`, `machine_failure`, `simulator_started`, `simulator_stopped`.
4. After `reset`, `failure` or a per-machine `start`/`stop`, an extra `machine_update` is sent immediately.

`snapshot` and `machine_update`:
```json
{"type": "machine_update", "timestamp": "2026-10-10T12:41:03",
 "simulator": {"running": true, "speed": 1.0},
 "machines": [{"machineId": "W01", "name": "Weaving Machine 01", "status": "RUNNING", "currentOrderId": "ORD104",
               "producedMeters": 1494.7, "targetMeters": 2000.0, "progress": 74.7, "productionRate": 112.0,
               "efficiency": 0.92, "temperature": 55.4, "costPerHour": 600.0, "costPerMeter": 5.36,
               "orderMachineCost": 8007.16, "estimatedCompletion": "2026-10-10T17:05:23", "runtimeToday": 6.65}]}
```
(`machines` has one entry per machine; one is shown.)

`event`:
```json
{"type": "event", "event": "order_completed", "machineId": "W01", "orderId": "ORD104",
 "message": "Order ORD104 finished production on W01. Ready for quality check.", "timestamp": "2026-10-10T12:45:12"}
```
If MongoDB is down on connect, the first message is `{"type": "error", "message": "MongoDB is not available"}`.

Quick check without a frontend: `python ws_check.py` in `backend/` prints the first five messages.

## Inventory
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/inventory` | List yarn batches with computed `lowStock` (true when `quantityKg` < 300) |
| POST | `/api/inventory` | Add a batch (`batchId` required, 409 if it exists) |
| PATCH | `/api/inventory/{batch_id}` | Update `material`, `colour`, `quantityKg`, `costPerKg`, `supplier` |

```json
{"batchId": "YB82", "material": "Cotton Yarn", "colour": "Navy Blue", "quantityKg": 950.0,
 "costPerKg": 180.0, "supplier": "Supplier A", "receivedDate": "2026-10-01", "lowStock": false}
```

## Workers and attendance
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/workers` | List workers with their latest assignment (`null` if no attendance yet) |
| POST | `/api/workers` | Add a worker (`workerId`, `name` required; 409 if it exists) |
| POST | `/api/attendance` | Log hours for a worker (404 if worker unknown; `date` defaults to today) |

```json
{"workerId": "EMP021", "name": "Ravi Kumar", "hourlyRate": 90.0, "shift": "B",
 "latestAssignment": {"orderId": "ORD104", "machineId": "W01", "date": "2026-10-10"},
 "hoursThisMonth": 72.0, "overtimeThisMonth": 3.5, "wageThisMonth": 6952.5}
```
Attendance body and response:
```json
{"workerId": "EMP021", "orderId": "ORD104", "machineId": "W01", "hoursWorked": 8.0, "overtimeHours": 0, "date": "2026-10-10"}
```

## Quality

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/quality` | All rolls, newest first |
| GET | `/api/quality/{roll_id}` | One roll (internal view, includes cost fields). `RL10092` and `RL-10092` both work |
| POST | `/api/quality` | Store a roll and, for `FAILED` / `REWORK`, calculate its cost impact |

POST body (all fields optional; `orderId` should normally be set and must exist, else 404):
```json
{"orderId": "ORD104", "machineId": "W01", "yarnBatch": "YB82", "shift": "B", "status": "REWORK",
 "defects": ["Weft break"], "affectedMeters": 120, "reworkStatus": "IN_PROGRESS"}
```
- `status`: `PASSED`, `FAILED`, `REWORK` or `PENDING` (422 otherwise). `rollId` is generated (`RL10094`) unless you send one (409 if it exists). `machineId` and `yarnBatch` default to the order's. `reworkStatus` (`NOT_REQUIRED`, `PENDING`, `IN_PROGRESS`, `COMPLETED`) defaults from the status.
- For `FAILED` / `REWORK` with `affectedMeters > 0`: additional labour = metres x 9.2, machine cost = metres x 5.7, material loss = metres x 0.59 kg/m x costPerKg of the roll's yarn batch (x `REWORK_MATERIAL_LOSS_SHARE`, default 1.0). Rates live in `backend/app/config.py`. The total is stored as `reworkCost` and the order's costs, profit and margin are recomputed. If `affectedMeters` is 0 you may send a flat `reworkCost` instead.

Response (the stored roll plus the impact and the order margin before and after):
```json
{"rollId": "RL10094", "orderId": "ORD104", "machineId": "W01", "yarnBatch": "YB82", "shift": "B",
 "buyerName": "ABC Garments", "status": "REWORK", "defects": ["Weft break"], "affectedMeters": 120.0,
 "reworkStatus": "IN_PROGRESS", "reworkCost": 14532.0,
 "impact": {"additionalLabour": 1104.0, "machineCost": 684.0, "materialLoss": 12744.0, "total": 14532.0},
 "date": "2026-10-10", "producedAt": "2026-10-10T13:39:37",
 "marginBefore": 46.7, "marginAfter": 42.6}
```
`marginBefore` / `marginAfter` are `null` when the roll has no order.

## Fabric passport (public)

No cost, impact, revenue or profit fields. Roll ids are tolerant of hyphens and case.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/passport/{roll_id}` | Passport of a roll |
| GET | `/api/passport/{roll_id}/qr` | PNG QR code (`image/png`) pointing to `{PASSPORT_BASE_URL}/passport/{rollId}` |

`GET /api/passport/RL10092`
```json
{"rollId": "RL10092", "orderId": "ORD104", "buyerName": "ABC Garments", "yarnBatch": "YB82",
 "machineId": "W01", "shift": "B", "producedAt": "2026-10-08T14:00:00", "qualityStatus": "PASSED",
 "defects": [], "reworkStatus": "NOT_REQUIRED"}
```
`PASSPORT_BASE_URL` is read from the environment (default `http://localhost:5173`); set it to the deployed frontend URL so printed QR codes open the right page. Save a QR with `curl -o qr.png http://localhost:8000/api/passport/RL10092/qr`.

## Buyer tracking (public)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/buyer/track/{order_id}` | Buyer-safe order status. `ORD104`, `ORD-104` and `ord-104` all work |

Only these fields are returned: no revenue, costs, wages, machine costs, profit, margin, supplier data or internal alerts (a test enforces this). Unknown ids return 404 with a friendly message.

```json
{"orderId": "ORD104", "buyerName": "ABC Garments", "fabricType": "Cotton", "colour": "Navy Blue",
 "quantityMeters": 2000.0, "progress": 73, "currentStage": "Weaving",
 "stages": [{"name": "Raw Material Allocated", "state": "DONE"},
            {"name": "Spinning", "state": "DONE"},
            {"name": "Weaving", "state": "IN_PROGRESS", "progress": 73},
            {"name": "Dyeing", "state": "PENDING"},
            {"name": "Quality Check", "state": "PENDING"},
            {"name": "Ready for Dispatch", "state": "PENDING"}],
 "expectedCompletion": "2026-10-15T18:00:00", "qualityStatus": "PASSED", "dispatchStatus": "NOT_DISPATCHED"}
```
- `progress` = `producedMeters / quantityMeters` in %. Only the in-progress Weaving stage carries its own `progress`.
- The stage comes from the order `status`: `NEW`/`PENDING` = Raw Material Allocated, `SPINNING`, `WEAVING`, `DYEING`, `QUALITY_CHECK`/`REWORK` = Quality Check, `READY_FOR_DISPATCH`; `DISPATCHED`/`COMPLETED`/`DELIVERED` = every stage `DONE` and `currentStage` is `"Dispatched"`.
- `qualityStatus`: `NOT_STARTED`, `PENDING`, `PASSED`, or `IN_REVIEW` (any failed or reworked roll; rework details stay internal). `dispatchStatus`: `NOT_DISPATCHED`, `READY_FOR_DISPATCH`, `DISPATCHED`. `expectedCompletion` is the order deadline.

## Transactions

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/transactions` | Record a payment (id generated, e.g. `TXN009`) |

```json
{"orderId": "ORD104", "amount": 50000}
```
Optional: `type` (default `BUYER_PAYMENT`), `date` (default today). A `BUYER_PAYMENT` needs an existing `orderId` (422 / 404) and updates the order's `paidAmount`; `amount` must be above 0. Response:
```json
{"transactionId": "TXN009", "type": "BUYER_PAYMENT", "orderId": "ORD104", "amount": 50000.0,
 "date": "2026-10-10",
 "order": {"orderId": "ORD104", "revenue": 356000.0, "paidAmount": 192400.0, "pendingAmount": 163600.0}}
```
Orders now carry `paidAmount` (sum of their buyer payments), and the finance order objects add `pendingAmount` (revenue minus paid). The dashboard `kpis` add `paymentsReceived` and `paymentsPending` (all orders; `buyerPayments` is still the month's payments).

## Costing and readiness

Formulas (constants live in `backend/app/config.py`):
- Labour = sum of hoursWorked x hourlyRate + sum of overtimeHours x hourlyRate x 1.5
- Machine = sum over machines of (hours the machine ran for the order x costPerHour), where hours = producedMeters / productionRate
- Raw material = yarn kg x costPerKg of the order's yarn batch (yarn kg = 0.59 x metres produced unless `yarnConsumedKg` is set)
- Rework = sum of reworkCost of the order's quality rolls
- True cost = rawMaterial + labour + machine + rework + other; Profit = revenue - cost; Margin % = profit / revenue x 100
- Target margin 25% (`belowTarget`); leakage benchmark margin 28%

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/orders/{order_id}/cost` | Live cost components for one order |
| GET | `/api/orders/{order_id}/readiness` | Material readiness and projected margin for an existing order |
| POST | `/api/orders/readiness-check` | Same check for an order that does not exist yet |

`GET /api/orders/ORD104/cost`
```json
{"orderId": "ORD104",
 "costs": {"rawMaterial": 155052.0, "labour": 22995.0, "machine": 7821.43, "rework": 0.0, "other": 4000.0},
 "totalCost": 189868.43, "labourHours": 223.0, "workerCount": 3, "overtimeCost": 1035.0,
 "regularLabourCost": 21960.0, "yarnConsumedKg": 861.4, "machineHours": 13.04}
```

`POST /api/orders/readiness-check` body (all required except `expectedRevenue`, which defaults to 0):
```json
{"quantityMeters": 2000, "colour": "Navy Blue", "fabricType": "Cotton", "expectedRevenue": 356000}
```
Response (`GET /api/orders/{id}/readiness` is identical, with `orderId` filled in). `status` is `MATERIAL_READY` or `CANNOT_START_FULL_PRODUCTION`; `warning` is `null` when the margin meets the target:
```json
{"orderId": null, "requiredYarnKg": 1180.0, "availableKg": 950.0, "shortageKg": 230.0,
 "status": "CANNOT_START_FULL_PRODUCTION",
 "projectedMaterialCost": 212400.0, "projectedLabourCost": 34629.46, "projectedMachineCost": 12759.35,
 "projectedCost": 259788.81, "expectedRevenue": 356000.0, "projectedProfit": 96211.19,
 "projectedMargin": 27.0, "warning": null, "targetMargin": 25.0}
```
Available stock = all inventory whose material is `<fabricType> Yarn` and whose colour matches. Projected labour and machine cost use the average cost per metre of finished orders.

## Finance

Per-order figures use the full contract revenue against the cost so far, so an order still in production has `provisional: true` and a flattering margin. Monthly totals count revenue for in-progress orders pro-rata to `progressPercent`. Orders belong to the month of their `orderDate`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/finance/dashboard?month=2026-10` | Owner KPIs, cost breakdown, best/worst order, all orders (month defaults to the current month) |
| GET | `/api/finance/monthly` | Revenue, cost, profit, margin for the last 4 months |
| GET | `/api/finance/profit-leakage?order_id=ORD091` | Where an order lost profit; without `order_id`, the lowest-margin finished order |
| GET | `/api/finance/orders/{order_id}` | Revenue, cost lines, profit, margin for one order |

`GET /api/finance/orders/ORD091`
```json
{"orderId": "ORD091", "buyerName": "Metro Apparel", "status": "REWORK", "orderDate": "2026-09-15",
 "revenue": 213000.0,
 "costs": {"rawMaterial": 120000.0, "labour": 35080.0, "machine": 9285.71, "rework": 8000.0, "other": 4000.0},
 "totalCost": 176365.71, "profit": 36634.29, "margin": 17.2, "paidAmount": 106500.0, "pendingAmount": 106500.0,
 "targetMargin": 25.0, "belowTarget": true,
 "progressPercent": 100.0, "provisional": false, "labourHours": 357.0, "workerCount": 2}
```

`GET /api/finance/profit-leakage` (ORD091)
```json
{"orderId": "ORD091", "buyerName": "Metro Apparel", "expectedMargin": 28.0, "actualMargin": 17.2,
 "leaks": [{"label": "Excess yarn consumption", "amount": 13800.0}, {"label": "Overtime", "amount": 10200.0},
           {"label": "Rework", "amount": 8000.0}, {"label": "Extra labour hours", "amount": 7598.74}],
 "totalLeakage": 39598.74, "machineId": "W03",
 "recommendation": "Review yarn wastage, reduce overtime and inspect Machine W03."}
```

`GET /api/finance/monthly` (4 entries; two shown)
```json
[{"month": "2026-07", "label": "Jul 2026", "revenue": 270000.0, "cost": 183799.46, "profit": 86200.54, "margin": 31.9},
 {"month": "2026-10", "label": "Oct 2026", "revenue": 395255.0, "cost": 281870.15, "profit": 113384.85, "margin": 28.7}]
```

`GET /api/finance/dashboard` (`orders` is a list of the per-order objects above; `mostProfitableOrder` / `leastProfitableOrder` have the same shape and are chosen among finished orders)
```json
{"month": "2026-10", "label": "Oct 2026", "targetMargin": 25.0,
 "kpis": {"revenue": 395255.0, "productionCost": 281870.15, "netProfit": 113384.85, "profitMargin": 28.7,
          "buyerPayments": 142400.0, "paymentsReceived": 970900.0, "paymentsPending": 605100.0,
          "workerWages": 44541.0, "rawMaterialExpense": 229038.0,
          "machineOperatingCost": 11941.15, "reworkCost": 0.0},
 "costBreakdown": {"rawMaterial": 229038.0, "labour": 33891.0, "machine": 11941.15, "rework": 0.0, "other": 7000.0},
 "mostProfitableOrder": {"orderId": "ORD071", "margin": 31.9},
 "leastProfitableOrder": {"orderId": "ORD091", "margin": 17.2},
 "orders": []}
```
(`workerWages` is wages paid for attendance in the month; `costBreakdown` is the cost attributed to that month's orders. The nested orders are abbreviated here.)

## Wages

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/workers/wages/summary?month=2026-10` | Regular wages, overtime pay, workforce cost and labour cost per order (month defaults to current) |

```json
{"month": "2026-10", "totalRegularWages": 39480.0, "totalOvertimePay": 5061.0, "totalWorkforceCost": 44541.0,
 "labourCostPerOrder": [{"orderId": "ORD104", "workersInvolved": 3, "labourHours": 223.0, "labourCost": 22995.0}]}
```

## Not implemented yet
Nothing from `context.md` section 9 is missing (the placeholder `GET /api/buyer` root was removed).

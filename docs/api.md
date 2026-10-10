# LoomSense API

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
 "orderDate": "2026-10-01", "machineId": "W01", "deadline": "2026-10-15T18:00:00", "revenue": 180000.0,
 "costs": {"rawMaterial": 82000.0, "labour": 24500.0, "machine": 18400.0, "rework": 6200.0, "other": 4000.0},
 "profit": 44900.0, "margin": 24.9}
```
POST body example: `{"buyerName": "ABC Garments", "fabricType": "Cotton", "colour": "Navy Blue", "quantityMeters": 2000, "revenue": 180000}`
PATCH body example: `{"status": "QUALITY_CHECK", "producedMeters": 2000}`

## Machines
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/machines` | List machines (W01–W06) |
| GET | `/api/machines/{machine_id}` | One machine |
| PATCH | `/api/machines/{machine_id}` | Update `status`, `currentOrderId`, `productionRate` |
| POST | `/api/machines/simulate` | Not implemented yet, returns 501 |

```json
{"machineId": "W01", "name": "Weaving Machine 01", "type": "WEAVING", "status": "RUNNING",
 "currentOrderId": "ORD104", "productionRate": 112.0, "producedMeters": 1460.0, "targetMeters": 2000.0,
 "temperature": 61.0, "costPerHour": 600.0, "efficiency": 0.91}
```
`status` is `RUNNING`, `IDLE` or `DOWN`. PATCH body example: `{"status": "IDLE", "currentOrderId": null}`

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
 "latestAssignment": {"orderId": "ORD104", "machineId": "W01", "date": "2026-10-10"}}
```
Attendance body and response:
```json
{"workerId": "EMP021", "orderId": "ORD104", "machineId": "W01", "hoursWorked": 8.0, "overtimeHours": 0, "date": "2026-10-10"}
```

## Quality
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/quality` | All rolls, newest first |
| GET | `/api/quality/{roll_id}` | One roll |
| POST | `/api/quality` | Store a roll (`rollId` generated if omitted; no cost logic yet) |

```json
{"rollId": "RL10092", "orderId": "ORD104", "machineId": "W01", "yarnBatch": "YB82", "shift": "B",
 "buyerName": "ABC Garments", "status": "PASSED", "defects": [], "reworkCost": 0.0, "date": "2026-10-08"}
```
`status` is `PASSED`, `FAILED`, `REWORK` or `PENDING`.

## Not implemented yet
`GET /api/orders/{id}/cost`, `/readiness`, `POST /api/machines/simulate` (501), `GET /api/workers/wages/summary`,
`GET /api/passport/{roll_id}`, `/api/finance/*` (placeholder only), `GET /api/buyer/track/{order_id}` (placeholder only),
`WS /ws/machines` (demo feed only).

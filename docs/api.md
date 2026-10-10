# Planned API (from context.md section 9)

Currently only placeholder GET endpoints exist; the rest are planned.

## Health
- `GET /api/health`

## Orders
- `GET /api/orders`
- `GET /api/orders/{order_id}`
- `POST /api/orders`
- `PATCH /api/orders/{order_id}`
- `GET /api/orders/{order_id}/cost`
- `GET /api/orders/{order_id}/readiness`

## Machines
- `GET /api/machines`
- `GET /api/machines/{machine_id}`
- `PATCH /api/machines/{machine_id}`
- `POST /api/machines/simulate`

## Inventory
- `GET /api/inventory`
- `POST /api/inventory`
- `PATCH /api/inventory/{batch_id}`

## Workers
- `GET /api/workers`
- `POST /api/workers`
- `POST /api/attendance`
- `GET /api/workers/wages/summary`

## Quality
- `POST /api/quality`
- `GET /api/quality/{roll_id}`
- `GET /api/passport/{roll_id}`

## Finance
- `GET /api/finance/dashboard`
- `GET /api/finance/monthly`
- `GET /api/finance/profit-leakage`
- `GET /api/finance/orders/{order_id}`

## Buyer tracking
- `GET /api/buyer/track/{order_id}` (buyer-safe data only: no wages, costs, profit, supplier info)

## WebSocket
- `WS /ws/machines`

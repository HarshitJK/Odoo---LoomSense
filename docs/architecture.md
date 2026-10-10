# Architecture

## Overall

```
React
  ↓
FastAPI (REST + WebSocket)
  ↓
MongoDB
```

- **React** (Vite, Tailwind, React Router, Axios, Recharts) renders the UI. It calls REST endpoints via `src/api/client.js` and listens to live machine data via `src/hooks/useMachineSocket.js`.
- **FastAPI** exposes REST routes under `/api/*` and a WebSocket at `/ws/machines`. Business logic lives in `backend/app/services/`.
- **MongoDB** stores orders, machines, inventory, workers, attendance, qualityChecks and transactions (see `context.md` section 8).

## Live production data

```
Machine Simulator (services/machine_simulator.py)
  ↓
FastAPI
  ↓
WebSocket (/ws/machines)
  ↓
React Production Dashboard
```

The simulator stands in for real PLC/IoT telemetry. It can later be replaced by MQTT, OPC-UA or Modbus without changing the frontend.

## Backend layout

- `routes/` — thin HTTP handlers
- `models/` — Pydantic schemas
- `services/` — costing, profitability, order readiness, simulator, QR
- `websocket/` — WebSocket endpoints
- `database.py` — MongoDB connection (API starts even if MongoDB is down; `get_db()` raises 503)

## Frontend layout

- `pages/` — one file per route
- `components/` — layout, common, charts, machines, orders
- `mocks/` — local sample data used until backend APIs are ready

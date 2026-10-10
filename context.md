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

# LoomSense — Project Context

## 1. Project Title
**LoomSense — Textile Production & Profit Intelligence Platform**

## 2. Problem Summary
Textile factories often manage raw materials, production status, quality checks, worker attendance, wages, buyer updates, and financial records using notebooks, paper slips, spreadsheets, and phone calls.

LoomSense is a unified web platform that connects the complete lifecycle of a textile order:

**Raw Material → Production → Workforce → Quality → Buyer Tracking → Profitability**

The key differentiator is that LoomSense does not only record operational data. It connects operational activity directly to financial performance so the owner can understand:

- the true production cost of each order
- raw material consumption
- machine output and utilization
- worker wages
- rework / quality-loss cost
- buyer payments
- monthly revenue, cost, profit, and margin
- where profit is being lost

---

## 3. Core Pitch

> **Every textile factory knows how much it sold. LoomSense tells the owner exactly where every rupee of profit was made — or lost.**

LoomSense creates a **digital financial thread** for every order by connecting material cost, labour cost, machine cost, quality losses, and buyer revenue.

---

# 4. FINAL MVP FEATURES

## Feature 1 — Profitability & Cost Intelligence Dashboard

### Goal
Give the factory owner a clear month-end financial view and calculate the actual cost and profit of every order.

### Show
- Monthly revenue
- Monthly production cost
- Net profit
- Profit margin
- Buyer payments
- Worker wages
- Raw material expenses
- Machine operating cost
- Rework / quality-loss cost
- Profit per order
- Most profitable order
- Least profitable order

### Order Cost Formula
```text
True Order Cost =
Raw Material Cost
+ Labour Cost
+ Machine Cost
+ Rework Cost
+ Other Production Cost
```

```text
Profit = Revenue - True Order Cost
Margin % = Profit / Revenue × 100
```

### Unique Element — Profit Leakage Detection
For low-margin orders, LoomSense should explain why the order underperformed.

Example:
```text
Order: ORD-091

Expected Margin: 28%
Actual Margin: 17%

Profit Leakage:
- Excess yarn consumption: ₹5,200
- Overtime: ₹3,800
- Rework: ₹5,200

Recommendation:
Review yarn wastage and inspect Machine W03.
```

---

## Feature 2 — Smart Raw Material & Order Readiness

### Goal
Digitize incoming yarn/raw material inventory and determine whether the factory is ready to begin a new order.

### Show
- Yarn stock by material/type/colour
- Quantity received
- Supplier
- Purchase cost
- Low-stock warnings
- Material consumption by order
- Remaining stock

### Order Readiness Check
When a new order arrives:

```text
Required yarn: 1,180 kg
Available yarn: 950 kg
Shortage: 230 kg
```

The system should clearly display:

```text
CANNOT START FULL PRODUCTION
```

or:

```text
MATERIAL READY
```

### Unique Element — Profit-Aware Order Acceptance
Before production begins, estimate:

- material cost
- labour cost
- machine cost
- total projected cost
- expected revenue
- predicted margin

Example:
```text
Expected Revenue: ₹350,000
Projected Cost: ₹254,498.28
Projected Profit: ₹95,501.72
Expected Margin: 27.3%

Above the factory target of 25%.
```

---

## Feature 3 — Live Production Control Tower

### Goal
Allow management to see which order is running on which machine, how much has been produced, machine status, and current production progress.

### Show
- Active machines
- Idle machines
- Machine status
- Current order
- Produced quantity
- Target quantity
- Progress %
- Production rate
- Estimated completion
- Machine efficiency
- Cost per machine / cost per metre

### Hackathon Data Strategy
Real textile machine integration is not required for the prototype.

Use a **Python Machine Telemetry Simulator** that updates machine data every few seconds.

Example machine event:
```json
{
  "machineId": "W03",
  "status": "RUNNING",
  "orderId": "ORD104",
  "productionRate": 112,
  "producedMeters": 1460,
  "targetMeters": 2000,
  "temperature": 61.0,
  "efficiency": 0.91
}
```

### Prototype Flow
```text
Python Simulator
    ↓
FastAPI Backend
    ↓
MongoDB
    ↓
FastAPI WebSocket
    ↓
React Dashboard
```

### Future Real-World Integration
The simulator can later be replaced by PLC / IoT telemetry through protocols such as MQTT, OPC-UA, or Modbus.

### Unique Element — Live Cost Visibility
Each machine page should show:
- production today
- runtime
- cost/hour
- machine cost attributed to the current order
- cost/metre

---

## Feature 4 — Fabric Digital Passport + Quality Traceability

### Goal
Make every finished fabric roll traceable to its source.

### Each Roll Should Store
- Roll ID
- Order ID
- Buyer
- Yarn batch
- Machine
- Shift
- Production date/time
- Quality status
- Defects
- Rework status

### QR Passport
Generate a QR code for every finished roll.

Scanning/opening the QR page should display:

```text
Roll: RL-10092
Order: ORD-104
Buyer: ABC Garments
Yarn Batch: YB-82
Machine: W01
Shift: B
Quality: PASSED
```

### Unique Element — Defect Cost Impact
If quality fails or requires rework, calculate the financial impact.

Example:
```text
Affected fabric: 120m
Additional labour: ₹1,100
Machine cost: ₹680
Material loss: ₹2,400

Total impact: ₹4,180

Order margin:
26.3% → 23.8%
```

This cost must feed back into Feature 1.

---

## Feature 5 — Worker Attendance, Shift & Wage Intelligence

### Goal
Digitize attendance and calculate labour cost while connecting worker activity directly to orders.

### Store
- Worker ID
- Name
- Shift
- Assigned machine
- Assigned order
- Hours worked
- Overtime
- Hourly / daily wage
- Wage earned

### Monthly View
Show:
- total regular wages
- total overtime
- total workforce cost

### Unique Element — Labour Cost per Order
Instead of only recording payroll, attribute labour cost to individual orders.

Example:
```text
Order: ORD-104
Workers involved: 7
Labour hours: 46.5h
Labour cost: ₹8,420
```

Feed this directly into the profitability engine.

### Optional Insight
```text
ORD-091 consumed 32% more labour hours than similar orders.

Additional labour cost:
₹5,800
```

---

## Feature 6 — Buyer Live Order Tracking

### Goal
Remove the need for buyers to repeatedly call the factory asking for order status.

### Buyer Page
Allow the buyer to enter/open a tracking ID and view:

```text
Order: ORD-104
Buyer: ABC Garments

Order Progress:
██████████████░░░ 78%

✓ Raw Material Allocated
✓ Spinning
● Weaving — 78%
○ Dyeing
○ Quality Check
○ Ready for Dispatch

Expected Completion:
15 Oct 2026, 4:30 PM
```

### Buyer Should See
- order status
- production stage
- progress %
- estimated completion
- quality status
- dispatch status

### Important
The buyer page should expose only buyer-safe information.

Do NOT expose:
- internal wages
- machine costing
- internal profit
- supplier cost
- internal alerts

---

# 5. FINAL PRODUCT FLOW

```text
CUSTOMER ORDER
      ↓
RAW MATERIAL / ORDER READINESS
      ↓
PRODUCTION
      ↓
LIVE MACHINE CONTROL TOWER
      ↓
WORKER HOURS + MACHINE COST
      ↓
QUALITY CHECK
      ↓
QR FABRIC PASSPORT
      ↓
BUYER TRACKING
      ↓
BUYER PAYMENT
      ↓
TRUE ORDER COST
      ↓
PROFITABILITY & PROFIT LEAKAGE
```

---

# 6. Tech Stack

## Frontend
- React
- Vite
- Tailwind CSS
- Recharts
- Lucide React
- React Router
- Axios

## Backend
- Python
- FastAPI
- Uvicorn
- Pydantic

## Database
- MongoDB Atlas
- PyMongo

## Realtime
- FastAPI WebSockets

## QR
- Python `qrcode` package or frontend QR library

## Deployment
Frontend:
- Vercel or Netlify

Backend:
- Render / Railway / similar Python hosting

Database:
- MongoDB Atlas

---

# 7. Recommended Repository Structure

```text
loomsense/
│
├── README.md
├── context.md
├── .gitignore
├── .env.example
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       │
│       ├── api/
│       │   └── client.js
│       │
│       ├── components/
│       │   ├── layout/
│       │   ├── common/
│       │   ├── charts/
│       │   ├── machines/
│       │   └── orders/
│       │
│       ├── pages/
│       │   ├── OwnerDashboard.jsx
│       │   ├── OrdersPage.jsx
│       │   ├── InventoryPage.jsx
│       │   ├── ProductionPage.jsx
│       │   ├── WorkersPage.jsx
│       │   ├── QualityPage.jsx
│       │   ├── FabricPassportPage.jsx
│       │   └── BuyerTrackingPage.jsx
│       │
│       ├── hooks/
│       │   └── useMachineSocket.js
│       │
│       ├── mocks/
│       │   ├── machines.js
│       │   ├── orders.js
│       │   ├── workers.js
│       │   └── inventory.js
│       │
│       └── utils/
│           ├── formatCurrency.js
│           └── calculations.js
│
├── backend/
│   ├── requirements.txt
│   ├── run.py
│   │
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       │
│       ├── models/
│       │   ├── order.py
│       │   ├── machine.py
│       │   ├── inventory.py
│       │   ├── worker.py
│       │   ├── attendance.py
│       │   ├── quality.py
│       │   └── transaction.py
│       │
│       ├── routes/
│       │   ├── health.py
│       │   ├── orders.py
│       │   ├── machines.py
│       │   ├── inventory.py
│       │   ├── workers.py
│       │   ├── quality.py
│       │   ├── finance.py
│       │   └── buyers.py
│       │
│       ├── services/
│       │   ├── costing.py
│       │   ├── profitability.py
│       │   ├── order_readiness.py
│       │   ├── machine_simulator.py
│       │   └── qr_service.py
│       │
│       ├── websocket/
│       │   └── machines.py
│       │
│       └── utils/
│           └── ids.py
│
└── docs/
    ├── architecture.md
    └── api.md
```

---

# 8. MongoDB Collections

Keep the database small and understandable.

## `orders`
Central entity connecting production and finance.

Suggested fields:
```json
{
  "orderId": "ORD104",
  "buyerId": "BUY001",
  "buyerName": "ABC Garments",
  "fabricType": "Cotton",
  "colour": "Navy Blue",
  "quantityMeters": 2000,
  "producedMeters": 1460,
  "status": "WEAVING",
  "machineId": "W01",
  "deadline": "2026-10-15T18:00:00",
  "revenue": 350000,
  "costs": {
    "rawMaterial": 82000,
    "labour": 24500,
    "machine": 18400,
    "rework": 6200,
    "other": 4000
  },
  "profit": 44900,
  "margin": 24.9
}
```

## `machines`
```json
{
  "machineId": "W01",
  "name": "Weaving Machine 01",
  "type": "WEAVING",
  "status": "RUNNING",
  "currentOrderId": "ORD104",
  "productionRate": 112,
  "costPerHour": 600,
  "efficiency": 0.91
}
```

## `inventory`
```json
{
  "batchId": "YB82",
  "material": "Cotton Yarn",
  "colour": "Navy Blue",
  "quantityKg": 950,
  "costPerKg": 180,
  "supplier": "Supplier A"
}
```

## `workers`
```json
{
  "workerId": "EMP021",
  "name": "Ravi Kumar",
  "hourlyRate": 90,
  "shift": "B"
}
```

## `attendance`
```json
{
  "workerId": "EMP021",
  "orderId": "ORD104",
  "machineId": "W01",
  "hoursWorked": 8,
  "overtimeHours": 0.5,
  "date": "2026-10-10"
}
```

## `qualityChecks`
```json
{
  "rollId": "RL10092",
  "orderId": "ORD104",
  "machineId": "W01",
  "yarnBatch": "YB82",
  "status": "PASSED",
  "defects": [],
  "reworkCost": 0
}
```

## `transactions`
```json
{
  "transactionId": "TXN001",
  "type": "BUYER_PAYMENT",
  "orderId": "ORD104",
  "amount": 142400,
  "date": "2026-10-10"
}
```

---

# 9. Suggested REST API Routes

## Health
```text
GET /api/health
```

## Orders
```text
GET    /api/orders
GET    /api/orders/{order_id}
POST   /api/orders
PATCH  /api/orders/{order_id}
GET    /api/orders/{order_id}/cost
GET    /api/orders/{order_id}/readiness
```

## Machines
```text
GET    /api/machines
GET    /api/machines/{machine_id}
PATCH  /api/machines/{machine_id}
POST   /api/machines/simulate
```

## Inventory
```text
GET    /api/inventory
POST   /api/inventory
PATCH  /api/inventory/{batch_id}
```

## Workers
```text
GET    /api/workers
POST   /api/workers
POST   /api/attendance
GET    /api/workers/wages/summary
```

## Quality
```text
POST   /api/quality
GET    /api/quality/{roll_id}
GET    /api/passport/{roll_id}
```

## Finance
```text
GET    /api/finance/dashboard
GET    /api/finance/monthly
GET    /api/finance/profit-leakage
GET    /api/finance/orders/{order_id}
```

## Buyer Tracking
```text
GET    /api/buyer/track/{trackingToken}        (private random token, never the order id)
POST   /api/orders/{order_id}/tracking/regenerate
```

## WebSocket
```text
WS /ws/machines
```

---

# 10. Business Logic Services

## Costing Service
Responsibilities:
- raw material cost
- labour cost
- machine runtime cost
- rework cost
- total order cost

## Profitability Service
Responsibilities:
- order profit
- margin
- monthly profit
- low-margin detection
- profit leakage explanation

## Order Readiness Service
Responsibilities:
- required material calculation
- available stock validation
- material shortage
- predicted production cost
- projected profit/margin

## Machine Simulator
Responsibilities:
- update machine status
- increase produced quantity
- calculate progress
- update production rate
- emit WebSocket events

---

# 11. Team Division

## Member 1 — Advanced Developer
Own:
- FastAPI backend
- MongoDB
- API integration
- costing engine
- profitability engine
- machine simulator
- WebSockets

## Member 2 — Beginner
Own:
- Owner Dashboard
- Production Control Tower
- charts
- machine cards
- order tables

Start with mock data first.

## Member 3 — Beginner
Own:
- Inventory UI
- Worker UI
- Quality form
- Fabric Passport page
- Buyer Tracking page

Start with mock data first.

---

# 12. Development Rule

Frontend work must not wait for backend work.

For the first phase, frontend pages should use local mock data under:

```text
frontend/src/mocks/
```

Once the backend APIs are ready, replace mock data with API calls.

This allows all three team members to work in parallel.

---

# 13. MVP Priority

## Must Work First
1. Profitability & Cost Intelligence
2. Raw Material + Order Readiness
3. Live Production Control Tower

## Next
4. Worker Wage Intelligence
5. Quality + Digital Passport
6. Buyer Tracking

Do not add extra features until these six are connected and demo-ready.

---

# 14. Optional Features — ONLY If Core MVP Is Finished

1. Machine failure + smart rerouting
2. Factory replay timeline
3. Predictive maintenance
4. Computer vision fabric defect detection
5. Advanced production scheduler
6. Natural-language factory analytics

---

# 15. Demo Story

Use a fresh order: ABC Garments, Cotton Navy Blue, 2,000 m, expected revenue ₹350,000.
Order IDs are assigned automatically: the first live order on a fresh seed is ORD112.
ORD104 remains the seeded in-progress order; its old rolls do not mean the whole order passed QC.

1. Owner checks readiness: 1,180 kg required, 950 kg available, 230 kg short;
   "Not enough material". Projected cost ₹254,498.28, profit ₹95,501.72, margin 27.3%, above the 25% target.
2. Receive 1,050 kg into YB82 at the unchanged ₹180/kg. Check again: 2,000 kg available,
   "Material ready", the same projected margin. Reserve 1,180 kg for the new order.
3. Manager creates the order and assigns idle W05 (ORD104 remains on W01).
4. Manager logs 8 hours plus 1 overtime hour for Suresh Patel (EMP023, latest machine W05).
   The server takes his ₹85 rate from the worker record; manager sees hours only.
5. Send 100 m of machine readings, then QC passes the first-off check. Send the remaining 1,900 m.
6. QC fails weaving with HIGH severity, 60 m affected, ₹8,300 rework cost. The hold blocks advance (409).
   Record "Rework this stage", then pass the reinspection. Profit is ₹8,300 lower than without the failure.
7. Manager advances and completes Processing and Finishing; QC passes each stage inspection.
8. QC passes Final inspection. The new roll gets its own automatic ID and a final passport.
   Buyer tracking says "Quality verification in progress" before this pass, then "Quality approved".
9. Owner reviews earned revenue, dated consumed material, wages, machine time, quality loss,
   net profit and leakage. Cash receipts and lifetime order profit are labelled separately.

See docs/demo-runbook.md for clicks, reset, telemetry controls and expected figures.
The API quality script also demonstrates component costs and a failed final inspection;
those extra failures change its ending totals, so do not compare them with the one-failure click demo.

---

# 16. UI Direction

The UI should feel like a modern industrial control platform, not a college CRUD project.

Design principles:
- dark/light neutral industrial palette
- large KPI cards
- clear status indicators
- minimal forms
- strong charts
- progress bars
- clear order timelines
- clean responsive layout

Avoid:
- excessive gradients
- unnecessary AI chatbots
- too many animations
- fake complexity
- cluttered dashboards

---

# 17. Coding Conventions

## Branches
Suggested:
```text
main
dev
frontend-dashboard
frontend-operations
backend-core
```

## Commit Style
Examples:
```text
feat: add owner profitability dashboard
feat: add order readiness endpoint
feat: add machine websocket simulator
fix: correct labour cost calculation
ui: add buyer tracking timeline
```

## Important
Never commit:
- `.env`
- MongoDB credentials
- API keys
- secrets

Use:
```text
.env.example
```

---

# 18. Success Criteria

The hackathon build is successful if judges can understand this story without explanation:

> A buyer places an order. LoomSense checks whether material is available, tracks the order through production, records worker and machine costs, handles quality inspection, gives the buyer live order visibility, and finally tells the owner exactly how much that order cost and how much profit it generated.

The product should feel interconnected.

Do not present six independent CRUD modules.

The value is in the **data flow between them**.

---

# 19. Final One-Line Summary

**LoomSense is a textile production and profit intelligence platform that connects raw materials, machine production, worker wages, quality losses, buyer tracking, and payments to calculate the true profitability of every order.**

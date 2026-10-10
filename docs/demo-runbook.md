# LoomSense Demo Runbook

A 12-step judge walkthrough for a live demo. Three logins required: owner, production manager,
and QC inspector. Reset between runs with `POST /api/demo/reset` or `python -m app.seed`.

## Accounts

| Login                        | Password      | Role               |
|------------------------------|---------------|--------------------|
| owner@loomsense.demo         | SEED_OWNER_PASSWORD env value   | Owner — all access |
| manager@loomsense.demo       | SEED_PRODUCTION_MANAGER_PASSWORD env value | Manager — operations |
| qc@loomsense.demo            | SEED_WORKER_QC_PASSWORD env value | QC — quality entry |

---

## Step 1 — Owner: check if we have enough material (shortage)

Login as **owner**. Go to **Orders** → **Check readiness**.

Enter:
- Buyer: ABC Garments
- Fabric: Cotton, Colour: Navy Blue
- Quantity: **2,000 m**
- Expected revenue: **₹350,000**

**Expected result:** "Not enough material"
- Required: **1,180 kg**, Available: **950 kg**, Shortage: **230 kg**
- Projected cost: ₹254,498, projected margin: **27.3%** — above the 25% target

> The projected margin exceeds the target even before we have the stock. The shortage is the only barrier.

---

## Step 2 — Owner: receive stock and confirm readiness

Go to **Stock** → **Add purchase**.

Enter:
- Supplier: Supplier A, Invoice: DEMO-LIVE-1, Batch: YB82
- Material: Cotton Yarn, Colour: Navy Blue
- Qty: **1,050 kg**, Cost: **₹180/kg**
- Purchase date: today

Go back to **Orders** → **Check readiness** with the same 2,000 m / ₹350,000 order.

**Expected result:** "Material ready" — same 27.3% projected margin.

---

## Step 3 — Manager: create the order and reserve material

Switch to **manager** login. Go to **Orders** → **New order**.

Fill:
- Buyer: ABC Garments, Fabric: Cotton, Colour: Navy Blue
- Quantity: 2,000 m, Revenue: ₹350,000

Click **Create**. Note the assigned order ID (e.g. ORD112). It is **stage-gated** (`gated: true`).

Open the new order. Click **Reserve material** — Batch YB82, 1,180 kg.

Go to **Machines**. Assign idle **W05** to the new order, set status RUNNING, rate 100 m/h.

**Expected result:** Order shows stage WEAVING, status WEAVING. Inventory for YB82 is reserved (stock unchanged until metres produced).

---

## Step 4 — Manager: log worker hours

Go to **Workers**. Fill the attendance form:
- Worker: Suresh Patel (EMP023), Order: new order ID, Machine: W05
- Hours: 8, Overtime: 1

Click **Log hours**.

**Expected result:** Hours saved. Manager sees hours and overtime — no rate, wage or cost figures. The owner's dashboard later shows the labour cost automatically.

---

## Step 5 — Machine readings and first-off quality check

**Manager**: Send 100 m of production (via `POST /api/machines/W05/readings` or the production simulator).

Switch to **QC** login. Go to **Quality**. Create a **FIRST_OFF** inspection for the new order, status **PASSED**.

**Expected result:** Order unblocked. Production continues. Buyer tracking says "Quality verification in progress" — not "PASSED" yet.

Check buyer tracking (the token link shown in the order): `qualityStatus: IN_PROGRESS`.

---

## Step 6 — Complete weaving and fail a stage inspection

**Manager**: Send 1,900 m more readings (total: 2,000 m).

**QC**: Go to **Quality** → submit a **STAGE** inspection for the new order:
- Status: FAILED
- Defect type: Weft break, Severity: **HIGH**
- Affected metres: 60, Rework cost: ₹4,000
- Additional labour: ₹2,500, Additional machine: ₹1,800

**Expected result:**
- Order goes to **QUALITY_HOLD** — production blocked.
- `stageStatus: QUALITY_HOLD`, `holdReason` is shown.
- Owner finance: profit is now ₹8,300 lower (`4000+2500+1800`).
- Stage advance returns **409 Conflict**.

**QC**: Record corrective action → **Rework this stage**.  
**QC**: Submit a **REINSPECTION** referencing the failed inspection → status **PASSED**.  
**Manager**: Click **Advance stage** → moves to PROCESSING.

---

## Step 7 — Complete Processing and Finishing

**Manager**: Click **Complete stage** (Processing).  
**QC**: Submit a **STAGE** inspection → PASSED.  
**Manager**: Click **Advance stage** → FINISHING.  
**Manager**: Click **Complete stage** (Finishing).  
**QC**: Submit a **STAGE** inspection → PASSED.  
**Manager**: Click **Advance stage** → FINAL_QC.

---

## Step 8 — Final inspection and passport

**QC**: Submit a **FINAL** inspection → status **PASSED**.

The inspection creates a roll with an automatic ID (e.g. RL20001). Go to `/passport/RL20001`.

**Expected result:**
- `final: true`, `qualityStatus: PASSED`
- No cost, revenue, profit or wage fields visible.

---

## Step 9 — Buyer tracking after final pass

Open the buyer tracking link (from the order's trackingUrl in step 3).

**Expected result:**
- `qualityStatus: PASSED`, message: "Quality approved"
- All six stages shown; dispatch stage PENDING.
- No internal fields in the response.

---

## Step 10 — Owner: review the dashboard

Switch to **owner** login. Go to **Dashboard** (select current month if needed).

**Expected result:**
- **Earned revenue** — accrual basis (production value for the month)
- **Total cost** — dated material consumption + labour + machine + rework
- **Net profit** = earned revenue − total cost (no mismatch)
- **Profit margin** above 25% target for this order
- **Cash received from buyers** — separate figure for the month's cash
- **Still to collect** — lifetime balance across all orders

The monthly trend chart uses the same accrual basis for all months. No month shows a margin below −20%.

---

## Step 11 — Owner: profit leakage

Click **Profit leakage** or go to `/api/finance/profit-leakage?order_id=ORD<new>`.

**Expected result:**
- Quality failure entry: ₹8,300 (rework + additional labour + additional machine cost)
- Recommendation: inspect Machine W05 / check quality at weaving stage
- Profit is lower than a hypothetical run with no failure

---

## Step 12 — Reset for next run

**API reset** (fastest):
```
POST /api/demo/reset
Header: X-Admin-Key: <your ADMIN_KEY>
```

**Seed command** (equivalent):
```powershell
cd backend
python -m app.seed
```

**Docker reset** (drops and reloads only demo collections):
```bash
docker compose run --rm -e FORCE_SEED=true seed
```

---

## Speed controls

To speed up the machine simulator during a live demo (so orders finish in seconds rather than minutes):

```bash
POST /api/machines/simulate
{"action": "start", "speed": 25}
```

To return to real-time:
```bash
POST /api/machines/simulate
{"action": "start", "speed": 1}
```

The demo flow script `backend/demo_flow.py` does this automatically at `DEMO_SPEED = 25`.

---

## Network fallback

If the live network is unavailable, the frontend can run against mock data:

```
VITE_USE_MOCKS=true npm run dev
```

The mock data uses the same field names as the API, so the layout and charts are demonstrable without a backend. Cost and margin figures will not match the live story.

The API demo script `backend/demo_flow.py` can also be run offline against a local server started with `python -m uvicorn app.main:app`.

---

## Likely judge questions

| Question | One-line answer |
|---|---|
| How are costs computed? | Material: yarn consumed (0.59 kg/m default) × batch price. Labour: hours × worker rate + overtime × 1.5. Machine: runtime hours × machine costPerHour. Rework: inspection records (rework + extra labour + extra machine + scrapped material). |
| What is simulated? | Machine production only. The Python simulator produces metres every 3 seconds of real time (each second = one factory minute). Worker hours, quality checks, buyer payments and expenses are all entered through the API. |
| How would real machines connect? | Replace the simulator's `POST /api/machines/{id}/readings` calls with a PLC/IoT gateway (MQTT, OPC-UA or Modbus). The same endpoint and collection schema apply. |
| How is buyer data kept safe? | Buyers get a random per-order token (not the order ID). The `/api/buyer/track/{token}` endpoint returns only 13 public fields (no costs, revenue, profit, wages, supplier names or internal alerts). A test asserts this for every seeded order. |
| What about tax or GST? | Not implemented. The system tracks rupee costs and profit. GST ledger, bank reconciliation and payroll disbursement are listed as known limitations. |
| Can two managers log in at once? | Yes. JWTs are stateless. The simulator and WebSocket connections are single-process, but multiple API clients can POST attendance, quality checks or machine readings concurrently. |

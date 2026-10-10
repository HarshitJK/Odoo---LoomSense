"""Runs the whole demo story (context.md section 15) through the API and prints a summary.

    python demo_flow.py [base_url]

Needs the server running with the simulator enabled. To start from clean seed data it calls
POST /api/demo/reset when ADMIN_KEY is set in your environment (or in backend/.env).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv()
sys.stdout.reconfigure(encoding="utf-8")

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"
TOKEN = os.getenv("LOOMSENSE_TOKEN", "")
ORDER = "ORD104"
DEMO_SPEED = 25  # simulator speed during the demo, so production finishes in about 20 seconds


def call(method, path, body=None, headers=None):
    req = urllib.request.Request(
        BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + TOKEN, **(headers or {})})
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read() or "null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "null")


def api(method, path, body=None, ok=(200, 201), headers=None):
    status, data = call(method, path, body, headers)
    if status not in ok:
        sys.exit(f"\nFAILED: {method} {path} -> {status} {data}")
    return data


def money(x):
    return f"₹{x:,.0f}"


def step(number, title):
    print(f"\n{'=' * 64}\nStep {number}: {title}\n{'=' * 64}")


def show_costs(label, cost):
    c = cost["costs"]
    print(f"{label}: raw {money(c['rawMaterial'])} | labour {money(c['labour'])} | machine {money(c['machine'])}"
          f" | rework {money(c['rework'])} | other {money(c['other'])} | TOTAL {money(cost['totalCost'])}")


# ---------------------------------------------------------------- start
if not TOKEN:
    TOKEN = api("POST", "/api/auth/login", {"email": "owner@loomsense.demo", "password": os.getenv("SEED_OWNER_PASSWORD", "")})["accessToken"]
print(f"LoomSense demo flow against {BASE}")
health = api("GET", "/api/health")
print(f"API is up, database {health['database']}")

admin_key = os.getenv("ADMIN_KEY")
if admin_key:
    reset = api("POST", "/api/demo/reset", headers={"X-Admin-Key": admin_key})
    print(f"Demo data reset: {reset['inserted']}")
else:
    print("ADMIN_KEY not set: skipping reset, so numbers depend on the current database state")

# ---------------------------------------------------------------- 1 readiness
step(1, f"Order readiness check for {ORDER} (Cotton, Navy Blue, 2,000 m)")
order = api("GET", f"/api/orders/{ORDER}")
check = api("POST", "/api/orders/readiness-check", {
    "quantityMeters": order["quantityMeters"], "colour": order["colour"],
    "fabricType": order["fabricType"], "expectedRevenue": order["revenue"]})
print(f"Required yarn {check['requiredYarnKg']:,.0f} kg | available {check['availableKg']:,.0f} kg"
      f" | shortage {check['shortageKg']:,.0f} kg")
print(f"Status: {check['status'].replace('_', ' ')}")
print(f"Projected cost {money(check['projectedCost'])} vs revenue {money(check['expectedRevenue'])}"
      f" -> projected margin {check['projectedMargin']}%"
      + (f"  WARNING: {check['warning']}" if check["warning"] else "  (meets the 25% target)"))

# ---------------------------------------------------------------- 2 assign W01
step(2, "Assign machine W01 to the order")
machine = api("PATCH", "/api/machines/W01", {"status": "RUNNING", "currentOrderId": ORDER, "productionRate": 112})
api("PATCH", f"/api/orders/{ORDER}", {"status": "WEAVING", "machineId": "W01"})
print(f"W01 is {machine['status']} on {machine['currentOrderId']} at {machine['productionRate']:.0f} m/h,"
      f" {machine['producedMeters']:,.0f}/{machine['targetMeters']:,.0f} m ({machine['progress']}%)")
print(f"Machine cost so far {money(machine['orderMachineCost'])} ({machine['costPerMeter']} per metre)")

# ---------------------------------------------------------------- 3 worker hours
step(3, f"Workers log hours against {ORDER}")
before = api("GET", f"/api/orders/{ORDER}/cost")
show_costs("Before", before)
for worker, hours, overtime in [("EMP021", 8, 0.5), ("EMP022", 8, 1), ("EMP025", 8, 0)]:
    api("POST", "/api/attendance", {"workerId": worker, "orderId": ORDER, "machineId": "W01",
                                    "hoursWorked": hours, "overtimeHours": overtime})
    print(f"  logged {worker}: {hours} h + {overtime} h overtime")
after = api("GET", f"/api/orders/{ORDER}/cost")
show_costs("After ", after)
print(f"Labour cost rose by {money(after['costs']['labour'] - before['costs']['labour'])} automatically;"
      f" {after['workerCount']} workers, {after['labourHours']} labour hours")

# ---------------------------------------------------------------- 4 simulator
step(4, f"Let the machine simulator advance production (speed {DEMO_SPEED}x)")
api("POST", "/api/machines/simulate", {"action": "start", "speed": DEMO_SPEED})
started = time.time()
last = None
while time.time() - started < 90:
    live = api("GET", f"/api/orders/{ORDER}")
    machine = api("GET", "/api/machines/W01")
    line = f"{live['producedMeters']:,.0f} / {live['quantityMeters']:,.0f} m ({machine['progress']}%)"
    if line != last:
        print(f"  t+{time.time() - started:4.0f}s  {line}  status {live['status']}  W01 {machine['status']}")
        last = line
    if live["status"] == "QUALITY_CHECK":
        break
    time.sleep(3)
else:
    sys.exit("\nFAILED: production did not finish in 90 s. Is the simulator running?")
api("POST", "/api/machines/simulate", {"action": "start", "speed": 1})  # back to real speed
print("Production complete: the order moved to QUALITY_CHECK and W01 went idle.")
show_costs("Costs now", api("GET", f"/api/orders/{ORDER}/cost"))

# ---------------------------------------------------------------- 5 roll
step(5, "Create roll RL10092")
status, roll = call("POST", "/api/quality", {"rollId": "RL10092", "orderId": ORDER, "machineId": "W01",
                                              "yarnBatch": "YB82", "shift": "B", "status": "PASSED"})
if status == 409:
    print("RL10092 already exists (it is part of the seed data), so the demo uses it")
else:
    print(f"Created {roll['rollId']} with status {roll['status']}")

# ---------------------------------------------------------------- 6 rework
step(6, "Quality check finds a defect: submit a REWORK record (120 m)")
rework = api("POST", "/api/quality", {"orderId": ORDER, "machineId": "W01", "yarnBatch": "YB82", "shift": "B",
                                      "status": "REWORK", "defects": ["Weft break"], "affectedMeters": 120})
impact = rework["impact"]
print(f"Roll {rework['rollId']}: additional labour {money(impact['additionalLabour'])}"
      f" + machine {money(impact['machineCost'])} + material loss {money(impact['materialLoss'])}"
      f" = {money(impact['total'])}")
print(f"Order margin {rework['marginBefore']}% -> {rework['marginAfter']}%")

# ---------------------------------------------------------------- 7 passport
step(7, "Open the QR fabric passport (public)")
for roll_id in ("RL10092", rework["rollId"]):
    p = api("GET", f"/api/passport/{roll_id}")
    print(f"Roll {p['rollId']} | order {p['orderId']} | buyer {p['buyerName']} | yarn {p['yarnBatch']}"
          f" | machine {p['machineId']} | shift {p['shift']} | quality {p['qualityStatus']}"
          f" | rework {p['reworkStatus']}" + (f" | defects {', '.join(p['defects'])}" if p["defects"] else ""))
with urllib.request.urlopen(f"{BASE}/api/passport/RL10092/qr") as res:
    png = res.read()
print(f"QR code: {len(png)} bytes, {'valid PNG' if png[1:4] == b'PNG' else 'NOT a PNG'}")

# ---------------------------------------------------------------- 8 buyer
step(8, "Buyer tracking page (buyer-safe data only)")
t = api("GET", "/api/buyer/track/" + api("GET", "/api/orders/ORD104")["trackingToken"])
print(f"Order {t['orderId']} for {t['buyerName']}: {t['quantityMeters']:,.0f} m {t['colour']} {t['fabricType']}")
print(f"Progress {t['progress']}% | stage: {t['currentStage']} | quality: {t['qualityStatus']}"
      f" | dispatch: {t['dispatchStatus']} | expected {t['expectedCompletion']}")
for s in t["stages"]:
    mark = {"DONE": "✓", "IN_PROGRESS": "●", "PENDING": "○"}[s["state"]]
    print(f"  {mark} {s['name']}")

# ---------------------------------------------------------------- 9 owner
step(9, "Owner dashboard and profit leakage")
api("POST", "/api/transactions", {"orderId": ORDER, "amount": 100000})
d = api("GET", "/api/finance/dashboard")
k = d["kpis"]
print(f"{d['label']}: revenue {money(k['revenue'])} | production cost {money(k['productionCost'])}"
      f" | profit {money(k['netProfit'])} | margin {k['profitMargin']}% (target {d['targetMargin']:g}%)")
print(f"  raw material {money(k['rawMaterialExpense'])} | machine {money(k['machineOperatingCost'])}"
      f" | rework {money(k['reworkCost'])} | worker wages {money(k['workerWages'])}")
print(f"  payments received {money(k['paymentsReceived'])} | pending {money(k['paymentsPending'])}")
best, worst = d["mostProfitableOrder"], d["leastProfitableOrder"]
print(f"  most profitable {best['orderId']} ({best['margin']}%) | least profitable {worst['orderId']} ({worst['margin']}%)")

o = api("GET", f"/api/finance/orders/{ORDER}")
print(f"\n{ORDER} true cost {money(o['totalCost'])}, revenue {money(o['revenue'])}, profit {money(o['profit'])},"
      f" margin {o['margin']}%")
show_costs("Cost lines", {"costs": o["costs"], "totalCost": o["totalCost"]})

for title, path in [("Lowest-margin order", "/api/finance/profit-leakage"),
                    (f"{ORDER} after rework", f"/api/finance/profit-leakage?order_id={ORDER}")]:
    leak = api("GET", path)
    print(f"\nProfit leakage, {title}: {leak['orderId']} expected {leak['expectedMargin']}%, actual {leak['actualMargin']}%")
    for item in leak["leaks"]:
        print(f"  - {item['label']}: {money(item['amount'])}")
    print(f"  Recommendation: {leak['recommendation']}")

print("\nDemo flow finished: every step worked end to end.")

"""Smoke test for the running API: python smoke_test.py [base_url]

Needs the server running and seeded data. It creates a few test records;
run `python -m app.seed` afterwards to reset the database.
"""
import json
import os
from dotenv import load_dotenv
load_dotenv()
TOKEN = os.getenv("LOOMSENSE_TOKEN", "")
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
results = []


def has_id(data):
    if isinstance(data, dict):
        return "_id" in data or any(has_id(v) for v in data.values())
    if isinstance(data, list):
        return any(has_id(v) for v in data)
    return False


def call(method, path, body=None):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + TOKEN},
    )
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read() or "null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "null")


def check(name, method, path, expect=200, body=None, test=None):
    status, data = call(method, path, body)
    ok = bool(status == expect and not has_id(data) and (test(data) if test else True))
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'}  {method:5} {path}  -> {status}" + ("" if ok else f"  {data}"))
    return data


if not TOKEN:
    status, auth = call("POST", "/api/auth/login", {"email": "owner@loomsense.demo", "password": os.getenv("SEED_OWNER_PASSWORD", "")})
    if status != 200:
        sys.exit("Set LOOMSENSE_TOKEN or the configured SEED_OWNER_PASSWORD")
    TOKEN = auth["accessToken"]
check("health", "GET", "/api/health", test=lambda d: d["database"] == "connected")

# Orders
check("orders", "GET", "/api/orders", test=lambda d: len(d) >= 6)
check("orders filter", "GET", "/api/orders?status=WEAVING", test=lambda d: all(o["status"] == "WEAVING" for o in d))
check("order", "GET", "/api/orders/ORD104", test=lambda d: d["buyerName"] == "ABC Garments")
check("order 404", "GET", "/api/orders/NOPE", expect=404)
new = check("order create", "POST", "/api/orders", 201,
            {"buyerName": "Test Buyer", "quantityMeters": 500, "revenue": 50000},
            test=lambda d: d["orderId"].startswith("ORD") and d["status"] == "NEW")
check("order create 422", "POST", "/api/orders", 422, {"buyerName": "x"})
check("order patch", "PATCH", f"/api/orders/{new['orderId']}", body={"status": "PENDING"},
      test=lambda d: d["status"] == "PENDING")
check("order patch 404", "PATCH", "/api/orders/NOPE", 404, {"status": "X"})

# Machines
check("machines", "GET", "/api/machines", test=lambda d: len(d) == 6 and "costPerMeter" in d[0])
check("machine", "GET", "/api/machines/W01", test=lambda d: d["machineId"] == "W01")
check("machine 404", "GET", "/api/machines/NOPE", expect=404)
check("machine patch", "PATCH", "/api/machines/W05", body={"productionRate": 50},
      test=lambda d: d["costPerMeter"] == 9.0)  # 450 / 50
check("machine reset", "PATCH", "/api/machines/W05", body={"productionRate": 0})
check("simulate 404", "POST", "/api/machines/simulate", 404, {"action": "failure", "machineId": "NOPE"})
check("simulate 422", "POST", "/api/machines/simulate", 422, {"action": "bogus"})
check("simulate stop", "POST", "/api/machines/simulate", 200, {"action": "stop"}, test=lambda d: d["running"] is False)
check("simulate start", "POST", "/api/machines/simulate", 200, {"action": "start"}, test=lambda d: d["running"] is True)

# Inventory
check("inventory", "GET", "/api/inventory",
      test=lambda d: any(b["lowStock"] for b in d) and any(not b["lowStock"] for b in d))
check("inventory create", "POST", "/api/inventory", 201,
      {"batchId": "YBTEST", "material": "Cotton Yarn", "colour": "Blue", "quantityKg": 100,
       "costPerKg": 100, "supplier": "S"}, test=lambda d: d["lowStock"] is True)
check("inventory patch", "PATCH", "/api/inventory/YBTEST", body={"quantityKg": 500},
      test=lambda d: d["lowStock"] is False)
check("inventory patch 404", "PATCH", "/api/inventory/NOPE", 404, {"quantityKg": 1})

# Workers + attendance
check("workers", "GET", "/api/workers",
      test=lambda d: len(d) >= 10 and d[0]["latestAssignment"]["orderId"])
check("worker create", "POST", "/api/workers", 201,
      {"workerId": "EMPTEST", "name": "Test Worker", "hourlyRate": 80, "shift": "A"})
check("attendance", "POST", "/api/attendance", 201,
      {"workerId": "EMPTEST", "orderId": "ORD104", "machineId": "W01", "hoursWorked": 8})
check("attendance 404", "POST", "/api/attendance", 404, {"workerId": "NOPE"})
check("workers latest", "GET", "/api/workers",
      test=lambda d: any(w["workerId"] == "EMPTEST" and w["latestAssignment"]["orderId"] == "ORD104" for w in d))

# Quality
check("quality list", "GET", "/api/quality", test=lambda d: len(d) >= 5)
check("quality roll", "GET", "/api/quality/RL10092", test=lambda d: d["status"] == "PASSED")
check("quality 404", "GET", "/api/quality/NOPE", expect=404)
check("quality create", "POST", "/api/quality", 201,
      {"orderId": "ORD104", "machineId": "W01", "yarnBatch": "YB82", "status": "PASSED"},
      test=lambda d: d["rollId"].startswith("RL"))
check("quality newest first", "GET", "/api/quality", test=lambda d: d[0]["date"] >= d[-1]["date"])

# Costing, readiness, finance (Phase 3)
check("order cost", "GET", "/api/orders/ORD104/cost",
      test=lambda d: d["totalCost"] == round(sum(d["costs"].values()), 2) and d["workerCount"] >= 3)
check("order readiness", "GET", "/api/orders/ORD104/readiness",
      test=lambda d: d["shortageKg"] == 230 and d["status"] == "CANNOT_START_FULL_PRODUCTION")
check("readiness 404", "GET", "/api/orders/NOPE/readiness", expect=404)
check("readiness check", "POST", "/api/orders/readiness-check", 200,
      {"quantityMeters": 2000, "colour": "Navy Blue", "fabricType": "Cotton", "expectedRevenue": 356000},
      test=lambda d: d["requiredYarnKg"] == 1180 and d["projectedCost"] > 0)
check("readiness check 422", "POST", "/api/orders/readiness-check", 422, {"colour": "x"})
check("finance dashboard", "GET", "/api/finance/dashboard",
      test=lambda d: d["kpis"]["revenue"] > 0 and d["mostProfitableOrder"] and len(d["orders"]) >= 6)
check("finance monthly", "GET", "/api/finance/monthly", test=lambda d: len(d) == 4)
check("profit leakage", "GET", "/api/finance/profit-leakage",
      test=lambda d: d["orderId"] == "ORD091" and len(d["leaks"]) >= 3)
check("profit leakage by id", "GET", "/api/finance/profit-leakage?order_id=ORD104")
check("finance order", "GET", "/api/finance/orders/ORD091", test=lambda d: d["belowTarget"] is True)
check("finance order 404", "GET", "/api/finance/orders/NOPE", expect=404)
check("wages summary", "GET", "/api/workers/wages/summary?month=2026-10",
      test=lambda d: d["totalWorkforceCost"] > 0 and len(d["labourCostPerOrder"]) >= 3)

# Quality impact, passport, buyer tracking, transactions (Phase 5)
rework = check("quality rework", "POST", "/api/quality", 201,
               {"orderId": "ORD104", "yarnBatch": "YB82", "status": "REWORK", "affectedMeters": 120},
               test=lambda d: d["impact"]["total"] > 0 and d["marginAfter"] < d["marginBefore"])
check("passport", "GET", f"/api/passport/{rework['rollId']}", test=lambda d: d["qualityStatus"] == "REWORK")
check("passport 404", "GET", "/api/passport/NOPE", expect=404)
with urllib.request.urlopen(BASE + "/api/passport/RL10092/qr") as res:
    png_ok = res.status == 200 and res.read(8) == bytes([137, 80, 78, 71, 13, 10, 26, 10])
results.append(png_ok)
print(f"{'PASS' if png_ok else 'FAIL'}  GET   /api/passport/RL10092/qr  -> valid PNG")
check("buyer track", "GET", "/api/buyer/track/" + call("GET", "/api/orders/ORD104")[1]["trackingToken"], test=lambda d: d["currentStage"] == "Weaving")
check("buyer track 404", "GET", "/api/buyer/track/ORD999", expect=404)
check("buyer track by order id 404", "GET", "/api/buyer/track/ORD104", expect=404)
check("tracking link regenerate", "POST", "/api/orders/ORD104/tracking/regenerate", expect=200)
check("transaction", "POST", "/api/transactions", 201, {"orderId": "ORD104", "amount": 1000},
      test=lambda d: d["order"]["paidAmount"] >= 1000)
check("transaction 422", "POST", "/api/transactions", 422, {"amount": 0})

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)

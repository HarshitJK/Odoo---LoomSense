"""Smoke test for the running API: python smoke_test.py [base_url]

Needs the server running and seeded data. It creates a few test records;
run `python -m app.seed` afterwards to reset the database.
"""
import json
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
        headers={"Content-Type": "application/json"},
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
check("machines", "GET", "/api/machines", test=lambda d: len(d) == 6)
check("machine", "GET", "/api/machines/W01", test=lambda d: d["machineId"] == "W01")
check("machine 404", "GET", "/api/machines/NOPE", expect=404)
check("machine patch", "PATCH", "/api/machines/W05", body={"productionRate": 50},
      test=lambda d: d["productionRate"] == 50)
check("machine reset", "PATCH", "/api/machines/W05", body={"productionRate": 0})
check("simulate stub", "POST", "/api/machines/simulate", expect=501)

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

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)

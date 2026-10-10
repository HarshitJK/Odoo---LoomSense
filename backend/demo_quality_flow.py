"""Stage-gated quality control, end to end, through the real API with the three roles.

    python demo_quality_flow.py [base_url]

Needs the server running and the three seed logins set in backend/.env (SEED_OWNER_PASSWORD,
SEED_PRODUCTION_MANAGER_PASSWORD, SEED_WORKER_QC_PASSWORD). It creates a new order each run and prints
PASS or FAIL for every step. The exit code is 1 if any step failed.

Story: a new order is woven, the first-off sample is checked, weaving fails its stage inspection (HIGH),
the order is held and cannot advance (409 from the API), the failure is reworked and reinspected, the order
carries on to final QC, the passport becomes final, and the owner sees what the failure cost.
"""
import json
import os
import sys
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv()
sys.stdout.reconfigure(encoding="utf-8")

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"
MACHINE = "W05"
QUANTITY = 300
results = []
tokens = {}


def call(role, method, path, body=None):
    headers = {"Content-Type": "application/json"}
    if role:
        headers["Authorization"] = "Bearer " + tokens[role]
    req = urllib.request.Request(BASE + path, method=method, headers=headers,
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read() or "null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "null")


def check(description, condition, detail=""):
    results.append(bool(condition))
    print(f"{'PASS' if condition else 'FAIL'}  {description}" + ("" if condition else f"   ({detail})"))
    return bool(condition)


def need(status_data, description, expect=(200, 201)):
    """Run a step that must work; later steps depend on it."""
    status, data = status_data
    check(description, status in expect, f"{status} {data}")
    if status not in expect:
        finish()
    return data


def heading(text):
    print(f"\n--- {text}")


def money(x):
    return f"Rs {x:,.0f}"


def finish():
    failed = results.count(False)
    print(f"\n{len(results) - failed} of {len(results)} steps passed" + (f", {failed} FAILED" if failed else ""))
    sys.exit(1 if failed else 0)


def order_of(oid):
    return call("manager", "GET", f"/api/orders/{oid}")[1]


def weave(meters):
    return call("manager", "POST", f"/api/machines/{MACHINE}/readings", {"producedMetersDelta": meters})


# ------------------------------------------------------------------ 1 logins
heading("1. Three roles sign in")
for role, email, env in [("owner", "owner", "SEED_OWNER_PASSWORD"), ("manager", "manager", "SEED_PRODUCTION_MANAGER_PASSWORD"),
                         ("qc", "qc", "SEED_WORKER_QC_PASSWORD")]:
    status, data = call(None, "POST", "/api/auth/login", {"email": f"{email}@loomsense.demo", "password": os.getenv(env, "")})
    check(f"{role} logged in", status == 200, f"{status} {data}")
    if status != 200:
        sys.exit(f"Set {env} (backend/.env) to the seed password and re-run.")
    tokens[role] = data["accessToken"]
check("QC worker cannot open the owner finance dashboard", call("qc", "GET", "/api/finance/dashboard")[0] == 403)
check("production manager cannot open quality analytics", call("manager", "GET", "/api/quality/analytics")[0] == 403)

# ------------------------------------------------------------------ 2 start the order
heading("2. Production manager starts an order")
created = need(call("manager", "POST", "/api/orders", {"buyerName": "Stage QC Demo Buyer", "fabricType": "Cotton",
               "colour": "Navy Blue", "quantityMeters": QUANTITY, "revenue": 60000, "yarnBatch": "YB82"}), "order created")
oid, token = created["orderId"], created["trackingToken"]
check("order is gated and starts at RAW_MATERIAL", created["currentStage"] == "RAW_MATERIAL" and created["gated"], created)
check("first-off is required, sample is 100 m", created["requiresFirstOffQc"] and created["sampleMeters"] == 100)
need(call("manager", "PATCH", f"/api/machines/{MACHINE}", {"currentOrderId": oid, "status": "RUNNING", "productionRate": 100}),
     f"machine {MACHINE} assigned to {oid}")

# ------------------------------------------------------------------ 3 first-off
heading("3. First-off inspection pauses production at the sample length")
need(weave(100), "machine reports 100 m woven")
order = order_of(oid)
check("order moved to WEAVING and waits for first-off", order["currentStage"] == "WEAVING" and order["stageStatus"] == "QC_PENDING"
      and order["pendingInspectionType"] == "FIRST_OFF", order)
check("production is blocked and says why", order["productionBlocked"] and "first-off" in (order["productionBlockReason"] or "").lower())
weave(60)
check("more machine readings add no metres while waiting", order_of(oid)["producedMeters"] == 100, order_of(oid)["producedMeters"])
pending = call("qc", "GET", "/api/quality/pending")[1]
row = next((p for p in pending if p["orderId"] == oid), None)
check("QC worker sees it in the pending list with the sample size", bool(row) and row["inspectionType"] == "FIRST_OFF"
      and row["sampleMeters"] == 100, row)
need(call("qc", "POST", "/api/quality", {"orderId": oid, "inspectionType": "FIRST_OFF", "status": "PASSED", "shift": "A"}),
     "QC worker records FIRST_OFF PASSED")
order = order_of(oid)
check("production continues", order["stageStatus"] == "IN_PROGRESS" and not order["productionBlocked"], order)
weave(QUANTITY - order["producedMeters"])
order = order_of(oid)
check("weaving finished: order waits for its stage inspection (QC_PENDING)", order["producedMeters"] >= QUANTITY
      and order["stageStatus"] == "QC_PENDING" and order["pendingInspectionType"] == "STAGE", order)
status, data = call("manager", "POST", f"/api/orders/{oid}/stage/advance")
check("advance without a passed inspection is refused with 409", status == 409, f"{status} {data}")
print(f"      API says: {data.get('detail') if isinstance(data, dict) else data}")

# ------------------------------------------------------------------ 4 failure and hold
heading("4. Weaving fails its stage inspection: quality hold")
profit_start = call("owner", "GET", f"/api/orders/{oid}")[1]   # owner's view just before the failure
failed = need(call("qc", "POST", "/api/quality", {
    "orderId": oid, "inspectionType": "STAGE", "status": "FAILED", "defectType": "Weft break", "defectSeverity": "HIGH",
    "affectedMeters": 60, "reworkCost": 4000, "additionalLabourCost": 2500, "additionalMachineCost": 1800,
    "notes": "Weft breaks along 60 m", "shift": "B"}), "QC worker records STAGE FAILED (HIGH, 60 m)")
fid = failed["inspectionId"]
order = order_of(oid)
hold = order["qualityHold"] or {}
check("order is on QUALITY_HOLD with the hold filled in", order["stageStatus"] == "QUALITY_HOLD" and hold.get("failedInspectionId") == fid
      and hold.get("failedStage") == "WEAVING" and hold.get("affectedMeters") == 60 and hold.get("holdStartedAt"), order)
check("QC response has no cost fields", "reworkCost" not in failed and "impact" not in failed)
holds = call("manager", "GET", "/api/quality/holds")[1]
check("production manager sees it in the holds list", any(h["orderId"] == oid and h["defectType"] == "Weft break" for h in holds))
status, data = call("manager", "POST", f"/api/orders/{oid}/stage/advance")
check("advance while on hold is refused with 409", status == 409 and "hold" in str(data), f"{status} {data}")
print(f"      API says: {data.get('detail') if isinstance(data, dict) else data}")
check("start of the next stage is refused too (complete returns 409)", call("manager", "POST", f"/api/orders/{oid}/stage/complete")[0] == 409)
check("a normal PASSED inspection cannot lift the hold (409)", call("qc", "POST", "/api/quality", {"orderId": oid, "status": "PASSED"})[0] == 409)
machine = call("manager", "GET", f"/api/machines/{MACHINE}")[1]
check("machine data and assignment are kept", machine["currentOrderId"] == oid and machine["producedMeters"] >= QUANTITY, machine)
status, data = call("qc", "POST", "/api/quality", {"orderId": oid, "inspectionType": "REINSPECTION", "reinspectionOf": fid, "status": "PASSED"})
check("reinspection before a corrective action is refused (409)", status == 409, f"{status} {data}")

# ------------------------------------------------------------------ 5 owner sees the cost
heading("5. The owner sees what the failure cost")
now = call("owner", "GET", f"/api/orders/{oid}")[1]
loss = now["costs"]["rework"]
check("quality loss is rework + extra labour + extra machine = 8,300", loss == 8300, loss)
check("profit fell by exactly the quality loss", round(profit_start["profit"] - now["profit"], 2) == loss,
      f"{profit_start['profit']} -> {now['profit']}")
print(f"      margin {profit_start['margin']}% -> {now['margin']}%, quality loss {money(loss)}")
leak = call("owner", "GET", f"/api/finance/profit-leakage?order_id={oid}")[1]
entries = [l for l in leak["leaks"] if l.get("type") == "QUALITY_FAILURE"]
check("profit leakage lists the quality failure entries", len(entries) >= 3 and all(e["stage"] == "WEAVING" and e["orderId"] == oid for e in entries))
for e in entries:
    print(f"      {e['component']:<17} {money(e['amount']):>10}  {e['message']}")
check("leakage entries add up to the quality loss", round(sum(e["amount"] for e in entries), 2) == loss)

# ------------------------------------------------------------------ 6 corrective action and reinspection
heading("6. Corrective action, reinspection, hold released")
check("FULL_RESTART is refused for HIGH severity (422)", call("qc", "PATCH", f"/api/quality/{fid}/corrective-action",
      {"correctiveAction": "FULL_RESTART"})[0] == 422)
need(call("qc", "PATCH", f"/api/quality/{fid}/corrective-action", {"correctiveAction": "REWORK_CURRENT_STAGE"}),
     "QC worker sets REWORK_CURRENT_STAGE on the failed inspection")
second = need(call("qc", "POST", "/api/quality", {"orderId": oid, "inspectionType": "REINSPECTION", "reinspectionOf": fid,
              "status": "PASSED", "shift": "B"}), "QC worker records REINSPECTION PASSED")
order = order_of(oid)
check("hold released, production no longer blocked", order["qualityHold"] is None and not order["productionBlocked"]
      and order["stageStatus"] == "COMPLETE", order)
timeline = call("qc", "GET", f"/api/quality/order/{oid}/timeline")[1]
weaving = next(s for s in timeline["stages"] if s["stage"] == "WEAVING")
original = next(i for i in weaving["inspections"] if i["inspectionId"] == fid)
check("the original failed inspection is still there, unchanged, and linked to its reinspection",
      original["status"] == "FAILED" and original["defectSeverity"] == "HIGH" and original["affectedMeters"] == 60
      and original["reinspectedBy"] == [second["inspectionId"]], original)
check("timeline groups inspections by stage in time order", [i["inspectionType"] for i in weaving["inspections"]]
      == ["FIRST_OFF", "STAGE", "REINSPECTION"], [i["inspectionType"] for i in weaving["inspections"]])

# ------------------------------------------------------------------ 7 carry on to final QC
heading("7. The order continues stage by stage")
moved = need(call("manager", "POST", f"/api/orders/{oid}/stage/advance"), "advance to PROCESSING")
check("order status follows the stage (old status words kept)", moved["currentStage"] == "PROCESSING" and moved["status"] == "DYEING", moved)
for stage, nxt in [("PROCESSING", "FINISHING"), ("FINISHING", "FINAL_QC")]:
    need(call("manager", "POST", f"/api/orders/{oid}/stage/complete"), f"{stage} completed, waits for QC")
    check(f"{stage} cannot advance before QC passes (409)", call("manager", "POST", f"/api/orders/{oid}/stage/advance")[0] == 409)
    need(call("qc", "POST", "/api/quality", {"orderId": oid, "status": "PASSED"}), f"QC worker passes {stage}")
    need(call("manager", "POST", f"/api/orders/{oid}/stage/advance"), f"advance to {nxt}")
order = order_of(oid)
check("order is at FINAL_QC waiting for the final inspection", order["currentStage"] == "FINAL_QC" and order["pendingInspectionType"] == "FINAL", order)

heading("8. Fabric passport is final only after a passed final inspection")
final_fail = need(call("qc", "POST", "/api/quality", {"orderId": oid, "status": "FAILED", "defectType": "Shade variation",
                  "defectSeverity": "LOW", "affectedMeters": 10, "shift": "A"}), "QC worker records FINAL FAILED (LOW)")
roll = final_fail["rollId"]
passport = call(None, "GET", f"/api/passport/{roll}")[1]
check("passport says pending before the final inspection has passed", passport["final"] is False and passport["qualityStatus"] == "PENDING"
      and passport["defects"] == [], passport)
check("passport never contains costs", not any(w in k.lower() for k in passport for w in ("cost", "profit", "margin", "wage", "loss")))
need(call("qc", "PATCH", f"/api/quality/{final_fail['inspectionId']}/corrective-action", {"correctiveAction": "REWORK_CURRENT_STAGE"}),
     "corrective action recorded")
need(call("qc", "POST", "/api/quality", {"orderId": oid, "inspectionType": "REINSPECTION", "reinspectionOf": final_fail["inspectionId"],
     "status": "PASSED"}), "FINAL reinspection PASSED")
passport = call(None, "GET", f"/api/passport/{roll}")[1]
check("passport is final and PASSED", passport["final"] is True and passport["qualityStatus"] == "PASSED", passport)
need(call("manager", "POST", f"/api/orders/{oid}/stage/advance"), "advance to DISPATCH")
done = need(call("manager", "POST", f"/api/orders/{oid}/stage/complete"), "DISPATCH completed")
check("order is dispatched", done["status"] == "DISPATCHED", done)

# ------------------------------------------------------------------ 9 buyer and owner views
heading("9. Buyer view shows only safe wording")
buyer = call(None, "GET", f"/api/buyer/track/{token}")[1]
text = json.dumps(buyer).lower()
check("buyer sees 'Quality approved'", buyer["qualityMessage"] == "Quality approved", buyer["qualityMessage"])
check("buyer view has no worker, wage, machine, defect, loss or profit data", not any(
      w in text for w in ("weft", "shade", "wage", "profit", "margin", "supplier", "qc@", "manager@", "w05", "severity", "cost")), text)
print(f"      buyer sees: {buyer['currentStage']}, {buyer['qualityMessage']}")

heading("10. Owner: quality analytics and the seeded demo orders")
stats = call("owner", "GET", "/api/quality/analytics")[1]
check("owner gets quality analytics", {"totalInspections", "passRate", "totalQualityLoss", "ordersOnQualityHold"} <= set(stats), stats)
print(f"      {stats['totalInspections']} inspections this month, pass rate {stats['passRate']}%, quality loss {money(stats['totalQualityLoss'])}, "
      f"worst stage {stats['highestLossStage']}, orders on hold {stats['ordersOnQualityHold']}")
orders = {o["orderId"]: o for o in call("owner", "GET", "/api/orders")[1]}
demo = [orders.get(i) for i in ("ORD109", "ORD110", "ORD111")]
if all(demo):
    a, b, c = demo
    for label, o in zip("ABC", demo):
        print(f"      Order {label} {o['orderId']}: stage {o['currentStage']} ({o['stageStatus']}), quality loss {money(o['costs']['rework'])}, margin {o['margin']}%")
    check("seeded order margins: A normal, B lower, C lowest", a["margin"] > b["margin"] > c["margin"], [x["margin"] for x in demo])
    check("seeded order C is on hold after a CRITICAL failure", c["stageStatus"] == "QUALITY_HOLD" and c["qualityHold"]["defectSeverity"] == "CRITICAL")
else:
    print("      (seeded demo orders ORD109 to ORD111 not found: run python -m app.seed to load them)")

finish()

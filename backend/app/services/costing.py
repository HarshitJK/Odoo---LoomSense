"""Order costing.

True Order Cost = rawMaterial + labour + machine + rework + other

- labour   = sum(hoursWorked x rate) + sum(overtimeHours x rate x 1.5)
- machine  = hours the machine ran for the order x machine costPerHour
             (hours = producedMeters / productionRate)
- rawMaterial = yarn consumed (kg) x costPerKg of the order's yarn batch
             (yarn kg defaults to 0.59 kg per metre produced)
- rework   = sum of reworkCost of the order's quality checks
"""
from app import database as dbm
from app.config import OVERTIME_MULTIPLIER, YARN_KG_PER_METRE

NO_ID = {"_id": 0}
COST_KEYS = ("rawMaterial", "labour", "machine", "rework", "other")


class OrderNotFound(LookupError):
    pass


def get_order(order_id: str) -> dict:
    order = dbm.orders().find_one({"orderId": order_id}, NO_ID)
    if not order:
        raise OrderNotFound(f"Order {order_id} not found")
    return order


# ---------- pure calculations (no database) ----------

def calculate_labour_cost(attendance_records: list, hourly_rates: dict) -> dict:
    """Labour cost from attendance records. hourly_rates is {workerId: rate}."""
    regular = overtime = hours = 0.0
    workers = set()
    for rec in attendance_records:
        rate = hourly_rates.get(rec["workerId"], 0)
        regular += rec.get("hoursWorked", 0) * rate
        overtime += rec.get("overtimeHours", 0) * rate * OVERTIME_MULTIPLIER
        hours += rec.get("hoursWorked", 0) + rec.get("overtimeHours", 0)
        workers.add(rec["workerId"])
    return {
        "regular": round(regular, 2),
        "overtime": round(overtime, 2),
        "total": round(regular + overtime, 2),
        "hours": round(hours, 2),
        "workers": len(workers),
    }


def calculate_machine_cost(runtime_hours: float, cost_per_hour: float) -> float:
    return round(runtime_hours * cost_per_hour, 2)


def calculate_raw_material_cost(kg_used: float, cost_per_kg: float) -> float:
    return round(kg_used * cost_per_kg, 2)


def calculate_true_order_cost(costs: dict) -> float:
    return round(sum(costs.get(k, 0) for k in COST_KEYS), 2)


# ---------- database-backed helpers ----------

def hourly_rates() -> dict:
    return {w["workerId"]: w["hourlyRate"] for w in dbm.workers().find({}, NO_ID)}


def yarn_price(order: dict) -> float:
    """costPerKg of the order's yarn batch; falls back to stock matching fabric + colour."""
    if order.get("yarnBatch"):
        batch = dbm.inventory().find_one({"batchId": order["yarnBatch"]}, NO_ID)
        if batch:
            return batch["costPerKg"]
    batches = matching_batches(order.get("fabricType"), order.get("colour"))
    total_kg = sum(b["quantityKg"] for b in batches)
    if not total_kg:
        return 0.0
    return sum(b["quantityKg"] * b["costPerKg"] for b in batches) / total_kg


def matching_batches(fabric_type, colour) -> list:
    """Inventory batches whose material is '<fabricType> Yarn' and whose colour matches."""
    material = f"{fabric_type or ''} Yarn".lower()
    colour = (colour or "").lower()
    return [
        b for b in dbm.inventory().find({}, NO_ID)
        if (b.get("material") or "").lower() == material
        and (b.get("colour") or "").lower() == colour
    ]


def machine_hours(order: dict) -> list:
    """[(machineId, hours, costPerHour)] for the machines that ran this order.

    Machines currently assigned to the order count their own producedMeters / productionRate.
    If none is assigned (finished order), use the order's machine and producedMeters.
    """
    runs = []
    for m in dbm.machines().find({"currentOrderId": order["orderId"]}, NO_ID):
        if m.get("productionRate"):
            runs.append((m["machineId"], m["producedMeters"] / m["productionRate"], m["costPerHour"]))
    if not runs and order.get("machineId"):
        m = dbm.machines().find_one({"machineId": order["machineId"]}, NO_ID)
        if m and m.get("productionRate"):
            runs.append((m["machineId"], order.get("producedMeters", 0) / m["productionRate"], m["costPerHour"]))
    return runs


def calculate_order_cost(order_id: str) -> dict:
    """All five cost components, total cost, labour hours and worker count for one order."""
    order = get_order(order_id)

    yarn_kg = order.get("yarnConsumedKg")
    if yarn_kg is None:
        yarn_kg = YARN_KG_PER_METRE * order.get("producedMeters", 0)
    raw = calculate_raw_material_cost(yarn_kg, yarn_price(order))

    attendance = list(dbm.attendance().find({"orderId": order_id}, NO_ID))
    labour = calculate_labour_cost(attendance, hourly_rates())

    runs = machine_hours(order)
    machine = round(sum(calculate_machine_cost(h, c) for _, h, c in runs), 2)

    rolls = dbm.quality_checks().find({"orderId": order_id}, NO_ID)
    rework = round(sum(r.get("reworkCost", 0) for r in rolls), 2)

    costs = {
        "rawMaterial": raw,
        "labour": labour["total"],
        "machine": machine,
        "rework": rework,
        "other": round(order.get("otherCost", 0), 2),
    }
    return {
        "orderId": order_id,
        "costs": costs,
        "totalCost": calculate_true_order_cost(costs),
        "labourHours": labour["hours"],
        "workerCount": labour["workers"],
        "overtimeCost": labour["overtime"],
        "regularLabourCost": labour["regular"],
        "yarnConsumedKg": round(yarn_kg, 2),
        "machineHours": round(sum(h for _, h, _ in runs), 2),
    }


def wages_summary(month: str) -> dict:
    """Wages paid for attendance in a month (YYYY-MM), plus labour cost per order."""
    records = list(dbm.attendance().find({"date": {"$regex": f"^{month}"}}, NO_ID))
    rates = hourly_rates()
    total = calculate_labour_cost(records, rates)

    per_order = []
    for order_id in sorted({r["orderId"] for r in records if r.get("orderId")}):
        part = calculate_labour_cost([r for r in records if r.get("orderId") == order_id], rates)
        per_order.append({
            "orderId": order_id,
            "workersInvolved": part["workers"],
            "labourHours": part["hours"],
            "labourCost": part["total"],
        })
    return {
        "month": month,
        "totalRegularWages": total["regular"],
        "totalOvertimePay": total["overtime"],
        "totalWorkforceCost": total["total"],
        "labourCostPerOrder": per_order,
    }

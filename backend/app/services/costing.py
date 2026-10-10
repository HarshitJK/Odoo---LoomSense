"""Order costing.

True Order Cost = rawMaterial + labour + machine + rework + other

- labour   = sum(hoursWorked x rate) + sum(overtimeHours x rate x 1.5)
- machine  = hours the machine ran for the order x machine costPerHour
             (hours = producedMeters / productionRate)
- rawMaterial = yarn consumed (kg) x costPerKg of the order's yarn batch
             (yarn kg defaults to 0.59 kg per metre produced)
- rework   = sum of reworkCost of the order's quality checks

Speed: functions that need several collections take an optional `data` dict from
load_data(). Code that handles many orders (dashboard, trend) loads once and passes it
along, so a request costs about 7 database queries instead of ~10 per order.
"""
from app import database as dbm
from app.config import (
    OVERTIME_MULTIPLIER, REWORK_LABOUR_PER_METRE, REWORK_MACHINE_PER_METRE,
    REWORK_MATERIAL_LOSS_SHARE, YARN_KG_PER_METRE,
)

NO_ID = {"_id": 0}
COST_KEYS = ("rawMaterial", "labour", "machine", "rework", "other")


class OrderNotFound(LookupError):
    pass


# ---------- loading ----------

def load_data(order_id: str = None) -> dict:
    """Everything the costing code reads, in 7 queries. With order_id, order-level
    collections (orders, attendance, quality, payments) are limited to that order."""
    one = {"orderId": order_id} if order_id else {}
    return {
        "productionEvents": list(dbm.db.machineProductionEvents.find(one, NO_ID)),
        "consumption": list(dbm.db.materialConsumption.find(one, NO_ID)),
        "orders": list(dbm.orders().find(one, NO_ID).sort("orderId", 1)),
        "attendance": list(dbm.attendance().find(one, NO_ID)),
        "rates": hourly_rates(),
        "machines": list(dbm.machines().find({}, NO_ID)),
        "rolls": list(dbm.quality_checks().find(one, NO_ID)),
        "batches": list(dbm.inventory().find({}, NO_ID)),
        "transactions": list(dbm.transactions().find({**one, "type": "BUYER_PAYMENT"}, NO_ID)),
    }


def get_order(order_id: str, data: dict = None) -> dict:
    if data is not None:
        order = next((o for o in data["orders"] if o["orderId"] == order_id), None)
    else:
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
        rate = rec.get("hourlyRate", hourly_rates.get(rec.get("workerId"), 0))  # unknown worker counts as 0
        regular += rec.get("hoursWorked", 0) * rate
        overtime += rec.get("overtimeHours", 0) * rate * OVERTIME_MULTIPLIER
        hours += rec.get("hoursWorked", 0) + rec.get("overtimeHours", 0)
        workers.add(rec.get("workerId"))
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


def calculate_rework_impact(affected_meters: float, cost_per_kg: float) -> dict:
    """Financial impact of reworking/scrapping `affected_meters` of fabric."""
    labour = round(affected_meters * REWORK_LABOUR_PER_METRE, 2)
    machine = round(affected_meters * REWORK_MACHINE_PER_METRE, 2)
    material = round(affected_meters * YARN_KG_PER_METRE * cost_per_kg * REWORK_MATERIAL_LOSS_SHARE, 2)
    return {
        "additionalLabour": labour,
        "machineCost": machine,
        "materialLoss": material,
        "total": round(labour + machine + material, 2),
    }


def calculate_true_order_cost(costs: dict) -> float:
    return round(sum(costs.get(k, 0) for k in COST_KEYS), 2)


# ---------- helpers that read data ----------

def hourly_rates() -> dict:
    return {w["workerId"]: w.get("hourlyRate", 0) for w in dbm.workers().find({}, NO_ID)}


def matching_batches(fabric_type, colour, data: dict = None) -> list:
    """Inventory batches whose material is '<fabricType> Yarn' and whose colour matches."""
    batches = data["batches"] if data else list(dbm.inventory().find({}, NO_ID))
    material = f"{fabric_type or ''} Yarn".lower()
    colour = (colour or "").lower()
    return [
        b for b in batches
        if (b.get("material") or "").lower() == material and (b.get("colour") or "").lower() == colour
    ]


def yarn_price(order: dict, data: dict = None) -> float:
    """costPerKg of the order's yarn batch; falls back to stock matching fabric + colour."""
    if order.get("yarnBatch"):
        if data:
            batch = next((b for b in data["batches"] if b["batchId"] == order["yarnBatch"]), None)
        else:
            batch = dbm.inventory().find_one({"batchId": order["yarnBatch"]}, NO_ID)
        if batch:
            return batch["costPerKg"]
    batches = matching_batches(order.get("fabricType"), order.get("colour"), data)
    total_kg = sum(b["quantityKg"] for b in batches)
    if not total_kg:
        return 0.0
    return sum(b["quantityKg"] * b["costPerKg"] for b in batches) / total_kg


def machine_hours(order: dict, data: dict) -> list:
    """[(machineId, hours, costPerHour)] for the machines that ran this order.

    Machines currently assigned to the order count their own producedMeters / productionRate.
    If none is assigned (finished order), use the order's machine and producedMeters.
    """
    history = [e for e in data.get("productionEvents", []) if e.get("orderId") == order["orderId"]]
    if order.get("productionHistoryComplete"):
        return [(e["machineId"], e.get("runtimeMinutes", 0) / 60,
                 e.get("machineCost", 0) / (e["runtimeMinutes"] / 60) if e.get("runtimeMinutes") else 0) for e in history]
    runs = []
    for m in data["machines"]:
        if m.get("currentOrderId") == order["orderId"] and m.get("productionRate"):
            runs.append((m["machineId"], m.get("producedMeters", 0) / m["productionRate"], m.get("costPerHour", 0)))
    if not runs and order.get("machineId"):
        m = next((x for x in data["machines"] if x["machineId"] == order["machineId"]), None)
        if m and m.get("productionRate"):
            runs.append((m["machineId"], order.get("producedMeters", 0) / m["productionRate"], m.get("costPerHour", 0)))
    return runs


def calculate_order_cost(order_id: str, data: dict = None) -> dict:
    """All five cost components, total cost, labour hours and worker count for one order."""
    data = data or load_data(order_id)
    order = get_order(order_id, data)

    yarn_kg = order.get("yarnConsumedKg")
    if yarn_kg is None:
        yarn_kg = YARN_KG_PER_METRE * order.get("producedMeters", 0)
    raw = calculate_raw_material_cost(yarn_kg, yarn_price(order, data))

    consumption = [c for c in data.get("consumption", []) if c.get("orderId") == order_id]
    if order.get("materialHistoryComplete"):
        raw = round(sum(c["cost"] for c in consumption), 2)
        yarn_kg = sum(c["quantityKg"] for c in consumption)
    attendance = [a for a in data["attendance"] if a.get("orderId") == order_id]
    labour = calculate_labour_cost(attendance, data["rates"])

    runs = machine_hours(order, data)
    machine = round(sum(calculate_machine_cost(h, c) for _, h, c in runs), 2)

    rework = round(sum(r.get("reworkCost", 0) for r in data["rolls"] if r.get("orderId") == order_id), 2)

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
    """Wages paid for attendance in a month (YYYY-MM), plus labour cost per order.

    `month` must already be validated as YYYY-MM by the caller.
    """
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

"""Activity-dated management books. Never group lifetime orders by orderDate.

Expenses are incurred costs, not evidence of bank disbursement. Supplier cash paid
is reported separately; the netCashResult compatibility name is a management balance.
"""
from app import database as dbm
from app.services import costing, profitability
from app.utils.validation import valid_month


def in_month(record, field, month):
    return str(record.get(field) or "").startswith(month + "-")


def machine_summary(month, events=None, machines=None):
    month = valid_month(month)
    events = list(dbm.db.machineProductionEvents.find({}, {"_id": 0})) if events is None else events
    machines = list(dbm.machines().find({}, {"_id": 0})) if machines is None else machines
    rows = {m["machineId"]: {"machineId": m["machineId"], "machineName": m.get("name", m["machineId"]),
            "producedMeters": 0, "runtimeHours": 0, "ordersWorked": set(), "machineCost": 0,
            "efficiencyHours": 0} for m in machines}
    for e in events:
        if not in_month(e, "timestamp", month):
            continue
        row = rows.setdefault(e["machineId"], {"machineId": e["machineId"], "machineName": e["machineId"],
            "producedMeters": 0, "runtimeHours": 0, "ordersWorked": set(), "machineCost": 0, "efficiencyHours": 0})
        hours = e.get("runtimeMinutes", 0) / 60
        row["producedMeters"] += e.get("producedMetersDelta", 0)
        row["runtimeHours"] += hours
        row["machineCost"] += e.get("machineCost", 0)
        row["efficiencyHours"] += e.get("efficiencyMinutes", e.get("efficiency", 0) * hours * 60) / 60
        if e.get("orderId"):
            row["ordersWorked"].add(e["orderId"])
    for row in rows.values():
        row["averageEfficiency"] = round(row.pop("efficiencyHours") / row["runtimeHours"], 3) if row["runtimeHours"] else 0
        row["ordersWorked"] = sorted(row["ordersWorked"])
        for key in ("producedMeters", "runtimeHours", "machineCost"):
            row[key] = round(row[key], 2)
    return list(rows.values())


def report(month):
    month = valid_month(month)
    data = costing.load_data()
    events = list(dbm.db.machineProductionEvents.find({"timestamp": {"$regex": f"^{month}-"}}, {"_id": 0}))
    purchases = list(dbm.db.materialPurchases.find({}, {"_id": 0}))
    expenses = list(dbm.db.operatingExpenses.find({"date": {"$regex": f"^{month}-"}}, {"_id": 0}))
    attendance = [r for r in data["attendance"] if in_month(r, "date", month)]
    payments = [r for r in data["transactions"] if r.get("type") == "BUYER_PAYMENT" and in_month(r, "date", month)]
    quality = [r for r in data["rolls"] if in_month(r, "date", month)]
    wages = costing.calculate_labour_cost(attendance, data["rates"])
    machines = machine_summary(month, events, data["machines"])
    active = {r.get("orderId") for r in events + attendance + payments + quality + expenses} - {None}
    profits = [p for p in profitability.all_order_profits(data) if p["orderId"] in active]
    orders = {o["orderId"]: o for o in data["orders"]}
    production_value = sum(e.get("producedMetersDelta", 0) * orders.get(e.get("orderId"), {}).get("revenue", 0)
                           / (orders.get(e.get("orderId"), {}).get("quantityMeters") or 1) for e in events)
    result = {"month": month, "buyerPaymentsReceived": round(sum(p["amount"] for p in payments), 2),
        "rawMaterialBills": round(sum(p["totalAmount"] for p in purchases if in_month(p, "purchaseDate", month)), 2),
        "supplierPaymentsMade": round(sum(p["amount"] for bill in purchases for p in bill.get("payments", []) if in_month(p, "date", month)), 2),
        "workerWages": wages["total"], "machineOperatingCost": round(sum(m["machineCost"] for m in machines), 2),
        "reworkCost": round(sum(q.get("reworkCost", 0) for q in quality), 2),
        "otherExpenses": round(sum(e["amount"] for e in expenses), 2),
        "productionValue": round(production_value, 2), "machineProduction": machines, "orderProfitability": profits,
        "wageSummary": {"regularWages": wages["regular"], "overtime": wages["overtime"], "totalWorkforceCost": wages["total"]},
        "productionOverview": {"producedMeters": round(sum(e.get("producedMetersDelta", 0) for e in events), 2),
            "totalOrders": len(active), "completedOrders": len({e["orderId"] for e in events if e.get("completed")})},
        "accountingBasis": "Buyer cash received less bills and operating costs incurred. Wages, machine and rework costs are accrued estimates, not bank payments. Order profits are lifetime totals for orders active this month."}
    result["totalCashIn"] = result["buyerPaymentsReceived"]
    result["totalExpenses"] = round(sum(result[k] for k in ("rawMaterialBills", "workerWages", "machineOperatingCost", "reworkCost", "otherExpenses")), 2)
    result["netCashResult"] = round(result["totalCashIn"] - result["totalExpenses"], 2)
    return result

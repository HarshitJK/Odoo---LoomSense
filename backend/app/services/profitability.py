"""Profit, margin, monthly trend and profit-leakage logic.

Profit = revenue - true order cost.  Margin % = profit / revenue x 100.
Contract revenue remains available; profit and margin use earned revenue for incomplete
orders. Monthly totals use dated production events.

Functions that look at many orders take an optional `data` dict (see costing.load_data)
so one request does not repeat the same database queries for every order.
"""
from datetime import date

from app import database as dbm
from app.config import DEMO_MONTH, EXPECTED_MARGIN, TARGET_MARGIN, YARN_KG_PER_METRE
from app.services import costing

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def calculate_profit(revenue: float, true_cost: float) -> float:
    return round(revenue - true_cost, 2)


def calculate_margin(revenue: float, profit: float) -> float:
    """Margin % rounded to 1 decimal; 0 when there is no revenue."""
    return round(profit / revenue * 100, 1) if revenue else 0.0


def order_profit(order_id: str, data: dict = None) -> dict:
    data = data or costing.load_data(order_id)
    order = costing.get_order(order_id, data)
    cost = costing.calculate_order_cost(order_id, data)
    revenue = order.get("revenue", 0)
    paid = round(sum(t["amount"] for t in data["transactions"] if t.get("orderId") == order_id), 2)
    quantity = order.get("quantityMeters", 0)
    progress = round(order.get("producedMeters", 0) / quantity * 100, 1) if quantity else 0.0
    earned = round(revenue * min(order.get("producedMeters", 0) / quantity, 1), 2) if quantity else 0
    profit = calculate_profit(earned, cost["totalCost"])
    margin = calculate_margin(earned, profit)
    cancelled = order.get("status") == "CANCELLED"
    result = {
        "orderId": order_id,
        "buyerName": order.get("buyerName"),
        "status": order.get("status"),
        "orderDate": order.get("orderDate"),
        "revenue": revenue,
        "earnedRevenue": earned,
        "costs": cost["costs"],
        "totalCost": cost["totalCost"],
        "profit": profit,
        "margin": margin,
        "paidAmount": paid,
        "pendingAmount": 0 if cancelled else round(max(revenue - paid, 0), 2),
        "targetMargin": TARGET_MARGIN,
        "belowTarget": bool(revenue) and margin < TARGET_MARGIN,
        "progressPercent": progress,
        "provisional": progress < 100 or cancelled,  # a cancelled order is never completed revenue
        "labourHours": cost["labourHours"],
        "workerCount": cost["workerCount"],
        "cancelled": cancelled,
    }
    if cancelled:
        result["cancellation"] = cancellation_summary(order, revenue, earned, cost["totalCost"], data)
    return result


def cancellation_summary(order: dict, revenue: float, earned: float, total_cost: float, data: dict) -> dict:
    """What a cancelled order lost. Recoverable material is only yarn explicitly returned to stock."""
    recoverable = round(sum(r.get("value", 0) for r in data.get("materialReturns", []) if r.get("orderId") == order["orderId"]), 2)
    return {"estimatedOrderValue": revenue, "earnedRevenue": earned, "actualCostIncurred": total_cost,
            "recoverableMaterialValue": recoverable, "writeOffLoss": round(max(total_cost - recoverable, 0), 2),
            "stoppedAtStage": order.get("cancelledAtStage"), "producedMeters": order.get("producedMeters", 0),
            "cancelledAt": order.get("cancelledAt"), "cancelledBy": order.get("cancelledBy"), "reason": order.get("cancelReason")}


def refresh_order(order_id: str) -> dict:
    """Recompute costs, profit and margin and store them on the order document."""
    p = order_profit(order_id)
    dbm.orders().update_one(
        {"orderId": order_id},
        {"$set": {"costs": p["costs"], "profit": p["profit"], "margin": p["margin"],
                  "paidAmount": p["paidAmount"]}},
    )
    return p


def all_order_profits(data: dict = None) -> list:
    data = data or costing.load_data()
    return [order_profit(o["orderId"], data) for o in data["orders"]]


def _earned_revenue(p: dict) -> float:
    """Revenue counted in monthly totals: full for finished orders, pro-rata to progress otherwise."""
    return p["revenue"] * p["progressPercent"] / 100 if p["provisional"] else p["revenue"]


def _summarise(profits: list) -> dict:
    revenue = round(sum(_earned_revenue(p) for p in profits), 2)
    breakdown = {k: round(sum(p["costs"][k] for p in profits), 2) for k in costing.COST_KEYS}
    total_cost = round(sum(breakdown.values()), 2)
    profit = calculate_profit(revenue, total_cost)
    return {
        "revenue": revenue,
        "totalCost": total_cost,
        "profit": profit,
        "margin": calculate_margin(revenue, profit),
        "costBreakdown": breakdown,
        "orderCount": len(profits),
    }


def month_label(month: str) -> str:
    return f"{MONTH_NAMES[int(month[5:7]) - 1]} {month[:4]}"


def monthly_summary(month: str, profits: list = None) -> dict:
    """Earned production value less dated consumption and incurred costs."""
    from app.services.month_end import report, in_month
    r = report(month)
    consumption = dbm.db.materialConsumption.find({}, {"_id": 0})
    breakdown = {"rawMaterial": round(sum(c.get("cost", 0) for c in consumption if in_month(c, "date", month)), 2),
        "labour": r["workerWages"], "machine": r["machineOperatingCost"],
        "rework": r["reworkCost"], "other": r["otherExpenses"]}
    cost = round(sum(breakdown.values()), 2)
    revenue = r["productionValue"]
    profit = calculate_profit(revenue, cost)
    return {"month": month, "label": month_label(month), "revenue": revenue,
        "totalCost": cost, "profit": profit,
        "margin": calculate_margin(revenue, profit) if r["productionOverview"]["producedMeters"] > 0 else None,
        "note": None if r["productionOverview"]["producedMeters"] > 0 else "No production recorded this month",
        "orderCount": r["productionOverview"]["totalOrders"], "costBreakdown": breakdown}


def last_months(count: int = 4, today: date = None) -> list:
    today = today or (date.fromisoformat(DEMO_MONTH + "-01") if DEMO_MONTH else date.today())
    year, month = today.year, today.month
    months = []
    for _ in range(count):
        months.append(f"{year}-{month:02d}")
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return months[::-1]


def monthly_trend(profits: list = None) -> list:
    trend = []
    for month in last_months(4):
        part = monthly_summary(month)
        trend.append({"month": month, "label": month_label(month), "revenue": part["revenue"],
                      "cost": part["totalCost"], "profit": part["profit"], "margin": part["margin"]})
    return trend


def lowest_margin_order_id(profits: list = None):
    """Lowest-margin order that has finished production (in-progress margins are provisional)."""
    profits = all_order_profits() if profits is None else profits
    done = [p for p in profits if not p["provisional"] and p["revenue"]]
    if not done:
        return None
    return min(done, key=lambda p: p["margin"])["orderId"]


def profit_leakage(order_id: str, data: dict = None) -> dict:
    """Compare an order's cost lines with a benchmark and explain where profit leaked.

    Benchmarks (per metre produced): yarn = 0.59 kg/m at the batch price; labour = average
    labour hours per metre of the other orders at this order's own average wage; rework = 0.
    """
    data = data or costing.load_data()
    order = costing.get_order(order_id, data)
    p = order_profit(order_id, data)
    cost = costing.calculate_order_cost(order_id, data)
    meters = order.get("producedMeters") or order.get("quantityMeters", 0)

    leaks = []

    # 1. Excess yarn
    expected_kg = YARN_KG_PER_METRE * meters
    excess_yarn = (cost["yarnConsumedKg"] - expected_kg) * costing.yarn_price(order, data)
    if excess_yarn > 0:
        leaks.append({"label": "Excess yarn consumption", "amount": round(excess_yarn, 2)})

    # 2. Labour hours / overtime
    others = []
    for o in data["orders"]:
        if o["orderId"] == order_id or o.get("producedMeters", 0) <= 0:
            continue
        hours = costing.calculate_order_cost(o["orderId"], data)["labourHours"]
        if hours:
            others.append(hours / o["producedMeters"])
    if others and cost["labourHours"]:
        expected_hours = sum(others) / len(others) * meters
        overtime_hours = sum(a.get("overtimeHours", 0) for a in data["attendance"] if a.get("orderId") == order_id)
        regular_hours = cost["labourHours"] - overtime_hours
        avg_rate = cost["regularLabourCost"] / regular_hours if regular_hours else 0
        overrun = cost["costs"]["labour"] - expected_hours * avg_rate
        if overrun > 0:
            overtime = min(cost["overtimeCost"], overrun)
            if overtime > 0:
                leaks.append({"label": "Overtime", "amount": round(overtime, 2)})
            if overrun - overtime > 1:
                leaks.append({"label": "Extra labour hours", "amount": round(overrun - overtime, 2)})

    # 3. Rework and quality failures. Stage-gated inspections give one line per cost part (they replace the
    #    single Rework line, so nothing is counted twice); old rolls keep their one Rework line.
    from app.services import quality_gate  # imported here: quality_gate imports this module
    legacy_rework = round(sum(r.get("reworkCost", 0) for r in data["rolls"]
                              if r.get("orderId") == order_id and not r.get("inspectionType")), 2)
    if legacy_rework > 0:
        leaks.append({"label": "Rework", "amount": legacy_rework})
    leaks.extend(quality_gate.leakage_entries(order_id, data["rolls"]))

    leaks.sort(key=lambda leak: leak["amount"], reverse=True)
    machine_id = _worst_machine(order, data)
    return {
        "orderId": order_id,
        "buyerName": order.get("buyerName"),
        "expectedMargin": EXPECTED_MARGIN,
        "actualMargin": p["margin"],
        "leaks": leaks,
        "totalLeakage": round(sum(leak["amount"] for leak in leaks), 2),
        "machineId": machine_id,
        "recommendation": _recommendation(leaks, machine_id),
    }


def _worst_machine(order: dict, data: dict):
    """Machine with the most rework cost on this order, else the order's own machine."""
    by_machine = {}
    for r in data["rolls"]:
        if r.get("orderId") == order["orderId"] and r.get("machineId"):
            by_machine[r["machineId"]] = by_machine.get(r["machineId"], 0) + costing.quality_loss(r)
    if by_machine and max(by_machine.values()) > 0:
        return max(by_machine, key=by_machine.get)
    return order.get("machineId")


def _recommendation(leaks: list, machine_id) -> str:
    labels = {leak["label"] for leak in leaks}
    steps = []
    if "Excess yarn consumption" in labels:
        steps.append("review yarn wastage")
    if "Overtime" in labels or "Extra labour hours" in labels:
        steps.append("reduce overtime")
    quality = {}
    for leak in leaks:
        if leak.get("type") == "QUALITY_FAILURE":
            quality[leak["stage"]] = quality.get(leak["stage"], 0) + leak["amount"]
    if "Rework" in labels or quality:
        steps.append(f"inspect Machine {machine_id}" if machine_id else "inspect the machine causing defects")
    if quality:
        from app.services.quality_gate import STAGE_LABEL
        steps.append(f"check quality earlier at {STAGE_LABEL.get(max(quality, key=quality.get), 'the failing stage').lower()}")
    if not steps:
        return "No significant profit leakage found."
    text = ", ".join(steps[:-1]) + (" and " if len(steps) > 1 else "") + steps[-1]
    return text[0].upper() + text[1:] + "."

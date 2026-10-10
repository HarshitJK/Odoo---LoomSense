"""Profit, margin, monthly trend and profit-leakage logic.

Profit = revenue - true order cost.  Margin % = profit / revenue x 100.
Per-order revenue is the full contract revenue; cost is what has been spent so far, so an
order still in production (`provisional: true`) shows a flattering margin. Monthly totals
therefore count revenue for in-progress orders pro-rata to their progress.

Functions that look at many orders take an optional `data` dict (see costing.load_data)
so one request does not repeat the same database queries for every order.
"""
from datetime import date

from app import database as dbm
from app.config import EXPECTED_MARGIN, TARGET_MARGIN, YARN_KG_PER_METRE
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
    profit = calculate_profit(revenue, cost["totalCost"])
    margin = calculate_margin(revenue, profit)
    paid = round(sum(t["amount"] for t in data["transactions"] if t.get("orderId") == order_id), 2)
    quantity = order.get("quantityMeters", 0)
    progress = round(order.get("producedMeters", 0) / quantity * 100, 1) if quantity else 0.0
    return {
        "orderId": order_id,
        "buyerName": order.get("buyerName"),
        "status": order.get("status"),
        "orderDate": order.get("orderDate"),
        "revenue": revenue,
        "costs": cost["costs"],
        "totalCost": cost["totalCost"],
        "profit": profit,
        "margin": margin,
        "paidAmount": paid,
        "pendingAmount": round(max(revenue - paid, 0), 2),
        "targetMargin": TARGET_MARGIN,
        "belowTarget": bool(revenue) and margin < TARGET_MARGIN,
        "progressPercent": progress,
        "provisional": progress < 100,
        "labourHours": cost["labourHours"],
        "workerCount": cost["workerCount"],
    }


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
    """Compatibility adapter over activity-dated books; profits is ignored."""
    from app.services.month_end import report
    r = report(month)
    return {"month": month, "label": month_label(month), "revenue": r["totalCashIn"],
        "totalCost": r["totalExpenses"], "profit": r["netCashResult"],
        "margin": calculate_margin(r["totalCashIn"], r["netCashResult"]),
        "orderCount": r["productionOverview"]["totalOrders"],
        "costBreakdown": {"rawMaterial": r["rawMaterialBills"], "labour": r["workerWages"],
            "machine": r["machineOperatingCost"], "rework": r["reworkCost"], "other": r["otherExpenses"]}}


def last_months(count: int = 4, today: date = None) -> list:
    today = today or date.today()
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

    # 3. Rework
    if cost["costs"]["rework"] > 0:
        leaks.append({"label": "Rework", "amount": cost["costs"]["rework"]})

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
            by_machine[r["machineId"]] = by_machine.get(r["machineId"], 0) + r.get("reworkCost", 0)
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
    if "Rework" in labels:
        steps.append(f"inspect Machine {machine_id}" if machine_id else "inspect the machine causing defects")
    if not steps:
        return "No significant profit leakage found."
    text = ", ".join(steps[:-1]) + (" and " if len(steps) > 1 else "") + steps[-1]
    return text[0].upper() + text[1:] + "."

"""Read-only demo checks: python -m app.data_checks (non-zero means anomalies)."""
import math
from app import database as dbm
from app.routes.finance import finance_dashboard
from app.services import costing, machine_simulator, profitability


def numeric_anomalies(value, path="dashboard"):
    issues = []
    if isinstance(value, dict):
        for key, item in value.items():
            issues.extend(numeric_anomalies(item, f"{path}.{key}"))
    elif isinstance(value, list):
        for i, item in enumerate(value):
            issues.extend(numeric_anomalies(item, f"{path}[{i}]"))
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        if not math.isfinite(value) or value < 0:
            issues.append(f"{path}: invalid numeric value {value}")
    return issues


def check_data():
    """Return actionable anomalies without repairing or hiding existing records.

    Historic inspections before a recorded dispatch are valid. A dispatched order
    without a dispatch timestamp cannot establish that chronology and is flagged.
    Negative dashboard figures are flagged for review, never silently clamped.
    """
    issues = []
    data = costing.load_data()
    orders = {o["orderId"]: o for o in data["orders"]}
    for m in data["machines"]:
        if m["status"] == "RUNNING" and not machine_simulator.incomplete(orders.get(m.get("currentOrderId"))):
            issues.append(f"Machine {m['machineId']}: RUNNING without an incomplete order")
        if m.get("runtimeToday", 0) > 24:
            issues.append(f"Machine {m['machineId']}: runtimeToday exceeds 24 hours")
    for o in data["orders"]:
        if o.get("producedMeters", 0) > o.get("quantityMeters", 0):
            issues.append(f"Order {o['orderId']}: producedMeters exceeds quantityMeters")
        issues.extend(numeric_anomalies(o.get("costs", {}), f"Order {o['orderId']}.costs"))
        costs = costing.calculate_order_cost(o["orderId"], data)["costs"]
        issues.extend(numeric_anomalies(costs, f"Order {o['orderId']}.computedCosts"))
        for key, value in costs.items():
            if value > o.get("revenue", 0) * 1.5:
                issues.append(f"Order {o['orderId']}: {key} exceeds 150% of contract revenue")
    for q in data["rolls"]:
        label = q.get("inspectionId") or q.get("rollId") or "unknown"
        o = orders.get(q.get("orderId"), {})
        stamp = max(q.get("createdAt") or "", q.get("inspectionDate") or "", q.get("date") or "")
        dispatch = o.get("dispatchedAt")
        if (dispatch and stamp > dispatch) or (o.get("status") == "DISPATCHED" and not dispatch):
            issues.append(f"Inspection {label}: inspection after dispatch or against a dispatched order without dispatch history")
        if not q.get("shift"):
            issues.append(f"Inspection {label}: missing shift")
    months = {e.get("timestamp", "")[:7] for e in data["productionEvents"]}
    months.update(profitability.last_months(4))
    months.discard("")
    for month in sorted(months):
        dashboard = finance_dashboard(month)
        issues.extend(numeric_anomalies(dashboard, f"dashboard[{month}]"))
        k = dashboard["kpis"]
        if k["productionCost"] > 0 and k["machineOperatingCost"] > k["productionCost"] * .4:
            issues.append(f"Month {month}: machine cost exceeds 40% of total cost")
        if k["revenue"] == 0 and k["productionCost"] > 0 and any(e.get("timestamp", "").startswith(month) for e in data["productionEvents"]):
            issues.append(f"Month {month}: zero revenue with costs and production events")
        if k["profitMargin"] is not None and k["profitMargin"] < -20 and any(
                e.get("source") == "demo" and e.get("timestamp", "").startswith(month) for e in data["productionEvents"]):
            issues.append(f"Seeded month {month}: margin below -20%")
    return list(dict.fromkeys(issues))


def main():
    issues = check_data()
    for issue in issues:
        print(f"WARNING: {issue}")
    print(f"Data checks: {len(issues)} anomalies" if issues else "Data checks: clean (0 anomalies)")
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())

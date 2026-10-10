"""Order costing. True Order Cost = raw material + labour + machine + rework + other."""


def calculate_raw_material_cost(kg_used: float, cost_per_kg: float) -> float:
    """Raw material cost = kilograms of yarn used x cost per kg."""
    return kg_used * cost_per_kg


def calculate_labour_cost(attendance_records: list, hourly_rates: dict) -> float:
    """Sum (hoursWorked + overtimeHours) x worker hourlyRate for one order.

    attendance_records: list of dicts with workerId, hoursWorked, overtimeHours.
    hourly_rates: {workerId: hourlyRate}.
    TODO: pay overtime at a higher multiplier if needed.
    """
    total = 0.0
    for rec in attendance_records:
        hours = rec.get("hoursWorked", 0) + rec.get("overtimeHours", 0)
        total += hours * hourly_rates.get(rec.get("workerId"), 0)
    return total


def calculate_machine_cost(runtime_hours: float, cost_per_hour: float) -> float:
    """Machine cost = runtime hours x machine costPerHour."""
    return runtime_hours * cost_per_hour


def calculate_true_order_cost(costs: dict) -> float:
    """Add up rawMaterial, labour, machine, rework and other from a costs dict."""
    keys = ("rawMaterial", "labour", "machine", "rework", "other")
    return sum(costs.get(k, 0) for k in keys)

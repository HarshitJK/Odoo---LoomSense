"""Check whether the factory can start an order, and what it will earn."""


def check_material_availability(required_kg: float, available_kg: float) -> dict:
    """Compare required yarn with stock. Returns shortage and a ready flag."""
    shortage = max(required_kg - available_kg, 0)
    return {
        "requiredKg": required_kg,
        "availableKg": available_kg,
        "shortageKg": shortage,
        "status": "MATERIAL READY" if shortage == 0 else "CANNOT START FULL PRODUCTION",
    }


def estimate_order_cost(material: float, labour: float, machine: float) -> float:
    """Projected total cost before production begins."""
    return material + labour + machine


def calculate_projected_margin(expected_revenue: float, projected_cost: float,
                               target_margin: float = 25.0) -> dict:
    """Projected profit/margin, with a warning if below the factory target."""
    profit = expected_revenue - projected_cost
    margin = round(profit / expected_revenue * 100, 1) if expected_revenue else 0.0
    warning = None
    if margin < target_margin:
        warning = f"Margin below factory target of {target_margin:g}%."
    return {"projectedProfit": profit, "projectedMargin": margin, "warning": warning}

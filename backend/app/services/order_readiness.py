"""Can the factory start this order, and what will it earn?"""
from app import database as dbm
from app.config import TARGET_MARGIN, YARN_KG_PER_METRE
from app.services import costing, profitability


def check_material_availability(required_kg: float, available_kg: float) -> dict:
    shortage = max(required_kg - available_kg, 0)
    return {
        "requiredYarnKg": round(required_kg, 2),
        "availableKg": round(available_kg, 2),
        "shortageKg": round(shortage, 2),
        "status": "MATERIAL_READY" if shortage == 0 else "CANNOT_START_FULL_PRODUCTION",
    }


def calculate_projected_margin(expected_revenue: float, projected_cost: float) -> dict:
    profit = round(expected_revenue - projected_cost, 2)
    margin = profitability.calculate_margin(expected_revenue, profit)
    warning = None
    if expected_revenue and margin < TARGET_MARGIN:
        warning = f"Margin below factory target of {TARGET_MARGIN:g}%."
    return {"projectedProfit": profit, "projectedMargin": margin, "warning": warning}


def per_metre_benchmarks(data: dict, exclude_order_id: str = None) -> dict:
    """Average labour and machine cost per metre of finished orders (the typical order)."""
    labour = machine = meters = 0.0
    for o in data["orders"]:
        if o["orderId"] == exclude_order_id or o.get("producedMeters", 0) < o.get("quantityMeters", 1):
            continue
        cost = costing.calculate_order_cost(o["orderId"], data)
        labour += cost["costs"]["labour"]
        machine += cost["costs"]["machine"]
        meters += o["producedMeters"]
    if not meters:
        return {"labour": 0.0, "machine": 0.0}
    return {"labour": labour / meters, "machine": machine / meters}


def check_readiness(order_id: str = None, request: dict = None) -> dict:
    """Readiness for an existing order (order_id) or a not-yet-created one (request dict
    with quantityMeters, colour, fabricType, expectedRevenue)."""
    data = costing.load_data()
    if order_id:
        order = costing.get_order(order_id, data)
        spec = {
            "quantityMeters": order["quantityMeters"], "colour": order.get("colour"),
            "fabricType": order.get("fabricType"), "expectedRevenue": order.get("revenue", 0),
        }
    else:
        spec = request

    meters = spec["quantityMeters"]
    batches = costing.matching_batches(spec.get("fabricType"), spec.get("colour"), data)
    available_kg = sum(b["quantityKg"] for b in batches)
    reserved = sum(b.get("reservedKg", 0) for b in batches)
    own = sum(r["quantityKg"] for r in dbm.db.materialReservations.find({"orderId": order_id})) if order_id else 0
    remaining = max(0, meters - order.get("producedMeters", 0)) if order_id else meters
    availability = check_material_availability(remaining * YARN_KG_PER_METRE, max(0, available_kg - reserved + own))

    # Price the yarn from matching stock (weighted average costPerKg)
    price = (sum(b["quantityKg"] * b["costPerKg"] for b in batches) / available_kg) if available_kg else 0.0
    bench = per_metre_benchmarks(data, exclude_order_id=order_id)
    material = round(meters * YARN_KG_PER_METRE * price, 2)
    labour = round(bench["labour"] * meters, 2)
    machine = round(bench["machine"] * meters, 2)
    projected_cost = round(material + labour + machine, 2)

    revenue = spec.get("expectedRevenue", 0)
    return {
        "estimationWarning": "No matching stock price or completed-order benchmark: projected costs are incomplete." if not price or not bench["labour"] or not bench["machine"] else None,
        "orderId": order_id,
        **availability,
        "projectedMaterialCost": material,
        "projectedLabourCost": labour,
        "projectedMachineCost": machine,
        "projectedCost": projected_cost,
        "expectedRevenue": revenue,
        **calculate_projected_margin(revenue, projected_cost),
        "targetMargin": TARGET_MARGIN,
    }

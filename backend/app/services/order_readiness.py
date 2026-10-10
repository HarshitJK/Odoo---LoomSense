"""Can the factory start this order, and what will it earn?"""
from app import database as dbm
from app.config import TARGET_MARGIN, YARN_KG_PER_METRE
from app.services import costing, profitability

NO_ID = {"_id": 0}


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


def per_metre_benchmarks(exclude_order_id: str = None) -> dict:
    """Average labour and machine cost per metre of finished orders (the typical order)."""
    labour = machine = meters = 0.0
    for o in dbm.orders().find({}, NO_ID):
        if o["orderId"] == exclude_order_id or o.get("producedMeters", 0) < o.get("quantityMeters", 1):
            continue
        cost = costing.calculate_order_cost(o["orderId"])
        labour += cost["costs"]["labour"]
        machine += cost["costs"]["machine"]
        meters += o["producedMeters"]
    if not meters:
        return {"labour": 0.0, "machine": 0.0}
    return {"labour": labour / meters, "machine": machine / meters}


def check_readiness(order_id: str = None, request: dict = None) -> dict:
    """Readiness for an existing order (order_id) or a not-yet-created one (request dict
    with quantityMeters, colour, fabricType, expectedRevenue)."""
    if order_id:
        order = costing.get_order(order_id)
        spec = {
            "quantityMeters": order["quantityMeters"], "colour": order.get("colour"),
            "fabricType": order.get("fabricType"), "expectedRevenue": order.get("revenue", 0),
        }
    else:
        spec = request

    meters = spec["quantityMeters"]
    batches = costing.matching_batches(spec.get("fabricType"), spec.get("colour"))
    available_kg = sum(b["quantityKg"] for b in batches)
    availability = check_material_availability(meters * YARN_KG_PER_METRE, available_kg)

    # Price the yarn from matching stock (weighted average costPerKg)
    price = (sum(b["quantityKg"] * b["costPerKg"] for b in batches) / available_kg) if available_kg else 0.0
    bench = per_metre_benchmarks(exclude_order_id=order_id)
    material = round(availability["requiredYarnKg"] * price, 2)
    labour = round(bench["labour"] * meters, 2)
    machine = round(bench["machine"] * meters, 2)
    projected_cost = round(material + labour + machine, 2)

    revenue = spec.get("expectedRevenue", 0)
    return {
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

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from app.services.auth import current_user, owner

from app import database as dbm
from app.models.order import Order, OrderCreate, OrderUpdate, ReadinessRequest
from app.services import costing, order_readiness, profitability
from app.utils.ids import next_order_id

router = APIRouter()
NO_ID = {"_id": 0}


@router.get("")
def list_orders(status: Optional[str] = None, user=Depends(current_user)):
    query = {"status": status} if status else {}
    return [order_view(o, user) for o in dbm.orders().find(query, NO_ID).sort("orderId", 1)]


@router.post("/readiness-check")
def readiness_check(body: ReadinessRequest):
    """Readiness and projected margin for an order that does not exist yet."""
    return order_readiness.check_readiness(request=body.model_dump())


@router.get("/{order_id}")
def get_order(order_id: str, user=Depends(current_user)):
    order_id = normalize_id(order_id)
    return order_view(costing.get_order(order_id), user)


@router.get("/{order_id}/cost", dependencies=[Depends(owner)])
def order_cost(order_id: str):
    order_id = normalize_id(order_id)
    return costing.calculate_order_cost(order_id)


@router.get("/{order_id}/readiness")
def order_readiness_check(order_id: str):
    order_id = normalize_id(order_id)
    return order_readiness.check_readiness(order_id=order_id)


@router.post("", status_code=201)
def create_order(body: OrderCreate, user=Depends(current_user)):
    doc = Order(
        orderId=next_order_id(),
        orderDate=date.today().isoformat(),
        **body.model_dump(),
    ).model_dump()
    doc.update(createdAt=datetime.now(timezone.utc).isoformat(), updatedAt=datetime.now(timezone.utc).isoformat(), productionHistoryComplete=True, materialHistoryComplete=True)
    dbm.orders().insert_one(doc)
    profitability.refresh_order(doc["orderId"])
    return order_view(costing.get_order(doc["orderId"]), user)


@router.patch("/{order_id}")
def update_order(order_id: str, body: OrderUpdate, user=Depends(current_user)):
    order_id = normalize_id(order_id)
    changes = body.model_dump(exclude_unset=True)
    changes["updatedAt"] = datetime.now(timezone.utc).isoformat()
    if changes:
        result = dbm.orders().update_one({"orderId": order_id}, {"$set": changes})
        if result.matched_count == 0:
            raise HTTPException(404, f"Order {order_id} not found")
    profitability.refresh_order(order_id)
    return order_view(costing.get_order(order_id), user)


def order_view(order, user):
    if user["role"] != "OWNER":
        return {k: v for k, v in order.items() if k not in ("costs", "profit", "margin", "paidAmount", "otherCost", "yarnConsumedKg")}
    return order


from pydantic import BaseModel, Field
from app.services import materials, machine_simulator
from app.utils.ids import normalize_id


class Reservation(BaseModel):
    batchId: str
    quantityKg: float = Field(gt=0, allow_inf_nan=False)


@router.post("/{order_id}/reserve")
def reserve_material(order_id: str, body: Reservation):
    with machine_simulator.sim_lock:
        return materials.reserve(normalize_id(order_id), normalize_id(body.batchId), body.quantityKg)

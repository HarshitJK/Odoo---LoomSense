from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException

from app import database as dbm
from app.models.order import Order, OrderCreate, OrderUpdate, ReadinessRequest
from app.services import costing, order_readiness, profitability
from app.utils.ids import next_order_id

router = APIRouter()
NO_ID = {"_id": 0}


@router.get("")
def list_orders(status: Optional[str] = None):
    query = {"status": status} if status else {}
    return list(dbm.orders().find(query, NO_ID).sort("orderId", 1))


@router.post("/readiness-check")
def readiness_check(body: ReadinessRequest):
    """Readiness and projected margin for an order that does not exist yet."""
    return order_readiness.check_readiness(request=body.model_dump())


@router.get("/{order_id}")
def get_order(order_id: str):
    return costing.get_order(order_id)


@router.get("/{order_id}/cost")
def order_cost(order_id: str):
    return costing.calculate_order_cost(order_id)


@router.get("/{order_id}/readiness")
def order_readiness_check(order_id: str):
    return order_readiness.check_readiness(order_id=order_id)


@router.post("", status_code=201)
def create_order(body: OrderCreate):
    doc = Order(
        orderId=next_order_id(),
        orderDate=date.today().isoformat(),
        **body.model_dump(),
    ).model_dump()
    dbm.orders().insert_one(doc)
    profitability.refresh_order(doc["orderId"])
    return costing.get_order(doc["orderId"])


@router.patch("/{order_id}")
def update_order(order_id: str, body: OrderUpdate):
    changes = body.model_dump(exclude_unset=True)
    if changes:
        result = dbm.orders().update_one({"orderId": order_id}, {"$set": changes})
        if result.matched_count == 0:
            raise HTTPException(404, f"Order {order_id} not found")
    profitability.refresh_order(order_id)
    return costing.get_order(order_id)

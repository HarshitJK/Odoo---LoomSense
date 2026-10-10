from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException

from app import database as dbm
from app.models.order import Order, OrderCreate, OrderUpdate
from app.utils.ids import next_order_id

router = APIRouter()
NO_ID = {"_id": 0}


@router.get("")
def list_orders(status: Optional[str] = None):
    query = {"status": status} if status else {}
    return list(dbm.orders().find(query, NO_ID).sort("orderId", 1))


@router.get("/{order_id}")
def get_order(order_id: str):
    order = dbm.orders().find_one({"orderId": order_id}, NO_ID)
    if not order:
        raise HTTPException(404, f"Order {order_id} not found")
    return order


@router.post("", status_code=201)
def create_order(body: OrderCreate):
    doc = Order(
        orderId=next_order_id(),
        orderDate=date.today().isoformat(),
        **body.model_dump(),
    ).model_dump()
    dbm.orders().insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/{order_id}")
def update_order(order_id: str, body: OrderUpdate):
    changes = body.model_dump(exclude_unset=True)
    if changes:
        result = dbm.orders().update_one({"orderId": order_id}, {"$set": changes})
        if result.matched_count == 0:
            raise HTTPException(404, f"Order {order_id} not found")
    return get_order(order_id)

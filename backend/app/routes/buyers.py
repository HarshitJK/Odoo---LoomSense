from fastapi import APIRouter, HTTPException

from app import database as dbm
from app.services import tracking
from app.utils.ids import normalize_id

router = APIRouter()


@router.get("/track/{order_id}")
def track_order(order_id: str):
    """Public, buyer-safe order status. Accepts ORD104 or ORD-104."""
    order = dbm.orders().find_one({"orderId": normalize_id(order_id)}, {"_id": 0})
    if not order:
        raise HTTPException(404, f"We couldn't find an order with the ID '{order_id}'. "
                                 "Please check the ID and try again.")
    return tracking.track_order(order)

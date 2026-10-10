from fastapi import APIRouter, HTTPException

from app import database as dbm
from app.services import tracking
from app.utils.ids import normalize_id

router = APIRouter()


@router.get("/track/{tracking_token}")
def track_order(tracking_token: str):
    """Public status; the random token is the only credential."""
    order = dbm.orders().find_one({"trackingToken": tracking_token}, {"_id": 0})
    if not order:
        raise HTTPException(404, f"We couldn't find an order with that tracking token. "
                                 "Please check the ID and try again.")
    return tracking.track_order(order)

from fastapi import APIRouter

router = APIRouter()


@router.get("")
def buyer_root():
    return {"message": "buyer endpoint is operational"}


@router.get("/track/{order_id}")
def track_order(order_id: str):
    # Buyer-safe data only: never expose wages, costs, profit or supplier info.
    return {"message": "buyer tracking endpoint is operational", "orderId": order_id}

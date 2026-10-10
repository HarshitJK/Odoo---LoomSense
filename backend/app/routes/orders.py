from fastapi import APIRouter

router = APIRouter()


@router.get("")
def list_orders():
    return {"message": "orders endpoint is operational"}

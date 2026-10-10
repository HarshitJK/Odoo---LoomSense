from fastapi import APIRouter

router = APIRouter()


@router.get("")
def list_inventory():
    return {"message": "inventory endpoint is operational"}

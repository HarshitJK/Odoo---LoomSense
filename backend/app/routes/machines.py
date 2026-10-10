from fastapi import APIRouter

router = APIRouter()


@router.get("")
def list_machines():
    return {"message": "machines endpoint is operational"}

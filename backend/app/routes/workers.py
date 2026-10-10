from fastapi import APIRouter

router = APIRouter()


@router.get("")
def list_workers():
    return {"message": "workers endpoint is operational"}

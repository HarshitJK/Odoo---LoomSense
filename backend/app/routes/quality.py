from fastapi import APIRouter

router = APIRouter()


@router.get("")
def list_quality():
    return {"message": "quality endpoint is operational"}

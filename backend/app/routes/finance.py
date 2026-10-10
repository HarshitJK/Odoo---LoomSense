from fastapi import APIRouter

router = APIRouter()


@router.get("/dashboard")
def finance_dashboard():
    return {"message": "finance dashboard endpoint is operational"}

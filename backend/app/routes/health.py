from fastapi import APIRouter, HTTPException

from app.database import ping

router = APIRouter()


@router.get("/health", tags=["health"])
def health():
    if not ping():
        raise HTTPException(
            status_code=503, detail={"status": "error", "database": "disconnected"}
        )
    return {"status": "ok", "database": "connected"}

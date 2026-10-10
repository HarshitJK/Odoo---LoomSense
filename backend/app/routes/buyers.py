from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app import database as dbm
from app.services import rate_limit, tracking

router = APIRouter()

RATE_LIMIT_PER_MINUTE = 60
NOT_FOUND = {"detail": "Tracking link not found"}
PRIVATE_HEADERS = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
}


def client_ip(request: Request) -> str:
    """Last X-Forwarded-For entry (added by our own proxy, so the caller cannot forge it), else the socket peer."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def reply(status: int, body: dict) -> JSONResponse:
    return JSONResponse(status_code=status, content=body, headers=PRIVATE_HEADERS)


@router.get("/track/{tracking_token}")
def track_order(tracking_token: str, request: Request):
    """Public, read-only status. The random token is the only credential; order ids never match."""
    if not rate_limit.allow(client_ip(request), RATE_LIMIT_PER_MINUTE):
        return reply(429, {"detail": "Too many requests. Please try again in a minute."})
    # Wrong, revoked and malformed tokens all get the same answer.
    order = None
    if 16 <= len(tracking_token) <= 128:
        order = dbm.orders().find_one({"trackingToken": tracking_token}, {"_id": 0})
    if not order:
        return reply(404, NOT_FOUND)
    return reply(200, tracking.track_order(order))

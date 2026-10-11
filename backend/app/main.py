import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError, DuplicateKeyError
from fastapi.middleware.cors import CORSMiddleware

from app.services.auth import owner, management, internal
from app.config import CORS_ORIGINS
from app.routes import (
    auth, purchases, buyers, demo, finance, health, inventory, machines, orders, quality, transactions, workers,
)
from app.services import machine_simulator, quality_gate, tracking
from app.utils.tokens import mask_tracking_path
from app.services.costing import OrderNotFound
from app.websocket import machines as machines_ws

def jsonable_errors(exc: RequestValidationError) -> list:
    return [{"loc": [str(p) for p in e["loc"]], "msg": e["msg"], "type": e["type"]} for e in exc.errors()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run the machine simulator in the same process as the API."""
    try:
        tracking.ensure_indexes()  # backfill missing tracking tokens, then enforce uniqueness
        quality_gate.ensure_indexes()  # old quality records get an inspectionId, then the indexes are created
    except PyMongoError:
        log.warning("Could not prepare the orders.trackingToken index; MongoDB is not reachable yet")
    try:
        from app.data_checks import check_data
        for anomaly in await asyncio.to_thread(check_data):
            log.warning("Demo data anomaly: %s", anomaly)
    except Exception:
        log.warning("Demo data checks could not complete; run python -m app.data_checks", exc_info=True)
    machine_simulator.add_listener(machines_ws.manager.broadcast)
    task = asyncio.create_task(machine_simulator.run_forever())
    yield
    task.cancel()


log = logging.getLogger("loomsense")


class MaskTrackingTokens(logging.Filter):
    """Never write a full buyer tracking token to the logs (uvicorn's access log prints the request path)."""
    def filter(self, record):
        if isinstance(record.args, tuple):
            record.args = tuple(mask_tracking_path(a) if isinstance(a, str) else a for a in record.args)
        return True


logging.getLogger("uvicorn.access").addFilter(MaskTrackingTokens())
app = FastAPI(title="LoomSense API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(purchases.router, prefix="/api/purchases", tags=["purchases"], dependencies=[Depends(owner)])
app.include_router(health.router, prefix="/api")
app.include_router(orders.router, dependencies=[Depends(management)], prefix="/api/orders", tags=["orders"])
app.include_router(machines.router, dependencies=[Depends(management)], prefix="/api/machines", tags=["machines"])
app.include_router(inventory.router, dependencies=[Depends(management)], prefix="/api/inventory", tags=["inventory"])
app.include_router(workers.router, dependencies=[Depends(management)], prefix="/api/workers", tags=["workers"])
app.include_router(workers.attendance_router, dependencies=[Depends(management)], prefix="/api/attendance", tags=["attendance"])
app.include_router(quality.router, dependencies=[Depends(internal)], prefix="/api/quality", tags=["quality"])
app.include_router(quality.passport_router, prefix="/api/passport", tags=["passport"])
app.include_router(transactions.router, dependencies=[Depends(owner)], prefix="/api/transactions", tags=["transactions"])
app.include_router(demo.router, dependencies=[Depends(owner)], prefix="/api/demo", tags=["demo"])
app.include_router(finance.router, dependencies=[Depends(owner)], prefix="/api/finance", tags=["finance"])
app.include_router(buyers.router, prefix="/api/buyer", tags=["buyer"])
app.include_router(machines_ws.router)


@app.exception_handler(OrderNotFound)
def order_not_found(request, exc):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(RequestValidationError)
def validation_error(request: Request, exc: RequestValidationError):
    """422 with a readable `detail` string (the raw list stays in `errors`)."""
    messages = [f"{'.'.join(str(p) for p in e['loc'] if p != 'body')}: {e['msg']}" for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages), "errors": jsonable_errors(exc)})


@app.exception_handler(Exception)
def unexpected_error(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, mask_tracking_path(request.url.path))
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.exception_handler(PyMongoError)
def mongo_error(request, exc):
    return JSONResponse(status_code=503, content={"detail": "MongoDB is not available"})


@app.get("/")
def root():
    return {"service": "LoomSense API", "docs": "/docs"}


@app.exception_handler(DuplicateKeyError)
def duplicate_key(request, exc):
    return JSONResponse(status_code=409, content={"detail": "A record with this identifier already exists"})

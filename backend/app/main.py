import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routes import (
    buyers, demo, finance, health, inventory, machines, orders, quality, transactions, workers,
)
from app.services import machine_simulator
from app.services.costing import OrderNotFound
from app.websocket import machines as machines_ws

def jsonable_errors(exc: RequestValidationError) -> list:
    return [{"loc": [str(p) for p in e["loc"]], "msg": e["msg"], "type": e["type"]} for e in exc.errors()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run the machine simulator in the same process as the API."""
    machine_simulator.add_listener(machines_ws.manager.broadcast)
    task = asyncio.create_task(machine_simulator.run_forever())
    yield
    task.cancel()


log = logging.getLogger("loomsense")
app = FastAPI(title="LoomSense API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(machines.router, prefix="/api/machines", tags=["machines"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])
app.include_router(workers.router, prefix="/api/workers", tags=["workers"])
app.include_router(workers.attendance_router, prefix="/api/attendance", tags=["attendance"])
app.include_router(quality.router, prefix="/api/quality", tags=["quality"])
app.include_router(quality.passport_router, prefix="/api/passport", tags=["passport"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(demo.router, prefix="/api/demo", tags=["demo"])
app.include_router(finance.router, prefix="/api/finance", tags=["finance"])
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
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.exception_handler(PyMongoError)
def mongo_error(request, exc):
    return JSONResponse(status_code=503, content={"detail": "MongoDB is not available"})


@app.get("/")
def root():
    return {"service": "LoomSense API", "docs": "/docs"}

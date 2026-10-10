import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routes import buyers, finance, health, inventory, machines, orders, quality, workers
from app.services import machine_simulator
from app.services.costing import OrderNotFound
from app.websocket import machines as machines_ws

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run the machine simulator in the same process as the API."""
    machine_simulator.add_listener(machines_ws.manager.broadcast)
    task = asyncio.create_task(machine_simulator.run_forever())
    yield
    task.cancel()


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
app.include_router(finance.router, prefix="/api/finance", tags=["finance"])
app.include_router(buyers.router, prefix="/api/buyer", tags=["buyer"])
app.include_router(machines_ws.router)


@app.exception_handler(OrderNotFound)
def order_not_found(request, exc):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(PyMongoError)
def mongo_error(request, exc):
    return JSONResponse(status_code=503, content={"detail": "MongoDB is not available"})


@app.get("/")
def root():
    return {"service": "LoomSense API", "docs": "/docs"}

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routes import buyers, finance, health, inventory, machines, orders, quality, workers
from app.websocket import machines as machines_ws

app = FastAPI(title="LoomSense API")

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
app.include_router(quality.router, prefix="/api/quality", tags=["quality"])
app.include_router(finance.router, prefix="/api/finance", tags=["finance"])
app.include_router(buyers.router, prefix="/api/buyer", tags=["buyer"])
app.include_router(machines_ws.router)


@app.get("/")
def root():
    return {"service": "LoomSense API", "docs": "/docs"}

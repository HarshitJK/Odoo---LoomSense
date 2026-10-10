from typing import Optional

from pydantic import BaseModel


class OrderCosts(BaseModel):
    rawMaterial: float = 0
    labour: float = 0
    machine: float = 0
    rework: float = 0
    other: float = 0


class Order(BaseModel):
    orderId: str
    buyerId: Optional[str] = None
    buyerName: Optional[str] = None
    fabricType: Optional[str] = None
    colour: Optional[str] = None
    quantityMeters: float = 0
    producedMeters: float = 0
    status: str = "PENDING"
    machineId: Optional[str] = None
    deadline: Optional[str] = None
    revenue: float = 0
    costs: OrderCosts = OrderCosts()
    profit: Optional[float] = None
    margin: Optional[float] = None

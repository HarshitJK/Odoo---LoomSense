from typing import Optional

from pydantic import BaseModel


class Machine(BaseModel):
    machineId: str
    name: Optional[str] = None
    type: Optional[str] = None  # e.g. WEAVING
    status: str = "IDLE"  # RUNNING | IDLE | MAINTENANCE
    currentOrderId: Optional[str] = None
    productionRate: float = 0
    producedMeters: float = 0
    targetMeters: float = 0
    temperature: Optional[float] = None
    costPerHour: float = 0
    efficiency: float = 0

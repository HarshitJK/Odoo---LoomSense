from typing import Literal, Optional

from pydantic import BaseModel, Field


class Machine(BaseModel):
    machineId: str
    name: Optional[str] = None
    type: Optional[str] = None  # e.g. WEAVING
    status: str = "IDLE"  # RUNNING | IDLE | DOWN
    currentOrderId: Optional[str] = None
    productionRate: float = 0
    producedMeters: float = 0
    targetMeters: float = 0
    temperature: Optional[float] = None
    costPerHour: float = 0
    efficiency: float = 0
    runtimeToday: float = 0  # hours


class MachineUpdate(BaseModel):
    status: Optional[str] = None
    currentOrderId: Optional[str] = None
    productionRate: Optional[float] = None


class SimulateRequest(BaseModel):
    """Body for POST /api/machines/simulate."""
    action: Literal["start", "stop", "reset", "failure"]
    machineId: Optional[str] = None
    speed: Optional[float] = Field(default=None, gt=0, le=100)

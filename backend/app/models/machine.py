from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator
from datetime import datetime


class Machine(BaseModel):
    machineId: str
    name: Optional[str] = None
    type: Optional[str] = None  # e.g. WEAVING
    status: str = "IDLE"  # RUNNING | IDLE | DOWN | MAINTENANCE
    currentOrderId: Optional[str] = None
    productionRate: float = 0
    producedMeters: float = 0
    targetMeters: float = 0
    temperature: Optional[float] = None
    costPerHour: float = 0
    efficiency: float = 0
    runtimeToday: float = 0  # hours


class MachineUpdate(BaseModel):
    status: Optional[Literal["RUNNING", "IDLE", "DOWN", "MAINTENANCE"]] = None
    currentOrderId: Optional[str] = None
    productionRate: Optional[float] = Field(default=None, ge=0)


class SimulateRequest(BaseModel):
    """Body for POST /api/machines/simulate."""
    action: Literal["start", "stop", "reset", "failure"]
    machineId: Optional[str] = None
    speed: Optional[float] = Field(default=None, gt=0, le=100)


class MachineReading(BaseModel):
    """Body for POST /api/machines/{machineId}/readings (data sent by a machine)."""
    temperature: Optional[float] = Field(default=None, ge=0, le=200)
    productionRate: Optional[float] = Field(default=None, ge=0)
    efficiency: Optional[float] = Field(default=None, ge=0, le=1)
    producedMetersDelta: float = Field(default=0, ge=0)
    status: Optional[Literal["RUNNING", "IDLE", "DOWN"]] = None
    timestamp: Optional[str] = None

    @field_validator("timestamp")
    @classmethod
    def valid_timestamp(cls, value):
        if value:
            return datetime.fromisoformat(value).isoformat()
        return value

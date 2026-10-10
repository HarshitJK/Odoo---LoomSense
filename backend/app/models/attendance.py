from typing import Optional

from pydantic import BaseModel, Field


class Attendance(BaseModel):
    workerId: str
    orderId: Optional[str] = None
    machineId: Optional[str] = None
    hoursWorked: float = Field(default=0, ge=0, le=24)
    overtimeHours: float = Field(default=0, ge=0, le=24)
    date: Optional[str] = None  # YYYY-MM-DD

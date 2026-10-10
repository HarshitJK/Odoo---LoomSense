from typing import Optional

from pydantic import BaseModel


class Attendance(BaseModel):
    workerId: str
    orderId: Optional[str] = None
    machineId: Optional[str] = None
    hoursWorked: float = 0
    overtimeHours: float = 0
    date: Optional[str] = None  # YYYY-MM-DD

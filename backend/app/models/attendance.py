from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from datetime import date as Date


class Attendance(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    workerId: str
    orderId: Optional[str] = None
    machineId: Optional[str] = None
    hoursWorked: float = Field(default=0, ge=0, le=24)
    overtimeHours: float = Field(default=0, ge=0, le=24)
    date: Optional[str] = None  # YYYY-MM-DD

    @field_validator("date")
    @classmethod
    def valid_date(cls, value):
        return Date.fromisoformat(value).isoformat() if value else value

    @model_validator(mode="after")
    def total_hours(self):
        if self.hoursWorked + self.overtimeHours > 24:
            raise ValueError("Regular plus overtime hours cannot exceed 24")
        return self

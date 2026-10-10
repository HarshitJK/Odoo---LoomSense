from typing import Optional

from pydantic import BaseModel, Field


class Worker(BaseModel):
    workerId: str
    name: str
    hourlyRate: float = Field(default=0, ge=0)
    shift: Optional[str] = None  # A | B | C

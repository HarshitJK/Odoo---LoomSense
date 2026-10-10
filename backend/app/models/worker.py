from typing import Optional

from pydantic import BaseModel


class Worker(BaseModel):
    workerId: str
    name: str
    hourlyRate: float = 0
    shift: Optional[str] = None  # A | B | C

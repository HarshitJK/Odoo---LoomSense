from typing import List, Optional

from pydantic import BaseModel


class QualityCheck(BaseModel):
    rollId: str
    orderId: Optional[str] = None
    machineId: Optional[str] = None
    yarnBatch: Optional[str] = None
    shift: Optional[str] = None
    buyerName: Optional[str] = None
    status: str = "PENDING"  # PASSED | FAILED | REWORK | PENDING
    defects: List[str] = []
    reworkCost: float = 0
    date: Optional[str] = None

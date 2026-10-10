from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class QualityCheck(BaseModel):
    rollId: str
    orderId: Optional[str] = None
    machineId: Optional[str] = None
    yarnBatch: Optional[str] = None
    shift: Optional[str] = None
    buyerName: Optional[str] = None
    status: str = "PENDING"  # PASSED | FAILED | REWORK | PENDING
    defects: List[str] = []
    affectedMeters: float = 0
    reworkStatus: Optional[str] = None  # NOT_REQUIRED | PENDING | IN_PROGRESS | COMPLETED
    reworkCost: float = 0
    impact: Optional[dict] = None  # additionalLabour, machineCost, materialLoss, total
    date: Optional[str] = None  # YYYY-MM-DD
    producedAt: Optional[str] = None


class QualityCreate(BaseModel):
    """Body for POST /api/quality. rollId is generated if omitted."""
    rollId: Optional[str] = None
    orderId: Optional[str] = None
    machineId: Optional[str] = None
    yarnBatch: Optional[str] = None
    shift: Optional[str] = None
    status: Literal["PASSED", "FAILED", "REWORK", "PENDING"] = "PENDING"
    defects: List[str] = []
    affectedMeters: float = Field(default=0, ge=0)
    reworkStatus: Optional[Literal["NOT_REQUIRED", "PENDING", "IN_PROGRESS", "COMPLETED"]] = None
    reworkCost: float = Field(default=0, ge=0)  # only used when affectedMeters is 0

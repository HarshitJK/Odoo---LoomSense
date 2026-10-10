from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Severity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
InspectionType = Literal["INCOMING_MATERIAL", "FIRST_OFF", "STAGE", "FINAL", "REINSPECTION"]
CorrectiveAction = Literal["NONE", "REWORK_CURRENT_STAGE", "RESTART_FROM_CHECKPOINT", "SCRAP_AFFECTED_QUANTITY", "FULL_RESTART"]


class QualityCheck(BaseModel):
    """One inspection record. Old records (no stage) are legacy final-QC rolls and keep working."""
    rollId: Optional[str] = None
    inspectionId: Optional[str] = None
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
    # stage-gated fields
    stage: Optional[str] = None
    inspectionType: Optional[str] = None
    defectType: Optional[str] = None
    defectSeverity: Optional[str] = None
    inspectorId: Optional[str] = None
    notes: Optional[str] = None
    correctiveAction: Optional[str] = None
    additionalLabourCost: float = 0
    additionalMachineCost: float = 0
    scrapMaterialCost: float = 0
    reinspectionOf: Optional[str] = None
    inspectionDate: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class QualityCreate(BaseModel):
    """Body for POST /api/quality. rollId is generated if omitted.

    Without `stage` and `inspectionType` this is the old final-QC roll. With them it is a stage-gated
    inspection (REINSPECTION needs `reinspectionOf`).
    """
    rollId: Optional[str] = None
    orderId: Optional[str] = None
    machineId: Optional[str] = None
    yarnBatch: Optional[str] = None
    shift: Optional[str] = None
    status: Literal["PASSED", "FAILED", "REWORK", "PENDING"] = "PENDING"
    defects: List[str] = []
    affectedMeters: float = Field(default=0, ge=0)
    reworkStatus: Optional[Literal["NOT_REQUIRED", "PENDING", "IN_PROGRESS", "COMPLETED"]] = None
    reworkCost: float = Field(default=0, ge=0)  # old rolls: used when affectedMeters is 0
    stage: Optional[str] = None
    inspectionType: Optional[InspectionType] = None
    defectType: Optional[str] = None
    defectSeverity: Optional[Severity] = None
    notes: Optional[str] = None
    correctiveAction: Optional[CorrectiveAction] = None
    additionalLabourCost: float = Field(default=0, ge=0)
    additionalMachineCost: float = Field(default=0, ge=0)
    scrapMaterialCost: float = Field(default=0, ge=0)
    reinspectionOf: Optional[str] = None
    inspectionDate: Optional[str] = None


class CorrectiveActionBody(BaseModel):
    """Body for PATCH /api/quality/{inspectionId}/corrective-action."""
    correctiveAction: CorrectiveAction
    notes: Optional[str] = None
    reworkCost: Optional[float] = Field(default=None, ge=0)
    additionalLabourCost: Optional[float] = Field(default=None, ge=0)
    additionalMachineCost: Optional[float] = Field(default=None, ge=0)
    scrapMaterialCost: Optional[float] = Field(default=None, ge=0)

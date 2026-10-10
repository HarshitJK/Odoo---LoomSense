from typing import Optional

from pydantic import BaseModel, Field


class InventoryBatch(BaseModel):
    batchId: str
    material: Optional[str] = None
    colour: Optional[str] = None
    quantityKg: float = Field(default=0, ge=0)
    costPerKg: float = Field(default=0, ge=0)
    supplier: Optional[str] = None
    receivedDate: Optional[str] = None


class InventoryUpdate(BaseModel):
    material: Optional[str] = None
    colour: Optional[str] = None
    quantityKg: Optional[float] = Field(default=None, ge=0)
    costPerKg: Optional[float] = Field(default=None, ge=0)
    supplier: Optional[str] = None

from typing import Optional

from pydantic import BaseModel


class InventoryBatch(BaseModel):
    batchId: str
    material: Optional[str] = None
    colour: Optional[str] = None
    quantityKg: float = 0
    costPerKg: float = 0
    supplier: Optional[str] = None
    receivedDate: Optional[str] = None

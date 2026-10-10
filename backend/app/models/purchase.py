from datetime import date
from pydantic import BaseModel, ConfigDict, Field, model_validator


class MaterialPurchase(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra="forbid")
    supplier: str = Field(min_length=1)
    invoiceNumber: str = Field(min_length=1)
    batchId: str | None = None
    material: str = Field(min_length=1)
    colour: str = Field(min_length=1)
    quantityKg: float = Field(gt=0)
    costPerKg: float = Field(ge=0)
    otherCharges: float = Field(default=0, ge=0)
    purchaseDate: date
    paidAmount: float = Field(default=0, ge=0)
    notes: str = ""
    receiveInventory: bool = True

    @model_validator(mode="after")
    def payment_limit(self):
        if self.paidAmount > round(self.quantityKg * self.costPerKg + self.otherCharges, 2):
            raise ValueError("Paid amount exceeds the bill")
        return self


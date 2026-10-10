from typing import Optional

from pydantic import BaseModel, Field, field_validator
from datetime import date as Date


class Transaction(BaseModel):
    transactionId: str
    type: str = "BUYER_PAYMENT"
    orderId: Optional[str] = None
    amount: float = 0
    date: Optional[str] = None  # YYYY-MM-DD


class TransactionCreate(BaseModel):
    """Body for POST /api/transactions. transactionId is generated."""
    type: str = "BUYER_PAYMENT"
    orderId: Optional[str] = None
    amount: float = Field(gt=0)
    date: Optional[str] = None

    @field_validator("date")
    @classmethod
    def valid_date(cls, value):
        if value is not None:
            return Date.fromisoformat(value).isoformat()
        return value

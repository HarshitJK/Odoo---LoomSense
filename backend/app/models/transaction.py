from typing import Optional

from pydantic import BaseModel


class Transaction(BaseModel):
    transactionId: str
    type: str = "BUYER_PAYMENT"
    orderId: Optional[str] = None
    amount: float = 0
    date: Optional[str] = None  # YYYY-MM-DD

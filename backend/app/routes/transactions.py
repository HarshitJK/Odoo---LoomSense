from datetime import date

from fastapi import APIRouter, HTTPException

from app import database as dbm
from app.models.transaction import Transaction, TransactionCreate
from app.services import profitability
from app.utils.ids import next_transaction_id, normalize_id

router = APIRouter()


@router.post("", status_code=201)
def create_transaction(body: TransactionCreate):
    """Record a payment. BUYER_PAYMENT updates the order's paidAmount."""
    data = body.model_dump()
    if data["orderId"]:
        data["orderId"] = normalize_id(data["orderId"])
    if data["type"] == "BUYER_PAYMENT" and not data["orderId"]:
        raise HTTPException(422, "orderId is required for a BUYER_PAYMENT")
    if data["orderId"] and not dbm.orders().find_one({"orderId": data["orderId"]}):
        raise HTTPException(404, f"Order {data['orderId']} not found")

    doc = Transaction(
        transactionId=next_transaction_id(),
        type=data["type"],
        orderId=data["orderId"],
        amount=data["amount"],
        date=data["date"] or date.today().isoformat(),
    ).model_dump()
    dbm.transactions().insert_one(doc)
    doc.pop("_id", None)

    result = dict(doc)
    if data["type"] == "BUYER_PAYMENT":
        order = profitability.refresh_order(data["orderId"])
        result["order"] = {k: order[k] for k in ("orderId", "revenue", "paidAmount", "pendingAmount")}
    return result

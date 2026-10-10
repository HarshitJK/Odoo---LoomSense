"""Generate the next readable ID (ORD105, RL10094, TXN009) from the highest existing one."""
import re

from app import database as dbm


def _next(collection, field: str, prefix: str, start: int, width: int = 0) -> str:
    highest = start - 1
    for doc in collection.find({field: {"$regex": f"^{prefix}\d+$"}}, {field: 1, "_id": 0}):
        highest = max(highest, int(re.sub(r"\D", "", doc[field])))
    return f"{prefix}{highest + 1:0{width}d}"


def next_order_id() -> str:
    return _next(dbm.orders(), "orderId", "ORD", 100)


def next_roll_id() -> str:
    return _next(dbm.quality_checks(), "rollId", "RL", 10000)


def next_transaction_id() -> str:
    return _next(dbm.transactions(), "transactionId", "TXN", 1, width=3)

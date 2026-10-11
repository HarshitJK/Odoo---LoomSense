"""Append-only audit trail. Entries are only ever inserted, never changed or deleted. Written last in each action."""
from datetime import datetime, timezone
from uuid import uuid4

from app import database as dbm

NO_ID = {"_id": 0}


def record(event: str, order_id: str, user: dict, stage=None, old=None, new=None, machine_id=None,
           reason=None, notes=None, **extra) -> dict:
    entry = {"auditId": "AUD" + uuid4().hex, "event": event, "orderId": order_id,
             "actor": (user or {}).get("email"), "actorRole": (user or {}).get("role"),
             "stage": stage, "oldState": old, "newState": new, "machineId": machine_id,
             "reason": reason, "notes": notes, **extra, "createdAt": datetime.now(timezone.utc).isoformat()}
    dbm.db.auditLog.insert_one(dict(entry))
    return entry


def for_order(order_id: str) -> list:
    return list(dbm.db.auditLog.find({"orderId": order_id}, NO_ID).sort([("createdAt", 1), ("auditId", 1)]))


def ensure_indexes() -> None:
    dbm.db.auditLog.create_index([("orderId", 1), ("createdAt", 1)])

"""Buyer-safe order tracking and the public fabric passport.

Everything returned here is public: never add costs, revenue, profit, margin, wages,
supplier details or internal alerts.
"""
from datetime import datetime, timezone

from app import database as dbm
from app.config import TRACKING_BASE_URL
from app.services import quality_gate
from app.utils.tokens import new_tracking_token

NO_ID = {"_id": 0}

STAGES = ["Raw Material Allocated", "Spinning", "Weaving", "Dyeing", "Quality Check", "Ready for Dispatch"]
WEAVING = 2

# Index of the stage currently in progress; 6 means every stage is done.
STATUS_STAGE = {
    "NEW": 0, "PENDING": 0, "SPINNING": 1, "WEAVING": 2, "DYEING": 3,
    "QUALITY_CHECK": 4, "REWORK": 4, "READY_FOR_DISPATCH": 5,
    "DISPATCHED": 6, "COMPLETED": 6, "DELIVERED": 6,
}
DISPATCHED = {"DISPATCHED", "COMPLETED", "DELIVERED"}


def tracking_url(token: str) -> str:
    return f"{TRACKING_BASE_URL}/track/{token}"


def ensure_tracking_tokens() -> int:
    """Give a token to every order that has none. Idempotent."""
    stamp = datetime.now(timezone.utc).isoformat()
    count = 0
    for order in list(dbm.orders().find({"$or": [{"trackingToken": {"$exists": False}}, {"trackingToken": None}, {"trackingToken": ""}]})):
        dbm.orders().update_one({"_id": order["_id"]}, {"$set": {"trackingToken": new_tracking_token(), "updatedAt": stamp}})
        count += 1
    return count


def ensure_indexes() -> None:
    """Backfill first: a unique index would reject several orders that all lack a token."""
    ensure_tracking_tokens()
    dbm.orders().create_index("trackingToken", unique=True)


def build_stages(status: str, progress: int, index: int = None) -> list:
    current = STATUS_STAGE.get(status, 0) if index is None else index
    stages = []
    for i, name in enumerate(STAGES):
        state = "DONE" if i < current else "IN_PROGRESS" if i == current else "PENDING"
        stage = {"name": name, "state": state}
        if i == WEAVING and state == "IN_PROGRESS":
            stage["progress"] = progress
        stages.append(stage)
    return stages


def quality_status(rolls: list) -> str:
    """PASSED / IN_REVIEW / PENDING / NOT_STARTED. Internal rework details stay hidden."""
    if not rolls:
        return "NOT_STARTED"
    statuses = {r.get("status") for r in rolls}
    if statuses & {"FAILED", "REWORK"}:
        return "IN_REVIEW"
    if statuses == {"PASSED"}:
        return "PASSED"
    return "PENDING"


def dispatch_status(status: str) -> str:
    if status in DISPATCHED:
        return "DISPATCHED"
    if status == "READY_FOR_DISPATCH":
        return "READY_FOR_DISPATCH"
    return "NOT_DISPATCHED"


def track_order(order: dict) -> dict:
    quantity = order.get("quantityMeters") or 0
    progress = min(round(order.get("producedMeters", 0) / quantity * 100), 100) if quantity else 0
    rolls = list(dbm.quality_checks().find({"orderId": order["orderId"]}, NO_ID))
    message = None
    if quality_gate.is_gated(order):
        # Stage-gated order: show only safe wording, never what failed, who, or what it cost
        quality, message, index = quality_gate.buyer_quality(order, rolls)
        stages = build_stages(order.get("status", ""), progress, index)
    else:
        quality = quality_status(rolls)
        stages = build_stages(order.get("status", ""), progress)
    in_progress = [s["name"] for s in stages if s["state"] == "IN_PROGRESS"]
    return {
        "orderId": order["orderId"],
        "buyerName": order.get("buyerName"),
        "fabricType": order.get("fabricType"),
        "colour": order.get("colour"),
        "quantityMeters": quantity,
        "progress": progress,
        "currentStage": in_progress[0] if in_progress else "Dispatched",
        "stages": stages,
        "expectedCompletion": order.get("deadline"),
        "qualityStatus": quality,
        "qualityMessage": message,  # "Quality verification in progress" | "Rework verification" | "Quality approved" | None
        "dispatchStatus": dispatch_status(order.get("status", "")),
    }


def default_rework_status(quality: str) -> str:
    return {"FAILED": "PENDING", "REWORK": "IN_PROGRESS"}.get(quality, "NOT_REQUIRED")


def passport(roll: dict) -> dict:
    """Public passport of one roll. No cost, impact or profit fields."""
    buyer = roll.get("buyerName")
    if not buyer and roll.get("orderId"):
        order = dbm.orders().find_one({"orderId": roll["orderId"]}, NO_ID)
        buyer = order.get("buyerName") if order else None
    final, result = quality_gate.passport_status(roll)
    return {
        "rollId": roll["rollId"],
        "orderId": roll.get("orderId"),
        "buyerName": buyer,
        "yarnBatch": roll.get("yarnBatch"),
        "machineId": roll.get("machineId"),
        "shift": roll.get("shift"),
        "producedAt": roll.get("producedAt") or roll.get("date"),
        # Until the final inspection has passed the passport is not final: no result and no defects are shown
        "qualityStatus": result,
        "final": final,
        "defects": roll.get("defects", []) if final else [],
        "reworkStatus": (roll.get("reworkStatus") or default_rework_status(roll.get("status"))) if final else "NOT_REQUIRED",
    }

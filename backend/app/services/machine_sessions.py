"""Machine sessions: one record each time a machine works on an order stage (machineAssignments).

A session is ACTIVE until it is closed (pause, machine change, stage completion, cancellation) and is never reopened or
deleted; resuming opens a new one. Metres come from the dated production events of that machine and order and are
stored on the session when it closes.
"""
from datetime import datetime, timezone

from app import database as dbm
from app.utils.ids import next_session_id

NO_ID = {"_id": 0}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bucket(stamp: str) -> str:
    return (stamp or "")[:16]  # production events are accumulated per UTC minute


def _stage_of(order: dict) -> str:
    from app.services import quality_gate
    stage = quality_gate.gate_view(order)["currentStage"]
    return "WEAVING" if stage == "RAW_MATERIAL" else stage  # a machine on an order at raw material is about to weave


def metres_between(session: dict, end: str = None) -> float:
    """Metres this machine produced for the order from the session start, minus what earlier sessions of the
    same machine already took from the shared start minute."""
    start, stop = _bucket(session["startedAt"]), _bucket(end or _now())
    events = dbm.db.machineProductionEvents.find({"orderId": session["orderId"], "machineId": session["machineId"]}, NO_ID)
    total = sum(e.get("producedMetersDelta", 0) for e in events if start <= _bucket(e.get("timestamp")) <= stop)
    shared = sum(s.get("metresProduced", 0) for s in dbm.db.machineAssignments.find(
        {"orderId": session["orderId"], "machineId": session["machineId"], "status": "ENDED",
         "sessionId": {"$ne": session["sessionId"]}}, NO_ID)
        if s["startedAt"] < session["startedAt"] and _bucket(s.get("endedAt")) >= start)
    return round(max(0.0, total - shared), 2)


def open_session(order: dict, machine_id: str, user: dict, stage: str = None, at: str = None) -> dict:
    """Start a session unless this machine already has an active one for this order."""
    active = dbm.db.machineAssignments.find_one({"machineId": machine_id, "status": "ACTIVE"}, NO_ID)
    if active and active["orderId"] == order["orderId"]:
        return active
    if active:
        close(active, user, "REASSIGNED")
    session = {"sessionId": next_session_id(), "orderId": order["orderId"], "stage": stage or _stage_of(order),
               "machineId": machine_id, "startedAt": at or _now(), "endedAt": None, "status": "ACTIVE",
               "metresProduced": 0, "assignedBy": (user or {}).get("email") or "system", "endedBy": None, "endReason": None}
    dbm.db.machineAssignments.insert_one(dict(session))
    return session


def close(session: dict, user: dict, reason: str) -> bool:
    """Close one session (only if it is still ACTIVE, so two closers cannot both win)."""
    ended = _now()
    metres = metres_between(session, ended)
    result = dbm.db.machineAssignments.update_one(
        {"sessionId": session["sessionId"], "status": "ACTIVE"},
        {"$set": {"status": "ENDED", "endedAt": ended, "metresProduced": metres,
                  "endedBy": (user or {}).get("email") or "system", "endReason": reason}})
    return result.modified_count > 0


def active_for_order(order_id: str) -> list:
    return list(dbm.db.machineAssignments.find({"orderId": order_id, "status": "ACTIVE"}, NO_ID).sort("startedAt", 1))


def close_for_order(order_id: str, user: dict, reason: str) -> list:
    """Close every active session of an order. Returns the machine ids that had one."""
    closed = []
    for s in active_for_order(order_id):
        if close(s, user, reason):
            closed.append(s["machineId"])
    return closed


def close_for_order_machine(machine_id: str, reason: str, user: dict = None) -> None:
    """Close the active session of one machine (it is being given to another order)."""
    for s in dbm.db.machineAssignments.find({"machineId": machine_id, "status": "ACTIVE"}, NO_ID):
        close(s, user, reason)


def history(order_id: str) -> list:
    rows = list(dbm.db.machineAssignments.find({"orderId": order_id}, NO_ID).sort([("startedAt", 1), ("sessionId", 1)]))
    for s in rows:
        if s["status"] == "ACTIVE":
            s["metresProduced"] = metres_between(s)
    return rows


def backfill() -> int:
    """One active session for each machine that is RUNNING on an incomplete order. Idempotent; invents no history."""
    from app.services.machine_simulator import incomplete
    count = 0
    for m in dbm.machines().find({"status": "RUNNING", "currentOrderId": {"$ne": None}}, NO_ID):
        order = dbm.orders().find_one({"orderId": m["currentOrderId"]}, NO_ID)
        if not incomplete(order) or dbm.db.machineAssignments.find_one({"machineId": m["machineId"], "status": "ACTIVE"}):
            continue
        events = [e["timestamp"] for e in dbm.db.machineProductionEvents.find(
            {"orderId": order["orderId"], "machineId": m["machineId"]}, NO_ID)]
        open_session(order, m["machineId"], None, at=min(events) if events else None)
        count += 1
    return count


def ensure_indexes() -> None:
    coll = dbm.db.machineAssignments
    coll.create_index("sessionId", unique=True)
    coll.create_index([("orderId", 1), ("startedAt", 1)])
    coll.create_index([("machineId", 1), ("status", 1)])
    try:  # at most one active session per machine; skipped if old data would break it
        coll.create_index("machineId", unique=True, partialFilterExpression={"status": "ACTIVE"}, name="oneActivePerMachine")
    except Exception:
        pass

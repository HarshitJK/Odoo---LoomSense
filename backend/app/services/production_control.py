"""Production controls: pause, resume, change machine, cancel.

Safe without multi-document transactions: every state change is a conditional update that names the state it expects,
so of two simultaneous actions only one matches and the other gets 409. Writes are ordered so a failure part-way
leaves a safe state (the order is paused or cancelled first, then sessions and machines follow, the audit entry is last).
History (sessions, production events, material, wages, inspections, costs) is never changed or deleted.
"""
from datetime import datetime, timezone

from fastapi import HTTPException

from app import database as dbm
from app.services import audit, machine_sessions, profitability, quality_gate
from app.services.machine_simulator import incomplete, sim_lock
from app.utils.ids import normalize_id

NO_ID = {"_id": 0}
PAUSE_REASONS = ("MACHINE_BREAKDOWN", "MAINTENANCE", "MATERIAL_SHORTAGE", "QUALITY_ISSUE", "OPERATOR_UNAVAILABLE", "MANUAL", "OTHER")
CANCEL_REASONS = ("BUYER_CANCELLED", "MATERIAL_ISSUE", "PRODUCTION_DEFECT", "MACHINE_LIMITATIONS", "COMMERCIAL_DECISION",
                  "DUPLICATE_ORDER", "OTHER")
FINISHED = ("DISPATCHED", "COMPLETED", "DELIVERED")
UNAVAILABLE = {"DOWN": "Selected machine is down.", "MAINTENANCE": "Selected machine is under maintenance."}
TAKEN = "Selected machine is already assigned to another active production job."


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _order(order_id: str) -> dict:
    order_id = normalize_id(order_id)
    order = dbm.orders().find_one({"orderId": order_id}, NO_ID)
    if not order:
        raise HTTPException(404, f"Order {order_id} not found")
    return order


def _swap(order_id: str, expected: dict, changes: dict, message: str) -> dict:
    """Update the order only if it still has the expected state; otherwise the action lost a race: 409."""
    result = dbm.orders().update_one({"orderId": order_id, **expected}, {"$set": {**changes, "updatedAt": _now()}})
    if not result.matched_count:
        raise HTTPException(409, message)
    return dbm.orders().find_one({"orderId": order_id}, NO_ID)


def _machines_of(order_id: str) -> list:
    """Machines working on the order now: those with an active session or running with the order assigned."""
    ids = [s["machineId"] for s in machine_sessions.active_for_order(order_id)]
    for m in dbm.machines().find({"currentOrderId": order_id, "status": "RUNNING"}, NO_ID):
        if m["machineId"] not in ids:
            ids.append(m["machineId"])
    return ids


def _check_machine(machine_id: str, order: dict) -> dict:
    """The machine must exist, be usable, and not belong to another incomplete order."""
    machine = dbm.machines().find_one({"machineId": machine_id}, NO_ID)
    if not machine:
        raise HTTPException(404, f"Machine {machine_id} not found")
    if machine["status"] in UNAVAILABLE:
        raise HTTPException(409, UNAVAILABLE[machine["status"]])
    holder = machine.get("currentOrderId")
    if holder and holder != order["orderId"] and incomplete(dbm.orders().find_one({"orderId": holder}, NO_ID)):
        raise HTTPException(409, TAKEN)
    session = dbm.db.machineAssignments.find_one({"machineId": machine_id, "status": "ACTIVE"}, NO_ID)
    if session and session["orderId"] != order["orderId"]:
        raise HTTPException(409, TAKEN)
    if machine["status"] == "RUNNING" and holder != order["orderId"]:
        raise HTTPException(409, TAKEN)
    return machine


def _claim_machine(machine: dict, order: dict) -> dict:
    """Assign the machine to the order, only if it is still in the state we checked. Returns what to restore on failure."""
    before = {k: machine.get(k) for k in ("status", "currentOrderId", "producedMeters", "targetMeters")}
    changes = {"currentOrderId": order["orderId"], "status": "IDLE"}
    if machine.get("currentOrderId") != order["orderId"]:
        changes.update(producedMeters=0, targetMeters=max(0, order["quantityMeters"] - order["producedMeters"]))
    result = dbm.machines().update_one({"machineId": machine["machineId"], "status": machine["status"],
                                        "currentOrderId": machine.get("currentOrderId")}, {"$set": changes})
    if not result.matched_count:
        raise HTTPException(409, TAKEN)
    return before


def _restore_machine(machine_id: str, before: dict) -> None:
    dbm.machines().update_one({"machineId": machine_id}, {"$set": before})


def _release_machine(machine_id: str, order_id: str) -> None:
    """Free a machine from the order. Counters and history stay; a RUNNING machine is stopped."""
    dbm.machines().update_one({"machineId": machine_id, "currentOrderId": order_id}, {"$set": {"currentOrderId": None}})
    dbm.machines().update_one({"machineId": machine_id, "currentOrderId": None, "status": "RUNNING"}, {"$set": {"status": "IDLE"}})


def available_machines(order_id: str) -> list:
    order = _order(order_id)
    rows = []
    for m in dbm.machines().find({}, NO_ID).sort("machineId", 1):
        try:
            _check_machine(m["machineId"], order)
        except HTTPException:
            continue
        rows.append({"machineId": m["machineId"], "name": m.get("name"), "status": m["status"]})
    return rows


# ---------- pause ----------

def pause(order_id: str, reason: str, notes, user: dict) -> dict:
    with sim_lock:
        order = _order(order_id)
        if order.get("status") == "CANCELLED":
            raise HTTPException(409, "Order is already cancelled.")
        if order.get("status") in FINISHED:
            raise HTTPException(409, "Only an in-progress order can be paused.")
        order = quality_gate.ensure_gated(order)
        old = order["stageStatus"]
        if old == "PAUSED":
            raise HTTPException(409, "Order is already paused.")
        # A pending inspection request is closed as superseded by the pause (see the audit entry)
        if old not in ("IN_PROGRESS", "QC_PENDING"):
            raise HTTPException(409, "Only an in-progress order can be paused.")
        order_id, stage, now = order["orderId"], order["currentStage"], _now()
        machines = _machines_of(order_id)
        superseded = order.get("pendingInspectionType") if old == "QC_PENDING" else None
        updated = _swap(order_id, {"stageStatus": old, "status": {"$ne": "CANCELLED"}},
                        {"stageStatus": "PAUSED", "pausedFromStatus": old, "pausedAt": now, "pausedBy": user["email"],
                         "pauseReason": reason, "pauseNotes": notes, "pausedMachines": machines,
                         "pendingInspectionType": None, "productionBlocked": False, "productionBlockReason": None},
                        "Order state changed while pausing. Reload and try again.")
        machine_sessions.close_for_order(order_id, user, reason)
        dbm.machines().update_many({"machineId": {"$in": machines}, "currentOrderId": order_id}, {"$set": {"status": "IDLE"}})
        profitability.refresh_order(order_id)
        audit.record("ORDER_PAUSED", order_id, user, stage, {"stageStatus": old}, {"stageStatus": "PAUSED"},
                     machine_id=machines[0] if machines else order.get("machineId"), reason=reason, notes=notes, machines=machines)
        if superseded:
            audit.record("QC_REQUEST_SUPERSEDED", order_id, user, stage, {"pendingInspectionType": superseded},
                         {"pendingInspectionType": None}, reason="ORDER_PAUSED")
        return updated


# ---------- resume ----------

def resume(order_id: str, machine_id, user: dict) -> dict:
    with sim_lock:
        order = _order(order_id)
        if order.get("status") == "CANCELLED":
            raise HTTPException(409, "Cannot resume a cancelled order.")
        if order.get("stageStatus") != "PAUSED":
            raise HTTPException(409, "Only a paused order can be resumed.")
        order_id, paused = order["orderId"], list(order.get("pausedMachines") or [])
        wanted = [normalize_id(machine_id)] if machine_id else paused
        claimed, restore = [], {}
        for i, mid in enumerate(wanted):
            try:
                restore[mid] = _claim_machine(_check_machine(mid, order), order)
                claimed.append(mid)
            except HTTPException:
                if i == 0:  # the main machine must be usable; the others are skipped quietly
                    for done, before in restore.items():
                        _restore_machine(done, before)
                    raise
        try:
            updated = _swap(order_id, {"stageStatus": "PAUSED", "pausedAt": order.get("pausedAt"), "status": {"$ne": "CANCELLED"}},
                            {"stageStatus": "IN_PROGRESS", "pausedMachines": [], "resumedAt": _now(), "resumedBy": user["email"],
                             **({"machineId": claimed[0]} if claimed else {})},
                            "Order state changed while resuming. Reload and try again.")
        except HTTPException:
            for done, before in restore.items():
                _restore_machine(done, before)
            raise
        for mid in paused:  # machines that are not used any more are freed
            if mid not in claimed:
                _release_machine(mid, order_id)
        stage = quality_gate.gate_view(updated)["currentStage"]
        for mid in claimed:
            machine_sessions.open_session(updated, mid, user, stage)
            if incomplete(updated):
                dbm.machines().update_one({"machineId": mid, "currentOrderId": order_id}, {"$set": {"status": "RUNNING"}})
        old_main = paused[0] if paused else order.get("machineId")
        if claimed and old_main and claimed[0] != old_main:
            audit.record("MACHINE_CHANGED", order_id, user, stage, {"machineId": old_main}, {"machineId": claimed[0]},
                         machine_id=claimed[0], reason="RESUME_ON_DIFFERENT_MACHINE")
        profitability.refresh_order(order_id)
        audit.record("ORDER_RESUMED", order_id, user, stage, {"stageStatus": "PAUSED"}, {"stageStatus": "IN_PROGRESS"},
                     machine_id=claimed[0] if claimed else None, machines=claimed)
        return updated


# ---------- change machine ----------

def change_machine(order_id: str, new_machine_id: str, reason: str, notes, user: dict) -> dict:
    with sim_lock:
        order = _order(order_id)
        if order.get("status") == "CANCELLED":
            raise HTTPException(409, "Order is already cancelled.")
        if order.get("stageStatus") != "PAUSED":
            raise HTTPException(409, "Order must be paused before changing machine")
        order_id, new_id = order["orderId"], normalize_id(new_machine_id)
        paused = list(order.get("pausedMachines") or [])
        current = paused[0] if paused else order.get("machineId")
        if new_id == current or new_id in paused:
            raise HTTPException(409, "Select a machine other than the current one.")
        before = _claim_machine(_check_machine(new_id, order), order)
        try:
            updated = _swap(order_id, {"stageStatus": "PAUSED", "pausedAt": order.get("pausedAt"), "status": {"$ne": "CANCELLED"}},
                            {"machineId": new_id, "pausedMachines": [new_id] + paused[1:], "pendingInspectionType": None},
                            "Order state changed while changing machine. Reload and try again.")
        except HTTPException:
            _restore_machine(new_id, before)
            raise
        if current:
            _release_machine(current, order_id)
        profitability.refresh_order(order_id)
        audit.record("MACHINE_CHANGED", order_id, user, order.get("currentStage"), {"machineId": current}, {"machineId": new_id},
                     machine_id=new_id, reason=reason, notes=notes)
        return updated


# ---------- cancel ----------

def _release_reservations(order_id: str) -> None:
    """Unused reserved yarn becomes available stock again. Consumed material is untouched."""
    for r in list(dbm.db.materialReservations.find({"orderId": order_id, "quantityKg": {"$gt": 0}})):
        done = dbm.db.materialReservations.update_one({"_id": r["_id"], "quantityKg": r["quantityKg"]},
                                                      {"$set": {"quantityKg": 0, "releasedAt": _now()}})
        if done.matched_count:
            dbm.inventory().update_one({"batchId": r["batchId"]}, {"$inc": {"reservedKg": -r["quantityKg"]}})


def cancel(order_id: str, reason: str, notes, user: dict) -> dict:
    with sim_lock:
        order = _order(order_id)
        if order.get("status") == "CANCELLED":
            raise HTTPException(409, "Order is already cancelled.")
        if order.get("status") in FINISHED:
            raise HTTPException(409, "A dispatched order cannot be cancelled.")
        order_id = order["orderId"]
        view = quality_gate.gate_view(order)
        superseded = order.get("pendingInspectionType") if view["stageStatus"] == "QC_PENDING" else None
        updated = _swap(order_id, {"status": order["status"]},
                        {"status": "CANCELLED", "previousStatus": order["status"], "cancelledAt": _now(), "cancelledBy": user["email"],
                         "cancelReason": reason, "cancelNotes": notes, "cancelledAtStage": view["currentStage"],
                         "cancelledAtStageStatus": view["stageStatus"], "cancelledAtMeters": order.get("producedMeters", 0)},
                        "Order state changed while cancelling. Reload and try again.")
        machines = _machines_of(order_id) + [m["machineId"] for m in dbm.machines().find({"currentOrderId": order_id}, NO_ID)]
        machine_sessions.close_for_order(order_id, user, reason)
        for mid in dict.fromkeys(machines):
            _release_machine(mid, order_id)
        _release_reservations(order_id)
        profitability.refresh_order(order_id)
        audit.record("ORDER_CANCELLED", order_id, user, view["currentStage"],
                     {"status": order["status"], "stageStatus": view["stageStatus"]}, {"status": "CANCELLED"},
                     machine_id=order.get("machineId"), reason=reason, notes=notes)
        if superseded:
            audit.record("QC_REQUEST_SUPERSEDED", order_id, user, view["currentStage"], {"pendingInspectionType": superseded},
                         {"pendingInspectionType": None}, reason="ORDER_CANCELLED")
        return updated

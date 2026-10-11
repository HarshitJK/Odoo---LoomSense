from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from app.services.auth import current_user, management, owner

from app import database as dbm
from app.models.order import (
    CancelRequest, ChangeMachineRequest, Order, OrderCreate, OrderUpdate, PauseRequest, ReadinessRequest, ResumeRequest,
)
from app.services import audit, costing, machine_sessions, order_readiness, production_control, profitability, quality_gate, tracking
from app.utils.ids import next_order_id
from app.utils.tokens import new_tracking_token

router = APIRouter()
NO_ID = {"_id": 0}


@router.get("")
def list_orders(status: Optional[str] = None, user=Depends(current_user)):
    query = {"status": status} if status else {}
    return [order_view(o, user) for o in dbm.orders().find(query, NO_ID).sort("orderId", 1)]


@router.post("/readiness-check")
def readiness_check(body: ReadinessRequest):
    """Readiness and projected margin for an order that does not exist yet."""
    return order_readiness.check_readiness(request=body.model_dump())


@router.get("/{order_id}")
def get_order(order_id: str, user=Depends(current_user)):
    order_id = normalize_id(order_id)
    return order_view(costing.get_order(order_id), user)


@router.get("/{order_id}/cost", dependencies=[Depends(owner)])
def order_cost(order_id: str):
    order_id = normalize_id(order_id)
    return costing.calculate_order_cost(order_id)


@router.get("/{order_id}/readiness")
def order_readiness_check(order_id: str):
    order_id = normalize_id(order_id)
    return order_readiness.check_readiness(order_id=order_id)


@router.post("", status_code=201)
def create_order(body: OrderCreate, user=Depends(current_user)):
    doc = Order(
        orderId=next_order_id(),
        orderDate=date.today().isoformat(),
        **body.model_dump(),
    ).model_dump()
    doc.update(createdAt=datetime.now(timezone.utc).isoformat(), updatedAt=datetime.now(timezone.utc).isoformat(), productionHistoryComplete=True, materialHistoryComplete=True)
    doc.update(quality_gate.new_order_fields(doc["quantityMeters"]))
    dbm.orders().insert_one(doc)
    profitability.refresh_order(doc["orderId"])
    return order_view(costing.get_order(doc["orderId"]), user)


@router.patch("/{order_id}")
def update_order(order_id: str, body: OrderUpdate, user=Depends(current_user)):
    order_id = normalize_id(order_id)
    changes = body.model_dump(exclude_unset=True)
    changes["updatedAt"] = datetime.now(timezone.utc).isoformat()
    existing = dbm.orders().find_one({"orderId": order_id}, NO_ID)
    if existing and existing.get("status") == "CANCELLED":
        raise HTTPException(409, "Order is already cancelled.")
    if changes.get("status") == "CANCELLED":
        raise HTTPException(409, "Use the cancel action to cancel an order.")
    if existing and quality_gate.is_gated(existing) and "status" in changes:
        raise HTTPException(409, "This order moves through quality-gated stages. Use the stage complete and advance actions.")
    if changes:
        result = dbm.orders().update_one({"orderId": order_id}, {"$set": changes})
        if result.matched_count == 0:
            raise HTTPException(404, f"Order {order_id} not found")
    profitability.refresh_order(order_id)
    return order_view(costing.get_order(order_id), user)


@router.post("/{order_id}/stage/complete")
def complete_stage(order_id: str, user=Depends(current_user)):
    """The current stage is finished: it waits for its quality inspection (or is complete if it needs none)."""
    return order_view(quality_gate.complete_stage(order_id), user)


@router.post("/{order_id}/stage/advance")
def advance_stage(order_id: str, user=Depends(current_user)):
    """Move to the next stage. 409 unless the current stage's quality inspection passed and there is no hold."""
    return order_view(quality_gate.advance_stage(order_id), user)


@router.post("/{order_id}/pause")
def pause_order(order_id: str, body: PauseRequest, user=Depends(management)):
    """Stop production: the order is PAUSED, its machine session closes and the machine goes IDLE."""
    return order_view(production_control.pause(order_id, body.reason, body.notes, user), user)


@router.post("/{order_id}/resume")
def resume_order(order_id: str, body: ResumeRequest = ResumeRequest(), user=Depends(management)):
    """Continue a paused order. A new machine session starts (never an old one reopened)."""
    return order_view(production_control.resume(order_id, body.machineId, user), user)


@router.post("/{order_id}/change-machine")
def change_machine(order_id: str, body: ChangeMachineRequest, user=Depends(management)):
    """Move a PAUSED order to another machine. Resume afterwards to start the new session."""
    return order_view(production_control.change_machine(order_id, body.newMachineId, body.reason, body.notes, user), user)


@router.post("/{order_id}/cancel")
def cancel_order(order_id: str, body: CancelRequest, user=Depends(owner)):
    """Owner only. Soft cancel: history and costs stay, production stops for good."""
    return order_view(production_control.cancel(order_id, body.reason, body.notes, user), user)


@router.get("/{order_id}/machine-history")
def machine_history(order_id: str):
    order_id = normalize_id(order_id)
    costing.get_order(order_id)
    return machine_sessions.history(order_id)


@router.get("/{order_id}/available-machines")
def available_machines(order_id: str):
    """Machines this order could be moved to (usable and not on another incomplete order)."""
    return production_control.available_machines(order_id)


@router.get("/{order_id}/audit")
def order_audit(order_id: str):
    order_id = normalize_id(order_id)
    costing.get_order(order_id)
    return audit.for_order(order_id)


@router.post("/{order_id}/tracking/regenerate")
def regenerate_tracking(order_id: str, user=Depends(current_user)):
    """New private link; the old one stops working immediately."""
    token = new_tracking_token()
    updated = dbm.orders().find_one_and_update(
        {"orderId": normalize_id(order_id)},
        {"$set": {"trackingToken": token, "updatedAt": datetime.now(timezone.utc).isoformat()}},
        projection=NO_ID,
    )
    if not updated:
        raise HTTPException(404, f"Order {normalize_id(order_id)} not found")
    return {"orderId": updated["orderId"], "trackingToken": token, "trackingUrl": tracking.tracking_url(token)}


def order_view(order, user):
    if user["role"] != "OWNER":
        order = {k: v for k, v in order.items() if k not in ("costs", "profit", "margin", "paidAmount", "otherCost", "yarnConsumedKg")}
    if order.get("trackingToken"):
        order = {**order, "trackingUrl": tracking.tracking_url(order["trackingToken"])}
    return {**order, **quality_gate.gate_view(order)}


from pydantic import BaseModel, Field
from app.services import materials, machine_simulator
from app.utils.ids import normalize_id


class Reservation(BaseModel):
    batchId: str
    quantityKg: float = Field(gt=0, allow_inf_nan=False)


@router.post("/{order_id}/reserve")
def reserve_material(order_id: str, body: Reservation):
    with machine_simulator.sim_lock:
        return materials.reserve(normalize_id(order_id), normalize_id(body.batchId), body.quantityKg)

"""Stage-gated quality control.

An order moves through the stages in config.QC_STAGES. Finishing a stage puts it in QC_PENDING and it can
only move on when its stage inspection PASSED. A FAILED or REWORK inspection puts the order on QUALITY_HOLD:
nothing advances and the simulator leaves the order alone until a corrective action is recorded and a
REINSPECTION passes. Failed inspections are never changed or deleted; the reinspection is a new record.

Old orders (no currentStage) are not gated. Old quality records (no stage) are final-QC rolls.
Everything here is enforced in the backend; the UI only shows the state.
"""
from collections import Counter
from datetime import date, datetime

from fastapi import HTTPException

from app import database as dbm
from app.config import (
    DEFAULT_SAMPLE_METERS, FIRST_OFF_STAGE, QC_MANDATORY_STAGES, QC_STAGE_BUYER_INDEX, QC_STAGE_STATUS,
    QC_STAGES, YARN_KG_PER_METRE,
)
from app.services import costing, profitability
from app.utils.ids import next_inspection_id, next_roll_id, normalize_id

NO_ID = {"_id": 0}
FAILED = ("FAILED", "REWORK")
STAGE_INSPECTION_TYPES = ("STAGE", "FINAL", "REINSPECTION")
STAGE_LABEL = {"RAW_MATERIAL": "Raw material", "WEAVING": "Weaving", "PROCESSING": "Processing",
               "FINISHING": "Finishing", "FINAL_QC": "Final QC", "DISPATCH": "Dispatch"}
# Old order status -> stage, for orders that were created before stage gating
LEGACY_STAGE = {"NEW": "RAW_MATERIAL", "PENDING": "RAW_MATERIAL", "SPINNING": "RAW_MATERIAL", "WEAVING": "WEAVING",
                "DYEING": "PROCESSING", "QUALITY_CHECK": "FINAL_QC", "REWORK": "FINAL_QC",
                "READY_FOR_DISPATCH": "DISPATCH", "DISPATCHED": "DISPATCH", "COMPLETED": "DISPATCH", "DELIVERED": "DISPATCH"}
CRITICAL_ONLY = "FULL_RESTART"


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def is_gated(order: dict) -> bool:
    return bool(order and order.get("currentStage"))


def new_order_fields(quantity: float = 0) -> dict:
    """Gate fields for a new order: starts at the first stage and needs a first-off inspection."""
    sample = min(DEFAULT_SAMPLE_METERS, quantity) if quantity else DEFAULT_SAMPLE_METERS
    return {"currentStage": QC_STAGES[0], "stageStatus": "IN_PROGRESS", "pendingInspectionType": None,
            "qualityHold": None, "productionBlocked": False, "productionBlockReason": None,
            "requiresFirstOffQc": True, "firstOffPassed": False, "sampleMeters": sample}


def gate_view(order: dict) -> dict:
    """Gate fields for API responses. Old orders get a derived stage (not stored) and gated: False."""
    if is_gated(order):
        keys = ("currentStage", "stageStatus", "pendingInspectionType", "qualityHold", "productionBlocked",
                "productionBlockReason", "requiresFirstOffQc", "firstOffPassed", "sampleMeters")
        return {**{k: order.get(k) for k in keys}, "gated": True}
    stage = LEGACY_STAGE.get(order.get("status"), QC_STAGES[0])
    return {"currentStage": stage, "stageStatus": "IN_PROGRESS", "pendingInspectionType": None, "qualityHold": None,
            "productionBlocked": False, "productionBlockReason": None, "requiresFirstOffQc": False,
            "firstOffPassed": True, "sampleMeters": order.get("sampleMeters", DEFAULT_SAMPLE_METERS), "gated": False}


# ---------- small helpers ----------

def _order_or_404(order_id: str) -> dict:
    order_id = normalize_id(order_id)
    order = dbm.orders().find_one({"orderId": order_id}, NO_ID)
    if not order:
        raise HTTPException(404, f"Order {order_id} not found")
    return order


def _set(order_id: str, changes: dict) -> dict:
    changes["updatedAt"] = now_iso()
    dbm.orders().update_one({"orderId": order_id}, {"$set": changes})
    return dbm.orders().find_one({"orderId": order_id}, NO_ID)


def ensure_gated(order: dict) -> dict:
    """Start gating an old order at the stage its status shows. It does not need a first-off inspection."""
    if is_gated(order):
        return order
    stage = LEGACY_STAGE.get(order.get("status"), QC_STAGES[0])
    changes = {**new_order_fields(order.get("quantityMeters", 0)), "currentStage": stage,
               "requiresFirstOffQc": False, "firstOffPassed": True}
    if stage == "FINAL_QC":
        changes.update(stageStatus="QC_PENDING", pendingInspectionType="FINAL")
    return _set(order["orderId"], changes)


def stage_index(stage: str) -> int:
    return QC_STAGES.index(stage)


def next_stage(stage: str):
    i = stage_index(stage)
    return QC_STAGES[i + 1] if i + 1 < len(QC_STAGES) else None


def effective_stage(rec: dict) -> str:
    return rec.get("stage") or "FINAL_QC"  # records without a stage are old final-QC rolls


def effective_type(rec: dict) -> str:
    return rec.get("inspectionType") or "FINAL"


def _sort_key(rec: dict):
    return (rec.get("createdAt") or rec.get("producedAt") or rec.get("date") or "", rec.get("inspectionId") or rec.get("rollId") or "")


def inspections_of(order_id: str) -> list:
    return sorted(dbm.quality_checks().find({"orderId": order_id}, NO_ID), key=_sort_key)


def latest_stage_inspection(order_id: str, stage: str, records: list = None):
    """Latest inspection that decides whether `stage` may advance (first-off and incoming checks do not)."""
    records = inspections_of(order_id) if records is None else records
    decisive = [r for r in records if effective_stage(r) == stage and effective_type(r) in STAGE_INSPECTION_TYPES]
    return decisive[-1] if decisive else None


def final_passed(order_id: str) -> bool:
    latest = latest_stage_inspection(order_id, "FINAL_QC")
    return bool(latest and latest.get("status") == "PASSED")


def find_inspection(inspection_id: str) -> dict:
    rec = dbm.quality_checks().find_one({"inspectionId": inspection_id}, NO_ID)
    if not rec:
        raise HTTPException(404, f"Inspection {inspection_id} not found")
    return rec


def _default_rework_status(status: str) -> str:
    return {"FAILED": "PENDING", "REWORK": "IN_PROGRESS"}.get(status, "NOT_REQUIRED")


def _scrap_estimate(order: dict, rec: dict) -> float:
    batch = dbm.inventory().find_one({"batchId": rec.get("yarnBatch") or order.get("yarnBatch")}, NO_ID)
    price = batch["costPerKg"] if batch else costing.yarn_price(order)
    return costing.calculate_rework_impact(rec.get("affectedMeters", 0), price)["materialLoss"]


# ---------- stage movement ----------

def complete_stage(order_id: str) -> dict:
    """The current stage is finished. Stages that need QC become QC_PENDING; the others are complete."""
    order = ensure_gated(_order_or_404(order_id))
    stage, status = order["currentStage"], order["stageStatus"]
    if status == "QUALITY_HOLD":
        raise HTTPException(409, f"Order is on quality hold at {stage}. Record a corrective action and pass a reinspection first.")
    if status == "QC_PENDING":
        what = "the first-off inspection" if order.get("pendingInspectionType") == "FIRST_OFF" else "its quality inspection"
        raise HTTPException(409, f"{stage} is already waiting for {what}.")
    if status == "COMPLETE":
        raise HTTPException(409, f"{stage} is already complete. Advance the order to the next stage.")
    if stage == FIRST_OFF_STAGE:
        if order.get("requiresFirstOffQc") and not order.get("firstOffPassed"):
            raise HTTPException(409, f"{stage} needs a passed FIRST_OFF inspection before it can be completed.")
        if order.get("producedMeters", 0) < order.get("quantityMeters", 0):
            raise HTTPException(409, f"{stage} is not finished: {round(order.get('producedMeters', 0))} of "
                                     f"{round(order.get('quantityMeters', 0))} m woven.")
    if stage in QC_MANDATORY_STAGES:
        return _set(order_id, {"stageStatus": "QC_PENDING", "productionBlocked": False, "productionBlockReason": None,
                               "pendingInspectionType": "FINAL" if stage == "FINAL_QC" else "STAGE"})
    changes = {"stageStatus": "COMPLETE", "pendingInspectionType": None}
    if stage == QC_STAGES[-1]:
        changes["status"] = "DISPATCHED"
    return _set(order_id, changes)


def advance_stage(order_id: str) -> dict:
    """Move to the next stage. Refused (409) unless the current stage's mandatory inspection PASSED."""
    order = ensure_gated(_order_or_404(order_id))
    stage, status = order["currentStage"], order["stageStatus"]
    target = next_stage(stage)
    if target is None:
        raise HTTPException(409, f"Order is already at the last stage ({stage}).")
    if status == "QUALITY_HOLD":
        raise HTTPException(409, f"Order cannot advance to {target} while {stage} is on quality hold.")
    blocked = HTTPException(409, f"Order cannot advance to {target} until {stage} QC passes.")
    if status in ("IN_PROGRESS", "QC_PENDING"):
        if stage in QC_MANDATORY_STAGES:
            raise blocked
        raise HTTPException(409, f"Order cannot advance to {target} until {stage} is completed.")
    if stage in QC_MANDATORY_STAGES:  # stageStatus says COMPLETE; check the record too
        latest = latest_stage_inspection(order["orderId"], stage)
        if not latest or latest.get("status") != "PASSED":
            raise blocked
    changes = {"currentStage": target, "stageStatus": "IN_PROGRESS", "pendingInspectionType": None,
               "productionBlocked": False, "productionBlockReason": None, "status": QC_STAGE_STATUS[target]}
    if target == "FINAL_QC":  # nothing is produced at final QC: it goes straight to its inspection
        changes.update(stageStatus="QC_PENDING", pendingInspectionType="FINAL")
    return _set(order["orderId"], changes)


# ---------- production control (the simulator and machine readings use these) ----------

def production_allowed(order: dict) -> bool:
    """False while a gated order is on hold, waiting for first-off or QC, or not in its weaving stage."""
    if not is_gated(order):
        return True
    return (order["currentStage"] == FIRST_OFF_STAGE and order["stageStatus"] == "IN_PROGRESS"
            and not order.get("productionBlocked"))


def prepare_for_production(order: dict) -> dict:
    """A machine is running on an order still at raw material: that stage is done, so weaving starts."""
    if is_gated(order) and order["currentStage"] == QC_STAGES[0] and order["stageStatus"] == "IN_PROGRESS" \
            and not order.get("productionBlocked"):
        complete_stage(order["orderId"])
        return advance_stage(order["orderId"])
    return order


def limit_for_first_off(order: dict, step: float) -> float:
    """Do not weave past the sample length until the first-off inspection has passed."""
    if is_gated(order) and order.get("requiresFirstOffQc") and not order.get("firstOffPassed"):
        return max(0.0, min(step, order.get("sampleMeters", DEFAULT_SAMPLE_METERS) - order.get("producedMeters", 0)))
    return step


def after_production(order_id: str):
    """Call after metres were added. Returns "first_off", "stage_finished" or None."""
    order = dbm.orders().find_one({"orderId": order_id}, NO_ID)
    if not is_gated(order) or order["currentStage"] != FIRST_OFF_STAGE or order["stageStatus"] != "IN_PROGRESS":
        return None
    produced = order.get("producedMeters", 0)
    sample = order.get("sampleMeters", DEFAULT_SAMPLE_METERS)
    if order.get("requiresFirstOffQc") and not order.get("firstOffPassed") and produced >= sample - 1e-6:
        _set(order_id, {"stageStatus": "QC_PENDING", "pendingInspectionType": "FIRST_OFF", "productionBlocked": True,
                        "productionBlockReason": f"Waiting for the first-off inspection after {round(sample)} m"})
        return "first_off"
    if produced >= order.get("quantityMeters", 0):
        _set(order_id, {"stageStatus": "QC_PENDING", "pendingInspectionType": "STAGE"})
        return "stage_finished"
    return None


# ---------- inspections ----------

def _validate_corrective(action, severity):
    if action == CRITICAL_ONLY and severity != "CRITICAL":
        raise HTTPException(422, "FULL_RESTART is only accepted for CRITICAL severity.")


def create_inspection(data: dict, user: dict) -> tuple:
    """Store a stage-gated inspection and apply its effect on the order. Returns (record, marginBefore, marginAfter)."""
    if not data.get("orderId"):
        raise HTTPException(422, "orderId is required for a stage inspection.")
    order = ensure_gated(_order_or_404(data["orderId"]))
    hold = order.get("qualityHold")
    failed_rec = None

    itype = data.get("inspectionType") or ("REINSPECTION" if data.get("reinspectionOf") else None)
    stage = data.get("stage")
    if itype == "REINSPECTION":
        if not data.get("reinspectionOf"):
            raise HTTPException(422, "A REINSPECTION needs reinspectionOf (the failed inspection id).")
        failed_rec = find_inspection(data["reinspectionOf"])
        if failed_rec.get("orderId") != order["orderId"]:
            raise HTTPException(422, "reinspectionOf belongs to a different order.")
        if failed_rec.get("status") not in FAILED:
            raise HTTPException(409, f"Inspection {failed_rec['inspectionId']} did not fail, so it cannot be reinspected.")
        if not hold or hold.get("failedInspectionId") != failed_rec["inspectionId"]:
            raise HTTPException(409, f"Order is not waiting for a reinspection of {failed_rec['inspectionId']}.")
        if failed_rec.get("correctiveAction") is None:
            raise HTTPException(409, f"Record a corrective action on {failed_rec['inspectionId']} before reinspecting.")
        stage = effective_stage(failed_rec)
    else:
        if data.get("reinspectionOf"):
            raise HTTPException(422, "reinspectionOf is only for REINSPECTION inspections.")
        stage = stage or order["currentStage"]
        itype = itype or ("INCOMING_MATERIAL" if stage == QC_STAGES[0] else "FINAL" if stage == "FINAL_QC" else "STAGE")
    if stage not in QC_STAGES:
        raise HTTPException(422, f"stage must be one of {', '.join(QC_STAGES)}.")
    if itype == "FIRST_OFF" and stage != FIRST_OFF_STAGE:
        raise HTTPException(422, f"FIRST_OFF inspections are for the {FIRST_OFF_STAGE} stage.")
    if itype == "INCOMING_MATERIAL" and stage != QC_STAGES[0]:
        raise HTTPException(422, f"INCOMING_MATERIAL inspections are for the {QC_STAGES[0]} stage.")
    if itype == "FINAL" and stage != "FINAL_QC":
        raise HTTPException(422, "FINAL inspections are for the FINAL_QC stage.")
    if itype == "STAGE" and stage == "FINAL_QC":
        raise HTTPException(422, "Use inspectionType FINAL for the FINAL_QC stage.")

    status = data.get("status", "PENDING")
    if status in FAILED and not data.get("defectSeverity"):
        raise HTTPException(422, "defectSeverity is required when an inspection does not pass.")
    _validate_corrective(data.get("correctiveAction"), data.get("defectSeverity"))

    # State rules
    if stage != order["currentStage"]:
        raise HTTPException(409, f"Order is at {order['currentStage']}, not {stage}.")
    if hold and itype != "REINSPECTION":
        raise HTTPException(409, "Order is on quality hold. Record a reinspection of the failed inspection.")
    state, pending = order["stageStatus"], order.get("pendingInspectionType")
    if itype in ("STAGE", "FINAL") and not (state == "QC_PENDING" and pending == itype):
        if state == "QC_PENDING" and pending == "FIRST_OFF":
            raise HTTPException(409, f"{stage} is waiting for the first-off inspection first.")
        raise HTTPException(409, f"Complete {stage} before its quality inspection.")
    if itype == "FIRST_OFF" and order.get("firstOffPassed"):
        raise HTTPException(409, "The first-off inspection has already passed for this order.")

    # Build the record
    if itype == "FINAL" and not data.get("rollId"):
        roll_id = next_roll_id()
    elif data.get("rollId"):
        roll_id = normalize_id(data["rollId"])
        if dbm.quality_checks().find_one({"rollId": roll_id}):
            raise HTTPException(409, f"Roll {roll_id} already exists")
    else:
        roll_id = None
    stamp = now_iso()
    day = data.get("inspectionDate") or date.today().isoformat()
    defects = list(data.get("defects") or [])
    if data.get("defectType") and data["defectType"] not in defects:
        defects.insert(0, data["defectType"])
    rec = {
        "inspectionId": next_inspection_id(), "rollId": roll_id, "orderId": order["orderId"],
        "machineId": data.get("machineId") or order.get("machineId"),
        "yarnBatch": data.get("yarnBatch") or order.get("yarnBatch"), "shift": data.get("shift"),
        "buyerName": order.get("buyerName"), "status": status, "defects": defects if status != "PASSED" else [],
        "affectedMeters": data.get("affectedMeters", 0) if status != "PASSED" else 0,
        "reworkStatus": data.get("reworkStatus") or _default_rework_status(status),
        "reworkCost": data.get("reworkCost", 0), "impact": None, "date": day, "producedAt": stamp,
        "stage": stage, "inspectionType": itype,
        "defectType": data.get("defectType") if status != "PASSED" else None,
        "defectSeverity": data.get("defectSeverity") if status != "PASSED" else None,
        "inspectorId": user.get("email"), "notes": data.get("notes"),
        "correctiveAction": data.get("correctiveAction") if status in FAILED else None,
        "additionalLabourCost": data.get("additionalLabourCost", 0), "additionalMachineCost": data.get("additionalMachineCost", 0),
        "scrapMaterialCost": data.get("scrapMaterialCost", 0), "reinspectionOf": data.get("reinspectionOf"),
        "inspectionDate": day, "createdAt": stamp, "updatedAt": stamp,
    }
    if status in FAILED and rec["affectedMeters"] > 0 and not any(
            rec[k] for k in ("reworkCost", "additionalLabourCost", "additionalMachineCost", "scrapMaterialCost")):
        # No costs given: estimate them the way the old roll check did (labour, machine time and yarn lost)
        batch = dbm.inventory().find_one({"batchId": rec["yarnBatch"]}, NO_ID) if rec["yarnBatch"] else None
        impact = costing.calculate_rework_impact(rec["affectedMeters"], batch["costPerKg"] if batch else costing.yarn_price(order))
        rec.update(additionalLabourCost=impact["additionalLabour"], additionalMachineCost=impact["machineCost"],
                   scrapMaterialCost=impact["materialLoss"])
    elif status in FAILED and rec["correctiveAction"] == "SCRAP_AFFECTED_QUANTITY" and not rec["scrapMaterialCost"] \
            and rec["affectedMeters"] > 0:
        rec["scrapMaterialCost"] = _scrap_estimate(order, rec)
    rec["impact"] = _impact(rec)

    margin_before = profitability.order_profit(order["orderId"])["margin"]
    dbm.quality_checks().insert_one(dict(rec))
    _apply_effects(order, rec, failed_rec)
    margin_after = profitability.refresh_order(order["orderId"])["margin"]
    return rec, margin_before, margin_after


def _impact(rec: dict) -> dict:
    return {"rework": rec.get("reworkCost", 0), "additionalLabour": rec.get("additionalLabourCost", 0),
            "machineCost": rec.get("additionalMachineCost", 0), "materialLoss": rec.get("scrapMaterialCost", 0),
            "total": costing.quality_loss(rec)}


def _apply_effects(order: dict, rec: dict, failed_rec) -> None:
    oid, stage, itype = order["orderId"], rec["stage"], rec["inspectionType"]
    produced, quantity = order.get("producedMeters", 0), order.get("quantityMeters", 0)
    if rec["status"] in FAILED:
        previous = order.get("qualityHold") or {}
        label = rec.get("defectType") or (rec["defects"][0] if rec.get("defects") else "quality problem")
        reason = f"{STAGE_LABEL[stage]} {itype.replace('_', ' ').lower()} inspection failed: {label}"
        _set(oid, {"stageStatus": "QUALITY_HOLD", "pendingInspectionType": None, "productionBlocked": True,
                   "productionBlockReason": reason,
                   "qualityHold": {"holdReason": reason, "failedInspectionId": rec["inspectionId"], "failedStage": stage,
                                   "failedInspectionType": itype, "defectType": rec.get("defectType"),
                                   "defectSeverity": rec.get("defectSeverity"), "affectedMeters": rec.get("affectedMeters", 0),
                                   "holdStartedAt": previous.get("holdStartedAt") or rec["createdAt"]}})
    elif rec["status"] == "PASSED":
        if itype == "FIRST_OFF":
            _set(oid, _after_first_off(produced, quantity))
        elif itype == "REINSPECTION":
            _release_hold(order, failed_rec)
        elif itype in ("STAGE", "FINAL"):
            _set(oid, {"stageStatus": "COMPLETE", "pendingInspectionType": None})


def _after_first_off(produced: float, quantity: float) -> dict:
    changes = {"firstOffPassed": True, "productionBlocked": False, "productionBlockReason": None}
    if produced >= quantity:
        changes.update(stageStatus="QC_PENDING", pendingInspectionType="STAGE")
    else:
        changes.update(stageStatus="IN_PROGRESS", pendingInspectionType=None)
    return changes


def _release_hold(order: dict, failed_rec: dict) -> None:
    """A reinspection passed: lift the hold and let production continue as the corrective action decided."""
    oid, stage = order["orderId"], effective_stage(failed_rec)
    action = failed_rec.get("correctiveAction")
    produced = order.get("producedMeters", 0)
    base = {"qualityHold": None, "productionBlocked": False, "productionBlockReason": None, "pendingInspectionType": None}
    if effective_type(failed_rec) == "FIRST_OFF":
        _set(oid, {**base, **_after_first_off(produced, order.get("quantityMeters", 0))})
    elif action == "FULL_RESTART":
        first = QC_STAGES[1]
        _set(oid, {**base, "currentStage": first, "stageStatus": "IN_PROGRESS", "producedMeters": 0,
                   "firstOffPassed": False, "status": QC_STAGE_STATUS[first]})
    elif action == "RESTART_FROM_CHECKPOINT" or (action == "SCRAP_AFFECTED_QUANTITY" and stage == FIRST_OFF_STAGE):
        changes = {**base, "stageStatus": "IN_PROGRESS"}
        if stage == FIRST_OFF_STAGE:  # the affected metres are woven again; earlier production history stays
            changes["producedMeters"] = max(0.0, round(produced - failed_rec.get("affectedMeters", 0), 2))
        _set(oid, changes)
    else:
        _set(oid, {**base, "stageStatus": "COMPLETE"})


def set_corrective_action(inspection_id: str, body: dict, user: dict) -> dict:
    """Record the corrective action on a failed inspection (once). The failed result itself is never changed."""
    rec = find_inspection(inspection_id)
    if rec.get("status") not in FAILED or not rec.get("inspectionType"):
        raise HTTPException(409, "Only a failed stage inspection can have a corrective action.")
    if rec.get("correctiveAction") is not None:
        raise HTTPException(409, f"A corrective action is already recorded for {inspection_id}.")
    action = body["correctiveAction"]
    _validate_corrective(action, rec.get("defectSeverity"))
    changes = {"correctiveAction": action, "updatedAt": now_iso()}
    for key in ("notes", "reworkCost", "additionalLabourCost", "additionalMachineCost", "scrapMaterialCost"):
        if body.get(key) is not None:
            changes[key] = body[key]
    merged = {**rec, **changes}
    if action == "SCRAP_AFFECTED_QUANTITY" and not merged.get("scrapMaterialCost") and merged.get("affectedMeters", 0) > 0:
        order = dbm.orders().find_one({"orderId": rec["orderId"]}, NO_ID) or {}
        changes["scrapMaterialCost"] = merged["scrapMaterialCost"] = _scrap_estimate(order, merged)
    changes["impact"] = _impact(merged)
    dbm.quality_checks().update_one({"inspectionId": inspection_id}, {"$set": changes})
    profitability.refresh_order(rec["orderId"])
    return find_inspection(inspection_id)


# ---------- lists, timeline, analytics ----------

def pending_inspections() -> list:
    rows = []
    for o in dbm.orders().find({"stageStatus": "QC_PENDING"}, NO_ID).sort("orderId", 1):
        kind = o.get("pendingInspectionType") or "STAGE"
        rows.append({"orderId": o["orderId"], "buyerName": o.get("buyerName"), "stage": o["currentStage"],
                     "inspectionType": kind, "machineId": o.get("machineId"),
                     "sampleMeters": o.get("sampleMeters") if kind == "FIRST_OFF" else None,
                     "producedMeters": round(o.get("producedMeters", 0), 1)})
    return rows


def quality_holds() -> list:
    rows = []
    for o in dbm.orders().find({"qualityHold": {"$ne": None}}, NO_ID).sort("orderId", 1):
        hold = o["qualityHold"]
        failed = dbm.quality_checks().find_one({"inspectionId": hold.get("failedInspectionId")}, NO_ID) or {}
        rows.append({"orderId": o["orderId"], "buyerName": o.get("buyerName"), "machineId": o.get("machineId"),
                     **hold, "correctiveAction": failed.get("correctiveAction"), "needsCorrectiveAction": failed.get("correctiveAction") is None})
    return rows


def order_timeline(order_id: str) -> dict:
    order = _order_or_404(order_id)
    records = inspections_of(order["orderId"])
    view = gate_view(order)
    reinspections = {}
    for r in records:
        if r.get("reinspectionOf"):
            reinspections.setdefault(r["reinspectionOf"], []).append(r["inspectionId"])
    current = QC_STAGES.index(view["currentStage"])
    stages = []
    for i, stage in enumerate(QC_STAGES):
        state = "DONE" if i < current else (view["stageStatus"] if i == current else "PENDING")
        if order.get("status") in ("DISPATCHED", "COMPLETED", "DELIVERED") and not view["gated"]:
            state = "DONE"
        items = [{**r, "stage": effective_stage(r), "inspectionType": effective_type(r), "legacy": not r.get("inspectionType"),
                  "reinspectedBy": reinspections.get(r.get("inspectionId"), [])}
                 for r in records if effective_stage(r) == stage]
        stages.append({"stage": stage, "state": state, "inspections": items})
    return {"orderId": order["orderId"], "currentStage": view["currentStage"], "stageStatus": view["stageStatus"],
            "qualityHold": view["qualityHold"], "gated": view["gated"], "stages": stages}


def analytics(month: str) -> dict:
    records = [r for r in dbm.quality_checks().find({}, NO_ID) if str(r.get("inspectionDate") or r.get("date") or "").startswith(month + "-")]
    total = len(records)
    count = lambda *statuses: sum(1 for r in records if r.get("status") in statuses)
    pct = lambda n: round(n / total * 100, 1) if total else 0.0
    defects = Counter(d for r in records for d in ([r["defectType"]] if r.get("defectType") else r.get("defects", [])))
    loss_by_stage = Counter()
    for r in records:
        loss_by_stage[effective_stage(r)] += costing.quality_loss(r)
    failures = Counter(r["machineId"] for r in records if r.get("status") in FAILED and r.get("machineId"))
    holds = quality_holds()
    top_loss = max(loss_by_stage.items(), key=lambda kv: kv[1]) if loss_by_stage else None
    return {
        "month": month, "totalInspections": total, "passRate": pct(count("PASSED")), "failureRate": pct(count("FAILED")),
        "reworkRate": pct(count("REWORK")), "totalQualityLoss": round(sum(loss_by_stage.values()), 2),
        "mostCommonDefect": defects.most_common(1)[0][0] if defects else None,
        "highestLossStage": top_loss[0] if top_loss and top_loss[1] > 0 else None,
        "machineWithMostFailures": failures.most_common(1)[0][0] if failures else None,
        "ordersOnQualityHold": len(holds), "holdOrderIds": [h["orderId"] for h in holds],
    }


def leakage_entries(order_id: str, rolls: list) -> list:
    """Profit-leakage lines for the quality problems of one order (stage-gated inspections only)."""
    entries, failures_at = [], Counter()
    for r in sorted((r for r in rolls if r.get("orderId") == order_id and r.get("inspectionType")), key=_sort_key):
        if r.get("status") not in FAILED:
            continue
        stage = r["stage"]
        failures_at[stage] += 1
        name = STAGE_LABEL.get(stage, stage)

        def add(component, amount, message):
            entries.append({"type": "QUALITY_FAILURE", "component": component, "stage": stage, "orderId": order_id,
                            "amount": round(amount, 2), "message": message, "label": message})

        add("STAGE_FAILURE", 0, f"{name} inspection failed ({str(r.get('defectSeverity') or '').lower()} severity, "
                                f"{round(r.get('affectedMeters', 0))} m affected)")
        if r.get("reworkCost"):
            add("REWORK", r["reworkCost"], f"Rework at {name}")
        if r.get("additionalLabourCost"):
            add("EXTRA_LABOUR", r["additionalLabourCost"], f"Extra labour caused by rework at {name}")
        if r.get("additionalMachineCost"):
            add("EXTRA_MACHINE", r["additionalMachineCost"], f"Extra machine time caused by rework at {name}")
        if r.get("scrapMaterialCost"):
            add("SCRAP", r["scrapMaterialCost"], f"Scrapped material at {name}")
        if failures_at[stage] > 1:
            add("REPEATED_FAILURE", 0, f"Repeated failure at {name} ({failures_at[stage]} failed inspections)")
    return entries


# ---------- buyer and passport ----------

def buyer_quality(order: dict, rolls: list):
    """(qualityStatus, qualityMessage, buyer stage index) for a gated order. Safe words only."""
    stage = order["currentStage"]
    if order.get("qualityHold"):
        status, message = "IN_REVIEW", "Rework verification"
    elif order.get("stageStatus") == "QC_PENDING":
        status, message = "PENDING", "Quality verification in progress"
    else:
        latest = latest_stage_inspection(order["orderId"], "FINAL_QC", rolls)
        if latest and latest.get("status") == "PASSED":
            status, message = "PASSED", "Quality approved"
        else:
            status, message = ("PENDING" if rolls else "NOT_STARTED"), None
    done = stage == QC_STAGES[-1] and order.get("stageStatus") == "COMPLETE"
    return status, message, (len(QC_STAGES) if done else QC_STAGE_BUYER_INDEX[stage])


def passport_status(roll: dict) -> tuple:
    """(final, result shown on the passport). Once the final inspection passed, a gated order's roll shows PASSED."""
    final = passport_final(roll)
    gated = final and roll.get("orderId") and is_gated(dbm.orders().find_one({"orderId": roll["orderId"]}, NO_ID))
    return final, ("PASSED" if gated else (roll.get("status") if final else "PENDING"))


def passport_final(roll: dict) -> bool:
    """A roll's passport is final once its order has a PASSED final inspection. Old orders are always final."""
    if not roll.get("orderId"):
        return True
    order = dbm.orders().find_one({"orderId": roll["orderId"]}, NO_ID)
    if not is_gated(order):
        return True
    return final_passed(roll["orderId"])


# ---------- indexes and old records ----------

def backfill_inspection_fields() -> int:
    """Give old quality records an inspectionId and dates, without changing anything else. Idempotent."""
    count = 0
    missing = list(dbm.quality_checks().find({"$or": [{"inspectionId": {"$exists": False}}, {"inspectionId": None}]}))
    for rec in sorted(missing, key=lambda r: (r.get("date") or "", r.get("rollId") or "")):
        stamp = rec.get("producedAt") or (rec.get("date") or date.today().isoformat()) + "T00:00:00"
        dbm.quality_checks().update_one({"_id": rec["_id"]},
                                        {"$set": {"inspectionId": next_inspection_id(), "inspectionDate": rec.get("date"),
                                                  "createdAt": stamp, "updatedAt": stamp}})
        count += 1
    return count


def ensure_indexes() -> None:
    backfill_inspection_fields()  # first: a unique index would reject several records without an id
    coll = dbm.quality_checks()
    coll.create_index("inspectionId", unique=True)
    for field in ("orderId", "stage", "status", "machineId", "inspectionDate"):
        coll.create_index(field)

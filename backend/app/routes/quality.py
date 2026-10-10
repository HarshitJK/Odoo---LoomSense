from datetime import date, datetime

from fastapi import APIRouter, HTTPException, Depends
from app.services.auth import current_user, owner
from fastapi.responses import Response

from app import database as dbm
from app.models.quality import CorrectiveActionBody, QualityCheck, QualityCreate
from app.services import costing, profitability, qr_service, quality_gate, tracking
from app.utils.ids import next_inspection_id, next_roll_id, normalize_id
from app.utils.validation import valid_month

router = APIRouter()
passport_router = APIRouter()
NO_ID = {"_id": 0}
COST_FIELDS = ("reworkCost", "additionalLabourCost", "additionalMachineCost", "scrapMaterialCost", "impact",
               "marginBefore", "marginAfter")


def find_roll(roll_id: str) -> dict:
    roll = dbm.quality_checks().find_one({"rollId": normalize_id(roll_id)}, NO_ID)
    if not roll:
        raise HTTPException(404, f"Roll {roll_id} not found")
    return roll


def safe_quality(record, user):
    """Only the owner sees what a quality problem cost."""
    if user["role"] != "OWNER":
        return {k: v for k, v in record.items() if k not in COST_FIELDS}
    return record


@router.get("")
def list_rolls(user=Depends(current_user)):
    """Rolls (records with a roll id), newest first. Stage inspections without a roll are in /order/{id}/timeline."""
    query = {"rollId": {"$ne": None}}
    return [safe_quality(r, user) for r in dbm.quality_checks().find(query, NO_ID).sort([("date", -1), ("rollId", -1)])]


@router.post("", status_code=201)
def create_roll(body: QualityCreate, user=Depends(current_user)):
    """Store an inspection. With a stage or inspectionType it is stage-gated (see services/quality_gate.py).

    Without them it is the old final-QC roll: FAILED / REWORK rolls get a cost impact that feeds the order's costs.
    """
    data = body.model_dump()
    order = None
    if data["orderId"]:
        data["orderId"] = normalize_id(data["orderId"])
        order = dbm.orders().find_one({"orderId": data["orderId"]}, NO_ID)
        if not order:
            raise HTTPException(404, f"Order {data['orderId']} not found")
    # A stage-gated order (or a body with a stage or type) is a stage inspection; the stage defaults to the order's own
    if data["stage"] or data["inspectionType"] or data["reinspectionOf"] or quality_gate.is_gated(order):
        rec, margin_before, margin_after = quality_gate.create_inspection(data, user)
        return safe_quality({**rec, "marginBefore": margin_before, "marginAfter": margin_after}, user)

    roll_id = normalize_id(data["rollId"]) if data["rollId"] else next_roll_id()
    if dbm.quality_checks().find_one({"rollId": roll_id}):
        raise HTTPException(409, f"Roll {roll_id} already exists")

    if order:
        data["yarnBatch"] = data["yarnBatch"] or order.get("yarnBatch")
        data["machineId"] = data["machineId"] or order.get("machineId")

    # Cost impact of a bad roll
    impact = {"additionalLabour": 0.0, "machineCost": 0.0, "materialLoss": 0.0, "total": data["reworkCost"]}
    if data["status"] in ("FAILED", "REWORK") and data["affectedMeters"] > 0:
        batch = dbm.inventory().find_one({"batchId": data["yarnBatch"]}, NO_ID) if data["yarnBatch"] else None
        price = batch["costPerKg"] if batch else (costing.yarn_price(order) if order else 0.0)
        impact = costing.calculate_rework_impact(data["affectedMeters"], price)

    stamp = datetime.now().replace(microsecond=0).isoformat()
    roll = QualityCheck(
        rollId=roll_id,
        inspectionId=next_inspection_id(),
        orderId=data["orderId"],
        machineId=data["machineId"],
        yarnBatch=data["yarnBatch"],
        shift=data["shift"],
        buyerName=order.get("buyerName") if order else None,
        status=data["status"],
        defects=data["defects"],
        affectedMeters=data["affectedMeters"],
        reworkStatus=data["reworkStatus"] or tracking.default_rework_status(data["status"]),
        reworkCost=impact["total"],
        impact=impact,
        date=date.today().isoformat(),
        producedAt=stamp,
        inspectorId=user.get("email"),
        inspectionDate=date.today().isoformat(),
        createdAt=stamp,
        updatedAt=stamp,
    ).model_dump()

    margin_before = profitability.order_profit(order["orderId"])["margin"] if order else None
    dbm.quality_checks().insert_one(roll)
    roll.pop("_id", None)
    margin_after = profitability.refresh_order(order["orderId"])["margin"] if order else None

    return safe_quality({**roll, "impact": impact, "marginBefore": margin_before, "marginAfter": margin_after}, user)


@router.get("/options")
def quality_options():
    return {"orders": list(dbm.orders().find({}, {"_id": 0, "orderId": 1, "buyerName": 1})),
            "machines": list(dbm.machines().find({}, {"_id": 0, "machineId": 1, "name": 1})),
            "batches": list(dbm.inventory().find({}, {"_id": 0, "batchId": 1, "material": 1, "colour": 1}))}


@router.get("/pending")
def pending_inspections():
    """Orders waiting for an inspection: a first-off sample or a finished stage."""
    return quality_gate.pending_inspections()


@router.get("/holds")
def quality_holds():
    """Orders on quality hold, with the failed stage, defect, severity and affected metres."""
    return quality_gate.quality_holds()


@router.get("/analytics", dependencies=[Depends(owner)])
def quality_analytics(month: str = None):
    return quality_gate.analytics(valid_month(month))


@router.get("/order/{order_id}/timeline")
def order_timeline(order_id: str, user=Depends(current_user)):
    """All inspections of an order in time order, grouped by stage; failed ones list their reinspections."""
    timeline = quality_gate.order_timeline(order_id)
    for stage in timeline["stages"]:
        stage["inspections"] = [safe_quality(r, user) for r in stage["inspections"]]
    return timeline


@router.patch("/{inspection_id}/corrective-action")
def corrective_action(inspection_id: str, body: CorrectiveActionBody, user=Depends(current_user)):
    """Record what is done about a failed inspection. QC worker and production manager (and owner) may do this."""
    return safe_quality(quality_gate.set_corrective_action(inspection_id, body.model_dump(), user), user)


@router.get("/{roll_id}")
def get_roll(roll_id: str, user=Depends(current_user)):
    return safe_quality(find_roll(roll_id), user)


# ---- public fabric passport (no cost or profit fields) ----

@passport_router.get("/{roll_id}")
def get_passport(roll_id: str):
    return tracking.passport(find_roll(roll_id))


@passport_router.get("/{roll_id}/qr")
def get_passport_qr(roll_id: str):
    roll = find_roll(roll_id)
    return Response(content=qr_service.generate_roll_qr(roll["rollId"]), media_type="image/png")

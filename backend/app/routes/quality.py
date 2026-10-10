from datetime import date, datetime

from fastapi import APIRouter, HTTPException, Depends
from app.services.auth import current_user
from fastapi.responses import Response

from app import database as dbm
from app.models.quality import QualityCheck, QualityCreate
from app.services import costing, profitability, qr_service, tracking
from app.utils.ids import next_roll_id, normalize_id

router = APIRouter()
passport_router = APIRouter()
NO_ID = {"_id": 0}


def find_roll(roll_id: str) -> dict:
    roll = dbm.quality_checks().find_one({"rollId": normalize_id(roll_id)}, NO_ID)
    if not roll:
        raise HTTPException(404, f"Roll {roll_id} not found")
    return roll


def safe_quality(record, user):
    if user["role"] != "OWNER":
        return {k: v for k, v in record.items() if k not in ("reworkCost", "impact", "marginBefore", "marginAfter")}
    return record


@router.get("")
def list_rolls(user=Depends(current_user)):
    return [safe_quality(r, user) for r in dbm.quality_checks().find({}, NO_ID).sort([("date", -1), ("rollId", -1)])]


@router.post("", status_code=201)
def create_roll(body: QualityCreate, user=Depends(current_user)):
    """Store a roll. FAILED / REWORK rolls get a cost impact that feeds the order's costs."""
    data = body.model_dump()
    order = None
    if data["orderId"]:
        data["orderId"] = normalize_id(data["orderId"])
        order = dbm.orders().find_one({"orderId": data["orderId"]}, NO_ID)
        if not order:
            raise HTTPException(404, f"Order {data['orderId']} not found")

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

    roll = QualityCheck(
        rollId=roll_id,
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
        producedAt=datetime.now().replace(microsecond=0).isoformat(),
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

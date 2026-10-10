from datetime import date

from fastapi import APIRouter, HTTPException

from app import database as dbm
from app.models.quality import QualityCheck, QualityCreate
from app.services import profitability
from app.utils.ids import next_roll_id

router = APIRouter()
NO_ID = {"_id": 0}


@router.get("")
def list_rolls():
    return list(dbm.quality_checks().find({}, NO_ID).sort([("date", -1), ("rollId", -1)]))


@router.post("", status_code=201)
def create_roll(body: QualityCreate):
    data = body.model_dump()
    data["rollId"] = data["rollId"] or next_roll_id()
    data["date"] = data["date"] or date.today().isoformat()
    if dbm.quality_checks().find_one({"rollId": data["rollId"]}):
        raise HTTPException(409, f"Roll {data['rollId']} already exists")
    doc = QualityCheck(**data).model_dump()
    dbm.quality_checks().insert_one(doc)
    doc.pop("_id", None)
    if doc.get("orderId") and dbm.orders().find_one({"orderId": doc["orderId"]}):
        profitability.refresh_order(doc["orderId"])  # rework cost feeds the order cost
    return doc


@router.get("/{roll_id}")
def get_roll(roll_id: str):
    roll = dbm.quality_checks().find_one({"rollId": roll_id}, NO_ID)
    if not roll:
        raise HTTPException(404, f"Roll {roll_id} not found")
    return roll

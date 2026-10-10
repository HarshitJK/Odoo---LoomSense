from datetime import date

from fastapi import APIRouter, HTTPException

from app import database as dbm
from app.models.attendance import Attendance
from app.models.worker import Worker

router = APIRouter()
attendance_router = APIRouter()
NO_ID = {"_id": 0}


@router.get("")
def list_workers():
    workers = list(dbm.workers().find({}, NO_ID).sort("workerId", 1))
    for w in workers:
        latest = dbm.attendance().find_one(
            {"workerId": w["workerId"]}, NO_ID, sort=[("date", -1)]
        )
        w["latestAssignment"] = (
            {k: latest.get(k) for k in ("orderId", "machineId", "date")} if latest else None
        )
    return workers


@router.post("", status_code=201)
def create_worker(body: Worker):
    if dbm.workers().find_one({"workerId": body.workerId}):
        raise HTTPException(409, f"Worker {body.workerId} already exists")
    doc = body.model_dump()
    dbm.workers().insert_one(doc)
    doc.pop("_id", None)
    return doc


@attendance_router.post("", status_code=201)
def log_attendance(body: Attendance):
    if not dbm.workers().find_one({"workerId": body.workerId}):
        raise HTTPException(404, f"Worker {body.workerId} not found")
    doc = body.model_dump()
    doc["date"] = doc["date"] or date.today().isoformat()
    dbm.attendance().insert_one(doc)
    doc.pop("_id", None)
    return doc

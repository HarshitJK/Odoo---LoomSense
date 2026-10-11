from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends

from app import database as dbm
from app.services.auth import current_user, owner
from app.models.attendance import Attendance
from app.models.worker import Worker
from app.services import costing, profitability
from app.utils.validation import valid_month

router = APIRouter()
attendance_router = APIRouter()
NO_ID = {"_id": 0}


@router.get("")
def list_workers(month: Optional[str] = None, user=Depends(current_user)):
    """Workers with their latest assignment and this month's hours and wages (month defaults to current)."""
    month = valid_month(month)
    workers = list(dbm.workers().find({}, NO_ID).sort("workerId", 1))
    latest = {}  # newest attendance record per worker
    in_month = {}  # this month's attendance records per worker
    for rec in dbm.attendance().find({}, NO_ID).sort("date", 1):  # one query for everything
        latest[rec["workerId"]] = rec
        if (rec.get("date") or "").startswith(month):
            in_month.setdefault(rec["workerId"], []).append(rec)
    for w in workers:
        rec = latest.get(w["workerId"])
        w["latestAssignment"] = {k: rec.get(k) for k in ("orderId", "machineId", "date")} if rec else None
        records = in_month.get(w["workerId"], [])
        wages = costing.calculate_labour_cost(records, {w["workerId"]: w.get("hourlyRate", 0)})
        overtime = round(sum(r.get("overtimeHours", 0) for r in records), 2)
        w["hoursThisMonth"] = round(wages["hours"] - overtime, 2)
        w["overtimeThisMonth"] = overtime
        w["wageThisMonth"] = wages["total"]
    if user["role"] != "OWNER":
        allowed = {"workerId", "name", "shift", "latestAssignment", "hoursThisMonth", "overtimeThisMonth"}
        workers = [{k: v for k, v in w.items() if k in allowed} for w in workers]
    return workers


@router.get("/wages/summary", dependencies=[Depends(owner)])
def wages_summary(month: Optional[str] = None):
    """Regular wages, overtime pay and labour cost per order for a month (default: current)."""
    return costing.wages_summary(valid_month(month))


@router.post("", status_code=201, dependencies=[Depends(owner)])
def create_worker(body: Worker):
    if dbm.workers().find_one({"workerId": body.workerId}):
        raise HTTPException(409, f"Worker {body.workerId} already exists")
    doc = body.model_dump()
    dbm.workers().insert_one(doc)
    doc.pop("_id", None)
    return doc


@attendance_router.post("", status_code=201)
def log_attendance(body: Attendance, user=Depends(current_user)):
    if not dbm.workers().find_one({"workerId": body.workerId}):
        raise HTTPException(404, f"Worker {body.workerId} not found")
    if body.orderId and (dbm.orders().find_one({"orderId": body.orderId}, NO_ID) or {}).get("status") == "CANCELLED":
        raise HTTPException(409, "Order is already cancelled.")
    doc = body.model_dump()
    doc["hourlyRate"] = dbm.workers().find_one({"workerId": body.workerId})["hourlyRate"]
    doc["date"] = doc["date"] or date.today().isoformat()
    dbm.attendance().insert_one(doc)
    doc.pop("_id", None)
    if doc.get("orderId") and dbm.orders().find_one({"orderId": doc["orderId"]}):
        profitability.refresh_order(doc["orderId"])  # keep order costs in sync
    if user["role"] != "OWNER":
        doc.pop("hourlyRate", None)
    return doc

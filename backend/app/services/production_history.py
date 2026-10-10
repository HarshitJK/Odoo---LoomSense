"""One accumulated record per wall-clock minute, machine and order.

Runtime is simulator factory time. Dates use actual event time, not simulated
time or the order date. Unit costs are captured when the activity happens.
"""
from datetime import datetime, timezone
from app import database as dbm


def record(machine, order, meters, hours, timestamp=None, completed=False):
    stamp = timestamp or datetime.now(timezone.utc).isoformat()
    bucket = stamp[:16]
    oid = order["orderId"] if order else None
    key = f"{machine['machineId']}:{oid}:{bucket}"
    dbm.db.machineProductionEvents.update_one({"eventId": key}, {
        "$setOnInsert": {"eventId": key, "machineId": machine["machineId"], "orderId": oid,
            "timestamp": bucket + ":00", "createdAt": stamp, "status": "RUNNING"},
        "$set": {"updatedAt": stamp, "productionRate": machine.get("productionRate", 0), "efficiency": machine.get("efficiency", 0)},
        "$max": {"completed": completed},
        "$inc": {"producedMetersDelta": meters, "runtimeMinutes": hours * 60,
            "efficiencyMinutes": machine.get("efficiency", 0) * hours * 60,
            "machineCost": hours * machine.get("costPerHour", 0)}}, upsert=True)

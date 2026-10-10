import asyncio

from fastapi import APIRouter, HTTPException

from app import database as dbm
from app.models.machine import MachineReading, MachineUpdate, SimulateRequest
from app.services import machine_simulator as simulator
from app.services import profitability

router = APIRouter()
NO_ID = {"_id": 0}


@router.get("")
def list_machines():
    return simulator.get_snapshot()


@router.post("/simulate")
async def simulate(body: SimulateRequest):
    """Demo controls: start / stop the simulator (or one machine), reset, or fail a machine."""
    try:
        return await simulator.control(body.action, body.machineId, body.speed)
    except simulator.MachineNotFound as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(409, str(e))


@router.post("/{machine_id}/readings")
async def machine_reading(machine_id: str, body: MachineReading):
    """A machine (or the sample feeder) reports its state: updates the machine and its order, then broadcasts."""
    try:
        events, views = await asyncio.to_thread(
            simulator.apply_reading, machine_id, body.model_dump())
    except simulator.MachineNotFound as e:
        raise HTTPException(404, str(e))
    for event in events:
        await simulator.emit(event)
    await simulator.emit(simulator.update_message(views))
    return next(v for v in views if v["machineId"] == machine_id)


@router.get("/monthly-summary")
def monthly_summary(month: str):
    from app.services.month_end import machine_summary
    return machine_summary(month)


@router.get("/{machine_id}")
def get_machine(machine_id: str):
    for machine in simulator.get_snapshot():
        if machine["machineId"] == machine_id:
            return machine
    raise HTTPException(404, f"Machine {machine_id} not found")


@router.patch("/{machine_id}")
def update_machine(machine_id: str, body: MachineUpdate):
    changes = body.model_dump(exclude_unset=True)
    if changes:
        before = dbm.machines().find_one({"machineId": machine_id}, NO_ID)
        if not before:
            raise HTTPException(404, f"Machine {machine_id} not found")
        if changes.get("currentOrderId") and changes["currentOrderId"] != before.get("currentOrderId"):
            from app.utils.ids import normalize_id
            changes["currentOrderId"] = normalize_id(changes["currentOrderId"])
            order = dbm.orders().find_one({"orderId": changes["currentOrderId"]})
            if not order:
                raise HTTPException(404, "Order not found")
            changes.update(producedMeters=0, targetMeters=max(0, order["quantityMeters"]-order["producedMeters"]))
            dbm.orders().update_one({"orderId": order["orderId"]}, {"$set": {"machineId": machine_id}})
        dbm.machines().update_one({"machineId": machine_id}, {"$set": changes})
        after = dbm.machines().find_one({"machineId": machine_id}, NO_ID)
        # machine cost of the affected orders changes with the assignment or rate
        for oid in {before.get("currentOrderId"), after.get("currentOrderId")} - {None}:
            if dbm.orders().find_one({"orderId": oid}):
                profitability.refresh_order(oid)
    return get_machine(machine_id)

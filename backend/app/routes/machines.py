from fastapi import APIRouter, HTTPException

from app import database as dbm
from app.models.machine import MachineUpdate
from app.services import profitability

router = APIRouter()
NO_ID = {"_id": 0}


@router.get("")
def list_machines():
    return list(dbm.machines().find({}, NO_ID).sort("machineId", 1))


@router.post("/simulate")
def simulate():
    raise HTTPException(501, "Machine simulator is not implemented yet")


@router.get("/{machine_id}")
def get_machine(machine_id: str):
    machine = dbm.machines().find_one({"machineId": machine_id}, NO_ID)
    if not machine:
        raise HTTPException(404, f"Machine {machine_id} not found")
    return machine


@router.patch("/{machine_id}")
def update_machine(machine_id: str, body: MachineUpdate):
    changes = body.model_dump(exclude_unset=True)
    if changes:
        before = dbm.machines().find_one({"machineId": machine_id}, NO_ID)
        if not before:
            raise HTTPException(404, f"Machine {machine_id} not found")
        dbm.machines().update_one({"machineId": machine_id}, {"$set": changes})
        after = dbm.machines().find_one({"machineId": machine_id}, NO_ID)
        # machine cost of the affected orders changes with the assignment or rate
        for oid in {before.get("currentOrderId"), after.get("currentOrderId")} - {None}:
            if dbm.orders().find_one({"orderId": oid}):
                profitability.refresh_order(oid)
    return get_machine(machine_id)

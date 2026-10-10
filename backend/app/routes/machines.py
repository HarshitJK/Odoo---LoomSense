from fastapi import APIRouter, HTTPException

from app import database as dbm
from app.models.machine import MachineUpdate

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
        result = dbm.machines().update_one({"machineId": machine_id}, {"$set": changes})
        if result.matched_count == 0:
            raise HTTPException(404, f"Machine {machine_id} not found")
    return get_machine(machine_id)

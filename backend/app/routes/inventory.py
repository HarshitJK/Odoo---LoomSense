from datetime import date

from fastapi import APIRouter, HTTPException

from app import database as dbm
from app.models.inventory import InventoryBatch, InventoryUpdate

router = APIRouter()
NO_ID = {"_id": 0}
LOW_STOCK_KG = 300


def with_low_stock(batch: dict) -> dict:
    batch["lowStock"] = batch.get("quantityKg", 0) < LOW_STOCK_KG
    return batch


@router.get("")
def list_inventory():
    return [with_low_stock(b) for b in dbm.inventory().find({}, NO_ID).sort("batchId", 1)]


@router.post("", status_code=201)
def create_batch(body: InventoryBatch):
    if dbm.inventory().find_one({"batchId": body.batchId}):
        raise HTTPException(409, f"Batch {body.batchId} already exists")
    doc = body.model_dump()
    doc["receivedDate"] = doc["receivedDate"] or date.today().isoformat()
    dbm.inventory().insert_one(doc)
    doc.pop("_id", None)
    return with_low_stock(doc)


@router.patch("/{batch_id}")
def update_batch(batch_id: str, body: InventoryUpdate):
    changes = body.model_dump(exclude_unset=True)
    if changes:
        result = dbm.inventory().update_one({"batchId": batch_id}, {"$set": changes})
        if result.matched_count == 0:
            raise HTTPException(404, f"Batch {batch_id} not found")
    batch = dbm.inventory().find_one({"batchId": batch_id}, NO_ID)
    if not batch:
        raise HTTPException(404, f"Batch {batch_id} not found")
    return with_low_stock(batch)

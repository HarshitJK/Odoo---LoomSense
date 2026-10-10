"""Immutable received bills; dated supplier payments keep later months accurate."""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import HTTPException
from app import database as dbm
from app.utils.ids import normalize_id


def create_purchase(body):
    doc = body.model_dump(mode="json")
    receive = doc.pop("receiveInventory")
    doc["batchId"] = normalize_id(doc["batchId"]) if doc["batchId"] else "YB" + uuid4().hex[:12].upper()
    old = dbm.inventory().find_one({"batchId": doc["batchId"]})
    if receive and old and any(old.get(k) != doc[k] for k in ("material", "colour", "costPerKg", "supplier")):
        raise HTTPException(409, "Use a new batch for a different material, colour, supplier or unit cost")
    if dbm.db.materialPurchases.find_one({"supplier": doc["supplier"], "invoiceNumber": doc["invoiceNumber"]}):
        raise HTTPException(409, "Supplier invoice already recorded")
    doc.update(purchaseId="PUR" + uuid4().hex.upper(), subtotal=round(doc["quantityKg"] * doc["costPerKg"], 2),
               createdAt=datetime.now(timezone.utc).isoformat())
    doc["updatedAt"] = doc["createdAt"]
    doc["totalAmount"] = round(doc["subtotal"] + doc["otherCharges"], 2)
    doc["paymentStatus"] = "PAID" if doc["paidAmount"] == doc["totalAmount"] else "PARTIAL" if doc["paidAmount"] else "UNPAID"
    doc["payments"] = [{"date": doc["purchaseDate"], "amount": doc["paidAmount"]}] if doc["paidAmount"] else []
    # Bills and stock are separate; receipt IDs guard repeated inventory application.
    doc["inventoryReceived"] = False
    doc["receiveInventory"] = receive
    dbm.db.materialPurchases.insert_one(doc)
    if receive:
        dbm.inventory().update_one({"batchId": doc["batchId"], "purchaseReceipts": {"$ne": doc["purchaseId"]}}, {
            "$addToSet": {"purchaseReceipts": doc["purchaseId"]},
            "$inc": {"quantityKg": doc["quantityKg"]},
            "$setOnInsert": {k: doc[k] for k in ("batchId", "material", "colour", "costPerKg", "supplier", "createdAt")},
            "$set": {"updatedAt": doc["createdAt"], "receivedDate": doc["purchaseDate"]}}, upsert=True)
    if receive:
        dbm.db.materialPurchases.update_one({"purchaseId": doc["purchaseId"]}, {"$set": {"inventoryReceived": True}})
        doc["inventoryReceived"] = True
    doc.pop("_id", None)
    return doc

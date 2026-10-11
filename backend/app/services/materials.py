"""Reservations hold stock; consumption alone becomes order production cost."""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import HTTPException
from app import database as dbm
from app.config import YARN_KG_PER_METRE


def reserve(order_id, batch_id, kg):
    order = dbm.orders().find_one({"orderId": order_id})
    batch = dbm.inventory().find_one({"batchId": batch_id})
    if not order or not batch:
        raise HTTPException(404, "Order or batch not found")
    if order.get("status") == "CANCELLED":
        raise HTTPException(409, "Order is already cancelled.")
    if (batch["material"].lower(), batch["colour"].lower()) != (f"{order.get('fabricType')} Yarn".lower(), (order.get("colour") or "").lower()):
        raise HTTPException(422, "Batch must match the order fabric and colour")
    free = batch["quantityKg"] - batch.get("reservedKg", 0)
    if kg > free:
        raise HTTPException(409, "Insufficient unreserved yarn")
    result = dbm.inventory().update_one({"batchId": batch_id, "quantityKg": batch["quantityKg"], "reservedKg": batch.get("reservedKg", 0)} if "reservedKg" in batch else {"batchId": batch_id, "quantityKg": batch["quantityKg"], "reservedKg": {"$exists": False}}, {"$inc": {"reservedKg": kg}})
    if not result.matched_count:
        raise HTTPException(409, "Stock changed; check readiness again")
    dbm.db.materialReservations.update_one({"orderId": order_id, "batchId": batch_id}, {"$inc": {"quantityKg": kg}}, upsert=True)
    dbm.orders().update_one({"orderId": order_id}, {"$set": {"yarnBatch": batch_id}})
    return {"orderId": order_id, "batchId": batch_id, "reservedKg": kg}


def consume(order, meters):
    """Cap new output to available stock; old orders keep legacy cost fallback."""
    if order.get("status") == "CANCELLED" or order.get("stageStatus") == "PAUSED":
        return 0
    if not order.get("materialHistoryComplete") or not meters:
        return meters
    batch = dbm.inventory().find_one({"batchId": order.get("yarnBatch")})
    if not batch:
        return 0
    own = dbm.db.materialReservations.find_one({"orderId": order["orderId"], "batchId": batch["batchId"]}) or {}
    available = max(0, batch["quantityKg"] - batch.get("reservedKg", 0) + own.get("quantityKg", 0))
    meters = min(meters, available / YARN_KG_PER_METRE)
    kg = meters * YARN_KG_PER_METRE
    if kg <= 0:
        return 0
    reserved = min(kg, own.get("quantityKg", 0))
    result = dbm.inventory().update_one({"batchId": batch["batchId"], "quantityKg": batch["quantityKg"]}, {"$inc": {"quantityKg": -kg, "reservedKg": -reserved}})
    if not result.matched_count:
        return 0
    if reserved:
        dbm.db.materialReservations.update_one({"orderId": order["orderId"], "batchId": batch["batchId"]}, {"$inc": {"quantityKg": -reserved}})
    stamp = datetime.now(timezone.utc).isoformat()
    key = f"{order['orderId']}:{batch['batchId']}:{stamp[:16]}"
    dbm.db.materialConsumption.update_one({"consumptionId": key}, {
        "$setOnInsert": {"consumptionId": key, "orderId": order["orderId"], "batchId": batch["batchId"],
            "costPerKg": batch["costPerKg"], "date": stamp[:10], "createdAt": stamp},
        "$inc": {"quantityKg": kg, "cost": kg * batch["costPerKg"]}}, upsert=True)
    return meters


def record_material_return(batch_id, order_id, new_quantity_kg):
    """Yarn of a cancelled order that is put back in stock through an inventory adjustment. Only what was explicitly
    returned counts as recoverable, and never more than the order consumed from that batch."""
    order = dbm.orders().find_one({"orderId": order_id})
    batch = dbm.inventory().find_one({"batchId": batch_id})
    if not order or not batch:
        raise HTTPException(404, "Order or batch not found")
    if order.get("status") != "CANCELLED":
        raise HTTPException(409, "Material can only be returned from a cancelled order.")
    if new_quantity_kg is None or new_quantity_kg <= batch["quantityKg"]:
        raise HTTPException(422, "quantityKg must be higher than the current stock to record a return.")
    kg = round(new_quantity_kg - batch["quantityKg"], 2)
    used = sum(c["quantityKg"] for c in dbm.db.materialConsumption.find({"orderId": order_id, "batchId": batch_id}))
    back = sum(r["quantityKg"] for r in dbm.db.materialReturns.find({"orderId": order_id, "batchId": batch_id}))
    if kg > used - back + 1e-6:
        raise HTTPException(409, f"Order {order_id} used only {round(used - back, 2)} kg of {batch_id} that can still be returned.")
    dbm.db.materialReturns.insert_one({"returnId": "RET" + uuid4().hex, "orderId": order_id, "batchId": batch_id, "quantityKg": kg,
                                       "costPerKg": batch["costPerKg"], "value": round(kg * batch["costPerKg"], 2),
                                       "createdAt": datetime.now(timezone.utc).isoformat()})

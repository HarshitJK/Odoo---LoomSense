from datetime import date, datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from app import database as dbm
from app.models.purchase import MaterialPurchase
from app.services.purchases import create_purchase
from app.utils.validation import valid_month

router = APIRouter()


@router.get("")
def purchases():
    return list(dbm.db.materialPurchases.find({}, {"_id": 0}).sort("purchaseDate", -1))


@router.get("/monthly")
def monthly(month: str):
    month = valid_month(month)
    records = list(dbm.db.materialPurchases.find({"purchaseDate": {"$regex": f"^{month}"}}, {"_id": 0}))
    return {"month": month, "purchases": records, "rawMaterialBills": round(sum(p["totalAmount"] for p in records), 2)}


@router.get("/{purchase_id}")
def purchase(purchase_id: str):
    record = dbm.db.materialPurchases.find_one({"purchaseId": purchase_id}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Purchase not found")
    return record


@router.post("", status_code=201)
def create(body: MaterialPurchase):
    from app.services.machine_simulator import sim_lock
    with sim_lock:
        return create_purchase(body)


class Update(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    notes: str | None = None
    paymentAmount: float = Field(default=0, ge=0)
    paymentDate: date | None = None


@router.patch("/{purchase_id}")
def update(purchase_id: str, body: Update):
    old = purchase(purchase_id)
    paid = round(old["paidAmount"] + body.paymentAmount, 2)
    if paid > old["totalAmount"] or (body.paymentAmount and not body.paymentDate):
        raise HTTPException(422, "Payment date required; payments cannot exceed the bill")
    changes = {"paidAmount": paid, "updatedAt": datetime.now(timezone.utc).isoformat(),
               "paymentStatus": "PAID" if paid == old["totalAmount"] else "PARTIAL" if paid else "UNPAID"}
    if body.notes is not None:
        changes["notes"] = body.notes
    operation = {"$set": changes}
    if body.paymentAmount:
        operation["$push"] = {"payments": {"date": body.paymentDate.isoformat(), "amount": body.paymentAmount}}
    result = dbm.db.materialPurchases.update_one({"purchaseId": purchase_id, "paidAmount": old["paidAmount"]}, operation)
    if not result.matched_count:
        raise HTTPException(409, "Purchase changed; reload and retry")
    return purchase(purchase_id)

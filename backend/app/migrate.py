"""Non-destructive upgrade: python -m app.migrate. Does not invent historical activity."""
import os
from datetime import datetime, timezone
from app import database as dbm
from app.services import audit, machine_sessions, quality_gate, tracking
from app.services.auth import hash_password


def main():
    stamp = datetime.now(timezone.utc).isoformat()
    tracking.ensure_tracking_tokens()
    quality_gate.ensure_indexes()
    machine_sessions.ensure_indexes()
    audit.ensure_indexes()
    machine_sessions.backfill()
    for role, name in [("OWNER", "owner"), ("PRODUCTION_MANAGER", "manager"), ("WORKER_QC", "qc")]:
        password = os.getenv("SEED_" + role + "_PASSWORD")
        email = name + "@loomsense.demo"
        if password and not dbm.db.users.find_one({"email": email}):
            if len(password) < 12:
                raise ValueError("Seed passwords require at least 12 characters")
            dbm.db.users.insert_one({"email": email, "role": role, "active": True, "passwordHash": hash_password(password), "createdAt": stamp})
    for coll, field in [("users", "email"), ("orders", "orderId"), ("orders", "trackingToken"), ("inventory", "batchId"),
                        ("materialPurchases", "purchaseId"), ("machineProductionEvents", "eventId")]:
        dbm.db[coll].create_index(field, unique=True)
    dbm.db.materialPurchases.create_index([("supplier", 1), ("invoiceNumber", 1)], unique=True)
    dbm.db.machineProductionEvents.create_index("timestamp")
    print("Migration complete. Existing operational data preserved; missing history remains unknown.")


if __name__ == "__main__":
    main()

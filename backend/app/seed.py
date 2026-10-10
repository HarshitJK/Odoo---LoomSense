"""Load demo data: python -m app.seed  (clears and reinserts, safe to re-run)."""
import random
from datetime import date, timedelta

from app import database as dbm
from app.models.attendance import Attendance
from app.models.inventory import InventoryBatch
from app.models.machine import Machine
from app.models.order import Order
from app.models.quality import QualityCheck
from app.models.transaction import Transaction
from app.models.worker import Worker

MACHINES = [
    # id, status, order, rate, produced, target, temp, costPerHour, efficiency
    ("W01", "RUNNING", "ORD104", 112, 1460, 2000, 61.0, 600, 0.91),
    ("W02", "RUNNING", "ORD108", 105, 760, 1600, 58.5, 580, 0.88),
    ("W03", "RUNNING", "ORD091", 84, 1090, 1200, 66.2, 650, 0.74),
    ("W04", "RUNNING", "ORD104", 98, 540, 2000, 60.1, 520, 0.85),
    ("W05", "IDLE", None, 0, 0, 0, 31.0, 450, 0.0),
    ("W06", "DOWN", None, 0, 0, 0, 28.0, 700, 0.0),
]

INVENTORY = [
    ("YB82", "Cotton Yarn", "Navy Blue", 950, 180, "Supplier A", "2026-10-01"),
    ("YB83", "Cotton Yarn", "White", 1400, 170, "Supplier B", "2026-09-22"),
    ("YB84", "Cotton Yarn", "Red", 620, 175, "Supplier C", "2026-09-10"),
    ("YB85", "Polyester Yarn", "Black", 240, 150, "Supplier A", "2026-08-30"),  # low stock
    ("YB86", "Cotton Yarn", "Grey", 780, 165, "Supplier B", "2026-10-05"),
]

WORKERS = [
    ("EMP021", "Ravi Kumar", 90, "B"), ("EMP022", "Anita Sharma", 95, "A"),
    ("EMP023", "Suresh Patel", 85, "B"), ("EMP024", "Meena Devi", 100, "C"),
    ("EMP025", "Imran Khan", 110, "A"), ("EMP026", "Lakshmi Nair", 75, "C"),
    ("EMP027", "Deepak Singh", 80, "A"), ("EMP028", "Priya Joshi", 70, "B"),
    ("EMP029", "Arjun Rao", 105, "C"), ("EMP030", "Sunita Yadav", 88, "A"),
]

# orderId, buyerId, buyer, fabric, colour, qty, produced, status, machine,
# deadline, orderDate, revenue, (rawMaterial, labour, machine, rework, other)
# Margins: ORD071 32% (green), ORD078 23%, ORD085 8% (red), ORD091 17%, ORD104 24.9%, ORD108 27%
ORDERS = [
    ("ORD071", "BUY004", "Royal Fabrics", "Cotton", "White", 1500, 1500, "DISPATCHED", "W02",
     "2026-07-30T18:00:00", "2026-07-05", 120000, (46000, 17000, 10600, 1000, 7000)),
    ("ORD078", "BUY002", "Sunrise Textiles", "Cotton", "Red", 1800, 1800, "DISPATCHED", "W01",
     "2026-08-28T18:00:00", "2026-08-04", 140000, (62000, 24000, 14000, 3800, 4000)),
    ("ORD085", "BUY003", "Metro Apparel", "Polyester", "Black", 1100, 1100, "DISPATCHED", "W03",
     "2026-09-25T18:00:00", "2026-09-02", 95000, (52000, 20400, 9000, 4000, 2000)),
    ("ORD091", "BUY003", "Metro Apparel", "Polyester", "Black", 1200, 1090, "REWORK", "W03",
     "2026-10-08T18:00:00", "2026-09-15", 150000, (68000, 30500, 14000, 8000, 4000)),
    ("ORD104", "BUY001", "ABC Garments", "Cotton", "Navy Blue", 2000, 1460, "WEAVING", "W01",
     "2026-10-15T18:00:00", "2026-10-01", 180000, (82000, 24500, 18400, 6200, 4000)),
    ("ORD108", "BUY005", "Greenline Exports", "Cotton", "Grey", 1600, 760, "WEAVING", "W02",
     "2026-10-22T18:00:00", "2026-10-06", 160000, (66000, 22000, 15000, 1800, 12000)),
]

# rollId, orderId, buyer, machine, yarnBatch, shift, status, defects, reworkCost, date
QUALITY = [
    ("RL10092", "ORD104", "ABC Garments", "W01", "YB82", "B", "PASSED", [], 0, "2026-10-08"),
    ("RL10093", "ORD104", "ABC Garments", "W04", "YB82", "A", "PASSED", [], 0, "2026-10-09"),
    ("RL10088", "ORD091", "Metro Apparel", "W03", "YB85", "C", "FAILED",
     ["Weft break", "Uneven tension"], 4180, "2026-10-03"),
    ("RL10089", "ORD091", "Metro Apparel", "W03", "YB85", "C", "REWORK",
     ["Colour patch"], 3820, "2026-10-05"),
    ("RL10061", "ORD085", "Metro Apparel", "W03", "YB85", "A", "PASSED", [], 0, "2026-09-20"),
]

TRANSACTIONS = [
    ("TXN001", "BUYER_PAYMENT", "ORD071", 120000, "2026-07-28"),
    ("TXN002", "BUYER_PAYMENT", "ORD078", 140000, "2026-08-30"),
    ("TXN003", "BUYER_PAYMENT", "ORD085", 95000, "2026-09-27"),
    ("TXN004", "BUYER_PAYMENT", "ORD091", 75000, "2026-09-30"),
    ("TXN005", "BUYER_PAYMENT", "ORD104", 90000, "2026-10-02"),
    ("TXN006", "SUPPLIER_PAYMENT", None, 46000, "2026-07-10"),
    ("TXN007", "SUPPLIER_PAYMENT", None, 62000, "2026-08-08"),
    ("TXN008", "SUPPLIER_PAYMENT", None, 90000, "2026-09-12"),
]

# Workers are assigned round-robin to these (machine, order) pairs
ASSIGN = [("W01", "ORD104"), ("W04", "ORD104"), ("W02", "ORD108"), ("W03", "ORD091")]


def build_orders():
    docs = []
    for o in ORDERS:
        raw, labour, machine, rework, other = o[12]
        revenue = o[11]
        profit = revenue - (raw + labour + machine + rework + other)
        docs.append(Order(
            orderId=o[0], buyerId=o[1], buyerName=o[2], fabricType=o[3], colour=o[4],
            quantityMeters=o[5], producedMeters=o[6], status=o[7], machineId=o[8],
            deadline=o[9], orderDate=o[10], revenue=revenue,
            costs=dict(rawMaterial=raw, labour=labour, machine=machine, rework=rework, other=other),
            profit=profit, margin=round(profit / revenue * 100, 1),
        ).model_dump())
    return docs


def build_attendance():
    rng = random.Random(42)  # fixed seed so every run gives the same data
    docs = []
    day = date(2026, 10, 1)
    while day <= date(2026, 10, 10):
        if day.weekday() != 6:  # skip Sundays
            for i, w in enumerate(WORKERS):
                machine, order = ASSIGN[i % len(ASSIGN)]
                docs.append(Attendance(
                    workerId=w[0], orderId=order, machineId=machine, hoursWorked=8,
                    overtimeHours=rng.choice([0, 0, 0.5, 1, 2]), date=day.isoformat(),
                ).model_dump())
        day += timedelta(days=1)
    return docs


def main():
    if not dbm.ping():
        raise SystemExit("MongoDB is not reachable. Check MONGODB_URI in backend/.env")

    data = {
        dbm.orders(): build_orders(),
        dbm.machines(): [Machine(
            machineId=m[0], name=f"Weaving Machine {m[0][1:]}", type="WEAVING", status=m[1],
            currentOrderId=m[2], productionRate=m[3], producedMeters=m[4], targetMeters=m[5],
            temperature=m[6], costPerHour=m[7], efficiency=m[8]).model_dump() for m in MACHINES],
        dbm.inventory(): [InventoryBatch(
            batchId=i[0], material=i[1], colour=i[2], quantityKg=i[3], costPerKg=i[4],
            supplier=i[5], receivedDate=i[6]).model_dump() for i in INVENTORY],
        dbm.workers(): [Worker(
            workerId=w[0], name=w[1], hourlyRate=w[2], shift=w[3]).model_dump() for w in WORKERS],
        dbm.attendance(): build_attendance(),
        dbm.quality_checks(): [QualityCheck(
            rollId=q[0], orderId=q[1], buyerName=q[2], machineId=q[3], yarnBatch=q[4],
            shift=q[5], status=q[6], defects=q[7], reworkCost=q[8],
            date=q[9]).model_dump() for q in QUALITY],
        dbm.transactions(): [Transaction(
            transactionId=t[0], type=t[1], orderId=t[2], amount=t[3],
            date=t[4]).model_dump() for t in TRANSACTIONS],
    }
    for coll, docs in data.items():
        coll.delete_many({})
        coll.insert_many(docs)
        print(f"{coll.name}: {len(docs)} inserted")


if __name__ == "__main__":
    main()

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
from app.services import profitability

REV = {"ORD071": 270000, "ORD078": 295000, "ORD085": 157000, "ORD091": 213000,
       "ORD104": 356000, "ORD108": 285000}

MACHINES = [
    # id, status, order, rate, produced, target, temp, costPerHour, efficiency
    ("W01", "RUNNING", "ORD104", 112, 1460, 2000, 61.0, 600, 0.91),
    ("W02", "RUNNING", "ORD108", 105, 400, 835, 58.5, 580, 0.88),
    ("W03", "RUNNING", "ORD091", 84, 1200, 1200, 66.2, 650, 0.74),
    ("W04", "RUNNING", "ORD108", 98, 360, 765, 60.1, 520, 0.85),
    ("W05", "IDLE", None, 0, 0, 0, 31.0, 450, 0.0),
    ("W06", "DOWN", None, 0, 0, 0, 28.0, 700, 0.0),
]

# Hours each machine has run today (simulator adds to this)
RUNTIME_TODAY = {"W01": 6.5, "W02": 5.2, "W03": 7.8, "W04": 4.1, "W05": 2.0, "W06": 0.0}

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

# orderId, buyerId, buyer, fabric, colour, qty, produced, status, machine, deadline, orderDate,
# revenue, yarnBatch, yarnConsumedKg (None = 0.59 kg/m), otherCost
# Costs are NOT stored here: they are computed from attendance, machines and quality checks
# by the costing service (see refresh_order at the end of main()).
ORDERS = [
    ("ORD071", "BUY004", "Royal Fabrics", "Cotton", "White", 1500, 1500, "DISPATCHED", "W02",
     "2026-07-30T18:00:00", "2026-07-05", REV["ORD071"], "YB83", None, 4000),
    ("ORD078", "BUY002", "Sunrise Textiles", "Cotton", "Red", 1800, 1800, "DISPATCHED", "W01",
     "2026-08-28T18:00:00", "2026-08-04", REV["ORD078"], "YB84", None, 4000),
    ("ORD085", "BUY003", "Metro Apparel", "Polyester", "Black", 1100, 1100, "DISPATCHED", "W03",
     "2026-09-25T18:00:00", "2026-09-02", REV["ORD085"], "YB85", None, 3000),
    ("ORD091", "BUY003", "Metro Apparel", "Polyester", "Black", 1200, 1200, "REWORK", "W03",
     "2026-10-08T18:00:00", "2026-09-15", REV["ORD091"], "YB85", 800, 4000),
    ("ORD104", "BUY001", "ABC Garments", "Cotton", "Navy Blue", 2000, 1460, "WEAVING", "W01",
     "2026-10-15T18:00:00", "2026-10-01", REV["ORD104"], "YB82", None, 4000),
    ("ORD108", "BUY005", "Greenline Exports", "Cotton", "Grey", 1600, 760, "WEAVING", "W02",
     "2026-10-22T18:00:00", "2026-10-06", REV["ORD108"], "YB86", None, 3000),
]

# rollId, orderId, buyer, machine, yarnBatch, shift, status, defects, reworkCost, date
QUALITY = [
    ("RL10005", "ORD071", "Royal Fabrics", "W02", "YB83", "A", "PASSED", [], 0, "2026-07-24"),
    ("RL10031", "ORD078", "Sunrise Textiles", "W01", "YB84", "B", "REWORK",
     ["Shade variation"], 3800, "2026-08-22"),
    ("RL10061", "ORD085", "Metro Apparel", "W03", "YB85", "A", "PASSED", [], 0, "2026-09-18"),
    ("RL10088", "ORD091", "Metro Apparel", "W03", "YB85", "C", "FAILED",
     ["Weft break", "Uneven tension"], 4180, "2026-10-03"),
    ("RL10089", "ORD091", "Metro Apparel", "W03", "YB85", "C", "REWORK",
     ["Colour patch"], 3820, "2026-10-05"),
    ("RL10092", "ORD104", "ABC Garments", "W01", "YB82", "B", "PASSED", [], 0, "2026-10-08"),
    ("RL10093", "ORD104", "ABC Garments", "W01", "YB82", "A", "PASSED", [], 0, "2026-10-09"),
]

# Seeded rework details (metres affected, rework progress) for the bad rolls
AFFECTED = {"RL10031": 90, "RL10088": 120, "RL10089": 100}
REWORK_STATUS = {"RL10031": "COMPLETED", "RL10088": "COMPLETED", "RL10089": "IN_PROGRESS"}

# Share of the order revenue the buyer has paid so far
PAID = {"ORD071": 1.0, "ORD078": 1.0, "ORD085": 1.0, "ORD091": 0.5, "ORD104": 0.4}
PAYMENT_DATES = {"ORD071": "2026-07-28", "ORD078": "2026-08-30", "ORD085": "2026-09-27",
                 "ORD091": "2026-09-30", "ORD104": "2026-10-02"}

SUPPLIER_PAYMENTS = [
    ("SUPPLIER_PAYMENT", 90000, "2026-07-10"),
    ("SUPPLIER_PAYMENT", 120000, "2026-08-08"),
    ("SUPPLIER_PAYMENT", 140000, "2026-09-12"),
]

# Work blocks: orderId, machine, first day, last day, worker indexes, overtime choices.
# One attendance record (8 h) per worker per working day (Sundays skipped).
WORK = [
    ("ORD071", "W02", "2026-07-06", "2026-07-21", [1, 2], [0, 0, 0.5, 1]),
    ("ORD078", "W01", "2026-08-05", "2026-08-24", [0, 5], [0, 0, 0.5, 1]),
    ("ORD085", "W03", "2026-09-02", "2026-09-15", [2, 6], [0, 0, 0.5, 1]),
    ("ORD091", "W03", "2026-09-16", "2026-09-30", [3, 7], [1, 2, 2, 3]),
    ("ORD091", "W03", "2026-10-01", "2026-10-10", [3], [2, 2, 3]),
    ("ORD104", "W01", "2026-10-01", "2026-10-10", [0, 4, 8], [0, 0, 0.5, 1]),
    ("ORD108", "W02", "2026-10-06", "2026-10-10", [1, 5, 9], [0, 0, 0.5, 1]),
]


def build_machines():
    return [Machine(
        machineId=m[0], name=f"Weaving Machine {m[0][1:]}", type="WEAVING", status=m[1],
        currentOrderId=m[2], productionRate=m[3], producedMeters=m[4], targetMeters=m[5],
        temperature=m[6], costPerHour=m[7], efficiency=m[8],
        runtimeToday=RUNTIME_TODAY[m[0]]).model_dump() for m in MACHINES]


def build_orders():
    return [Order(
        orderId=o[0], buyerId=o[1], buyerName=o[2], fabricType=o[3], colour=o[4],
        quantityMeters=o[5], producedMeters=o[6], status=o[7], machineId=o[8],
        deadline=o[9], orderDate=o[10], revenue=o[11], yarnBatch=o[12],
        yarnConsumedKg=o[13], otherCost=o[14],
    ).model_dump() for o in ORDERS]


def build_attendance():
    rng = random.Random(42)  # fixed seed so every run gives the same data
    docs = []
    for order_id, machine, first, last, worker_idx, overtime in WORK:
        day = date.fromisoformat(first)
        while day <= date.fromisoformat(last):
            if day.weekday() != 6:  # skip Sundays
                for i in worker_idx:
                    docs.append(Attendance(
                        workerId=WORKERS[i][0], orderId=order_id, machineId=machine,
                        hoursWorked=8, overtimeHours=rng.choice(overtime), date=day.isoformat(),
                    ).model_dump())
            day += timedelta(days=1)
    return docs


def build_transactions():
    revenue = {o[0]: o[11] for o in ORDERS}
    docs = [("BUYER_PAYMENT", order_id, round(revenue[order_id] * share), PAYMENT_DATES[order_id])
            for order_id, share in PAID.items()]
    docs += [(kind, None, amount, day) for kind, amount, day in SUPPLIER_PAYMENTS]
    return [Transaction(transactionId=f"TXN{i:03d}", type=kind, orderId=order_id,
                        amount=amount, date=day).model_dump()
            for i, (kind, order_id, amount, day) in enumerate(docs, start=1)]


def main():
    if not dbm.ping():
        raise SystemExit("MongoDB is not reachable. Check MONGODB_URI in backend/.env")

    data = {
        dbm.orders(): build_orders(),
        dbm.machines(): build_machines(),
        dbm.inventory(): [InventoryBatch(
            batchId=i[0], material=i[1], colour=i[2], quantityKg=i[3], costPerKg=i[4],
            supplier=i[5], receivedDate=i[6]).model_dump() for i in INVENTORY],
        dbm.workers(): [Worker(
            workerId=w[0], name=w[1], hourlyRate=w[2], shift=w[3]).model_dump() for w in WORKERS],
        dbm.attendance(): build_attendance(),
        dbm.quality_checks(): [QualityCheck(
            rollId=q[0], orderId=q[1], buyerName=q[2], machineId=q[3], yarnBatch=q[4],
            shift=q[5], status=q[6], defects=q[7], reworkCost=q[8], date=q[9],
            producedAt=q[9] + "T14:00:00", affectedMeters=AFFECTED.get(q[0], 0),
            reworkStatus=REWORK_STATUS.get(q[0])).model_dump() for q in QUALITY],
        dbm.transactions(): build_transactions(),
    }
    counts = {}
    for coll, docs in data.items():
        coll.delete_many({})
        coll.insert_many(docs)
        counts[coll.name] = len(docs)
        print(f"{coll.name}: {len(docs)} inserted")

    # Compute costs, profit and margin from the operational data and store them on each order
    for o in ORDERS:
        p = profitability.refresh_order(o[0])
        print(f"  {o[0]}: revenue {p['revenue']:,.0f}  cost {p['totalCost']:,.0f}  margin {p['margin']}%")
    return counts


if __name__ == "__main__":
    main()

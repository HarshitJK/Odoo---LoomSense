"""Software machine simulator (no real hardware).

It runs as an asyncio task inside the API process (started in main.py's lifespan). Every
TICK_SECONDS it advances each RUNNING machine and its order, updates MongoDB, recomputes the
order's cost and profit, and broadcasts the new state through the listeners (the WebSocket).

productionRate is metres per hour. One real second counts as one factory minute (TIME_SCALE),
so a 112 m/h machine adds about 5.6 m per 3-second tick and the numbers visibly move.
"""
import asyncio
import logging
import random
import threading
from datetime import datetime, timedelta

from app import database as dbm
from app.config import SIMULATOR_AUTOSTART
from app.services import profitability

log = logging.getLogger("loomsense.simulator")
NO_ID = {"_id": 0}
TICK_SECONDS = 3
TIME_SCALE = 60

state = {"running": SIMULATOR_AUTOSTART, "speed": 1.0}
sim_lock = threading.Lock()  # held while a tick or a demo reset writes to the database
listeners = []  # async callables that receive each message (e.g. the WebSocket broadcast)


class MachineNotFound(LookupError):
    pass


def add_listener(fn) -> None:
    if fn not in listeners:
        listeners.append(fn)


async def emit(message: dict) -> None:
    for fn in list(listeners):
        try:
            await fn(message)
        except Exception:
            log.exception("Simulator listener failed")


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def simulator_state() -> dict:
    return {"running": state["running"], "speed": state["speed"]}


# ---------- machine view (what the API and WebSocket send) ----------

def build_views(machines: list, orders: dict) -> list:
    """Add progress, cost per metre, order machine cost, ETA and runtime to each machine."""
    running_rate = {}  # orderId -> combined metres/hour of its running machines
    for m in machines:
        if m["status"] == "RUNNING" and m.get("currentOrderId"):
            running_rate[m["currentOrderId"]] = running_rate.get(m["currentOrderId"], 0) + m["productionRate"]

    now = datetime.now().replace(microsecond=0)
    views = []
    for m in machines:
        rate = m.get("productionRate", 0)
        running = m["status"] == "RUNNING"
        target = m.get("targetMeters", 0)
        produced = m.get("producedMeters", 0)

        eta = None
        order = orders.get(m.get("currentOrderId"))
        if running and order and running_rate.get(order["orderId"]):
            remaining = max(order["quantityMeters"] - order["producedMeters"], 0)
            if remaining:
                eta = (now + timedelta(hours=remaining / running_rate[order["orderId"]])).replace(microsecond=0).isoformat()

        views.append({
            "machineId": m["machineId"],
            "name": m.get("name"),
            "status": m["status"],
            "currentOrderId": m.get("currentOrderId"),
            "producedMeters": round(produced, 1),
            "targetMeters": target,
            "progress": min(round(produced / target * 100, 1), 100.0) if target else 0.0,
            "productionRate": rate if running else 0,
            "efficiency": m.get("efficiency", 0),
            "temperature": m.get("temperature"),
            "costPerHour": m.get("costPerHour", 0),
            "costPerMeter": round(m["costPerHour"] / rate, 2) if rate else 0.0,
            "orderMachineCost": round(produced / rate * m["costPerHour"], 2) if rate and m.get("currentOrderId") else 0.0,
            "estimatedCompletion": eta,
            "runtimeToday": round(m.get("runtimeToday", 0), 2),
        })
    return views


def get_snapshot() -> list:
    machines = list(dbm.machines().find({}, NO_ID).sort("machineId", 1))
    order_ids = [m["currentOrderId"] for m in machines if m.get("currentOrderId")]
    orders = {o["orderId"]: o for o in dbm.orders().find({"orderId": {"$in": order_ids}}, NO_ID)}
    return build_views(machines, orders)


def update_message(views: list) -> dict:
    return {"type": "machine_update", "timestamp": now_iso(), "simulator": simulator_state(), "machines": views}


def event_message(event: str, message: str, machine_id=None, order_id=None) -> dict:
    return {"type": "event", "event": event, "machineId": machine_id, "orderId": order_id,
            "message": message, "timestamp": now_iso()}


# ---------- one simulation step ----------

def tick() -> tuple:
    """Advance all RUNNING machines by one step. Returns (events, machine views)."""
    with sim_lock:
        return _tick()


def _complete_order(order_id: str, machine_id: str) -> dict:
    """Order reached its quantity: move it to QUALITY_CHECK, idle its machines, return the event."""
    dbm.orders().update_one({"orderId": order_id}, {"$set": {"status": "QUALITY_CHECK"}})
    # Machines keep currentOrderId so their cost stays attributed to the finished order
    dbm.machines().update_many({"currentOrderId": order_id, "status": "RUNNING"}, {"$set": {"status": "IDLE"}})
    return event_message(
        "order_completed",
        f"Order {order_id} finished production on {machine_id}. Ready for quality check.",
        machine_id, order_id)


def apply_reading(machine_id: str, reading: dict) -> tuple:
    """Apply one reading sent by a real (or replayed) machine. Returns (events, machine views).

    reading keys (all optional): temperature, productionRate, efficiency, producedMetersDelta, status.
    Raises MachineNotFound.
    """
    with sim_lock:
        m = dbm.machines().find_one({"machineId": machine_id}, NO_ID)
        if not m:
            raise MachineNotFound(f"Machine {machine_id} not found")
        events = []
        changes = {k: reading[k] for k in ("temperature", "productionRate", "efficiency", "status")
                   if reading.get(k) is not None}
        delta = reading.get("producedMetersDelta") or 0
        order = dbm.orders().find_one({"orderId": m.get("currentOrderId")}, NO_ID) if m.get("currentOrderId") else None
        finished = False
        if delta and order:
            room = max(order["quantityMeters"] - order["producedMeters"], 0)
            step = min(delta, room)
            changes["producedMeters"] = round(m.get("producedMeters", 0) + step, 2)
            total = round(order["producedMeters"] + step, 2)
            dbm.orders().update_one({"orderId": order["orderId"]}, {"$set": {"producedMeters": total}})
            finished = step > 0 and total >= order["quantityMeters"]
        if changes:
            dbm.machines().update_one({"machineId": machine_id}, {"$set": changes})
        if changes.get("status") == "DOWN":
            events.append(event_message("machine_failure", f"Machine {machine_id} is DOWN.", machine_id,
                                        m.get("currentOrderId")))
        if finished:
            events.append(_complete_order(order["orderId"], machine_id))
        if order:
            profitability.refresh_order(order["orderId"])
        return events, get_snapshot()


def _tick() -> tuple:
    events, touched = [], set()
    speed = state["speed"]
    factory_hours = TICK_SECONDS * TIME_SCALE * speed / 3600

    for machine_id in [m["machineId"] for m in dbm.machines().find({"status": "RUNNING"}, {"machineId": 1})]:
        m = dbm.machines().find_one({"machineId": machine_id}, NO_ID)
        if not m or m["status"] != "RUNNING":  # finished earlier in this tick
            continue
        changes = {
            "temperature": round(random.uniform(55, 70), 1),
            "efficiency": round(random.uniform(0.85, 0.95), 2),
            "runtimeToday": round(m.get("runtimeToday", 0) + factory_hours, 3),
        }
        order = dbm.orders().find_one({"orderId": m.get("currentOrderId")}, NO_ID) if m.get("currentOrderId") else None
        finished = False
        if order and m.get("productionRate") and order["producedMeters"] < order["quantityMeters"]:
            step = m["productionRate"] * factory_hours * random.uniform(0.6, 1.4)
            step = min(step, order["quantityMeters"] - order["producedMeters"])
            changes["producedMeters"] = round(m["producedMeters"] + step, 2)
            order_total = round(order["producedMeters"] + step, 2)
            finished = order_total >= order["quantityMeters"]
            dbm.orders().update_one({"orderId": order["orderId"]}, {"$set": {"producedMeters": order_total}})
            touched.add(order["orderId"])
        dbm.machines().update_one({"machineId": machine_id}, {"$set": changes})

        if finished:
            events.append(_complete_order(order["orderId"], machine_id))

    for order_id in touched:
        profitability.refresh_order(order_id)
    return events, get_snapshot()


async def run_forever() -> None:
    """Background loop. It always runs; state['running'] decides whether it does anything."""
    while True:
        await asyncio.sleep(TICK_SECONDS)
        if not state["running"]:
            continue
        try:
            events, views = await asyncio.to_thread(tick)
            for event in events:
                await emit(event)
            await emit(update_message(views))
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Simulator tick failed (is MongoDB up?)")


# ---------- controls ----------

def _set_status(machine_id: str, status: str) -> dict:
    machine = dbm.machines().find_one({"machineId": machine_id}, NO_ID)
    if not machine:
        raise MachineNotFound(f"Machine {machine_id} not found")
    dbm.machines().update_one({"machineId": machine_id}, {"$set": {"status": status}})
    return machine


def _start_machine(machine_id: str) -> None:
    machine = dbm.machines().find_one({"machineId": machine_id}, NO_ID)
    if not machine:
        raise MachineNotFound(f"Machine {machine_id} not found")
    if not machine.get("currentOrderId"):
        raise ValueError(f"Machine {machine_id} has no order assigned")
    _set_status(machine_id, "RUNNING")


def _fail_machine(machine_id) -> dict:
    if not machine_id:
        running = [m["machineId"] for m in dbm.machines().find({"status": "RUNNING"}, NO_ID)]
        if not running:
            raise ValueError("No running machine to fail")
        machine_id = random.choice(running)
    machine = _set_status(machine_id, "DOWN")
    return event_message(
        "machine_failure", f"Machine {machine_id} is DOWN.", machine_id, machine.get("currentOrderId"))


def reset(machine_id=None) -> None:
    """Restore the seeded machine values and the produced metres / status of their orders."""
    from app import seed  # imported here: seed imports services too

    seeded = {m["machineId"]: m for m in seed.build_machines()}
    if machine_id and machine_id not in seeded:
        raise MachineNotFound(f"Machine {machine_id} not found")
    chosen = [machine_id] if machine_id else list(seeded)

    order_ids = set()
    for mid in chosen:
        dbm.machines().replace_one({"machineId": mid}, seeded[mid], upsert=True)
        if seeded[mid].get("currentOrderId"):
            order_ids.add(seeded[mid]["currentOrderId"])
    for o in seed.build_orders():
        if o["orderId"] in order_ids:
            dbm.orders().update_one(
                {"orderId": o["orderId"]},
                {"$set": {"producedMeters": o["producedMeters"], "status": o["status"]}})
            profitability.refresh_order(o["orderId"])


async def control(action: str, machine_id=None, speed=None) -> dict:
    """Run a demo control action. Raises MachineNotFound (404) or ValueError (409)."""
    if speed is not None:
        state["speed"] = speed

    if action == "start" and not machine_id:
        state["running"] = True
        await emit(event_message("simulator_started", f"Simulator started at {state['speed']:g}x speed."))
        return {**simulator_state(), "message": "Simulator started"}
    if action == "stop" and not machine_id:
        state["running"] = False
        await emit(event_message("simulator_stopped", "Simulator stopped."))
        return {**simulator_state(), "message": "Simulator stopped"}

    if action == "start":
        await asyncio.to_thread(_start_machine, machine_id)
        message = f"Machine {machine_id} started"
    elif action == "stop":
        await asyncio.to_thread(_set_status, machine_id, "IDLE")
        message = f"Machine {machine_id} stopped"
    elif action == "reset":
        await asyncio.to_thread(reset, machine_id)
        message = f"{machine_id or 'All machines'} reset to seeded values"
    else:  # failure
        event = await asyncio.to_thread(_fail_machine, machine_id)
        await emit(event)
        message = event["message"]

    await emit(update_message(await asyncio.to_thread(get_snapshot)))
    return {**simulator_state(), "message": message}

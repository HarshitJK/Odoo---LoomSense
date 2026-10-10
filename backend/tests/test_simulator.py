import asyncio

import pytest
from fastapi.testclient import TestClient

from app import database as dbm
from app import seed
from app.main import app
from app.services import machine_simulator as sim

client = TestClient(app)

VIEW_FIELDS = {
    "machineId", "name", "status", "currentOrderId", "producedMeters", "targetMeters", "progress",
    "productionRate", "efficiency", "temperature", "costPerHour", "costPerMeter", "orderMachineCost",
    "estimatedCompletion", "runtimeToday",
}


@pytest.fixture(autouse=True)
def fresh_db():
    """The simulator changes data, so reseed before and after every test here."""
    seed.main()
    sim.state.update(running=True, speed=1.0)
    yield
    seed.main()


def machine(machine_id):
    return next(m for m in sim.get_snapshot() if m["machineId"] == machine_id)


def test_machine_view_has_all_fields():
    views = sim.get_snapshot()
    assert len(views) == 6
    assert all(set(v) == VIEW_FIELDS for v in views)
    w01 = machine("W01")
    assert w01["progress"] == 73.0
    assert w01["costPerMeter"] == pytest.approx(600 / 112, abs=0.01)
    assert w01["orderMachineCost"] == pytest.approx(1460 / 112 * 600, abs=0.01)
    assert w01["estimatedCompletion"] is not None
    assert machine("W05")["estimatedCompletion"] is None


def test_api_returns_the_same_fields_and_no_mongo_id():
    data = client.get("/api/machines").json()
    assert all(set(m) == VIEW_FIELDS for m in data)
    assert set(client.get("/api/machines/W01").json()) == VIEW_FIELDS
    assert client.get("/api/machines/NOPE").status_code == 404


def test_tick_moves_running_machines_and_updates_order():
    before = client.get("/api/orders/ORD104").json()
    events, views = sim.tick()
    after = client.get("/api/orders/ORD104").json()
    step = after["producedMeters"] - before["producedMeters"]
    assert 2 <= step <= 8
    assert after["costs"]["machine"] > before["costs"]["machine"]  # cost recomputed
    assert 55 <= next(v for v in views if v["machineId"] == "W01")["temperature"] <= 70
    assert 0.85 <= next(v for v in views if v["machineId"] == "W01")["efficiency"] <= 0.95
    assert events == []


def test_idle_and_down_machines_do_not_move():
    sim.tick()
    assert machine("W05")["producedMeters"] == 0
    assert machine("W06")["status"] == "DOWN"


def test_order_completes_and_machine_goes_idle():
    dbm.orders().update_one({"orderId": "ORD104"}, {"$set": {"producedMeters": 1999}})
    events, _ = sim.tick()
    order = client.get("/api/orders/ORD104").json()
    assert order["producedMeters"] == 2000
    assert order["status"] == "QUALITY_CHECK"
    assert machine("W01")["status"] == "IDLE"
    assert [e["event"] for e in events] == ["order_completed"]
    assert events[0]["orderId"] == "ORD104"


def test_failure_and_reset():
    result = asyncio.run(sim.control("failure", "W01"))
    assert "W01" in result["message"]
    assert machine("W01")["status"] == "DOWN"
    asyncio.run(sim.control("reset"))
    assert machine("W01")["status"] == "RUNNING"
    assert machine("W01")["producedMeters"] == 1460


def test_stop_and_start_and_speed():
    asyncio.run(sim.control("stop"))
    assert sim.state["running"] is False
    asyncio.run(sim.control("start", speed=10))
    assert sim.state["running"] is True and sim.state["speed"] == 10


def test_control_errors():
    with pytest.raises(sim.MachineNotFound):
        asyncio.run(sim.control("failure", "NOPE"))
    with pytest.raises(ValueError):
        asyncio.run(sim.control("start", "W05"))  # W05 has no order


def test_simulate_endpoint_validation():
    assert client.post("/api/machines/simulate", json={"action": "bogus"}).status_code == 422
    assert client.post("/api/machines/simulate", json={"action": "start", "speed": 0}).status_code == 422
    assert client.post("/api/machines/simulate", json={"action": "failure", "machineId": "NOPE"}).status_code == 404
    assert client.post("/api/machines/simulate", json={"action": "start", "machineId": "W05"}).status_code == 409
    ok = client.post("/api/machines/simulate", json={"action": "failure", "machineId": "W02"})
    assert ok.status_code == 200 and machine("W02")["status"] == "DOWN"


def test_websocket_sends_snapshot_on_connect():
    with client.websocket_connect("/ws/machines") as ws:
        msg = ws.receive_json()
    assert msg["type"] == "snapshot"
    assert len(msg["machines"]) == 6
    assert set(msg["machines"][0]) == VIEW_FIELDS

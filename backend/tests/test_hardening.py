import pytest
from fastapi.testclient import TestClient

from app import database as dbm
from app import seed
from app.main import app
from app.routes import demo
from app.services import machine_simulator as sim

client = TestClient(app, raise_server_exceptions=False)

GET_PATHS = [
    "/", "/api/health", "/api/orders", "/api/orders?status=WEAVING", "/api/orders/ORD104",
    "/api/orders/ORD104/cost", "/api/orders/ORD104/readiness", "/api/machines", "/api/machines/W01",
    "/api/inventory", "/api/workers", "/api/workers/wages/summary", "/api/quality", "/api/quality/RL10092",
    "/api/passport/RL10092", "/api/buyer/track/ORD104", "/api/finance/dashboard", "/api/finance/monthly",
    "/api/finance/profit-leakage", "/api/finance/orders/ORD104",
]


@pytest.fixture(autouse=True)
def fresh_db():
    seed.main()
    sim.state.update(running=True, speed=1.0)
    yield
    seed.main()


def has_key(data, key):
    if isinstance(data, dict):
        return key in data or any(has_key(v, key) for v in data.values())
    if isinstance(data, list):
        return any(has_key(v, key) for v in data)
    return False


def test_no_mongo_id_in_any_get_response():
    for path in GET_PATHS:
        if path == "/api/buyer/track/ORD104":
            path = "/api/buyer/track/" + dbm.orders().find_one({"orderId": "ORD104"})["trackingToken"]
        res = client.get(path)
        assert res.status_code == 200, path
        assert not has_key(res.json(), "_id"), path


def test_not_found_errors_have_a_detail_message():
    for path in ["/api/orders/NOPE", "/api/orders/NOPE/cost", "/api/orders/NOPE/readiness",
                 "/api/machines/NOPE", "/api/quality/NOPE", "/api/passport/NOPE", "/api/passport/NOPE/qr",
                 "/api/buyer/track/NOPE", "/api/finance/orders/NOPE", "/api/finance/profit-leakage?order_id=NOPE",
                 "/api/no-such-route"]:
        res = client.get(path)
        assert res.status_code == 404, path
        assert isinstance(res.json()["detail"], str), path


def test_validation_errors_are_422_with_a_readable_detail():
    res = client.post("/api/orders", json={"buyerName": "x", "quantityMeters": -5})
    assert res.status_code == 422
    body = res.json()
    assert isinstance(body["detail"], str) and "quantityMeters" in body["detail"]
    assert isinstance(body["errors"], list)
    bad = [
        ("post", "/api/inventory", {"batchId": "X", "quantityKg": -1}),
        ("post", "/api/attendance", {"workerId": "EMP021", "hoursWorked": 30}),
        ("post", "/api/workers", {"workerId": "E", "name": "n", "hourlyRate": -1}),
        ("patch", "/api/machines/W01", {"status": "BROKEN"}),
        ("post", "/api/orders/readiness-check", {"quantityMeters": 0, "colour": "x", "fabricType": "y"}),
    ]
    for method, path, payload in bad:
        res = getattr(client, method)(path, json=payload)
        assert res.status_code == 422, (path, res.text)
        assert isinstance(res.json()["detail"], str)


def test_invalid_month_is_rejected():
    for path in ["/api/finance/dashboard?month=2026-13", "/api/finance/dashboard?month=oct",
                 "/api/workers/wages/summary?month=.*", "/api/workers/wages/summary?month=2026-1"]:
        assert client.get(path).status_code == 422, path


def test_duplicates_return_409():
    assert client.post("/api/workers", json={"workerId": "EMP021", "name": "Dup"}).status_code == 409
    assert client.post("/api/inventory", json={"batchId": "YB82"}).status_code == 409


def test_unexpected_exception_returns_json_500():
    def boom():
        raise RuntimeError("boom")
    app.add_api_route("/__boom", boom)
    res = client.get("/__boom")
    assert res.status_code == 500 and res.json() == {"detail": "Internal server error"}


def test_nothing_crashes_when_referenced_records_are_missing():
    dbm.orders().delete_one({"orderId": "ORD104"})   # attendance, quality, machines still point to it
    dbm.workers().delete_one({"workerId": "EMP021"})
    dbm.inventory().delete_one({"batchId": "YB82"})
    dbm.machines().delete_one({"machineId": "W04"})
    ok = ["/api/orders", "/api/machines", "/api/machines/W01", "/api/workers", "/api/workers/wages/summary",
          "/api/inventory", "/api/quality", "/api/quality/RL10092", "/api/passport/RL10092",
          "/api/finance/dashboard", "/api/finance/monthly", "/api/finance/profit-leakage",
          "/api/finance/orders/ORD091", "/api/orders/ORD091/cost", "/api/orders/ORD108/readiness"]
    for path in ok:
        assert client.get(path).status_code == 200, path
    for path in ["/api/orders/ORD104", "/api/orders/ORD104/cost", "/api/buyer/track/ORD104"]:
        assert client.get(path).status_code == 404, path
    # writes that point at the missing order fail cleanly instead of crashing
    assert client.post("/api/quality", json={"orderId": "ORD104", "status": "PASSED"}).status_code == 404
    assert client.post("/api/transactions", json={"orderId": "ORD104", "amount": 5}).status_code == 404
    attendance = client.post("/api/attendance", json={"workerId": "EMP022", "orderId": "ORD104", "hoursWorked": 8})
    assert attendance.status_code == 201
    assert client.patch("/api/machines/W01", json={"status": "IDLE"}).status_code == 200
    events, views = sim.tick()   # machines whose order no longer exists must not break the simulator
    assert len(views) == 5


def test_demo_reset_needs_the_admin_key(monkeypatch):
    monkeypatch.setattr(demo, "ADMIN_KEY", None)
    assert client.post("/api/demo/reset", headers={"X-Admin-Key": "k"}).status_code == 403   # disabled
    monkeypatch.setattr(demo, "ADMIN_KEY", "secret")
    assert client.post("/api/demo/reset").status_code == 403
    assert client.post("/api/demo/reset", headers={"X-Admin-Key": "wrong"}).status_code == 403

    client.post("/api/transactions", json={"orderId": "ORD104", "amount": 1})
    dbm.orders().delete_one({"orderId": "ORD108"})
    res = client.post("/api/demo/reset", headers={"X-Admin-Key": "secret"})
    assert res.status_code == 200
    assert res.json()["inserted"]["orders"] == 6
    assert client.get("/api/orders/ORD108").status_code == 200
    assert client.get("/api/orders/ORD104").json()["paidAmount"] == 142400.0


def test_dashboard_is_fast():
    import time
    client.get("/api/finance/dashboard")
    start = time.perf_counter()
    assert client.get("/api/finance/dashboard").status_code == 200
    assert time.perf_counter() - start < 1.0

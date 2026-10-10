import os
import pytest
from fastapi.testclient import TestClient
from app import database as dbm, seed
from app.main import app
from app.services import costing, month_end, machine_simulator


@pytest.fixture(autouse=True)
def fresh():
    seed.main()


def login(role="OWNER"):
    c = TestClient(app)
    email = {"OWNER": "owner", "PRODUCTION_MANAGER": "manager", "WORKER_QC": "qc"}[role] + "@loomsense.demo"
    r = c.post("/api/auth/login", json={"email": email, "password": os.environ["SEED_" + role + "_PASSWORD"]})
    assert r.status_code == 200
    c.headers["Authorization"] = "Bearer " + r.json()["accessToken"]
    return c


def test_month_spanning_order_uses_activity_dates():
    dbm.transactions().insert_one({"transactionId": "TESTOCT", "orderId": "ORD091", "type": "BUYER_PAYMENT", "date": "2026-10-10", "amount": 11111})
    october = month_end.report("2026-10")
    september = month_end.report("2026-09")
    assert october["buyerPaymentsReceived"] == 142400 + 11111
    assert september["buyerPaymentsReceived"] == 157000 + 106500
    assert next(o for o in october["orderProfitability"] if o["orderId"] == "ORD091")["orderDate"] == "2026-09-15"
    assert next(m for m in october["machineProduction"] if m["machineId"] == "W03")["producedMeters"] == 600
    assert october["reworkCost"] == 8000
    assert october["workerWages"] == costing.wages_summary("2026-10")["totalWorkforceCost"]
    assert october["rawMaterialBills"] == 950 * 180 + 780 * 165
    assert october["netCashResult"] == round(october["totalCashIn"] - october["totalExpenses"], 2)


def test_purchase_stock_and_order_consumption_stay_separate():
    c = login()
    before = costing.calculate_order_cost("ORD104")["totalCost"]
    body = {"supplier": "Supplier A", "invoiceNumber": "NEW-BILL", "batchId": "YB82", "material": "Cotton Yarn", "colour": "Navy Blue", "quantityKg": 100, "costPerKg": 180, "otherCharges": 100, "purchaseDate": "2026-09-30", "paidAmount": 1000}
    r = c.post("/api/purchases", json=body)
    assert r.status_code == 201
    assert r.json()["totalAmount"] == 18100 and r.json()["paymentStatus"] == "PARTIAL"
    assert dbm.inventory().find_one({"batchId": "YB82"})["quantityKg"] == 1050
    assert costing.calculate_order_cost("ORD104")["totalCost"] == before
    assert c.post("/api/purchases", json=body).status_code == 409
    october_before = month_end.report("2026-10")
    assert c.patch("/api/purchases/" + r.json()["purchaseId"], json={"paymentAmount": 17100, "paymentDate": "2026-10-02"}).json()["paymentStatus"] == "PAID"
    october_after = month_end.report("2026-10")
    assert october_after["rawMaterialBills"] == october_before["rawMaterialBills"]
    assert october_after["supplierPaymentsMade"] == october_before["supplierPaymentsMade"] + 17100


def test_historical_wages_and_machine_cost_survive_rate_changes():
    before = month_end.report("2026-10")
    order_before = costing.calculate_order_cost("ORD104")
    dbm.workers().update_many({}, {"$set": {"hourlyRate": 9999}})
    dbm.machines().update_many({}, {"$set": {"costPerHour": 9999, "currentOrderId": None}})
    after = month_end.report("2026-10")
    assert before["workerWages"] == after["workerWages"]
    assert before["machineOperatingCost"] == after["machineOperatingCost"]
    assert order_before["costs"] == costing.calculate_order_cost("ORD104")["costs"]


@pytest.mark.parametrize("path", ["/api/orders", "/api/inventory", "/api/machines", "/api/workers", "/api/quality", "/api/finance/month-end?month=2026-10", "/api/purchases"])
def test_internal_routes_require_login(path):
    assert TestClient(app).get(path).status_code == 401


def test_roles_and_public_allowlists():
    manager, qc, public = login("PRODUCTION_MANAGER"), login("WORKER_QC"), TestClient(app)
    for c in (manager, qc):
        for path in ("/api/finance/dashboard", "/api/workers", "/api/purchases", "/api/orders/ORD104/cost"):
            assert c.get(path).status_code == 403
        quality = c.get("/api/quality").json()
        assert all("reworkCost" not in q and "impact" not in q for q in quality)
    assert manager.get("/api/orders").status_code == 200
    assert "profit" not in manager.get("/api/orders/ORD104").json()
    assert qc.get("/api/orders").status_code == 403
    assert qc.get("/api/quality/options").status_code == 200
    order = dbm.orders().find_one({"orderId": "ORD104"})
    r = public.get("/api/buyer/track/" + order["trackingToken"])
    assert r.status_code == 200
    assert set(r.json()) == {"orderId", "buyerName", "fabricType", "colour", "quantityMeters", "progress", "currentStage", "stages", "expectedCompletion", "qualityStatus", "dispatchStatus"}
    assert public.get("/api/buyer/track/ORD104").status_code == 404
    assert public.get("/api/passport/RL10092").status_code == 200


def test_new_tokens_unique_and_invalid_sessions_rejected():
    c = login()
    a = c.post("/api/orders", json={"buyerName": "Test", "quantityMeters": 10}).json()
    b = c.post("/api/orders", json={"buyerName": "Test", "quantityMeters": 10}).json()
    assert len(a["trackingToken"]) >= 22 and a["trackingToken"] != b["trackingToken"]
    c.headers["Authorization"] = "Bearer broken"
    assert c.get("/api/auth/me").status_code == 401


def test_machine_history_written_and_no_historical_reconstruction():
    before = dbm.db.machineProductionEvents.count_documents({})
    machine_simulator.tick()
    assert dbm.db.machineProductionEvents.count_documents({}) > before
    assert costing.calculate_order_cost("ORD104")["costs"]["machine"] > 1460 / 112 * 600
    empty = month_end.report("2025-01")
    assert empty["productionOverview"]["producedMeters"] == 0
    assert empty["totalCashIn"] == empty["totalExpenses"] == 0


def test_reservation_and_consumption():
    c = login()
    before = dbm.inventory().find_one({"batchId": "YB82"})["quantityKg"]
    assert c.post("/api/orders/ORD104/reserve", json={"batchId": "YB82", "quantityKg": 100}).status_code == 200
    assert dbm.inventory().find_one({"batchId": "YB82"})["quantityKg"] == before
    c.post("/api/machines/W01/readings", json={"producedMetersDelta": 10})
    assert dbm.inventory().find_one({"batchId": "YB82"})["quantityKg"] == pytest.approx(before - 5.9)
    assert c.post("/api/orders/ORD104/reserve", json={"batchId": "YB82", "quantityKg": 10000}).status_code == 409


def test_expired_jwt_and_unauthenticated_websocket():
    import jwt
    from starlette.websockets import WebSocketDisconnect
    token = jwt.encode({"sub": "owner@loomsense.demo", "iat": 1, "exp": 2,
        "iss": "loomsense", "aud": "loomsense-internal"}, os.environ["JWT_SECRET"], algorithm="HS256")
    c = TestClient(app)
    assert c.get("/api/orders", headers={"Authorization": "Bearer " + token}).status_code == 401
    with pytest.raises(WebSocketDisconnect):
        with c.websocket_connect("/ws/machines") as ws:
            ws.send_json({"token": token})
            ws.receive_json()


def test_routes_schema_and_invalid_dates():
    c = login()
    schema = c.get("/openapi.json")
    assert schema.status_code == 200
    for route in ("/api/auth/login", "/api/purchases/monthly", "/api/finance/month-end", "/api/machines/monthly-summary"):
        assert route in schema.json()["paths"]
    assert c.post("/api/transactions", json={"orderId": "ORD104", "amount": 5, "date": "2026-99-12"}).status_code == 422
    assert c.post("/api/attendance", json={"workerId": "EMP021", "hoursWorked": 20, "overtimeHours": 10}).status_code == 422
    assert c.get("/api/finance/month-end?month=2026-13").status_code == 422
    assert "passwordHash" not in c.get("/api/auth/me").json()

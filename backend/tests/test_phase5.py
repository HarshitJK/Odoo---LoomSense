import pytest
from fastapi.testclient import TestClient

from app import seed
from app.main import app
from app.services import costing, qr_service

client = TestClient(app)

# No key containing any of these may appear anywhere in a public response
FORBIDDEN = ("revenue", "cost", "wage", "profit", "margin", "supplier", "alert", "labour",
             "rework", "impact", "paid", "pending", "rate", "machine")
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


@pytest.fixture(autouse=True)
def fresh_db():
    seed.main()
    yield
    seed.main()


def all_keys(data):
    if isinstance(data, dict):
        for key, value in data.items():
            yield key
            yield from all_keys(value)
    elif isinstance(data, list):
        for item in data:
            yield from all_keys(item)


def assert_public(data):
    bad = [k for k in all_keys(data) if any(word in k.lower() for word in FORBIDDEN)]
    assert not bad, f"internal keys leaked: {bad}"


def post_roll(**body):
    body.setdefault("orderId", "ORD104")
    return client.post("/api/quality", json=body)


# ---- cost impact ----

def test_rework_impact_maths_for_120_metres():
    impact = costing.calculate_rework_impact(120, 180)
    assert impact["additionalLabour"] == pytest.approx(120 * 9.2)    # 1104
    assert impact["machineCost"] == pytest.approx(120 * 5.7)         # 684
    assert impact["materialLoss"] == pytest.approx(120 * 0.59 * 180)  # 12744
    assert impact["total"] == pytest.approx(1104 + 684 + 12744)


def test_rework_roll_cost_flows_into_order_and_margin_drops():
    before = client.get("/api/orders/ORD104/cost").json()["costs"]["rework"]
    res = post_roll(status="REWORK", affectedMeters=120, yarnBatch="YB82", defects=["Weft break"])
    assert res.status_code == 201
    body = res.json()
    assert body["impact"] == {"additionalLabour": 1104.0, "machineCost": 684.0,
                              "materialLoss": 12744.0, "total": 14532.0}
    assert body["reworkCost"] == 14532.0
    assert body["marginAfter"] < body["marginBefore"]
    assert body["rollId"].startswith("RL")
    assert body["reworkStatus"] == "IN_PROGRESS"

    assert client.get("/api/orders/ORD104/cost").json()["costs"]["rework"] == pytest.approx(before + 14532)
    order = client.get("/api/orders/ORD104").json()
    assert order["margin"] == body["marginAfter"]
    assert order["costs"]["rework"] == pytest.approx(before + 14532)
    dashboard = client.get("/api/finance/dashboard").json()
    assert dashboard["kpis"]["reworkCost"] >= 14532


def test_failed_roll_also_gets_impact_and_passed_roll_does_not():
    failed = post_roll(status="FAILED", affectedMeters=50).json()
    assert failed["impact"]["total"] == pytest.approx(50 * 9.2 + 50 * 5.7 + 50 * 0.59 * 180)
    passed = post_roll(status="PASSED", affectedMeters=50).json()
    assert passed["impact"]["total"] == 0
    assert passed["marginBefore"] == passed["marginAfter"] or passed["marginBefore"] > passed["marginAfter"]
    assert passed["reworkStatus"] == "NOT_REQUIRED"


def test_roll_id_supplied_or_generated_and_validation():
    assert post_roll(status="PASSED", rollId="RL-20000").json()["rollId"] == "RL20000"
    assert post_roll(status="PASSED", rollId="RL20000").status_code == 409
    first = post_roll(status="PASSED").json()["rollId"]
    second = post_roll(status="PASSED").json()["rollId"]
    assert int(second[2:]) == int(first[2:]) + 1
    assert post_roll(orderId="NOPE", status="PASSED").status_code == 404
    assert post_roll(status="BROKEN").status_code == 422
    assert post_roll(status="REWORK", affectedMeters=-5).status_code == 422


# ---- fabric passport ----

def test_passport_fields_and_no_internal_data():
    res = client.get("/api/passport/RL10092")
    assert res.status_code == 200
    passport = res.json()
    assert set(passport) == {"rollId", "orderId", "buyerName", "yarnBatch", "machineId", "shift",
                             "producedAt", "qualityStatus", "defects", "reworkStatus"}
    assert passport["buyerName"] == "ABC Garments"
    assert passport["qualityStatus"] == "PASSED"
    assert passport["yarnBatch"] == "YB82"
    # reworkStatus and machineId are part of the passport; money fields are not
    for key in passport:
        assert not any(word in key.lower() for word in ("cost", "revenue", "profit", "margin", "impact", "wage"))


def test_passport_of_failed_roll_hides_cost_and_accepts_hyphen():
    passport = client.get("/api/passport/RL-10088").json()
    assert passport["qualityStatus"] == "FAILED"
    assert passport["defects"] == ["Weft break", "Uneven tension"]
    assert "reworkCost" not in passport and "impact" not in passport
    assert client.get("/api/passport/NOPE").status_code == 404


def test_passport_qr_is_a_png_pointing_to_the_passport_page():
    res = client.get("/api/passport/RL10092/qr")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert res.content.startswith(PNG_SIGNATURE)
    assert qr_service.passport_url("RL10092").endswith("/passport/RL10092")
    assert client.get("/api/passport/NOPE/qr").status_code == 404


# ---- buyer tracking ----

def test_buyer_tracking_never_exposes_internal_fields():
    for order in client.get("/api/orders").json():
        res = client.get(f"/api/buyer/track/{order['orderId']}")
        assert res.status_code == 200
        data = res.json()
        assert_public(data)
        assert set(data) == {"orderId", "buyerName", "fabricType", "colour", "quantityMeters", "progress",
                             "currentStage", "stages", "expectedCompletion", "qualityStatus",
                             "dispatchStatus"}
        text = res.text.lower()
        assert "supplier" not in text


def test_buyer_tracking_stays_public_after_rework():
    post_roll(status="REWORK", affectedMeters=120)
    data = client.get("/api/buyer/track/ORD104").json()
    assert_public(data)
    assert data["qualityStatus"] == "IN_REVIEW"


def test_buyer_tracking_accepts_hyphen_and_lowercase():
    a = client.get("/api/buyer/track/ORD104").json()
    assert client.get("/api/buyer/track/ORD-104").json() == a
    assert client.get("/api/buyer/track/ord-104").json() == a


def test_buyer_tracking_unknown_order_has_friendly_404():
    res = client.get("/api/buyer/track/ORD-999")
    assert res.status_code == 404
    assert "couldn't find" in res.json()["detail"]


def test_buyer_tracking_stages():
    ord104 = client.get("/api/buyer/track/ORD104").json()
    assert [s["name"] for s in ord104["stages"]] == [
        "Raw Material Allocated", "Spinning", "Weaving", "Dyeing", "Quality Check", "Ready for Dispatch"]
    assert [s["state"] for s in ord104["stages"]] == [
        "DONE", "DONE", "IN_PROGRESS", "PENDING", "PENDING", "PENDING"]
    assert ord104["currentStage"] == "Weaving"
    assert ord104["progress"] == 73
    assert ord104["stages"][2]["progress"] == 73
    assert ord104["dispatchStatus"] == "NOT_DISPATCHED"
    assert ord104["qualityStatus"] == "PASSED"

    ord091 = client.get("/api/buyer/track/ORD091").json()
    assert ord091["currentStage"] == "Quality Check"
    assert ord091["qualityStatus"] == "IN_REVIEW"

    ord071 = client.get("/api/buyer/track/ORD071").json()
    assert all(s["state"] == "DONE" for s in ord071["stages"])
    assert ord071["dispatchStatus"] == "DISPATCHED"
    assert ord071["currentStage"] == "Dispatched"


# ---- transactions ----

def test_buyer_payment_updates_paid_and_pending():
    before = client.get("/api/finance/orders/ORD104").json()
    assert before["paidAmount"] == 142400.0
    res = client.post("/api/transactions", json={"orderId": "ORD-104", "amount": 50000})
    assert res.status_code == 201
    body = res.json()
    assert body["transactionId"] == "TXN009" and body["type"] == "BUYER_PAYMENT"
    assert body["order"]["paidAmount"] == 192400.0
    assert body["order"]["pendingAmount"] == before["revenue"] - 192400.0
    assert client.get("/api/orders/ORD104").json()["paidAmount"] == 192400.0
    kpis = client.get("/api/finance/dashboard").json()["kpis"]
    assert kpis["paymentsReceived"] >= 192400
    assert kpis["paymentsPending"] >= 0


def test_transaction_validation():
    assert client.post("/api/transactions", json={"amount": 100}).status_code == 422          # no order
    assert client.post("/api/transactions", json={"orderId": "NOPE", "amount": 100}).status_code == 404
    assert client.post("/api/transactions", json={"orderId": "ORD104", "amount": 0}).status_code == 422
    supplier = client.post("/api/transactions", json={"type": "SUPPLIER_PAYMENT", "amount": 1000})
    assert supplier.status_code == 201 and "order" not in supplier.json()

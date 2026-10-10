"""Private buyer tracking link: random token per order, no order-id lookup, buyer-safe response."""
import logging

import pytest
from fastapi.testclient import TestClient

from app import database as dbm
from app.main import app, MaskTrackingTokens
from app.services import rate_limit, tracking
from app.services.auth import issue_token
from app.utils.tokens import new_tracking_token, mask_tracking_path

client = TestClient(app, raise_server_exceptions=False)
public = TestClient(app, raise_server_exceptions=False)  # never logged in

FORBIDDEN = ("cost", "revenue", "profit", "margin", "wage", "supplier", "alert", "paid", "trackingToken")
PUBLIC_KEYS = {"orderId", "buyerName", "fabricType", "colour", "quantityMeters", "progress", "currentStage",
               "stages", "expectedCompletion", "qualityStatus", "dispatchStatus"}
NOT_FOUND = {"detail": "Tracking link not found"}


def keys_of(data):
    if isinstance(data, dict):
        for k, v in data.items():
            yield k
            yield from keys_of(v)
    elif isinstance(data, list):
        for v in data:
            yield from keys_of(v)


@pytest.fixture(autouse=True)
def as_owner():
    client.headers["Authorization"] = "Bearer " + issue_token({"email": "owner@loomsense.demo"})


def token_of(order_id="ORD104"):
    return client.get(f"/api/orders/{order_id}").json()["trackingToken"]


def test_token_created_with_order_is_long_and_unique():
    a = client.post("/api/orders", json={"buyerName": "A", "quantityMeters": 10}).json()
    b = client.post("/api/orders", json={"buyerName": "B", "quantityMeters": 10}).json()
    assert len(a["trackingToken"]) >= 22 and a["trackingToken"] != b["trackingToken"]
    assert a["trackingUrl"].endswith("/track/" + a["trackingToken"])
    tokens = [o["trackingToken"] for o in client.get("/api/orders").json()]
    assert len(tokens) == len(set(tokens))
    assert len(new_tracking_token()) >= 22


def test_public_endpoint_works_with_token_and_is_buyer_safe():
    res = public.get("/api/buyer/track/" + token_of())
    assert res.status_code == 200
    data = res.json()
    assert set(data) == PUBLIC_KEYS
    for key in keys_of(data):
        assert not any(word.lower() in key.lower() for word in FORBIDDEN), key
    assert token_of() not in res.text
    assert res.headers["cache-control"] == "no-store"
    assert res.headers["x-robots-tag"] == "noindex, nofollow"
    assert res.headers["referrer-policy"] == "no-referrer"


def test_order_ids_and_random_strings_get_the_same_404():
    for value in ("ORD104", "ORD-104", "ord-104", "x" * 22, "not-a-token", "A" * 500):
        res = public.get("/api/buyer/track/" + value)
        assert res.status_code == 404, value
        assert res.json() == NOT_FOUND, value
        assert res.headers["cache-control"] == "no-store"


def test_regenerate_invalidates_old_token():
    old = token_of()
    res = client.post("/api/orders/ORD104/tracking/regenerate")
    assert res.status_code == 200
    body = res.json()
    assert body["trackingToken"] != old and body["trackingUrl"].endswith("/track/" + body["trackingToken"])
    assert public.get("/api/buyer/track/" + old).json() == NOT_FOUND
    assert public.get("/api/buyer/track/" + body["trackingToken"]).status_code == 200
    assert token_of() == body["trackingToken"]


def test_regenerate_unknown_order_404_and_needs_login():
    assert client.post("/api/orders/ORD999/tracking/regenerate").status_code == 404
    assert public.post("/api/orders/ORD104/tracking/regenerate").status_code == 401


def test_qc_role_cannot_read_or_regenerate_links():
    qc = TestClient(app, raise_server_exceptions=False)
    qc.headers["Authorization"] = "Bearer " + issue_token({"email": "qc@loomsense.demo"})
    assert qc.get("/api/orders/ORD104").status_code == 403
    assert qc.post("/api/orders/ORD104/tracking/regenerate").status_code == 403


def test_backfill_gives_tokens_to_orders_without_one():
    dbm.orders().drop_index("trackingToken_1")  # a database seeded before the index existed
    dbm.orders().update_one({"orderId": "ORD071"}, {"$unset": {"trackingToken": ""}})
    dbm.orders().update_one({"orderId": "ORD078"}, {"$set": {"trackingToken": None}})
    assert tracking.ensure_tracking_tokens() == 2
    assert len(token_of("ORD071")) >= 22 and len(token_of("ORD078")) >= 22
    assert tracking.ensure_tracking_tokens() == 0
    tracking.ensure_indexes()  # idempotent, and unique again
    tracking.ensure_indexes()
    assert "trackingToken_1" in dbm.orders().index_information()


def test_rate_limit_returns_429_after_60_requests_per_minute():
    rate_limit.reset()
    codes = [public.get("/api/buyer/track/" + "z" * 22).status_code for _ in range(61)]
    assert codes[:60] == [404] * 60 and codes[60] == 429
    assert public.get("/api/buyer/track/" + "z" * 22).headers["cache-control"] == "no-store"
    rate_limit.reset()


def test_tokens_are_masked_in_logs():
    token = new_tracking_token()
    assert token not in mask_tracking_path(f"/api/buyer/track/{token}?x=1")
    record = logging.LogRecord("uvicorn.access", logging.INFO, "", 0, '%s - "%s %s HTTP/%s" %d',
                               ("1.2.3.4:5", "GET", f"/api/buyer/track/{token}", "1.1", 200), None)
    MaskTrackingTokens().filter(record)
    assert token not in record.getMessage()

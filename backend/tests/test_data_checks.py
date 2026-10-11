from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from app import database as dbm, seed, data_checks
from app.main import app
from app.services import machine_simulator as sim, profitability
from tests.test_quality_gate import login
import docker_seed


@pytest.fixture(autouse=True)
def fresh():
    seed.main()
    sim.state.update(running=False, speed=1)
    yield
    seed.main()


def test_seed_is_clean_and_cli_succeeds(capsys):
    assert data_checks.check_data() == []
    assert data_checks.main() == 0
    assert "clean (0 anomalies)" in capsys.readouterr().out


def test_corruption_is_detected(capsys):
    dbm.machines().update_one({"machineId": "W03"}, {"$set": {"status": "RUNNING", "runtimeToday": 25}})
    dbm.quality_checks().insert_one({"inspectionId": "BAD", "orderId": "ORD071", "date": "2026-10-11"})
    dbm.orders().update_one({"orderId": "ORD104"}, {"$set": {"costs.machine": float("nan")}})
    issues = "\n".join(data_checks.check_data())
    for text in ("RUNNING without", "exceeds 24", "Inspection BAD", "missing shift", "nan"):
        assert text in issues
    assert data_checks.main() == 1


def test_cost_and_production_anomalies():
    dbm.orders().update_one({"orderId": "ORD104"}, {"$set": {"producedMeters": 2001}})
    dbm.db.machineProductionEvents.update_one({"orderId": "ORD104"}, {"$set": {"machineCost": 900000}})
    issues = "\n".join(data_checks.check_data())
    for text in ("exceeds quantityMeters", "150%", "40%", "below -20%", "invalid numeric value"):
        assert text in issues


def test_zero_revenue_with_production_is_detected():
    dbm.orders().update_many({}, {"$set": {"revenue": 0}})
    assert any("zero revenue with costs" in issue for issue in data_checks.check_data())


@pytest.mark.parametrize("enabled", [True, False])
def test_seed_version_upgrade_is_opt_in(monkeypatch, enabled):
    dbm.db.meta.update_one({"_id": "seed"}, {"$set": {"seedVersion": "old"}})
    dbm.orders().update_one({"orderId": "ORD104"}, {"$set": {"buyerName": "Manual edit"}})
    dbm.db.users.update_one({"email": "retain@example.test"}, {"$set": {"active": True}}, upsert=True)
    monkeypatch.setenv("AUTO_RESEED_ON_VERSION_CHANGE", str(enabled).lower())
    monkeypatch.setenv("FORCE_SEED", "false")
    docker_seed.main()
    assert (dbm.orders().find_one({"orderId": "ORD104"})["buyerName"] == "ABC Garments") is enabled
    assert dbm.db.meta.find_one({"_id": "seed"})["seedVersion"] == (seed.SEED_VERSION if enabled else "old")
    assert dbm.db.users.find_one({"email": "retain@example.test"})


def test_force_seed_works_at_current_version(monkeypatch):
    dbm.orders().update_one({"orderId": "ORD104"}, {"$set": {"buyerName": "Manual edit"}})
    monkeypatch.setenv("FORCE_SEED", "true")
    monkeypatch.setenv("AUTO_RESEED_ON_VERSION_CHANGE", "false")
    docker_seed.main()
    assert dbm.orders().find_one({"orderId": "ORD104"})["buyerName"] == "ABC Garments"


def test_dispatched_inspection_rejected_and_old_record_readable():
    owner = login("OWNER")
    r = owner.post("/api/quality", json={"orderId": "ORD071", "status": "REWORK"})
    assert r.status_code == 409 and "dispatched" in r.json()["detail"]
    assert owner.get("/api/quality/RL10005").status_code == 200


@pytest.mark.parametrize("hour, expected", [(5, "C"), (6, "A"), (13, "A"), (14, "B"), (21, "B"), (22, "C")])
def test_missing_shift_derived_and_supplied_shift_kept(monkeypatch, hour, expected):
    from app.routes import quality
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 10, 11, hour, tzinfo=tz)
    monkeypatch.setattr(quality, "datetime", Clock)
    owner = login("OWNER")
    for supplied, shift in [(None, expected), ("C", "C")]:
        body = {"orderId": "ORD104", "status": "PASSED"}
        if supplied:
            body["shift"] = supplied
        r = owner.post("/api/quality", json=body)
        assert r.status_code == 201, r.text
        assert r.json()["shift"] == shift
        assert dbm.quality_checks().find_one({"rollId": r.json()["rollId"]})["shift"] == shift


def test_month_defaults_and_empty_production(monkeypatch):
    from app.routes import finance
    monkeypatch.setattr(finance, "DEMO_MONTH", "2026-10")
    owner = login("OWNER")
    assert owner.get("/api/finance/dashboard").json()["month"] == "2026-10"
    assert owner.get("/api/finance/month-end").json()["month"] == "2026-10"
    empty = owner.get("/api/finance/dashboard?month=2020-01").json()
    assert empty["kpis"]["profitMargin"] is None
    assert empty["note"] == "No production recorded this month"
    assert owner.get("/api/finance/month-end?month=2020-01").json()["month"] == "2020-01"


def test_in_progress_margin_uses_earned_revenue():
    p = profitability.order_profit("ORD104")
    assert p["earnedRevenue"] == 356000 * .73
    assert p["profit"] == round(p["earnedRevenue"] - p["totalCost"], 2)
    assert p["margin"] == round(p["profit"] / p["earnedRevenue"] * 100, 1)
    assert profitability.order_profit("ORD091")["margin"] == 17.2


def test_30000_ticks_stay_bounded(monkeypatch):
    # Reproduce the broken deployed state, not just the repaired seed.
    dbm.machines().update_one({"machineId": "W03"}, {"$set": {"status": "RUNNING"}})
    sim.state.update(running=True, speed=10)
    before = profitability.order_profit("ORD091")["costs"]["machine"]
    pauses = 0
    for _ in range(30000):
        events, views = sim.tick()
        pauses += sum(e["event"] == "simulator_paused" for e in events)
        assert all(0 <= m["runtimeToday"] <= 24 for m in views)
    assert profitability.order_profit("ORD091")["costs"]["machine"] == before
    assert dbm.machines().find_one({"machineId": "W03"})["runtimeToday"] == 0
    assert -5 <= profitability.monthly_summary("2026-10")["margin"] <= 60
    assert not sim.state["running"] and pauses == 1


@pytest.mark.parametrize("order_id", [None, "MISSING", "ORD071", "ORD091"])
def test_invalid_running_assignments_never_accrue(order_id):
    dbm.machines().update_one({"machineId": "W03"}, {"$set": {"status": "RUNNING", "currentOrderId": order_id}})
    count = dbm.db.machineProductionEvents.count_documents({"machineId": "W03"})
    sim.tick()
    m = dbm.machines().find_one({"machineId": "W03"})
    assert m["status"] == "IDLE" and m["runtimeToday"] == 0
    assert dbm.db.machineProductionEvents.count_documents({"machineId": "W03"}) == count


def test_new_day_resets_idle_and_running_runtime():
    dbm.machines().update_many({}, {"$set": {"runtimeDate": "2020-01-01", "runtimeToday": 24}})
    sim.tick()
    for m in dbm.machines().find({}):
        assert m["runtimeDate"] == datetime.now(timezone.utc).date().isoformat()
        assert 0 <= m["runtimeToday"] <= .05


def test_no_material_does_not_charge_runtime():
    dbm.inventory().update_one({"batchId": "YB82"}, {"$set": {"quantityKg": 0}})
    before = profitability.order_profit("ORD104")["costs"]["machine"]
    sim.tick()
    assert profitability.order_profit("ORD104")["costs"]["machine"] == before
    assert dbm.machines().find_one({"machineId": "W01"})["runtimeToday"] == 0

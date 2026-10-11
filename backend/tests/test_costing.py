import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import costing, order_readiness, profitability

client = TestClient(app)


# ---- pure calculations ----

def test_labour_cost_with_overtime():
    records = [
        {"workerId": "A", "hoursWorked": 8, "overtimeHours": 2},
        {"workerId": "B", "hoursWorked": 8, "overtimeHours": 0},
    ]
    result = costing.calculate_labour_cost(records, {"A": 100, "B": 80})
    assert result["regular"] == 8 * 100 + 8 * 80          # 1440
    assert result["overtime"] == 2 * 100 * 1.5            # 300
    assert result["total"] == 1740
    assert result["hours"] == 18
    assert result["workers"] == 2


def test_true_cost_profit_and_margin():
    costs = {"rawMaterial": 100, "labour": 20, "machine": 10, "rework": 5, "other": 5}
    total = costing.calculate_true_order_cost(costs)
    assert total == 140
    profit = profitability.calculate_profit(200, total)
    assert profit == 60
    assert profitability.calculate_margin(200, profit) == 30.0


def test_margin_is_zero_without_revenue():
    assert profitability.calculate_margin(0, -500) == 0


def test_raw_material_uses_059_kg_per_metre():
    assert costing.calculate_raw_material_cost(2000 * 0.59, 180) == 212400


def test_projected_margin_warns_below_target():
    low = order_readiness.calculate_projected_margin(100000, 90000)
    assert low["projectedMargin"] == 10.0
    assert "25%" in low["warning"]
    assert order_readiness.calculate_projected_margin(100000, 70000)["warning"] is None


# ---- seeded data ----

def test_readiness_shortage_for_2000m_navy_blue():
    r = order_readiness.check_readiness(request={
        "quantityMeters": 2000, "colour": "Navy Blue", "fabricType": "Cotton", "expectedRevenue": 356000,
    })
    assert r["requiredYarnKg"] == 1180
    assert r["availableKg"] == 950
    assert r["shortageKg"] == 230
    assert r["status"] == "CANNOT_START_FULL_PRODUCTION"
    assert r["projectedCost"] == pytest.approx(
        r["projectedMaterialCost"] + r["projectedLabourCost"] + r["projectedMachineCost"], abs=0.01)


def test_readiness_ready_when_stock_is_enough():
    r = order_readiness.check_readiness(request={
        "quantityMeters": 1000, "colour": "Navy Blue", "fabricType": "Cotton", "expectedRevenue": 100000,
    })
    assert r["status"] == "MATERIAL_READY"
    assert r["shortageKg"] == 0


def test_ord091_actual_margin_below_expected():
    leak = profitability.profit_leakage("ORD091")
    assert leak["actualMargin"] < leak["expectedMargin"]
    labels = {item["label"] for item in leak["leaks"]}
    assert {"Excess yarn consumption", "Overtime", "Rework"} <= labels
    assert all(item["amount"] > 0 for item in leak["leaks"])
    assert "W03" in leak["recommendation"]


def test_ord104_cost_adds_up_and_matches_stored_values():
    cost = costing.calculate_order_cost("ORD104")
    assert cost["totalCost"] == pytest.approx(sum(cost["costs"].values()), abs=0.01)
    assert cost["costs"]["rework"] == 0
    order = client.get("/api/orders/ORD104").json()
    assert order["costs"] == cost["costs"]
    earned = order["revenue"] * min(order["producedMeters"] / order["quantityMeters"], 1)
    assert order["profit"] == pytest.approx(earned - cost["totalCost"], abs=0.01)


def test_wages_summary_adds_up():
    w = client.get("/api/workers/wages/summary?month=2026-10").json()
    assert w["totalWorkforceCost"] == pytest.approx(w["totalRegularWages"] + w["totalOvertimePay"], abs=0.01)
    assert {row["orderId"] for row in w["labourCostPerOrder"]} >= {"ORD104", "ORD091"}


def test_logging_attendance_updates_order_labour():
    before = client.get("/api/orders/ORD104/cost").json()["costs"]["labour"]
    res = client.post("/api/attendance", json={
        "workerId": "EMP021", "orderId": "ORD104", "machineId": "W01",
        "hoursWorked": 8, "overtimeHours": 2, "date": "2026-10-11"})
    assert res.status_code == 201
    added = 8 * 90 + 2 * 90 * 1.5
    assert client.get("/api/orders/ORD104/cost").json()["costs"]["labour"] == pytest.approx(before + added, abs=0.01)
    assert client.get("/api/orders/ORD104").json()["costs"]["labour"] == pytest.approx(before + added, abs=0.01)


def test_new_order_gets_zero_costs_and_unknown_order_is_404():
    created = client.post("/api/orders", json={"buyerName": "T", "quantityMeters": 100, "revenue": 1000})
    assert created.status_code == 201
    assert created.json()["costs"]["labour"] == 0
    assert client.get("/api/orders/NOPE/cost").status_code == 404
    assert client.get("/api/finance/orders/NOPE").status_code == 404


def test_monthly_trend_has_four_months_with_data():
    trend = client.get("/api/finance/monthly").json()
    assert len(trend) == 4
    assert all(month["revenue"] > 0 for month in trend)


def test_workers_list_has_monthly_hours_and_wages():
    from app import database as dbm
    records = list(dbm.attendance().find({"workerId": "EMP021", "date": {"$regex": "^2026-10"}}))
    hours = sum(r["hoursWorked"] for r in records)
    overtime = sum(r["overtimeHours"] for r in records)
    assert hours > 0 and overtime > 0

    workers = client.get("/api/workers?month=2026-10").json()
    w = next(x for x in workers if x["workerId"] == "EMP021")
    assert w["hoursThisMonth"] == hours
    assert w["overtimeThisMonth"] == overtime
    assert w["wageThisMonth"] == pytest.approx(hours * 90 + overtime * 90 * 1.5, abs=0.01)
    assert w["latestAssignment"]["orderId"] == "ORD104"  # existing fields unchanged
    assert w["hourlyRate"] == 90

    # the per-worker wages add up to the wages summary
    summary = client.get("/api/workers/wages/summary?month=2026-10").json()
    assert sum(x["wageThisMonth"] for x in workers) == pytest.approx(summary["totalWorkforceCost"], abs=0.01)
    # a month without attendance gives zeros
    empty = client.get("/api/workers?month=2025-01").json()
    assert all(x["wageThisMonth"] == 0 and x["hoursThisMonth"] == 0 for x in empty)

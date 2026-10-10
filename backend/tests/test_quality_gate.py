"""Stage-gated quality control: the rules are enforced by the API, not by the screens."""
import os

import pytest
from fastapi.testclient import TestClient

from app import database as dbm, seed
from app.main import app
from app.services import costing, machine_simulator as sim, quality_gate

MACHINE = "W05"  # idle in the seed
FORBIDDEN = ("cost", "loss", "wage", "profit", "margin", "supplier", "inspector", "worker", "severity", "defect")


def login(role):
    c = TestClient(app)
    email = {"OWNER": "owner", "PRODUCTION_MANAGER": "manager", "WORKER_QC": "qc"}[role] + "@loomsense.demo"
    r = c.post("/api/auth/login", json={"email": email, "password": os.environ["SEED_" + role + "_PASSWORD"]})
    assert r.status_code == 200
    c.headers["Authorization"] = "Bearer " + r.json()["accessToken"]
    return c


@pytest.fixture(autouse=True)
def fresh():
    seed.main()
    sim.state.update(running=False, speed=1.0)


@pytest.fixture
def owner():
    return login("OWNER")


@pytest.fixture
def manager():
    return login("PRODUCTION_MANAGER")


@pytest.fixture
def qc():
    return login("WORKER_QC")


@pytest.fixture
def public():
    return TestClient(app)


# ---------- helpers that use the real API ----------

def new_order(manager, quantity=300):
    r = manager.post("/api/orders", json={"buyerName": "QC Test Buyer", "fabricType": "Cotton", "colour": "Navy Blue",
                                          "quantityMeters": quantity, "revenue": 60000, "yarnBatch": "YB82"})
    assert r.status_code == 201, r.text
    return r.json()["orderId"]


def start_machine(manager, order_id):
    r = manager.patch(f"/api/machines/{MACHINE}", json={"currentOrderId": order_id, "status": "RUNNING", "productionRate": 100})
    assert r.status_code == 200, r.text


def weave(manager, meters):
    r = manager.post(f"/api/machines/{MACHINE}/readings", json={"producedMetersDelta": meters})
    assert r.status_code == 200, r.text


def get_order(manager, order_id):
    return manager.get(f"/api/orders/{order_id}").json()


def inspect(client, order_id, **fields):
    return client.post("/api/quality", json={"orderId": order_id, **fields})


def failure(severity="HIGH", **extra):
    return {"status": "FAILED", "defectType": "Weft break", "defectSeverity": severity, "affectedMeters": 40, **extra}


def to_first_off(manager, quantity=300):
    """Order is weaving and has reached the sample length: waiting for the first-off inspection."""
    oid = new_order(manager, quantity)
    start_machine(manager, oid)
    weave(manager, 100)
    return oid


def to_weaving_qc(manager, qc, quantity=300):
    """First-off passed and the whole order woven: the weaving stage waits for its inspection."""
    oid = to_first_off(manager, quantity)
    assert inspect(qc, oid, inspectionType="FIRST_OFF", status="PASSED").status_code == 201
    weave(manager, quantity)
    return oid


def pass_stage(manager, qc, oid):
    """Pass the stage inspection for the current stage and move on."""
    assert inspect(qc, oid, status="PASSED").status_code == 201
    assert manager.post(f"/api/orders/{oid}/stage/advance").status_code == 200


def to_final_qc(manager, qc):
    oid = to_weaving_qc(manager, qc)
    pass_stage(manager, qc, oid)                      # weaving -> processing
    assert manager.post(f"/api/orders/{oid}/stage/complete").status_code == 200
    pass_stage(manager, qc, oid)                      # processing -> finishing
    assert manager.post(f"/api/orders/{oid}/stage/complete").status_code == 200
    pass_stage(manager, qc, oid)                      # finishing -> final QC
    assert get_order(manager, oid)["currentStage"] == "FINAL_QC"
    return oid


def hold_at_weaving(manager, qc, severity="HIGH", **extra):
    oid = to_weaving_qc(manager, qc)
    res = inspect(qc, oid, **failure(severity, **extra))
    assert res.status_code == 201, res.text
    return oid, res.json()


# ---------- rule 1: a stage advances only after its inspection passed ----------

def test_stage_cannot_advance_without_a_passed_inspection(manager, qc):
    oid = new_order(manager)
    assert get_order(manager, oid)["currentStage"] == "RAW_MATERIAL"
    assert manager.post(f"/api/orders/{oid}/stage/complete").status_code == 200   # raw material needs no inspection
    assert manager.post(f"/api/orders/{oid}/stage/advance").json()["currentStage"] == "WEAVING"

    early = manager.post(f"/api/orders/{oid}/stage/advance")
    assert early.status_code == 409 and "until WEAVING QC passes" in early.json()["detail"]

    oid = to_weaving_qc(manager, qc)
    order = get_order(manager, oid)
    assert order["stageStatus"] == "QC_PENDING" and order["pendingInspectionType"] == "STAGE"
    blocked = manager.post(f"/api/orders/{oid}/stage/advance")
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "Order cannot advance to PROCESSING until WEAVING QC passes."

    assert inspect(qc, oid, status="PASSED").status_code == 201
    moved = manager.post(f"/api/orders/{oid}/stage/advance")
    assert moved.status_code == 200 and moved.json()["currentStage"] == "PROCESSING"
    assert moved.json()["status"] == "DYEING"      # the old order status words still follow the stage


def test_weaving_cannot_be_completed_before_first_off_or_before_it_is_woven(manager, qc):
    oid = new_order(manager)
    start_machine(manager, oid)
    weave(manager, 50)
    assert manager.post(f"/api/orders/{oid}/stage/complete").status_code == 409
    weave(manager, 60)   # reaches the sample length
    assert manager.post(f"/api/orders/{oid}/stage/complete").status_code == 409
    assert inspect(qc, oid, inspectionType="FIRST_OFF", status="PASSED").status_code == 201
    too_early = manager.post(f"/api/orders/{oid}/stage/complete")
    assert too_early.status_code == 409 and "not finished" in too_early.json()["detail"]


def test_status_cannot_be_patched_around_the_gate(manager):
    oid = new_order(manager)
    res = manager.patch(f"/api/orders/{oid}", json={"status": "DISPATCHED"})
    assert res.status_code == 409
    assert get_order(manager, oid)["status"] == "NEW"


# ---------- rule 2: first-off ----------

def test_first_off_pauses_production_until_it_passes(manager, qc):
    oid = to_first_off(manager)
    order = get_order(manager, oid)
    assert order["producedMeters"] == 100 and order["stageStatus"] == "QC_PENDING"
    assert order["pendingInspectionType"] == "FIRST_OFF" and order["productionBlocked"] is True
    assert "first-off" in order["productionBlockReason"].lower()

    weave(manager, 80)                      # a reading while waiting adds nothing
    sim.state["running"] = True
    sim.tick()
    assert get_order(manager, oid)["producedMeters"] == 100

    assert inspect(qc, oid, inspectionType="FIRST_OFF", status="PASSED").status_code == 201
    order = get_order(manager, oid)
    assert order["stageStatus"] == "IN_PROGRESS" and order["productionBlocked"] is False
    weave(manager, 50)
    assert get_order(manager, oid)["producedMeters"] == 150


def test_first_off_failure_holds_the_order(manager, qc):
    oid = to_first_off(manager)
    res = inspect(qc, oid, inspectionType="FIRST_OFF", **failure("MEDIUM"))
    assert res.status_code == 201
    order = get_order(manager, oid)
    hold = order["qualityHold"]
    assert order["stageStatus"] == "QUALITY_HOLD" and order["productionBlocked"] is True
    assert hold["failedInspectionId"] == res.json()["inspectionId"] and hold["failedStage"] == "WEAVING"
    assert hold["affectedMeters"] == 40 and hold["holdStartedAt"]
    weave(manager, 50)
    assert get_order(manager, oid)["producedMeters"] == 100     # production stays paused
    # machine data and history are untouched
    machine = manager.get(f"/api/machines/{MACHINE}").json()
    assert machine["currentOrderId"] == oid and machine["producedMeters"] == 100


def test_simulator_leaves_waiting_and_held_orders_alone(manager, qc):
    oid = to_weaving_qc(manager, qc)               # weaving finished: QC_PENDING
    start_machine(manager, oid)
    sim.state["running"] = True
    before = get_order(manager, oid)["producedMeters"]
    sim.tick()
    order = get_order(manager, oid)
    assert order["producedMeters"] == before and order["stageStatus"] == "QC_PENDING"
    assert order["currentStage"] == "WEAVING"      # it did not move on by itself


def test_simulator_sets_qc_pending_when_weaving_finishes(manager, qc):
    oid = to_first_off(manager, quantity=150)
    assert inspect(qc, oid, inspectionType="FIRST_OFF", status="PASSED").status_code == 201
    sim.state["running"] = True
    for _ in range(40):
        sim.tick()
        if get_order(manager, oid)["stageStatus"] == "QC_PENDING":
            break
    order = get_order(manager, oid)
    assert order["producedMeters"] == 150 and order["stageStatus"] == "QC_PENDING"
    assert order["status"] != "QUALITY_CHECK" and order["currentStage"] == "WEAVING"


# ---------- rules 3 to 5: hold, corrective action, reinspection ----------

def test_failed_stage_inspection_blocks_the_next_stage(manager, qc):
    oid, _ = hold_at_weaving(manager, qc)
    assert get_order(manager, oid)["stageStatus"] == "QUALITY_HOLD"
    advance = manager.post(f"/api/orders/{oid}/stage/advance")
    assert advance.status_code == 409 and "quality hold" in advance.json()["detail"]
    assert manager.post(f"/api/orders/{oid}/stage/complete").status_code == 409
    again = inspect(qc, oid, status="PASSED")      # a normal pass cannot lift a hold
    assert again.status_code == 409
    assert get_order(manager, oid)["currentStage"] == "WEAVING"


def test_passed_reinspection_releases_the_hold_and_keeps_the_failed_record(manager, qc, owner):
    oid, failed = hold_at_weaving(manager, qc, severity="HIGH")
    fid = failed["inspectionId"]

    early = inspect(qc, oid, inspectionType="REINSPECTION", reinspectionOf=fid, status="PASSED")
    assert early.status_code == 409                 # corrective action first
    assert qc.post("/api/quality", json={"orderId": oid, "inspectionType": "REINSPECTION", "status": "PASSED"}).status_code == 422

    action = qc.patch(f"/api/quality/{fid}/corrective-action", json={"correctiveAction": "REWORK_CURRENT_STAGE"})
    assert action.status_code == 200
    original = next(i for s in owner.get(f"/api/quality/order/{oid}/timeline").json()["stages"] for i in s["inspections"]
                    if i["inspectionId"] == fid)

    res = inspect(qc, oid, inspectionType="REINSPECTION", reinspectionOf=fid, status="PASSED")
    assert res.status_code == 201 and res.json()["reinspectionOf"] == fid
    order = get_order(manager, oid)
    assert order["qualityHold"] is None and order["productionBlocked"] is False
    assert order["stageStatus"] == "COMPLETE"
    assert manager.post(f"/api/orders/{oid}/stage/advance").json()["currentStage"] == "PROCESSING"

    after = next(i for s in owner.get(f"/api/quality/order/{oid}/timeline").json()["stages"] for i in s["inspections"]
                 if i["inspectionId"] == fid)
    assert after["reinspectedBy"] == [res.json()["inspectionId"]]
    keep = {k: v for k, v in original.items() if k != "reinspectedBy"}
    assert {k: after[k] for k in keep} == keep      # the failed record is exactly as it was
    assert after["status"] == "FAILED"


def test_failed_reinspection_keeps_the_hold(manager, qc):
    oid, failed = hold_at_weaving(manager, qc)
    fid = failed["inspectionId"]
    qc.patch(f"/api/quality/{fid}/corrective-action", json={"correctiveAction": "REWORK_CURRENT_STAGE"})
    second = inspect(qc, oid, inspectionType="REINSPECTION", reinspectionOf=fid, **failure("HIGH"))
    assert second.status_code == 201
    hold = get_order(manager, oid)["qualityHold"]
    assert hold["failedInspectionId"] == second.json()["inspectionId"]    # the new failure is the open one
    assert qc.patch(f"/api/quality/{fid}/corrective-action", json={"correctiveAction": "NONE"}).status_code == 409


def test_restart_from_checkpoint_rewinds_only_the_affected_metres(manager, qc):
    oid, failed = hold_at_weaving(manager, qc, affectedMeters=60)
    fid = failed["inspectionId"]
    qc.patch(f"/api/quality/{fid}/corrective-action", json={"correctiveAction": "RESTART_FROM_CHECKPOINT"})
    inspect(qc, oid, inspectionType="REINSPECTION", reinspectionOf=fid, status="PASSED")
    order = get_order(manager, oid)
    assert order["currentStage"] == "WEAVING" and order["stageStatus"] == "IN_PROGRESS"
    assert order["producedMeters"] == 240           # 300 - 60: not a full restart
    assert order["firstOffPassed"] is True


def test_full_restart_only_for_critical_severity(manager, qc):
    oid, failed = hold_at_weaving(manager, qc, severity="HIGH")
    refused = qc.patch(f"/api/quality/{failed['inspectionId']}/corrective-action", json={"correctiveAction": "FULL_RESTART"})
    assert refused.status_code == 422 and "CRITICAL" in refused.json()["detail"]
    assert qc.post("/api/quality", json={"orderId": oid, "inspectionType": "REINSPECTION", "status": "PASSED",
                                          "reinspectionOf": failed["inspectionId"]}).status_code == 409

    other = new_order(manager)
    start_machine(manager, other)
    weave(manager, 100)
    inspect(qc, other, inspectionType="FIRST_OFF", status="PASSED")
    weave(manager, 300)
    critical = inspect(qc, other, **failure("CRITICAL", defectType="Burn mark"))
    ok = qc.patch(f"/api/quality/{critical.json()['inspectionId']}/corrective-action", json={"correctiveAction": "FULL_RESTART"})
    assert ok.status_code == 200
    inspect(qc, other, inspectionType="REINSPECTION", reinspectionOf=critical.json()["inspectionId"], status="PASSED")
    order = get_order(manager, other)
    assert order["currentStage"] == "WEAVING" and order["producedMeters"] == 0 and order["firstOffPassed"] is False


# ---------- cost: one source for the rework part of the true cost ----------

def test_quality_loss_is_counted_once_in_cost_and_profit(manager, qc, owner):
    oid = to_weaving_qc(manager, qc)
    before = owner.get(f"/api/orders/{oid}").json()
    res = inspect(owner, oid, **failure("HIGH", reworkCost=1000, additionalLabourCost=500, additionalMachineCost=300, scrapMaterialCost=200))
    assert res.status_code == 201
    after = owner.get(f"/api/orders/{oid}").json()
    assert after["costs"]["rework"] == before["costs"]["rework"] + 2000
    assert round(before["profit"] - after["profit"], 2) == 2000
    assert owner.get(f"/api/orders/{oid}/cost").json()["costs"]["rework"] == after["costs"]["rework"]
    assert res.json()["marginAfter"] < res.json()["marginBefore"]

    fid = res.json()["inspectionId"]    # entering the real figures later replaces, never adds to, what was there
    qc.patch(f"/api/quality/{fid}/corrective-action", json={"correctiveAction": "SCRAP_AFFECTED_QUANTITY", "scrapMaterialCost": 700})
    assert owner.get(f"/api/orders/{oid}").json()["costs"]["rework"] == before["costs"]["rework"] + 2500
    record = next(i for s in owner.get(f"/api/quality/order/{oid}/timeline").json()["stages"] for i in s["inspections"] if i["inspectionId"] == fid)
    assert costing.quality_loss(record) == 2500 and record["impact"]["total"] == 2500
    inspect(qc, oid, inspectionType="REINSPECTION", reinspectionOf=fid, status="PASSED")
    assert owner.get(f"/api/orders/{oid}").json()["costs"]["rework"] == before["costs"]["rework"] + 2500   # a pass adds no cost


def test_costs_are_estimated_when_none_are_entered(manager, qc, owner):
    oid = to_weaving_qc(manager, qc)
    before = owner.get(f"/api/orders/{oid}").json()["costs"]["rework"]
    res = inspect(owner, oid, **failure("MEDIUM", affectedMeters=100))
    after = owner.get(f"/api/orders/{oid}").json()["costs"]["rework"]
    assert after > before and after - before == res.json()["impact"]["total"]


def test_old_rolls_keep_their_cost_and_are_not_double_counted():
    rolls = [r for r in dbm.quality_checks().find({"orderId": "ORD091"})]
    assert all(not r.get("inspectionType") for r in rolls)
    assert costing.calculate_order_cost("ORD091")["costs"]["rework"] == 8000     # 4180 + 3820, as before


def test_profit_leakage_lists_quality_entries_without_double_counting(manager, qc, owner):
    oid, failed = hold_at_weaving(manager, qc, reworkCost=1000, additionalLabourCost=500, additionalMachineCost=300, scrapMaterialCost=200)
    qc.patch(f"/api/quality/{failed['inspectionId']}/corrective-action", json={"correctiveAction": "REWORK_CURRENT_STAGE"})
    second = inspect(qc, oid, inspectionType="REINSPECTION", reinspectionOf=failed["inspectionId"], **failure("HIGH", reworkCost=400))
    assert second.status_code == 201
    leak = owner.get("/api/finance/profit-leakage", params={"order_id": oid}).json()
    quality = [l for l in leak["leaks"] if l.get("type") == "QUALITY_FAILURE"]
    assert quality and all({"stage", "orderId", "amount", "message"} <= set(l) for l in quality)
    assert {l["component"] for l in quality} >= {"STAGE_FAILURE", "REWORK", "EXTRA_LABOUR", "EXTRA_MACHINE", "SCRAP", "REPEATED_FAILURE"}
    assert all(l["stage"] == "WEAVING" and l["orderId"] == oid for l in quality)
    assert not any(l["label"] == "Rework" for l in leak["leaks"])             # replaced by the quality lines
    assert round(sum(l["amount"] for l in quality), 2) == owner.get(f"/api/orders/{oid}").json()["costs"]["rework"] == 2400


# ---------- roles ----------

def test_roles(manager, qc, owner):
    for client in (qc, manager):
        assert client.get("/api/finance/dashboard").status_code == 403
        assert client.get("/api/finance/profit-leakage").status_code == 403
        assert client.get("/api/quality/analytics").status_code == 403
    assert qc.get("/api/orders").status_code == 403                  # QC works from the pending list, not the order list
    assert qc.get("/api/quality/pending").status_code == 200 and qc.get("/api/quality/holds").status_code == 200
    assert manager.get("/api/quality/holds").status_code == 200
    assert owner.get("/api/quality/analytics").status_code == 200

    oid = to_weaving_qc(manager, qc)
    assert manager.post(f"/api/orders/{oid}/stage/advance").status_code == 409
    assert qc.post(f"/api/orders/{oid}/stage/complete").status_code == 403    # production control is not a QC job
    failed = inspect(qc, oid, **failure("HIGH", reworkCost=900)).json()
    assert "reworkCost" not in failed and "impact" not in failed              # costs are for the owner only
    assert manager.patch(f"/api/quality/{failed['inspectionId']}/corrective-action",
                         json={"correctiveAction": "REWORK_CURRENT_STAGE"}).status_code == 200
    timeline = qc.get(f"/api/quality/order/{oid}/timeline").json()
    assert not any("Cost" in k or k == "impact" for s in timeline["stages"] for i in s["inspections"] for k in i)


def test_old_orders_still_accept_old_style_rolls_but_gated_orders_do_not(manager, qc):
    assert qc.post("/api/quality", json={"orderId": "ORD104", "status": "PASSED"}).status_code == 201
    oid = new_order(manager)
    # a gated order takes stage inspections: with no stage given it is for the order's own stage
    checked = qc.post("/api/quality", json={"orderId": oid, "status": "PASSED"})
    assert checked.status_code == 201 and checked.json()["stage"] == "RAW_MATERIAL"
    assert checked.json()["inspectionType"] == "INCOMING_MATERIAL"
    wrong = qc.post("/api/quality", json={"orderId": oid, "status": "PASSED", "stage": "PROCESSING"})
    assert wrong.status_code == 409


# ---------- lists, timeline, analytics ----------

def test_pending_holds_and_timeline(manager, qc, owner):
    oid = to_first_off(manager)
    pending = qc.get("/api/quality/pending").json()
    row = next(p for p in pending if p["orderId"] == oid)
    assert row["stage"] == "WEAVING" and row["inspectionType"] == "FIRST_OFF" and row["sampleMeters"] == 100
    assert row["machineId"] == MACHINE

    failed = inspect(qc, oid, inspectionType="FIRST_OFF", **failure("LOW")).json()
    assert oid not in [p["orderId"] for p in qc.get("/api/quality/pending").json()]
    hold = next(h for h in qc.get("/api/quality/holds").json() if h["orderId"] == oid)
    assert hold["failedStage"] == "WEAVING" and hold["defectType"] == "Weft break" and hold["defectSeverity"] == "LOW"
    assert hold["affectedMeters"] == 40 and hold["needsCorrectiveAction"] is True

    qc.patch(f"/api/quality/{failed['inspectionId']}/corrective-action", json={"correctiveAction": "REWORK_CURRENT_STAGE"})
    inspect(qc, oid, inspectionType="REINSPECTION", reinspectionOf=failed["inspectionId"], status="PASSED")
    timeline = qc.get(f"/api/quality/order/{oid}/timeline").json()
    assert [s["stage"] for s in timeline["stages"]] == ["RAW_MATERIAL", "WEAVING", "PROCESSING", "FINISHING", "FINAL_QC", "DISPATCH"]
    weaving = next(s for s in timeline["stages"] if s["stage"] == "WEAVING")
    assert [i["inspectionType"] for i in weaving["inspections"]] == ["FIRST_OFF", "REINSPECTION"]
    assert weaving["inspections"][0]["reinspectedBy"] == [weaving["inspections"][1]["inspectionId"]]
    assert weaving["inspections"][1]["reinspectionOf"] == failed["inspectionId"]


def test_old_records_still_show_as_final_qc(owner, manager):
    timeline = owner.get("/api/quality/order/ORD104/timeline").json()
    final = next(s for s in timeline["stages"] if s["stage"] == "FINAL_QC")
    assert len(final["inspections"]) == 2 and all(i["legacy"] for i in final["inspections"])
    assert timeline["gated"] is False
    assert manager.get("/api/orders/ORD104").json()["gated"] is False
    assert len(owner.get("/api/quality").json()) >= 7


def test_old_records_get_an_inspection_id():
    dbm.quality_checks().drop_index("inspectionId_1")      # a database from before the index existed
    dbm.quality_checks().update_many({}, {"$unset": {"inspectionId": ""}})
    assert quality_gate.backfill_inspection_fields() >= 7
    quality_gate.ensure_indexes()
    ids = [r["inspectionId"] for r in dbm.quality_checks().find({})]
    assert all(ids) and len(ids) == len(set(ids))
    assert {"inspectionId_1", "orderId_1", "stage_1", "status_1", "machineId_1", "inspectionDate_1"} <= set(dbm.quality_checks().index_information())


def test_analytics(manager, qc, owner):
    oid, failed = hold_at_weaving(manager, qc, severity="HIGH", reworkCost=1000, additionalLabourCost=500)
    month = failed["inspectionDate"][:7]
    stats = owner.get("/api/quality/analytics", params={"month": month}).json()
    assert stats["totalInspections"] >= 3
    assert round(stats["passRate"] + stats["failureRate"] + stats["reworkRate"], 1) <= 100.0
    assert stats["totalQualityLoss"] >= 1500 and stats["mostCommonDefect"]
    assert stats["highestLossStage"] and stats["machineWithMostFailures"]
    assert oid in stats["holdOrderIds"] and stats["ordersOnQualityHold"] >= 1
    assert owner.get("/api/quality/analytics", params={"month": "nope"}).status_code == 422


# ---------- public views ----------

def test_buyer_tracking_shows_only_safe_wording(manager, qc, public):
    oid, failed = hold_at_weaving(manager, qc, severity="CRITICAL", reworkCost=800, additionalLabourCost=500, defectType="Weft break")
    token = get_order(manager, oid)["trackingToken"]
    held = public.get("/api/buyer/track/" + token)
    assert held.status_code == 200
    body = held.json()
    assert body["qualityMessage"] == "Rework verification" and body["qualityStatus"] == "IN_REVIEW"
    text = held.text.lower()
    assert not any(word in text for word in ("weft", "critical", "800", "qc@", "hold", "scrap", "inspector"))
    assert not any(any(w in key.lower() for w in FORBIDDEN) for key in body if key not in ("qualityStatus", "qualityMessage"))
    assert body["currentStage"] == "Weaving"

    qc.patch(f"/api/quality/{failed['inspectionId']}/corrective-action", json={"correctiveAction": "REWORK_CURRENT_STAGE"})
    inspect(qc, oid, inspectionType="REINSPECTION", reinspectionOf=failed["inspectionId"], status="PASSED")
    manager.post(f"/api/orders/{oid}/stage/advance")
    assert public.get("/api/buyer/track/" + token).json()["currentStage"] == "Dyeing"


def test_buyer_sees_quality_verification_while_a_stage_waits_for_its_inspection(manager, qc, public):
    oid = to_weaving_qc(manager, qc)
    body = public.get("/api/buyer/track/" + get_order(manager, oid)["trackingToken"]).json()
    assert body["qualityMessage"] == "Quality verification in progress" and body["qualityStatus"] == "PENDING"


def test_passport_is_not_final_before_a_passed_final_inspection(manager, qc, public):
    oid = to_final_qc(manager, qc)
    assert get_order(manager, oid)["pendingInspectionType"] == "FINAL"
    failed = inspect(qc, oid, **failure("MEDIUM", defectType="Shade variation")).json()
    roll = failed["rollId"]
    assert roll and failed["inspectionType"] == "FINAL" and failed["stage"] == "FINAL_QC"

    passport = public.get(f"/api/passport/{roll}").json()
    assert passport["final"] is False and passport["qualityStatus"] == "PENDING" and passport["defects"] == []
    assert not any(any(w in key.lower() for w in ("cost", "profit", "margin", "wage", "loss")) for key in passport)

    qc.patch(f"/api/quality/{failed['inspectionId']}/corrective-action", json={"correctiveAction": "REWORK_CURRENT_STAGE"})
    still = public.get(f"/api/passport/{roll}").json()
    assert still["final"] is False
    assert inspect(qc, oid, inspectionType="REINSPECTION", reinspectionOf=failed["inspectionId"], status="PASSED").status_code == 201
    done = public.get(f"/api/passport/{roll}").json()
    assert done["final"] is True and done["qualityStatus"] == "PASSED"
    assert manager.post(f"/api/orders/{oid}/stage/advance").json()["currentStage"] == "DISPATCH"
    assert public.get("/api/buyer/track/" + get_order(manager, oid)["trackingToken"]).json()["qualityMessage"] == "Quality approved"


def test_old_passports_are_still_final(public):
    passport = public.get("/api/passport/RL10092").json()
    assert passport["final"] is True and passport["qualityStatus"] == "PASSED"


# ---------- the seeded demo orders ----------

def test_seeded_demo_orders(owner):
    orders = {o["orderId"]: o for o in owner.get("/api/orders").json()}
    a, b, c = orders["ORD109"], orders["ORD110"], orders["ORD111"]
    assert a["currentStage"] == "PROCESSING" and a["qualityHold"] is None
    assert b["currentStage"] == "PROCESSING" and b["qualityHold"] is None and b["costs"]["rework"] == 12700
    assert c["stageStatus"] == "QUALITY_HOLD" and c["qualityHold"]["defectSeverity"] == "CRITICAL" and c["costs"]["rework"] == 26900
    assert a["costs"]["rework"] == 0
    assert a["margin"] > b["margin"] > c["margin"] and c["margin"] < 15
    holds = [h["orderId"] for h in owner.get("/api/quality/holds").json()]
    assert holds == ["ORD111"]

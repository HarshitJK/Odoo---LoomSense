"""Pause, resume, change machine and cancel: rules, history, QC safety, reports and roles. Uses the real API."""
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app import database as dbm
from app.services import machine_sessions, machine_simulator as sim, production_control
from tests.test_quality_gate import (  # noqa: F401  (fixtures are used by name)
    fresh, get_order, inspect, login, manager, new_order, owner, public, qc,
)

A, B = "W05", "W03"  # W05 is idle in the seed; W03 is idle and its old order is finished


def assign(client, oid, machine=A):
    r = client.patch(f"/api/machines/{machine}", json={"currentOrderId": oid, "status": "RUNNING", "productionRate": 100})
    assert r.status_code == 200, r.text


def weave(client, machine, meters):
    r = client.post(f"/api/machines/{machine}/readings", json={"producedMetersDelta": meters})
    assert r.status_code == 200, r.text


def pause(client, oid, reason="MACHINE_BREAKDOWN", notes="loom jammed"):
    return client.post(f"/api/orders/{oid}/pause", json={"reason": reason, "notes": notes})


def running_order(manager, meters=40, quantity=300):
    oid = new_order(manager, quantity)
    assign(manager, oid)
    weave(manager, A, meters)
    return oid


def machine(name):
    return dbm.machines().find_one({"machineId": name}, {"_id": 0})


def month_rows(owner):
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    report = owner.get(f"/api/finance/month-end?month={month}").json()
    return report, {m["machineId"]: m for m in report["machineProduction"]}


def events(oid):
    return list(dbm.db.machineProductionEvents.find({"orderId": oid}, {"_id": 0}))


# ---------- backfill ----------

def test_running_machines_have_one_active_session_after_seed():
    active = {s["machineId"]: s["orderId"] for s in dbm.db.machineAssignments.find({"status": "ACTIVE"})}
    assert active == {"W01": "ORD104", "W02": "ORD108", "W04": "ORD108"}
    assert machine_sessions.backfill() == 0  # idempotent


# ---------- pause and resume ----------

def test_pause_then_resume_keeps_both_sessions(manager):
    oid = running_order(manager)
    r = pause(manager, oid)
    assert r.status_code == 200 and r.json()["stageStatus"] == "PAUSED"
    order = get_order(manager, oid)
    assert order["pauseReason"] == "MACHINE_BREAKDOWN" and order["pausedBy"] == "manager@loomsense.demo" and order["pausedAt"]
    assert machine(A)["status"] == "IDLE"

    weave(manager, A, 25)  # a paused order takes no metres, run time or machine cost
    assert get_order(manager, oid)["producedMeters"] == 40
    assert sum(e["producedMetersDelta"] for e in events(oid)) == 40

    r = manager.post(f"/api/orders/{oid}/resume", json={})
    assert r.status_code == 200 and r.json()["stageStatus"] == "IN_PROGRESS"
    assert machine(A)["status"] == "RUNNING"
    weave(manager, A, 20)
    history = manager.get(f"/api/orders/{oid}/machine-history").json()
    assert [(s["machineId"], s["status"], s["metresProduced"]) for s in history] == [(A, "ENDED", 40), (A, "ACTIVE", 20)]
    assert history[0]["endReason"] == "MACHINE_BREAKDOWN" and history[0]["endedBy"] == "manager@loomsense.demo"
    assert history[1]["endedAt"] is None and history[0]["sessionId"] != history[1]["sessionId"]


def test_pause_resume_rules_and_messages(manager):
    oid = running_order(manager)
    assert manager.post(f"/api/orders/{oid}/resume", json={}).json()["detail"] == "Only a paused order can be resumed."
    assert pause(manager, oid).status_code == 200
    again = pause(manager, oid)
    assert again.status_code == 409 and again.json()["detail"] == "Order is already paused."
    done = manager.post(f"/api/orders/{oid}/stage/advance")
    assert done.status_code == 409 and done.json()["detail"] == "Cannot advance while production is paused."
    assert manager.post(f"/api/orders/{oid}/stage/complete").status_code == 409
    bad = manager.post(f"/api/orders/{oid}/pause", json={"reason": "BECAUSE"})
    assert bad.status_code == 422


def test_only_in_progress_orders_can_be_paused(manager, qc):
    oid = new_order(manager)
    assert manager.post(f"/api/orders/{oid}/stage/complete").status_code == 200  # raw material needs no QC
    assert manager.post(f"/api/orders/{oid}/stage/advance").status_code == 200
    assert pause(manager, oid).status_code == 200  # weaving, in progress, nothing running yet
    assert manager.post(f"/api/orders/{oid}/resume", json={}).status_code == 200
    complete = manager.post("/api/orders", json={"buyerName": "X", "fabricType": "Cotton", "colour": "Navy Blue",
                                                 "quantityMeters": 100, "revenue": 1000, "yarnBatch": "YB82"}).json()["orderId"]
    dbm.orders().update_one({"orderId": complete}, {"$set": {"stageStatus": "COMPLETE"}})
    r = pause(manager, complete)
    assert r.status_code == 409 and r.json()["detail"] == "Only an in-progress order can be paused."


# ---------- change machine ----------

def test_pause_change_machine_resume_keeps_both_sessions_and_splits_reports(manager):
    _, base = month_rows(owner_client())
    oid = running_order(manager, 40)
    assert pause(manager, oid).status_code == 200
    r = manager.post(f"/api/orders/{oid}/change-machine", json={"newMachineId": B, "reason": "MACHINE_BREAKDOWN", "notes": "W05 loom"})
    assert r.status_code == 200 and r.json()["machineId"] == B
    assert machine(A)["currentOrderId"] is None and machine(B)["currentOrderId"] == oid
    assert manager.post(f"/api/orders/{oid}/resume", json={}).status_code == 200
    weave(manager, B, 60 - 10)  # stay under the 100 m first-off sample

    history = manager.get(f"/api/orders/{oid}/machine-history").json()
    assert [(s["machineId"], s["status"], s["metresProduced"]) for s in history] == [(A, "ENDED", 40), (B, "ACTIVE", 50)]

    _, rows = month_rows(owner_client())  # 40 m on the first machine, 50 m on the second, not all on the last one
    assert rows[A]["producedMeters"] - base[A]["producedMeters"] == 40
    assert rows[B]["producedMeters"] - base[B]["producedMeters"] == 50
    assert oid in rows[A]["ordersWorked"] and oid in rows[B]["ordersWorked"]
    cost = owner_client().get(f"/api/orders/{oid}/cost").json()
    assert cost["costs"]["machine"] > 0


def owner_client():
    return login("OWNER")


def test_change_machine_rules(manager):
    oid = running_order(manager)
    early = manager.post(f"/api/orders/{oid}/change-machine", json={"newMachineId": B, "reason": "MANUAL"})
    assert early.status_code == 409 and early.json()["detail"] == "Order must be paused before changing machine"
    assert pause(manager, oid).status_code == 200

    def move(machine_id):
        return manager.post(f"/api/orders/{oid}/change-machine", json={"newMachineId": machine_id, "reason": "MANUAL"})

    assert move("W99").status_code == 404
    assert move(A).status_code == 409                       # same machine
    down = move("W06")
    assert down.status_code == 409 and "down" in down.json()["detail"]
    taken = move("W01")                                     # running ORD104
    assert taken.status_code == 409 and taken.json()["detail"] == "Selected machine is already assigned to another active production job."
    dbm.machines().update_one({"machineId": B}, {"$set": {"status": "MAINTENANCE"}})
    assert "maintenance" in move(B).json()["detail"]
    dbm.machines().update_one({"machineId": B}, {"$set": {"status": "IDLE"}})
    assert move(B).status_code == 200
    names = [m["machineId"] for m in manager.get(f"/api/orders/{oid}/available-machines").json()]
    assert not {"W01", "W02", "W04", "W06"} & set(names) and {A, B} <= set(names)


def test_resume_on_a_different_machine_is_a_reassignment(manager):
    oid = running_order(manager)
    pause(manager, oid)
    r = manager.post(f"/api/orders/{oid}/resume", json={"machineId": B})
    assert r.status_code == 200 and r.json()["machineId"] == B
    history = manager.get(f"/api/orders/{oid}/machine-history").json()
    assert [s["machineId"] for s in history] == [A, B]
    events_ = [a["event"] for a in manager.get(f"/api/orders/{oid}/audit").json()]
    assert events_ == ["ORDER_PAUSED", "MACHINE_CHANGED", "ORDER_RESUMED"]


def test_resume_refuses_a_machine_that_broke_down(manager):
    oid = running_order(manager)
    pause(manager, oid)
    dbm.machines().update_one({"machineId": A}, {"$set": {"status": "DOWN"}})
    r = manager.post(f"/api/orders/{oid}/resume", json={})
    assert r.status_code == 409 and get_order(manager, oid)["stageStatus"] == "PAUSED"


def test_machine_cannot_be_given_to_two_orders(manager):
    first, second = running_order(manager), new_order(manager)
    assert pause(manager, first).status_code == 200
    # a direct assignment moves the machine to the second order; resuming the first order must then be refused
    assert manager.patch(f"/api/machines/{A}", json={"currentOrderId": second}).status_code == 200
    r = manager.post(f"/api/orders/{first}/resume", json={})
    assert r.status_code == 409 and r.json()["detail"].startswith("Selected machine is already assigned")


# ---------- cancel ----------

def cancelled_order(manager, owner):
    oid = running_order(manager, 40)
    w = manager.post("/api/attendance", json={"workerId": "EMP021", "orderId": oid, "machineId": A, "hoursWorked": 8})
    assert w.status_code == 201, w.text
    r = owner.post(f"/api/orders/{oid}/cancel", json={"reason": "BUYER_CANCELLED", "notes": "buyer withdrew"})
    assert r.status_code == 200, r.text
    return oid


def test_cancel_stops_everything_but_keeps_history_and_costs(manager, owner):
    oid = running_order(manager, 40)
    manager.post("/api/attendance", json={"workerId": "EMP021", "orderId": oid, "machineId": A, "hoursWorked": 8})
    before = owner.get(f"/api/orders/{oid}/cost").json()
    assert before["costs"]["rawMaterial"] > 0 and before["costs"]["labour"] > 0 and before["costs"]["machine"] > 0
    consumed = list(dbm.db.materialConsumption.find({"orderId": oid}, {"_id": 0}))

    r = owner.post(f"/api/orders/{oid}/cancel", json={"reason": "BUYER_CANCELLED", "notes": "buyer withdrew"})
    assert r.status_code == 200 and r.json()["status"] == "CANCELLED"
    order = get_order(owner, oid)
    assert order["cancelledBy"] == "owner@loomsense.demo" and order["cancelledAt"] and order["cancelReason"] == "BUYER_CANCELLED"
    assert order["cancelNotes"] == "buyer withdrew" and order["cancelledAtStage"] == "WEAVING"
    assert machine(A)["status"] == "IDLE" and machine(A)["currentOrderId"] is None

    # nothing more can be produced, advanced, inspected, consumed, staffed, assigned or dispatched
    weave(manager, A, 30)
    assert get_order(owner, oid)["producedMeters"] == 40
    blocked = [
        manager.post(f"/api/orders/{oid}/stage/advance"), manager.post(f"/api/orders/{oid}/stage/complete"),
        inspect(login("WORKER_QC"), oid, inspectionType="FIRST_OFF", status="PASSED"),
        manager.post("/api/attendance", json={"workerId": "EMP021", "orderId": oid, "hoursWorked": 8}),
        manager.patch(f"/api/machines/{B}", json={"currentOrderId": oid}),
        manager.post(f"/api/orders/{oid}/reserve", json={"batchId": "YB82", "quantityKg": 10}),
        manager.patch(f"/api/orders/{oid}", json={"status": "DISPATCHED"}),
        manager.post(f"/api/orders/{oid}/resume", json={}), pause(manager, oid),
        manager.post(f"/api/orders/{oid}/change-machine", json={"newMachineId": B, "reason": "MANUAL"}),
        owner.post(f"/api/orders/{oid}/cancel", json={"reason": "OTHER"}),
    ]
    assert [r.status_code for r in blocked] == [409] * len(blocked)
    assert blocked[0].json()["detail"] == "Order is already cancelled."
    assert blocked[-1].json()["detail"] == "Order is already cancelled."
    assert manager.post(f"/api/orders/{oid}/resume", json={}).json()["detail"] == "Cannot resume a cancelled order."
    sim.state["running"] = True
    sim.tick()
    sim.state["running"] = False
    assert get_order(owner, oid)["producedMeters"] == 40
    assert machine(A)["status"] == "IDLE"

    # history and costs are intact
    assert list(dbm.db.materialConsumption.find({"orderId": oid}, {"_id": 0})) == consumed
    assert sum(e["producedMetersDelta"] for e in events(oid)) == 40
    after = owner.get(f"/api/orders/{oid}/cost").json()
    assert after["costs"] == before["costs"]
    history = manager.get(f"/api/orders/{oid}/machine-history").json()
    assert [(s["status"], s["metresProduced"], s["endReason"]) for s in history] == [("ENDED", 40, "BUYER_CANCELLED")]


def test_cancelled_order_is_a_separate_loss_not_completed_revenue(manager, owner):
    base, _ = month_rows(owner)
    oid = cancelled_order(manager, owner)
    dash = owner.get("/api/finance/dashboard").json()
    assert oid not in [o["orderId"] for o in dash["orders"]]
    row = next(o for o in dash["cancelledOrders"] if o["orderId"] == oid)
    c = row["cancellation"]
    cost = owner.get(f"/api/orders/{oid}/cost").json()["totalCost"]
    assert row["cancelled"] and row["provisional"] and row["pendingAmount"] == 0
    assert c["estimatedOrderValue"] == 60000 and c["actualCostIncurred"] == cost and cost > 0
    assert c["recoverableMaterialValue"] == 0 and c["writeOffLoss"] == cost  # nothing is assumed to be recovered
    assert c["earnedRevenue"] == round(60000 * 40 / 300, 2)                  # only the existing accrual for produced metres
    assert dash["kpis"]["cancelledOrderLoss"] >= cost
    assert dash["leastProfitableOrder"] is None or dash["leastProfitableOrder"]["orderId"] != oid
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    report = owner.get(f"/api/finance/month-end?month={month}").json()
    assert any(o["orderId"] == oid for o in report["cancelledOrders"])
    assert report["productionOverview"]["completedOrders"] == base["productionOverview"]["completedOrders"]
    assert report["machineOperatingCost"] > 0


def test_recoverable_material_only_counts_what_is_returned_to_stock(manager, owner):
    oid = cancelled_order(manager, owner)
    stock = next(b for b in owner.get("/api/inventory").json() if b["batchId"] == "YB82")
    used = sum(c["quantityKg"] for c in dbm.db.materialConsumption.find({"orderId": oid}))
    too_much = owner.patch("/api/inventory/YB82", json={"quantityKg": stock["quantityKg"] + used + 5, "returnedFromOrderId": oid})
    assert too_much.status_code == 409
    ok = owner.patch("/api/inventory/YB82", json={"quantityKg": stock["quantityKg"] + 5, "returnedFromOrderId": oid})
    assert ok.status_code == 200 and "returnedFromOrderId" not in ok.json()
    row = next(o for o in owner.get("/api/finance/dashboard").json()["cancelledOrders"] if o["orderId"] == oid)
    assert row["cancellation"]["recoverableMaterialValue"] == round(5 * stock["costPerKg"], 2)
    cost = row["cancellation"]["actualCostIncurred"]
    assert row["cancellation"]["writeOffLoss"] == round(cost - 5 * stock["costPerKg"], 2)
    live = new_order(owner)
    assert owner.patch("/api/inventory/YB82", json={"quantityKg": 9999, "returnedFromOrderId": live}).status_code == 409


def test_cancel_releases_reserved_yarn(manager, owner):
    oid = new_order(manager)
    free = lambda: (lambda b: b["quantityKg"] - b.get("reservedKg", 0))(dbm.inventory().find_one({"batchId": "YB82"}))
    start = free()
    assert manager.post(f"/api/orders/{oid}/reserve", json={"batchId": "YB82", "quantityKg": 100}).status_code == 200
    assert free() == start - 100
    assert owner.post(f"/api/orders/{oid}/cancel", json={"reason": "DUPLICATE_ORDER"}).status_code == 200
    assert free() == start


def test_dispatched_order_cannot_be_cancelled(owner):
    r = owner.post("/api/orders/ORD071/cancel", json={"reason": "OTHER"})
    assert r.status_code == 409


# ---------- roles ----------

def test_roles(manager, owner, qc):
    oid = running_order(manager)
    for c in (qc,):
        assert c.post(f"/api/orders/{oid}/pause", json={"reason": "MANUAL"}).status_code == 403
        assert c.post(f"/api/orders/{oid}/resume", json={}).status_code == 403
        assert c.post(f"/api/orders/{oid}/change-machine", json={"newMachineId": B, "reason": "MANUAL"}).status_code == 403
        assert c.post(f"/api/orders/{oid}/cancel", json={"reason": "OTHER"}).status_code == 403
        assert c.get(f"/api/orders/{oid}/machine-history").status_code == 403
        assert c.get(f"/api/orders/{oid}/audit").status_code == 403
    assert manager.post(f"/api/orders/{oid}/cancel", json={"reason": "OTHER"}).status_code == 403
    assert get_order(manager, oid)["status"] != "CANCELLED"
    assert pause(manager, oid).status_code == 200
    assert manager.get(f"/api/orders/{oid}/audit").status_code == 200
    assert owner.post(f"/api/orders/{oid}/resume", json={}).status_code == 200  # the owner can do everything
    assert pause(owner, oid, "MANUAL").status_code == 200
    assert owner.post(f"/api/orders/{oid}/cancel", json={"reason": "OTHER"}).status_code == 200
    anon = login("OWNER")
    anon.headers.pop("Authorization")
    assert anon.post(f"/api/orders/{oid}/pause", json={"reason": "MANUAL"}).status_code == 401


# ---------- QC safety ----------

def test_pause_and_change_machine_supersede_a_pending_inspection(manager, qc):
    oid = new_order(manager)
    assign(manager, oid)
    weave(manager, A, 100)  # the sample length: waiting for the first-off inspection
    order = get_order(manager, oid)
    assert order["stageStatus"] == "QC_PENDING" and order["pendingInspectionType"] == "FIRST_OFF"
    assert pause(manager, oid, "QUALITY_ISSUE").status_code == 200
    order = get_order(manager, oid)
    assert order["stageStatus"] == "PAUSED" and order["pendingInspectionType"] is None and order["productionBlocked"] is False
    assert oid not in [p["orderId"] for p in manager.get("/api/quality/pending").json()]
    assert inspect(qc, oid, inspectionType="FIRST_OFF", status="PASSED").status_code == 409
    log = manager.get(f"/api/orders/{oid}/audit").json()
    assert [a["event"] for a in log] == ["ORDER_PAUSED", "QC_REQUEST_SUPERSEDED"]
    assert log[1]["oldState"] == {"pendingInspectionType": "FIRST_OFF"}
    assert manager.post(f"/api/orders/{oid}/change-machine", json={"newMachineId": B, "reason": "MANUAL"}).status_code == 200
    assert manager.post(f"/api/orders/{oid}/resume", json={}).status_code == 200
    again = get_order(manager, oid)
    assert again["stageStatus"] == "IN_PROGRESS" and again["pendingInspectionType"] is None


def test_stale_qc_pass_is_not_accepted_for_later_production(manager, qc):
    oid = new_order(manager)
    assign(manager, oid)
    weave(manager, A, 100)
    assert inspect(qc, oid, inspectionType="FIRST_OFF", status="PASSED").status_code == 201
    weave(manager, A, 200)
    assert inspect(qc, oid, status="PASSED").status_code == 201
    assert get_order(manager, oid)["stageStatus"] == "COMPLETE"
    record = next(r for r in dbm.quality_checks().find({"orderId": oid, "inspectionType": "STAGE"}))
    assert record["producedMetersAtInspection"] == 300
    dbm.orders().update_one({"orderId": oid}, {"$set": {"producedMeters": 320}})  # more was produced after the pass
    r = manager.post(f"/api/orders/{oid}/stage/advance")
    assert r.status_code == 409 and r.json()["detail"] == "QC must pass before this stage can be completed"
    dbm.orders().update_one({"orderId": oid}, {"$set": {"producedMeters": 300}})
    assert manager.post(f"/api/orders/{oid}/stage/advance").status_code == 200


def test_new_production_after_resume_needs_a_new_inspection(manager, qc):
    oid = new_order(manager)
    assign(manager, oid)
    weave(manager, A, 100)
    assert inspect(qc, oid, inspectionType="FIRST_OFF", status="PASSED").status_code == 201
    weave(manager, A, 150)
    assert pause(manager, oid).status_code == 200
    assert manager.post(f"/api/orders/{oid}/resume", json={}).status_code == 200
    weave(manager, A, 150)  # finishes the order: a new stage inspection is requested
    assert get_order(manager, oid)["pendingInspectionType"] == "STAGE"
    assert manager.post(f"/api/orders/{oid}/stage/advance").status_code == 409


# ---------- two actions at once ----------

def test_second_simultaneous_action_gets_409(manager, monkeypatch):
    oid = running_order(manager)
    stale = dbm.orders().find_one({"orderId": oid}, {"_id": 0})
    assert pause(manager, oid).status_code == 200
    # the second request read the order before the first one wrote: its conditional update matches nothing
    monkeypatch.setattr(production_control, "_order", lambda _id: dict(stale))
    with pytest.raises(HTTPException) as caught:
        production_control.pause(oid, "MANUAL", None, {"email": "x@y.z", "role": "OWNER"})
    assert caught.value.status_code == 409 and "changed while pausing" in caught.value.detail
    assert len(manager.get(f"/api/orders/{oid}/audit").json()) == 1  # the loser wrote nothing


def test_cancel_wins_over_a_stale_resume(manager, owner, monkeypatch):
    oid = running_order(manager)
    pause(manager, oid)
    stale = dbm.orders().find_one({"orderId": oid}, {"_id": 0})
    assert owner.post(f"/api/orders/{oid}/cancel", json={"reason": "OTHER"}).status_code == 200
    monkeypatch.setattr(production_control, "_order", lambda _id: dict(stale))
    with pytest.raises(HTTPException) as caught:
        production_control.resume(oid, None, {"email": "m@y.z", "role": "PRODUCTION_MANAGER"})
    assert caught.value.status_code == 409
    assert machine(A)["status"] == "IDLE" and machine(A)["currentOrderId"] is None  # the machine claim was rolled back
    assert get_order(owner, oid)["status"] == "CANCELLED"


def test_two_orders_cannot_claim_one_machine(manager):
    first, second = running_order(manager), new_order(manager)
    pause(manager, first)
    assign(manager, second, B)
    pause(manager, second)
    # first takes the machine of second: allowed only if second no longer holds it
    r = manager.post(f"/api/orders/{first}/change-machine", json={"newMachineId": B, "reason": "MANUAL"})
    assert r.status_code == 409 and r.json()["detail"].startswith("Selected machine is already assigned")


# ---------- audit ----------

def test_audit_trail_records_actor_state_and_reason(manager, owner):
    oid = running_order(manager)
    pause(manager, oid, "MAINTENANCE", "belt change")
    manager.post(f"/api/orders/{oid}/change-machine", json={"newMachineId": B, "reason": "MAINTENANCE", "notes": "move"})
    manager.post(f"/api/orders/{oid}/resume", json={})
    owner.post(f"/api/orders/{oid}/cancel", json={"reason": "MATERIAL_ISSUE", "notes": "bad yarn"})
    log = owner.get(f"/api/orders/{oid}/audit").json()
    assert [a["event"] for a in log] == ["ORDER_PAUSED", "MACHINE_CHANGED", "ORDER_RESUMED", "ORDER_CANCELLED"]
    paused, changed, _, cancelled = log
    assert paused["actor"] == "manager@loomsense.demo" and paused["actorRole"] == "PRODUCTION_MANAGER"
    assert paused["reason"] == "MAINTENANCE" and paused["notes"] == "belt change" and paused["stage"] == "WEAVING"
    assert paused["oldState"] == {"stageStatus": "IN_PROGRESS"} and paused["newState"] == {"stageStatus": "PAUSED"}
    assert changed["oldState"] == {"machineId": A} and changed["newState"] == {"machineId": B}
    assert cancelled["actor"] == "owner@loomsense.demo" and cancelled["newState"] == {"status": "CANCELLED"}
    assert all(a["createdAt"] and "_id" not in a for a in log)


# ---------- buyer tracking ----------

def test_buyer_tracking_wording_and_no_internal_data(manager, owner, public):
    oid = running_order(manager)
    token = dbm.orders().find_one({"orderId": oid})["trackingToken"]

    def view():
        r = public.get(f"/api/buyer/track/{token}")
        assert r.status_code == 200
        return r.json()

    assert "statusMessage" not in view()
    pause(manager, oid, "MACHINE_BREAKDOWN", "secret breakdown note")
    paused = view()
    assert paused["statusMessage"] == "Production temporarily paused" and paused["orderStatus"] == "PAUSED"
    manager.post(f"/api/orders/{oid}/resume", json={})
    owner.post(f"/api/orders/{oid}/cancel", json={"reason": "PRODUCTION_DEFECT", "notes": "secret cancel note"})
    gone = view()
    assert gone["statusMessage"] == "Order cancelled" and gone["orderStatus"] == "CANCELLED" and gone["dispatchStatus"] == "NOT_DISPATCHED"
    for body in (paused, gone):
        text = str(body).lower()
        for word in ("w05", "w03", "secret", "breakdown", "defect", "emp0", "cost", "profit", "ses0", "cancelreason", "manager@", "owner@"):
            assert word not in text


# ---------- end to end ----------

def test_end_to_end_breakdown_move_and_finish(manager, owner, qc):
    _, base = month_rows(owner)
    oid = new_order(manager, 300)
    assert manager.post(f"/api/orders/{oid}/reserve", json={"batchId": "YB82", "quantityKg": 200}).status_code == 200  # raw material
    assign(manager, oid, A)
    weave(manager, A, 40)
    assert pause(manager, oid, "MACHINE_BREAKDOWN").status_code == 200
    dbm.machines().update_one({"machineId": A}, {"$set": {"status": "DOWN"}})
    assert manager.post(f"/api/orders/{oid}/change-machine", json={"newMachineId": B, "reason": "MACHINE_BREAKDOWN"}).status_code == 200
    assert manager.post(f"/api/orders/{oid}/resume", json={}).status_code == 200
    weave(manager, B, 60)  # 100 m: the first-off sample
    assert get_order(manager, oid)["pendingInspectionType"] == "FIRST_OFF"
    assert inspect(qc, oid, inspectionType="FIRST_OFF", status="PASSED").status_code == 201
    weave(manager, B, 200)
    assert get_order(manager, oid)["stageStatus"] == "QC_PENDING"
    assert inspect(qc, oid, status="PASSED").status_code == 201
    moved = manager.post(f"/api/orders/{oid}/stage/advance")
    assert moved.status_code == 200 and moved.json()["currentStage"] == "PROCESSING"
    history = manager.get(f"/api/orders/{oid}/machine-history").json()
    assert [(s["machineId"], s["status"], s["metresProduced"]) for s in history] == [(A, "ENDED", 40), (B, "ENDED", 260)]
    assert history[1]["endReason"] == "STAGE_COMPLETED" and {s["stage"] for s in history} == {"WEAVING"}
    _, rows = month_rows(owner)
    assert rows[A]["producedMeters"] - base[A]["producedMeters"] == 40
    assert rows[B]["producedMeters"] - base[B]["producedMeters"] == 260
    log = [a["event"] for a in manager.get(f"/api/orders/{oid}/audit").json()]
    assert log == ["ORDER_PAUSED", "MACHINE_CHANGED", "ORDER_RESUMED"]


def test_end_to_end_cancelled_order_keeps_history_and_is_not_revenue(manager, owner):
    oid = new_order(manager, 300)
    assign(manager, oid, A)
    weave(manager, A, 50)
    assert manager.post("/api/attendance", json={"workerId": "EMP022", "orderId": oid, "machineId": A, "hoursWorked": 8, "overtimeHours": 1}).status_code == 201
    cost_before = owner.get(f"/api/orders/{oid}/cost").json()
    assert owner.post(f"/api/orders/{oid}/cancel", json={"reason": "COMMERCIAL_DECISION", "notes": "price dispute"}).status_code == 200
    weave(manager, A, 50)
    assert get_order(owner, oid)["producedMeters"] == 50
    assert manager.post(f"/api/orders/{oid}/stage/advance").status_code == 409
    assert owner.get(f"/api/orders/{oid}/cost").json()["costs"] == cost_before["costs"]
    assert len(events(oid)) >= 1 and sum(e["producedMetersDelta"] for e in events(oid)) == 50
    assert dbm.db.materialConsumption.count_documents({"orderId": oid}) >= 1
    assert dbm.attendance().count_documents({"orderId": oid}) == 1
    finance = owner.get(f"/api/finance/orders/{oid}").json()
    assert finance["cancelled"] and finance["provisional"] and finance["earnedRevenue"] == round(60000 * 50 / 300, 2)
    dash = owner.get("/api/finance/dashboard").json()
    assert oid in [o["orderId"] for o in dash["cancelledOrders"]] and oid not in [o["orderId"] for o in dash["orders"]]
    assert [a["event"] for a in owner.get(f"/api/orders/{oid}/audit").json()] == ["ORDER_CANCELLED"]

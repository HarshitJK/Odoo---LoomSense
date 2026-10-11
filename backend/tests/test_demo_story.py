"""The demo uses real routes, real role logins and an isolated seeded database."""
import math
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import database as dbm, seed
from app.main import app
from app.services import machine_simulator as sim, profitability
from tests.test_quality_gate import login


@pytest.fixture(autouse=True)
def fresh_demo():
    seed.main()
    sim.state.update(running=False, speed=1.0)


def ok(client, method, path, **body):
    response = client.request(method, path, json=body or None)
    assert response.status_code in (200, 201), response.text
    return response.json()


def safe(value):
    if isinstance(value, dict):
        for key, item in value.items():
            assert not any(word in key.lower() for word in
                           ('cost', 'rate', 'wage', 'profit', 'margin', 'supplier', 'severity', 'defect', 'inspector'))
            safe(item)
    elif isinstance(value, list):
        for item in value:
            safe(item)


def test_manager_hours_permissions():
    manager, owner, qc = [login(r) for r in ('PRODUCTION_MANAGER', 'OWNER', 'WORKER_QC')]
    safe(ok(manager, 'GET', '/api/workers'))
    entry = dict(workerId='EMP021', orderId='ORD104', machineId='W01', hoursWorked=8, overtimeHours=1)
    safe(ok(manager, 'POST', '/api/attendance', **entry))
    saved = dbm.attendance().find_one({'workerId': 'EMP021', 'date': date.today().isoformat(), 'hoursWorked': 8, 'overtimeHours': 1})
    assert saved['hourlyRate'] == 90
    assert manager.post('/api/attendance', json={**entry, 'hourlyRate': 1}).status_code == 422
    for client in (manager, qc):
        assert client.get('/api/workers/wages/summary').status_code == 403
        assert client.post('/api/workers', json={'workerId': 'NEW', 'name': 'Test', 'hourlyRate': 1}).status_code == 403
    assert qc.get('/api/workers').status_code == 403
    assert qc.post('/api/attendance', json=entry).status_code == 403
    assert 'hourlyRate' in ok(owner, 'GET', '/api/workers')[0]
    safe(ok(manager, 'GET', '/api/workers'))


def test_seeded_months_and_accrual_basis():
    owner = login('OWNER')
    from app.data_checks import check_data
    assert check_data() == []
    for month in ('2026-07', '2026-08', '2026-09', '2026-10'):
        summary = profitability.monthly_summary(month)
        assert summary['margin'] >= -20, summary
        k = ok(owner, 'GET', '/api/finance/dashboard?month=' + month)['kpis']
        assert k['revenue'] == summary['revenue']
        assert k['productionCost'] == summary['totalCost']
        assert k['netProfit'] == round(k['revenue'] - k['productionCost'], 2)
    before = profitability.monthly_summary('2026-10')
    dbm.transactions().insert_one(dict(type='BUYER_PAYMENT', orderId='ORD104', amount=12345, date='2026-10-10'))
    assert profitability.monthly_summary('2026-10') == before
    # A purchase is stock, not consumption, and must not lower production profit.
    dbm.db.materialPurchases.insert_one(dict(totalAmount=9999, purchaseDate='2026-10-10'))
    assert profitability.monthly_summary('2026-10') == before
    # Dated production and consumption cross order-date boundaries together.
    dbm.db.machineProductionEvents.insert_one(dict(machineId='W01', orderId='ORD104', timestamp='2026-11-01', producedMetersDelta=100, machineCost=600))
    dbm.db.materialConsumption.insert_one(dict(orderId='ORD104', date='2026-11-01', quantityKg=59, cost=10620))
    november = profitability.monthly_summary('2026-11')
    assert november['revenue'] == 17800
    assert november['totalCost'] == 11220


def test_frontend_read_endpoints_on_fresh_seed():
    owner = login('OWNER')
    paths = ['/api/orders', '/api/machines', '/api/inventory', '/api/workers?month=2026-10',
             '/api/workers/wages/summary?month=2026-10', '/api/purchases',
             '/api/quality', '/api/quality/options', '/api/quality/pending', '/api/quality/holds',
             '/api/quality/analytics?month=2026-10', '/api/finance/dashboard?month=2026-10',
             '/api/finance/monthly', '/api/finance/month-end?month=2026-10', '/api/finance/profit-leakage',
             '/api/machines/monthly-summary?month=2026-10', '/api/passport/RL10092']
    for order in dbm.orders().find({}):
        oid = order['orderId']
        paths.extend([f'/api/orders/{oid}', f'/api/orders/{oid}/readiness', f'/api/orders/{oid}/cost',
                      f'/api/finance/orders/{oid}', f'/api/quality/order/{oid}/timeline',
                      '/api/buyer/track/' + order['trackingToken']])
    for path in paths:
        ok(owner, 'GET', path)
    for machine in ok(owner, 'GET', '/api/machines'):
        if machine['status'] == 'RUNNING':
            assert machine['estimatedCompletion'] is not None
    for worker in ok(owner, 'GET', '/api/workers?month=2026-10'):
        if not worker['hoursThisMonth'] and not worker['overtimeThisMonth']:
            assert worker['wageThisMonth'] == 0
    for event in dbm.db.machineProductionEvents.find({}):
        order = dbm.orders().find_one({'orderId': event['orderId']})
        assert event['timestamp'][:10] >= order['orderDate']
    assert 15 <= profitability.monthly_summary('2026-10')['margin'] <= 45


def test_complete_demo_story():
    owner, manager, qc = [login(r) for r in ('OWNER', 'PRODUCTION_MANAGER', 'WORKER_QC')]
    public = TestClient(app)
    spec = dict(quantityMeters=2000, fabricType='Cotton', colour='Navy Blue', expectedRevenue=350000)
    shortage = ok(owner, 'POST', '/api/orders/readiness-check', **spec)
    assert [shortage[k] for k in ('requiredYarnKg', 'availableKg', 'shortageKg')] == [1180, 950, 230]
    assert shortage['status'] == 'CANNOT_START_FULL_PRODUCTION'
    assert shortage['projectedMargin'] > 25
    # Receive enough demo stock without changing the yarn price or any cost formula.
    ok(owner, 'POST', '/api/purchases', supplier='Supplier A', invoiceNumber='DEMO-LIVE-1', batchId='YB82', material='Cotton Yarn', colour='Navy Blue', quantityKg=1050, costPerKg=180, purchaseDate=date.today().isoformat())
    ready = ok(owner, 'POST', '/api/orders/readiness-check', **spec)
    assert ready['status'] == 'MATERIAL_READY' and ready['projectedMargin'] > 25
    order = ok(manager, 'POST', '/api/orders', buyerName='Demo Buyer', fabricType='Cotton', colour='Navy Blue', quantityMeters=2000, revenue=350000)
    oid, token = order['orderId'], order['trackingToken']
    assert order['gated'] and order['requiresFirstOffQc']
    ok(manager, 'POST', f'/api/orders/{oid}/reserve', batchId='YB82', quantityKg=1180)
    ok(manager, 'PATCH', '/api/machines/W05', currentOrderId=oid, status='RUNNING', productionRate=100)
    safe(ok(manager, 'POST', '/api/attendance', workerId='EMP023', orderId=oid, machineId='W05', hoursWorked=8, overtimeHours=1))
    ok(manager, 'POST', '/api/machines/W05/readings', producedMetersDelta=100)
    ok(qc, 'POST', '/api/quality', orderId=oid, inspectionType='FIRST_OFF', status='PASSED')
    track = ok(public, 'GET', '/api/buyer/track/' + token)
    assert track['qualityStatus'] == 'IN_PROGRESS'
    safe(track)
    ok(manager, 'POST', '/api/machines/W05/readings', producedMetersDelta=1900)
    before = ok(owner, 'GET', f'/api/finance/orders/{oid}')
    failed = ok(qc, 'POST', '/api/quality', orderId=oid, inspectionType='STAGE', status='FAILED', defectType='Weft break', defectSeverity='HIGH', affectedMeters=60, reworkCost=4000, additionalLabourCost=2500, additionalMachineCost=1800)
    fid = failed['inspectionId']
    held = ok(manager, 'GET', f'/api/orders/{oid}')
    assert held['stageStatus'] == 'QUALITY_HOLD' and held['qualityHold']['holdReason']
    assert manager.post(f'/api/orders/{oid}/stage/advance').status_code == 409
    safe(ok(public, 'GET', '/api/buyer/track/' + token))
    after = ok(owner, 'GET', f'/api/finance/orders/{oid}')
    assert round(before['profit'] - after['profit'], 2) == 8300
    assert after['margin'] < before['margin']
    ok(qc, 'PATCH', f'/api/quality/{fid}/corrective-action', correctiveAction='REWORK_CURRENT_STAGE')
    ok(qc, 'POST', '/api/quality', orderId=oid, inspectionType='REINSPECTION', reinspectionOf=fid, status='PASSED')
    ok(manager, 'POST', f'/api/orders/{oid}/stage/advance')
    for stage in ('PROCESSING', 'FINISHING'):
        assert ok(manager, 'GET', f'/api/orders/{oid}')['currentStage'] == stage
        ok(manager, 'POST', f'/api/orders/{oid}/stage/complete')
        ok(qc, 'POST', '/api/quality', orderId=oid, status='PASSED')
        ok(manager, 'POST', f'/api/orders/{oid}/stage/advance')
    final = ok(qc, 'POST', '/api/quality', orderId=oid, inspectionType='FINAL', status='PASSED')
    passport = ok(public, 'GET', '/api/passport/' + final['rollId'])
    assert passport['final'] and passport['qualityStatus'] == 'PASSED'
    track = ok(public, 'GET', '/api/buyer/track/' + token)
    assert track['qualityStatus'] == 'PASSED'
    safe(track)
    k = ok(owner, 'GET', '/api/finance/dashboard')['kpis']
    assert k['netProfit'] == round(k['revenue'] - k['productionCost'], 2)
    assert k['reworkCost'] >= 8300
    assert all(math.isfinite(v) for v in k.values())
    leaks = ok(owner, 'GET', f'/api/finance/profit-leakage?order_id={oid}')['leaks']
    assert sum(l['amount'] for l in leaks if l.get('type') == 'QUALITY_FAILURE') == 8300


def test_legacy_tracking_waits_for_completion():
    owner = login('OWNER')
    public = TestClient(app)
    order = ok(owner, 'GET', '/api/orders/ORD104')
    track = ok(public, 'GET', '/api/buyer/track/' + order['trackingToken'])
    assert track['progress'] == 73 and track['qualityStatus'] == 'IN_PROGRESS'
    safe(track)
    ok(owner, 'PATCH', '/api/orders/ORD104', producedMeters=2000, status='COMPLETED')
    assert ok(public, 'GET', '/api/buyer/track/' + order['trackingToken'])['qualityStatus'] == 'PASSED'

# LoomSense Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env            # then set MONGODB_URI
python -m app.seed              # load demo data (safe to re-run)
python run.py                   # http://localhost:8000/docs
```

Check: `curl http://localhost:8000/api/health` -> `{"status":"ok","database":"connected"}`

Tests (use a separate `loomsense_test` database): `python -m pytest`
API smoke test (server running): `python smoke_test.py`

Live machines: the simulator runs inside the API (set `SIMULATOR_AUTOSTART=false` to start it paused).
Watch the stream without a frontend: `python ws_check.py` (prints the first 5 WebSocket messages).
Speed up a demo: `curl -X POST localhost:8000/api/machines/simulate -H "Content-Type: application/json" -d '{"action":"start","speed":20}'`

Run like production: `PORT=8000 uvicorn app.main:app --host 0.0.0.0 --port $PORT` (see `Procfile`, `../render.yaml`).
Full demo story through the API: `python demo_flow.py` (set `ADMIN_KEY` in `.env` to reset the data first).
Reset the demo remotely: `curl -X POST localhost:8000/api/demo/reset -H "X-Admin-Key: $ADMIN_KEY"`.
Test tools (pytest, httpx): `pip install -r requirements-dev.txt`.

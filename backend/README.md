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

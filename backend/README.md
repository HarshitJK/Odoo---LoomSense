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

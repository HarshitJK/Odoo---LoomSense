"""Replay sample machine readings to the API, as if real machines were sending data.

    python machine_feeder.py        (API_URL and FEEDER_DELAY_SECONDS can be set in the environment)

Use it with SIMULATOR_AUTOSTART=false on the backend: the built-in simulator and this feeder
would both move the same machines.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API_URL = os.getenv("API_URL", "http://localhost:8000").rstrip("/")
DELAY = float(os.getenv("FEEDER_DELAY_SECONDS", "3"))
READINGS = Path(__file__).parent / "sample_data" / "machine_readings.json"


def post(machine_id: str, body: dict) -> int:
    req = urllib.request.Request(
        f"{API_URL}/api/machines/{machine_id}/readings", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + os.getenv("FEEDER_TOKEN", "")}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status
    except urllib.error.HTTPError as e:
        return e.code


def wait_for_api():
    print(f"Waiting for {API_URL}/api/health ...", flush=True)
    while True:
        try:
            with urllib.request.urlopen(f"{API_URL}/api/health", timeout=3):
                return
        except Exception:
            time.sleep(2)


def main():
    readings = json.loads(READINGS.read_text(encoding="utf-8"))
    wait_for_api()
    print(f"Replaying {len(readings)} readings every {DELAY:g}s (Ctrl+C to stop)", flush=True)
    while True:
        for r in readings:
            body = {k: v for k, v in r.items() if k != "machineId"}
            status = post(r["machineId"], body)
            print(f"{r['machineId']} {r.get('status')} temp={r.get('temperature')} +{r.get('producedMetersDelta')} m -> HTTP {status}", flush=True)
            time.sleep(DELAY)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)

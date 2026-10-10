"""Print the first five messages from /ws/machines: python ws_check.py [ws_url]"""
import json
import sys

from websockets.sync.client import connect

URL = sys.argv[1] if len(sys.argv) > 1 else "ws://localhost:8000/ws/machines"

with connect(URL) as ws:
    for i in range(1, 6):
        msg = json.loads(ws.recv())
        if msg["type"] == "event":
            print(f"{i}. event {msg['event']}: {msg['message']}")
            continue
        running = [m for m in msg["machines"] if m["status"] == "RUNNING"]
        w01 = next((m for m in msg["machines"] if m["machineId"] == "W01"), None)
        print(f"{i}. {msg['type']}: {len(msg['machines'])} machines, {len(running)} running, "
              f"simulator={msg.get('simulator')}")
        if w01:
            print(f"   W01 produced={w01['producedMeters']} progress={w01['progress']}% "
                  f"temp={w01['temperature']} eff={w01['efficiency']} "
                  f"orderCost={w01['orderMachineCost']} eta={w01['estimatedCompletion']}")

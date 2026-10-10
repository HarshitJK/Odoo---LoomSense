"""Fake machine telemetry so we can demo without real hardware."""
import random


def simulate_machine_update(machine: dict) -> dict:
    """Return a copy of the machine with a small production step applied."""
    m = dict(machine)
    if m.get("status") == "RUNNING":
        step = m.get("productionRate", 100) * random.uniform(0.05, 0.15)
        m["producedMeters"] = min(
            m.get("producedMeters", 0) + step,
            m.get("targetMeters") or float("inf"),
        )
        m["temperature"] = round(random.uniform(55, 70), 1)
    return m

import asyncio
import secrets
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from app import seed
from app.config import ADMIN_KEY, SIMULATOR_AUTOSTART
from app.services import machine_simulator as simulator

router = APIRouter()


@router.post("/reset")
async def reset_demo(x_admin_key: Optional[str] = Header(default=None)):
    """Re-run the seed so the demo starts again. Needs header X-Admin-Key = ADMIN_KEY."""
    if not ADMIN_KEY:
        raise HTTPException(403, "Demo reset is disabled: set ADMIN_KEY in the environment")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, ADMIN_KEY):
        raise HTTPException(403, "Invalid or missing X-Admin-Key header")

    def run_seed():
        with simulator.sim_lock:  # never reseed in the middle of a simulator tick
            return seed.main()

    counts = await asyncio.to_thread(run_seed)
    simulator.state.update(running=SIMULATOR_AUTOSTART, speed=1.0)
    await simulator.emit(simulator.event_message("demo_reset", "Demo data was reset."))
    await simulator.emit(simulator.update_message(await asyncio.to_thread(simulator.get_snapshot)))
    return {"message": "Demo data reset", "inserted": counts, "simulator": simulator.simulator_state()}

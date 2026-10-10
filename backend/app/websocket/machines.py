import asyncio
import random

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws/machines")
async def machines_socket(ws: WebSocket):
    """Demo feed: sends a fake machine update every 2 seconds."""
    await ws.accept()
    meters = 500
    try:
        while True:
            meters += random.randint(5, 15)
            await ws.send_json({
                "machineId": "W01",
                "status": "RUNNING",
                "producedMeters": meters,
            })
            await asyncio.sleep(2)
    except (WebSocketDisconnect, RuntimeError):
        pass

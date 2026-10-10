import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services import machine_simulator as simulator

router = APIRouter()


class ConnectionManager:
    """Keeps the open WebSocket connections. One broken connection never affects the others."""

    def __init__(self):
        self.active = set()

    def disconnect(self, ws: WebSocket) -> None:
        self.active.discard(ws)

    async def _send(self, ws: WebSocket, message: dict) -> None:
        try:
            await asyncio.wait_for(ws.send_json(message), timeout=2)
        except Exception:
            self.disconnect(ws)

    async def broadcast(self, message: dict) -> None:
        if self.active:
            await asyncio.gather(*(self._send(ws, message) for ws in list(self.active)))


manager = ConnectionManager()


@router.websocket("/ws/machines")
async def machines_socket(ws: WebSocket):
    """Sends a snapshot on connect, then machine_update / event messages from the simulator."""
    await ws.accept()
    try:
        try:
            machines = await asyncio.to_thread(simulator.get_snapshot)
            snapshot = {"type": "snapshot", "timestamp": simulator.now_iso(),
                        "simulator": simulator.simulator_state(), "machines": machines}
        except Exception:
            snapshot = {"type": "error", "message": "MongoDB is not available"}
        await ws.send_json(snapshot)
        manager.active.add(ws)
        while True:
            await ws.receive_text()  # ignore client messages; this detects disconnects
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(ws)

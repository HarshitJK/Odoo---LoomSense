import { useEffect, useState } from "react";
import { API_URL } from "../api/client.js";

// Connects to WS /ws/machines and returns the most recent machine update.
export default function useMachineSocket() {
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(API_URL.replace(/^http/, "ws") + "/ws/machines");
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        setLastUpdate(JSON.parse(event.data));
      } catch {
        // ignore malformed messages
      }
    };
    return () => ws.close();
  }, []);

  return { lastUpdate, connected };
}

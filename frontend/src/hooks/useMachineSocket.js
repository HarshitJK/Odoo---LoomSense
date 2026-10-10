import { useEffect, useState } from "react";
import { API_URL } from "../api/client.js";

/**
 * Live machine feed from WS /ws/machines.
 * Returns { machines, simulator, event, connected }:
 *   machines  - latest list from a `snapshot` or `machine_update` message (null until the first one)
 *   simulator - { running, speed } from the same message
 *   event     - latest `event` message (order_completed, machine_failure, ...)
 * Reconnects automatically after 3 seconds if the connection drops.
 */
export default function useMachineSocket(enabled = true) {
  const [state, setState] = useState({ machines: null, simulator: null, event: null });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let ws;
    let retry;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(API_URL.replace(/^http/, "ws") + "/ws/machines");
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 3000);
      };
      ws.onmessage = (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return; // ignore malformed messages
        }
        if (msg.type === "snapshot" || msg.type === "machine_update") {
          setState((s) => ({ ...s, machines: msg.machines, simulator: msg.simulator ?? s.simulator }));
        } else if (msg.type === "event") {
          setState((s) => ({ ...s, event: msg }));
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, [enabled]);

  return { ...state, connected };
}

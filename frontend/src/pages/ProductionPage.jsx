import { useState, useEffect } from "react";
import { Activity, Pause, AlertOctagon, Gauge, WifiOff } from "lucide-react";

import PageHeader from "../components/common/PageHeader.jsx";
import MachineCard from "../components/machines/MachineCard.jsx";
import MachineDetailPanel from "../components/machines/MachineDetailPanel.jsx";

// Fallback when API is unreachable
import { machines as mockMachines } from "../mocks/machines.js";
import client from "../api/client.js"; // axios, base URL from VITE_API_URL

// ─── Live update constant ─────────────────────────────────────────────────────
const TICK_INTERVAL_MS = 3000; // simulated production tick every 3 seconds

// ─── API → component shape normaliser ────────────────────────────────────────
// The API returns `currentOrderId` (matches MongoDB schema in context.md).
// Our MachineCard/MachineDetailPanel components read `orderId`.
// We also add default values for fields the API doesn't return yet
// (runtimeHours, estimatedCompletion) so the live-cost maths never breaks.
function normaliseMachine(apiMachine) {
  return {
    ...apiMachine,
    // Map API field name → component field name
    orderId: apiMachine.currentOrderId ?? null,
    // Fields not yet in the API — default to safe values
    runtimeHours:          apiMachine.runtimeHours          ?? 0,
    estimatedCompletion:   apiMachine.estimatedCompletion    ?? null,
  };
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ machines }) {
  const running     = machines.filter((m) => m.status === "RUNNING").length;
  const idle        = machines.filter((m) => m.status === "IDLE").length;
  const down        = machines.filter((m) => m.status === "DOWN").length;
  const totalMetres = machines.reduce((sum, m) => sum + m.producedMeters, 0);

  const stats = [
    { label: "Running",          value: running,                                   colour: "text-green-600", bg: "bg-green-50", icon: Activity      },
    { label: "Idle",             value: idle,                                      colour: "text-amber-600", bg: "bg-amber-50", icon: Pause         },
    { label: "Down",             value: down,                                      colour: "text-red-600",   bg: "bg-red-50",   icon: AlertOctagon  },
    { label: "Total Metres Today", value: `${Math.round(totalMetres).toLocaleString("en-IN")} m`,
      colour: "text-blue-600", bg: "bg-blue-50", icon: Gauge },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map(({ label, value, colour, bg, icon: Icon }) => (
        <div key={label} className={`rounded-xl ${bg} border border-slate-100 flex items-center gap-3 px-5 py-4`}>
          <Icon className={`${colour} shrink-0`} size={22} />
          <div>
            <p className={`text-2xl font-bold ${colour}`}>{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function OfflineBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-100 border border-slate-200 px-4 py-2 text-xs text-slate-500">
      <WifiOff size={14} />
      Backend offline — showing mock data. WebSocket live feed will replace this interval once ready.
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductionPage() {
  const [machines, setMachines]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [isOffline, setOffline]   = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // ── Step 1: Fetch initial machine state from GET /api/machines ──
  useEffect(() => {
    client.get("/api/machines")
      .then((res) => {
        // Normalise API shape → component shape (currentOrderId → orderId, add defaults)
        setMachines(res.data.map(normaliseMachine));
        setOffline(false);
      })
      .catch(() => {
        // Backend not reachable — use mock data (already has orderId field)
        setMachines(mockMachines);
        setOffline(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Step 2: Fake live update every 3 s for RUNNING machines ──
  // The Lead can replace this with:  const machines = useMachineSocket();
  // WS /ws/machines exists but is demo-feed only — interval is correct for now.
  useEffect(() => {
    if (machines.length === 0) return; // wait for initial load

    const interval = setInterval(() => {
      setMachines((prev) =>
        prev.map((m) => {
          if (m.status !== "RUNNING" || m.producedMeters >= m.targetMeters) return m;
          const increment  = (m.productionRate / 3600) * (TICK_INTERVAL_MS / 1000);
          const newProduced = Math.min(m.targetMeters, m.producedMeters + increment);
          return { ...m, producedMeters: newProduced };
        })
      );
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [machines.length]); // re-run only if machine count changes (initial load or reconnect)

  // Derive selected machine from live state so the panel stays up-to-date
  const selectedMachine = machines.find((m) => m.machineId === selectedId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading machines…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Control Tower"
        subtitle="Live machine status — updates every 3 seconds"
      />

      {isOffline && <OfflineBanner />}

      {/* ── Summary strip — takes machines as prop ── */}
      <SummaryStrip machines={machines} />

      {/* ── Machine card grid (1 / 2 / 3 columns) ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {machines.map((machine) => (
          <MachineCard
            key={machine.machineId}
            machine={machine}
            onClick={() => setSelectedId(machine.machineId)}
          />
        ))}
      </div>

      {/* ── Detail panel — live machine object from state ── */}
      {selectedMachine && (
        <MachineDetailPanel
          machine={selectedMachine}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

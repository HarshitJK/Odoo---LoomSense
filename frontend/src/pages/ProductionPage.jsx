import { useState, useEffect } from "react";
import { Activity, Pause, AlertOctagon, Gauge, Radio } from "lucide-react";

import PageHeader from "../components/common/PageHeader.jsx";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import MockBadge from "../components/common/MockBadge.jsx";
import MachineCard from "../components/machines/MachineCard.jsx";
import MachineDetailPanel from "../components/machines/MachineDetailPanel.jsx";

// Only used when VITE_USE_MOCKS=true
import { machines as mockMachines } from "../mocks/machines.js";
import useApi from "../hooks/useApi.js";
import useMachineSocket from "../hooks/useMachineSocket.js";
import { USE_MOCKS } from "../config.js";

const TICK_INTERVAL_MS = 3000; // mock mode only: fake production tick every 3 seconds

// ─── API → component shape normaliser ────────────────────────────────────────
// The API sends `currentOrderId` and `runtimeToday` (hours); the machine components read
// `orderId` and `runtimeHours`. Everything else (progress, costPerMeter, orderMachineCost,
// estimatedCompletion, ...) is passed through unchanged.
function normaliseMachine(apiMachine) {
  return {
    ...apiMachine,
    orderId: apiMachine.currentOrderId ?? apiMachine.orderId ?? null,
    runtimeHours: apiMachine.runtimeToday ?? apiMachine.runtimeHours ?? 0,
    estimatedCompletion: apiMachine.estimatedCompletion ?? null,
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

/** Live / reconnecting indicator, simulator state and the latest factory event. */
function LiveStatus({ connected, simulator, event }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
      <span className={`inline-flex items-center gap-1.5 font-semibold ${connected ? "text-green-600" : "text-amber-600"}`}>
        <Radio size={14} /> {connected ? "Live" : "Reconnecting…"}
      </span>
      {simulator && (
        <span>Simulator {simulator.running ? `running at ${simulator.speed}x` : "stopped"}</span>
      )}
      {event && <span className="rounded bg-slate-100 px-2 py-0.5">{event.message}</span>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductionPage() {
  // Initial state from GET /api/machines, then live updates over WS /ws/machines
  const { data, loading, error, reload } = useApi("/api/machines", { mock: mockMachines });
  const socket = useMachineSocket(!USE_MOCKS);
  const [mockLive, setMockLive] = useState(null); // mock mode only
  const [selectedId, setSelectedId] = useState(null);

  const source = socket.machines ?? mockLive ?? data;
  const machines = (source ?? []).map(normaliseMachine);

  // Mock mode only: fake a production tick every 3 s so the page still moves without a backend
  useEffect(() => {
    if (!USE_MOCKS || !data) return undefined;
    setMockLive(data);
    const interval = setInterval(() => {
      setMockLive((prev) =>
        (prev ?? []).map((m) => {
          if (m.status !== "RUNNING" || m.producedMeters >= m.targetMeters) return m;
          const increment = (m.productionRate / 3600) * (TICK_INTERVAL_MS / 1000);
          return { ...m, producedMeters: Math.min(m.targetMeters, m.producedMeters + increment) };
        })
      );
    }, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [data]);

  // Derive selected machine from live state so the panel stays up-to-date
  const selectedMachine = machines.find((m) => m.machineId === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Control Tower"
        subtitle="Live machine status — updates every 3 seconds"
      />
      <MockBadge />

      <ApiErrorBanner error={error} onRetry={reload} />

      {!USE_MOCKS && !error && (
        <LiveStatus connected={socket.connected} simulator={socket.simulator} event={socket.event} />
      )}

      {loading && !source && (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading machines…</div>
      )}

      {!loading && !error && machines.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No machines found. Run <code>python -m app.seed</code> in the backend.
        </div>
      )}

      {machines.length > 0 && (
        <>
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
        </>
      )}

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

import { useState, useEffect } from "react";
import { Radio } from "lucide-react";

import PageHeader from "../components/common/PageHeader.jsx";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingBlock from "../components/common/LoadingBlock.jsx";
import MockBadge from "../components/common/MockBadge.jsx";
import Notice from "../components/common/Notice.jsx";
import MachineCard from "../components/machines/MachineCard.jsx";
import MachineDetailPanel from "../components/machines/MachineDetailPanel.jsx";

// Only used when VITE_USE_MOCKS=true
import { machines as mockMachines } from "../mocks/machines.js";
import useApi from "../hooks/useApi.js";
import useMachineSocket from "../hooks/useMachineSocket.js";
import { USE_MOCKS } from "../config.js";

const TICK_INTERVAL_MS = 3000; // mock mode only: fake production tick every 3 seconds

// The API sends `currentOrderId` and `runtimeToday` (hours); the machine components read
// `orderId` and `runtimeHours`. Everything else is passed through unchanged.
function normaliseMachine(apiMachine) {
  return {
    ...apiMachine,
    orderId: apiMachine.currentOrderId ?? apiMachine.orderId ?? null,
    runtimeHours: apiMachine.runtimeToday ?? apiMachine.runtimeHours ?? 0,
    estimatedCompletion: apiMachine.estimatedCompletion ?? null,
  };
}

/** One line: "3 running, 2 idle, 1 down". */
function SummaryLine({ machines }) {
  const count = (status) => machines.filter((m) => m.status === status).length;
  return (
    <p className="text-sm text-gray-900">
      <span className="font-medium">{count("RUNNING")}</span> running, <span className="font-medium">{count("IDLE")}</span> idle,{" "}
      <span className="font-medium">{count("DOWN")}</span> down
    </p>
  );
}

/** Live or reconnecting, as small text. */
function LiveStatus({ connected }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${connected ? "text-green-700" : "text-amber-700"}`}>
      <Radio size={16} aria-hidden="true" /> {connected ? "Live" : "Reconnecting"}
    </span>
  );
}

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

  // Derive the selected machine from live state so the panel stays up to date
  const selectedMachine = machines.find((m) => m.machineId === selectedId) ?? null;

  return (
    <>
      <PageHeader
        title="Machines"
        subtitle="Which machines are running, and how far along each order is."
        action={!USE_MOCKS && !error ? <LiveStatus connected={socket.connected} /> : undefined}
      />
      <MockBadge />
      <ApiErrorBanner error={error} onRetry={reload} />

      {socket.event?.message && <Notice tone="info">{socket.event.message}</Notice>}

      {loading && !source && <LoadingBlock label="Loading machines" height="h-40" />}

      {!loading && !error && machines.length === 0 && <EmptyState>No machines yet. Ask your administrator to add them.</EmptyState>}

      {machines.length > 0 && (
        <>
          <SummaryLine machines={machines} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {machines.map((machine) => (
              <MachineCard key={machine.machineId} machine={machine} onClick={() => setSelectedId(machine.machineId)} />
            ))}
          </div>
        </>
      )}

      {selectedMachine && <MachineDetailPanel machine={selectedMachine} onClose={() => setSelectedId(null)} />}
    </>
  );
}

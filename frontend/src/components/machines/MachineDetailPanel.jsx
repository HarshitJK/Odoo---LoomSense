import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import StatusBadge from "../common/StatusBadge.jsx";
import ProgressBar from "../common/ProgressBar.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { progressPercent } from "../../utils/calculations.js";
import { formatDateTime, formatHours, formatMetres, formatPercent } from "../../utils/format.js";

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-200 py-2.5 last:border-0">
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd className="text-sm tabular-nums text-gray-900">{value}</dd>
    </div>
  );
}

/**
 * MachineDetailPanel: side panel with everything about one machine that the card leaves out.
 * Closes with the close button, Escape, or a click outside.
 *
 * Props:
 *   machine - machine object (from ProductionPage state, always up to date with live data)
 *   onClose - function to close the panel
 */
export default function MachineDetailPanel({ machine, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => closeRef.current?.focus(), []); // focus once when the panel opens, not on every live update

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!machine) return null;

  const {
    machineId, name, status, orderId, producedMeters, targetMeters, productionRate,
    temperature, efficiency, estimatedCompletion, costPerHour, runtimeHours, orderMachineCost, costPerMeter,
  } = machine;

  const progress = progressPercent(producedMeters, targetMeters);
  // Prefer the server's numbers (orderMachineCost, costPerMeter); compute only for mock data
  const attributedCost = orderMachineCost ?? costPerHour * runtimeHours;
  const costPerMetre = costPerMeter ?? (producedMeters > 0 ? attributedCost / producedMeters : null);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/40" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="machine-panel-title"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-gray-200 bg-white shadow-md"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="machine-panel-title" className="text-base font-semibold text-gray-900">{machineId}</h2>
              <StatusBadge status={status} />
            </div>
            <p className="mt-0.5 text-sm text-gray-600">{name}</p>
          </div>
          <button
            id={`btn-close-detail-${machineId}`}
            ref={closeRef}
            type="button"
            aria-label="Close details"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 text-gray-900 hover:bg-gray-50"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <dl>
            <Row label="Order" value={orderId ?? "No order"} />
          </dl>

          {targetMeters > 0 && (
            <ProgressBar value={progress} label={`${formatMetres(producedMeters)} of ${formatMetres(targetMeters)}`} />
          )}

          <dl>
            <Row label="Speed" value={productionRate > 0 ? `${productionRate} m per hour` : "Not running"} />
            <Row label="Efficiency" value={efficiency > 0 ? formatPercent(efficiency * 100, 0) : "Not running"} />
            <Row label="Temperature" value={`${temperature}°C`} />
            <Row label="Hours run today" value={runtimeHours > 0 ? formatHours(runtimeHours) : "None yet"} />
            <Row label="Estimated finish" value={formatDateTime(estimatedCompletion, "Not known")} />
          </dl>

          <dl>
            <Row label="Cost per hour" value={formatCurrency(costPerHour)} />
            <Row label="Cost so far" value={formatCurrency(Math.round(attributedCost))} />
            <Row label="Cost per metre" value={costPerMetre !== null ? `₹${costPerMetre.toFixed(2)}` : "Not known"} />
          </dl>
        </div>
      </div>
    </>
  );
}

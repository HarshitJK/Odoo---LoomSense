import { X, Cpu, Thermometer, Zap, Clock, TrendingUp, DollarSign } from "lucide-react";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { progressPercent } from "../../utils/calculations.js";

/** Coloured status pill — same as in MachineCard, defined locally */
function StatusBadge({ status }) {
  const styles = {
    RUNNING: "bg-green-100 text-green-700",
    IDLE:    "bg-amber-100 text-amber-700",
    DOWN:    "bg-red-100  text-red-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

/** Thin progress bar */
function ProgressBar({ value }) {
  const clamped = Math.min(100, Math.max(0, value));
  const barColour =
    clamped >= 100 ? "bg-green-500" : clamped > 0 ? "bg-blue-500" : "bg-slate-300";
  return (
    <div className="h-2.5 w-full rounded-full bg-slate-100">
      <div
        className={`h-2.5 rounded-full transition-all duration-700 ${barColour}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** A labelled detail row */
function DetailRow({ icon: Icon, label, value, valueColour = "text-slate-800" }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="rounded-md bg-slate-100 p-1.5 text-slate-500">
        <Icon size={15} />
      </span>
      <span className="text-sm text-slate-500 flex-1">{label}</span>
      <span className={`text-sm font-semibold ${valueColour}`}>{value}</span>
    </div>
  );
}

/**
 * MachineDetailPanel — slide-in side panel (right edge) showing full machine detail.
 * Closes when user clicks X or the dark backdrop.
 *
 * Props:
 *   machine  — machine object (from ProductionPage state — always up-to-date with live data)
 *   onClose  — function to close the panel
 */
export default function MachineDetailPanel({ machine, onClose }) {
  if (!machine) return null;

  const {
    machineId, name, status, orderId,
    producedMeters, targetMeters, productionRate,
    temperature, efficiency, estimatedCompletion,
    costPerHour, runtimeHours, orderMachineCost, costPerMeter,
  } = machine;

  const progress       = progressPercent(producedMeters, targetMeters);
  // Prefer the server's numbers (orderMachineCost, costPerMeter); compute only for mock data
  const attributedCost = orderMachineCost ?? costPerHour * runtimeHours;
  const costPerMetre   = costPerMeter ?? (producedMeters > 0 ? attributedCost / producedMeters : null);

  const completionStr = estimatedCompletion
    ? new Date(estimatedCompletion).toLocaleString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <>
      {/* ── Dark backdrop — click to close ── */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* ── Slide-in panel (right side) ── */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Cpu size={18} className="text-slate-400" />
              <p className="text-lg font-bold text-slate-900">{machineId}</p>
              <StatusBadge status={status} />
            </div>
            <p className="text-sm text-slate-400 mt-0.5">{name}</p>
          </div>
          <button
            id={`btn-close-detail-${machineId}`}
            onClick={onClose}
            className="rounded-full p-2 hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Current order */}
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-400 mb-0.5">Active Order</p>
            <p className="text-base font-bold text-slate-800">
              {orderId ?? <span className="text-slate-400 italic font-normal">No active order</span>}
            </p>
          </div>

          {/* Production progress */}
          {targetMeters > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Production Progress</span>
                <span className="font-bold text-slate-800">{progress}%</span>
              </div>
              <ProgressBar value={progress} />
              <p className="text-xs text-slate-400 text-right">
                {Math.round(producedMeters)} m produced / {targetMeters} m target
              </p>
            </div>
          )}

          {/* Machine stats */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Machine Stats
            </p>
            <DetailRow
              icon={TrendingUp}
              label="Production Rate"
              value={productionRate > 0 ? `${productionRate} m / hr` : "—"}
            />
            <DetailRow
              icon={Zap}
              label="Efficiency"
              value={efficiency > 0 ? `${(efficiency * 100).toFixed(0)}%` : "—"}
              valueColour={
                efficiency >= 0.9 ? "text-green-600" :
                efficiency >= 0.7 ? "text-amber-600" : "text-slate-500"
              }
            />
            <DetailRow
              icon={Thermometer}
              label="Temperature"
              value={`${temperature}°C`}
              valueColour={temperature > 70 ? "text-red-600" : "text-slate-800"}
            />
            <DetailRow
              icon={Clock}
              label="Runtime Today"
              value={runtimeHours > 0 ? `${runtimeHours.toFixed(1)} hrs` : "—"}
            />
            <DetailRow
              icon={Clock}
              label="Est. Completion"
              value={completionStr}
            />
          </div>

          {/* Cost breakdown */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Cost Breakdown
            </p>
            <DetailRow
              icon={DollarSign}
              label="Cost / Hour"
              value={formatCurrency(costPerHour)}
            />
            <DetailRow
              icon={DollarSign}
              label="Order Cost So Far"
              value={formatCurrency(Math.round(attributedCost))}
            />
            <DetailRow
              icon={DollarSign}
              label="Cost / Metre"
              value={costPerMetre !== null ? `₹${costPerMetre.toFixed(2)}` : "—"}
            />
          </div>

          {/* Production today */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
            <p className="text-xs text-blue-400 mb-1">Production Today</p>
            <p className="text-2xl font-bold text-blue-700">
              {Math.round(producedMeters)} <span className="text-base font-normal">metres</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

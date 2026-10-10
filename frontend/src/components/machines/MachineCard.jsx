import { Thermometer, Zap, Clock, TrendingUp } from "lucide-react";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { progressPercent } from "../../utils/calculations.js";

// ─── Local sub-components ─────────────────────────────────────────────────────

/** Coloured status pill badge */
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

/** Thin progress bar — value 0-100 */
function ProgressBar({ value, label }) {
  const clamped = Math.min(100, Math.max(0, value));
  // Colour: green when done, amber when in progress, red when 0
  const barColour =
    clamped >= 100 ? "bg-green-500" : clamped > 0 ? "bg-blue-500" : "bg-slate-300";

  return (
    <div>
      {label && (
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{label}</span>
          <span className="font-semibold">{clamped.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${barColour}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

/** One row inside the info grid */
function InfoRow({ icon: Icon, label, value, valueColour = "text-slate-700" }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={14} className="text-slate-400 shrink-0" />}
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`ml-auto text-xs font-semibold ${valueColour}`}>{value}</span>
    </div>
  );
}

// ─── Main MachineCard ─────────────────────────────────────────────────────────

/**
 * MachineCard — clickable card showing one machine's live status.
 *
 * Props:
 *   machine — machine object (from ProductionPage state)
 *   onClick — called when user clicks the card (opens MachineDetailPanel)
 *
 * IMPORTANT: receives `machine` as a prop.
 * ProductionPage owns the state + setInterval so the Lead can swap in
 * a useMachineSocket hook without touching this component.
 */
export default function MachineCard({ machine, onClick }) {
  const {
    machineId, name, status, orderId,
    producedMeters, targetMeters, productionRate,
    temperature, efficiency, estimatedCompletion,
    costPerHour, runtimeHours, orderMachineCost, costPerMeter,
  } = machine;

  // Progress calculation
  const progress = progressPercent(producedMeters, targetMeters);

  // Live cost visibility
  // Prefer the server's numbers (orderMachineCost, costPerMeter); compute only for mock data
  const attributedCost = orderMachineCost ?? costPerHour * runtimeHours;
  const costPerMetre =
    costPerMeter ?? (producedMeters > 0 ? attributedCost / producedMeters : null);

  // Border colour matches machine status
  const borderColour = {
    RUNNING: "border-green-400",
    IDLE:    "border-amber-400",
    DOWN:    "border-red-400",
  }[status] ?? "border-slate-200";

  // Format estimated completion to a readable time
  const completionStr = estimatedCompletion
    ? new Date(estimatedCompletion).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div
      id={`machine-card-${machineId}`}
      onClick={onClick}
      className={`rounded-xl bg-white shadow-sm border-t-4 ${borderColour} p-5 cursor-pointer
                  hover:shadow-md transition-shadow space-y-4`}
    >
      {/* ── Header: ID + name + badge ── */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold text-slate-900">{machineId}</p>
          <p className="text-xs text-slate-400">{name}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* ── Current order ── */}
      <p className="text-sm text-slate-600">
        {orderId ? (
          <>
            Order:{" "}
            <span className="font-mono font-semibold text-slate-800">{orderId}</span>
          </>
        ) : (
          <span className="text-slate-400 italic">No active order</span>
        )}
      </p>

      {/* ── Progress bar (only meaningful when there's a target) ── */}
      {targetMeters > 0 && (
        <div>
          <ProgressBar
            value={progress}
            label={`${Math.round(producedMeters)} / ${targetMeters} m`}
          />
        </div>
      )}

      {/* ── Stats grid ── */}
      <div className="space-y-1.5">
        <InfoRow
          icon={TrendingUp}
          label="Production rate"
          value={productionRate > 0 ? `${productionRate} m/hr` : "—"}
        />
        <InfoRow
          icon={Zap}
          label="Efficiency"
          value={efficiency > 0 ? `${(efficiency * 100).toFixed(0)}%` : "—"}
          valueColour={
            efficiency >= 0.9 ? "text-green-600" :
            efficiency >= 0.7 ? "text-amber-600" : "text-slate-500"
          }
        />
        <InfoRow
          icon={Thermometer}
          label="Temperature"
          value={`${temperature}°C`}
          valueColour={temperature > 70 ? "text-red-600" : "text-slate-700"}
        />
        <InfoRow
          icon={Clock}
          label="Est. completion"
          value={completionStr}
        />
      </div>

      {/* ── Live cost visibility ── */}
      <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 space-y-1.5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Live Cost
        </p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Cost / hour</span>
          <span className="font-semibold text-slate-700">{formatCurrency(costPerHour)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Order cost so far</span>
          <span className="font-semibold text-slate-800">{formatCurrency(Math.round(attributedCost))}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Cost / metre</span>
          <span className="font-semibold text-slate-800">
            {costPerMetre !== null
              ? `₹${costPerMetre.toFixed(2)}`
              : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

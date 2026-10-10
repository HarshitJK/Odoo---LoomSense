import { formatCurrency } from "../../utils/formatCurrency.js";
import { AlertOctagon, TrendingDown } from "lucide-react";

/**
 * Cost impact of a FAILED / REWORK roll, exactly as calculated by the server
 * (POST /api/quality response): impact { additionalLabour, machineCost, materialLoss, total }
 * and the order margin before → after.
 */
export default function DefectCostImpact({ roll, impact, marginBefore, marginAfter }) {
  if (!roll || !impact) return null;
  const isFailed = roll.status === "FAILED";
  const hasMargins = marginBefore != null && marginAfter != null;
  const change = hasMargins ? Math.round((marginAfter - marginBefore) * 10) / 10 : null;

  return (
    <div
      className={`rounded-xl border p-5 transition-all shadow-sm ${
        isFailed
          ? "bg-red-50/60 border-red-300 ring-1 ring-red-300/40"
          : "bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/40"
      }`}
    >
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`p-2 rounded-lg ${
              isFailed ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
            }`}
          >
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-base font-bold ${isFailed ? "text-red-900" : "text-amber-950"}`}>
              Defect Cost Impact — {roll.rollId} on {roll.orderId}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Calculated by the server and already added to the order's rework cost
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full uppercase border ${
            isFailed
              ? "bg-red-100 text-red-800 border-red-200"
              : "bg-amber-100 text-amber-900 border-amber-200"
          }`}
        >
          {roll.status} Impact
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Affected Fabric", `${roll.affectedMeters}m`],
          ["Additional Labour", formatCurrency(impact.additionalLabour)],
          ["Machine Cost", formatCurrency(impact.machineCost)],
          ["Material Loss", formatCurrency(impact.materialLoss)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white/80 p-3 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">{label}</span>
            <span className="text-base font-bold text-slate-800 mt-1 block">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-4 bg-white/60 p-3.5 rounded-lg">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Financial Impact</span>
          <p className={`text-2xl font-black mt-0.5 ${isFailed ? "text-red-700" : "text-amber-800"}`}>
            {formatCurrency(impact.total)}
          </p>
        </div>

        {hasMargins && (
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-500 uppercase block">Order Profit Margin</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base line-through text-slate-400 font-semibold">{marginBefore}%</span>
              <span className="text-xs text-slate-400">→</span>
              <span className="text-xl font-bold text-red-600">{marginAfter}%</span>
              {change < 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600 bg-red-100/80 px-2 py-0.5 rounded">
                  <TrendingDown className="w-3 h-3" />
                  {change}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

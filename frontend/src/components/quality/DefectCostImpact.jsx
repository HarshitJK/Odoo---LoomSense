import { formatCurrency } from "../../utils/formatCurrency.js";
import { AlertOctagon, TrendingDown } from "lucide-react";

export default function DefectCostImpact({ affectedMeters = 120, status = "REWORK" }) {
  const labourCost = 1100;
  const machineCost = 680;
  const materialLoss = 2400;
  const totalImpact = labourCost + machineCost + materialLoss; // 4180

  const isFailed = status === "FAILED";

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
            <h3
              className={`text-base font-bold ${
                isFailed ? "text-red-900" : "text-amber-950"
              }`}
            >
              Defect Cost Impact — Financial Loss Breakdown
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Live profit leakage detection connecting fabric quality defect to order margin
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
          {status} Impact
        </span>
      </div>

      {/* Grid of cost breakdowns */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/80 p-3 rounded-lg border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Affected Fabric
          </span>
          <span className="text-base font-bold text-slate-800 mt-1 block">
            {affectedMeters || 120}m
          </span>
        </div>

        <div className="bg-white/80 p-3 rounded-lg border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Additional Labour
          </span>
          <span className="text-base font-bold text-slate-800 mt-1 block">
            {formatCurrency(labourCost)}
          </span>
        </div>

        <div className="bg-white/80 p-3 rounded-lg border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Machine Cost
          </span>
          <span className="text-base font-bold text-slate-800 mt-1 block">
            {formatCurrency(machineCost)}
          </span>
        </div>

        <div className="bg-white/80 p-3 rounded-lg border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Material Loss
          </span>
          <span className="text-base font-bold text-slate-800 mt-1 block">
            {formatCurrency(materialLoss)}
          </span>
        </div>
      </div>

      {/* Total Impact and Margin Change */}
      <div className="mt-4 pt-4 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-4 bg-white/60 p-3.5 rounded-lg">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase">
            Total Financial Impact
          </span>
          <p
            className={`text-2xl font-black mt-0.5 ${
              isFailed ? "text-red-700" : "text-amber-800"
            }`}
          >
            {formatCurrency(totalImpact)}
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs font-semibold text-slate-500 uppercase block">
            Order Profit Margin
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-base line-through text-slate-400 font-semibold">26.3%</span>
            <span className="text-xs text-slate-400">→</span>
            <span className="text-xl font-bold text-red-600">23.8%</span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600 bg-red-100/80 px-2 py-0.5 rounded">
              <TrendingDown className="w-3 h-3" />
              -2.5%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

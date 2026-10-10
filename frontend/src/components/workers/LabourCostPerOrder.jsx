import { calculateLabourCostPerOrder } from "./wageCalculations.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { Layers, Award } from "lucide-react";

export default function LabourCostPerOrder({ workers = [] }) {
  const orderBreakdowns = calculateLabourCostPerOrder(workers);

  // Find the highest cost among orders
  const maxCost = orderBreakdowns.reduce(
    (max, item) => (item.totalCost > max ? item.totalCost : max),
    0
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Labour Cost per Order (Profit Intelligence)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Directly maps workforce hours and overtime costs to individual customer orders
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {orderBreakdowns.map((item) => {
          const isHighest = item.totalCost === maxCost && maxCost > 0;

          return (
            <div
              key={item.orderId}
              className={`rounded-xl p-4 transition-all border ${
                isHighest
                  ? "bg-amber-50/40 border-amber-300 ring-1 ring-amber-300/50 shadow-sm"
                  : "bg-slate-50/60 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm tracking-wide">
                  {item.orderId}
                </span>
                {isHighest && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                    <Award className="w-3 h-3" />
                    Highest Cost
                  </span>
                )}
              </div>

              {/* Required format display: ORD-104 · 7 workers · 46.5h · ₹8,420 */}
              <div className="mt-3 text-xs text-slate-600 font-mono bg-white px-3 py-2 rounded-lg border border-slate-200/80">
                <span className="font-semibold text-slate-900">{item.orderId}</span>
                <span className="mx-1.5 text-slate-400">·</span>
                <span>{item.distinctWorkersCount} workers</span>
                <span className="mx-1.5 text-slate-400">·</span>
                <span>{item.totalHours}h</span>
                <span className="mx-1.5 text-slate-400">·</span>
                <span className="font-bold text-slate-900">{formatCurrency(item.totalCost)}</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-200/60">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-slate-400">Workers</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{item.distinctWorkersCount}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-slate-400">Hours</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{item.totalHours}h</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-slate-400">Labour Cost</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{formatCurrency(item.totalCost)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

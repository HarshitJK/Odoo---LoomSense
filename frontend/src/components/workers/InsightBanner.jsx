import { AlertTriangle } from "lucide-react";

export default function InsightBanner() {
  return (
    <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 flex items-start sm:items-center gap-3">
      <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
        <AlertTriangle className="w-5 h-5 text-amber-700" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-900">Workforce Intelligence Insight</p>
        <p className="text-xs text-amber-800 mt-0.5">
          ORD-091 consumed 32% more labour hours than similar orders. Additional cost ₹5,800.
        </p>
      </div>
      <span className="hidden sm:inline-block text-[11px] font-semibold uppercase tracking-wider bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded">
        Warning
      </span>
    </div>
  );
}

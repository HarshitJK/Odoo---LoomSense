import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "../../utils/formatCurrency.js";

/**
 * Labour insight built from GET /api/finance/profit-leakage:
 * shows the order's overtime / extra-labour-hours leaks. Renders nothing if there are none.
 */
export default function InsightBanner({ leakage }) {
  const labourLeaks = (leakage?.leaks ?? []).filter((l) => l.label === "Overtime" || l.label === "Extra labour hours");
  if (labourLeaks.length === 0) return null;
  const total = labourLeaks.reduce((sum, l) => sum + l.amount, 0);

  return (
    <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 flex items-start sm:items-center gap-3">
      <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
        <AlertTriangle className="w-5 h-5 text-amber-700" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-900">Workforce Intelligence Insight</p>
        <p className="text-xs text-amber-800 mt-0.5">
          {leakage.orderId} lost {formatCurrency(total)} to labour overruns (
          {labourLeaks.map((l) => `${l.label.toLowerCase()} ${formatCurrency(l.amount)}`).join(", ")}).
        </p>
      </div>
      <span className="hidden sm:inline-block text-[11px] font-semibold uppercase tracking-wider bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded">
        Warning
      </span>
    </div>
  );
}

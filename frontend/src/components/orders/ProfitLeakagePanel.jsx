import { AlertTriangle, TrendingDown } from "lucide-react";
import { formatCurrency } from "../../utils/formatCurrency.js";

/**
 * ProfitLeakagePanel — standout card showing why ORD091 underperformed.
 *
 * Props:
 *   leakage — { orderId, expectedMargin, actualMargin, leaks: [{label, amount}], recommendation }
 *             (from mocks/finance.js profitLeakage)
 */
export default function ProfitLeakagePanel({ leakage }) {
  const { orderId, expectedMargin, actualMargin, leaks, recommendation } = leakage;

  // Total money lost due to leakages
  const totalLeakage = leaks.reduce((sum, l) => sum + l.amount, 0);

  // Margin drop = expected minus actual
  const marginDrop = (expectedMargin - actualMargin).toFixed(1);

  return (
    <div className="rounded-xl bg-white shadow-sm border-l-4 border-red-500 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-red-50 border-b border-red-100">
        <TrendingDown className="text-red-500 shrink-0" size={20} />
        <div>
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">
            Profit Leakage Detected
          </p>
          <p className="text-base font-bold text-slate-800">Order {orderId}</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Margin comparison — the key visual */}
        <div className="flex items-center gap-4">
          {/* Expected margin box */}
          <div className="flex-1 rounded-lg bg-green-50 border border-green-200 p-3 text-center">
            <p className="text-xs text-green-600 font-medium mb-1">Expected Margin</p>
            <p className="text-3xl font-bold text-green-700">{expectedMargin}%</p>
          </div>

          {/* Arrow + drop indicator */}
          <div className="flex flex-col items-center">
            <span className="text-red-500 font-bold text-lg">→</span>
            <span className="text-xs text-red-500 font-semibold mt-0.5">
              −{marginDrop}pp
            </span>
          </div>

          {/* Actual margin box */}
          <div className="flex-1 rounded-lg bg-red-50 border border-red-200 p-3 text-center">
            <p className="text-xs text-red-600 font-medium mb-1">Actual Margin</p>
            <p className="text-3xl font-bold text-red-600">{actualMargin}%</p>
          </div>
        </div>

        {/* Leakage line items */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Leakage Breakdown
          </p>
          <ul className="space-y-2">
            {leaks.map((leak) => (
              <li
                key={leak.label}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2"
              >
                <span className="text-sm text-slate-700">{leak.label}</span>
                <span className="text-sm font-semibold text-red-600">
                  − {formatCurrency(leak.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Total leakage */}
        <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">Total Profit Leakage</span>
          <span className="text-base font-bold text-red-600">
            − {formatCurrency(totalLeakage)}
          </span>
        </div>

        {/* Recommendation callout — amber */}
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">
              Recommendation
            </p>
            <p className="text-sm text-amber-800">{recommendation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

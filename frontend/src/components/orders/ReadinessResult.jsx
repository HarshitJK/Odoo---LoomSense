import Notice from "../common/Notice.jsx";
import { formatCurrency as money } from "../../utils/formatCurrency.js";
import { formatKg, formatPercent } from "../../utils/format.js";

/**
 * Answer to "Can we start this order?": one clear sentence first, then the four numbers that matter.
 * result: the server's readiness answer { status, requiredYarnKg, availableKg, shortageKg,
 *         projectedProfit, projectedMargin, targetMargin, warning, ... }
 */
export default function ReadinessResult({ result: r }) {
  if (!r) return null;
  const ready = r.status === "MATERIAL_READY";
  const rows = [
    ["Yarn needed", formatKg(r.requiredYarnKg)],
    ["Yarn in stock", formatKg(r.availableKg)],
    ["Expected profit", money(r.projectedProfit)],
    ["Expected margin", formatPercent(r.projectedMargin)],
  ];

  return (
    <div className="space-y-3">
      <Notice tone={ready ? "success" : "error"}>
        <p className="font-medium">{ready ? "Material ready" : `Not enough material: ${formatKg(r.shortageKg)} short`}</p>
      </Notice>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>

      {r.warning && (
        <p className="text-sm text-amber-700">
          Expected margin is below the factory target of {formatPercent(r.targetMargin, 0)}.
        </p>
      )}
    </div>
  );
}

import Card from "../common/Card.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { marginClass } from "../../utils/calculations.js";
import { formatPercent } from "../../utils/format.js";

/**
 * Where profit was lost, for the order with the lowest margin.
 * leakage: { orderId, expectedMargin, actualMargin, leaks: [{ label, amount }], recommendation }
 */
export default function ProfitLeakagePanel({ leakage }) {
  const { orderId, expectedMargin, actualMargin, leaks = [], recommendation } = leakage;

  return (
    <Card title="Where profit was lost">
      <p className="mt-2 text-sm text-gray-600">
        Order {orderId} made <span className={`font-medium ${marginClass(actualMargin)}`}>{formatPercent(actualMargin)}</span>{" "}
        against {formatPercent(expectedMargin)} expected.
      </p>

      {leaks.length > 0 ? (
        <ul className="mt-3 divide-y divide-gray-200 border-y border-gray-200">
          {leaks.map((leak) => (
            <li key={leak.label} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
              <span className="text-gray-900">{leak.label}</span>
              <span className="tabular-nums text-gray-900">{formatCurrency(leak.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-600">No single cause stands out for this order.</p>
      )}

      {recommendation && <p className="mt-3 text-sm text-gray-900">{recommendation}</p>}
    </Card>
  );
}

import { formatCurrency } from "../../utils/formatCurrency.js";
import { trueOrderCost } from "../../utils/calculations.js";

// Returns Tailwind classes based on margin value
function marginColour(margin) {
  if (margin === null || margin === undefined) return "bg-slate-100 text-slate-500";
  if (margin >= 25) return "bg-green-100 text-green-700";
  if (margin >= 15) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

/**
 * OrderProfitTable — shows all orders with revenue, cost, profit, and margin pill.
 *
 * Props:
 *   orders — array of order objects (from mocks/orders.js)
 */
export default function OrderProfitTable({ orders }) {
  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Order Profit Summary
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 text-left font-medium">Order ID</th>
              <th className="px-5 py-3 text-left font-medium">Buyer</th>
              <th className="px-5 py-3 text-right font-medium">Revenue</th>
              <th className="px-5 py-3 text-right font-medium">Total Cost</th>
              <th className="px-5 py-3 text-right font-medium">Profit</th>
              <th className="px-5 py-3 text-center font-medium">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => {
              // Compute total cost from the costs object (single source of truth)
              const totalCost = trueOrderCost(order.costs);
              const hasData = order.profit !== null;

              return (
                <tr key={order.orderId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-mono font-semibold text-slate-800">
                    {order.orderId}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{order.buyerName}</td>
                  <td className="px-5 py-3 text-right text-slate-700">
                    {formatCurrency(order.revenue)}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-700">
                    {hasData ? formatCurrency(totalCost) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">
                    {hasData ? formatCurrency(order.profit) : "—"}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {hasData ? (
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${marginColour(order.margin)}`}
                      >
                        {order.margin}%
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">Pending</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

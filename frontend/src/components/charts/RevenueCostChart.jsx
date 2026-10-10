import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "../../utils/formatCurrency.js";

// Tooltip formatter — shows ₹ amounts on hover
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-sm">
      <p className="mb-2 font-semibold text-slate-700">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

/**
 * RevenueCostChart — Grouped bar chart showing Revenue, Cost, and Profit
 * per month. Profit is computed as revenue − cost inside this component.
 *
 * Props:
 *   data — array of { month, revenue, cost }  (from mocks/finance.js monthlyTrend)
 */
export default function RevenueCostChart({ data }) {
  // Add a "profit" field to each month for the third bar
  const chartData = data.map((d) => ({
    ...d,
    profit: d.revenue - d.cost,
  }));

  return (
    <div className="rounded-xl bg-white shadow-sm p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">
        Revenue vs Cost vs Profit — Last 4 Months
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 13, fill: "#64748b" }} />
          <YAxis
            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="cost" name="Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="profit" name="Profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

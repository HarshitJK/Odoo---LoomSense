import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "../../utils/formatCurrency.js";

// One distinct colour per cost category
const COLOURS = {
  "Raw Material": "#3b82f6",  // blue
  Labour: "#f59e0b",          // amber
  Machine: "#8b5cf6",         // violet
  Rework: "#ef4444",          // red
  Other: "#6b7280",           // grey
};

// Custom tooltip shown on hover
function CustomTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-sm">
      <p className="font-semibold" style={{ color: item.payload.fill }}>
        {item.name}
      </p>
      <p className="text-slate-600">{formatCurrency(item.value)}</p>
      <p className="text-slate-400">{item.payload.percent}%</p>
    </div>
  );
}

/**
 * CostBreakdownChart — Donut pie chart of the cost breakdown.
 *
 * Props:
 *   breakdown — { rawMaterial, labour, machine, rework, other }
 *               (from mocks/finance.js monthlySummary.breakdown)
 */
export default function CostBreakdownChart({ breakdown }) {
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);

  // Build recharts-compatible array with label and percent
  const data = [
    { name: "Raw Material", value: breakdown.rawMaterial },
    { name: "Labour",       value: breakdown.labour },
    { name: "Machine",      value: breakdown.machine },
    { name: "Rework",       value: breakdown.rework },
    { name: "Other",        value: breakdown.other },
  ].map((d) => ({
    ...d,
    percent: total ? Math.round((d.value / total) * 100) : 0,
    fill: COLOURS[d.name],
  }));

  return (
    <div className="rounded-xl bg-white shadow-sm p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">
        Cost Breakdown — Current Month
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}   // donut hole
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={10}
            formatter={(value) => (
              <span className="text-sm text-slate-600">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

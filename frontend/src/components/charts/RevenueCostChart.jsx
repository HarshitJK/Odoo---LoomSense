import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";
import Card from "../common/Card.jsx";

const ACCENT = "#1d4ed8"; // blue-700
const SECONDARY = "#9ca3af"; // gray-400
const GRID = "#e5e7eb"; // gray-200
const TEXT = "#4b5563"; // gray-600

/**
 * Revenue against cost, one pair of bars per month (GET /api/finance/monthly).
 * data: [{ label, revenue, cost }]
 */
export default function RevenueCostChart({ data }) {
  return (
    <Card title="Revenue and cost by month (₹)">
      <div className="mt-2" role="img" aria-label="Bar chart of revenue and cost for each month">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: TEXT }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis
              width={56}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12, fill: TEXT }}
              tickLine={false}
              axisLine={false}
            />
            <Legend wrapperStyle={{ fontSize: 13 }} iconType="square" iconSize={10} />
            <Bar dataKey="revenue" name="Revenue" fill={ACCENT} isAnimationActive={false} />
            <Bar dataKey="cost" name="Cost" fill={SECONDARY} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

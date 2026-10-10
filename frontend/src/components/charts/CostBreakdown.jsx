import Card from "../common/Card.jsx";
import ProgressBar from "../common/ProgressBar.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { formatPercent } from "../../utils/format.js";

const ROWS = [
  ["rawMaterial", "Raw material"],
  ["labour", "Labour"],
  ["machine", "Machine"],
  ["rework", "Rework"],
  ["other", "Other"],
];

/** Where the money went: a simple horizontal bar list, largest bar full width. */
export default function CostBreakdown({ breakdown }) {
  const rows = ROWS.map(([key, label]) => ({ label, value: breakdown?.[key] ?? 0 })).filter(
    (r) => r.value > 0 || r.label !== "Other"
  );
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const largest = Math.max(...rows.map((r) => r.value), 1);

  return (
    <Card title="Cost breakdown">
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.label}>
            <ProgressBar
              value={(r.value / largest) * 100}
              label={r.label}
              detail={`${formatCurrency(r.value)} (${formatPercent(total ? (r.value / total) * 100 : 0, 0)})`}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

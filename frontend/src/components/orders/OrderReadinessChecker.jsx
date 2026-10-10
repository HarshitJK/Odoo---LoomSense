import { useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { formatCurrency } from "../../utils/formatCurrency.js";

// ─── Constants (easy to find and swap later) ──────────────────────────────────
const YARN_CONVERSION_RATE = 0.59;   // kg of yarn required per metre of fabric
const LABOUR_COST_PER_METRE = 12.25; // ₹ per metre
const MACHINE_COST_PER_METRE = 9.2;  // ₹ per metre
const OTHER_COST_PER_METRE = 2.0;    // ₹ per metre
const TARGET_MARGIN_PERCENT = 25;    // factory target margin

// ─── Readiness Logic ──────────────────────────────────────────────────────────
// Kept here so the Lead can later swap with: GET /api/orders/{id}/readiness

/**
 * checkReadiness — pure function, no side effects.
 * Returns { requiredKg, availableKg, shortage, canStart, avgCostPerKg }
 */
function checkReadiness(fabricType, colour, metres, inventory) {
  const requiredKg = metres * YARN_CONVERSION_RATE;

  // Match batches where material contains the fabric type word AND colour matches
  const matchingBatches = inventory.filter(
    (batch) =>
      batch.material.toLowerCase().includes(fabricType.toLowerCase()) &&
      batch.colour.toLowerCase() === colour.toLowerCase()
  );

  const availableKg = matchingBatches.reduce((sum, b) => sum + b.quantityKg, 0);
  const shortage = Math.max(0, requiredKg - availableKg);
  const canStart = shortage === 0;

  // Average cost per kg across matching stock (for profit calculation)
  const avgCostPerKg =
    matchingBatches.length > 0
      ? matchingBatches.reduce((sum, b) => sum + b.costPerKg, 0) /
        matchingBatches.length
      : 0;

  return { requiredKg, availableKg, shortage, canStart, avgCostPerKg };
}

/**
 * calcProjectedProfit — pure function.
 * Returns { materialCost, labourCost, machineCost, otherCost, totalCost, profit, margin }
 */
function calcProjectedProfit(requiredKg, metres, revenue, avgCostPerKg) {
  const materialCost = requiredKg * avgCostPerKg;
  const labourCost   = metres * LABOUR_COST_PER_METRE;
  const machineCost  = metres * MACHINE_COST_PER_METRE;
  const otherCost    = metres * OTHER_COST_PER_METRE;
  const totalCost    = materialCost + labourCost + machineCost + otherCost;
  const profit       = revenue - totalCost;
  const margin       = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { materialCost, labourCost, machineCost, otherCost, totalCost, profit, margin };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Green or red banner shown after checking */
function ReadinessBanner({ canStart, requiredKg, availableKg, shortage }) {
  if (canStart) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-300 px-5 py-4">
        <CheckCircle className="text-green-600 shrink-0" size={28} />
        <div>
          <p className="text-lg font-bold text-green-700">MATERIAL READY</p>
          <p className="text-sm text-green-600">
            Sufficient stock available — production can begin immediately.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-300 px-5 py-4">
      <XCircle className="text-red-600 shrink-0" size={28} />
      <div>
        <p className="text-lg font-bold text-red-700">CANNOT START FULL PRODUCTION</p>
        <p className="text-sm text-red-600">
          Shortage of <strong>{shortage.toFixed(0)} kg</strong>. Available:{" "}
          {availableKg.toFixed(0)} kg / Required: {requiredKg.toFixed(0)} kg.
        </p>
      </div>
    </div>
  );
}

/** Quantity row used inside the numbers grid */
function StatRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{value}</span>
    </div>
  );
}

/** Profit-Aware Acceptance panel shown below the banner */
function ProfitPanel({ projections, margin }) {
  const { materialCost, labourCost, machineCost, otherCost, totalCost, profit } = projections;
  const meetsTarget = margin >= TARGET_MARGIN_PERCENT;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        Profit-Aware Acceptance
      </p>

      {/* Cost breakdown */}
      <div>
        <StatRow label="Projected Material Cost" value={formatCurrency(Math.round(materialCost))} />
        <StatRow label="Labour Cost"             value={formatCurrency(Math.round(labourCost))} />
        <StatRow label="Machine Cost"            value={formatCurrency(Math.round(machineCost))} />
        <StatRow label="Other Cost"              value={formatCurrency(Math.round(otherCost))} />
        <div className="flex justify-between items-center py-2 mt-1">
          <span className="text-sm font-semibold text-slate-700">Total Projected Cost</span>
          <span className="text-sm font-bold text-slate-900">{formatCurrency(Math.round(totalCost))}</span>
        </div>
      </div>

      {/* Profit & margin highlight */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Projected Profit</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(Math.round(profit))}</p>
        </div>
        <div
          className={`rounded-lg border p-3 text-center ${
            meetsTarget
              ? "bg-green-50 border-green-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <p className="text-xs text-slate-400 mb-1">Projected Margin</p>
          <p
            className={`text-xl font-bold ${
              meetsTarget ? "text-green-700" : "text-amber-700"
            }`}
          >
            {margin.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Target verdict */}
      {meetsTarget ? (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <CheckCircle className="text-green-600 shrink-0" size={16} />
          <p className="text-sm text-green-700 font-medium">
            Meets factory target of {TARGET_MARGIN_PERCENT}%
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
          <p className="text-sm text-amber-700 font-medium">
            Margin below factory target of {TARGET_MARGIN_PERCENT}%. Consider renegotiating price or reducing costs.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * OrderReadinessChecker — form card that checks material availability
 * and projects profit before accepting a new order.
 *
 * Props:
 *   inventory — array of batch objects (from mocks/inventory.js)
 *               The Lead can later replace this prop with API-fetched data.
 */
export default function OrderReadinessChecker({ inventory }) {
  // Form state — prefilled with the Cotton / Navy Blue / 2000m / ₹180000 demo values
  const [fabricType, setFabricType]     = useState("Cotton");
  const [colour, setColour]             = useState("Navy Blue");
  const [metres, setMetres]             = useState("2000");
  const [revenue, setRevenue]           = useState("180000");

  // Results state — null means "not checked yet"
  const [result, setResult] = useState(null);

  function handleCheck() {
    const metresNum  = parseFloat(metres);
    const revenueNum = parseFloat(revenue);

    // Guard against empty / non-numeric input
    if (!fabricType || !colour || isNaN(metresNum) || metresNum <= 0) return;

    const readiness   = checkReadiness(fabricType, colour, metresNum, inventory);
    const projections = calcProjectedProfit(
      readiness.requiredKg,
      metresNum,
      isNaN(revenueNum) ? 0 : revenueNum,
      readiness.avgCostPerKg
    );

    setResult({ ...readiness, projections, margin: projections.margin });
  }

  // Input field style shared across all inputs
  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-300";

  return (
    <div className="rounded-xl bg-white shadow-sm p-5 space-y-5">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
        Order Readiness Checker
      </h2>

      {/* ── Form inputs ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Fabric Type</label>
          <input
            id="input-fabric-type"
            className={inputCls}
            value={fabricType}
            onChange={(e) => { setFabricType(e.target.value); setResult(null); }}
            placeholder="e.g. Cotton"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Colour</label>
          <input
            id="input-colour"
            className={inputCls}
            value={colour}
            onChange={(e) => { setColour(e.target.value); setResult(null); }}
            placeholder="e.g. Navy Blue"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Quantity (metres)</label>
          <input
            id="input-metres"
            className={inputCls}
            type="number"
            min="1"
            value={metres}
            onChange={(e) => { setMetres(e.target.value); setResult(null); }}
            placeholder="e.g. 2000"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Expected Revenue (₹)</label>
          <input
            id="input-revenue"
            className={inputCls}
            type="number"
            min="0"
            value={revenue}
            onChange={(e) => { setRevenue(e.target.value); setResult(null); }}
            placeholder="e.g. 180000"
          />
        </div>
      </div>

      {/* ── Check button ── */}
      <button
        id="btn-check-readiness"
        onClick={handleCheck}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold
                   text-white hover:bg-blue-700 transition-colors"
      >
        Check Readiness
        <ChevronRight size={16} />
      </button>

      {/* ── Results (shown after button click) ── */}
      {result && (
        <div className="space-y-4">
          {/* Big banner */}
          <ReadinessBanner
            canStart={result.canStart}
            requiredKg={result.requiredKg}
            availableKg={result.availableKg}
            shortage={result.shortage}
          />

          {/* Quantity numbers row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Required Yarn", value: `${result.requiredKg.toFixed(0)} kg`, colour: "text-slate-800" },
              { label: "Available Stock", value: `${result.availableKg.toFixed(0)} kg`, colour: "text-green-700" },
              {
                label: "Shortage",
                value: result.shortage > 0 ? `${result.shortage.toFixed(0)} kg` : "None",
                colour: result.shortage > 0 ? "text-red-600" : "text-green-700",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center"
              >
                <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                <p className={`text-lg font-bold ${item.colour}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Profit-Aware panel */}
          <ProfitPanel projections={result.projections} margin={result.margin} />
        </div>
      )}
    </div>
  );
}

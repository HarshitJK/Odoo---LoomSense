// Mirrors the formulas in context.md (also implemented in backend/app/services).

export function trueOrderCost(costs = {}) {
  const { rawMaterial = 0, labour = 0, machine = 0, rework = 0, other = 0 } = costs;
  return rawMaterial + labour + machine + rework + other;
}

export function profit(revenue, cost) {
  return revenue - cost;
}

export function marginPercent(revenue, profitValue) {
  return revenue ? Math.round((profitValue / revenue) * 1000) / 10 : 0;
}

export function progressPercent(produced, target) {
  return target ? Math.min(100, Math.round((produced / target) * 100)) : 0;
}

/** Text colour for a margin: green at 25% and above, amber from 15 to 25%, red below 15%. */
export function marginClass(margin) {
  if (margin === null || margin === undefined || Number.isNaN(Number(margin))) return "text-gray-500";
  if (margin >= 25) return "text-green-700";
  if (margin >= 15) return "text-amber-700";
  return "text-red-700";
}

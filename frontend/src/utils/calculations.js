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

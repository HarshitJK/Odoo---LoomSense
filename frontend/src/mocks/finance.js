// Mock financial summary for the current month (October 2026)
export const monthlySummary = {
  revenue: 540000,
  totalCost: 412000,
  profit: 128000,
  margin: 23.7,
  breakdown: {
    rawMaterial: 210000,
    labour: 92000,
    machine: 61000,
    rework: 24000,
    other: 25000,
  },
};

// Last 4 months of revenue vs cost for the trend chart
export const monthlyTrend = [
  { month: "Jul", revenue: 410000, cost: 330000 },
  { month: "Aug", revenue: 470000, cost: 365000 },
  { month: "Sep", revenue: 505000, cost: 390000 },
  { month: "Oct", revenue: 540000, cost: 412000 },
];

// Profit leakage analysis for the worst-performing order
export const profitLeakage = {
  orderId: "ORD091",
  expectedMargin: 28,
  actualMargin: 17,
  leaks: [
    { label: "Excess yarn consumption", amount: 5200 },
    { label: "Overtime", amount: 3800 },
    { label: "Rework", amount: 5200 },
  ],
  recommendation: "Review yarn wastage and inspect Machine W03.",
};

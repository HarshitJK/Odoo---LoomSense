// 6 orders covering: ORD104, ORD091, at least one red (<15%), one green (>=25%)
// profit = revenue - (rawMaterial + labour + machine + rework + other)
// margin = Math.round(profit / revenue * 1000) / 10

export const orders = [
  {
    // Green order — margin 27.5% (≥ 25%) ← most profitable
    orderId: "ORD102",
    buyerName: "Lakshmi Fabrics",
    fabricType: "Cotton",
    colour: "White",
    quantityMeters: 1800,
    producedMeters: 1800,
    status: "COMPLETED",
    machineId: "W04",
    deadline: "2026-10-02T18:00:00",
    revenue: 160000,
    costs: { rawMaterial: 72000, labour: 22000, machine: 14000, rework: 2000, other: 6000 },
    // totalCost = 116000; profit = 44000; margin = 44000/160000*100 = 27.5
    profit: 44000,
    margin: 27.5,
  },
  {
    // ORD104 — margin 24.9% (amber), as specified in the prompt
    orderId: "ORD104",
    buyerName: "ABC Garments",
    fabricType: "Cotton",
    colour: "Navy Blue",
    quantityMeters: 2000,
    producedMeters: 1460,
    status: "WEAVING",
    machineId: "W01",
    deadline: "2026-10-15T18:00:00",
    revenue: 180000,
    costs: { rawMaterial: 82000, labour: 24500, machine: 18400, rework: 6200, other: 4000 },
    // totalCost = 135100; profit = 44900; margin = 44900/180000*100 ≈ 24.9
    profit: 44900,
    margin: 24.9,
  },
  {
    // ORD103 — margin 20.8% (amber)
    orderId: "ORD103",
    buyerName: "Sunrise Textiles",
    fabricType: "Cotton",
    colour: "White",
    quantityMeters: 1500,
    producedMeters: 820,
    status: "WEAVING",
    machineId: "W02",
    deadline: "2026-10-18T12:00:00",
    revenue: 120000,
    costs: { rawMaterial: 60000, labour: 18000, machine: 12000, rework: 2000, other: 3000 },
    // totalCost = 95000; profit = 25000; margin = 25000/120000*100 ≈ 20.8
    profit: 25000,
    margin: 20.8,
  },
  {
    // ORD091 — actual margin 17% (red, profit leakage order as per spec)
    // revenue 100000; 17% margin → profit = 17000; total cost = 83000
    orderId: "ORD091",
    buyerName: "Metro Apparel",
    fabricType: "Polyester",
    colour: "Black",
    quantityMeters: 1200,
    producedMeters: 1200,
    status: "COMPLETED",
    machineId: "W03",
    deadline: "2026-10-05T18:00:00",
    revenue: 100000,
    costs: { rawMaterial: 48000, labour: 16000, machine: 9000, rework: 5200, other: 4800 },
    // totalCost = 83000; profit = 17000; margin = 17000/100000*100 = 17.0
    profit: 17000,
    margin: 17.0,
  },
  {
    // ORD098 — margin 12% (red, < 15%) ← least profitable
    orderId: "ORD098",
    buyerName: "Delta Weavers",
    fabricType: "Silk",
    colour: "Maroon",
    quantityMeters: 800,
    producedMeters: 800,
    status: "COMPLETED",
    machineId: "W05",
    deadline: "2026-09-28T18:00:00",
    revenue: 80000,
    costs: { rawMaterial: 42000, labour: 14000, machine: 8000, rework: 4400, other: 2000 },
    // totalCost = 70400; profit = 9600; margin = 9600/80000*100 = 12.0
    profit: 9600,
    margin: 12.0,
  },
  {
    // ORD105 — pending, no production yet
    orderId: "ORD105",
    buyerName: "ABC Garments",
    fabricType: "Cotton",
    colour: "Red",
    quantityMeters: 1000,
    producedMeters: 0,
    status: "PENDING",
    machineId: null,
    deadline: "2026-10-25T18:00:00",
    revenue: 90000,
    costs: { rawMaterial: 0, labour: 0, machine: 0, rework: 0, other: 0 },
    profit: null,
    margin: null,
  },
];

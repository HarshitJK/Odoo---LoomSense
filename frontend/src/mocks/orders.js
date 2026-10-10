export const orders = [
  {
    orderId: "ORD104", buyerId: "BUY001", buyerName: "ABC Garments", fabricType: "Cotton", colour: "Navy Blue",
    quantityMeters: 2000, producedMeters: 1460, status: "WEAVING", machineId: "W01",
    deadline: "2026-10-15T18:00:00", revenue: 180000,
    costs: { rawMaterial: 82000, labour: 24500, machine: 18400, rework: 6200, other: 4000 },
    profit: 44900, margin: 24.9,
  },
  {
    orderId: "ORD103", buyerId: "BUY002", buyerName: "Sunrise Textiles", fabricType: "Cotton", colour: "White",
    quantityMeters: 1500, producedMeters: 820, status: "WEAVING", machineId: "W02",
    deadline: "2026-10-18T12:00:00", revenue: 120000,
    costs: { rawMaterial: 60000, labour: 18000, machine: 12000, rework: 2000, other: 3000 },
    profit: 25000, margin: 20.8,
  },
  {
    orderId: "ORD091", buyerId: "BUY003", buyerName: "Metro Apparel", fabricType: "Polyester", colour: "Black",
    quantityMeters: 1200, producedMeters: 1200, status: "COMPLETED", machineId: "W03",
    deadline: "2026-10-05T18:00:00", revenue: 100000,
    costs: { rawMaterial: 52000, labour: 19800, machine: 9000, rework: 5200, other: 3000 },
    profit: 11000, margin: 11.0,
  },
  {
    orderId: "ORD105", buyerId: "BUY001", buyerName: "ABC Garments", fabricType: "Cotton", colour: "Red",
    quantityMeters: 1000, producedMeters: 0, status: "PENDING", machineId: null,
    deadline: "2026-10-25T18:00:00", revenue: 90000,
    costs: { rawMaterial: 0, labour: 0, machine: 0, rework: 0, other: 0 },
    profit: null, margin: null,
  },
];

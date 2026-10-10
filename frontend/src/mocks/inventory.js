// 6 yarn batches — costPerKg ₹65-75 for cotton so 1,180 kg ≈ ₹82,000 (matching ORD104)
// LOW STOCK threshold: quantityKg < 300  →  YB84 and YB87 trigger it
// Cotton + Navy Blue total = 950 kg (only YB82) → demo shows shortage of 230 kg for 2000m order

export const inventory = [
  {
    // The key batch — Cotton Navy Blue for ORD104
    // 1,180 kg required × ₹70/kg = ₹82,600 ≈ ORD104 rawMaterial cost
    batchId: "YB82",
    material: "Cotton Yarn",
    colour: "Navy Blue",
    quantityKg: 950,
    costPerKg: 70,
    supplier: "Supplier A",
  },
  {
    batchId: "YB83",
    material: "Cotton Yarn",
    colour: "White",
    quantityKg: 1200,
    costPerKg: 68,
    supplier: "Supplier B",
  },
  {
    // LOW STOCK — below 300 kg
    batchId: "YB84",
    material: "Polyester Yarn",
    colour: "Black",
    quantityKg: 210,
    costPerKg: 55,
    supplier: "Supplier C",
  },
  {
    batchId: "YB85",
    material: "Silk Yarn",
    colour: "Maroon",
    quantityKg: 620,
    costPerKg: 145,
    supplier: "Supplier D",
  },
  {
    batchId: "YB86",
    material: "Cotton Yarn",
    colour: "Red",
    quantityKg: 850,
    costPerKg: 69,
    supplier: "Supplier A",
  },
  {
    // LOW STOCK — below 300 kg
    batchId: "YB87",
    material: "Polyester Yarn",
    colour: "White",
    quantityKg: 175,
    costPerKg: 53,
    supplier: "Supplier C",
  },
];

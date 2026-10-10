// Mock data for Quality Control and Fabric Digital Passport (Feature 4)

export const rolls = [
  {
    rollId: "RL10092",
    orderId: "ORD104",
    buyer: "ABC Garments",
    yarnBatch: "YB82",
    machineId: "W01",
    shift: "B",
    producedAt: "2026-10-10T14:30:00",
    status: "PASSED",
    defects: [],
    reworkStatus: "NONE",
  },
  {
    rollId: "RL10093",
    orderId: "ORD104",
    buyer: "ABC Garments",
    yarnBatch: "YB82",
    machineId: "W02",
    shift: "A",
    producedAt: "2026-10-10T15:15:00",
    status: "PASSED",
    defects: [],
    reworkStatus: "NONE",
  },
  {
    rollId: "RL10094",
    orderId: "ORD098",
    buyer: "Vogue Textiles",
    yarnBatch: "YB79",
    machineId: "W03",
    shift: "B",
    producedAt: "2026-10-10T16:00:00",
    status: "FAILED",
    defects: ["Hole", "Colour variation"],
    reworkStatus: "PENDING",
  },
  {
    rollId: "RL10095",
    orderId: "ORD098",
    buyer: "Vogue Textiles",
    yarnBatch: "YB79",
    machineId: "W04",
    shift: "C",
    producedAt: "2026-10-10T17:10:00",
    status: "REWORK",
    defects: ["Loose thread"],
    reworkStatus: "IN_PROGRESS",
  },
  {
    rollId: "RL10096",
    orderId: "ORD091",
    buyer: "FabIndia Global",
    yarnBatch: "YB88",
    machineId: "W05",
    shift: "A",
    producedAt: "2026-10-10T18:00:00",
    status: "PASSED",
    defects: [],
    reworkStatus: "NONE",
  },
  {
    rollId: "RL10097",
    orderId: "ORD091",
    buyer: "FabIndia Global",
    yarnBatch: "YB88",
    machineId: "W06",
    shift: "B",
    producedAt: "2026-10-10T19:20:00",
    status: "PASSED",
    defects: [],
    reworkStatus: "NONE",
  },
];

export const defectOptions = ["Loose thread", "Colour variation", "Hole"];

export const orderOptions = ["ORD104", "ORD098", "ORD091"];
export const machineOptions = ["W01", "W02", "W03", "W04", "W05", "W06"];
export const yarnBatchOptions = ["YB82", "YB79", "YB88"];

// Helper to look up roll case-insensitively and ignoring hyphens
export function getRollById(id) {
  if (!id) return null;
  const cleanSearch = id.replace(/-/g, "").trim().toUpperCase();
  return rolls.find(
    (r) => r.rollId.replace(/-/g, "").trim().toUpperCase() === cleanSearch
  ) || null;
}

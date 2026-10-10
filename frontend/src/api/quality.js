// Quality & Fabric Rolls API calls
// Endpoints: GET /api/quality, GET /api/quality/{roll_id}, POST /api/quality
// Based on: docs/api.md

import client from "./client.js";

/**
 * Fetch all fabric rolls from the API (newest first).
 * Returns: [{ rollId, orderId, machineId, yarnBatch, shift, buyerName,
 *             status, defects, reworkCost, date }]
 *
 * API note: field is `buyerName` (not `buyer`) and `date` (not `producedAt`).
 * We normalise below so the rest of the UI doesn't need to change.
 */
export async function fetchRolls() {
  const res = await client.get("/api/quality");
  // Normalise API shape → UI shape
  return res.data.map(normaliseRoll);
}

/**
 * Fetch a single fabric roll by ID.
 * Returns a normalised roll object or throws a 404 error.
 */
export async function fetchRollById(rollId) {
  const res = await client.get(`/api/quality/${rollId}`);
  return normaliseRoll(res.data);
}

/**
 * Submit a new quality inspection roll to the API.
 * Body: { rollId?, orderId, machineId, yarnBatch, shift, buyerName, status, defects }
 * Returns the saved roll (normalised).
 */
export async function postQualityRoll(rollData) {
  // Convert UI field names → API field names
  const body = {
    orderId: rollData.orderId,
    machineId: rollData.machineId,
    yarnBatch: rollData.yarnBatch,
    shift: rollData.shift || "B",
    buyerName: rollData.buyer || rollData.buyerName || "",
    status: rollData.status,
    defects: rollData.defects || [],
    // rollId is optional - API generates it if omitted
    ...(rollData.rollId && { rollId: rollData.rollId }),
  };
  const res = await client.post("/api/quality", body);
  return normaliseRoll(res.data);
}

/**
 * Normalise API roll → UI roll shape
 * API uses: { buyerName, date }   UI uses: { buyer, producedAt }
 */
function normaliseRoll(apiRoll) {
  return {
    rollId: apiRoll.rollId,
    orderId: apiRoll.orderId,
    buyer: apiRoll.buyerName || "",
    yarnBatch: apiRoll.yarnBatch,
    machineId: apiRoll.machineId,
    shift: apiRoll.shift,
    producedAt: apiRoll.date
      ? `${apiRoll.date}T00:00:00`
      : new Date().toISOString(),
    status: apiRoll.status || "PENDING",
    defects: Array.isArray(apiRoll.defects) ? apiRoll.defects : [],
    reworkStatus:
      apiRoll.status === "REWORK"
        ? "IN_PROGRESS"
        : apiRoll.status === "FAILED"
        ? "PENDING"
        : "NONE",
  };
}

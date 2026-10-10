// Quality & Fabric Rolls API calls
// Endpoints: GET /api/quality, GET /api/quality/{roll_id}, POST /api/quality
// Based on: docs/api.md

import client from "./client.js";

/**
 * Normalise API roll → UI roll shape. Everything the server sends is passed through
 * (affectedMeters, impact, reworkStatus, producedAt, reworkCost ...); only `buyer` is
 * renamed for the UI components.
 */
export function normaliseRoll(apiRoll) {
  return {
    ...apiRoll,
    buyer: apiRoll.buyerName || "",
    producedAt: apiRoll.producedAt ?? (apiRoll.date ? `${apiRoll.date}T00:00:00` : null),
    status: apiRoll.status || "PENDING",
    defects: Array.isArray(apiRoll.defects) ? apiRoll.defects : [],
  };
}

export const normaliseRolls = (apiRolls) => apiRolls.map(normaliseRoll);

/**
 * Submit a quality inspection roll.
 * Body: { orderId, machineId, yarnBatch, shift?, status, defects[], affectedMeters, reworkStatus?, rollId? }
 * Returns { roll, impact, marginBefore, marginAfter } straight from the server; `impact` is
 * { additionalLabour, machineCost, materialLoss, total } and is zero for PASSED rolls.
 * Throws an axios error; the server's message is in err.response.data.detail.
 */
export async function postQualityRoll(body) {
  const res = await client.post("/api/quality", body);
  const { impact, marginBefore, marginAfter, ...roll } = res.data;
  return { roll: normaliseRoll({ ...roll, impact }), impact, marginBefore, marginAfter };
}

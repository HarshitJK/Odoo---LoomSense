// Public fabric passport: GET /api/passport/{rollId}
// Returns only { rollId, orderId, buyerName, yarnBatch, machineId, shift, producedAt,
//                qualityStatus, defects, reworkStatus }. It never contains cost or profit data.

/** Rename the server's fields to the names the passport page components use. */
export function normalisePassport(p) {
  return {
    rollId: p.rollId,
    orderId: p.orderId,
    buyer: p.buyerName ?? "",
    yarnBatch: p.yarnBatch,
    machineId: p.machineId,
    shift: p.shift,
    producedAt: p.producedAt,
    status: p.qualityStatus,
    defects: Array.isArray(p.defects) ? p.defects : [],
    reworkStatus: p.reworkStatus,
  };
}

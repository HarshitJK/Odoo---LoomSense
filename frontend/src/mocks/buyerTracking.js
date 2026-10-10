// Mock data for Buyer Live Order Tracking (Feature 6)
// Safe public customer data ONLY: NO wages, margins, internal costs, or alerts

export const trackingOrders = [
  {
    orderId: "ORD104",
    buyerName: "ABC Garments",
    fabricType: "Cotton",
    colour: "Navy Blue",
    quantityMeters: 2000,
    progress: 78,
    currentStage: "Weaving",
    stages: [
      "Raw Material Allocated",
      "Spinning",
      "Weaving",
      "Dyeing",
      "Quality Check",
      "Ready for Dispatch",
    ],
    expectedCompletion: "2026-10-15T16:30:00",
    qualityStatus: "PENDING",
    dispatchStatus: "NOT_DISPATCHED",
  },
  {
    orderId: "ORD098",
    buyerName: "Vogue Textiles",
    fabricType: "Polyester Blend",
    colour: "Charcoal Grey",
    quantityMeters: 3500,
    progress: 92,
    currentStage: "Quality Check",
    stages: [
      "Raw Material Allocated",
      "Spinning",
      "Weaving",
      "Dyeing",
      "Quality Check",
      "Ready for Dispatch",
    ],
    expectedCompletion: "2026-10-12T11:00:00",
    qualityStatus: "IN_PROGRESS",
    dispatchStatus: "NOT_DISPATCHED",
  },
  {
    orderId: "ORD091",
    buyerName: "FabIndia Global",
    fabricType: "Organic Linen",
    colour: "Ivory White",
    quantityMeters: 1500,
    progress: 15,
    currentStage: "Raw Material Allocated",
    stages: [
      "Raw Material Allocated",
      "Spinning",
      "Weaving",
      "Dyeing",
      "Quality Check",
      "Ready for Dispatch",
    ],
    expectedCompletion: "2026-10-24T18:00:00",
    qualityStatus: "NOT_STARTED",
    dispatchStatus: "NOT_DISPATCHED",
  },
];

// Helper to look up tracking details: case-insensitive and ignores hyphens
export function getTrackingByOrderId(id) {
  if (!id) return null;
  const cleanSearch = id.replace(/[-_\s]/g, "").trim().toUpperCase();
  return (
    trackingOrders.find(
      (order) =>
        order.orderId.replace(/[-_\s]/g, "").trim().toUpperCase() ===
        cleanSearch
    ) || null
  );
}

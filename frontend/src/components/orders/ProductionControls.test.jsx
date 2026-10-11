import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductionControls from "./ProductionControls.jsx";
import CancelledOrdersTable from "./CancelledOrdersTable.jsx";
import OrderSummaryCard from "../buyer/OrderSummaryCard.jsx";

const auth = vi.hoisted(() => ({ user: { role: "OWNER" } }));
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => auth }));
vi.mock("../../api/client.js", () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const order = (extra = {}) => ({
  orderId: "ORD104", status: "WEAVING", gated: true, currentStage: "WEAVING", stageStatus: "IN_PROGRESS", machineId: "W01", ...extra,
});
const html = (o) => renderToStaticMarkup(<ProductionControls order={o} onChanged={() => {}} />);

beforeEach(() => {
  auth.user = { role: "OWNER" };
});

describe("production controls follow the order state", () => {
  it("running: pause, send for QC and cancel", () => {
    const out = html(order());
    expect(out).toContain("Pause production");
    expect(out).toContain("Send for QC");
    expect(out).toContain("Cancel order");
    expect(out).not.toContain("Resume production");
  });

  it("paused: resume, change machine and cancel, with the reason", () => {
    const out = html(order({ stageStatus: "PAUSED", pauseReason: "MACHINE_BREAKDOWN" }));
    expect(out).toContain("Resume production");
    expect(out).toContain("Change machine");
    expect(out).toContain("Cancel order");
    expect(out).toContain("Machine breakdown");
    expect(out).not.toContain("Pause production");
    expect(out).not.toContain("Send for QC");
  });

  it("a manager never sees the cancel action", () => {
    auth.user = { role: "PRODUCTION_MANAGER" };
    expect(html(order())).not.toContain("Cancel order");
    expect(html(order({ stageStatus: "PAUSED" }))).not.toContain("Cancel order");
  });

  it("waiting for QC shows only the waiting message", () => {
    auth.user = { role: "PRODUCTION_MANAGER" };
    const out = html(order({ stageStatus: "QC_PENDING" }));
    expect(out).toContain("Waiting for QC inspection");
    expect(out).not.toContain("Pause production");
    expect(out).not.toContain("Resume production");
  });

  it("cancelled: a neutral banner with reason, who, when and stage, and no actions", () => {
    const out = html(order({ status: "CANCELLED", cancelReason: "BUYER_CANCELLED", cancelledBy: "owner@loomsense.demo",
      cancelledAt: "2026-10-11T04:00:00+00:00", cancelledAtStage: "WEAVING" }));
    expect(out).toContain("This order is cancelled");
    expect(out).toContain("Buyer cancelled");
    expect(out).toContain("owner@loomsense.demo");
    expect(out).toContain("Production stopped at Weaving");
    expect(out).not.toContain("<button");
  });

  it("a dispatched order has no controls", () => {
    expect(html(order({ status: "DISPATCHED" }))).toBe("");
  });
});

it("lists a cancelled order with its loss, apart from completed orders", () => {
  const out = renderToStaticMarkup(<CancelledOrdersTable orders={[{
    orderId: "ORD120", buyerName: "ABC Garments",
    cancellation: { reason: "COMMERCIAL_DECISION", stoppedAtStage: "WEAVING", producedMeters: 40, estimatedOrderValue: 60000,
      actualCostIncurred: 12345, recoverableMaterialValue: 0, writeOffLoss: 12345 },
  }]} />);
  expect(out).toContain("Cancelled orders");
  expect(out).toContain("ORD120");
  expect(out).toContain("Commercial decision");
  expect(out).toContain("12,345");
});

describe("buyer tracking wording", () => {
  const tracked = { buyerName: "ABC Garments", fabricType: "Cotton", colour: "Navy Blue", quantityMeters: 2000, progress: 40,
    stages: [{ name: "Weaving", state: "IN_PROGRESS" }], expectedCompletion: null, qualityStatus: "IN_PROGRESS",
    qualityMessage: "Quality verification in progress", dispatchStatus: "NOT_DISPATCHED" };

  it("paused", () => {
    const out = renderToStaticMarkup(<OrderSummaryCard order={{ ...tracked, orderStatus: "PAUSED", statusMessage: "Production temporarily paused" }} />);
    expect(out).toContain("Production temporarily paused");
  });

  it("cancelled shows the message and no progress", () => {
    const out = renderToStaticMarkup(<OrderSummaryCard order={{ ...tracked, orderStatus: "CANCELLED", statusMessage: "Order cancelled" }} />);
    expect(out).toContain("Order cancelled");
    expect(out).not.toContain("Order complete");
    expect(out).not.toContain("Dispatch");
  });
});

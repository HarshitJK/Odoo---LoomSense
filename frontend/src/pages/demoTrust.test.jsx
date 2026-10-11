import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicBack from "../components/common/PublicBack.jsx";
import FabricPassportPage from "./FabricPassportPage.jsx";
import OwnerDashboard from "./OwnerDashboard.jsx";
import OrderProfitTable from "../components/orders/OrderProfitTable.jsx";

const state = vi.hoisted(() => ({ user: null, loading: false, passport: null, dashboard: null }));
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => state }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn(), useParams: () => ({ rollId: "RL10092" }) }));
vi.mock("../hooks/useApi.js", () => ({ default: (path) => ({
  data: path.startsWith("/api/passport") ? state.passport : path === "/api/finance/dashboard" ? state.dashboard : null,
  loading: false, error: null, reload: vi.fn(),
}) }));
vi.mock("../components/charts/CostBreakdown.jsx", () => ({ default: () => null }));
vi.mock("../components/MonthEndBooks.jsx", () => ({ default: () => null }));

beforeEach(() => {
  state.user = null;
  state.loading = false;
  state.passport = { rollId: "RL10092", orderId: "ORD104", buyer: "ABC Garments", shift: null, final: false };
  state.dashboard = null;
  vi.stubGlobal("window", { history: { state: { idx: 0 } }, location: { origin: "https://example.test" } });
});

describe("Standalone navigation", () => {
  it("does not offer an anonymous direct visitor an internal back link", () => {
    expect(renderToStaticMarkup(<PublicBack />)).toBe("");
  });
  it("offers signed-in direct visitors a return control", () => {
    state.user = { role: "OWNER" };
    expect(renderToStaticMarkup(<PublicBack />)).toContain("Back");
  });
  it("offers visitors with in-app history a back control", () => {
    window.history.state.idx = 1;
    expect(renderToStaticMarkup(<PublicBack />)).toContain("Back");
  });
  it("keeps anonymous buyer tracking free of internal controls", () => {
    window.history.state.idx = 1;
    expect(renderToStaticMarkup(<PublicBack authenticatedOnly />)).toBe("");
  });
  it("does not count unrelated browser history as an app route", () => {
    window.history = { length: 8, state: null };
    expect(renderToStaticMarkup(<PublicBack />)).toBe("");
  });
});

it("omits empty passport rows and internal values", () => {
  state.passport.costs = { machine: 987654 };
  const html = renderToStaticMarkup(<FabricPassportPage />);
  expect(html).not.toContain(">Shift<");
  expect(html).not.toContain(">Machine<");
  expect(html).not.toContain(">Date<");
  expect(html).not.toContain("987654");
  expect(html).not.toContain("Back");
});

it("shows an existing passport shift", () => {
  state.passport.shift = "B";
  expect(renderToStaticMarkup(<FabricPassportPage />)).toContain(">Shift<");
});

it("shows no-production margin as unavailable without red 0%", () => {
  state.dashboard = { label: "Jan 2020", targetMargin: 25, note: "No production recorded this month",
    kpis: { revenue: 0, productionCost: 0, netProfit: 0, profitMargin: null, buyerPayments: 0, paymentsPending: 0 },
    costBreakdown: {} };
  const html = renderToStaticMarkup(<OwnerDashboard />);
  expect(html).toContain("Not available");
  expect(html).toContain("No production recorded this month");
  expect(html).not.toContain("text-red-700");
});

it("puts finished results in margin order before provisional orders", () => {
  const orders = [
    { orderId: "PARTIAL", provisional: true, revenue: 1000, earnedRevenue: 500, profit: -100, margin: -20 },
    { orderId: "HIGH", provisional: false, revenue: 1000, earnedRevenue: 1000, profit: 300, margin: 30 },
    { orderId: "LOW", provisional: false, revenue: 1000, earnedRevenue: 1000, profit: 100, margin: 10 },
  ];
  const html = renderToStaticMarkup(<OrderProfitTable orders={orders} />);
  expect(html.indexOf("LOW")).toBeLessThan(html.indexOf("HIGH"));
  expect(html.indexOf("HIGH")).toBeLessThan(html.indexOf("PARTIAL"));
  expect(html).toContain("In progress");
  expect(html).toContain("Provisional");
  expect(html).toContain("Earned revenue");
});

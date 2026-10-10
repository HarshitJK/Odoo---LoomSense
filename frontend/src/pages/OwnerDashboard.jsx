import { DollarSign, TrendingDown, TrendingUp, Percent } from "lucide-react";

import PageHeader from "../components/common/PageHeader.jsx";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import MockBadge from "../components/common/MockBadge.jsx";
import RevenueCostChart from "../components/charts/RevenueCostChart.jsx";
import CostBreakdownChart from "../components/charts/CostBreakdownChart.jsx";
import OrderProfitTable from "../components/orders/OrderProfitTable.jsx";
import ProfitLeakagePanel from "../components/orders/ProfitLeakagePanel.jsx";

// Only used when VITE_USE_MOCKS=true
import { monthlySummary as mockSummary, monthlyTrend as mockTrend, profitLeakage as mockLeakage } from "../mocks/finance.js";
// Only used when VITE_USE_MOCKS=true
import { orders as mockOrders } from "../mocks/orders.js";
import useApi from "../hooks/useApi.js";

import { formatCurrency } from "../utils/formatCurrency.js";

// ─── Small reusable components (local) ───────────────────────────────────────

function KpiCard({ title, value, subtitle, icon: Icon, iconColour = "text-blue-500", trend }) {
  return (
    <div className="rounded-xl bg-white shadow-sm p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
        {Icon && (
          <span className={`rounded-lg bg-slate-100 p-2 ${iconColour}`}>
            <Icon size={18} />
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      {trend && (
        <p className={`text-xs font-medium mt-1 ${trend > 0 ? "text-green-600" : "text-red-500"}`}>
          {trend > 0 ? "▲" : "▼"} {Math.abs(trend)}% vs last month
        </p>
      )}
    </div>
  );
}

function SmallCostCard({ label, amount, colour = "text-slate-700" }) {
  return (
    <div className="rounded-xl bg-white shadow-sm p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${colour}`}>{formatCurrency(amount)}</p>
    </div>
  );
}

function HighlightOrderCard({ order, label, borderColour }) {
  return (
    <div className={`rounded-xl bg-white shadow-sm p-5 border-l-4 ${borderColour}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-base font-bold text-slate-800">{order.orderId}</p>
      <p className="text-sm text-slate-500 mb-3">{order.buyerName}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-400">Revenue</p>
          <p className="text-sm font-semibold text-slate-700">{formatCurrency(order.revenue)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Profit</p>
          <p className="text-sm font-semibold text-slate-700">{formatCurrency(order.profit)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Margin</p>
          <p className={`text-sm font-bold ${
            order.margin >= 25 ? "text-green-600" :
            order.margin >= 15 ? "text-amber-600" : "text-red-600"
          }`}>{order.margin}%</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-semibold text-slate-600">{order.status}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// Mock data in the API's shape (used only when VITE_USE_MOCKS=true)
const mockDashboard = () => ({
  label: "October 2026",
  targetMargin: 25,
  kpis: { revenue: mockSummary.revenue, productionCost: mockSummary.totalCost, netProfit: mockSummary.profit, profitMargin: mockSummary.margin },
  costBreakdown: mockSummary.breakdown,
  mostProfitableOrder: null,
  leastProfitableOrder: null,
});
const mockMonthly = () => mockTrend.map((m) => ({ ...m, label: m.month, profit: m.revenue - m.cost }));

/** % change of the latest month against the one before it (undefined when there is no earlier month). */
function trendOf(monthly, key) {
  if (!monthly || monthly.length < 2) return undefined;
  const [prev, last] = monthly.slice(-2).map((m) => m[key]);
  return prev ? Math.round(((last - prev) / Math.abs(prev)) * 1000) / 10 : undefined;
}

export default function OwnerDashboard() {
  // Everything below comes from the API (see docs/api.md)
  const dashboard = useApi("/api/finance/dashboard", { mock: mockDashboard }); // KPIs, cost breakdown, best / worst order
  const monthly   = useApi("/api/finance/monthly", { mock: mockMonthly });     // revenue vs cost chart
  const leakage   = useApi("/api/finance/profit-leakage", { mock: mockLeakage }); // profit leakage panel
  const orders    = useApi("/api/orders", { mock: mockOrders });               // profit table

  const all = [dashboard, monthly, leakage, orders];
  const error = all.map((r) => r.error).find(Boolean);
  const reloadAll = () => all.forEach((r) => r.reload());
  const loading = all.some((r) => r.loading && !r.data) && !error;

  const d = dashboard.data;
  const kpis = d?.kpis;
  const mostProfitable = d?.mostProfitableOrder;
  const leastProfitable = d?.leastProfitableOrder;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Owner Control Center"
        subtitle={`Profitability and cost intelligence${d ? ` — ${d.label}` : ""}`}
      />

      <MockBadge />
      <ApiErrorBanner error={error} onRetry={reloadAll} />
      {loading && (
        <div className="flex items-center justify-center h-32 text-slate-400 text-sm">Loading finance data…</div>
      )}

      {/* ── KPI row — GET /api/finance/dashboard ── */}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard title="Monthly Revenue" value={formatCurrency(kpis.revenue)}        subtitle={d.label}                        icon={DollarSign}  iconColour="text-blue-500"  trend={trendOf(monthly.data, "revenue")} />
            <KpiCard title="Total Cost"      value={formatCurrency(kpis.productionCost)} subtitle="All production costs"           icon={TrendingDown} iconColour="text-amber-500" trend={trendOf(monthly.data, "cost")} />
            <KpiCard title="Net Profit"      value={formatCurrency(kpis.netProfit)}      subtitle={`Margin: ${kpis.profitMargin}%`} icon={TrendingUp}  iconColour="text-green-500" trend={trendOf(monthly.data, "profit")} />
            <KpiCard title="Profit Margin"   value={`${kpis.profitMargin}%`}             subtitle={`Target: ${d.targetMargin}%`}   icon={Percent}     iconColour={kpis.profitMargin >= d.targetMargin ? "text-green-500" : "text-amber-500"} />
          </div>

          {/* ── Cost breakdown row ── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SmallCostCard label="Raw Material" amount={d.costBreakdown.rawMaterial} colour="text-blue-700"   />
            <SmallCostCard label="Labour Wages" amount={d.costBreakdown.labour}      colour="text-violet-700" />
            <SmallCostCard label="Machine Cost" amount={d.costBreakdown.machine}     colour="text-slate-700"  />
            <SmallCostCard label="Rework Cost"  amount={d.costBreakdown.rework}      colour="text-red-600"    />
          </div>
        </>
      )}

      {/* ── Charts row ── */}
      {(monthly.data || d) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {monthly.data && <RevenueCostChart data={monthly.data} />}
          {d && <CostBreakdownChart breakdown={d.costBreakdown} />}
        </div>
      )}

      {/* ── Order profit table — live from GET /api/orders ── */}
      {orders.data && <OrderProfitTable orders={orders.data} />}

      {/* ── Highlight cards — most / least profitable finished orders from the dashboard ── */}
      {mostProfitable && leastProfitable && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HighlightOrderCard order={mostProfitable}  label="🏆 Most Profitable Order"  borderColour="border-green-500" />
          <HighlightOrderCard order={leastProfitable} label="⚠ Least Profitable Order" borderColour="border-red-500"   />
        </div>
      )}

      {/* ── Profit Leakage Panel — GET /api/finance/profit-leakage ── */}
      {leakage.data && <ProfitLeakagePanel leakage={leakage.data} />}
    </div>
  );
}

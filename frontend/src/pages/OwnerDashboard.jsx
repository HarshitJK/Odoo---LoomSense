import { useState, useEffect } from "react";
import { DollarSign, TrendingDown, TrendingUp, Percent, WifiOff } from "lucide-react";

import PageHeader from "../components/common/PageHeader.jsx";
import RevenueCostChart from "../components/charts/RevenueCostChart.jsx";
import CostBreakdownChart from "../components/charts/CostBreakdownChart.jsx";
import OrderProfitTable from "../components/orders/OrderProfitTable.jsx";
import ProfitLeakagePanel from "../components/orders/ProfitLeakagePanel.jsx";

// Finance KPIs and leakage — NOT yet in the API (/api/finance/* is placeholder).
// Keep using mock data until the Lead implements the finance endpoints.
import { monthlySummary, monthlyTrend, profitLeakage } from "../mocks/finance.js";
// Fallback order data when API is unreachable
import { orders as mockOrders } from "../mocks/orders.js";

import { formatCurrency } from "../utils/formatCurrency.js";
import client from "../api/client.js"; // axios instance, base URL from VITE_API_URL

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

/** Small banner shown when the API could not be reached */
function OfflineBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-100 border border-slate-200 px-4 py-2 text-xs text-slate-500">
      <WifiOff size={14} />
      Backend offline — showing mock data. Start the API server at http://localhost:8000.
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  // Orders come from the real API: GET /api/orders
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [isOffline, setOffline] = useState(false);

  useEffect(() => {
    // Fetch all orders from the backend
    client.get("/api/orders")
      .then((res) => {
        setOrders(res.data);
        setOffline(false);
      })
      .catch(() => {
        // Backend not running — fall back to local mock data
        setOrders(mockOrders);
        setOffline(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // Only orders that have real profit data (exclude pending / null profit)
  const completedOrders = orders.filter((o) => o.profit !== null && o.profit !== undefined);
  const sortedByProfit  = [...completedOrders].sort((a, b) => b.profit - a.profit);
  const mostProfitable  = sortedByProfit[0];
  const leastProfitable = sortedByProfit[sortedByProfit.length - 1];

  // Finance summary — stays on mock until /api/finance/* is implemented
  const { revenue, totalCost, profit, margin, breakdown } = monthlySummary;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading orders…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Owner Control Center"
        subtitle="Profitability and cost intelligence — October 2026"
      />

      {/* Offline notice when backend is unreachable */}
      {isOffline && <OfflineBanner />}

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Monthly Revenue"  value={formatCurrency(revenue)}   subtitle="October 2026"            icon={DollarSign}  iconColour="text-blue-500"  trend={7.0}  />
        <KpiCard title="Total Cost"       value={formatCurrency(totalCost)} subtitle="All production costs"    icon={TrendingDown} iconColour="text-amber-500" trend={5.6}  />
        <KpiCard title="Net Profit"       value={formatCurrency(profit)}    subtitle={`Margin: ${margin}%`}    icon={TrendingUp}  iconColour="text-green-500" trend={11.5} />
        <KpiCard title="Profit Margin"    value={`${margin}%`}              subtitle="Target: 25%"             icon={Percent}     iconColour={margin >= 25 ? "text-green-500" : "text-amber-500"} />
      </div>

      {/* Note: Finance KPIs above still use mock data — /api/finance/* not yet implemented */}

      {/* ── Cost breakdown row ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SmallCostCard label="Raw Material" amount={breakdown.rawMaterial} colour="text-blue-700"   />
        <SmallCostCard label="Labour Wages" amount={breakdown.labour}      colour="text-violet-700" />
        <SmallCostCard label="Machine Cost" amount={breakdown.machine}     colour="text-slate-700"  />
        <SmallCostCard label="Rework Cost"  amount={breakdown.rework}      colour="text-red-600"    />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RevenueCostChart data={monthlyTrend} />
        <CostBreakdownChart breakdown={breakdown} />
      </div>

      {/* ── Order profit table — live from GET /api/orders ── */}
      <OrderProfitTable orders={orders} />

      {/* ── Highlight cards — derived from API data ── */}
      {mostProfitable && leastProfitable && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HighlightOrderCard order={mostProfitable}  label="🏆 Most Profitable Order"  borderColour="border-green-500" />
          <HighlightOrderCard order={leastProfitable} label="⚠ Least Profitable Order" borderColour="border-red-500"   />
        </div>
      )}

      {/* ── Profit Leakage Panel — still uses mock until /api/finance/profit-leakage is ready ── */}
      <ProfitLeakagePanel leakage={profitLeakage} />
    </div>
  );
}

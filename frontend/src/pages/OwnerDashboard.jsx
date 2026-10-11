import PageHeader from "../components/common/PageHeader.jsx";
import KpiCard from "../components/common/KpiCard.jsx";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import LoadingBlock from "../components/common/LoadingBlock.jsx";
import MockBadge from "../components/common/MockBadge.jsx";
import MonthEndBooks from "../components/MonthEndBooks.jsx";
import RevenueCostChart from "../components/charts/RevenueCostChart.jsx";
import CostBreakdown from "../components/charts/CostBreakdown.jsx";
import OrderProfitTable from "../components/orders/OrderProfitTable.jsx";
import ProfitLeakagePanel from "../components/orders/ProfitLeakagePanel.jsx";
import CancelledOrdersTable from "../components/orders/CancelledOrdersTable.jsx";

// Only used when VITE_USE_MOCKS=true
import { monthlySummary as mockSummary, monthlyTrend as mockTrend, profitLeakage as mockLeakage } from "../mocks/finance.js";
import { orders as mockOrders } from "../mocks/orders.js";
import useApi from "../hooks/useApi.js";

import { formatCurrency } from "../utils/formatCurrency.js";
import { marginClass } from "../utils/calculations.js";
import { formatPercent } from "../utils/format.js";

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

export default function OwnerDashboard() {
  // Everything below comes from the API (see docs/api.md)
  const dashboard = useApi("/api/finance/dashboard", { mock: mockDashboard }); // figures and cost breakdown
  const monthly = useApi("/api/finance/monthly", { mock: mockMonthly }); // revenue against cost chart
  const leakage = useApi("/api/finance/profit-leakage", { mock: mockLeakage }); // where profit was lost
  const orders = useApi("/api/orders", { mock: mockOrders }); // orders table

  const all = [dashboard, monthly, leakage, orders];
  const error = all.map((r) => r.error).find(Boolean);
  const reloadAll = () => all.forEach((r) => r.reload());
  const loading = all.some((r) => r.loading && !r.data) && !error;

  const d = dashboard.data;
  const kpis = d?.kpis;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Is the factory making money, and which order is losing it?" />
      <MockBadge />
      <ApiErrorBanner error={error} onRetry={reloadAll} />
      {loading && <LoadingBlock label="Loading the dashboard" height="h-40" />}

      {d && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard title="Earned revenue" value={formatCurrency(kpis.revenue)} subtitle={d.label} />
          <KpiCard title="Total cost" value={formatCurrency(kpis.productionCost)} />
          <KpiCard title="Net profit" value={formatCurrency(kpis.netProfit)} />
          <KpiCard
            title="Profit margin"
            value={kpis.profitMargin == null ? "Not available" : formatPercent(kpis.profitMargin)}
            subtitle={d.note || `Target ${d.targetMargin}%`}
            valueClassName={kpis.profitMargin == null ? "text-gray-600" : marginClass(kpis.profitMargin)}
          />
        </div>
      )}

      {d && <div className="grid grid-cols-2 gap-4">
        <KpiCard title="Cash received from buyers" value={formatCurrency(kpis.buyerPayments)} subtitle={d.label} />
        <KpiCard title="Still to collect" value={formatCurrency(kpis.paymentsPending)} subtitle="All orders, lifetime balance" />
      </div>}

      {(monthly.data || d) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {monthly.data && <RevenueCostChart data={monthly.data} />}
          {d && <CostBreakdown breakdown={d.costBreakdown} />}
        </div>
      )}

      {(d?.orders || orders.data) && <OrderProfitTable orders={d?.orders || orders.data} />}

      {d?.cancelledOrders?.length > 0 && <CancelledOrdersTable orders={d.cancelledOrders} />}

      {leakage.data && <ProfitLeakagePanel leakage={leakage.data} />}

      <MonthEndBooks />
    </>
  );
}

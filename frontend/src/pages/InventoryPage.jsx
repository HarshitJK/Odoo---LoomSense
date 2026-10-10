import PurchaseRegister from "../components/PurchaseRegister.jsx";
import { useAuth } from "../context/AuthContext.jsx";

import PageHeader from "../components/common/PageHeader.jsx";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import Card from "../components/common/Card.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import KpiCard from "../components/common/KpiCard.jsx";
import LoadingBlock from "../components/common/LoadingBlock.jsx";
import MockBadge from "../components/common/MockBadge.jsx";
import StatusBadge from "../components/common/StatusBadge.jsx";
import { Table, THead, Th, TBody, Tr, Td, useRowLimit, ShowAll } from "../components/common/Table.jsx";
import OrderReadinessChecker from "../components/orders/OrderReadinessChecker.jsx";

// Only used when VITE_USE_MOCKS=true
import { inventory as mockInventory } from "../mocks/inventory.js";
import useApi from "../hooks/useApi.js";

import { formatCurrency } from "../utils/formatCurrency.js";
import { formatKg, formatNumber } from "../utils/format.js";

// A batch is low on stock below 300 kg. The API sends a computed `lowStock` flag; mock data has none.
const LOW_STOCK_THRESHOLD_KG = 300;
const isLowStock = (batch) => (batch.lowStock !== undefined ? batch.lowStock : batch.quantityKg < LOW_STOCK_THRESHOLD_KG);

function StockTable({ batches }) {
  // Low stock first, so the ones that need action are in the first five rows
  const sorted = [...batches].sort((a, b) => Number(isLowStock(b)) - Number(isLowStock(a)));
  const limiter = useRowLimit(sorted, 5);
  return (
    <Card title="Yarn in stock" padded={false}>
      <Table caption="Yarn stock">
        <THead>
          <Th>Material</Th>
          <Th>Colour</Th>
          <Th align="right">Quantity (kg)</Th>
          <Th align="right">Cost per kg</Th>
          <Th>Alert</Th>
        </THead>
        <TBody>
          {limiter.visible.map((batch) => (
            <Tr key={batch.batchId}>
              <Td header>{batch.material}</Td>
              <Td>{batch.colour}</Td>
              <Td align="right">{formatNumber(batch.quantityKg)}</Td>
              <Td align="right">{formatCurrency(batch.costPerKg)}</Td>
              <Td>{isLowStock(batch) && <StatusBadge status="LOW_STOCK" />}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <ShowAll limiter={limiter} noun="batches" />
    </Card>
  );
}

export default function InventoryPage() {
  const { user } = useAuth();
  // GET /api/inventory: batches with a computed `lowStock` flag
  const { data, loading, error, reload } = useApi("/api/inventory", { mock: mockInventory });
  const inventory = data ?? [];

  const totalStockKg = inventory.reduce((sum, b) => sum + b.quantityKg, 0);
  const totalValue = inventory.reduce((sum, b) => sum + b.quantityKg * b.costPerKg, 0);
  const lowStockCount = inventory.filter(isLowStock).length;

  return (
    <>
      <PageHeader title="Stock" subtitle="Yarn in hand, and whether an order can start." />
      <MockBadge />
      <ApiErrorBanner error={error} onRetry={reload} />
      {loading && !data && <LoadingBlock label="Loading stock" height="h-40" />}

      {data && data.length === 0 && <EmptyState>No yarn in stock yet. Use Receive material below to add a delivery.</EmptyState>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard title="Total yarn" value={formatKg(totalStockKg)} />
            <KpiCard title="Stock value" value={formatCurrency(totalValue)} />
            <KpiCard
              title="Low stock"
              value={lowStockCount}
              subtitle={`Batches under ${LOW_STOCK_THRESHOLD_KG} kg`}
              valueClassName={lowStockCount > 0 ? "text-amber-700" : "text-gray-900"}
            />
          </div>

          {data.length > 0 && <StockTable batches={inventory} />}

          {/* POST /api/orders/readiness-check */}
          <OrderReadinessChecker />
        </>
      )}

      {user.role === "OWNER" && <PurchaseRegister onReceive={reload} />}
    </>
  );
}

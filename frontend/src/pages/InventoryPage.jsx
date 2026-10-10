import { useState, useEffect } from "react";
import { Package, AlertTriangle, DollarSign, WifiOff } from "lucide-react";

import PageHeader from "../components/common/PageHeader.jsx";
import OrderReadinessChecker from "../components/orders/OrderReadinessChecker.jsx";

// Fallback when API is unreachable
import { inventory as mockInventory } from "../mocks/inventory.js";

import { formatCurrency } from "../utils/formatCurrency.js";
import client from "../api/client.js"; // axios, base URL from VITE_API_URL

// A batch is "low stock" when below 300 kg.
// The API already returns a computed `lowStock` boolean — we use that when available,
// and compute it locally as a fallback (for mock data which lacks that field).
const LOW_STOCK_THRESHOLD_KG = 300;

function isLowStock(batch) {
  // Prefer the server-computed field; fall back to local calculation
  return batch.lowStock !== undefined
    ? batch.lowStock
    : batch.quantityKg < LOW_STOCK_THRESHOLD_KG;
}

// ─── Local sub-components ─────────────────────────────────────────────────────

function SummaryCard({ title, value, sub, icon: Icon, iconColour = "text-blue-500" }) {
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
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function LowStockBadge() {
  return (
    <span className="inline-block rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5">
      LOW STOCK
    </span>
  );
}

function StockTable({ batches }) {
  return (
    <div className="rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Yarn Stock Register
        </h2>
        <span className="text-xs text-slate-400">{batches.length} batches</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 text-left font-medium">Batch ID</th>
              <th className="px-5 py-3 text-left font-medium">Material</th>
              <th className="px-5 py-3 text-left font-medium">Colour</th>
              <th className="px-5 py-3 text-right font-medium">Qty (kg)</th>
              <th className="px-5 py-3 text-right font-medium">Cost / kg</th>
              <th className="px-5 py-3 text-right font-medium">Batch Value</th>
              <th className="px-5 py-3 text-left font-medium">Supplier</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {batches.map((batch) => {
              const low        = isLowStock(batch);
              const batchValue = batch.quantityKg * batch.costPerKg;
              return (
                <tr
                  key={batch.batchId}
                  className={`hover:bg-slate-50 transition-colors ${low ? "bg-amber-50/40" : ""}`}
                >
                  <td className="px-5 py-3 font-mono font-semibold text-slate-800">{batch.batchId}</td>
                  <td className="px-5 py-3 text-slate-700">{batch.material}</td>
                  <td className="px-5 py-3 text-slate-700">{batch.colour}</td>
                  <td className={`px-5 py-3 text-right font-semibold ${low ? "text-amber-700" : "text-slate-800"}`}>
                    {batch.quantityKg.toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-600">{formatCurrency(batch.costPerKg)}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{formatCurrency(batchValue)}</td>
                  <td className="px-5 py-3 text-slate-600">{batch.supplier}</td>
                  <td className="px-5 py-3">
                    {low
                      ? <LowStockBadge />
                      : <span className="text-xs text-green-600 font-medium">In Stock</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OfflineBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-100 border border-slate-200 px-4 py-2 text-xs text-slate-500">
      <WifiOff size={14} />
      Backend offline — showing mock data. Start the API server at http://localhost:8000.
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  // Inventory data from GET /api/inventory
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [isOffline, setOffline]   = useState(false);

  useEffect(() => {
    // GET /api/inventory — returns batches with computed `lowStock` boolean
    client.get("/api/inventory")
      .then((res) => {
        setInventory(res.data);
        setOffline(false);
      })
      .catch(() => {
        // Backend not reachable — fall back to local mock
        setInventory(mockInventory);
        setOffline(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // Derived summary numbers
  const totalStockKg   = inventory.reduce((sum, b) => sum + b.quantityKg, 0);
  const totalValue     = inventory.reduce((sum, b) => sum + b.quantityKg * b.costPerKg, 0);
  const lowStockCount  = inventory.filter(isLowStock).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading inventory…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raw Material Inventory"
        subtitle="Yarn stock levels, values, and order readiness checker"
      />

      {isOffline && <OfflineBanner />}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Total Stock"
          value={`${totalStockKg.toLocaleString("en-IN")} kg`}
          sub="Across all yarn batches"
          icon={Package}
          iconColour="text-blue-500"
        />
        <SummaryCard
          title="Total Stock Value"
          value={formatCurrency(totalValue)}
          sub="Qty × Cost per kg"
          icon={DollarSign}
          iconColour="text-green-500"
        />
        <SummaryCard
          title="Low Stock Batches"
          value={lowStockCount}
          sub={`Below ${LOW_STOCK_THRESHOLD_KG} kg threshold`}
          icon={AlertTriangle}
          iconColour={lowStockCount > 0 ? "text-amber-500" : "text-green-500"}
        />
      </div>

      {/* ── Stock table — live from GET /api/inventory ── */}
      <StockTable batches={inventory} />

      {/* ── Readiness checker — passes live inventory as prop ── */}
      {/* The Lead can later replace this prop with data from GET /api/orders/{id}/readiness */}
      <OrderReadinessChecker inventory={inventory} />
    </div>
  );
}

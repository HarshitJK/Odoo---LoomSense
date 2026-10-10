import PageHeader from "../components/common/PageHeader.jsx";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import MockBadge from "../components/common/MockBadge.jsx";
import { formatCurrency } from "../utils/formatCurrency.js";

import useApi from "../hooks/useApi.js";
import { postAttendance } from "../api/workers.js";

// Only used when VITE_USE_MOCKS=true
import { workers as mockAttendance, workerProfiles as mockProfiles, orders as mockOrderIds, machines as mockMachineIds } from "../mocks/workers.js";

import KpiCard from "../components/workers/KpiCard.jsx";
import AttendanceForm from "../components/workers/AttendanceForm.jsx";
import WorkersTable from "../components/workers/WorkersTable.jsx";
import LabourCostPerOrder from "../components/workers/LabourCostPerOrder.jsx";
import InsightBanner from "../components/workers/InsightBanner.jsx";
import { Banknote, Clock, Wallet } from "lucide-react";

// ── Mock data in the API's shape (used only when VITE_USE_MOCKS=true) ──────
const mockWorkers = () =>
  mockProfiles.map((p) => {
    const log = mockAttendance.find((a) => a.workerId === p.workerId) ?? {};
    const hours = log.hoursWorked ?? 0;
    const overtime = log.overtimeHours ?? 0;
    return {
      ...p,
      latestAssignment: log.orderId ? { orderId: log.orderId, machineId: log.machineId } : null,
      hoursThisMonth: hours,
      overtimeThisMonth: overtime,
      wageThisMonth: hours * p.hourlyRate + overtime * p.hourlyRate * 1.5,
    };
  });
const mockWages = () => ({ totalRegularWages: 0, totalOvertimePay: 0, totalWorkforceCost: 0, labourCostPerOrder: [] });

export default function WorkersPage() {
  const workers = useApi("/api/workers", { mock: mockWorkers });
  const wages = useApi("/api/workers/wages/summary", { mock: mockWages });
  const orders = useApi("/api/orders", { mock: () => mockOrderIds.map((orderId) => ({ orderId })) });
  const machines = useApi("/api/machines", { mock: () => mockMachineIds.map((machineId) => ({ machineId })) });
  const leakage = useApi("/api/finance/profit-leakage", { mock: null }); // optional insight banner

  const errors = [workers, wages, orders, machines].map((r) => r.error).filter(Boolean);
  const retryAll = () => [workers, wages, orders, machines, leakage].forEach((r) => r.reload());
  const loading = [workers, wages].some((r) => r.loading && !r.data);

  // Log hours, then refetch so the wage numbers on the page come from the server again
  const handleLogAttendance = async (entry) => {
    await postAttendance({
      workerId: entry.workerId,
      orderId: entry.orderId,
      machineId: entry.machineId,
      hoursWorked: entry.hoursWorked,
      overtimeHours: entry.overtimeHours,
      date: entry.date,
    });
    workers.reload();
    wages.reload();
    leakage.reload();
  };

  const summary = wages.data;
  const formReady = workers.data && orders.data && machines.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers & Wages"
        subtitle="Attendance, shifts, and order-level labour cost intelligence (Feature 5)"
      />
      <MockBadge />

      {errors.slice(0, 1).map((error) => (
        <ApiErrorBanner key={error.endpoint} error={error} onRetry={retryAll} />
      ))}

      {loading && !errors.length && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-24 animate-pulse bg-slate-50" />
          ))}
        </div>
      )}

      {/* 1. Summary Cards — from GET /api/workers/wages/summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <KpiCard
            title="Total Regular Wages"
            value={formatCurrency(summary.totalRegularWages)}
            subtitle="Base shift earnings across active orders"
            icon={Wallet}
          />
          <KpiCard
            title="Total Overtime Pay"
            value={formatCurrency(summary.totalOvertimePay)}
            subtitle="Compensated at 1.5x regular hourly rate"
            icon={Clock}
          />
          <KpiCard
            title="Total Workforce Cost"
            value={formatCurrency(summary.totalWorkforceCost)}
            subtitle="Total labour cost (this month)"
            icon={Banknote}
          />
        </div>
      )}

      {/* 2. Insight Banner — from GET /api/finance/profit-leakage */}
      <InsightBanner leakage={leakage.data} />

      {/* 3. Labour Cost per Order Card (Unique Feature) */}
      {summary && <LabourCostPerOrder rows={summary.labourCostPerOrder} />}

      {/* 4. Attendance Log Form */}
      {formReady && (
        <AttendanceForm
          workerProfiles={workers.data}
          orders={orders.data.map((o) => o.orderId)}
          machines={machines.data.map((m) => m.machineId)}
          onLogAttendance={handleLogAttendance}
        />
      )}

      {/* 5. Workers Attendance & Wage Table */}
      {workers.data && <WorkersTable workers={workers.data} />}
    </div>
  );
}

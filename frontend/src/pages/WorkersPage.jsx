import { useAuth } from "../context/AuthContext.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import KpiCard from "../components/common/KpiCard.jsx";
import LoadingBlock from "../components/common/LoadingBlock.jsx";
import MockBadge from "../components/common/MockBadge.jsx";
import { formatCurrency } from "../utils/formatCurrency.js";

import useApi from "../hooks/useApi.js";
import { postAttendance } from "../api/workers.js";

// Only used when VITE_USE_MOCKS=true
import { workers as mockAttendance, workerProfiles as mockProfiles, orders as mockOrderIds, machines as mockMachineIds } from "../mocks/workers.js";

import AttendanceForm from "../components/workers/AttendanceForm.jsx";
import WorkersTable from "../components/workers/WorkersTable.jsx";
import LabourCostPerOrder from "../components/workers/LabourCostPerOrder.jsx";

// Mock data in the API's shape (used only when VITE_USE_MOCKS=true)
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
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const workers = useApi("/api/workers", { mock: mockWorkers });
  const wages = useApi("/api/workers/wages/summary", { mock: mockWages, enabled: isOwner });
  const orders = useApi("/api/orders", { mock: () => mockOrderIds.map((orderId) => ({ orderId })) });
  const machines = useApi("/api/machines", { mock: () => mockMachineIds.map((machineId) => ({ machineId })) });
  const leakage = useApi("/api/finance/profit-leakage", { mock: null, enabled: isOwner }); // refreshed after hours are saved

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
    <>
      <PageHeader title="Workers" subtitle={isOwner ? "Hours worked, wages, and what labour costs each order." : "Log worker hours against machines and orders."} />
      <MockBadge />

      {errors.slice(0, 1).map((error) => (
        <ApiErrorBanner key={error.endpoint} error={error} onRetry={retryAll} />
      ))}

      {loading && !errors.length && <LoadingBlock label="Loading workers" height="h-32" />}

      {/* The form comes first on phones, where hours are logged */}
      <div className="flex flex-col gap-6">
        {formReady && (
          <div className="max-lg:order-first">
            <AttendanceForm
              workerProfiles={workers.data}
              orders={orders.data.map((o) => o.orderId)}
              machines={machines.data.map((m) => m.machineId)}
              onLogAttendance={handleLogAttendance}
            />
          </div>
        )}

        {isOwner && summary && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard title="Regular wages" value={formatCurrency(summary.totalRegularWages)} subtitle="This month" />
            <KpiCard title="Overtime pay" value={formatCurrency(summary.totalOvertimePay)} />
            <KpiCard title="Total labour cost" value={formatCurrency(summary.totalWorkforceCost)} />
          </div>
        )}

        {workers.data && <WorkersTable workers={workers.data} showWages={isOwner} />}

        {isOwner && summary && <LabourCostPerOrder rows={summary.labourCostPerOrder} />}
      </div>
    </>
  );
}

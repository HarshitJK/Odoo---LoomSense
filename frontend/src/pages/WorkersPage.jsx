import { useState, useEffect } from "react";
import PageHeader from "../components/common/PageHeader.jsx";
import { formatCurrency } from "../utils/formatCurrency.js";

// ── API functions (swap mock → real in one place) ──────────────────────────
import { fetchWorkers, postAttendance } from "../api/workers.js";

// ── Mock fallback (used when backend is offline) ───────────────────────────
import {
  workers as mockWorkers,
  orders as mockOrders,
  machines as mockMachines,
  workerProfiles as mockWorkerProfiles,
} from "../mocks/workers.js";

import { calculateWorkerTotals } from "../components/workers/wageCalculations.js";
import KpiCard from "../components/workers/KpiCard.jsx";
import AttendanceForm from "../components/workers/AttendanceForm.jsx";
import WorkersTable from "../components/workers/WorkersTable.jsx";
import LabourCostPerOrder from "../components/workers/LabourCostPerOrder.jsx";
import InsightBanner from "../components/workers/InsightBanner.jsx";
import { Banknote, Clock, Wallet, AlertCircle } from "lucide-react";

export default function WorkersPage() {
  const [workersList, setWorkersList] = useState([]);
  const [ordersList] = useState(mockOrders);
  const [machinesList] = useState(mockMachines);
  const [workerProfilesList, setWorkerProfilesList] = useState(mockWorkerProfiles);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null); // null = ok, string = error message

  // Load workers from API on mount; fall back to mock data if backend is offline
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchWorkers()
      .then((apiWorkers) => {
        if (cancelled) return;

        // API returns { workerId, name, hourlyRate, shift, latestAssignment }
        // We need to enrich with machineId/orderId/hoursWorked from latestAssignment
        const enriched = apiWorkers.map((w) => ({
          workerId: w.workerId,
          name: w.name,
          shift: w.shift,
          hourlyRate: w.hourlyRate,
          machineId: w.latestAssignment?.machineId || "—",
          orderId: w.latestAssignment?.orderId || "—",
          hoursWorked: 0,    // API doesn't return hours in worker list
          overtimeHours: 0,  // these come from attendance records
        }));

        setWorkersList(enriched);
        setWorkerProfilesList(
          apiWorkers.map((w) => ({
            workerId: w.workerId,
            name: w.name,
            shift: w.shift,
            hourlyRate: w.hourlyRate,
          }))
        );
        setApiError(null);
      })
      .catch(() => {
        if (cancelled) return;
        // Backend offline or error → fall back to mock data silently
        setWorkersList(mockWorkers);
        setWorkerProfilesList(mockWorkerProfiles);
        setApiError("Backend offline — showing local demo data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Live wage totals recalculate whenever the workers list changes
  const totals = calculateWorkerTotals(workersList);

  const handleLogAttendance = async (newRecord) => {
    // Optimistically add the record to local state immediately (instant UI update)
    setWorkersList((prev) => [newRecord, ...prev]);

    try {
      // POST to API: { workerId, orderId, machineId, hoursWorked, overtimeHours, date }
      await postAttendance({
        workerId: newRecord.workerId,
        orderId: newRecord.orderId,
        machineId: newRecord.machineId,
        hoursWorked: newRecord.hoursWorked,
        overtimeHours: newRecord.overtimeHours,
        date: newRecord.date,
      });
    } catch {
      // API save failed — the optimistic record stays visible so UX isn't broken
      // In a production app you'd show a toast or retry. Here we keep it simple.
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers & Wages"
        subtitle="Attendance, shifts, and order-level labour cost intelligence (Feature 5)"
      />

      {/* API status banner */}
      {apiError && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-24 animate-pulse bg-slate-50" />
          ))}
        </div>
      )}

      {/* 1. Summary Cards (3x KpiCard) */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <KpiCard
            title="Total Regular Wages"
            value={formatCurrency(totals.totalRegular)}
            subtitle="Base shift earnings across active orders"
            icon={Wallet}
          />
          <KpiCard
            title="Total Overtime Pay"
            value={formatCurrency(totals.totalOvertime)}
            subtitle="Compensated at 1.5x regular hourly rate"
            icon={Clock}
          />
          <KpiCard
            title="Total Workforce Cost"
            value={formatCurrency(totals.totalWorkforce)}
            subtitle="Total labour cost (this month)"
            icon={Banknote}
          />
        </div>
      )}

      {/* 2. Insight Banner */}
      <InsightBanner />

      {/* 3. Labour Cost per Order Card (Unique Feature) */}
      <LabourCostPerOrder workers={workersList} />

      {/* 4. Attendance Log Form */}
      <AttendanceForm
        workerProfiles={workerProfilesList}
        orders={ordersList}
        machines={machinesList}
        onLogAttendance={handleLogAttendance}
      />

      {/* 5. Workers Attendance & Wage Table */}
      <WorkersTable workers={workersList} />
    </div>
  );
}

import { useState, useEffect } from "react";
import PageHeader from "../components/common/PageHeader.jsx";

// ── API functions (swap mock → real in one place) ──────────────────────────
import { fetchRolls, postQualityRoll } from "../api/quality.js";

// ── Mock fallback (used when backend is offline) ───────────────────────────
import {
  rolls as mockRolls,
  defectOptions,
  orderOptions,
  machineOptions,
  yarnBatchOptions,
} from "../mocks/quality.js";

import RollsTable from "../components/quality/RollsTable.jsx";
import QualityForm from "../components/quality/QualityForm.jsx";
import DefectCostImpact from "../components/quality/DefectCostImpact.jsx";
import { AlertCircle } from "lucide-react";

export default function QualityPage() {
  const [rollsList, setRollsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Tracks defect impact state: shown when form status is FAILED or REWORK
  const [defectContext, setDefectContext] = useState({
    active: false,
    status: "REWORK",
    affectedMeters: 120,
  });

  // Fetch all rolls from API on mount; fall back to mock data if backend is offline
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchRolls()
      .then((apiRolls) => {
        if (cancelled) return;
        setRollsList(apiRolls);
        setApiError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setRollsList(mockRolls);
        setApiError("Backend offline — showing local demo data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const handleStatusChange = ({ status, affectedMeters }) => {
    if (status === "FAILED" || status === "REWORK") {
      setDefectContext({ active: true, status, affectedMeters });
    } else {
      setDefectContext((prev) => ({ ...prev, active: false }));
    }
  };

  const handleAddRoll = async (newRoll, affectedMeters) => {
    // Optimistically add to local list for instant UI feedback
    setRollsList((prev) => [newRoll, ...prev]);

    if (newRoll.status === "FAILED" || newRoll.status === "REWORK") {
      setDefectContext({ active: true, status: newRoll.status, affectedMeters });
    } else {
      setDefectContext((prev) => ({ ...prev, active: false }));
    }

    try {
      // POST to API: rollId is optional, API will generate one if omitted
      const saved = await postQualityRoll(newRoll);

      // Replace the optimistic entry with the real saved record (has server-assigned rollId)
      setRollsList((prev) =>
        prev.map((r) => (r.rollId === newRoll.rollId ? saved : r))
      );
    } catch {
      // API save failed — optimistic record stays in the list.
      // In production you'd show a toast. Here we keep UX intact.
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quality Control & Inspection"
        subtitle="Fabric quality checks, defect cost impact and traceability records (Feature 4)"
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading quality rolls from API…
        </div>
      )}

      {/* Defect Cost Impact Card — Shown ONLY when status is FAILED or REWORK */}
      {defectContext.active && (
        <DefectCostImpact
          status={defectContext.status}
          affectedMeters={defectContext.affectedMeters}
        />
      )}

      {/* QC Submission Form */}
      <QualityForm
        defectOptions={defectOptions}
        orderOptions={orderOptions}
        machineOptions={machineOptions}
        yarnBatchOptions={yarnBatchOptions}
        onSubmitQC={handleAddRoll}
        onStatusChange={handleStatusChange}
      />

      {/* Rolls Table with "View Passport" link */}
      {!loading && <RollsTable rolls={rollsList} />}
    </div>
  );
}

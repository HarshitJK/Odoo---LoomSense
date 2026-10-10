import { useAuth } from "../context/AuthContext.jsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ScanLine } from "lucide-react";
import PageHeader from "../components/common/PageHeader.jsx";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import MockBadge from "../components/common/MockBadge.jsx";

import useApi from "../hooks/useApi.js";
import { normaliseRolls, postQualityRoll } from "../api/quality.js";

// Only used when VITE_USE_MOCKS=true
import { rolls as mockRolls } from "../mocks/quality.js";
import { orders as mockOrders } from "../mocks/orders.js";
import { machines as mockMachines } from "../mocks/machines.js";
import { inventory as mockInventory } from "../mocks/inventory.js";

import RollsTable from "../components/quality/RollsTable.jsx";
import QualityForm from "../components/quality/QualityForm.jsx";
import DefectCostImpact from "../components/quality/DefectCostImpact.jsx";

export default function QualityPage() {
  const rolls = useApi("/api/quality", { mock: mockRolls, transform: normaliseRolls });
  const {user} = useAuth();
  const options = useApi("/api/quality/options");
  const orders = {...options, data: options.data?.orders};
  const machines = {...options, data: options.data?.machines};
  const batches = {...options, data: options.data?.batches};

  // Server result of the last FAILED / REWORK roll: { roll, impact, marginBefore, marginAfter }
  const [lastImpact, setLastImpact] = useState(null);

  const all = [rolls, orders, machines, batches];
  const error = all.map((r) => r.error).find(Boolean);
  const retryAll = () => all.forEach((r) => r.reload());
  const formReady = orders.data && machines.data && batches.data;

  const handleSubmitQC = async (body) => {
    const result = await postQualityRoll(body); // throws with the server's message on failure
    const bad = result.roll.status === "FAILED" || result.roll.status === "REWORK";
    setLastImpact(bad && user.role === "OWNER" ? result : null);
    rolls.reload();
    return result;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quality Control & Inspection"
        subtitle="Fabric quality checks, defect cost impact and traceability records (Feature 4)"
      />
      <MockBadge />

      <Link
        to="/scan"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm"
      >
        <ScanLine className="w-4 h-4" /> Scan a roll QR
      </Link>

      <ApiErrorBanner error={error} onRetry={retryAll} />

      {rolls.loading && !rolls.data && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading quality rolls…
        </div>
      )}

      {/* Defect Cost Impact Card — numbers come from the POST /api/quality response */}
      {lastImpact && <DefectCostImpact {...lastImpact} />}

      {/* QC Submission Form */}
      {formReady && (
        <QualityForm
          orders={orders.data}
          machines={machines.data}
          batches={batches.data}
          onSubmitQC={handleSubmitQC}
        />
      )}

      {/* Rolls Table with "View Passport" link */}
      {rolls.data && <RollsTable rolls={rolls.data} />}
    </div>
  );
}

import { useAuth } from "../context/AuthContext.jsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ScanLine } from "lucide-react";
import PageHeader from "../components/common/PageHeader.jsx";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import Button from "../components/common/Button.jsx";
import LoadingBlock from "../components/common/LoadingBlock.jsx";
import MockBadge from "../components/common/MockBadge.jsx";

import useApi from "../hooks/useApi.js";
import { normaliseRolls, postQualityRoll } from "../api/quality.js";

// Only used when VITE_USE_MOCKS=true
import { rolls as mockRolls } from "../mocks/quality.js";

import RollsTable from "../components/quality/RollsTable.jsx";
import QualityForm from "../components/quality/QualityForm.jsx";
import DefectCostImpact from "../components/quality/DefectCostImpact.jsx";

export default function QualityPage() {
  const rolls = useApi("/api/quality", { mock: mockRolls, transform: normaliseRolls });
  const { user } = useAuth();
  const options = useApi("/api/quality/options");
  const orders = { ...options, data: options.data?.orders };
  const machines = { ...options, data: options.data?.machines };
  const batches = { ...options, data: options.data?.batches };

  // Server result of the last failed or rework roll: { roll, impact, marginBefore, marginAfter }
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
    <>
      <PageHeader
        title="Quality checks"
        subtitle="Record each fabric roll, then look up recent results."
        action={
          <Button as={Link} to="/scan">
            <ScanLine size={16} aria-hidden="true" /> Scan QR code
          </Button>
        }
      />
      <MockBadge />
      <ApiErrorBanner error={error} onRetry={retryAll} />

      {!formReady && !error && <LoadingBlock label="Loading quality checks" height="h-40" />}

      {formReady && (
        <QualityForm orders={orders.data} machines={machines.data} batches={batches.data} onSubmitQC={handleSubmitQC} />
      )}

      {/* Numbers come from the POST /api/quality response */}
      {lastImpact && <DefectCostImpact {...lastImpact} />}

      {rolls.data && <RollsTable rolls={rolls.data} />}
    </>
  );
}

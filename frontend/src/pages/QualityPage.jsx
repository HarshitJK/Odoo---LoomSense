import { useAuth } from "../context/AuthContext.jsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ScanLine } from "lucide-react";
import PageHeader from "../components/common/PageHeader.jsx";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import Button from "../components/common/Button.jsx";
import LoadingBlock from "../components/common/LoadingBlock.jsx";
import MockBadge from "../components/common/MockBadge.jsx";

import client from "../api/client.js";
import useApi from "../hooks/useApi.js";
import { normaliseRolls, postQualityRoll } from "../api/quality.js";

// Only used when VITE_USE_MOCKS=true
import { rolls as mockRolls } from "../mocks/quality.js";

import RollsTable from "../components/quality/RollsTable.jsx";
import QualityForm from "../components/quality/QualityForm.jsx";
import PendingInspections from "../components/quality/PendingInspections.jsx";
import QualityHolds from "../components/quality/QualityHolds.jsx";
import DefectCostImpact from "../components/quality/DefectCostImpact.jsx";

export default function QualityPage() {
  const rolls = useApi("/api/quality", { mock: mockRolls, transform: normaliseRolls });
  const { user } = useAuth();
  const options = useApi("/api/quality/options");
  const pending = useApi("/api/quality/pending", { mock: [] }); // orders waiting for an inspection
  const holds = useApi("/api/quality/holds", { mock: [] }); // orders on quality hold
  const orders = { ...options, data: options.data?.orders };
  const machines = { ...options, data: options.data?.machines };
  const batches = { ...options, data: options.data?.batches };

  // Server result of the last failed or rework inspection: { roll, impact, marginBefore, marginAfter }
  const [lastImpact, setLastImpact] = useState(null);
  // What the form is for: an order picked from the waiting list, or the reinspection of a hold
  const [target, setTarget] = useState({ orderId: null, reinspect: false });

  const all = [rolls, orders, machines, batches, pending, holds];
  const error = all.map((r) => r.error).find(Boolean);
  const retryAll = () => all.forEach((r) => r.reload());
  const formReady = orders.data && machines.data && batches.data;
  const reinspection = target.reinspect ? holds.data?.find((h) => h.orderId === target.orderId) ?? null : null;

  const refresh = () => [rolls, options, pending, holds].forEach((r) => r.reload());

  const handleSubmitQC = async (body) => {
    const result = await postQualityRoll(body); // throws with the server's message on failure
    const bad = result.roll.status === "FAILED" || result.roll.status === "REWORK";
    setLastImpact(bad && user.role === "OWNER" ? result : null);
    refresh();
    return result;
  };

  const handleSetAction = async (inspectionId, correctiveAction) => {
    await client.patch(`/api/quality/${inspectionId}/corrective-action`, { correctiveAction });
    holds.reload();
  };

  const backToForm = () => setTarget({ orderId: null, reinspect: false });
  const focusForm = () => setTimeout(() => document.getElementById("quality-form")?.scrollIntoView({ behavior: "smooth" }), 50);

  return (
    <>
      <PageHeader
        title="Quality checks"
        subtitle="Check each stage as it finishes, and record rolls."
        action={
          <Button as={Link} to="/scan">
            <ScanLine size={16} aria-hidden="true" /> Scan QR code
          </Button>
        }
      />
      <MockBadge />
      <ApiErrorBanner error={error} onRetry={retryAll} />

      {!formReady && !error && <LoadingBlock label="Loading quality checks" height="h-40" />}

      {holds.data?.length > 0 && (
        <QualityHolds rows={holds.data} onReinspect={(hold) => { setTarget({ orderId: hold.orderId, reinspect: true }); focusForm(); }} />
      )}
      {pending.data?.length > 0 && (
        <PendingInspections rows={pending.data} onInspect={(orderId) => { setTarget({ orderId, reinspect: false }); focusForm(); }} />
      )}

      <div id="quality-form">
        {formReady && (
          <QualityForm
            key={`${target.orderId}-${target.reinspect}-${reinspection?.needsCorrectiveAction}`}
            orders={orders.data}
            machines={machines.data}
            batches={batches.data}
            presetOrderId={target.orderId}
            reinspection={reinspection}
            onSubmitQC={handleSubmitQC}
            onSetAction={handleSetAction}
            onDone={backToForm}
          />
        )}
      </div>

      {/* Numbers come from the POST /api/quality response */}
      {lastImpact && <DefectCostImpact {...lastImpact} />}

      {rolls.data && <RollsTable rolls={rolls.data} />}
    </>
  );
}

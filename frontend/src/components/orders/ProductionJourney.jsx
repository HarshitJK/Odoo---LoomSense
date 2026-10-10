import { useState } from "react";
import client from "../../api/client.js";
import useApi from "../../hooks/useApi.js";
import Button from "../common/Button.jsx";
import LoadingBlock from "../common/LoadingBlock.jsx";
import Notice from "../common/Notice.jsx";
import StatusBadge from "../common/StatusBadge.jsx";
import ApiErrorBanner from "../common/ApiErrorBanner.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { formatDateTime, formatMetres } from "../../utils/format.js";
import { correctiveActionLabel, inspectionTypeLabel, qcStageLabel, severityLabel, stageQcBadge, statusLabel } from "../../utils/labels.js";

const STATE_WORDS = { DONE: "Done", PENDING: "Not started" };
const stateWord = (state) => STATE_WORDS[state] ?? statusLabel(state);

/** One inspection line: what was checked, the result, when, and for a failure what is being done about it. */
function InspectionRow({ item }) {
  const failed = item.status === "FAILED" || item.status === "REWORK";
  // Only the owner receives the cost fields
  const loss = item.reworkCost === undefined ? null
    : (item.reworkCost ?? 0) + (item.additionalLabourCost ?? 0) + (item.additionalMachineCost ?? 0) + (item.scrapMaterialCost ?? 0);
  return (
    <li className="space-y-0.5 py-2 text-sm">
      <p className="flex flex-wrap items-center gap-2 text-gray-900">
        {item.legacy ? "Roll check" : inspectionTypeLabel(item.inspectionType)}
        <StatusBadge status={item.status} />
        <span className="text-xs text-gray-500">{formatDateTime(item.createdAt ?? item.producedAt)}</span>
      </p>
      {failed && (
        <p className="text-xs text-gray-600">
          {[item.defectType ?? item.defects?.[0], item.defectSeverity && `${severityLabel(item.defectSeverity)} severity`,
            item.affectedMeters ? `${formatMetres(item.affectedMeters)} affected` : null].filter(Boolean).join(", ")}
          {item.correctiveAction ? `. Action: ${correctiveActionLabel(item.correctiveAction).toLowerCase()}` : ". No action recorded yet"}
          {item.reinspectedBy?.length ? ". Reinspected" : ""}
          {loss ? `. Cost ${formatCurrency(loss)}` : ""}
        </p>
      )}
      {item.inspectionType === "REINSPECTION" && <p className="text-xs text-gray-600">Reinspection of a failed check.</p>}
    </li>
  );
}

/**
 * The stages of an order with the inspections done in each (GET /api/quality/order/{id}/timeline).
 * For stage-gated orders it also has the two stage buttons. They always call the API, so a refused move
 * (409) shows the server's reason here.
 * Props: order - the order object; onChanged(order) - called with the order after a stage move.
 */
export default function ProductionJourney({ order, onChanged }) {
  const timeline = useApi(`/api/quality/order/${order.orderId}/timeline`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function move(action) {
    setBusy(true);
    setError("");
    try {
      const res = await client.post(`/api/orders/${order.orderId}/stage/${action}`);
      onChanged(res.data);
      timeline.reload();
    } catch (e) {
      setError(e.response?.data?.detail || "That did not work. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const now = order.gated ? stageQcBadge(order.stageStatus, order.pendingInspectionType) : null;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Production journey</h3>

      {order.gated && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-gray-900">
          Now: {qcStageLabel(order.currentStage)}
          <StatusBadge label={now?.label ?? "In progress"} tone={now?.tone ?? "neutral"} />
        </p>
      )}
      {order.qualityHold && <Notice tone="warning">{order.qualityHold.holdReason}. Production is stopped until a reinspection passes.</Notice>}
      {!order.qualityHold && order.productionBlockReason && <Notice tone="info">{order.productionBlockReason}.</Notice>}

      {order.gated && (
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} onClick={() => move("complete")}>Mark stage complete</Button>
          <Button disabled={busy} onClick={() => move("advance")}>Move to next stage</Button>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <ApiErrorBanner error={timeline.error} onRetry={timeline.reload} />
      {timeline.loading && !timeline.data && <LoadingBlock label="Loading the journey" />}
      {timeline.data && (
        <ol className="divide-y divide-gray-200 rounded-md border border-gray-200">
          {timeline.data.stages.map((stage) => (
            <li key={stage.stage} className="px-4 py-3">
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span className={stage.state === "PENDING" ? "text-gray-500" : "font-medium text-gray-900"}>{qcStageLabel(stage.stage)}</span>
                <span className="text-xs text-gray-600">{stateWord(stage.state)}</span>
              </p>
              {stage.inspections.length > 0 && (
                <ul className="mt-1 divide-y divide-gray-100">
                  {stage.inspections.map((item) => <InspectionRow key={item.inspectionId ?? item.rollId} item={item} />)}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

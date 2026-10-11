import useApi from "../../hooks/useApi.js";
import Card from "../common/Card.jsx";
import StatusBadge from "../common/StatusBadge.jsx";
import { formatDateTime, formatMetres } from "../../utils/format.js";
import { qcStageLabel, reasonLabel } from "../../utils/labels.js";

/** Orders that are paused or cancelled, so a stopped order is never mistaken for a missing one. */
export default function StoppedOrders() {
  const orders = useApi("/api/orders");
  const stopped = (orders.data ?? []).filter((o) => o.status === "CANCELLED" || o.stageStatus === "PAUSED");
  if (stopped.length === 0) return null;
  return (
    <Card title="Paused and cancelled orders">
      <ul className="mt-3 divide-y divide-gray-200">
        {stopped.map((o) => {
          const cancelled = o.status === "CANCELLED";
          return (
            <li key={o.orderId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span className="font-medium text-gray-900">{o.orderId}</span>
              <StatusBadge status={cancelled ? "CANCELLED" : "PAUSED"} />
              <span className="text-gray-600">
                {cancelled
                  ? `Stopped at ${qcStageLabel(o.cancelledAtStage)}, ${formatMetres(o.producedMeters)} made. ${reasonLabel(o.cancelReason)}, ${formatDateTime(o.cancelledAt)}`
                  : `${qcStageLabel(o.currentStage)}, ${formatMetres(o.producedMeters)} of ${formatMetres(o.quantityMeters)}. ${reasonLabel(o.pauseReason)}, ${formatDateTime(o.pausedAt)}`}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

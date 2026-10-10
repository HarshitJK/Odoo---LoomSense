import Card from "../common/Card.jsx";
import ProgressBar from "../common/ProgressBar.jsx";
import StatusBadge from "../common/StatusBadge.jsx";
import TrackingTimeline from "./TrackingTimeline.jsx";
import { formatDate, formatMetres } from "../../utils/format.js";

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gray-200 py-3 last:border-0">
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd className="text-right text-sm text-gray-900">{children}</dd>
    </div>
  );
}

/** What the buyer sees: the order, one progress bar, the stages, and the dates and statuses. Nothing internal. */
export default function OrderSummaryCard({ order }) {
  if (!order) return null;

  return (
    <>
      <Card>
        <dl>
          <Row label="Buyer">{order.buyerName}</Row>
          <Row label="Fabric">{order.fabricType}</Row>
          <Row label="Colour">{order.colour}</Row>
          <Row label="Quantity">{formatMetres(order.quantityMeters)}</Row>
        </dl>
      </Card>

      <Card title="Progress">
        <div className="mt-3 space-y-5">
          <ProgressBar value={order.progress} label="Order complete" />
          <TrackingTimeline stages={order.stages} />
        </div>
      </Card>

      <Card>
        <dl>
          <Row label="Expected completion">{formatDate(order.expectedCompletion, "Not set yet")}</Row>
          <Row label="Quality">
            {order.qualityMessage ? <StatusBadge label={order.qualityMessage} tone={order.qualityStatus === "PASSED" ? "good" : "warn"} /> : <StatusBadge status={order.qualityStatus} />}
          </Row>
          <Row label="Dispatch"><StatusBadge status={order.dispatchStatus} /></Row>
        </dl>
      </Card>
    </>
  );
}

import StatusBadge from "../common/StatusBadge.jsx";
import ProgressBar from "../common/ProgressBar.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { progressPercent } from "../../utils/calculations.js";
import { formatMetres } from "../../utils/format.js";

/**
 * MachineCard: compact, clickable card for one machine. Clicking opens MachineDetailPanel.
 * Shows only: machine and status, current order, metres done of target, cost so far.
 *
 * Props:
 *   machine - machine object (from ProductionPage state, live over the WebSocket)
 *   onClick - called when the card is opened
 */
export default function MachineCard({ machine, onClick }) {
  const { machineId, status, orderId, producedMeters, targetMeters, costPerHour, runtimeHours, orderMachineCost } = machine;

  const progress = progressPercent(producedMeters, targetMeters);
  // Prefer the server's number (orderMachineCost); compute only for mock data
  const attributedCost = orderMachineCost ?? costPerHour * runtimeHours;

  const open = () => onClick();
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  return (
    <div
      id={`machine-card-${machineId}`}
      role="button"
      tabIndex={0}
      aria-label={`${machineId}, open details`}
      onClick={open}
      onKeyDown={onKeyDown}
      className="cursor-pointer space-y-3 rounded-md border border-gray-200 bg-white p-4 hover:bg-gray-50"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-semibold text-gray-900">{machineId}</p>
        <StatusBadge status={status} />
      </div>

      <p className="text-sm text-gray-600">{orderId ? `Order ${orderId}` : "No order"}</p>

      {targetMeters > 0 && (
        <ProgressBar value={progress} label={`${formatMetres(producedMeters)} of ${formatMetres(targetMeters)}`} />
      )}

      <p className="flex justify-between gap-2 text-sm">
        <span className="text-gray-600">Cost so far</span>
        <span className="tabular-nums text-gray-900">{formatCurrency(Math.round(attributedCost))}</span>
      </p>
    </div>
  );
}

import Notice from "../common/Notice.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { formatPercent } from "../../utils/format.js";
import { statusLabel } from "../../utils/labels.js";

/**
 * Result of a failed or rework roll, exactly as calculated by the server
 * (POST /api/quality response): impact { additionalLabour, machineCost, materialLoss, total }
 * and the order margin before and after.
 */
export default function DefectCostImpact({ roll, impact, marginBefore, marginAfter }) {
  if (!roll || !impact) return null;
  const hasMargins = marginBefore != null && marginAfter != null;
  const verb = marginAfter < marginBefore ? "falls from" : "stays at";

  return (
    <Notice tone={roll.status === "FAILED" ? "error" : "warning"}>
      <p className="font-medium">
        Extra cost {formatCurrency(impact.total)}.
        {hasMargins &&
          (marginAfter === marginBefore
            ? ` Order margin stays at ${formatPercent(marginBefore)}.`
            : ` Order margin ${verb} ${formatPercent(marginBefore)} to ${formatPercent(marginAfter)}.`)}
      </p>
      <p className="mt-0.5 text-xs">
        Roll {roll.rollId}: {statusLabel(roll.status)}, {roll.affectedMeters} m affected
      </p>
      <ul className="mt-2 space-y-0.5">
        <li>Extra labour: {formatCurrency(impact.additionalLabour)}</li>
        <li>Machine time: {formatCurrency(impact.machineCost)}</li>
        <li>Yarn lost: {formatCurrency(impact.materialLoss)}</li>
      </ul>
    </Notice>
  );
}

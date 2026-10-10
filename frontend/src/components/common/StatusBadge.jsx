import { statusInfo } from "../../utils/labels.js";

const tones = {
  good: "bg-green-50 text-green-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-red-50 text-red-700",
  neutral: "bg-gray-100 text-gray-700",
};

/** Small text badge. Pass a status code (wording comes from utils/labels.js) or `label` and `tone` directly. */
export default function StatusBadge({ status, label, tone }) {
  const info = statusInfo(status);
  return (
    <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone ?? info.tone]}`}>
      {label ?? info.label}
    </span>
  );
}

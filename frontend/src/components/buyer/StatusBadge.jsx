// StatusBadge component for Buyer Tracking
export default function StatusBadge({ status = "" }) {
  const str = String(status || "");
  const norm = str.toUpperCase();

  let colorClasses = "bg-slate-100 text-slate-700 border-slate-200";

  if (norm === "PASSED" || norm === "DISPATCHED" || norm === "READY" || norm === "COMPLETED") {
    colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (norm === "IN_PROGRESS" || norm === "WEAVING" || norm === "SPINNING") {
    colorClasses = "bg-blue-50 text-blue-700 border-blue-200";
  } else if (norm === "PENDING" || norm === "NOT_DISPATCHED" || norm === "NOT_STARTED") {
    colorClasses = "bg-slate-100 text-slate-700 border-slate-200";
  } else if (norm === "FAILED") {
    colorClasses = "bg-red-50 text-red-700 border-red-200";
  }

  // Format label: replace underscores with spaces and title-case
  const displayLabel = str
    ? str
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Unknown";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses}`}
    >
      {displayLabel || "Unknown"}
    </span>
  );
}

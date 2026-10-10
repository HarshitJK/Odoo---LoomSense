// StatusBadge component for Quality and Operations
export default function StatusBadge({ status = "" }) {
  const norm = String(status).toUpperCase();

  let colorClasses = "bg-slate-100 text-slate-700 border-slate-200";

  if (norm === "PASSED" || norm === "RUNNING" || norm === "DONE") {
    colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (norm === "FAILED" || norm === "DOWN") {
    colorClasses = "bg-red-50 text-red-700 border-red-200";
  } else if (norm === "REWORK" || norm === "IN_PROGRESS" || norm === "PENDING" || norm === "WARNING") {
    colorClasses = "bg-amber-50 text-amber-800 border-amber-200";
  } else if (norm === "IDLE" || norm === "NONE") {
    colorClasses = "bg-slate-100 text-slate-600 border-slate-200";
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses}`}
    >
      {status || "UNKNOWN"}
    </span>
  );
}

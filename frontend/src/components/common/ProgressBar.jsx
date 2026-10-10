/** value is 0 to 100. `label` shows on the left and `detail` (default: the percentage) on the right. */
export default function ProgressBar({ value = 0, label, detail, className = "" }) {
  const pct = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  return (
    <div className={`w-full ${className}`}>
      {(label || detail !== null) && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs text-gray-600">
          <span>{label}</span>
          <span className="tabular-nums">{detail ?? `${pct}%`}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={typeof label === "string" ? label : "Progress"}
        className="h-2 w-full overflow-hidden rounded-sm bg-gray-200"
      >
        <div className="h-full bg-blue-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

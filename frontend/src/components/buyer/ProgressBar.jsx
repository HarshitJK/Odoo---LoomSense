// Minimal local ProgressBar component (as common/ProgressBar is not provided by Lead)
export default function ProgressBar({ value = 0, label }) {
  const clampedValue = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div className="w-full">
      {(label || value !== undefined) && (
        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
          <span>{label || "Production Progress"}</span>
          <span className="font-mono text-sm text-blue-600">{clampedValue}%</span>
        </div>
      )}
      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}

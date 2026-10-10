import { AlertTriangle, RefreshCw } from "lucide-react";

/** Visible error for a failed API call: endpoint, status/message and a Retry button. */
export default function ApiErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Could not load data</p>
        <p className="break-words text-xs">
          <span className="font-mono">{error.endpoint}</span>
          {error.status ? ` · HTTP ${error.status}` : ""} · {error.message}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

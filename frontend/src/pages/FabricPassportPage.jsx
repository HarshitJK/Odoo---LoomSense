import { useParams, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

import useApi from "../hooks/useApi.js";
import { normalisePassport } from "../api/passport.js";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import MockBadge from "../components/common/MockBadge.jsx";

// Only used when VITE_USE_MOCKS=true
import { getRollById as getRollFromMock } from "../mocks/quality.js";

import StatusBadge from "../components/quality/StatusBadge.jsx";
import { ShieldCheck, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";

// Helper to format ISO/date string nicely: "10 Oct 2026, 2:30 PM"
function formatProductionDate(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export default function FabricPassportPage() {
  const { rollId } = useParams();

  // Public endpoint: GET /api/passport/{rollId} (passport fields only, no costs)
  const { data: roll, loading, error, reload } = useApi(`/api/passport/${encodeURIComponent(rollId)}`, {
    transform: normalisePassport,
    mock: () => getRollFromMock(rollId),
  });
  const notFound = error?.status === 404 || (!loading && !error && !roll);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading fabric passport…</p>
        </div>
      </div>
    );
  }

  // The server is unreachable or failed (not a 404): show the error, not "Roll Not Found"
  if (error && !notFound) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <ApiErrorBanner error={error} onRetry={reload} />
        </div>
      </div>
    );
  }

  // Not Found state
  if (notFound || !roll) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Roll Not Found</h2>
          <p className="text-xs text-slate-500 mt-1">
            No digital passport could be found for Roll ID{" "}
            <span className="font-mono font-semibold text-slate-700">{rollId}</span>.
          </p>
          <div className="mt-6">
            <Link
              to="/quality"
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Quality Control
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // QR URL points to this page
  const qrUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/passport/${roll.rollId}`
      : `/passport/${roll.rollId}`;

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 flex flex-col items-center justify-center">
      {/* Mobile-First Passport Card (Max width 375px–448px) */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <MockBadge />
        {/* Header / Brand */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-1.5 text-blue-600">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-black tracking-wider uppercase">LoomSense</span>
            </div>
            <h1 className="text-base font-bold text-slate-900 mt-0.5">
              Fabric Digital Passport
            </h1>
          </div>
          <StatusBadge status={roll.status} />
        </div>

        {/* QR Code Section */}
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <div className="bg-white p-3 rounded-lg shadow-xs border border-slate-100">
            <QRCodeSVG value={qrUrl} size={160} />
          </div>
          <p className="text-[11px] font-mono font-semibold text-slate-700 mt-3 text-center">
            {roll.rollId}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 text-center">
            Scan to verify fabric origin, yarn batch & machine telemetry
          </p>
        </div>

        {/* Traceability Details (NO financial or wage data) */}
        <div className="space-y-3 divide-y divide-slate-100 text-xs">
          <div className="flex items-center justify-between pt-2">
            <span className="text-slate-500 font-medium">Roll ID</span>
            <span className="font-mono font-bold text-slate-900">{roll.rollId}</span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-slate-500 font-medium">Order Number</span>
            <span className="font-semibold text-slate-800">{roll.orderId}</span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-slate-500 font-medium">Buyer</span>
            <span className="font-semibold text-slate-800">{roll.buyer}</span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-slate-500 font-medium">Yarn Batch</span>
            <span className="font-mono font-semibold text-slate-800">{roll.yarnBatch}</span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-slate-500 font-medium">Machine</span>
            <span className="font-semibold text-slate-800">{roll.machineId}</span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-slate-500 font-medium">Shift</span>
            <span className="font-semibold text-slate-800">Shift {roll.shift}</span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-slate-500 font-medium">Production Timestamp</span>
            <span className="text-slate-700">{formatProductionDate(roll.producedAt)}</span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-slate-500 font-medium">Defects</span>
            <span>
              {roll.defects && roll.defects.length > 0 ? (
                <span className="text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  {roll.defects.join(", ")}
                </span>
              ) : (
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  None
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-slate-500 font-medium">Rework Status</span>
            <span className="font-medium text-slate-700">{roll.reworkStatus || "NONE"}</span>
          </div>
        </div>

        {/* Footer Seal */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Traceability
          </span>
          <Link to="/quality" className="text-blue-600 hover:underline">
            Back to Factory QC
          </Link>
        </div>
      </div>
    </div>
  );
}

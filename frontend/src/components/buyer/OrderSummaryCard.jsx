import ProgressBar from "./ProgressBar.jsx";
import StatusBadge from "./StatusBadge.jsx";
import TrackingTimeline from "./TrackingTimeline.jsx";
import { Calendar, Package, Building2 } from "lucide-react";

function formatCompletionDate(dateStr) {
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

export default function OrderSummaryCard({ order }) {
  if (!order) return null;

  return (
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Live Order Status
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            {order.orderId}
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-700">{order.buyerName}</span>
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-1.5">
          <StatusBadge status={order.dispatchStatus} />
          <StatusBadge status={order.qualityStatus} />
        </div>
      </div>

      {/* Fabric & Quantity Metadata */}
      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 text-xs">
        <div>
          <span className="text-slate-400 font-semibold block text-[10px] uppercase">
            Fabric & Colour
          </span>
          <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
            {order.fabricType} · {order.colour}
          </span>
        </div>
        <div>
          <span className="text-slate-400 font-semibold block text-[10px] uppercase">
            Order Quantity
          </span>
          <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
            {order.quantityMeters?.toLocaleString("en-IN")} metres
          </span>
        </div>
      </div>

      {/* Big Progress Bar */}
      <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
        <ProgressBar value={order.progress} label="Overall Order Progress" />
      </div>

      {/* Expected Completion Date */}
      <div className="flex items-center gap-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-700">
        <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600">
          <Calendar className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Expected Completion
          </span>
          <span className="font-bold text-slate-900 text-sm">
            {formatCompletionDate(order.expectedCompletion)}
          </span>
        </div>
      </div>

      {/* Vertical Timeline */}
      <div className="pt-2 border-t border-slate-100">
        <TrackingTimeline stages={order.stages} />
      </div>

      {/* Footer Navigation */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-end text-xs">

        <span className="text-slate-400 text-[11px]">
          LoomSense Buyer Transparency
        </span>
      </div>
    </div>
  );
}

import { useParams, useNavigate } from "react-router-dom";
import useApi from "../hooks/useApi.js";
import ApiErrorBanner from "../components/common/ApiErrorBanner.jsx";
import MockBadge from "../components/common/MockBadge.jsx";
import TrackSearchCard from "../components/buyer/TrackSearchCard.jsx";
import OrderSummaryCard from "../components/buyer/OrderSummaryCard.jsx";
import { SearchX, ArrowLeft, Loader2 } from "lucide-react";

// Only used when VITE_USE_MOCKS=true: the mock has plain stage names, the API has { name, state }
import { getTrackingByOrderId } from "../mocks/buyerTracking.js";

function mockTracking(orderId) {
  const order = getTrackingByOrderId(orderId);
  if (!order) return null;
  const current = order.stages.indexOf(order.currentStage);
  return {
    ...order,
    stages: order.stages.map((name, i) => ({
      name,
      state: i < current ? "DONE" : i === current ? "IN_PROGRESS" : "PENDING",
      ...(i === current && { progress: order.progress }),
    })),
  };
}

export default function BuyerTrackingPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const isSearch = !orderId || orderId.toLowerCase() === "search";

  // Public, buyer-safe endpoint: GET /api/buyer/track/{orderId} (ORD104 and ORD-104 both work)
  const { data: order, loading, error, reload } = useApi(
    `/api/buyer/track/${encodeURIComponent(orderId ?? "")}`,
    { enabled: !isSearch, mock: () => mockTracking(orderId) }
  );

  // 1. Search Screen: Shown when no orderId param is present or when accessing /track/search
  if (isSearch) {
    return (
      <div className="min-h-screen bg-slate-100 py-10 px-4 flex flex-col items-center justify-center">
        <TrackSearchCard />
      </div>
    );
  }

  // 2. Loading
  if (loading && !order && !error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // 3. Server or network problem (not a 404): show the error with Retry
  if (error && error.status !== 404) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <ApiErrorBanner error={error} onRetry={reload} />
        </div>
      </div>
    );
  }

  // 4. Not Found Screen
  if (!order) {
    return (
      <div className="min-h-screen bg-slate-100 py-10 px-4 flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 text-center space-y-5">
          <div className="mx-auto w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
            <SearchX className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Tracking ID Not Found</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              We couldn&apos;t find that tracking ID. Please check and try again.
            </p>
            <p className="mt-1 font-mono text-xs font-semibold text-slate-700 bg-slate-50 py-1 px-2 rounded inline-block">
              {orderId}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate("/track")}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Search
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Order Tracking Result Screen
  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 flex flex-col items-center justify-center gap-3">
      <MockBadge />
      <OrderSummaryCard
        order={order}
        onTrackAnother={() => navigate("/track")}
      />
    </div>
  );
}

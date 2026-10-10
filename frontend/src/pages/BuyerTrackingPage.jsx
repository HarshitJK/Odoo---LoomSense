import { useParams, useNavigate } from "react-router-dom";
import { getTrackingByOrderId } from "../mocks/buyerTracking.js";
import TrackSearchCard from "../components/buyer/TrackSearchCard.jsx";
import OrderSummaryCard from "../components/buyer/OrderSummaryCard.jsx";
import { SearchX, ArrowLeft } from "lucide-react";

export default function BuyerTrackingPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  // 1. Search Screen: Shown when no orderId param is present or when accessing /track/search
  if (!orderId || orderId.toLowerCase() === "search") {
    return (
      <div className="min-h-screen bg-slate-100 py-10 px-4 flex flex-col items-center justify-center">
        <TrackSearchCard />
      </div>
    );
  }

  // 2. Look up the order (case-insensitive and hyphen-tolerant)
  const order = getTrackingByOrderId(orderId);

  // 3. Not Found Screen
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

  // 4. Order Tracking Result Screen
  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 flex flex-col items-center justify-center">
      <OrderSummaryCard
        order={order}
        onTrackAnother={() => navigate("/track")}
      />
    </div>
  );
}

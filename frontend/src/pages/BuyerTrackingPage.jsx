import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Link2Off, WifiOff, RefreshCw } from "lucide-react";
import { publicClient } from "../api/client.js";
import OrderSummaryCard from "../components/buyer/OrderSummaryCard.jsx";

const page = "min-h-screen bg-slate-100 py-10 px-4 flex flex-col items-center justify-center";
const panel = "w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 text-center space-y-4";

/** Keeps search engines away from private tracking pages while the page is shown. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

/**
 * Public, read-only buyer page reached through the private link /track/:token.
 * The token is used exactly as it appears in the URL (no trimming, no case change).
 * There is no login and no link to any internal page.
 */
export default function BuyerTrackingPage() {
  const { token } = useParams();
  const [state, setState] = useState({ status: token ? "loading" : "idle", order: null });
  useNoIndex();

  const load = useCallback(() => {
    if (!token) return undefined;
    let cancelled = false;
    setState({ status: "loading", order: null });
    publicClient
      .get(`/api/buyer/track/${encodeURIComponent(token)}`)
      .then((res) => !cancelled && setState({ status: "ok", order: res.data }))
      .catch((err) => {
        if (cancelled) return;
        // 404 = unknown, malformed or replaced token; anything else is a temporary problem
        setState({ status: err.response?.status === 404 ? "invalid" : "error", order: null });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => load(), [load]);

  if (!token) {
    return (
      <div className={page}>
        <div className={panel}>
          <h1 className="text-lg font-bold text-slate-900">Order tracking</h1>
          <p className="text-sm text-slate-500">
            Tracking is available through the private link supplied by your supplier. Please open that link to see your order.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className={page}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-label="Loading" />
      </div>
    );
  }

  if (state.status === "invalid") {
    return (
      <div className={page}>
        <div className={panel}>
          <Link2Off className="mx-auto h-8 w-8 text-amber-600" />
          <h1 className="text-lg font-bold text-slate-900">Tracking link not valid</h1>
          <p className="text-sm text-slate-500">
            This tracking link is not valid or has been replaced. Please contact your supplier.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={page}>
        <div className={panel}>
          <WifiOff className="mx-auto h-8 w-8 text-slate-500" />
          <h1 className="text-lg font-bold text-slate-900">Could not load your order</h1>
          <p className="text-sm text-slate-500">We could not reach the server. Check your connection and try again.</p>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${page} gap-3`}>
      <OrderSummaryCard order={state.order} />
    </div>
  );
}

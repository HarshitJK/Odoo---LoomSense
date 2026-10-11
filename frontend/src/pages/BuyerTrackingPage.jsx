import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { publicClient } from "../api/client.js";
import Button from "../components/common/Button.jsx";
import LoadingBlock from "../components/common/LoadingBlock.jsx";
import Notice from "../components/common/Notice.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import PublicPage from "../components/common/PublicPage.jsx";
import PublicBack from "../components/common/PublicBack.jsx";
import OrderSummaryCard from "../components/buyer/OrderSummaryCard.jsx";

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
      <PublicPage action={<PublicBack authenticatedOnly />}>
        <PageHeader title="Order tracking" subtitle="Follow your order with the link from your supplier." />
        <Notice tone="info">Tracking is available through the link your supplier sent you. Open that link to see your order.</Notice>
      </PublicPage>
    );
  }

  if (state.status === "loading") {
    return (
      <PublicPage action={<PublicBack authenticatedOnly />}>
        <LoadingBlock label="Loading your order" height="h-40" />
      </PublicPage>
    );
  }

  if (state.status === "invalid") {
    return (
      <PublicPage action={<PublicBack authenticatedOnly />}>
        <PageHeader title="Order tracking" />
        <Notice tone="error">This tracking link is not valid or has been replaced. Please contact your supplier.</Notice>
      </PublicPage>
    );
  }

  if (state.status === "error") {
    return (
      <PublicPage action={<PublicBack authenticatedOnly />}>
        <PageHeader title="Order tracking" />
        <Notice
          tone="error"
          action={<Button onClick={load}>Try again</Button>}
        >
          Could not load your order. Check your connection and try again.
        </Notice>
      </PublicPage>
    );
  }

  return (
    <PublicPage action={<PublicBack authenticatedOnly />}>
      <PageHeader title="Your order" subtitle="Where your order is right now." />
      <OrderSummaryCard order={state.order} />
    </PublicPage>
  );
}

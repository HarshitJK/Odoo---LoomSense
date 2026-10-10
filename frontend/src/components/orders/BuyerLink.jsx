import { useRef, useState } from "react";
import client from "../../api/client.js";

const button = "border border-slate-300 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50";

/**
 * The private buyer tracking link of one order: read-only URL, copy, open and regenerate.
 * `order.trackingUrl` comes from GET /api/orders; regenerating replaces it through `onChange`.
 */
export default function BuyerLink({ order, onChange }) {
  const field = useRef(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    let done = false;
    try {
      await navigator.clipboard.writeText(order.trackingUrl);
      done = true;
    } catch {
      field.current?.select(); // clipboard blocked (for example plain http): select the text and copy it by hand
      try { done = document.execCommand("copy"); } catch { done = false; }
    }
    setCopied(done);
    if (done) setTimeout(() => setCopied(false), 2000);
  }

  async function regenerate() {
    if (!window.confirm("The old link will stop working. Generate a new buyer link?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await client.post(`/api/orders/${order.orderId}/tracking/regenerate`);
      onChange({ ...order, trackingToken: res.data.trackingToken, trackingUrl: res.data.trackingUrl });
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!order.trackingUrl) return null;
  return (
    <section aria-label="Buyer link" className="space-y-2">
      <h3 className="font-bold">Buyer link</h3>
      <p className="text-xs text-slate-500">Share this private link with the buyer. Anyone with the link can see this order&apos;s progress, without logging in.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={field} readOnly aria-label="Buyer tracking link" value={order.trackingUrl}
          onFocus={(e) => e.target.select()} className="border border-slate-300 rounded-lg p-2 text-sm min-w-0 flex-1 font-mono" />
        <button type="button" className={button} onClick={copy}>Copy link</button>
        <a className={button} href={order.trackingUrl} target="_blank" rel="noopener noreferrer">Open</a>
        <button type="button" className={button} disabled={busy} onClick={regenerate}>Regenerate</button>
        <span role="status" className="text-sm text-green-700">{copied ? "Copied" : ""}</span>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}

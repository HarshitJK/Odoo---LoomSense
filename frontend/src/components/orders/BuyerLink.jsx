import { useRef, useState } from "react";
import client from "../../api/client.js";
import Button from "../common/Button.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import { Input } from "../common/FormField.jsx";
import Notice from "../common/Notice.jsx";

/**
 * The private buyer tracking link of one order: read-only link, copy, open and regenerate.
 * `order.trackingUrl` comes from GET /api/orders; regenerating replaces it through `onChange`.
 */
export default function BuyerLink({ order, onChange }) {
  const field = useRef(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    let done = false;
    try {
      await navigator.clipboard.writeText(order.trackingUrl);
      done = true;
    } catch {
      field.current?.select(); // clipboard blocked (for example plain http): select the text so it can be copied by hand
      try {
        done = document.execCommand("copy");
      } catch {
        done = false;
      }
    }
    setCopied(done);
    if (done) setTimeout(() => setCopied(false), 2000);
  }

  async function regenerate() {
    setAsking(false);
    setBusy(true);
    setError("");
    try {
      const res = await client.post(`/api/orders/${order.orderId}/tracking/regenerate`);
      onChange({ ...order, trackingToken: res.data.trackingToken, trackingUrl: res.data.trackingUrl });
    } catch {
      setError("Could not create a new link. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!order.trackingUrl) return null;
  return (
    <section aria-label="Buyer link" className="space-y-3">
      <p className="text-sm text-gray-600">Send this link to the buyer. Anyone with it can follow this order without signing in.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          ref={field}
          readOnly
          aria-label="Buyer tracking link"
          value={order.trackingUrl}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1"
        />
        <Button variant="primary" onClick={copy}>Copy link</Button>
        <Button as="a" href={order.trackingUrl} target="_blank" rel="noopener noreferrer">Open</Button>
        <Button variant="danger" disabled={busy} onClick={() => setAsking(true)}>Regenerate</Button>
        <span role="status" className="text-sm text-green-700">{copied ? "Copied" : ""}</span>
      </div>
      {error && <Notice tone="error">{error}</Notice>}

      <ConfirmDialog
        open={asking}
        title="Make a new buyer link?"
        message="The old link will stop working. Send the new link to the buyer."
        confirmLabel="Make new link"
        onConfirm={regenerate}
        onCancel={() => setAsking(false)}
      />
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import client from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Button from "../common/Button.jsx";
import FormField, { Select, controlClass } from "../common/FormField.jsx";
import Notice from "../common/Notice.jsx";
import StatusBadge from "../common/StatusBadge.jsx";
import { formatDateTime } from "../../utils/format.js";
import { CANCEL_REASONS, PAUSE_REASONS, qcStageLabel, reasonLabel } from "../../utils/labels.js";

const FINISHED = ["DISPATCHED", "COMPLETED", "DELIVERED"];
const NEEDS_QC = ["WEAVING", "PROCESSING", "FINISHING", "FINAL_QC"];
const textareaClass = controlClass.replace(/h-10 sm:h-9 ?/, "h-auto py-2 ");
const failureText = (e) => e.response?.data?.detail || "That did not work. Check your connection and try again.";

/** A centred box over a dimmed page. Escape or a click outside closes it. */
function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-full w-full max-w-md overflow-y-auto rounded-md border border-gray-200 bg-white p-5 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function ReasonFields({ reasons, reason, setReason, notes, setNotes, disabled }) {
  return (
    <>
      <FormField label="Reason" required>
        <Select required value={reason} onChange={(e) => setReason(e.target.value)} disabled={disabled}>
          <option value="">Choose a reason</option>
          {reasons.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Select>
      </FormField>
      <FormField label="Notes">
        <textarea className={textareaClass} rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={disabled} />
      </FormField>
    </>
  );
}

/** Shown instead of the actions once an order is cancelled: the reason, who, when and where production stopped. */
export function CancelledBanner({ order }) {
  const facts = [
    order.cancelReason && `Reason: ${reasonLabel(order.cancelReason)}`,
    order.cancelledBy && `Cancelled by ${order.cancelledBy}`,
    order.cancelledAt && `on ${formatDateTime(order.cancelledAt)}`,
    order.cancelledAtStage && `Production stopped at ${qcStageLabel(order.cancelledAtStage)}`,
  ].filter(Boolean);
  return (
    <Notice tone="info">
      <p className="font-medium text-gray-900">This order is cancelled</p>
      {facts.length > 0 && <p className="mt-1">{facts.join(". ")}.</p>}
      {order.cancelNotes && <p className="mt-1">{order.cancelNotes}</p>}
      <p className="mt-1">Production history, material usage, wages, machine usage and costs are kept.</p>
    </Notice>
  );
}

/**
 * The actions that fit the order state and the user role, with their dialogs.
 * Every action calls the API and then hands the updated order to onChanged, so the page refreshes at once.
 * Props: order - the order object; onChanged(order) - called with the order after any action.
 */
export default function ProductionControls({ order, onChanged }) {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const [dialog, setDialog] = useState(null); // "pause" | "change" | "cancel"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [newMachine, setNewMachine] = useState("");
  const [machines, setMachines] = useState(null);

  if (order.status === "CANCELLED") return <CancelledBanner order={order} />;
  if (FINISHED.includes(order.status)) return null;

  const state = order.stageStatus;
  const paused = state === "PAUSED";
  const running = state === "IN_PROGRESS";
  const currentMachine = order.pausedMachines?.[0] ?? order.machineId;

  function open(name) {
    setDialog(name);
    setReason("");
    setNotes("");
    setNewMachine("");
    setError("");
    setMachines(null);
    if (name === "change") {
      client.get(`/api/orders/${order.orderId}/available-machines`)
        .then((r) => setMachines(r.data.filter((m) => m.machineId !== currentMachine)))
        .catch((e) => { setMachines([]); setError(failureText(e)); });
    }
  }

  const close = () => !busy && setDialog(null);

  async function run(steps, closeAfter = true) {
    setBusy(true);
    setError("");
    try {
      let last;
      for (const [path, body] of steps) last = await client.post(`/api/orders/${order.orderId}/${path}`, body);
      onChanged(last.data);
      if (closeAfter) setDialog(null);
    } catch (e) {
      setError(failureText(e));
      // an earlier step may have worked (the pause before a machine change): show the real state
      client.get(`/api/orders/${order.orderId}`).then((r) => onChanged(r.data)).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  const submit = (e, steps) => {
    e.preventDefault();
    run(steps);
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Production controls</h3>
      {paused && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-gray-900">
          <StatusBadge status="PAUSED" />
          {order.pauseReason ? `Reason: ${reasonLabel(order.pauseReason)}` : null}
        </p>
      )}
      {state === "QC_PENDING" && <p className="text-sm text-gray-900">Waiting for QC inspection</p>}
      {state === "QUALITY_HOLD" && <p className="text-sm text-gray-900">On quality hold. Record a corrective action and pass a reinspection to continue.</p>}

      <div className="flex flex-wrap gap-3">
        {running && <Button disabled={busy} onClick={() => open("pause")}>Pause production</Button>}
        {running && order.gated && (
          <Button disabled={busy} onClick={() => run([["stage/complete"]], false)}>
            {NEEDS_QC.includes(order.currentStage) ? "Send for QC" : "Complete stage"}
          </Button>
        )}
        {paused && <Button variant="primary" disabled={busy} onClick={() => run([["resume", {}]], false)}>{busy ? "Working" : "Resume production"}</Button>}
        {(paused || running) && <Button disabled={busy} onClick={() => open("change")}>Change machine</Button>}
        {isOwner && <Button variant="danger" disabled={busy} onClick={() => open("cancel")}>Cancel order</Button>}
      </div>
      {!dialog && error && <Notice tone="error">{error}</Notice>}

      {dialog === "pause" && (
        <Modal title="Pause production" onClose={close}>
          <form className="space-y-4" onSubmit={(e) => submit(e, [["pause", { reason, notes: notes || null }]])}>
            <p className="text-sm text-gray-600">The machine stops and its session ends. Resume later on the same machine or another one.</p>
            <ReasonFields reasons={PAUSE_REASONS} {...{ reason, setReason, notes, setNotes }} disabled={busy} />
            {error && <Notice tone="error">{error}</Notice>}
            <div className="flex justify-end gap-3">
              <Button disabled={busy} onClick={close}>Close</Button>
              <Button type="submit" variant="primary" disabled={busy}>{busy ? "Pausing" : "Pause production"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {dialog === "change" && (
        <Modal title="Change machine" onClose={close}>
          <form
            className="space-y-4"
            onSubmit={(e) => submit(e, [
              ...(paused ? [] : [["pause", { reason, notes: notes || null }]]),
              ["change-machine", { newMachineId: newMachine, reason, notes: notes || null }],
            ])}
          >
            <p className="text-sm text-gray-900">Current machine: <span className="font-medium">{currentMachine ?? "None"}</span></p>
            {!paused && <Notice tone="warning">This order is running. It will be paused first, then moved. Resume it afterwards to start on the new machine.</Notice>}
            <FormField label="New machine" required hint={machines && machines.length === 0 ? "No other machine is available right now." : undefined}>
              <Select required value={newMachine} onChange={(e) => setNewMachine(e.target.value)} disabled={busy || !machines}>
                <option value="">{machines ? "Choose a machine" : "Loading machines"}</option>
                {(machines ?? []).map((m) => <option key={m.machineId} value={m.machineId}>{m.name ?? m.machineId}</option>)}
              </Select>
            </FormField>
            <ReasonFields reasons={PAUSE_REASONS} {...{ reason, setReason, notes, setNotes }} disabled={busy} />
            {error && <Notice tone="error">{error}</Notice>}
            <div className="flex justify-end gap-3">
              <Button disabled={busy} onClick={close}>Close</Button>
              <Button type="submit" variant="primary" disabled={busy || !machines}>
                {busy ? "Working" : paused ? "Change machine" : "Pause and change machine"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {dialog === "cancel" && (
        <Modal title="Cancel order" onClose={close}>
          <form className="space-y-4" onSubmit={(e) => submit(e, [["cancel", { reason, notes: notes || null }]])}>
            <Notice tone="warning">
              This will stop all remaining production stages. Production history, material usage, wages, machine usage and costs already incurred will be preserved.
            </Notice>
            <ReasonFields reasons={CANCEL_REASONS} {...{ reason, setReason, notes, setNotes }} disabled={busy} />
            {error && <Notice tone="error">{error}</Notice>}
            <div className="flex justify-end gap-3">
              <Button disabled={busy} onClick={close}>Keep order</Button>
              <Button type="submit" variant="danger" disabled={busy}>{busy ? "Cancelling" : "Cancel order"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

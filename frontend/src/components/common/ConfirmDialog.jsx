import { useEffect, useRef } from "react";
import Button from "./Button.jsx";

/** Asks before a destructive action. Escape or Cancel closes it; focus starts on Cancel. */
export default function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-sm rounded-md border border-gray-200 bg-white p-5 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-base font-semibold text-gray-900">{title}</h2>
        <p id="confirm-message" className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button ref={cancelRef} onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

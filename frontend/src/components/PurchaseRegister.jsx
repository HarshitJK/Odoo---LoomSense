import { useState } from "react";
import client from "../api/client.js";
import useApi from "../hooks/useApi.js";
import ApiErrorBanner from "./common/ApiErrorBanner.jsx";
import Button from "./common/Button.jsx";
import Disclosure from "./common/Disclosure.jsx";
import FormField, { Input } from "./common/FormField.jsx";
import Notice from "./common/Notice.jsx";
import StatusBadge from "./common/StatusBadge.jsx";
import { Table, THead, Th, TBody, Tr, Td, useRowLimit, ShowAll } from "./common/Table.jsx";
import { formatCurrency as money } from "../utils/formatCurrency.js";
import { formatDate, formatKg } from "../utils/format.js";

const today = () => new Date().toLocaleDateString("en-CA");
const emptyForm = () => ({
  supplier: "", invoiceNumber: "", batchId: "", material: "Cotton Yarn", colour: "Navy Blue", quantityKg: "",
  costPerKg: "", otherCharges: 0, paidAmount: 0, purchaseDate: today(), notes: "", receiveInventory: true,
});

const REQUIRED_FIELDS = [
  ["supplier", "Supplier", "text"],
  ["invoiceNumber", "Invoice number", "text"],
  ["material", "Material", "text"],
  ["colour", "Colour", "text"],
  ["quantityKg", "Quantity (kg)", "number"],
  ["costPerKg", "Cost per kg (₹)", "number"],
  ["paidAmount", "Paid now (₹)", "number"],
  ["purchaseDate", "Date received", "date"],
];

/** Owner only: receive a delivery (POST /api/purchases) and list supplier bills (GET /api/purchases). */
export default function PurchaseRegister({ onReceive }) {
  const list = useApi("/api/purchases");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const bills = useRowLimit(list.data, 5);

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setSaved(false);
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { ...form, batchId: form.batchId || null };
      for (const k of ["quantityKg", "costPerKg", "otherCharges", "paidAmount"]) body[k] = Number(body[k]);
      await client.post("/api/purchases", body);
      setOpen(false);
      setForm(emptyForm());
      setSaved(true);
      list.reload();
      onReceive();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save this delivery. Check the details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Disclosure title="Receive material and supplier bills">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "Cancel" : "Receive material"}
          </Button>
          {saved && <span role="status" className="text-sm text-green-700">Saved</span>}
        </div>

        <ApiErrorBanner error={list.error} onRetry={list.reload} />
        {error && <Notice tone="error">{error}</Notice>}

        {open && (
          <form onSubmit={submit} className="space-y-4 rounded-md border border-gray-200 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {REQUIRED_FIELDS.map(([key, label, type]) => (
                <FormField key={key} label={label} required>
                  <Input
                    required
                    type={type}
                    min={key === "quantityKg" ? 0.01 : type === "number" ? 0 : undefined}
                    step={type === "number" ? "0.01" : undefined}
                    value={form[key]}
                    onChange={set(key)}
                  />
                </FormField>
              ))}
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-blue-700">More options</summary>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Add to an existing batch" hint="Leave blank to create a new batch.">
                  <Input value={form.batchId} onChange={set("batchId")} />
                </FormField>
                <FormField label="Other charges (₹)">
                  <Input type="number" min="0" step="0.01" value={form.otherCharges} onChange={set("otherCharges")} />
                </FormField>
                <FormField label="Notes">
                  <Input value={form.notes} onChange={set("notes")} />
                </FormField>
                <label className="flex items-center gap-2 self-end pb-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-700"
                    checked={form.receiveInventory}
                    onChange={(e) => setForm({ ...form, receiveInventory: e.target.checked })}
                  />
                  Add to stock
                </label>
              </div>
            </details>

            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Saving" : "Save delivery"}
            </Button>
          </form>
        )}

        <div className="rounded-md border border-gray-200">
          <Table caption="Supplier bills">
            <THead>
              <Th>Date received</Th>
              <Th>Supplier</Th>
              <Th align="right">Quantity</Th>
              <Th align="right">Bill</Th>
              <Th align="right">Paid</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {bills.visible.map((p) => (
                <Tr key={p.purchaseId}>
                  <Td header>{formatDate(p.purchaseDate)}</Td>
                  <Td>{p.supplier}</Td>
                  <Td align="right">{formatKg(p.quantityKg)}</Td>
                  <Td align="right">{money(p.totalAmount)}</Td>
                  <Td align="right">{money(p.paidAmount)}</Td>
                  <Td>
                    <StatusBadge status={p.paymentStatus} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <ShowAll limiter={bills} noun="bills" />
          {list.data?.length === 0 && <p className="px-4 py-4 text-sm text-gray-600">No supplier bills yet. Use Receive material to add one.</p>}
        </div>
      </div>
    </Disclosure>
  );
}

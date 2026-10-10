import { useState } from "react";
import Button from "../common/Button.jsx";
import Card from "../common/Card.jsx";
import FormField, { Input, Select } from "../common/FormField.jsx";
import Notice from "../common/Notice.jsx";
import { DEFECT_CHOICES, QUALITY_RESULTS } from "../../utils/labels.js";

/**
 * Quality inspection form.
 *   orders, machines, batches - the real records from GET /api/quality/options
 *   onSubmitQC(body)          - async; posts to the API and throws with the server's message on failure
 * Choosing an order sets its machine and yarn batch, as before; they are not shown.
 */
export default function QualityForm({ orders = [], machines = [], batches = [], onSubmitQC }) {
  const emptyForm = () => {
    const first = orders[0];
    return {
      rollId: "",
      orderId: first?.orderId ?? "",
      machineId: first?.machineId ?? machines[0]?.machineId ?? "",
      yarnBatch: first?.yarnBatch ?? batches[0]?.batchId ?? "",
      status: "PASSED",
      selectedDefects: [],
      affectedMeters: "",
    };
  };

  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const needsMetres = formData.status === "FAILED" || formData.status === "REWORK";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "orderId") {
        const order = orders.find((o) => o.orderId === value);
        if (order?.machineId) updated.machineId = order.machineId;
        if (order?.yarnBatch) updated.yarnBatch = order.yarnBatch;
      }
      return updated;
    });
    if (error) setError("");
    if (notice) setNotice("");
  };

  const handleDefectToggle = (defect) => {
    setFormData((prev) => {
      const exists = prev.selectedDefects.includes(defect);
      return {
        ...prev,
        selectedDefects: exists ? prev.selectedDefects.filter((d) => d !== defect) : [...prev.selectedDefects, defect],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const metres = parseFloat(formData.affectedMeters);
    if (!formData.orderId) return setError("Choose an order.");
    if (needsMetres && !(metres >= 1)) return setError("Enter the affected metres, at least 1, for a failed or rework roll.");

    const body = {
      orderId: formData.orderId,
      machineId: formData.machineId || undefined,
      yarnBatch: formData.yarnBatch || undefined,
      status: formData.status,
      defects: needsMetres ? formData.selectedDefects : [],
      ...(formData.rollId.trim() && { rollId: formData.rollId.trim().toUpperCase() }),
      ...(needsMetres && { affectedMeters: metres }),
    };

    setSaving(true);
    try {
      const saved = await onSubmitQC(body);
      setFormData(emptyForm());
      setError("");
      setNotice(`Saved roll ${saved?.roll?.rollId ?? ""}`.trim());
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not save this roll. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Record a roll">
      <form onSubmit={handleSubmit} className="mt-3 space-y-5" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Roll" hint="Leave blank to number it automatically.">
            <Input name="rollId" value={formData.rollId} onChange={handleChange} autoCapitalize="characters" autoComplete="off" />
          </FormField>

          <FormField label="Order" required>
            <Select name="orderId" value={formData.orderId} onChange={handleChange}>
              {orders.map((o) => (
                <option key={o.orderId} value={o.orderId}>{o.orderId}, {o.buyerName}</option>
              ))}
            </Select>
          </FormField>
        </div>

        <fieldset>
          <legend className="mb-1 text-sm text-gray-900">Result <span className="text-gray-600">(required)</span></legend>
          <div className="grid grid-cols-3 gap-2 sm:max-w-md">
            {QUALITY_RESULTS.map(({ value, label }) => (
              <label
                key={value}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 has-[:checked]:border-blue-700 has-[:checked]:bg-blue-50 has-[:checked]:font-medium has-[:checked]:text-blue-700 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-700"
              >
                <input type="radio" name="status" value={value} checked={formData.status === value} onChange={handleChange} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {needsMetres && (
          <div className="grid grid-cols-1 gap-5 border-t border-gray-200 pt-4 sm:grid-cols-2">
            <FormField label="Affected metres" required>
              <Input type="number" inputMode="numeric" min="1" step="1" name="affectedMeters" value={formData.affectedMeters} onChange={handleChange} />
            </FormField>

            <fieldset>
              <legend className="mb-1 text-sm text-gray-900">Defects</legend>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {DEFECT_CHOICES.map((defect) => (
                  <label key={defect} className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-gray-900">
                    <input
                      type="checkbox"
                      checked={formData.selectedDefects.includes(defect)}
                      onChange={() => handleDefectToggle(defect)}
                      className="h-4 w-4 accent-blue-700"
                    />
                    {defect}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}

        <Button type="submit" variant="primary" disabled={saving} className="w-full sm:w-auto">
          {saving ? "Saving" : "Save roll"}
        </Button>
      </form>
    </Card>
  );
}

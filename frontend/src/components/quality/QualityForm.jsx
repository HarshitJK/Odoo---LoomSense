import { useState } from "react";
import Button from "../common/Button.jsx";
import Card from "../common/Card.jsx";
import FormField, { Input, Select } from "../common/FormField.jsx";
import Notice from "../common/Notice.jsx";
import { formatMetres } from "../../utils/format.js";
import {
  CORRECTIVE_ACTIONS, DEFECT_CHOICES, QUALITY_RESULTS, SEVERITIES,
  inspectionTypeLabel, qcStageLabel, severityLabel,
} from "../../utils/labels.js";

/** Corrective actions to choose from; restarting the whole order is only for critical defects. */
function actionOptions(severity) {
  return CORRECTIVE_ACTIONS.filter((a) => a.value !== "FULL_RESTART" || severity === "CRITICAL");
}

/**
 * Quality inspection form.
 *   orders, machines, batches - from GET /api/quality/options (orders carry their stage and QC state)
 *   presetOrderId  - order chosen from the waiting list
 *   reinspection   - a row of GET /api/quality/holds: this form is then the reinspection of that failure
 *   onSubmitQC(body)               - async; posts to the API and throws with the server's message on failure
 *   onSetAction(inspectionId, action) - async; records the corrective action on the failed inspection
 *   onDone()       - called after a saved reinspection
 * A stage-gated order is inspected for its current stage (the server decides what is allowed). An old order
 * keeps the old roll check.
 */
export default function QualityForm({ orders = [], machines = [], batches = [], presetOrderId = null, reinspection = null,
  onSubmitQC, onSetAction, onDone }) {
  const emptyForm = () => {
    const first = orders.find((o) => o.orderId === (reinspection?.orderId ?? presetOrderId)) ?? orders[0];
    return {
      rollId: "",
      orderId: first?.orderId ?? "",
      machineId: first?.machineId ?? machines[0]?.machineId ?? "",
      yarnBatch: first?.yarnBatch ?? batches[0]?.batchId ?? "",
      status: "PASSED",
      selectedDefects: [],
      affectedMeters: "",
      defectType: DEFECT_CHOICES[0],
      defectSeverity: "MEDIUM",
      correctiveAction: "",
      reworkCost: "",
      notes: "",
    };
  };

  const [formData, setFormData] = useState(emptyForm);
  const [actionChoice, setActionChoice] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const order = orders.find((o) => o.orderId === formData.orderId);
  const gated = Boolean(order?.gated);
  // What this order can be inspected for right now (null = an old order: the old roll check)
  const kind = reinspection ? "REINSPECTION"
    : !gated ? null
    : order.stageStatus === "QUALITY_HOLD" ? "HOLD"
    : order.stageStatus === "QC_PENDING" ? order.pendingInspectionType
    : order.currentStage === "RAW_MATERIAL" ? "INCOMING_MATERIAL"
    : "NOTHING";
  const canInspect = !gated || !["HOLD", "NOTHING"].includes(kind);
  const needsAction = Boolean(reinspection?.needsCorrectiveAction);
  const bad = formData.status === "FAILED" || formData.status === "REWORK";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "orderId") {
        const next = orders.find((o) => o.orderId === value);
        if (next?.machineId) updated.machineId = next.machineId;
        if (next?.yarnBatch) updated.yarnBatch = next.yarnBatch;
      }
      if (name === "defectSeverity" && value !== "CRITICAL" && prev.correctiveAction === "FULL_RESTART") updated.correctiveAction = "";
      return updated;
    });
    setError("");
    setNotice("");
  };

  const toggleDefect = (defect) =>
    setFormData((prev) => ({
      ...prev,
      selectedDefects: prev.selectedDefects.includes(defect) ? prev.selectedDefects.filter((d) => d !== defect) : [...prev.selectedDefects, defect],
    }));

  async function saveAction() {
    if (!actionChoice) return setError("Choose what will be done about this failure.");
    setSaving(true);
    try {
      await onSetAction(reinspection.failedInspectionId, actionChoice);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not save the action. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function buildBody(metres) {
    if (!gated) {
      return {
        orderId: formData.orderId, machineId: formData.machineId || undefined, yarnBatch: formData.yarnBatch || undefined,
        status: formData.status, defects: bad ? formData.selectedDefects : [],
        ...(formData.rollId.trim() && { rollId: formData.rollId.trim().toUpperCase() }),
        ...(bad && { affectedMeters: metres }),
      };
    }
    return {
      orderId: formData.orderId,
      ...(kind === "REINSPECTION" ? { inspectionType: "REINSPECTION", reinspectionOf: reinspection.failedInspectionId } : { inspectionType: kind }),
      status: formData.status,
      ...(bad && {
        defectType: formData.defectType, defectSeverity: formData.defectSeverity, affectedMeters: metres,
        ...(formData.notes.trim() && { notes: formData.notes.trim() }),
        ...(formData.correctiveAction && { correctiveAction: formData.correctiveAction }),
        ...(formData.reworkCost !== "" && { reworkCost: Number(formData.reworkCost) }),
      }),
    };
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const metres = parseFloat(formData.affectedMeters);
    if (!formData.orderId) return setError("Choose an order.");
    if (bad && !(metres >= 1)) return setError("Enter the affected metres, at least 1, for a failed or rework result.");

    setSaving(true);
    try {
      const saved = await onSubmitQC(buildBody(metres));
      setFormData(emptyForm());
      setError("");
      const what = saved?.roll?.rollId ? `roll ${saved.roll.rollId}` : inspectionTypeLabel(saved?.roll?.inspectionType).toLowerCase();
      setNotice(`Saved ${what}`);
      if (kind === "REINSPECTION") onDone?.();
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not save this inspection. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={reinspection ? `Reinspect ${reinspection.orderId}` : "Record an inspection"}
      action={reinspection && <Button onClick={() => onDone?.()}>Cancel</Button>}>
      <form onSubmit={handleSubmit} className="mt-3 space-y-5" noValidate>
        {reinspection ? (
          <Notice tone="warning">
            Failed at {qcStageLabel(reinspection.failedStage)}: {reinspection.defectType ?? "quality problem"}, {severityLabel(reinspection.defectSeverity).toLowerCase()} severity,{" "}
            {formatMetres(reinspection.affectedMeters)} affected.
          </Notice>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!gated && (
              <FormField label="Roll" hint="Leave blank to number it automatically.">
                <Input name="rollId" value={formData.rollId} onChange={handleChange} autoCapitalize="characters" autoComplete="off" />
              </FormField>
            )}
            <FormField label="Order" required>
              <Select name="orderId" value={formData.orderId} onChange={handleChange}>
                {orders.map((o) => (
                  <option key={o.orderId} value={o.orderId}>{o.orderId}, {o.buyerName}</option>
                ))}
              </Select>
            </FormField>
          </div>
        )}

        {gated && !reinspection && kind === "HOLD" && (
          <Notice tone="warning">This order is on quality hold. Use Reinspect in the hold list once the corrective action is done.</Notice>
        )}
        {gated && !reinspection && kind === "NOTHING" && (
          <Notice tone="info">Nothing to inspect for {order.orderId} right now. {qcStageLabel(order.currentStage)} is still in progress.</Notice>
        )}
        {gated && canInspect && !needsAction && (
          <p className="text-sm text-gray-600">
            Inspecting: {qcStageLabel(order.currentStage ?? reinspection?.failedStage)}, {inspectionTypeLabel(kind).toLowerCase()}
            {kind === "FIRST_OFF" && order.sampleMeters ? ` (${formatMetres(order.sampleMeters)} sample)` : ""}
          </p>
        )}

        {needsAction && (
          <div className="space-y-3 border-t border-gray-200 pt-4">
            <FormField label="What will be done about this failure?" required>
              <Select value={actionChoice} onChange={(e) => setActionChoice(e.target.value)}>
                <option value="">Choose an action</option>
                {actionOptions(reinspection.defectSeverity).map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </Select>
            </FormField>
            <Button variant="primary" disabled={saving} onClick={saveAction}>Save action</Button>
            <p className="text-xs text-gray-500">Record the action first. The reinspection comes after it.</p>
          </div>
        )}

        {canInspect && !needsAction && (
          <>
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

            {bad && gated && (
              <div className="grid grid-cols-1 gap-4 border-t border-gray-200 pt-4 sm:grid-cols-2">
                <FormField label="Defect" required>
                  <Select name="defectType" value={formData.defectType} onChange={handleChange}>
                    {DEFECT_CHOICES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </FormField>
                <FormField label="Severity" required>
                  <Select name="defectSeverity" value={formData.defectSeverity} onChange={handleChange}>
                    {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                </FormField>
                <FormField label="Affected metres" required>
                  <Input type="number" inputMode="numeric" min="1" step="1" name="affectedMeters" value={formData.affectedMeters} onChange={handleChange} />
                </FormField>
                <FormField label="Rework cost (₹)" hint="Leave blank to estimate it.">
                  <Input type="number" inputMode="decimal" min="0" step="1" name="reworkCost" value={formData.reworkCost} onChange={handleChange} />
                </FormField>
                <FormField label="What will be done?">
                  <Select name="correctiveAction" value={formData.correctiveAction} onChange={handleChange}>
                    <option value="">Decide later</option>
                    {actionOptions(formData.defectSeverity).map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </Select>
                </FormField>
                <FormField label="Notes">
                  <Input name="notes" value={formData.notes} onChange={handleChange} autoComplete="off" />
                </FormField>
              </div>
            )}

            {bad && !gated && (
              <div className="grid grid-cols-1 gap-5 border-t border-gray-200 pt-4 sm:grid-cols-2">
                <FormField label="Affected metres" required>
                  <Input type="number" inputMode="numeric" min="1" step="1" name="affectedMeters" value={formData.affectedMeters} onChange={handleChange} />
                </FormField>
                <fieldset>
                  <legend className="mb-1 text-sm text-gray-900">Defects</legend>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {DEFECT_CHOICES.map((defect) => (
                      <label key={defect} className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-gray-900">
                        <input type="checkbox" checked={formData.selectedDefects.includes(defect)} onChange={() => toggleDefect(defect)} className="h-4 w-4 accent-blue-700" />
                        {defect}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          </>
        )}

        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}

        {canInspect && !needsAction && (
          <Button type="submit" variant="primary" disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving" : reinspection ? "Save reinspection" : "Save inspection"}
          </Button>
        )}
      </form>
    </Card>
  );
}

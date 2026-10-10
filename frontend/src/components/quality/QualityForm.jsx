import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

export default function QualityForm({
  defectOptions = [],
  orderOptions = [],
  machineOptions = [],
  yarnBatchOptions = [],
  onSubmitQC,
  onStatusChange,
}) {
  const [formData, setFormData] = useState({
    rollId: "RL10098",
    orderId: orderOptions[0] || "ORD104",
    machineId: machineOptions[0] || "W01",
    yarnBatch: yarnBatchOptions[0] || "YB82",
    status: "PASSED",
    selectedDefects: [],
    affectedMeters: "120",
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "status" || name === "affectedMeters") {
        onStatusChange?.({
          status: updated.status,
          affectedMeters: parseFloat(updated.affectedMeters) || 0,
        });
      }
      return updated;
    });
    if (error) setError("");
  };

  const handleDefectToggle = (defect) => {
    setFormData((prev) => {
      const exists = prev.selectedDefects.includes(defect);
      const updatedDefects = exists
        ? prev.selectedDefects.filter((d) => d !== defect)
        : [...prev.selectedDefects, defect];
      return { ...prev, selectedDefects: updatedDefects };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.rollId.trim()) {
      setError("Please enter a valid Roll ID.");
      return;
    }

    const isNonPassed = formData.status === "FAILED" || formData.status === "REWORK";
    const affectedMetersNum = parseFloat(formData.affectedMeters) || 0;

    const newRoll = {
      rollId: formData.rollId.trim().toUpperCase(),
      orderId: formData.orderId,
      buyer: formData.orderId === "ORD104" ? "ABC Garments" : formData.orderId === "ORD098" ? "Vogue Textiles" : "FabIndia Global",
      yarnBatch: formData.yarnBatch,
      machineId: formData.machineId,
      shift: "B", // defaulted shift
      producedAt: new Date().toISOString(),
      status: formData.status,
      defects: isNonPassed ? formData.selectedDefects : [],
      reworkStatus: isNonPassed ? "PENDING" : "NONE",
    };

    onSubmitQC(newRoll, affectedMetersNum);

    // Increment roll number for convenience and reset
    const match = formData.rollId.match(/\d+/);
    const nextNum = match ? parseInt(match[0], 10) + 1 : 10099;
    setFormData({
      rollId: `RL${nextNum}`,
      orderId: orderOptions[0] || "ORD104",
      machineId: machineOptions[0] || "W01",
      yarnBatch: yarnBatchOptions[0] || "YB82",
      status: "PASSED",
      selectedDefects: [],
      affectedMeters: "120",
    });
    setError("");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          Log Fabric Quality Inspection (QC)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Record physical fabric inspection parameters and generate traceability records
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Roll ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Roll ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="rollId"
              value={formData.rollId}
              onChange={handleChange}
              placeholder="e.g. RL10098"
              className="w-full text-sm rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Order */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Order <span className="text-red-500">*</span>
            </label>
            <select
              name="orderId"
              value={formData.orderId}
              onChange={handleChange}
              className="w-full text-sm rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {orderOptions.map((ord) => (
                <option key={ord} value={ord}>
                  {ord}
                </option>
              ))}
            </select>
          </div>

          {/* Machine */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Machine <span className="text-red-500">*</span>
            </label>
            <select
              name="machineId"
              value={formData.machineId}
              onChange={handleChange}
              className="w-full text-sm rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {machineOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Yarn Batch */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Yarn Batch <span className="text-red-500">*</span>
            </label>
            <select
              name="yarnBatch"
              value={formData.yarnBatch}
              onChange={handleChange}
              className="w-full text-sm rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {yarnBatchOptions.map((yb) => (
                <option key={yb} value={yb}>
                  {yb}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              QC Status <span className="text-red-500">*</span>
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className={`w-full text-sm rounded-lg border px-2.5 py-2 font-semibold focus:outline-none focus:ring-2 ${
                formData.status === "PASSED"
                  ? "border-emerald-300 bg-emerald-50/50 text-emerald-800 focus:ring-emerald-500"
                  : formData.status === "FAILED"
                  ? "border-red-300 bg-red-50/50 text-red-800 focus:ring-red-500"
                  : "border-amber-300 bg-amber-50/50 text-amber-800 focus:ring-amber-500"
              }`}
            >
              <option value="PASSED">PASSED</option>
              <option value="REWORK">REWORK</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>
        </div>

        {/* Defects and Affected Metres (shown especially relevant when REWORK or FAILED) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Defect Checkboxes:
            </label>
            <div className="flex flex-wrap gap-3">
              {defectOptions.map((defect) => {
                const checked = formData.selectedDefects.includes(defect);
                return (
                  <label
                    key={defect}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      checked
                        ? "bg-red-50 border-red-300 text-red-800"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleDefectToggle(defect)}
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                    <span>{defect}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Affected Fabric Metres
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="1"
                name="affectedMeters"
                value={formData.affectedMeters}
                onChange={handleChange}
                placeholder="e.g. 120"
                className="w-40 text-sm rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-500">metres impacted</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Submit QC
          </button>
        </div>
      </form>
    </div>
  );
}

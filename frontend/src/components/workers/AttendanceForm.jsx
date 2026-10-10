import { useState } from "react";
import { PlusCircle } from "lucide-react";

export default function AttendanceForm({
  workerProfiles = [],
  orders = [],
  machines = [],
  onLogAttendance,
}) {
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    workerId: workerProfiles[0]?.workerId || "",
    orderId: orders[0] || "",
    machineId: machines[0] || "",
    hoursWorked: "8",
    overtimeHours: "0",
    date: today,
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const hours = parseFloat(formData.hoursWorked);
    const overtime = parseFloat(formData.overtimeHours || 0);

    // Basic validation
    if (!formData.workerId) {
      setError("Please select a worker.");
      return;
    }
    if (!formData.orderId) {
      setError("Please select an order.");
      return;
    }
    if (!formData.machineId) {
      setError("Please select a machine.");
      return;
    }
    if (isNaN(hours) || hours <= 0) {
      setError("Hours worked must be greater than 0.");
      return;
    }
    if (isNaN(overtime) || overtime < 0) {
      setError("Overtime hours cannot be negative.");
      return;
    }
    if (!formData.date) {
      setError("Please select a valid date.");
      return;
    }

    const selectedProfile = workerProfiles.find(
      (p) => p.workerId === formData.workerId
    );

    if (!selectedProfile) {
      setError("Selected worker profile not found.");
      return;
    }

    // Create new attendance record
    const newEntry = {
      workerId: selectedProfile.workerId,
      name: selectedProfile.name,
      shift: selectedProfile.shift,
      machineId: formData.machineId,
      orderId: formData.orderId,
      hoursWorked: hours,
      overtimeHours: overtime,
      hourlyRate: selectedProfile.hourlyRate,
      date: formData.date,
    };

    try {
      await onLogAttendance(newEntry); // throws with the server's message on failure
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Could not save attendance.");
      return;
    }

    // Clear / reset form after successful submit
    setFormData({
      workerId: workerProfiles[0]?.workerId || "",
      orderId: orders[0] || "",
      machineId: machines[0] || "",
      hoursWorked: "",
      overtimeHours: "0",
      date: today,
    });
    setError("");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-blue-600" />
          Log Worker Attendance & Hours
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Record shift hours against order and machine to calculate real-time labour costs
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Worker */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Worker <span className="text-red-500">*</span>
          </label>
          <select
            name="workerId"
            value={formData.workerId}
            onChange={handleChange}
            className="w-full text-sm rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {workerProfiles.map((p) => (
              <option key={p.workerId} value={p.workerId}>
                {p.workerId} - {p.name}
              </option>
            ))}
          </select>
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
            {orders.map((ord) => (
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
            {machines.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Regular Hours */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Hours Worked <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            name="hoursWorked"
            value={formData.hoursWorked}
            onChange={handleChange}
            placeholder="e.g. 8"
            className="w-full text-sm rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Overtime Hours */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Overtime (Hrs)
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            name="overtimeHours"
            value={formData.overtimeHours}
            onChange={handleChange}
            placeholder="e.g. 1"
            className="w-full text-sm rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className="w-full text-sm rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Button */}
        <div className="md:col-span-3 lg:col-span-6 flex justify-end mt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Log Hours
          </button>
        </div>
      </form>
    </div>
  );
}

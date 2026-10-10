import { useState } from "react";
import Button from "../common/Button.jsx";
import Card from "../common/Card.jsx";
import FormField, { Input, Select } from "../common/FormField.jsx";
import Notice from "../common/Notice.jsx";

const todayDate = () => new Date().toLocaleDateString("en-CA");

/**
 * Log hours for a worker. Worker, order, hours and overtime are asked for; the date is shown and can be changed.
 * The machine is the worker's latest machine (else the first machine) and is sent as before.
 *   workerProfiles - GET /api/workers items
 *   orders, machines - lists of ids
 *   onLogAttendance(entry) - async; throws with the server's message on failure
 */
export default function AttendanceForm({ workerProfiles = [], orders = [], machines = [], onLogAttendance }) {
  const emptyForm = () => ({
    workerId: workerProfiles[0]?.workerId || "",
    orderId: orders[0] || "",
    hoursWorked: "8",
    overtimeHours: "0",
    date: todayDate(),
  });

  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
    setSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const hours = parseFloat(formData.hoursWorked);
    const overtime = parseFloat(formData.overtimeHours || 0);
    const profile = workerProfiles.find((p) => p.workerId === formData.workerId);
    const machineId = profile?.latestAssignment?.machineId || machines[0] || "";

    if (!profile) return setError("Choose a worker.");
    if (!formData.orderId) return setError("Choose an order.");
    if (!machineId) return setError("No machine is available to log these hours against.");
    if (isNaN(hours) || hours <= 0) return setError("Enter the hours worked, more than 0.");
    if (isNaN(overtime) || overtime < 0) return setError("Overtime cannot be less than 0.");
    if (!formData.date) return setError("Choose the date.");

    setBusy(true);
    try {
      await onLogAttendance({
        workerId: profile.workerId,
        name: profile.name,
        shift: profile.shift,
        machineId,
        orderId: formData.orderId,
        hoursWorked: hours,
        overtimeHours: overtime,
        date: formData.date,
      }); // throws with the server's message on failure
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not save these hours. Check the details and try again.");
      return;
    } finally {
      setBusy(false);
    }

    setFormData({ ...emptyForm(), hoursWorked: "", date: formData.date });
    setError("");
    setSaved(true);
  };

  return (
    <Card title="Log hours">
      <form onSubmit={handleSubmit} className="mt-3 space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <FormField label="Worker" required className="col-span-2 lg:col-span-1">
            <Select name="workerId" value={formData.workerId} onChange={handleChange}>
              {workerProfiles.map((p) => (
                <option key={p.workerId} value={p.workerId}>{p.name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Order" required className="col-span-2 lg:col-span-1">
            <Select name="orderId" value={formData.orderId} onChange={handleChange}>
              {orders.map((ord) => (
                <option key={ord} value={ord}>{ord}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Hours worked" required>
            <Input type="number" inputMode="decimal" step="0.5" min="0.5" name="hoursWorked" value={formData.hoursWorked} onChange={handleChange} />
          </FormField>

          <FormField label="Overtime hours">
            <Input type="number" inputMode="decimal" step="0.5" min="0" name="overtimeHours" value={formData.overtimeHours} onChange={handleChange} />
          </FormField>

          <FormField label="Date" required className="col-span-2 lg:col-span-1">
            <Input type="date" name="date" value={formData.date} onChange={handleChange} />
          </FormField>
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving" : "Save hours"}</Button>
          {saved && <span role="status" className="text-sm text-green-700">Saved</span>}
        </div>
      </form>
    </Card>
  );
}

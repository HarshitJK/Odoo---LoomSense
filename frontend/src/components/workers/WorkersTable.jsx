import { calculateWage } from "./wageCalculations.js";
import { formatCurrency } from "../../utils/formatCurrency.js";

// Badge styling helper for shifts
function ShiftBadge({ shift }) {
  const styles = {
    A: "bg-blue-50 text-blue-700 border-blue-200",
    B: "bg-emerald-50 text-emerald-700 border-emerald-200",
    C: "bg-purple-50 text-purple-700 border-purple-200",
  };
  const color = styles[shift] || "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${color}`}>
      Shift {shift}
    </span>
  );
}

export default function WorkersTable({ workers = [] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Attendance & Shift Records</h2>
          <p className="text-xs text-slate-500">Live operational workforce log mapped to machine and order</p>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {workers.length} Entries
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-4">Worker ID</th>
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Shift</th>
              <th className="py-3 px-4">Machine</th>
              <th className="py-3 px-4">Order</th>
              <th className="py-3 px-4 text-right">Hours</th>
              <th className="py-3 px-4 text-right">Overtime</th>
              <th className="py-3 px-4 text-right">Hourly Rate</th>
              <th className="py-3 px-4 text-right">Wage Earned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workers.map((w, index) => {
              const wage = calculateWage(w.hoursWorked, w.overtimeHours, w.hourlyRate);
              const isEven = index % 2 === 0;

              return (
                <tr
                  key={`${w.workerId}-${w.orderId}-${index}`}
                  className={`${isEven ? "bg-white" : "bg-slate-50/50"} hover:bg-slate-50 transition-colors`}
                >
                  <td className="py-3 px-4 font-mono font-medium text-slate-700 text-xs">{w.workerId}</td>
                  <td className="py-3 px-4 font-medium text-slate-900">{w.name}</td>
                  <td className="py-3 px-4">
                    <ShiftBadge shift={w.shift} />
                  </td>
                  <td className="py-3 px-4 text-slate-600">{w.machineId}</td>
                  <td className="py-3 px-4 font-medium text-slate-800">{w.orderId}</td>
                  <td className="py-3 px-4 text-right text-slate-700">{w.hoursWorked}h</td>
                  <td className="py-3 px-4 text-right text-slate-700">
                    {w.overtimeHours > 0 ? (
                      <span className="text-amber-700 font-medium">+{w.overtimeHours}h</span>
                    ) : (
                      <span className="text-slate-400">0h</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(w.hourlyRate)}/h</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(wage)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

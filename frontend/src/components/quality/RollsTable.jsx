import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge.jsx";
import { QrCode, ExternalLink } from "lucide-react";

export default function RollsTable({ rolls = [] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Finished Fabric Rolls</h2>
          <p className="text-xs text-slate-500">Inspection status and digital traceability links</p>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {rolls.length} Rolls Logged
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-4">Roll ID</th>
              <th className="py-3 px-4">Order</th>
              <th className="py-3 px-4">Machine</th>
              <th className="py-3 px-4">Yarn Batch</th>
              <th className="py-3 px-4">Shift</th>
              <th className="py-3 px-4">Defects</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Digital Passport</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rolls.map((roll, idx) => {
              const isEven = idx % 2 === 0;

              return (
                <tr
                  key={roll.rollId}
                  className={`${isEven ? "bg-white" : "bg-slate-50/50"} hover:bg-slate-50 transition-colors`}
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-800 text-xs">
                    {roll.rollId}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">{roll.orderId}</td>
                  <td className="py-3 px-4 text-slate-600">{roll.machineId}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-xs">{roll.yarnBatch}</td>
                  <td className="py-3 px-4 text-slate-600">Shift {roll.shift}</td>
                  <td className="py-3 px-4">
                    {roll.defects && roll.defects.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                        {roll.defects.join(", ")}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={roll.status} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      to={`/passport/${roll.rollId}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline bg-blue-50/60 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200/60 transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      View Passport
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

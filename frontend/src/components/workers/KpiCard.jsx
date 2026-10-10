// Local minimal KpiCard component (as common/KpiCard is not yet provided by Lead)
export default function KpiCard({ title, value, subtitle, icon: Icon, trend }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        {trend && (
          <p className="mt-2 text-xs font-medium text-emerald-600 flex items-center gap-1">
            <span>{trend}</span>
          </p>
        )}
      </div>
      {Icon && (
        <div className="p-3 bg-slate-100 rounded-lg text-slate-700">
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}

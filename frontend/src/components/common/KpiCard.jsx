/** Summary figure: small label, large value, optional one-line note. No icon, no colour fill. */
export default function KpiCard({ title, value, subtitle, valueClassName = "text-gray-900" }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 sm:p-5">
      <p className="text-sm text-gray-600">{title}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClassName}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

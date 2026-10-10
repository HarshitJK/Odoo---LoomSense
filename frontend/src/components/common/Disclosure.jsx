/** A section that stays collapsed until clicked. Its content stays mounted, so data keeps loading. */
export default function Disclosure({ title, children, defaultOpen = false }) {
  return (
    <details open={defaultOpen || undefined} className="group rounded-md border border-gray-200 bg-white">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold text-gray-900 sm:px-5 [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="text-sm font-normal text-blue-700 group-open:hidden">Show</span>
        <span aria-hidden="true" className="hidden text-sm font-normal text-blue-700 group-open:inline">Hide</span>
      </summary>
      <div className="border-t border-gray-200 p-4 sm:p-5">{children}</div>
    </details>
  );
}

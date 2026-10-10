/** White surface with a 1px border. `title` adds a section heading; `action` sits on its right. */
export default function Card({ title, action, children, className = "", padded = true, as: Tag = "section" }) {
  return (
    <Tag className={`rounded-md border border-gray-200 bg-white ${className}`}>
      {(title || action) && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 ${
            padded ? "px-4 pt-4 sm:px-5 sm:pt-5" : "border-b border-gray-200 px-4 py-3 sm:px-5"
          }`}
        >
          {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
          {action}
        </div>
      )}
      <div className={padded ? "p-4 sm:p-5" : ""}>{children}</div>
    </Tag>
  );
}

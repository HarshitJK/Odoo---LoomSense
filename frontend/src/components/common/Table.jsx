import { useState } from "react";
import Button from "./Button.jsx";

/** Scrolls sideways inside its own box on narrow screens, so the page itself never scrolls. */
export function Table({ children, caption }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-left text-sm sm:min-w-full">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function THead({ children }) {
  return (
    <thead className="bg-gray-50">
      <tr>{children}</tr>
    </thead>
  );
}

/** align="right" for numbers. `hidden` keeps the header for screen readers only. */
export function Th({ children, align = "left", hidden = false }) {
  return (
    <th scope="col" className={`px-4 py-2.5 text-xs font-medium text-gray-500 ${align === "right" ? "text-right" : "text-left"}`}>
      {hidden ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-gray-200 border-t border-gray-200">{children}</tbody>;
}

export function Tr({ children, className = "" }) {
  return <tr className={`hover:bg-gray-50 ${className}`}>{children}</tr>;
}

/** `header` makes the cell the row header (first column, usually the order or worker name). */
export function Td({ children, align = "left", className = "", header = false }) {
  const Tag = header ? "th" : "td";
  return (
    <Tag
      {...(header ? { scope: "row" } : {})}
      className={`px-4 py-3 align-middle tabular-nums text-gray-900 ${header ? "font-medium" : "font-normal"} ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Shows the first `limit` rows; `toggle` switches to all rows and back. */
export function useRowLimit(rows, limit = 5) {
  const [all, setAll] = useState(false);
  const list = rows ?? [];
  const visible = all ? list : list.slice(0, limit);
  return { visible, canExpand: list.length > limit, expanded: all, total: list.length, toggle: () => setAll((v) => !v) };
}

/** The "Show all" control under a limited list. `noun` is plural, for example "orders". */
export function ShowAll({ limiter, noun = "rows" }) {
  if (!limiter.canExpand) return null;
  return (
    <div className="border-t border-gray-200 px-4 py-2.5">
      <Button variant="link" onClick={limiter.toggle} aria-expanded={limiter.expanded}>
        {limiter.expanded ? "Show fewer" : `Show all ${limiter.total} ${noun}`}
      </Button>
    </div>
  );
}

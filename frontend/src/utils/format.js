// Friendly numbers, dates and times (en-IN, local time). Never show raw ISO text.

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Date-only strings ("2026-10-15") are read as local dates so they never slip a day. */
function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value !== "string" || !value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const withYear = (d) => d.getFullYear() !== new Date().getFullYear();

/** "15 Oct" (adds the year when it is not this year). Empty or invalid input gives "Not set". */
export function formatDate(value, empty = "Not set") {
  const d = toDate(value);
  if (!d) return empty;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${withYear(d) ? ` ${d.getFullYear()}` : ""}`;
}

/** "15 Oct, 6:00 pm" */
export function formatDateTime(value, empty = "Not set") {
  const d = toDate(value);
  if (!d) return empty;
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  return `${formatDate(d)}, ${time}`;
}

/** "October 2026" from "2026-10" */
export function formatMonth(value) {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!m) return value ?? "";
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

const num = (value, digits = 0) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

export const formatNumber = num;
export const formatKg = (value) => `${num(value)} kg`;
export const formatMetres = (value) => `${num(value)} m`;
export const formatHours = (value) => `${num(value, 1)} h`;
export const formatPercent = (value, digits = 1) => (value == null || Number.isNaN(Number(value)) ? "Not set" : `${num(value, digits)}%`);

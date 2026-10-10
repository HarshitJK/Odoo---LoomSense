import { USE_MOCKS } from "../../config.js";

/** Shown only while VITE_USE_MOCKS=true. */
export default function MockBadge() {
  if (!USE_MOCKS) return null;
  return <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Sample data</span>;
}

import { USE_MOCKS } from "../../config.js";

/** Small badge shown on a page while VITE_USE_MOCKS=true is active. */
export default function MockBadge() {
  if (!USE_MOCKS) return null;
  return (
    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      Using mock data
    </span>
  );
}

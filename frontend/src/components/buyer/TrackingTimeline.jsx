import { stageLabel } from "../../utils/labels.js";

const DOT = {
  DONE: "border-2 border-blue-700 bg-blue-700",
  IN_PROGRESS: "border-[3px] border-blue-700 bg-white",
  PENDING: "border-2 border-gray-300 bg-white",
};
const WORDS = { DONE: "Done", IN_PROGRESS: "In progress", PENDING: "Not started" };

/**
 * Vertical timeline. stages: [{ name, state: "DONE" | "IN_PROGRESS" | "PENDING", progress? }]
 * from GET /api/buyer/track/{token}. Only the weaving stage carries its own `progress`.
 * Filled dot = done, ring = in progress, empty ring = not started. The state is also written out for screen readers.
 */
export default function TrackingTimeline({ stages = [] }) {
  return (
    <ol aria-label="Production stages">
      {stages.map((stage, i) => {
        const state = DOT[stage.state] ? stage.state : "PENDING";
        const last = i === stages.length - 1;
        return (
          <li key={stage.name} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && <span aria-hidden="true" className="absolute left-[9px] top-5 h-full w-0.5 bg-gray-300" />}
            <span aria-hidden="true" className={`relative z-10 mt-0.5 h-5 w-5 shrink-0 rounded-full ${DOT[state]}`} />
            <div className="min-w-0">
              <p className={`text-sm ${state === "PENDING" ? "text-gray-500" : "font-medium text-gray-900"}`}>
                {stageLabel(stage.name)}
                {state === "IN_PROGRESS" && stage.progress != null && (
                  <span className="ml-2 tabular-nums text-blue-700">{stage.progress}%</span>
                )}
              </p>
              <p className="sr-only">{WORDS[state]}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

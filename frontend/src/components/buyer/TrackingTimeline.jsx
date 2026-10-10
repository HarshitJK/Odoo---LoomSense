import { Check, CircleDot, Circle } from "lucide-react";

/**
 * stages: [{ name, state: "DONE" | "IN_PROGRESS" | "PENDING", progress? }] from GET /api/buyer/track/{token}.
 * Only the Weaving stage carries its own `progress`; other in-progress stages show no percentage.
 */
export default function TrackingTimeline({ stages = [] }) {
  return (
    <div className="py-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
        Production Lifecycle Stages
      </h3>

      <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {stages.map((stageItem, idx) => {
          const stage = stageItem.name;
          const state = { DONE: "done", IN_PROGRESS: "in_progress" }[stageItem.state] ?? "pending";
          const progress = stageItem.progress;

          return (
            <div key={stage} className="relative flex items-start gap-3">
              {/* Timeline Icon Node */}
              <div className="absolute -left-6 mt-0.5 flex items-center justify-center">
                {state === "done" && (
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-4 ring-white">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}

                {state === "in_progress" && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center ring-4 ring-blue-100 animate-pulse">
                    <CircleDot className="w-3 h-3" />
                  </span>
                )}

                {state === "pending" && (
                  <span className="w-5 h-5 rounded-full bg-white border-2 border-slate-300 text-slate-300 flex items-center justify-center ring-4 ring-white">
                    <Circle className="w-2.5 h-2.5 fill-slate-200" />
                  </span>
                )}
              </div>

              {/* Stage Content */}
              <div className="flex-1 -mt-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      state === "done"
                        ? "text-slate-800"
                        : state === "in_progress"
                        ? "text-blue-600 font-bold"
                        : "text-slate-400 font-medium"
                    }`}
                  >
                    {stage}
                  </span>

                  {/* Show progress % badge next to the current stage */}
                  {state === "in_progress" && progress != null && (
                    <span className="inline-flex items-center text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                      {progress}%
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mt-0.5">
                  {state === "done" && "Completed and verified"}
                  {state === "in_progress" && (progress != null ? `Currently running at ${progress}%` : "In progress")}
                  {state === "pending" && "Upcoming stage"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

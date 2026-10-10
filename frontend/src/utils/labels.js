// One place for every code-to-wording mapping shown on screen:
// statuses, stages, shifts, roles, defect names, payment states.
// Tone drives the muted badge colour: good (green), warn (amber), bad (red), neutral (gray).

const STATUS = {
  // Machines
  RUNNING: { label: "Running", tone: "good" },
  IDLE: { label: "Idle", tone: "neutral" },
  DOWN: { label: "Down", tone: "bad" },

  // Quality results
  PASSED: { label: "Passed", tone: "good" },
  FAILED: { label: "Failed", tone: "bad" },
  REWORK: { label: "Rework", tone: "warn" },
  IN_REVIEW: { label: "In review", tone: "warn" },
  NOT_STARTED: { label: "Not started", tone: "neutral" },

  // Orders
  NEW: { label: "New", tone: "neutral" },
  PENDING: { label: "Pending", tone: "neutral" },
  SPINNING: { label: "Spinning", tone: "neutral" },
  WEAVING: { label: "Weaving", tone: "neutral" },
  DYEING: { label: "Dyeing", tone: "neutral" },
  QUALITY_CHECK: { label: "Quality check", tone: "neutral" },
  READY_FOR_DISPATCH: { label: "Ready for dispatch", tone: "good" },
  DISPATCHED: { label: "Dispatched", tone: "good" },
  COMPLETED: { label: "Completed", tone: "good" },
  DELIVERED: { label: "Delivered", tone: "good" },
  NOT_DISPATCHED: { label: "Not dispatched", tone: "neutral" },

  // Rework progress
  NOT_REQUIRED: { label: "Not needed", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "warn" },
  NONE: { label: "None", tone: "neutral" },

  // Supplier bills
  PAID: { label: "Paid", tone: "good" },
  PARTIAL: { label: "Part paid", tone: "warn" },
  PARTIALLY_PAID: { label: "Part paid", tone: "warn" },
  UNPAID: { label: "Unpaid", tone: "warn" },

  // Stage-gated quality control
  QC_PENDING: { label: "Waiting for QC", tone: "warn" },
  QUALITY_HOLD: { label: "On hold", tone: "bad" },
  COMPLETE: { label: "Complete", tone: "good" },

  // Stock and material
  LOW_STOCK: { label: "Low stock", tone: "warn" },
  MATERIAL_READY: { label: "Material ready", tone: "good" },
  CANNOT_START_FULL_PRODUCTION: { label: "Not enough material", tone: "bad" },
};

const humanise = (code) => {
  const text = String(code ?? "").replace(/_/g, " ").trim().toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};

/** { label, tone } for any status code; unknown codes become plain sentence-case words. */
export function statusInfo(code) {
  return STATUS[String(code ?? "").toUpperCase()] ?? { label: humanise(code) || "Unknown", tone: "neutral" };
}

export const statusLabel = (code) => statusInfo(code).label;

// Order statuses a manager can choose (value is what the API stores)
export const ORDER_STAGE_CODES = ["NEW", "SPINNING", "WEAVING", "DYEING", "QUALITY_CHECK", "REWORK", "READY_FOR_DISPATCH", "DISPATCHED"];

// Quality results shown as choices on the quality form
export const QUALITY_RESULTS = [
  { value: "PASSED", label: "Passed" },
  { value: "REWORK", label: "Rework" },
  { value: "FAILED", label: "Failed" },
];

// Production stages in the buyer timeline (the API already sends plain names; unknown names pass through)
const STAGES = {
  "Raw Material Allocated": "Material allocated",
  Spinning: "Spinning",
  Weaving: "Weaving",
  Dyeing: "Dyeing",
  "Quality Check": "Quality check",
  "Ready for Dispatch": "Ready for dispatch",
  Dispatched: "Dispatched",
};
export const stageLabel = (name) => STAGES[name] ?? humanise(name) ?? name;

/** "A" -> "Shift A" */
export const shiftLabel = (shift) => (shift ? `Shift ${shift}` : "");

const ROLES = {
  OWNER: "Owner",
  PRODUCTION_MANAGER: "Manager",
  WORKER_QC: "Quality inspector",
};
export const roleLabel = (role) => ROLES[role] ?? humanise(role);

// Defect names are free text in the API; these are the choices on the form (shown as written)
export const DEFECT_CHOICES = ["Weft break", "Uneven tension", "Colour patch", "Hole", "Loose thread", "Colour variation"];
export const defectsText = (defects) => (Array.isArray(defects) && defects.length ? defects.join(", ") : "None");

// ---- Stage-gated quality control ----

const QC_STAGE_NAMES = {
  RAW_MATERIAL: "Raw material",
  WEAVING: "Weaving",
  PROCESSING: "Processing",
  FINISHING: "Finishing",
  FINAL_QC: "Final QC",
  DISPATCH: "Dispatch",
};
export const qcStageLabel = (code) => QC_STAGE_NAMES[code] ?? humanise(code);

const INSPECTION_TYPES = {
  INCOMING_MATERIAL: "Incoming material check",
  FIRST_OFF: "First-off check",
  STAGE: "Stage inspection",
  FINAL: "Final inspection",
  REINSPECTION: "Reinspection",
};
export const inspectionTypeLabel = (code) => INSPECTION_TYPES[code] ?? humanise(code);

export const SEVERITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];
export const severityLabel = (code) => SEVERITIES.find((s) => s.value === code)?.label ?? humanise(code);

export const CORRECTIVE_ACTIONS = [
  { value: "REWORK_CURRENT_STAGE", label: "Rework this stage" },
  { value: "RESTART_FROM_CHECKPOINT", label: "Restart from the last checkpoint" },
  { value: "SCRAP_AFFECTED_QUANTITY", label: "Scrap the affected quantity" },
  { value: "FULL_RESTART", label: "Restart the whole order (critical only)" },
  { value: "NONE", label: "No action needed" },
];
export const correctiveActionLabel = (code) => CORRECTIVE_ACTIONS.find((a) => a.value === code)?.label ?? (code ? humanise(code) : "Not decided yet");

/** What the quality state of a stage-gated order is, in the badge words: { label, tone } or null when nothing to show. */
export function stageQcBadge(stageStatus, pendingInspectionType) {
  if (stageStatus === "QUALITY_HOLD") return { label: "On hold", tone: "bad" };
  if (stageStatus === "QC_PENDING") {
    return { label: pendingInspectionType === "FIRST_OFF" ? "Waiting for first-off check" : "Waiting for QC", tone: "warn" };
  }
  if (stageStatus === "COMPLETE") return { label: "QC passed", tone: "good" };
  return null;
}

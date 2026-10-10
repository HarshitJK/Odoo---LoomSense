import { AlertCircle, CheckCircle2, Info } from "lucide-react";

const tones = {
  error: { box: "border-red-200 bg-red-50 text-red-700", Icon: AlertCircle, role: "alert" },
  success: { box: "border-green-200 bg-green-50 text-green-700", Icon: CheckCircle2, role: "status" },
  info: { box: "border-gray-200 bg-gray-50 text-gray-700", Icon: Info, role: "status" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-700", Icon: AlertCircle, role: "status" },
};

/** Bordered message. tone: error | success | info | warning. `action` is an optional button (for example Retry). */
export default function Notice({ tone = "info", children, action, className = "" }) {
  const { box, Icon, role } = tones[tone];
  return (
    <div role={role} className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${box} ${className}`}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

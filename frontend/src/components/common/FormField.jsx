import { Children, cloneElement, isValidElement, useId } from "react";

export const controlClass =
  "block w-full h-10 sm:h-9 rounded-md border border-gray-300 bg-white px-3 text-gray-900 " +
  "disabled:bg-gray-50 disabled:text-gray-500 aria-[invalid=true]:border-red-700";

export function Input({ className = "", ...props }) {
  return <input className={`${controlClass} ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return (
    <select className={`${controlClass} ${className}`} {...props}>
      {children}
    </select>
  );
}

/**
 * Label above the control, helper and error text below it. The control is passed as the only child
 * and receives the id, so the label is connected to it. `required` adds the word "required".
 */
export default function FormField({ label, required, hint, error, children, className = "" }) {
  const id = useId();
  const child = Children.only(children);
  const controlId = child.props?.id ?? id;
  const control = isValidElement(child)
    ? cloneElement(child, {
        id: controlId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? `${id}-note` : undefined,
      })
    : child;
  return (
    <div className={className}>
      <label htmlFor={controlId} className="mb-1 block text-sm text-gray-900">
        {label}
        {required && <span className="text-gray-600"> (required)</span>}
      </label>
      {control}
      {(error || hint) && (
        <p id={`${id}-note`} className={`mt-1 text-xs ${error ? "text-red-700" : "text-gray-500"}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

import { RefreshCw } from "lucide-react";
import Button from "./Button.jsx";
import Notice from "./Notice.jsx";

/** What happened and what to do, in plain words. `error` is { endpoint, status, message } from useApi. */
export function errorText(error) {
  if (!error) return "";
  if (error.status === 401) return "Your session has ended. Sign in again.";
  if (error.status === 403) return "Your role cannot open this. Ask the owner for access.";
  if (error.status === 404) return "We could not find that. Check the details and try again.";
  if (error.status >= 500) return "The server had a problem. Try again in a minute.";
  if (error.status && typeof error.message === "string" && error.message.length < 140) return error.message;
  return "Could not load the data. Check your connection and try again.";
}

/** Error notice with a Retry button. */
export default function ApiErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <Notice
      tone="error"
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry} className="shrink-0 text-gray-900">
            <RefreshCw size={16} aria-hidden="true" /> Retry
          </Button>
        )
      }
    >
      {errorText(error)}
    </Notice>
  );
}

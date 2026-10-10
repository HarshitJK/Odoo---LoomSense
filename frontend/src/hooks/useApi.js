import { useCallback, useEffect, useRef, useState } from "react";
import client from "../api/client.js";
import { USE_MOCKS } from "../config.js";

/** Turn an axios error into { endpoint, status, message } for ApiErrorBanner. */
export function describeError(err, endpoint) {
  const detail = err?.response?.data?.detail;
  return {
    endpoint,
    status: err?.response?.status ?? null,
    message: typeof detail === "string" ? detail : err?.message || "Request failed",
  };
}

/**
 * GET an endpoint and return { data, loading, error, reload, usingMocks }.
 *
 *   const { data, loading, error, reload } = useApi("/api/orders", { mock: mockOrders });
 *
 * - `loading` is true only until the first answer; `reload()` refetches in the background.
 * - On failure `data` is null and `error` is { endpoint, status, message }. The page shows an
 *   error banner with a Retry button; mock data is never used as a silent fallback.
 * - Mock data is returned only when VITE_USE_MOCKS=true (`mock` may be a value or a function).
 * - Options: params (query string), enabled (false = do nothing), transform (reshape response data).
 */
export default function useApi(path, { params, mock, enabled = true, transform } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({ mock, transform });
  latest.current = { mock, transform };
  const paramsKey = JSON.stringify(params ?? {});
  const requestKey = `${path}?${paramsKey}`;
  const lastKey = useRef(requestKey);

  useEffect(() => {
    if (!enabled) return undefined;
    if (lastKey.current !== requestKey) {
      lastKey.current = requestKey; // a different request: drop the previous answer
      setState({ data: null, loading: true, error: null });
    }
    if (USE_MOCKS) {
      const { mock: m } = latest.current;
      setState({ data: typeof m === "function" ? m() : m ?? null, loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    client
      .get(path, { params })
      .then((res) => {
        if (cancelled) return;
        const { transform: t } = latest.current;
        setState({ data: t ? t(res.data) : res.data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: describeError(err, `GET ${path}`) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, enabled, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload, usingMocks: USE_MOCKS };
}

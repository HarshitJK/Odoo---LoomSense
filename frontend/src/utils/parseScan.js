// Turns the text of a scanned QR code (or something typed by hand) into an app route target.
//
//   parseScan("http://192.168.1.20:5173/passport/RL10092?x=1") -> { type: "passport", id: "RL10092" }
//   parseScan("rl-10092")                                      -> { type: "passport", id: "RL10092" }
//   parseScan("https://x.test/track/aB3_xY...")                -> { type: "track",    id: "aB3_xY..." } (token kept exactly)
//   parseScan("ORD-104")                                       -> { type: "unknown" } (order ids are not tracking codes)
//   parseScan("hello")                                         -> { type: "unknown" }
//
// For URLs only the path counts, never the origin: a QR printed with one host (localhost, a LAN IP
// or a deployed URL) still opens the page on the host the user is on right now.

const UNKNOWN = { type: "unknown" };
const ROUTE_IN_PATH = /\/(passport|track)\/([^/?#\s]+)\/?$/i;
const ID_OK = /^[A-Za-z0-9_-]{1,128}$/;
// Private tracking tokens are random and at least 22 characters; case is significant.
const TOKEN_OK = /^[A-Za-z0-9_-]{22,128}$/;

/** "rl-10092" -> "RL10092" */
export function normaliseId(id) {
  return id.replace(/-/g, "").toUpperCase();
}

/** The path of a full URL, a scheme-less URL ("host:5173/passport/RL1") or a bare path; null otherwise. */
function pathOf(text) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    try {
      return new URL(text).pathname;
    } catch {
      return null;
    }
  }
  if (text.startsWith("/")) return text.split(/[?#]/)[0];
  if (/^[^\s/]+\.[^\s/]*\/|^localhost(:\d+)?\//i.test(text)) {
    try {
      return new URL(`http://${text}`).pathname;
    } catch {
      return null;
    }
  }
  return null;
}

export function parseScan(input) {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) return UNKNOWN;

  const path = pathOf(text);
  if (path) {
    const match = ROUTE_IN_PATH.exec(path);
    if (!match) return UNKNOWN;
    let id;
    try {
      id = decodeURIComponent(match[2]);
    } catch {
      return UNKNOWN;
    }
    if (!ID_OK.test(id)) return UNKNOWN;
    if (match[1].toLowerCase() === "passport") return { type: "passport", id: normaliseId(id) };
    return TOKEN_OK.test(id) ? { type: "track", id } : UNKNOWN; // /track/ORD104 is not a valid link
  }

  if (/^RL-?\d+$/i.test(text)) return { type: "passport", id: normaliseId(text) };
  if (TOKEN_OK.test(text)) return { type: "track", id: text };
  return UNKNOWN;
}

/** The app route for a parse result, or null for unknown. */
export function routeFor(result) {
  if (result.type === "passport") return `/passport/${result.id}`;
  if (result.type === "track") return `/track/${result.id}`;
  return null;
}

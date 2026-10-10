// Turns the text of a scanned QR code (or something typed by hand) into an app route target.
//
//   parseScan("http://192.168.1.20:5173/passport/RL10092?x=1") -> { type: "passport", id: "RL10092" }
//   parseScan("rl-10092")                                      -> { type: "passport", id: "RL10092" }
//   parseScan("ORD-104")                                       -> { type: "track",    id: "ORD104" }
//   parseScan("hello")                                         -> { type: "unknown" }
//
// For URLs only the path counts, never the origin: a QR printed with one host (localhost, a LAN IP
// or a deployed URL) still opens the page on the host the user is on right now.

const UNKNOWN = { type: "unknown" };
const ROUTE_IN_PATH = /\/(passport|track)\/([^/?#\s]+)\/?$/i;
const ID_OK = /^[A-Za-z0-9_-]{1,128}$/;

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
    const type = match[1].toLowerCase() === "passport" ? "passport" : "track";
    return { type, id: type === "passport" ? normaliseId(id) : id };
  }

  if (/^RL-?\d+$/i.test(text)) return { type: "passport", id: normaliseId(text) };
  if (/^[A-Za-z0-9_-]{43}$/.test(text)) return { type: "track", id: text };
  if (/^ORD-?\d+$/i.test(text)) return { type: "track", id: normaliseId(text) };
  return UNKNOWN;
}

/** The app route for a parse result, or null for unknown. */
export function routeFor(result) {
  if (result.type === "passport") return `/passport/${result.id}`;
  if (result.type === "track") return `/track/${result.id}`;
  return null;
}

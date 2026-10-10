import { describe, expect, it } from "vitest";
import { parseScan, routeFor } from "./parseScan.js";

const passport = (id) => ({ type: "passport", id });
const track = (id) => ({ type: "track", id });
const unknown = { type: "unknown" };
const T22 = "aB3_xY-9kLmN0pQrStUvWz"; // 22 characters, like a real token

describe("parseScan: full URLs (only the path counts)", () => {
  it("accepts any origin", () => {
    expect(parseScan("http://localhost:5173/passport/RL10092")).toEqual(passport("RL10092"));
    expect(parseScan("http://192.168.1.20:5173/passport/RL10092")).toEqual(passport("RL10092"));
    expect(parseScan("https://loomsense.example.com/passport/RL10092")).toEqual(passport("RL10092"));
    expect(parseScan(`https://loomsense.example.com/track/${T22}`)).toEqual(track(T22));
  });

  it("ignores trailing slashes, query strings and fragments", () => {
    expect(parseScan("http://x.test/passport/RL10092/")).toEqual(passport("RL10092"));
    expect(parseScan("http://x.test/passport/RL10092?utm=1&a=b")).toEqual(passport("RL10092"));
    expect(parseScan("http://x.test/passport/RL10092/?a=1#top")).toEqual(passport("RL10092"));
    expect(parseScan(`http://x.test/track/${T22}#x`)).toEqual(track(T22));
  });

  it("normalises hyphens and case in the id", () => {
    expect(parseScan("http://x.test/passport/rl-10092")).toEqual(passport("RL10092"));
    expect(parseScan(`http://x.test/track/${T22}`)).toEqual(track(T22)); // case is kept for tracking tokens
  });

  it("accepts a path prefix, a scheme-less URL and a bare path", () => {
    expect(parseScan("https://x.test/app/passport/RL10092")).toEqual(passport("RL10092"));
    expect(parseScan("192.168.1.20:5173/passport/RL10092")).toEqual(passport("RL10092"));
    expect(parseScan(`localhost:5173/track/${T22}`)).toEqual(track(T22));
    expect(parseScan("/passport/RL10092")).toEqual(passport("RL10092"));
  });

  it("trims whitespace", () => {
    expect(parseScan("  http://x.test/passport/RL10092\n")).toEqual(passport("RL10092"));
  });

  it("rejects URLs that are not passport or track links", () => {
    expect(parseScan("https://example.com/")).toEqual(unknown);
    expect(parseScan("https://example.com/orders/ORD104")).toEqual(unknown);
    expect(parseScan("https://example.com/passport/")).toEqual(unknown);
    expect(parseScan("https://example.com/passport/RL10092/extra")).toEqual(unknown);
    expect(parseScan("https://example.com/passport/<script>")).toEqual(unknown);
    expect(parseScan("https://example.com/passport/%E0%A4%A")).toEqual(unknown);
  });
});

describe("parseScan: bare ids", () => {
  it("accepts roll ids", () => {
    expect(parseScan("RL10092")).toEqual(passport("RL10092"));
    expect(parseScan("RL-10092")).toEqual(passport("RL10092"));
    expect(parseScan("rl10092")).toEqual(passport("RL10092"));
    expect(parseScan(" rl-10092 ")).toEqual(passport("RL10092"));
  });

  it("accepts a bare tracking token and keeps its case", () => {
    expect(parseScan(T22)).toEqual(track(T22));
    expect(parseScan(` ${T22}
`)).toEqual(track(T22));
  });

  it("no longer treats order ids as tracking codes", () => {
    for (const id of ["ORD104", "ORD-104", "ord-104", "https://x.test/track/ORD104", "/track/ord-104"]) {
      expect(parseScan(id)).toEqual(unknown);
    }
  });
});

describe("parseScan: unknown input", () => {
  it("returns unknown for empty, non-string and garbage input", () => {
    for (const input of ["", "   ", null, undefined, 42, {}, "hello world", "RL", "ORD", "RLabc", "ORD-", "RL 10092",
      "WIFI:S:home;T:WPA;P:secret;;", "https://", "javascript:alert(1)", "RL10092 ORD104"]) {
      expect(parseScan(input)).toEqual(unknown);
    }
  });
});

describe("routeFor", () => {
  it("maps results to internal routes", () => {
    expect(routeFor(passport("RL10092"))).toBe("/passport/RL10092");
    expect(routeFor(track(T22))).toBe(`/track/${T22}`);
    expect(routeFor(unknown)).toBeNull();
  });
});


it("preserves case and punctuation in secure tracking tokens", () => {
  const token = "aB_cD-eF" + "x".repeat(35);
  expect(parseScan(`https://mill.test/track/${token}`)).toEqual({type:"track",id:token});
  expect(parseScan(token)).toEqual({type:"track",id:token});
  expect(parseScan(`https://mill.test/track/${token.slice(0, 21)}`)).toEqual(unknown); // too short to be a token
});

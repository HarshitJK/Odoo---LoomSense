import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { AlertCircle, ArrowLeft, Camera, CameraOff, CheckCircle2, ImageUp, ScanLine, Search } from "lucide-react";

import client from "../api/client.js";
import { parseScan, routeFor } from "../utils/parseScan.js";

const READER_ID = "qr-reader";
const FILE_READER_ID = "qr-file-reader";

// Live camera only works on HTTPS or localhost
const cameraSupported = () =>
  typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

/** Friendly text for the ways starting the camera can fail. */
function cameraErrorMessage(err) {
  const text = `${err?.name ?? ""} ${err?.message ?? err ?? ""}`;
  if (/NotAllowed|Permission|denied/i.test(text)) {
    return "Camera permission was denied. Allow camera access for this site in your browser settings, then tap Start camera again.";
  }
  if (/NotFound|DevicesNotFound|No camera|Requested device not found|OverconstrainedError/i.test(text)) {
    return "No camera was found on this device. Use “Scan from image” or type the roll id below.";
  }
  if (/NotReadable|TrackStart|in use|Could not start video source/i.test(text)) {
    return "The camera is being used by another app. Close it and tap Start camera again.";
  }
  if (/SecurityError|insecure/i.test(text)) {
    return "The browser blocked the camera on this address. Live camera needs HTTPS or localhost.";
  }
  return `Could not start the camera (${err?.message ?? err}). Use “Scan from image” or type the roll id below.`;
}

export default function ScannerPage() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState(null); // { kind: "error" | "info" | "ok", text, again? }
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const secure = cameraSupported();

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setCameraOn(false);
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop(); // releases the camera tracks
    } catch {
      // already stopped
    }
    try {
      scanner.clear();
    } catch {
      // nothing to clear
    }
  }, []);

  // Turn the camera off when leaving the page
  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  /** Handle the text from any source (camera, image or typed): parse it, check it, open it. */
  const handleDecoded = useCallback(
    async (text) => {
      await stopCamera();
      const result = parseScan(text);
      const target = routeFor(result);
      if (!target) {
        setMessage({ kind: "error", text: "This QR code is not a LoomSense roll or order code.", again: true });
        return;
      }
      setBusy(true);
      setMessage({ kind: "ok", text: `Found ${result.type === "passport" ? "roll" : "order"} ${result.id}. Opening…` });

      if (result.type === "passport") {
        try {
          await client.get(`/api/passport/${encodeURIComponent(result.id)}`);
        } catch (err) {
          if (err?.response?.status === 404) {
            setBusy(false);
            setMessage({ kind: "error", text: `Roll ${result.id} not found.`, again: true });
            return;
          }
          // any other failure: open the page anyway, it has its own error state
        }
      }
      setTimeout(() => navigate(target), 600);
    },
    [navigate, stopCamera]
  );

  const startCamera = async () => {
    setMessage(null);
    if (!secure) {
      setMessage({ kind: "error", text: INSECURE_TEXT });
      return;
    }
    setStarting(true);
    try {
      const scanner = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (w, h) => {
            const side = Math.floor(Math.min(w, h) * 0.75);
            return { width: side, height: side };
          },
        },
        (decodedText) => handleDecoded(decodedText),
        () => {} // no QR in this frame: keep scanning
      );
      setCameraOn(true);
    } catch (err) {
      await stopCamera();
      setMessage({ kind: "error", text: cameraErrorMessage(err) });
    } finally {
      setStarting(false);
    }
  };

  const scanFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage(null);
    await stopCamera();
    const reader = new Html5Qrcode(FILE_READER_ID, { verbose: false });
    try {
      const text = await reader.scanFile(file, false);
      await handleDecoded(text);
    } catch {
      setMessage({ kind: "error", text: "No QR code could be read from that image. Try a sharper, closer photo.", again: true });
    } finally {
      try {
        reader.clear();
      } catch {
        // nothing to clear
      }
    }
  };

  const submitManual = (e) => {
    e.preventDefault();
    if (manual.trim()) handleDecoded(manual);
  };

  const scanAgain = () => {
    setMessage(null);
    setManual("");
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 flex flex-col items-center">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">LoomSense</span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ScanLine className="w-6 h-6 text-blue-600" /> Scan QR code
            </h1>
            <p className="text-xs text-slate-500 mt-1">Scan a fabric roll passport or an order tracking code.</p>
          </div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
        </div>

        {/* Plain HTTP on a non-localhost address: no live camera */}
        {!secure && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{INSECURE_TEXT}</p>
          </div>
        )}

        {/* Camera area */}
        <div className="relative w-full aspect-square rounded-xl bg-slate-900 overflow-hidden">
          <div id={READER_ID} className="w-full h-full" />
          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300 text-sm pointer-events-none">
              <CameraOff className="w-10 h-10" />
              <span>{starting ? "Starting camera…" : "Camera is off"}</span>
            </div>
          )}
        </div>
        <div id={FILE_READER_ID} className="hidden" />

        {cameraOn ? (
          <button
            type="button"
            onClick={stopCamera}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl"
          >
            <CameraOff className="w-5 h-5" /> Stop camera
          </button>
        ) : (
          <button
            type="button"
            onClick={startCamera}
            disabled={starting || busy || !secure}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
          >
            <Camera className="w-5 h-5" /> Start camera
          </button>
        )}

        {/* Result / error */}
        {message && (
          <div
            role={message.kind === "error" ? "alert" : "status"}
            className={`rounded-xl border p-3 text-sm flex items-start gap-2 ${
              message.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.kind === "ok" ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <p>{message.text}</p>
              {message.again && (
                <button
                  type="button"
                  onClick={scanAgain}
                  className="mt-2 px-3 py-2 bg-white border border-red-200 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Scan again
                </button>
              )}
            </div>
          </div>
        )}

        {/* Fallback 1: image upload */}
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">No camera? Scan from a photo</p>
          <label className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl cursor-pointer">
            <ImageUp className="w-5 h-5" /> Scan from image
            <input id="qr-file-input" type="file" accept="image/*" onChange={scanFile} className="sr-only" />
          </label>
        </div>

        {/* Fallback 2: type or paste */}
        <form onSubmit={submitManual} className="border-t border-slate-100 pt-4 space-y-2">
          <label htmlFor="manual-code" className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">
            Or type a roll id or paste a link
          </label>
          <div className="flex gap-2">
            <input
              id="manual-code"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="RL10092 or a passport link"
              autoComplete="off"
              autoCapitalize="characters"
              className="flex-1 min-w-0 text-base rounded-xl border border-slate-300 px-3 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
            >
              <Search className="w-4 h-4" /> Open
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const INSECURE_TEXT =
  "Live camera needs HTTPS or localhost, and this page is on plain HTTP. Use “Scan from image” with a photo or screenshot of the QR code, or type the roll id below.";

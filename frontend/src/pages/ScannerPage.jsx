import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, ImageUp } from "lucide-react";

import client from "../api/client.js";
import Button, { buttonClass } from "../components/common/Button.jsx";
import Notice from "../components/common/Notice.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import PublicPage from "../components/common/PublicPage.jsx";
import { Input } from "../components/common/FormField.jsx";
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
    return "Camera access was blocked. Allow the camera for this site in your browser settings, then tap Start camera.";
  }
  if (/NotFound|DevicesNotFound|No camera|Requested device not found|OverconstrainedError/i.test(text)) {
    return "No camera found on this device. Scan from a photo or type the code below.";
  }
  if (/NotReadable|TrackStart|in use|Could not start video source/i.test(text)) {
    return "Another app is using the camera. Close it and tap Start camera.";
  }
  if (/SecurityError|insecure/i.test(text)) {
    return "The camera needs a secure (https) address. Scan from a photo or type the code below.";
  }
  return "Could not start the camera. Scan from a photo or type the code below.";
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
        setMessage({ kind: "error", text: "This is not a LoomSense roll or order code.", again: true });
        return;
      }
      setBusy(true);
      setMessage({ kind: "ok", text: result.type === "passport" ? `Found roll ${result.id}. Opening.` : "Found the order. Opening." });

      if (result.type === "passport") {
        try {
          await client.get(`/api/passport/${encodeURIComponent(result.id)}`);
        } catch (err) {
          if (err?.response?.status === 404) {
            setBusy(false);
            setMessage({ kind: "error", text: `We could not find roll ${result.id}.`, again: true });
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
      setMessage({ kind: "error", text: "No QR code could be read from that photo. Try a sharper, closer photo.", again: true });
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
    <PublicPage
      action={
        <Button as={Link} to="/" variant="link">
          Back to app
        </Button>
      }
    >
      <PageHeader title="Scan QR code" subtitle="Scan a fabric roll or an order code." />

      {/* Plain HTTP on a non-localhost address: no live camera */}
      {!secure && <Notice tone="warning">{INSECURE_TEXT}</Notice>}

      {/* Camera area */}
      <div className="relative aspect-square w-full overflow-hidden rounded-md border border-gray-200 bg-gray-900">
        <div id={READER_ID} className="h-full w-full" />
        {!cameraOn && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-gray-300">
            <CameraOff size={32} aria-hidden="true" />
            <span>{starting ? "Starting camera" : "Camera is off"}</span>
          </div>
        )}
      </div>
      <div id={FILE_READER_ID} className="hidden" />

      {cameraOn ? (
        <Button size="lg" onClick={stopCamera} className="w-full">
          <CameraOff size={16} aria-hidden="true" /> Stop camera
        </Button>
      ) : (
        <Button size="lg" variant="primary" onClick={startCamera} disabled={starting || busy || !secure} className="w-full">
          <Camera size={16} aria-hidden="true" /> Start camera
        </Button>
      )}

      {message && (
        <Notice
          tone={message.kind === "ok" ? "success" : "error"}
          action={message.again && <Button onClick={scanAgain}>Scan again</Button>}
        >
          {message.text}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 border-t border-gray-200 pt-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-sm text-gray-900">Scan from a photo</p>
          <label htmlFor="qr-file-input" className={`${buttonClass("secondary")} w-full cursor-pointer`}>
            <ImageUp size={16} aria-hidden="true" /> Choose photo
          </label>
          <input id="qr-file-input" type="file" accept="image/*" onChange={scanFile} className="sr-only" />
        </div>

        <form onSubmit={submitManual} className="space-y-1.5">
          <label htmlFor="manual-code" className="block text-sm text-gray-900">Type a code</label>
          <div className="flex gap-2">
            <Input
              id="manual-code"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Roll code or link"
              autoComplete="off"
              autoCapitalize="characters"
              className="min-w-0 flex-1"
            />
            <Button type="submit" disabled={busy}>Open</Button>
          </div>
        </form>
      </div>
    </PublicPage>
  );
}

const INSECURE_TEXT =
  "The camera needs a secure (https) address and this page is not on one. Scan from a photo or type the code instead.";

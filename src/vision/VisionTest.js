import { useRef, useState, useEffect } from "react";
import {
  openCamera,
  stopCamera,
  captureFrame,
  canvasToDataURL,
  runOCR,
  preprocessForOCR,
  scanQRCode,
  drawQRBox,
  loadFaceModels,
  detectFaces,
  drawFaceBoxes,
  applySoftScanFilter,
  startQRScanLoop,
  isBlurry,
} from "./VisionUtils";

const MODES = [
  { id: "ocr",  label: "OCR",      color: "#7F77DD" },
  { id: "qr",   label: "QR Scan",  color: "#1D9E75" },
  { id: "face", label: "Face",     color: "#D85A30" },
  { id: "doc",  label: "Doc Scan", color: "#378ADD" },
];

const Card = ({ title, color, children }) => (
  <div style={{
    border: "2px solid " + color,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    background: "#f8f9ff",
  }}>
    <div style={{
      fontSize: 11,
      fontWeight: "bold",
      color: color,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 10,
    }}>
      {title}
    </div>
    {children}
  </div>
);

const Btn = ({ onClick, active, color, children, disabled }) => {
  const c = color || "#1a237e";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: "11px 8px",
        fontSize: 13,
        fontWeight: "bold",
        background: disabled ? "#eee" : active ? c : "#e8eaf6",
        color: disabled ? "#aaa" : active ? "#fff" : c,
        border: "1px solid " + (disabled ? "#ccc" : c),
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
};

function getSortedExpressions(expressions) {
  var entries = Object.entries(expressions);
  entries.sort(function(a, b) {
    if (b[1] > a[1]) return 1;
    if (b[1] < a[1]) return -1;
    return 0;
  });
  return entries.slice(0, 4);
}

export default function VisionTest() {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const stopLoopRef = useRef(null);

  const [mode, setMode]           = useState("ocr");
  const [phase, setPhase]         = useState("idle");
  const [preview, setPreview]     = useState(null);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState("");
  const [qrLive, setQrLive]       = useState(false);
  const [faceReady, setFaceReady] = useState(false);
  const [blurScore, setBlurScore] = useState(null);

  useEffect(function() {
    loadFaceModels()
      .then(function() { setFaceReady(true); })
      .catch(function() { setFaceReady(false); });
    return function() {
      stopCamera(streamRef.current);
      if (stopLoopRef.current) stopLoopRef.current();
    };
  }, []);

  function startCam() {
    setError("");
    setResult(null);
    setPreview(null);
    setBlurScore(null);
    openCamera(videoRef.current)
      .then(function(stream) {
        streamRef.current = stream;
        setPhase("camera");
        if (mode === "qr") {
          setQrLive(true);
          stopLoopRef.current = startQRScanLoop(
            videoRef.current,
            canvasRef.current,
            function(data) {
              stopCamera(streamRef.current);
              if (stopLoopRef.current) stopLoopRef.current();
              setQrLive(false);
              setPreview(canvasToDataURL(canvasRef.current));
              setResult({ type: "qr", data: data });
              setPhase("done");
            },
            null
          );
        }
      })
      .catch(function(e) {
        setError("Camera error: " + e.message);
      });
  }

  async function capture() {
    stopCamera(streamRef.current);
    if (stopLoopRef.current) stopLoopRef.current();
    setQrLive(false);
    captureFrame(videoRef.current, canvasRef.current);
    var blur = isBlurry(canvasRef.current);
    setBlurScore(blur);
    setPreview(canvasToDataURL(canvasRef.current));
    setPhase("processing");
    await processImage();
  }

  async function processImage() {
    setLoading("Processing...");
    try {
      if (mode === "ocr") {
        setLoading("Enhancing image...");
        preprocessForOCR(canvasRef.current);
        setLoading("Reading text with OCR...");
        var text = await runOCR(canvasRef.current);
        setResult({ type: "ocr", text: text });

      } else if (mode === "qr") {
        var qr = scanQRCode(canvasRef.current);
        if (qr.found) {
          drawQRBox(canvasRef.current, qr.location);
          setResult({ type: "qr", data: qr.data });
        } else {
          setResult({ type: "qr", data: null });
        }

      } else if (mode === "face") {
        setLoading("Detecting faces...");
        var faces = await detectFaces(canvasRef.current);
        drawFaceBoxes(canvasRef.current, faces);
        setResult({ type: "face", faces: faces });

      } else if (mode === "doc") {
        setLoading("Applying document filter...");
        applySoftScanFilter(canvasRef.current);
        setLoading("Reading text...");
        var docText = await runOCR(canvasRef.current);
        setResult({ type: "doc", text: docText });
      }

      setPreview(canvasToDataURL(canvasRef.current));
      setPhase("done");
    } catch (e) {
      setError("Processing failed: " + e.message);
      setPhase("idle");
    }
    setLoading("");
  }

  function reset() {
    stopCamera(streamRef.current);
    if (stopLoopRef.current) stopLoopRef.current();
    setPhase("idle");
    setResult(null);
    setPreview(null);
    setError("");
    setLoading("");
    setQrLive(false);
    setBlurScore(null);
  }

  function switchMode(newMode) {
    reset();
    setMode(newMode);
  }

  var currentMode = MODES.find(function(m) { return m.id === mode; });

  return (
    <div style={{ maxWidth: 500, margin: "20px auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <h2 style={{ color: "#1a237e", marginBottom: 4 }}>Vision Test</h2>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
        Camera and AI vision tools
      </p>

      {error && (
        <div style={{
          background: "#ffebee",
          border: "1px solid #ef9a9a",
          color: "#c62828",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 14,
          fontSize: 14,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {MODES.map(function(m) {
          return (
            <button
              key={m.id}
              onClick={function() { switchMode(m.id); }}
              style={{
                flex: 1,
                padding: "10px 4px",
                fontSize: 13,
                fontWeight: "bold",
                background: mode === m.id ? m.color : "#f0f0f0",
                color: mode === m.id ? "#fff" : "#555",
                border: "2px solid " + (mode === m.id ? m.color : "#ddd"),
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {phase === "idle" && mode === "ocr" && (
        <Card title="OCR — Read text from image" color="#7F77DD">
          <p style={{ fontSize: 13, color: "#666", marginTop: 0, marginBottom: 12 }}>
            Point camera at any printed text, bill, or sign.
          </p>
          <div style={{ display: "flex" }}>
            <Btn onClick={startCam} color="#7F77DD">Open Camera</Btn>
          </div>
        </Card>
      )}

      {phase === "idle" && mode === "qr" && (
        <Card title="QR / Barcode Scanner" color="#1D9E75">
          <p style={{ fontSize: 13, color: "#666", marginTop: 0, marginBottom: 12 }}>
            Live scan — automatically detects QR codes.
          </p>
          <div style={{ display: "flex" }}>
            <Btn onClick={startCam} color="#1D9E75">Start Scanner</Btn>
          </div>
        </Card>
      )}

      {phase === "idle" && mode === "face" && (
        <Card title="Face Detection" color="#D85A30">
          <p style={{ fontSize: 13, color: "#666", marginTop: 0, marginBottom: 8 }}>
            Detects faces and reads expressions.
          </p>
          <div style={{ fontSize: 12, color: faceReady ? "#1D9E75" : "#EF9F27", marginBottom: 12 }}>
            {faceReady ? "Face models ready" : "Loading face models..."}
          </div>
          <div style={{ display: "flex" }}>
            <Btn onClick={startCam} color="#D85A30" disabled={!faceReady}>
              {faceReady ? "Open Camera" : "Loading..."}
            </Btn>
          </div>
        </Card>
      )}

      {phase === "idle" && mode === "doc" && (
        <Card title="Document Scanner" color="#378ADD">
          <p style={{ fontSize: 13, color: "#666", marginTop: 0, marginBottom: 12 }}>
            Scans documents, applies filter and reads text.
          </p>
          <div style={{ display: "flex" }}>
            <Btn onClick={startCam} color="#378ADD">Open Camera</Btn>
          </div>
        </Card>
      )}

      {phase === "camera" && (
        <div>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: "100%", borderRadius: 10, background: "#000" }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          {qrLive ? (
            <div>
              <div style={{
                background: "#e1f5ee",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                color: "#1D9E75",
                fontWeight: "bold",
                marginTop: 10,
                textAlign: "center",
              }}>
                Scanning... point at a QR code
              </div>
              <div style={{ display: "flex", marginTop: 8 }}>
                <Btn onClick={reset} color="#888">Cancel</Btn>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Btn onClick={capture} active={true} color={currentMode.color}>Capture</Btn>
              <Btn onClick={reset} color="#888">Cancel</Btn>
            </div>
          )}
        </div>
      )}

      {phase === "processing" && (
        <div style={{ textAlign: "center", padding: 20 }}>
          <div style={{
            width: 40,
            height: 40,
            border: "4px solid #e8eaf6",
            borderTop: "4px solid " + currentMode.color,
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 12px",
          }} />
          <p style={{ color: "#555", fontSize: 14 }}>{loading || "Processing..."}</p>
          {preview && (
            <img
              src={preview}
              alt="captured"
              style={{ width: "100%", borderRadius: 10, opacity: 0.5, marginTop: 10 }}
            />
          )}
        </div>
      )}

      {phase === "done" && result && (
        <div>
          {blurScore && (
            <div style={{
              display: "inline-block",
              background: blurScore.blurry ? "#fff3e0" : "#e1f5ee",
              color: blurScore.blurry ? "#EF9F27" : "#1D9E75",
              fontSize: 12,
              fontWeight: "bold",
              padding: "4px 10px",
              borderRadius: 20,
              marginBottom: 10,
            }}>
              {blurScore.blurry
                ? "Image may be blurry (score: " + blurScore.score + ")"
                : "Image is sharp (score: " + blurScore.score + ")"}
            </div>
          )}

          {preview && (
            <img
              src={preview}
              alt="result"
              style={{
                width: "100%",
                borderRadius: 10,
                border: "2px solid " + currentMode.color,
                marginBottom: 12,
              }}
            />
          )}

          {result.type === "ocr" && (
            <div style={{
              background: "#f0f4ff",
              border: "1px solid #c5cae9",
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 12, color: "#7F77DD", fontWeight: "bold", marginBottom: 8 }}>
                EXTRACTED TEXT
              </div>
              {result.text ? (
                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14, color: "#333", margin: 0 }}>
                  {result.text}
                </pre>
              ) : (
                <p style={{ color: "#aaa", fontSize: 13, margin: 0 }}>No text found. Try better lighting.</p>
              )}
            </div>
          )}

          {result.type === "qr" && (
            <div style={{
              background: "#e1f5ee",
              border: "1px solid #1D9E75",
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 12, color: "#1D9E75", fontWeight: "bold", marginBottom: 8 }}>
                QR CODE DATA
              </div>
              {result.data ? (
                <div>
                  <p style={{ fontSize: 15, fontWeight: "bold", color: "#333", margin: "0 0 10px" }}>
                    {result.data}
                  </p>
                  {result.data.startsWith("http") && (
                    <a
                      href={result.data}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "block",
                        padding: 10,
                        background: "#1D9E75",
                        color: "#fff",
                        borderRadius: 8,
                        textAlign: "center",
                        textDecoration: "none",
                        fontWeight: "bold",
                        fontSize: 14,
                      }}
                    >
                      Open Link
                    </a>
                  )}
                </div>
              ) : (
                <p style={{ color: "#aaa", fontSize: 13, margin: 0 }}>No QR code found. Try again.</p>
              )}
            </div>
          )}

          {result.type === "face" && (
            <div style={{
              background: "#fff3f0",
              border: "1px solid #D85A30",
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 12, color: "#D85A30", fontWeight: "bold", marginBottom: 8 }}>
                FACE DETECTION
              </div>
              {result.faces.length === 0 ? (
                <p style={{ color: "#aaa", fontSize: 13, margin: 0 }}>No faces detected.</p>
              ) : (
                <div>
                  {result.faces.map(function(f, i) {
                    var sorted = getSortedExpressions(f.expressions);
                    return (
                      <div key={i} style={{ borderBottom: "1px solid #eee", paddingBottom: 8, marginBottom: 8 }}>
                        <div style={{ fontWeight: "bold", color: "#333", fontSize: 14 }}>
                          Face {i + 1} — {f.topExpression}
                        </div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                          Confidence: {Math.round(f.score * 100)}%
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                          {sorted.map(function(item) {
                            var expr = item[0];
                            var val  = item[1];
                            return (
                              <span key={expr} style={{
                                background: "#ffe0d4",
                                color: "#993C1D",
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 10,
                              }}>
                                {expr}: {Math.round(val * 100)}%
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {result.type === "doc" && (
            <div style={{
              background: "#e6f1fb",
              border: "1px solid #378ADD",
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 12, color: "#378ADD", fontWeight: "bold", marginBottom: 8 }}>
                SCANNED DOCUMENT TEXT
              </div>
              {result.text ? (
                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, color: "#333", margin: 0 }}>
                  {result.text}
                </pre>
              ) : (
                <p style={{ color: "#aaa", fontSize: 13, margin: 0 }}>No text found.</p>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={startCam} active={true} color={currentMode.color}>Try Again</Btn>
            <Btn onClick={reset} color="#888">Reset</Btn>
          </div>
        </div>
      )}

      {phase !== "camera" && (
        <canvas ref={canvasRef} style={{ display: "none" }} />
      )}
    </div>
  );
}
import { useRef, useState } from "react";
import Tesseract from "tesseract.js";

export default function BillScanner() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState("idle");
  const [previewUrl, setPreviewUrl] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [groqResult, setGroqResult] = useState("");
  const [error, setError] = useState("");

  // ── 1. Open Camera ──────────────────────────────────────────────────────
  const openCamera = async () => {
    setError("");
    setOcrText("");
    setGroqResult("");
    setPreviewUrl("");
    setPhase("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width:  { ideal: 4096 },
          height: { ideal: 2160 },
        },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    } catch (err) {
      setError("Camera access denied. Please allow camera permission.");
      setPhase("idle");
    }
  };

  // ── 2. Capture — uses ImageCapture API for full sensor resolution ───────
  const capturePhoto = async () => {
    try {
      const track = streamRef.current.getVideoTracks()[0];

      // ImageCapture API — full native camera resolution
      if (typeof ImageCapture !== "undefined") {
        const imageCapture = new ImageCapture(track);
        const blob = await imageCapture.takePhoto({
          imageWidth: 4096,
        });

        // Stop stream
        streamRef.current.getTracks().forEach((t) => t.stop());

        // Draw blob to canvas for OCR later
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          const canvas = canvasRef.current;
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d").drawImage(img, 0, 0);
          setPreviewUrl(canvas.toDataURL("image/jpeg", 1.0));
          setPhase("preview");
        };
        img.src = url;

      } else {
        // Fallback: draw from video (lower quality)
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        streamRef.current.getTracks().forEach((t) => t.stop());
        setPreviewUrl(canvas.toDataURL("image/jpeg", 1.0));
        setPhase("preview");
      }
    } catch (err) {
      setError("Capture failed: " + err.message);
      setPhase("idle");
    }
  };

  // ── 3. Retake ────────────────────────────────────────────────────────────
  const retake = () => {
    setPreviewUrl("");
    openCamera();
  };

  // ── 4. Confirm → preprocess → OCR ───────────────────────────────────────
  const confirmAndScan = () => {
    setPhase("ocr");
    preprocessAndOCR();
  };

  // ── 5. Preprocess image for better OCR ──────────────────────────────────
  const preprocessAndOCR = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale
      const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

      // Boost contrast: push darks darker, lights lighter
      const contrast = 1.8;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
      const enhanced = factor * (avg - 128) + 128;
      const clamped = Math.min(255, Math.max(0, enhanced));

      data[i] = clamped;
      data[i + 1] = clamped;
      data[i + 2] = clamped;
    }

    ctx.putImageData(imageData, 0, 0);
    runOCR(canvas);
  };

  // ── 6. Run OCR ──────────────────────────────────────────────────────────
  const runOCR = async (canvas) => {
    try {
      const { data: { text } } = await Tesseract.recognize(canvas, "eng", {
        logger: () => {},
        tessedit_pageseg_mode: "6",       // assume uniform block of text
        preserve_interword_spaces: "1",
      });
      const cleaned = text.trim();
      if (!cleaned) {
        setError("No text found. Try better lighting or hold the camera steady.");
        setPhase("idle");
        return;
      }
      setOcrText(cleaned);
      askGroq(cleaned);
    } catch (err) {
      setError("OCR failed: " + err.message);
      setPhase("idle");
    }
  };

  // ── 7. Send to GROQ ─────────────────────────────────────────────────────
  const askGroq = async (rawText) => {
    setPhase("asking");
    const apiKey = process.env.REACT_APP_GROQ_API_KEY;
    if (!apiKey) {
      setError("GROQ API key missing.");
      setPhase("idle");
      return;
    }
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content:
                "You are a bill reading assistant. The user will give you raw OCR text " +
                "from a bill or receipt. Extract and clearly summarise: shop name, date, " +
                "list of items with prices, total amount, and taxes. Format it neatly. " +
                "If something is unclear due to OCR errors, make your best guess and note it.",
            },
            {
              role: "user",
              content: `Here is the raw OCR text from a bill:\n\n${rawText}`,
            },
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(`GROQ error ${response.status}: ${data.error?.message}`);
        setPhase("idle");
        return;
      }
      setGroqResult(data.choices[0].message.content);
      setPhase("done");
    } catch (err) {
      setError("GROQ request failed: " + err.message);
      setPhase("idle");
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = () => {
    setPhase("idle");
    setOcrText("");
    setGroqResult("");
    setPreviewUrl("");
    setError("");
  };

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🧾 Bill Scanner</h2>
      <p style={styles.subtitle}>Scan any bill — AI will read it for you</p>

      {error && <div style={styles.error}>{error}</div>}

      {/* IDLE */}
      {phase === "idle" && (
        <button style={styles.btnPrimary} onClick={openCamera}>
          📷 Open Camera
        </button>
      )}

      {/* CAMERA */}
      {phase === "camera" && (
        <div style={styles.cameraBox}>
          <video ref={videoRef} style={styles.video} playsInline muted />
          <p style={styles.tip}>
            💡 Tip: Hold steady, ensure good lighting, fill the frame with the bill
          </p>
          <button style={styles.captureBtn} onClick={capturePhoto}>
            🔴 Capture Bill
          </button>
        </div>
      )}

      {/* PREVIEW */}
      {phase === "preview" && (
        <div>
          <p style={styles.previewLabel}>📸 Preview — is the text clearly visible?</p>
          <img src={previewUrl} alt="Captured bill" style={styles.previewImg} />
          <div style={styles.previewBtns}>
            <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={retake}>
              🔄 Retake
            </button>
            <button style={{ ...styles.btnPrimary, flex: 1 }} onClick={confirmAndScan}>
              ✅ Scan It
            </button>
          </div>
        </div>
      )}

      {/* OCR */}
      {phase === "ocr" && (
        <div style={styles.statusBox}>
          <div style={styles.spinner} />
          <p>Reading bill with OCR...</p>
          {previewUrl && (
            <img src={previewUrl} alt="Scanning"
              style={{ ...styles.scanningImg, filter: "grayscale(100%) contrast(1.5)" }} />
          )}
        </div>
      )}

      {/* ASKING */}
      {phase === "asking" && (
        <div style={styles.statusBox}>
          <div style={styles.spinner} />
          <p>Sending to AI for analysis...</p>
        </div>
      )}

      {/* DONE */}
      {phase === "done" && (
        <div>
          <div style={styles.doneLayout}>
            <div style={styles.doneLeft}>
              <p style={styles.doneLabel}>📸 Scanned</p>
              <img src={previewUrl} alt="Scanned bill" style={styles.doneImg} />
            </div>
            <div style={styles.doneRight}>
              <div style={styles.resultBox}>
                <h3 style={{ marginTop: 0, color: "#1a237e", fontSize: 15 }}>
                  ✅ Bill Summary
                </h3>
                <pre style={styles.resultText}>{groqResult}</pre>
              </div>
            </div>
          </div>

          <details style={{ marginTop: 12, fontSize: 12, color: "#888" }}>
            <summary>Raw OCR text (debug)</summary>
            <pre style={styles.rawText}>{ocrText}</pre>
          </details>

          <button style={{ ...styles.btnSecondary, marginTop: 16 }} onClick={reset}>
            🔄 Scan Another Bill
          </button>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

const styles = {
  container: { maxWidth: 500, margin: "30px auto", padding: "0 20px", fontFamily: "sans-serif" },
  title: { fontSize: 24, color: "#1a237e", marginBottom: 4 },
  subtitle: { color: "#888", fontSize: 14, marginBottom: 24 },
  tip: { fontSize: 12, color: "#888", textAlign: "center", margin: "8px 0" },
  btnPrimary: {
    padding: "14px 28px", fontSize: 16, background: "#1a237e", color: "#fff",
    border: "none", borderRadius: 10, cursor: "pointer", width: "100%",
  },
  btnSecondary: {
    padding: "12px 24px", fontSize: 15, background: "#e8eaf6", color: "#1a237e",
    border: "none", borderRadius: 10, cursor: "pointer", width: "100%",
  },
  captureBtn: {
    marginTop: 12, padding: "14px", fontSize: 16, background: "#c62828",
    color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", width: "100%",
  },
  cameraBox: { display: "flex", flexDirection: "column" },
  video: { width: "100%", borderRadius: 10, background: "#000", objectFit: "cover" },
  previewLabel: { fontWeight: "bold", color: "#333", marginBottom: 10, fontSize: 15 },
  previewImg: { width: "100%", borderRadius: 10, border: "2px solid #c5cae9", display: "block" },
  previewBtns: { display: "flex", gap: 10, marginTop: 12 },
  scanningImg: { width: "80%", borderRadius: 10, opacity: 0.5, marginTop: 12 },
  statusBox: { textAlign: "center", padding: 30, color: "#555" },
  spinner: {
    width: 40, height: 40, border: "4px solid #e8eaf6", borderTop: "4px solid #1a237e",
    borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px",
  },
  doneLayout: { display: "flex", gap: 12, alignItems: "flex-start" },
  doneLeft: { flex: "0 0 40%" },
  doneRight: { flex: 1 },
  doneLabel: { fontSize: 12, color: "#888", margin: "0 0 6px" },
  doneImg: { width: "100%", borderRadius: 8, border: "1px solid #c5cae9" },
  resultBox: { background: "#f0f4ff", border: "1px solid #c5cae9", borderRadius: 10, padding: 12 },
  resultText: { whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, color: "#333", margin: 0 },
  rawText: { fontSize: 11, color: "#aaa", whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 8, maxHeight: 150, overflowY: "auto" },
  error: { background: "#ffebee", border: "1px solid #ef9a9a", color: "#c62828", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 14 },
};
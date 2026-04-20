import { useRef, useState } from "react";
import Tesseract from "tesseract.js";

export default function BillScanner() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // idle | camera | ocr | asking | done
  const [ocrText, setOcrText] = useState("");
  const [groqResult, setGroqResult] = useState("");
  const [error, setError] = useState("");

  // ── 1. Open Camera ──────────────────────────────────────────────────────
  const openCamera = async () => {
    setError("");
    setOcrText("");
    setGroqResult("");
    setPhase("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // rear camera on mobile
      });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    } catch (err) {
      setError("Camera access denied. Please allow camera permission.");
      setPhase("idle");
    }
  };

  // ── 2. Capture Frame ────────────────────────────────────────────────────
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    // Stop camera stream
    video.srcObject.getTracks().forEach((t) => t.stop());
    setPhase("ocr");
    runOCR(canvas);
  };

  // ── 3. Run OCR ──────────────────────────────────────────────────────────
  const runOCR = async (canvas) => {
    try {
      const { data: { text } } = await Tesseract.recognize(canvas, "eng", {
        logger: () => {}, // suppress logs
      });
      const cleaned = text.trim();
      if (!cleaned) {
        setError("No text found in image. Try better lighting or a clearer photo.");
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

  // ── 4. Send to GROQ ─────────────────────────────────────────────────────
  const askGroq = async (rawText) => {
    setPhase("asking");
    const apiKey = process.env.REACT_APP_GROQ_API_KEY;
    if (!apiKey) {
      setError("GROQ API key missing. Check your .env file.");
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
                "You are a bill reading assistant. The user will give you raw OCR text from a bill or receipt. " +
                "Extract and clearly summarise: shop name, date, list of items with prices, total amount, " +
                "and any taxes. Format it neatly. If something is unclear, make your best guess and note it.",
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
          <button style={styles.captureBtn} onClick={capturePhoto}>
            🔴 Capture Bill
          </button>
        </div>
      )}

      {/* OCR in progress */}
      {phase === "ocr" && (
        <div style={styles.statusBox}>
          <div style={styles.spinner} />
          <p>Reading bill with OCR...</p>
        </div>
      )}

      {/* Sending to GROQ */}
      {phase === "asking" && (
        <div style={styles.statusBox}>
          <div style={styles.spinner} />
          <p>Sending to AI for analysis...</p>
          {ocrText && (
            <details style={{ marginTop: 12, fontSize: 12, color: "#888" }}>
              <summary>Raw OCR text</summary>
              <pre style={styles.rawText}>{ocrText}</pre>
            </details>
          )}
        </div>
      )}

      {/* DONE */}
      {phase === "done" && (
        <div>
          <div style={styles.resultBox}>
            <h3 style={{ marginTop: 0, color: "#1a237e" }}>✅ Bill Summary</h3>
            <pre style={styles.resultText}>{groqResult}</pre>
          </div>

          <details style={{ marginTop: 12, fontSize: 12, color: "#888" }}>
            <summary>Raw OCR text (debug)</summary>
            <pre style={styles.rawText}>{ocrText}</pre>
          </details>

          <button style={styles.btnSecondary} onClick={reset}>
            🔄 Scan Another Bill
          </button>
        </div>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 500,
    margin: "30px auto",
    padding: "0 20px",
    fontFamily: "sans-serif",
  },
  title: {
    fontSize: 24,
    color: "#1a237e",
    marginBottom: 4,
  },
  subtitle: {
    color: "#888",
    fontSize: 14,
    marginBottom: 24,
  },
  btnPrimary: {
    padding: "14px 28px",
    fontSize: 16,
    background: "#1a237e",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    width: "100%",
  },
  btnSecondary: {
    marginTop: 16,
    padding: "12px 24px",
    fontSize: 15,
    background: "#e8eaf6",
    color: "#1a237e",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    width: "100%",
  },
  captureBtn: {
    marginTop: 12,
    padding: "14px",
    fontSize: 16,
    background: "#c62828",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    width: "100%",
  },
  cameraBox: {
    display: "flex",
    flexDirection: "column",
  },
  video: {
    width: "100%",
    borderRadius: 10,
    background: "#000",
  },
  statusBox: {
    textAlign: "center",
    padding: 30,
    color: "#555",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "4px solid #e8eaf6",
    borderTop: "4px solid #1a237e",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto 16px",
  },
  resultBox: {
    background: "#f0f4ff",
    border: "1px solid #c5cae9",
    borderRadius: 10,
    padding: 16,
  },
  resultText: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: 14,
    color: "#333",
    margin: 0,
  },
  rawText: {
    fontSize: 11,
    color: "#aaa",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    marginTop: 8,
    maxHeight: 150,
    overflowY: "auto",
  },
  error: {
    background: "#ffebee",
    border: "1px solid #ef9a9a",
    color: "#c62828",
    borderRadius: 8,
    padding: "10px 14px",
    marginBottom: 16,
    fontSize: 14,
  },
};
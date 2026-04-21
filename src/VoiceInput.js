import { useState, useRef } from "react";

// ── Constants ─────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY;

export default function VoiceInput({ onResult }) {
  const [status, setStatus]         = useState("idle");   // idle | recording | transcribing | thinking | done | error
  const [transcript, setTranscript] = useState("");
  const [groqResult, setGroqResult] = useState("");
  const [errorMsg, setErrorMsg]     = useState("");
  const [audioURL, setAudioURL]     = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);

  // ── Start Recording ───────────────────────────────────────────────────────
  const startRecording = async () => {
    setTranscript("");
    setGroqResult("");
    setErrorMsg("");
    setAudioURL(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current   = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url       = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        await transcribeWithWhisper(audioBlob);
      };

      mediaRecorder.start(250);
      setStatus("recording");

    } catch (err) {
      setErrorMsg("Microphone access denied. Please allow mic permission and try again.");
      setStatus("error");
    }
  };

  // ── Stop Recording ────────────────────────────────────────────────────────
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setStatus("transcribing");
      mediaRecorderRef.current.stop();
    }
  };

  // ── Whisper Transcription ─────────────────────────────────────────────────
  const transcribeWithWhisper = async (audioBlob) => {
    if (!GROQ_API_KEY) {
      setErrorMsg("GROQ API key missing. Add REACT_APP_GROQ_API_KEY to your .env file.");
      setStatus("error");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("response_format", "json");
      // No language hint → Whisper auto-detects language

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          // Do NOT set Content-Type — browser sets it with boundary automatically
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data?.error?.message || "Whisper transcription failed.");
        setStatus("error");
        return;
      }

      const text = data.text?.trim();
      if (!text) {
        setErrorMsg("No speech detected. Please try speaking again.");
        setStatus("error");
        return;
      }

      setTranscript(text);
      setStatus("thinking");
      await askGroq(text);

    } catch (err) {
      setErrorMsg("Transcription failed. Check your internet connection.");
      setStatus("error");
    }
  };

  // ── Groq Chat ─────────────────────────────────────────────────────────────
  const askGroq = async (text) => {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content:
                "You are a smart family assistant. The user will speak a message in any language. " +
                "Understand the intent and do one of these:\n" +
                "- If it's a shopping list: extract items, group by category, format neatly.\n" +
                "- If it's a reminder: extract the task and time clearly.\n" +
                "- If it's a general task: summarise it clearly.\n" +
                "- If it's a bill or financial item: summarise amounts and details.\n" +
                "Always respond in English regardless of input language. " +
                "Start your reply with one of: [SHOPPING], [REMINDER], [TASK], or [BILL] " +
                "so the app knows how to route it.",
            },
            { role: "user", content: text },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(data?.error?.message || "Groq chat failed.");
        setStatus("error");
        return;
      }

      const result = data.choices[0].message.content;
      setGroqResult(result);
      setStatus("done");

      if (onResult) onResult({ transcript: text, result });

    } catch {
      setErrorMsg("AI processing failed. Check your internet connection.");
      setStatus("error");
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = () => {
    setTranscript("");
    setGroqResult("");
    setErrorMsg("");
    setAudioURL(null);
    setStatus("idle");
  };

  // ── Route badge ───────────────────────────────────────────────────────────
  const getTag = () => {
    if (groqResult.startsWith("[SHOPPING]")) return { label: "🛒 Shopping list", color: "#1D9E75" };
    if (groqResult.startsWith("[REMINDER]")) return { label: "⏰ Reminder",      color: "#EF9F27" };
    if (groqResult.startsWith("[TASK]"))     return { label: "📌 Task",          color: "#7F77DD" };
    if (groqResult.startsWith("[BILL]"))     return { label: "🧾 Bill",          color: "#D85A30" };
    return null;
  };
  const tag = getTag();

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🎙️ Voice Input</h2>
      <p style={styles.subtitle}>Speak in any language — AI auto-detects &amp; understands</p>

      {/* ── IDLE ── */}
      {status === "idle" && (
        <button style={styles.micBtn} onClick={startRecording}>
          🎙️ Start Speaking
        </button>
      )}

      {/* ── RECORDING ── */}
      {status === "recording" && (
        <div>
          <div style={styles.listeningBox}>
            <div style={styles.pulse} />
            <span style={{ color: "#c62828", fontWeight: "bold" }}>
              Recording… speak now
            </span>
          </div>
          <p style={styles.hint}>Hindi, Telugu, English, or any language — just speak!</p>
          <button style={styles.stopBtn} onClick={stopRecording}>
            ⏹ Stop &amp; Process
          </button>
        </div>
      )}

      {/* ── TRANSCRIBING ── */}
      {status === "transcribing" && (
        <div style={styles.statusBox}>
          <div style={styles.spinner} />
          <p>Transcribing your audio…</p>
        </div>
      )}

      {/* ── THINKING ── */}
      {status === "thinking" && (
        <div style={styles.statusBox}>
          <div style={styles.spinner} />
          <p>AI is understanding…</p>
          {transcript && (
            <div style={styles.transcriptBox}>
              <p style={styles.transcriptLabel}>You said:</p>
              <p style={styles.transcriptText}>{transcript}</p>
            </div>
          )}
        </div>
      )}

      {/* ── ERROR ── */}
      {status === "error" && (
        <div style={styles.error}>
          ❌ {errorMsg}
          <button style={{ ...styles.micBtn, marginTop: 12 }} onClick={reset}>
            Try Again
          </button>
        </div>
      )}

      {/* ── DONE ── */}
      {status === "done" && groqResult && (
        <div>
          {tag && (
            <div style={{ ...styles.tag, background: tag.color }}>
              {tag.label}
            </div>
          )}

          <div style={styles.resultBox}>
            <pre style={styles.resultText}>
              {groqResult.replace(/^\[.*?\]\s*/, "")}
            </pre>
          </div>

          {transcript && (
            <div style={styles.transcriptBox}>
              <p style={styles.transcriptLabel}>You said (auto-detected language):</p>
              <p style={styles.transcriptText}>{transcript}</p>
            </div>
          )}

          {audioURL && (
            <div style={styles.audioBox}>
              <p style={styles.transcriptLabel}>Your recording:</p>
              <audio controls src={audioURL} style={{ width: "100%", marginTop: 6 }} />
            </div>
          )}

          <button style={styles.micBtn} onClick={startRecording}>
            🎙️ Speak Again
          </button>
          <button style={styles.resetBtn} onClick={reset}>
            🗑 Clear
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container:       { maxWidth: 500, margin: "30px auto", padding: "0 20px", fontFamily: "sans-serif" },
  title:           { fontSize: 24, color: "#1a237e", marginBottom: 4 },
  subtitle:        { color: "#888", fontSize: 14, marginBottom: 24 },
  hint:            { color: "#aaa", fontSize: 12, textAlign: "center", marginBottom: 12 },
  micBtn:          { width: "100%", padding: "16px", fontSize: 16, background: "#1a237e", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", marginBottom: 8 },
  stopBtn:         { width: "100%", padding: "16px", fontSize: 16, background: "#c62828", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", marginTop: 12 },
  resetBtn:        { width: "100%", padding: "12px", fontSize: 14, background: "#f5f5f5", color: "#555", border: "none", borderRadius: 12, cursor: "pointer", marginTop: 8 },
  listeningBox:    { display: "flex", alignItems: "center", gap: 12, padding: "16px", background: "#fff3f3", borderRadius: 10, marginBottom: 12 },
  pulse:           { width: 14, height: 14, background: "#c62828", borderRadius: "50%", animation: "pulse 1s ease-in-out infinite" },
  transcriptBox:   { background: "#f8f9ff", border: "1px solid #e8eaf6", borderRadius: 10, padding: 12, marginBottom: 12 },
  transcriptLabel: { fontSize: 11, color: "#999", margin: "0 0 4px" },
  transcriptText:  { fontSize: 14, color: "#333", margin: 0, lineHeight: 1.6 },
  statusBox:       { textAlign: "center", padding: 20, color: "#555" },
  spinner:         { width: 36, height: 36, border: "4px solid #e8eaf6", borderTop: "4px solid #1a237e", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" },
  tag:             { display: "inline-block", color: "#fff", fontSize: 13, fontWeight: "bold", padding: "5px 14px", borderRadius: 20, marginBottom: 10 },
  resultBox:       { background: "#f0f4ff", border: "1px solid #c5cae9", borderRadius: 10, padding: 14, marginBottom: 12 },
  resultText:      { whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14, color: "#333", margin: 0 },
  audioBox:        { background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 10, padding: 12, marginBottom: 12 },
  error:           { background: "#ffebee", border: "1px solid #ef9a9a", color: "#c62828", borderRadius: 8, padding: 14, fontSize: 14 },
};
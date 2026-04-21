import { useState, useEffect } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";

const LANGUAGES = [
  { label: "English (India)",  code: "en-IN" },
  { label: "Telugu",           code: "te-IN" },
  { label: "Hindi",            code: "hi-IN" },
  { label: "Tamil",            code: "ta-IN" },
  { label: "Kannada",          code: "kn-IN" },
  { label: "Malayalam",        code: "ml-IN" },
  { label: "Marathi",          code: "mr-IN" },
  { label: "Bengali",          code: "bn-IN" },
  { label: "Gujarati",         code: "gu-IN" },
  { label: "Punjabi",          code: "pa-IN" },
  { label: "English (US)",     code: "en-US" },
  { label: "English (UK)",     code: "en-GB" },
];

// ── Device detection ────────────────────────────────────────────────────────
const isIOS    = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export default function VoiceInput({ onResult }) {
  const [selectedLang, setSelectedLang] = useState("en-IN");
  const [status, setStatus]             = useState("idle"); // idle | listening | thinking | done | error

  const [groqResult, setGroqResult]     = useState("");

  const {
    transcript,
    resetTranscript,
    browserSupportsSpeechRecognition,
    listening,
  } = useSpeechRecognition();

  // ── iOS: show unsupported message immediately ─────────────────────────────
  if (isIOS || !browserSupportsSpeechRecognition) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          ⚠️ Voice input is not supported on iOS Safari.<br />
          Please use <strong>Chrome on Android</strong> or a desktop browser.
        </div>
      </div>
    );
  }

  // ── Auto-process on mobile when mic naturally stops ───────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (isMobile && !listening && status === "listening" && transcript.trim()) {
      stopAndProcess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  // ── Start listening ───────────────────────────────────────────────────────
  const startListening = () => {
    resetTranscript();
    setGroqResult("");
    setStatus("listening");
    SpeechRecognition.startListening({
      continuous: !isMobile,   // continuous OFF on mobile (auto-stops after silence)
      language: selectedLang,
    });
  };

  // ── Stop and send to GROQ ─────────────────────────────────────────────────
  const stopAndProcess = async () => {
    SpeechRecognition.stopListening();
    if (!transcript.trim()) {
      setStatus("idle");
      return;
    }
    setStatus("thinking");
    await askGroq(transcript);
  };

  // ── GROQ ──────────────────────────────────────────────────────────────────
  const askGroq = async (text) => {
    const apiKey = process.env.REACT_APP_GROQ_API_KEY;
    if (!apiKey) {
      setStatus("error");
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
            {
              role: "user",
              content: text,
            },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setStatus("error");
        return;
      }

      const result = data.choices[0].message.content;
      setGroqResult(result);
      setStatus("done");

      if (onResult) onResult({ transcript: text, result, lang: selectedLang });

    } catch {
      setStatus("error");
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = () => {
    resetTranscript();
    setGroqResult("");
    setStatus("idle");
  };

  // ── Route badge colour ────────────────────────────────────────────────────
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
      <p style={styles.subtitle}>
        Speak in any language — AI will understand
        {isMobile && <span style={styles.mobileBadge}> 📱 Mobile mode</span>}
      </p>

      {/* Language selector */}
      <div style={styles.langRow}>
        <label style={styles.langLabel}>Language</label>
        <select
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          style={styles.select}
          disabled={status === "listening"}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Idle / Done: show start button */}
      {(status === "idle" || status === "done") && (
        <button style={styles.micBtn} onClick={startListening}>
          🎙️ Start Speaking
        </button>
      )}

      {/* Listening state */}
      {status === "listening" && (
        <div>
          <div style={styles.listeningBox}>
            <div style={styles.pulse} />
            <span style={{ color: "#c62828", fontWeight: "bold" }}>
              {isMobile ? "Listening… (speak now, mic stops automatically)" : "Listening…"}
            </span>
          </div>

          {transcript && (
            <div style={styles.transcriptBox}>
              <p style={styles.transcriptLabel}>Hearing:</p>
              <p style={styles.transcriptText}>{transcript}</p>
            </div>
          )}

          {/* On desktop show manual stop button; on mobile it auto-stops */}
          {!isMobile && (
            <button style={styles.stopBtn} onClick={stopAndProcess}>
              ⏹ Stop &amp; Process
            </button>
          )}
        </div>
      )}

      {/* Thinking state */}
      {status === "thinking" && (
        <div style={styles.statusBox}>
          <div style={styles.spinner} />
          <p>AI is understanding…</p>
          <div style={styles.transcriptBox}>
            <p style={styles.transcriptLabel}>You said:</p>
            <p style={styles.transcriptText}>{transcript}</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div style={styles.error}>
          ❌ Something went wrong. Check your API key or try again.
          <button style={{ ...styles.micBtn, marginTop: 12 }} onClick={reset}>
            Try Again
          </button>
        </div>
      )}

      {/* Result */}
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

          <div style={styles.transcriptBox}>
            <p style={styles.transcriptLabel}>
              Original ({LANGUAGES.find((l) => l.code === selectedLang)?.label}):
            </p>
            <p style={styles.transcriptText}>{transcript}</p>
          </div>

          <button style={styles.micBtn} onClick={startListening}>
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
  mobileBadge:     { background: "#e8eaf6", color: "#1a237e", borderRadius: 10, padding: "2px 8px", fontSize: 12, marginLeft: 6 },
  langRow:         { display: "flex", alignItems: "center", gap: 10, marginBottom: 20 },
  langLabel:       { fontSize: 14, color: "#555", whiteSpace: "nowrap" },
  select:          { flex: 1, padding: "10px 12px", fontSize: 14, borderRadius: 8, border: "1px solid #c5cae9", background: "#f8f9ff" },
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
  error:           { background: "#ffebee", border: "1px solid #ef9a9a", color: "#c62828", borderRadius: 8, padding: 14, fontSize: 14 },
};
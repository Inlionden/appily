import { useState, useRef, useEffect } from "react";

/* ───────── Languages (BCP-47 codes for Web Speech API) ───────── */
const LANGUAGES = [
  { label: "English (India)", code: "en-IN" },
  { label: "Hindi",           code: "hi-IN" },
  { label: "Telugu",          code: "te-IN" },
  { label: "Tamil",           code: "ta-IN" },
  { label: "Kannada",         code: "kn-IN" },
  { label: "Malayalam",       code: "ml-IN" },
  { label: "Marathi",         code: "mr-IN" },
  { label: "Bengali",         code: "bn-IN" },
  { label: "Gujarati",        code: "gu-IN" },
  { label: "Punjabi",         code: "pa-IN" },
  { label: "Urdu",            code: "ur-IN" },
  { label: "Odia",            code: "or-IN" },
  { label: "English (US)",    code: "en-US" },
];

/* ───────── Tunables ───────── */
const RESTART_DELAY_MS = 250;       // pause before restart
const RESULT_GRACE_MS  = 400;       // ignore onresult for this long after restart (prevents audio-buffer replay)

export default function VoiceInput({ onResult }) {
  const [selectedLang, setSelectedLang]           = useState("en-IN");
  const [status, setStatus]                       = useState("idle"); // idle | recording | done | error | unsupported
  const [finalTranscript, setFinalTranscript]     = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorMsg, setErrorMsg]                   = useState("");
  const [copied, setCopied]                       = useState(false);

  const recognitionRef         = useRef(null);
  const committedRef           = useRef("");    // text committed from PAST sessions
  const currentSessionRef      = useRef("");    // final text in CURRENT session
  const userStoppedRef         = useRef(false); // did user press Stop?
  const selectedLangRef        = useRef("en-IN");
  const ignoreResultsUntilRef  = useRef(0);     // timestamp — ignore onresult before this (grace period)

  /* ───────── Browser support check ───────── */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setStatus("unsupported");
  }, []);

  /* ───────── Keep language ref in sync ───────── */
  useEffect(() => {
    selectedLangRef.current = selectedLang;
  }, [selectedLang]);

  /* ───────── Cleanup on unmount ───────── */
  useEffect(() => {
    return () => {
      userStoppedRef.current = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop();  } catch {}
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  /* ───────── Commit the current session's text into accumulated total (with dedup) ───────── */
  const commitSession = () => {
    const sessionText = currentSessionRef.current;
    if (!sessionText) return;

    const committed = committedRef.current;

    // DEDUP: if the session text is already at the end of committed, skip it
    // (this catches audio-buffer replays on mobile)
    const trimmedSession = sessionText.trim();
    const trimmedCommitted = committed.trim();
    if (trimmedSession && trimmedCommitted.endsWith(trimmedSession)) {
      // duplicate — skip
    } else {
      committedRef.current = committed + sessionText;
    }
    currentSessionRef.current = "";
  };

  /* ───────── Create a fresh recognition instance ───────── */
  const createRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.lang           = selectedLangRef.current;

    recognition.onstart = () => setStatus("recording");

    recognition.onresult = (event) => {
      // Grace period: ignore results right after a restart (mobile audio-buffer replay)
      if (Date.now() < ignoreResultsUntilRef.current) return;

      let sessionFinal = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          sessionFinal += text + " ";
        } else {
          interim += text;
        }
      }
      currentSessionRef.current = sessionFinal;

      const full = committedRef.current + sessionFinal;
      setFinalTranscript(full);
      setInterimTranscript(interim);
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed") {
        userStoppedRef.current = true;
        setErrorMsg("Microphone access denied. Please allow mic permission.");
        setStatus("error");
      } else if (e.error === "network") {
        userStoppedRef.current = true;
        setErrorMsg("Network error. Speech recognition needs internet.");
        setStatus("error");
      }
      // "no-speech" and "aborted" are normal — ignore
    };

    recognition.onend = () => {
      // Commit this session's text (dedup check inside)
      commitSession();
      setFinalTranscript(committedRef.current);
      setInterimTranscript("");

      if (userStoppedRef.current) {
        const fullText = committedRef.current.trim();
        if (fullText) {
          setStatus("done");
          if (onResult) onResult({ transcript: fullText, lang: selectedLangRef.current });
        } else {
          setStatus("idle");
        }
      } else {
        // Session ended on its own (mobile timeout) → restart with fresh instance + grace period
        setTimeout(() => {
          if (userStoppedRef.current) return;

          const fresh = createRecognition();
          recognitionRef.current = fresh;
          ignoreResultsUntilRef.current = Date.now() + RESULT_GRACE_MS;

          try {
            fresh.start();
          } catch (err) {
            // Restart failed → wrap up with what we have
            const txt = committedRef.current.trim();
            if (txt) {
              setStatus("done");
              if (onResult) onResult({ transcript: txt, lang: selectedLangRef.current });
            } else {
              setStatus("idle");
            }
          }
        }, RESTART_DELAY_MS);
      }
    };

    return recognition;
  };

  /* ───────── Start ───────── */
  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setStatus("unsupported");
      return;
    }

    if (status === "recording") return; // guard against double-start

    // Fresh state
    setFinalTranscript("");
    setInterimTranscript("");
    committedRef.current = "";
    currentSessionRef.current = "";
    userStoppedRef.current = false;
    ignoreResultsUntilRef.current = 0;
    setErrorMsg("");

    const recognition = createRecognition();
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      setErrorMsg("Could not start. Try again.");
      setStatus("error");
    }
  };

  /* ───────── Stop ───────── */
  const stopRecording = () => {
    userStoppedRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
  };

  /* ───────── Reset ───────── */
  const reset = () => {
    userStoppedRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop();  } catch {}
      try { recognitionRef.current.abort(); } catch {}
    }
    setFinalTranscript("");
    setInterimTranscript("");
    committedRef.current = "";
    currentSessionRef.current = "";
    setErrorMsg("");
    setStatus("idle");
  };

  /* ───────── Copy ───────── */
  const copyToClipboard = () => {
    const text = finalTranscript.trim();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const wordCount = finalTranscript.trim().split(/\s+/).filter(Boolean).length;
  const selectedLangLabel = LANGUAGES.find((l) => l.code === selectedLang)?.label;

  /* ───────── Unsupported browser screen ───────── */
  if (status === "unsupported") {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>🎙️ Voice Input</h2>
        <div style={styles.error}>
          ❌ Your browser does not support the Web Speech API.
          <br /><br />
          Please use <strong>Google Chrome</strong> (desktop or Android) for best results.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🎙️ Voice Input</h2>
      <p style={styles.subtitle}>Pick your language — see text appear as you speak</p>

      {/* Language selector */}
      <div style={styles.langRow}>
        <label style={styles.langLabel}>Language</label>
        <select
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          style={styles.select}
          disabled={status === "recording"}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* IDLE */}
      {status === "idle" && (
        <button style={styles.micBtn} onClick={startRecording}>
          🎙️ Start Speaking
        </button>
      )}

      {/* RECORDING */}
      {status === "recording" && (
        <div>
          <div style={styles.listeningBox}>
            <div style={styles.pulse} />
            <span style={styles.listeningText}>
              Listening… speak now in {selectedLangLabel}
            </span>
          </div>

          <div style={styles.liveBox}>
            <p style={styles.transcriptLabel}>Live transcript:</p>
            <p style={styles.transcriptText}>
              {finalTranscript}
              {interimTranscript && <span style={styles.interim}>{interimTranscript}</span>}
              {!finalTranscript && !interimTranscript && (
                <span style={styles.placeholder}>Start speaking…</span>
              )}
            </p>
            {wordCount > 0 && <p style={styles.wordCount}>{wordCount} words</p>}
          </div>

          {errorMsg && <div style={styles.warning}>⚠️ {errorMsg}</div>}

          <button style={styles.stopBtn} onClick={stopRecording}>
            ⏹ Stop Listening
          </button>
        </div>
      )}

      {/* ERROR */}
      {status === "error" && (
        <div>
          <div style={styles.error}>❌ {errorMsg}</div>
          <button style={{ ...styles.micBtn, marginTop: 12 }} onClick={reset}>
            Try Again
          </button>
        </div>
      )}

      {/* DONE */}
      {status === "done" && (
        <div>
          <div style={styles.resultBox}>
            <div style={styles.resultHeader}>
              <span style={styles.resultLabel}>Transcript ({selectedLangLabel})</span>
              <button style={styles.copyBtn} onClick={copyToClipboard}>
                {copied ? "✓ Copied" : "📋 Copy"}
              </button>
            </div>
            <p style={styles.resultText}>{finalTranscript.trim()}</p>
            <p style={styles.wordCount}>{wordCount} words</p>
          </div>

          <button style={styles.micBtn} onClick={startRecording}>
            🎙️ Speak Again
          </button>
          <button style={styles.resetBtn} onClick={reset}>
            🗑 Clear
          </button>
        </div>
      )}

      <div style={styles.tip}>
        💡 Tip: Works best in Google Chrome. Uses 100% free browser speech recognition — no API keys needed.
      </div>

      <style>{`
        @keyframes vi-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}

/* ───────── Inline styles (matches App.js indigo theme) ───────── */
const styles = {
  container:       { maxWidth: 500, margin: "30px auto", padding: "0 20px", fontFamily: "sans-serif" },
  title:           { fontSize: 24, color: "#1a237e", marginBottom: 4 },
  subtitle:        { color: "#888", fontSize: 14, marginBottom: 24 },

  langRow:         { display: "flex", alignItems: "center", gap: 10, marginBottom: 20 },
  langLabel:       { fontSize: 14, color: "#555", whiteSpace: "nowrap" },
  select:          { flex: 1, padding: "10px 12px", fontSize: 14, borderRadius: 8, border: "1px solid #c5cae9", background: "#f8f9ff", cursor: "pointer" },

  micBtn:          { width: "100%", padding: "16px", fontSize: 16, background: "#1a237e", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", marginBottom: 8, fontWeight: "bold" },
  stopBtn:         { width: "100%", padding: "16px", fontSize: 16, background: "#c62828", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", marginTop: 12, fontWeight: "bold" },
  resetBtn:        { width: "100%", padding: "12px", fontSize: 14, background: "#f5f5f5", color: "#555", border: "none", borderRadius: 12, cursor: "pointer", marginTop: 8 },

  listeningBox:    { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#fff3f3", borderRadius: 10, marginBottom: 12, border: "1px solid #ffcdd2" },
  pulse:           { width: 12, height: 12, background: "#c62828", borderRadius: "50%", animation: "vi-pulse 1.2s ease-in-out infinite", flexShrink: 0 },
  listeningText:   { color: "#c62828", fontWeight: "bold", fontSize: 14 },

  liveBox:         { background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 10, padding: 14, marginBottom: 12, minHeight: 90 },
  transcriptLabel: { fontSize: 11, color: "#666", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "bold" },
  transcriptText:  { fontSize: 15, color: "#1a1a1a", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  interim:         { color: "#888", fontStyle: "italic" },
  placeholder:     { color: "#bbb" },
  wordCount:       { fontSize: 11, color: "#888", margin: "8px 0 0" },

  resultBox:       { background: "#f0f4ff", border: "1px solid #c5cae9", borderRadius: 10, padding: 14, marginBottom: 12 },
  resultHeader:    { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  resultLabel:     { fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "bold" },
  copyBtn:         { padding: "4px 10px", fontSize: 12, background: "#fff", color: "#1a237e", border: "1px solid #c5cae9", borderRadius: 6, cursor: "pointer", fontWeight: "bold" },
  resultText:      { whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 15, color: "#1a1a1a", margin: 0, lineHeight: 1.6 },

  warning:         { background: "#fff8e1", border: "1px solid #ffe082", color: "#8d6e00", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 },
  error:           { background: "#ffebee", border: "1px solid #ef9a9a", color: "#c62828", borderRadius: 8, padding: 14, fontSize: 14 },

  tip:             { fontSize: 12, color: "#888", marginTop: 20, padding: "10px 12px", background: "#f8f9ff", borderRadius: 8, borderLeft: "3px solid #1a237e" },
};
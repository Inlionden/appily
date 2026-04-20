import { useState, useRef, useEffect } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import {
  initTTS,
  speakText,
  stopSpeaking,
  getVoices,
  detectLanguage,
  startSoundLevel,
  startRecording,
  getAudioSupport,
} from "./AudioUtils";

var LANGS = [
  { label: "English (India)", code: "en-IN" },
  { label: "Telugu",          code: "te-IN" },
  { label: "Hindi",           code: "hi-IN" },
  { label: "Tamil",           code: "ta-IN" },
  { label: "Kannada",         code: "kn-IN" },
  { label: "Malayalam",       code: "ml-IN" },
  { label: "English (US)",    code: "en-US" },
];

function Card(props) {
  return (
    <div style={{
      border: "2px solid " + props.color,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
      background: "#f8f9ff",
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: "bold",
        color: props.color,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 10,
      }}>
        {props.title}
      </div>
      {props.children}
    </div>
  );
}

function Btn(props) {
  var c = props.color || "#1a237e";
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        flex: 1,
        padding: "10px 8px",
        fontSize: 13,
        fontWeight: "bold",
        background: props.disabled ? "#eee" : props.active ? c : "#e8eaf6",
        color: props.disabled ? "#aaa" : props.active ? "#fff" : c,
        border: "1px solid " + (props.disabled ? "#ccc" : c),
        borderRadius: 8,
        cursor: props.disabled ? "not-allowed" : "pointer",
      }}
    >
      {props.children}
    </button>
  );
}

function Row(props) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      padding: "5px 0",
      borderBottom: "1px solid #eee",
      fontSize: 14,
    }}>
      <span style={{ color: "#666" }}>{props.label}</span>
      <span style={{ fontWeight: "bold", color: "#1a237e" }}>{props.value}</span>
    </div>
  );
}

export default function AudioTest() {
  var support = getAudioSupport();

  var ttsTextArr   = useState("Good morning Dad, how are you today?");
  var ttsText      = ttsTextArr[0];
  var setTtsText   = ttsTextArr[1];

  var ttsLangArr   = useState("en-IN");
  var ttsLang      = ttsLangArr[0];
  var setTtsLang   = ttsLangArr[1];

  var speakingArr  = useState(false);
  var speaking     = speakingArr[0];
  var setSpeaking  = speakingArr[1];

  var ttsReadyArr  = useState(false);
  var ttsReady     = ttsReadyArr[0];
  var setTtsReady  = ttsReadyArr[1];

  var voicesArr    = useState([]);
  var voices       = voicesArr[0];
  var setVoices    = voicesArr[1];

  var sttResult             = useSpeechRecognition();
  var transcript            = sttResult.transcript;
  var resetTranscript       = sttResult.resetTranscript;
  var browserSupportsSpeech = sttResult.browserSupportsSpeechRecognition;

  var sttLangArr   = useState("en-IN");
  var sttLang      = sttLangArr[0];
  var setSttLang   = sttLangArr[1];

  var listenArr    = useState(false);
  var listening    = listenArr[0];
  var setListening = listenArr[1];

  var detectedArr  = useState(null);
  var detected     = detectedArr[0];
  var setDetected  = detectedArr[1];

  var detectTextArr = useState("");
  var detectText    = detectTextArr[0];
  var setDetectText = detectTextArr[1];

  var soundRef     = useRef(null);
  var soundOnArr   = useState(false);
  var soundOn      = soundOnArr[0];
  var setSoundOn   = soundOnArr[1];

  var levelArr     = useState(0);
  var level        = levelArr[0];
  var setLevel     = levelArr[1];

  var soundLabelArr = useState("Silent");
  var soundLabel    = soundLabelArr[0];
  var setSoundLabel = soundLabelArr[1];

  var recorderRef  = useRef(null);
  var recordingArr = useState(false);
  var recording    = recordingArr[0];
  var setRecording = recordingArr[1];

  var audioUrlArr  = useState(null);
  var audioUrl     = audioUrlArr[0];
  var setAudioUrl  = audioUrlArr[1];

  var errorArr     = useState("");
  var error        = errorArr[0];
  var setError     = errorArr[1];

  useEffect(function() {
    initTTS("en-IN")
      .then(function() { setTtsReady(true); })
      .catch(function(e) { setError("TTS init: " + e.message); });
    getVoices().then(function(v) { setVoices(v); });
    return function() {
      stopSpeaking();
      SpeechRecognition.stopListening();
      if (soundRef.current) soundRef.current.stop();
      if (recorderRef.current) recorderRef.current.stop();
    };
  }, []);

  function handleSpeak() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (!ttsText.trim()) return;
    setSpeaking(true);
    setError("");
    speakText(ttsText, ttsLang)
      .then(function() { setSpeaking(false); })
      .catch(function(e) {
        setError("TTS error: " + e.message);
        setSpeaking(false);
      });
  }

  function handleListen() {
    if (listening) {
      SpeechRecognition.stopListening();
      setListening(false);
      if (transcript) setDetected(detectLanguage(transcript));
      return;
    }
    resetTranscript();
    setDetected(null);
    setError("");
    setListening(true);
    SpeechRecognition.startListening({ continuous: true, language: sttLang });
  }

  function handleClear() {
    resetTranscript();
    setDetected(null);
    setListening(false);
    SpeechRecognition.stopListening();
  }

  function handleDetectInput(e) {
    var val = e.target.value;
    setDetectText(val);
    if (val.trim().length > 4) {
      setDetected(detectLanguage(val));
    } else {
      setDetected(null);
    }
  }

  function handleSoundLevel() {
    if (soundOn) {
      if (soundRef.current) soundRef.current.stop();
      soundRef.current = null;
      setSoundOn(false);
      setLevel(0);
      setSoundLabel("Silent");
      return;
    }
    setError("");
    setSoundOn(true);
    soundRef.current = startSoundLevel(
      function(data) {
        setLevel(data.level);
        setSoundLabel(data.label);
      },
      function(e) {
        setError(e);
        setSoundOn(false);
      }
    );
  }

  function handleRecord() {
    if (recording) {
      if (recorderRef.current) recorderRef.current.stop();
      setRecording(false);
      return;
    }
    setAudioUrl(null);
    setError("");
    setRecording(true);
    recorderRef.current = startRecording(
      function(result) {
        setAudioUrl(result.url);
        setRecording(false);
      },
      function(e) {
        setError(e);
        setRecording(false);
      }
    );
  }

  var levelColor =
    level < 20 ? "#1D9E75" :
    level < 50 ? "#EF9F27" :
    "#c62828";

  return (
    <div style={{ maxWidth: 500, margin: "20px auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <h2 style={{ color: "#1a237e", marginBottom: 4 }}>Audio and Voice</h2>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
        All four audio tools
      </p>

      {error ? (
        <div style={{
          background: "#ffebee",
          border: "1px solid #ef9a9a",
          color: "#c62828",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 14,
          fontSize: 13,
        }}>
          {error}
        </div>
      ) : null}

      {/* 1. Text to Speech — speak-tts */}
      <Card title="1. Text to Speech — speak-tts" color="#7F77DD">
        <div style={{
          display: "inline-block",
          fontSize: 11,
          background: ttsReady ? "#e1f5ee" : "#fff3e0",
          color: ttsReady ? "#1D9E75" : "#EF9F27",
          padding: "3px 10px",
          borderRadius: 10,
          marginBottom: 10,
          fontWeight: "bold",
        }}>
          {ttsReady ? "speak-tts ready" : "initialising..."}
        </div>

        <textarea
          value={ttsText}
          onChange={function(e) { setTtsText(e.target.value); }}
          rows={3}
          style={{
            width: "100%",
            padding: 10,
            fontSize: 14,
            borderRadius: 8,
            border: "1px solid #c5cae9",
            marginBottom: 10,
            boxSizing: "border-box",
            resize: "vertical",
            fontFamily: "sans-serif",
          }}
        />

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>
            Language
          </label>
          <select
            value={ttsLang}
            onChange={function(e) { setTtsLang(e.target.value); }}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 14,
              borderRadius: 8,
              border: "1px solid #c5cae9",
            }}
          >
            {LANGS.map(function(l) {
              return (<option key={l.code} value={l.code}>{l.label}</option>);
            })}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={handleSpeak} active={speaking} color="#7F77DD" disabled={!ttsReady}>
            {speaking ? "Stop" : "Speak"}
          </Btn>
        </div>

        {voices.length > 0 ? (
          <p style={{ fontSize: 11, color: "#aaa", marginTop: 8, marginBottom: 0 }}>
            {voices.length} voices on this device
          </p>
        ) : null}
      </Card>

      {/* 2. Speech to Text — react-speech-recognition */}
      <Card title="2. Speech to Text — react-speech-recognition" color="#1D9E75">
        {!browserSupportsSpeech ? (
          <p style={{ fontSize: 13, color: "#c62828", margin: 0 }}>
            Use Chrome on Android for speech recognition.
          </p>
        ) : (
          <div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>
                Speak in
              </label>
              <select
                value={sttLang}
                onChange={function(e) { setSttLang(e.target.value); }}
                disabled={listening}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 14,
                  borderRadius: 8,
                  border: "1px solid #c5cae9",
                }}
              >
                {LANGS.map(function(l) {
                  return (<option key={l.code} value={l.code}>{l.label}</option>);
                })}
              </select>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <Btn onClick={handleListen} active={listening} color="#1D9E75">
                {listening ? "Stop" : "Start Listening"}
              </Btn>
              <Btn onClick={handleClear} color="#888">Clear</Btn>
            </div>

            {listening ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#e1f5ee",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 8,
              }}>
                <div style={{
                  width: 10, height: 10,
                  background: "#1D9E75",
                  borderRadius: "50%",
                  animation: "pulse 1s ease-in-out infinite",
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, color: "#1D9E75", fontWeight: "bold" }}>
                  Listening...
                </span>
              </div>
            ) : null}

            {transcript ? (
              <div style={{
                background: "#fff",
                border: "1px solid #c5cae9",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14,
                color: "#333",
                lineHeight: 1.6,
              }}>
                {transcript}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>
                Tap Start Listening and speak...
              </p>
            )}
          </div>
        )}
      </Card>

      {/* 3. Language Detection — franc-min */}
      <Card title="3. Language Detection — franc-min" color="#D85A30">
        <p style={{ fontSize: 13, color: "#666", marginTop: 0, marginBottom: 10 }}>
          Type in any language — franc-min detects it automatically.
        </p>

        <textarea
          value={detectText}
          onChange={handleDetectInput}
          rows={2}
          placeholder="Type in Telugu, Hindi, Tamil, English..."
          style={{
            width: "100%",
            padding: 10,
            fontSize: 14,
            borderRadius: 8,
            border: "1px solid #c5cae9",
            boxSizing: "border-box",
            fontFamily: "sans-serif",
            marginBottom: 10,
            resize: "vertical",
          }}
        />

        {transcript && !detectText ? (
          <div style={{ display: "flex", marginBottom: 10 }}>
            <Btn
              onClick={function() {
                setDetectText(transcript);
                setDetected(detectLanguage(transcript));
              }}
              color="#D85A30"
            >
              Use speech transcript
            </Btn>
          </div>
        ) : null}

        {detected ? (
          <div style={{
            background: "#fff3f0",
            borderRadius: 8,
            padding: 12,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 26, fontWeight: "bold", color: "#D85A30" }}>
              {detected.language}
            </div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              ISO: {detected.iso} — confidence: {detected.confidence}%
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>
            Type at least 5 characters to detect.
          </p>
        )}
      </Card>

      {/* 4. Sound Level — AudioContext */}
      <Card title="4. Sound Level — AudioContext" color="#378ADD">
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Btn
            onClick={handleSoundLevel}
            active={soundOn}
            color="#378ADD"
            disabled={!support.getUserMedia}
          >
            {soundOn ? "Stop" : "Start Microphone"}
          </Btn>
        </div>

        <div style={{ textAlign: "center", paddingBottom: 10 }}>
          <div style={{
            fontSize: 44,
            fontWeight: "bold",
            color: levelColor,
            fontFamily: "monospace",
            transition: "color 0.2s",
          }}>
            {level}%
          </div>
          <div style={{
            fontSize: 16,
            fontWeight: "bold",
            color: levelColor,
            marginTop: 4,
            marginBottom: 12,
          }}>
            {soundLabel}
          </div>
          <div style={{ height: 16, background: "#eee", borderRadius: 8, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: level + "%",
              background: levelColor,
              borderRadius: 8,
              transition: "width 0.1s, background 0.2s",
            }} />
          </div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "#aaa",
            marginTop: 4,
          }}>
            <span>Silent</span>
            <span>Quiet</span>
            <span>Normal</span>
            <span>Loud</span>
            <span>Very loud</span>
          </div>
        </div>
      </Card>

      {/* 5. Recorder — MediaRecorder */}
      <Card title="5. Audio Recorder — MediaRecorder" color="#888">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Btn
            onClick={handleRecord}
            active={recording}
            color="#c62828"
            disabled={!support.mediaRecorder}
          >
            {recording ? "Stop Recording" : "Start Recording"}
          </Btn>
        </div>

        {recording ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#ffebee",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 8,
          }}>
            <div style={{
              width: 10, height: 10,
              background: "#c62828",
              borderRadius: "50%",
              animation: "pulse 0.8s ease-in-out infinite",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 13, color: "#c62828", fontWeight: "bold" }}>
              Recording...
            </span>
          </div>
        ) : null}

        {audioUrl ? (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 6, marginTop: 0 }}>
              Tap play to hear your recording:
            </p>
            <audio src={audioUrl} controls style={{ width: "100%", borderRadius: 8 }} />
          </div>
        ) : null}

        {!support.mediaRecorder ? (
          <p style={{ fontSize: 12, color: "#c62828", margin: 0 }}>
            Recording not supported on this browser.
          </p>
        ) : null}
      </Card>

      {/* Package summary */}
      <Card title="Packages Used" color="#555">
        <Row label="Text to Speech"   value="speak-tts" />
        <Row label="Speech to Text"   value="react-speech-recognition" />
        <Row label="Language Detect"  value="franc-min" />
        <Row label="Sound Level"      value="AudioContext (browser)" />
        <Row label="Recorder"         value="MediaRecorder (browser)" />
      </Card>

      {/* Browser support */}
      <Card title="Browser Support" color="#aaa">
        <Row label="Speech Synthesis"   value={support.speechSynthesis   ? "Yes" : "No"} />
        <Row label="Speech Recognition" value={browserSupportsSpeech     ? "Yes" : "No"} />
        <Row label="Audio Context"      value={support.audioContext      ? "Yes" : "No"} />
        <Row label="Media Recorder"     value={support.mediaRecorder     ? "Yes" : "No"} />
        <Row label="Microphone"         value={support.getUserMedia      ? "Yes" : "No"} />
      </Card>

    </div>
  );
}
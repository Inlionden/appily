import Speak from "speak-tts";
import { franc } from "franc-min";

var LANG_MAP = {
  "tel": { name: "Telugu",    code: "te-IN" },
  "hin": { name: "Hindi",     code: "hi-IN" },
  "tam": { name: "Tamil",     code: "ta-IN" },
  "kan": { name: "Kannada",   code: "kn-IN" },
  "mal": { name: "Malayalam", code: "ml-IN" },
  "ben": { name: "Bengali",   code: "bn-IN" },
  "ara": { name: "Arabic",    code: "ar-SA" },
  "eng": { name: "English",   code: "en-IN" },
  "mar": { name: "Marathi",   code: "mr-IN" },
  "pan": { name: "Punjabi",   code: "pa-IN" },
  "urd": { name: "Urdu",      code: "ur-PK" },
  "guj": { name: "Gujarati",  code: "gu-IN" },
};

var speechInstance = null;

export async function initTTS(lang) {
  try {
    var speech = new Speak();
    await speech.init({
      volume: 1,
      lang: lang || "en-IN",
      rate: 0.9,
      pitch: 1,
      splitSentences: true,
    });
    speechInstance = speech;
    return speech;
  } catch (e) {
    throw new Error("TTS init failed: " + e.message);
  }
}

export async function speakText(text, lang) {
  try {
    if (!speechInstance) {
      await initTTS(lang || "en-IN");
    }
    if (lang) speechInstance.setLanguage(lang);
    await speechInstance.speak({ text: text });
  } catch (e) {
    throw new Error("TTS speak failed: " + e.message);
  }
}

export function stopSpeaking() {
  if (speechInstance) speechInstance.cancel();
}

export function getVoices() {
  return new Promise(function(resolve) {
    if (!window.speechSynthesis) { resolve([]); return; }
    var voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    window.speechSynthesis.onvoiceschanged = function() {
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

export function detectLanguage(text) {
  if (!text || text.trim().length < 5) {
    return { language: "Unknown", code: "en-IN", confidence: 0, iso: "und" };
  }
  try {
    var iso = franc(text, {
      only: ["tel","hin","tam","kan","mal","ben","ara","eng","mar","pan","urd","guj"],
      minLength: 3,
    });
    if (iso === "und") {
      return { language: "Unknown", code: "en-IN", confidence: 0, iso: "und" };
    }
    var match = LANG_MAP[iso];
    return {
      language:   match ? match.name : iso,
      code:       match ? match.code : "en-IN",
      confidence: 85,
      iso:        iso,
    };
  } catch (e) {
    return { language: "English", code: "en-IN", confidence: 50, iso: "eng" };
  }
}

export function startSoundLevel(onLevel, onError) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    onError("Microphone not supported");
    return null;
  }
  var audioCtx = null;
  var analyser = null;
  var source   = null;
  var stream   = null;
  var animId   = null;
  var running  = true;

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(function(s) {
      stream   = s;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source   = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      var dataArray = new Uint8Array(analyser.frequencyBinCount);
      function tick() {
        if (!running) return;
        analyser.getByteFrequencyData(dataArray);
        var sum = 0;
        for (var i = 0; i < dataArray.length; i++) { sum += dataArray[i]; }
        var avg   = sum / dataArray.length;
        var lvl   = Math.round((avg / 255) * 100);
        var label =
          lvl < 5  ? "Silent"    :
          lvl < 20 ? "Quiet"     :
          lvl < 40 ? "Normal"    :
          lvl < 65 ? "Loud"      : "Very loud";
        onLevel({ level: lvl, label: label });
        animId = requestAnimationFrame(tick);
      }
      tick();
    })
    .catch(function(e) { onError("Mic error: " + e.message); });

  return {
    stop: function() {
      running = false;
      if (animId) cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach(function(t) { t.stop(); });
      if (audioCtx) audioCtx.close();
    }
  };
}

export function startRecording(onStop, onError) {
  if (!window.MediaRecorder) { onError("Recording not supported"); return null; }
  if (!navigator.mediaDevices) { onError("Microphone not supported"); return null; }

  var recorder = null;
  var chunks   = [];

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(function(stream) {
      recorder = new MediaRecorder(stream);
      chunks   = [];
      recorder.ondataavailable = function(e) {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = function() {
        var blob = new Blob(chunks, { type: "audio/webm" });
        var url  = URL.createObjectURL(blob);
        stream.getTracks().forEach(function(t) { t.stop(); });
        onStop({ blob: blob, url: url });
      };
      recorder.start();
    })
    .catch(function(e) { onError("Recording error: " + e.message); });

  return {
    stop: function() {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    }
  };
}

export function getAudioSupport() {
  return {
    speechSynthesis:   !!window.speechSynthesis,
    speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    audioContext:      !!(window.AudioContext || window.webkitAudioContext),
    mediaRecorder:     !!window.MediaRecorder,
    getUserMedia:      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  };
}
// ─────────────────────────────────────────────────────────────
// VisionUtils.js — all camera and vision functions
// ─────────────────────────────────────────────────────────────

import Tesseract from "tesseract.js";
import jsQR from "jsqr";

// ── 1. Open camera stream ─────────────────────────────────────
export async function openCamera(videoEl, facingMode = "environment") {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width:  { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

// ── 2. Stop camera stream ─────────────────────────────────────
export function stopCamera(stream) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
}

// ── 3. Capture frame to canvas ────────────────────────────────
export function captureFrame(videoEl, canvasEl) {
  canvasEl.width  = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  canvasEl.getContext("2d").drawImage(videoEl, 0, 0);
  return canvasEl;
}

// ── 4. Canvas to base64 image URL ─────────────────────────────
export function canvasToDataURL(canvasEl, quality = 0.95) {
  return canvasEl.toDataURL("image/jpeg", quality);
}

// ── 5. OCR — read text from image ────────────────────────────
export async function runOCR(canvasEl, onProgress) {
  const { data: { text } } = await Tesseract.recognize(
    canvasEl,
    "eng",
    { logger: onProgress ? (m) => onProgress(m) : () => {} }
  );
  return text.trim();
}

// ── 6. OCR — preprocess for better accuracy ──────────────────
export function preprocessForOCR(canvasEl) {
  const ctx  = canvasEl.getContext("2d");
  const data = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
  const d    = data.data;

  for (let i = 0; i < d.length; i += 4) {
    // Grayscale
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Contrast boost
    const contrast = 1.8;
    const factor   = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
    const val      = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
    d[i] = d[i + 1] = d[i + 2] = val;
  }
  ctx.putImageData(data, 0, 0);
  return canvasEl;
}

// ── 7. QR / barcode scan ──────────────────────────────────────
export function scanQRCode(canvasEl) {
  const ctx       = canvasEl.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
  const code      = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "dontInvert",
  });
  if (code) {
    return {
      found:    true,
      data:     code.data,
      location: code.location,
    };
  }
  return { found: false, data: null };
}

// ── 8. QR — draw bounding box on canvas ──────────────────────
export function drawQRBox(canvasEl, location) {
  const ctx = canvasEl.getContext("2d");
  ctx.strokeStyle = "#1D9E75";
  ctx.lineWidth   = 4;
  ctx.beginPath();
  ctx.moveTo(location.topLeftCorner.x,     location.topLeftCorner.y);
  ctx.lineTo(location.topRightCorner.x,    location.topRightCorner.y);
  ctx.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
  ctx.lineTo(location.bottomLeftCorner.x,  location.bottomLeftCorner.y);
  ctx.closePath();
  ctx.stroke();
}

// ── 9. Face detection — load models ──────────────────────────
let faceApiLoaded = false;

export async function loadFaceModels() {
  if (faceApiLoaded) return;
  const faceapi = await import("face-api.js");
  const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  ]);
  faceApiLoaded = true;
  return faceapi;
}

// ── 10. Face detection — detect faces + expressions ──────────
export async function detectFaces(canvasEl) {
  const faceapi = await import("face-api.js");
  if (!faceApiLoaded) await loadFaceModels();

  const detections = await faceapi
    .detectAllFaces(canvasEl, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true)
    .withFaceExpressions();

  return detections.map((d) => ({
    box: d.detection.box,
    score: d.detection.score,
    expressions: d.expressions,
    topExpression: Object.entries(d.expressions)
      .sort((a, b) => b[1] - a[1])[0][0],
  }));
}

// ── 11. Face detection — draw boxes on canvas ────────────────
export function drawFaceBoxes(canvasEl, faces) {
  const ctx = canvasEl.getContext("2d");
  faces.forEach(({ box, topExpression, score }) => {
    ctx.strokeStyle = "#7F77DD";
    ctx.lineWidth   = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    ctx.fillStyle = "#7F77DD";
    ctx.font      = "16px sans-serif";
    ctx.fillText(
      `${topExpression} (${Math.round(score * 100)}%)`,
      box.x,
      box.y - 8
    );
  });
}

// ── 12. Document scanner — edge detection ────────────────────
export function applyDocScanFilter(canvasEl) {
  const ctx  = canvasEl.getContext("2d");
  const w    = canvasEl.width;
  const h    = canvasEl.height;
  const data = ctx.getImageData(0, 0, w, h);
  const d    = data.data;
  const out  = new Uint8ClampedArray(d.length);

  // Grayscale + high contrast
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Adaptive threshold — makes it look like a scanned doc
    const val  = gray > 128 ? 255 : 0;
    out[i] = out[i + 1] = out[i + 2] = val;
    out[i + 3] = 255;
  }

  const outData = new ImageData(out, w, h);
  ctx.putImageData(outData, 0, 0);
  return canvasEl;
}

// ── 13. Document scanner — softer scan (better for OCR) ──────
export function applySoftScanFilter(canvasEl) {
  const ctx  = canvasEl.getContext("2d");
  const data = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
  const d    = data.data;

  for (let i = 0; i < d.length; i += 4) {
    const gray     = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const contrast = 2.0;
    const factor   = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
    const val      = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
    d[i] = d[i + 1] = d[i + 2] = val;
  }

  ctx.putImageData(data, 0, 0);
  return canvasEl;
}

// ── 14. Continuous QR scan loop ───────────────────────────────
export function startQRScanLoop(videoEl, canvasEl, onFound, onFrame) {
  let running = true;

  const loop = () => {
    if (!running) return;
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
      captureFrame(videoEl, canvasEl);
      const result = scanQRCode(canvasEl);
      if (result.found) {
        drawQRBox(canvasEl, result.location);
        onFound(result.data);
      }
      if (onFrame) onFrame(canvasEl);
    }
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
  return () => { running = false; };
}

// ── 15. Detect if image is blurry (Laplacian variance) ────────
export function isBlurry(canvasEl, threshold = 100) {
  const ctx  = canvasEl.getContext("2d");
  const data = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height).data;

  const kernel = [0, -1, 0, -1, 4, -1, 0, -1, 0];
  const w      = canvasEl.width;
  let sum      = 0;
  let count    = 0;

  for (let y = 1; y < canvasEl.height - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let val = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx  = ((y + ky) * w + (x + kx)) * 4;
          const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          val += gray * kernel[(ky + 1) * 3 + (kx + 1)];
        }
      }
      sum += val * val;
      count++;
    }
  }

  const variance = sum / count;
  return { blurry: variance < threshold, score: Math.round(variance) };
}
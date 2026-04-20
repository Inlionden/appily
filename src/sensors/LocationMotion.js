// ─────────────────────────────────────────────────────────────
// LocationMotion.js — all location and motion sensor functions
// ─────────────────────────────────────────────────────────────

// ── 1. GPS — get current position ────────────────────────────
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: new Date().toISOString(),
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ── 2. GPS — watch live location changes ─────────────────────
export function watchLocation(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError("Geolocation not supported");
    return null;
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed,
      timestamp: new Date().toISOString(),
    }),
    onError,
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
  return id; // pass to stopWatchLocation to cancel
}

// ── 3. GPS — stop watching ────────────────────────────────────
export function stopWatchLocation(watchId) {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }
}

// ── 4. GPS — calculate distance between two points (metres) ──
export function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 5. GPS — calculate total distance of a path ──────────────
export function getTotalDistance(locationHistory) {
  if (locationHistory.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < locationHistory.length; i++) {
    total += getDistance(
      locationHistory[i - 1].lat,
      locationHistory[i - 1].lng,
      locationHistory[i].lat,
      locationHistory[i].lng
    );
  }
  return Math.round(total); // metres
}

// ── 6. Accelerometer — start listening ───────────────────────
export function startAccelerometer(onData, onError) {
  if (!window.DeviceMotionEvent) {
    onError("Accelerometer not supported");
    return;
  }
  const handler = (e) => {
    const acc = e.accelerationIncludingGravity;
    onData({
      x: acc?.x ?? 0,
      y: acc?.y ?? 0,
      z: acc?.z ?? 0,
      interval: e.interval,
      timestamp: Date.now(),
    });
  };
  window.addEventListener("devicemotion", handler);
  return handler; // save this to stop later
}

// ── 7. Accelerometer — stop listening ────────────────────────
export function stopAccelerometer(handler) {
  if (handler) {
    window.removeEventListener("devicemotion", handler);
  }
}

// ── 8. Step counter (uses accelerometer shake detection) ─────
let stepCount = 0;
let lastMagnitude = 0;
const STEP_THRESHOLD = 12;

export function startStepCounter(onStep, onError) {
  stepCount = 0;
  if (!window.DeviceMotionEvent) {
    onError("Accelerometer not supported — step counting unavailable");
    return;
  }
  const handler = (e) => {
    const acc = e.accelerationIncludingGravity;
    if (!acc) return;
    const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
    if (magnitude > STEP_THRESHOLD && lastMagnitude <= STEP_THRESHOLD) {
      stepCount++;
      onStep(stepCount);
    }
    lastMagnitude = magnitude;
  };
  window.addEventListener("devicemotion", handler);
  return handler;
}

export function resetStepCount() {
  stepCount = 0;
}

export function getStepCount() {
  return stepCount;
}

// ── 9. Gyroscope — start listening ───────────────────────────
export function startGyroscope(onData, onError) {
  if (!window.DeviceOrientationEvent) {
    onError("Gyroscope not supported");
    return;
  }
  const handler = (e) => {
    onData({
      alpha: e.alpha, // rotation around Z (compass heading)
      beta:  e.beta,  // front/back tilt
      gamma: e.gamma, // left/right tilt
      timestamp: Date.now(),
    });
  };
  window.addEventListener("deviceorientation", handler);
  return handler;
}

// ── 10. Gyroscope — stop listening ───────────────────────────
export function stopGyroscope(handler) {
  if (handler) {
    window.removeEventListener("deviceorientation", handler);
  }
}

// ── 11. Compass heading from gyroscope alpha ─────────────────
export function getCompassDirection(alpha) {
  if (alpha === null) return "Unknown";
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(alpha / 45) % 8];
}

// ── 12. Activity detection (walking / running / still) ───────
const ACTIVITY_WINDOW = 10; // samples
const activityBuffer = [];

export function detectActivity(accelerometerData) {
  const { x, y, z } = accelerometerData;
  const magnitude = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
  activityBuffer.push(magnitude);
  if (activityBuffer.length > ACTIVITY_WINDOW) activityBuffer.shift();

  const avg = activityBuffer.reduce((a, b) => a + b, 0) / activityBuffer.length;
  const variance = activityBuffer.reduce((a, b) => a + (b - avg) ** 2, 0) / activityBuffer.length;

  if (variance < 1)   return "still";
  if (variance < 10)  return "walking";
  if (variance < 30)  return "jogging";
  return "running";
}

// ── 13. iOS permission request (required on iPhone) ──────────
export async function requestMotionPermission() {
  if (typeof DeviceMotionEvent?.requestPermission === "function") {
    const result = await DeviceMotionEvent.requestPermission();
    return result === "granted";
  }
  return true; // Android grants automatically
}

export async function requestOrientationPermission() {
  if (typeof DeviceOrientationEvent?.requestPermission === "function") {
    const result = await DeviceOrientationEvent.requestPermission();
    return result === "granted";
  }
  return true;
}
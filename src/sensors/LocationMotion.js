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
  return id;
}

// ── 3. GPS — stop watching ────────────────────────────────────
export function stopWatchLocation(watchId) {
  if (watchId !== null && watchId !== undefined) {
    navigator.geolocation.clearWatch(watchId);
  }
}

// ── 4. GPS — distance between two points (metres) ────────────
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

// ── 5. GPS — total distance of a path ────────────────────────
export function getTotalDistance(locationHistory) {
  if (!locationHistory || locationHistory.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < locationHistory.length; i++) {
    total += getDistance(
      locationHistory[i - 1].lat,
      locationHistory[i - 1].lng,
      locationHistory[i].lat,
      locationHistory[i].lng
    );
  }
  return Math.round(total);
}

// ── 6. Accelerometer — start listening ───────────────────────
export function startAccelerometer(onData, onError) {
  if (!window.DeviceMotionEvent) {
    onError("Accelerometer not supported on this device");
    return null;
  }

  let fired = false;

  const handler = (e) => {
    const acc =
      e.accelerationIncludingGravity?.x != null
        ? e.accelerationIncludingGravity
        : e.acceleration?.x != null
        ? e.acceleration
        : null;

    if (!acc) return;
    fired = true;

    onData({
      x: parseFloat((acc.x ?? 0).toFixed(3)),
      y: parseFloat((acc.y ?? 0).toFixed(3)),
      z: parseFloat((acc.z ?? 0).toFixed(3)),
      interval: e.interval,
      timestamp: Date.now(),
    });
  };

  window.addEventListener("devicemotion", handler, true);

  setTimeout(() => {
    if (!fired) onError("No sensor data received. Try moving your phone.");
  }, 3000);

  return handler;
}

// ── 7. Accelerometer — stop listening ────────────────────────
export function stopAccelerometer(handler) {
  if (handler) {
    window.removeEventListener("devicemotion", handler, true);
  }
}

// ── 8. Step counter ──────────────────────────────────────────
let stepCount = 0;
let lastMagnitude = 0;
let lastStepTime = 0;
const STEP_THRESHOLD = 11;
const STEP_DELAY_MS  = 250;

export function startStepCounter(onStep, onError) {
  stepCount = 0;
  if (!window.DeviceMotionEvent) {
    onError("Accelerometer not supported");
    return null;
  }

  const handler = (e) => {
    const acc =
      e.accelerationIncludingGravity?.x != null
        ? e.accelerationIncludingGravity
        : e.acceleration?.x != null
        ? e.acceleration
        : null;

    if (!acc) return;

    const magnitude = Math.sqrt(
      (acc.x ?? 0) ** 2 +
      (acc.y ?? 0) ** 2 +
      (acc.z ?? 0) ** 2
    );
    const now = Date.now();

    if (
      magnitude > STEP_THRESHOLD &&
      lastMagnitude <= STEP_THRESHOLD &&
      now - lastStepTime > STEP_DELAY_MS
    ) {
      stepCount++;
      lastStepTime = now;
      onStep(stepCount);
    }
    lastMagnitude = magnitude;
  };

  window.addEventListener("devicemotion", handler, true);
  return handler;
}

export function resetStepCount() { stepCount = 0; }
export function getStepCount()   { return stepCount; }

// ── 9. Gyroscope — start listening ───────────────────────────
export function startGyroscope(onData, onError) {
  if (!window.DeviceOrientationEvent) {
    onError("Gyroscope not supported on this device");
    return null;
  }

  let fired = false;

  const handler = (e) => {
    if (e.alpha == null && e.beta == null && e.gamma == null) return;
    fired = true;
    onData({
      alpha: e.alpha != null ? parseFloat(e.alpha.toFixed(1)) : null,
      beta:  e.beta  != null ? parseFloat(e.beta.toFixed(1))  : null,
      gamma: e.gamma != null ? parseFloat(e.gamma.toFixed(1)) : null,
      timestamp: Date.now(),
    });
  };

  window.addEventListener("deviceorientation", handler, true);

  setTimeout(() => {
    if (!fired) onError("No gyroscope data. Try rotating your phone.");
  }, 3000);

  return handler;
}

// ── 10. Gyroscope — stop ─────────────────────────────────────
export function stopGyroscope(handler) {
  if (handler) {
    window.removeEventListener("deviceorientation", handler, true);
  }
}

// ── 11. Compass direction from alpha ─────────────────────────
export function getCompassDirection(alpha) {
  if (alpha === null || alpha === undefined) return "Unknown";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(alpha / 45) % 8];
}

// ── 12. Activity detection ────────────────────────────────────
const ACTIVITY_WINDOW = 10;
const activityBuffer  = [];

export function detectActivity(accelerometerData) {
  const { x, y, z } = accelerometerData;
  const magnitude = Math.sqrt((x ?? 0) ** 2 + (y ?? 0) ** 2 + (z ?? 0) ** 2);
  activityBuffer.push(magnitude);
  if (activityBuffer.length > ACTIVITY_WINDOW) activityBuffer.shift();

  const avg = activityBuffer.reduce((a, b) => a + b, 0) / activityBuffer.length;
  const variance = activityBuffer.reduce((a, b) => a + (b - avg) ** 2, 0) / activityBuffer.length;

  if (variance < 1)  return "still";
  if (variance < 10) return "walking";
  if (variance < 30) return "jogging";
  return "running";
}

// ── 13. iOS permission requests ───────────────────────────────
export async function requestMotionPermission() {
  if (typeof DeviceMotionEvent?.requestPermission === "function") {
    try {
      const result = await DeviceMotionEvent.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

export async function requestOrientationPermission() {
  if (typeof DeviceOrientationEvent?.requestPermission === "function") {
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }
  return true;
}
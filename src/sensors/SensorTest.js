import { useState, useRef, useEffect } from "react";
import {
  getCurrentLocation,
  watchLocation,
  stopWatchLocation,
  getTotalDistance,
  startAccelerometer,
  stopAccelerometer,
  startStepCounter,
  resetStepCount,
  startGyroscope,
  stopGyroscope,
  getCompassDirection,
  detectActivity,
  requestMotionPermission,
  requestOrientationPermission,
} from "./LocationMotion";

// ── Reusable components ───────────────────────────────────────
const Card = ({ title, color, children }) => (
  <div style={{
    background: "#f8f9ff",
    border: `2px solid ${color}`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  }}>
    <div style={{
      fontSize: 12,
      fontWeight: "bold",
      color,
      marginBottom: 10,
      textTransform: "uppercase",
      letterSpacing: 1,
    }}>
      {title}
    </div>
    {children}
  </div>
);

const Row = ({ label, value, unit = "" }) => (
  <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5px 0",
    borderBottom: "1px solid #eee",
    fontSize: 14,
  }}>
    <span style={{ color: "#666" }}>{label}</span>
    <span style={{ fontWeight: "bold", color: "#1a237e", fontFamily: "monospace" }}>
      {value ?? "—"} <span style={{ fontSize: 11, color: "#999" }}>{unit}</span>
    </span>
  </div>
);

const Btn = ({ onClick, active, color = "#1a237e", children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      flex: 1,
      padding: "10px 8px",
      fontSize: 13,
      fontWeight: "bold",
      background: disabled ? "#eee" : active ? color : "#e8eaf6",
      color: disabled ? "#aaa" : active ? "#fff" : color,
      border: `1px solid ${disabled ? "#ddd" : color}`,
      borderRadius: 8,
      cursor: disabled ? "not-allowed" : "pointer",
    }}
  >
    {children}
  </button>
);

// ── Main component ────────────────────────────────────────────
export default function SensorTest() {

  // GPS state
  const [gps, setGps]               = useState(null);
  const [gpsHistory, setGpsHistory] = useState([]);
  const [watching, setWatching]     = useState(false);
  const watchIdRef                  = useRef(null);

  // Accelerometer state
  const [accel, setAccel]   = useState(null);
  const [accelOn, setAccelOn] = useState(false);
  const accelRef            = useRef(null);

  // Step counter state
  const [steps, setSteps]   = useState(0);
  const [stepsOn, setStepsOn] = useState(false);
  const stepsRef            = useRef(null);

  // Activity state
  const [activity, setActivity] = useState("unknown");

  // Gyroscope state
  const [gyro, setGyro]     = useState(null);
  const [gyroOn, setGyroOn] = useState(false);
  const gyroRef             = useRef(null);

  // Permission state
  const [permGranted, setPermGranted] = useState(false);
  const [permError, setPermError]     = useState("");
  const [isIOS, setIsIOS]             = useState(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
    if (!ios) {
      setPermGranted(true);
    }
    return () => {
      stopWatchLocation(watchIdRef.current);
      stopAccelerometer(accelRef.current);
      stopAccelerometer(stepsRef.current);
      stopGyroscope(gyroRef.current);
    };
  }, []);

  // ── Permission ────────────────────────────────────────────
  const requestPerms = async () => {
    const motion      = await requestMotionPermission();
    const orientation = await requestOrientationPermission();
    if (motion && orientation) {
      setPermGranted(true);
      setPermError("");
    } else {
      setPermError("Permission denied. Go to Settings → Safari → Motion & Orientation.");
    }
  };

  // ── GPS handlers ──────────────────────────────────────────
  const snapGPS = async () => {
    try {
      const loc = await getCurrentLocation();
      setGps(loc);
      setGpsHistory(h => [...h, loc]);
    } catch (e) {
      alert("GPS error: " + e.message);
    }
  };

  const toggleWatch = () => {
    if (watching) {
      stopWatchLocation(watchIdRef.current);
      watchIdRef.current = null;
      setWatching(false);
    } else {
      watchIdRef.current = watchLocation(
        (loc) => {
          setGps(loc);
          setGpsHistory(h => [...h.slice(-50), loc]);
        },
        (e) => alert("Watch error: " + e)
      );
      setWatching(true);
    }
  };

  // ── Accelerometer handlers ────────────────────────────────
  const toggleAccel = () => {
    if (accelOn) {
      stopAccelerometer(accelRef.current);
      accelRef.current = null;
      setAccelOn(false);
      setAccel(null);
      setActivity("unknown");
    } else {
      setAccel(null);
      accelRef.current = startAccelerometer(
        (data) => {
          setAccel(data);
          setActivity(detectActivity(data));
        },
        (e) => alert("Accelerometer: " + e)
      );
      setAccelOn(true);
    }
  };

  // ── Step counter handlers ─────────────────────────────────
  const toggleSteps = () => {
    if (stepsOn) {
      stopAccelerometer(stepsRef.current);
      stepsRef.current = null;
      setStepsOn(false);
    } else {
      resetStepCount();
      setSteps(0);
      stepsRef.current = startStepCounter(
        (count) => setSteps(count),
        (e) => alert("Step counter: " + e)
      );
      setStepsOn(true);
    }
  };

  // ── Gyroscope handlers ────────────────────────────────────
  const toggleGyro = () => {
    if (gyroOn) {
      stopGyroscope(gyroRef.current);
      gyroRef.current = null;
      setGyroOn(false);
      setGyro(null);
    } else {
      setGyro(null);
      gyroRef.current = startGyroscope(
        (data) => setGyro(data),
        (e) => alert("Gyroscope: " + e)
      );
      setGyroOn(true);
    }
  };

  const totalDist = getTotalDistance(gpsHistory);
  const activityColor = {
    still:   "#888",
    walking: "#1D9E75",
    jogging: "#EF9F27",
    running: "#c62828",
    unknown: "#aaa",
  }[activity] || "#aaa";

  const activityEmoji = {
    still: "🧍", walking: "🚶", jogging: "🏃", running: "💨"
  }[activity] || "❓";

  return (
    <div style={{
      maxWidth: 500,
      margin: "20px auto",
      padding: "0 16px",
      fontFamily: "sans-serif",
    }}>
      <h2 style={{ color: "#1a237e", marginBottom: 4 }}>📡 Sensor Test</h2>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        Live readings from your phone sensors
      </p>

      {/* iOS permission banner */}
      {isIOS && !permGranted && (
        <div style={{
          background: "#fff3e0",
          border: "1px solid #EF9F27",
          borderRadius: 10,
          padding: 14,
          marginBottom: 16,
        }}>
          <p style={{ margin: "0 0 10px", fontSize: 14, color: "#856404" }}>
            iPhone detected — tap to allow motion sensors
          </p>
          <button onClick={requestPerms} style={{
            width: "100%", padding: 12, background: "#EF9F27",
            color: "#fff", border: "none", borderRadius: 8,
            fontWeight: "bold", fontSize: 14, cursor: "pointer",
          }}>
            Allow Motion Access
          </button>
          {permError && (
            <p style={{ color: "#c62828", fontSize: 12, marginTop: 8 }}>{permError}</p>
          )}
        </div>
      )}

      {/* ── GPS ── */}
      <Card title="GPS Location" color="#1D9E75">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Btn onClick={snapGPS} color="#1D9E75">Snap</Btn>
          <Btn onClick={toggleWatch} active={watching} color="#1D9E75">
            {watching ? "Stop Watch" : "Live Watch"}
          </Btn>
        </div>
        {gps ? (
          <>
            <Row label="Latitude"        value={gps.lat.toFixed(6)} unit="°" />
            <Row label="Longitude"       value={gps.lng.toFixed(6)} unit="°" />
            <Row label="Accuracy"        value={Math.round(gps.accuracy)} unit="m" />
            <Row label="Points recorded" value={gpsHistory.length} />
            <Row label="Total distance"  value={totalDist} unit="m" />
          </>
        ) : (
          <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", margin: 8 }}>
            Tap Snap or Live Watch to start
          </p>
        )}
      </Card>

      {/* ── Accelerometer ── */}
      <Card title="Accelerometer" color="#7F77DD">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Btn
            onClick={toggleAccel}
            active={accelOn}
            color="#7F77DD"
            disabled={isIOS && !permGranted}
          >
            {accelOn ? "Stop" : "Start"}
          </Btn>
        </div>
        {accel ? (
          <>
            <Row label="X axis" value={accel.x} unit="m/s²" />
            <Row label="Y axis" value={accel.y} unit="m/s²" />
            <Row label="Z axis" value={accel.z} unit="m/s²" />
          </>
        ) : (
          <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", margin: 8 }}>
            {accelOn ? "Move your phone..." : "Tap Start and move your phone"}
          </p>
        )}
      </Card>

      {/* ── Activity ── */}
      <Card title="Activity Detection" color={activityColor}>
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>{activityEmoji}</div>
          <div style={{
            fontSize: 22,
            fontWeight: "bold",
            color: activityColor,
            textTransform: "capitalize",
          }}>
            {activity}
          </div>
          <p style={{ fontSize: 12, color: "#aaa", margin: "6px 0 0" }}>
            {accelOn
              ? "Reading from accelerometer"
              : "Start accelerometer above first"}
          </p>
        </div>
      </Card>

      {/* ── Step Counter ── */}
      <Card title="Step Counter" color="#D85A30">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Btn
            onClick={toggleSteps}
            active={stepsOn}
            color="#D85A30"
            disabled={isIOS && !permGranted}
          >
            {stepsOn ? "Stop" : "Start"}
          </Btn>
          <Btn onClick={() => { resetStepCount(); setSteps(0); }} color="#D85A30">
            Reset
          </Btn>
        </div>
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{
            fontSize: 52,
            fontWeight: "bold",
            color: "#D85A30",
            fontFamily: "monospace",
          }}>
            {steps}
          </div>
          <div style={{ fontSize: 13, color: "#aaa" }}>steps</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
            ≈ {Math.round(steps * 0.762)} m &nbsp;|&nbsp; ≈ {Math.round(steps * 0.04)} kcal
          </div>
        </div>
      </Card>

      {/* ── Gyroscope ── */}
      <Card title="Gyroscope and Compass" color="#378ADD">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Btn
            onClick={toggleGyro}
            active={gyroOn}
            color="#378ADD"
            disabled={isIOS && !permGranted}
          >
            {gyroOn ? "Stop" : "Start"}
          </Btn>
        </div>
        {gyro ? (
          <>
            <Row label="Alpha (compass)"  value={gyro.alpha} unit="°" />
            <Row label="Beta (fwd tilt)"  value={gyro.beta}  unit="°" />
            <Row label="Gamma (side tilt)" value={gyro.gamma} unit="°" />
            <Row label="Direction"        value={getCompassDirection(gyro.alpha)} />
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                border: "3px solid #378ADD",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `rotate(${gyro.gamma || 0}deg)`,
                transition: "transform 0.1s",
                background: "#e6f1fb",
              }}>
                <div style={{
                  width: 10,
                  height: 10,
                  background: "#378ADD",
                  borderRadius: "50%",
                  transform: `translateY(${-(gyro.beta || 0) * 0.3}px)`,
                }} />
              </div>
              <p style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>tilt indicator</p>
            </div>
          </>
        ) : (
          <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", margin: 8 }}>
            {gyroOn ? "Rotate your phone..." : "Tap Start and rotate your phone"}
          </p>
        )}
      </Card>

      {/* ── Debug ── */}
      <Card title="Debug Info" color="#888">
        <Row label="DeviceMotionEvent"
          value={window.DeviceMotionEvent ? "✅ Yes" : "❌ No"} />
        <Row label="DeviceOrientationEvent"
          value={window.DeviceOrientationEvent ? "✅ Yes" : "❌ No"} />
        <Row label="Geolocation"
          value={navigator.geolocation ? "✅ Yes" : "❌ No"} />
        <Row label="iOS detected"
          value={isIOS ? "Yes" : "No"} />
        <Row label="Permission granted"
          value={permGranted ? "✅ Yes" : "⏳ Pending"} />
        <Row label="Platform"
          value={navigator.platform} />
      </Card>

    </div>
  );
}
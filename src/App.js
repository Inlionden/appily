import { useState } from "react";
import MapView from "./MapView";
import GroqTest from "./GroqTest";
import BillScanner from "./BillScanner";
import SupabaseTest from "./SupabaseTest";
import VoiceInput from "./VoiceInput";
import SensorTest from "./sensors/SensorTest";
import VisionTest from "./vision/VisionTest";

const tabs = [
  { id: "map",  label: "🗺️ Map"  },
  { id: "ai",   label: "🤖 AI"   },
  { id: "bill", label: "🧾 Bill" },
  { id: "vision", label: "👁️ Vision" },
  { id: "supabase", label: "🗄️ Database" },
  { id: "voice", label: "🎙️ Voice" },
  { id: "sensors", label: "📡 Sensors" },
];

export default function App() {
  const [active, setActive] = useState("map");

  return (
    <div>
      {/* Tab Bar */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 8,
        padding: "12px 16px",
        background: "#1a237e",
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{
              padding: "10px 20px",
              fontSize: 15,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              background: active === t.id ? "#fff" : "transparent",
              color: active === t.id ? "#1a237e" : "#c5cae9",
              fontWeight: active === t.id ? "bold" : "normal",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {active === "map"  && <MapView />}
      {active === "ai"   && <GroqTest />}
      {active === "bill" && <BillScanner />}
      {active === "supabase" && <SupabaseTest />}
      {active === "vision" && <VisionTest />}
      {active === "voice" && <VoiceInput />}
      {active === "sensors" && <SensorTest />}
    </div>
  );
}
import { useState } from "react";
import supabase from "./supabase";

export default function SupabaseTest() {
  const [status, setStatus] = useState("");
  const [result, setResult] = useState("");

  const testConnection = async () => {
    setStatus("Testing...");
    setResult("");
    try {
      // Just checks if Supabase responds
      const { data, error } = await supabase
        .from("connection_test")
        .select("*")
        .limit(1);

      if (error) {
        // Table doesn't exist = still connected ✅
        if (error.code === "42P01") {
          setStatus("✅ Connected to Supabase!");
          setResult("Connection works. Table doesn't exist yet — that's fine.");
        } else {
          setStatus("⚠️ Connected but got error:");
          setResult(JSON.stringify(error, null, 2));
        }
      } else {
        setStatus("✅ Connected to Supabase!");
        setResult(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      setStatus("❌ Connection failed");
      setResult(err.message);
    }
  };

  const testWrite = async () => {
    setStatus("Writing test data...");
    setResult("");
    try {
      const { error } = await supabase
        .from("connection_test")
        .insert([{ message: "Hello from Appily!", created_at: new Date() }]);

      if (error) {
        setStatus("⚠️ Write failed (table may not exist yet):");
        setResult(JSON.stringify(error, null, 2));
      } else {
        setStatus("✅ Write successful!");
        setResult("Data written to Supabase.");
      }
    } catch (err) {
      setStatus("❌ Write failed");
      setResult(err.message);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🗄️ Supabase Test</h2>
      <p style={styles.subtitle}>Check if Supabase is connected</p>

      <div style={styles.btnRow}>
        <button style={styles.btnPrimary} onClick={testConnection}>
          🔌 Test Connection
        </button>
        <button style={styles.btnSecondary} onClick={testWrite}>
          ✏️ Test Write
        </button>
      </div>

      {status && (
        <p style={styles.status}>{status}</p>
      )}

      {result && (
        <pre style={styles.result}>{result}</pre>
      )}

      <div style={styles.infoBox}>
        <p style={styles.infoTitle}>📋 Your Supabase Info</p>
        <p style={styles.infoRow}>
          URL: <b>{process.env.REACT_APP_SUPABASE_URL || "❌ Not set"}</b>
        </p>
        <p style={styles.infoRow}>
          Key: <b>{process.env.REACT_APP_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Not set"}</b>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: 500, margin: "30px auto", padding: "0 20px", fontFamily: "sans-serif" },
  title: { fontSize: 24, color: "#1a237e", marginBottom: 4 },
  subtitle: { color: "#888", fontSize: 14, marginBottom: 24 },
  btnRow: { display: "flex", gap: 10 },
  btnPrimary: {
    flex: 1, padding: "14px", fontSize: 15, background: "#1a237e",
    color: "#fff", border: "none", borderRadius: 10, cursor: "pointer",
  },
  btnSecondary: {
    flex: 1, padding: "14px", fontSize: 15, background: "#e8eaf6",
    color: "#1a237e", border: "none", borderRadius: 10, cursor: "pointer",
  },
  status: { marginTop: 20, fontWeight: "bold", fontSize: 15 },
  result: {
    background: "#f4f4f4", padding: 14, borderRadius: 8,
    fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word",
  },
  infoBox: {
    marginTop: 24, background: "#e8eaf6", borderRadius: 10, padding: 14,
  },
  infoTitle: { fontWeight: "bold", color: "#1a237e", margin: "0 0 8px" },
  infoRow: { fontSize: 13, color: "#444", margin: "4px 0" },
};
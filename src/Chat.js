import { useState } from "react";

export default function GroqTest() {
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");

  const testGroq = async () => {
    setResult("");
    setStatus("Loading...");

    const apiKey = process.env.REACT_APP_GROQ_API_KEY;

    if (!apiKey) {
      setStatus("❌ ERROR");
      setResult("API key is undefined. Check your .env file and restart the server.");
      return;
    }

    setStatus(`🔑 Key found: ${apiKey.slice(0, 6)}...`);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "Say hello in one sentence." }],
        }),
      });

      const data = await response.json();
      console.log("FULL RESPONSE:", data);

      if (!response.ok) {
        setStatus(`❌ HTTP ${response.status}`);
        setResult(JSON.stringify(data, null, 2));
        return;
      }

      if (data.choices && data.choices.length > 0) {
        setStatus("✅ Success");
        setResult(data.choices[0].message.content);
      } else {
        setStatus("⚠️ Unexpected response");
        setResult(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      setStatus("❌ Network Error");
      setResult(err.message);
      console.error(err);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "50px auto", fontFamily: "monospace", padding: "0 20px" }}>
      <h2>GROQ API Test</h2>
      <button
        onClick={testGroq}
        style={{ padding: "10px 20px", cursor: "pointer", fontSize: "16px" }}
      >
        Run Test
      </button>

      {status && (
        <p style={{ marginTop: "20px", fontWeight: "bold" }}>
          Status: {status}
        </p>
      )}

      {result && (
        <pre style={{
          marginTop: "10px",
          background: "#f4f4f4",
          padding: "15px",
          borderRadius: "8px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: "14px"
        }}>
          {result}
        </pre>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function QARunnerPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState("");

  async function loadHistory() {
    try {
      const res = await fetch(`${API_BASE}/qa-runner/history`);
      const data = await res.json();

      if (data.ok) {
        setHistory(data.history || []);
      } else {
        setMessage(data.message || "Failed to load QA history.");
      }
    } catch (error) {
      setMessage("Backend not running or QA routes not available.");
    }
  }

  async function runCheck(type: "frontend" | "backend" | "full") {
    setRunning(type);
    setMessage("");
    setSelected(null);

    const route =
      type === "frontend"
        ? "/qa-runner/frontend-build"
        : type === "backend"
        ? "/qa-runner/backend-compile"
        : "/qa-runner/full-check";

    try {
      const res = await fetch(`${API_BASE}${route}`, {
        method: "POST",
      });

      const data = await res.json();

      setMessage(data.message || "QA check completed.");

      if (type === "full") {
        setSelected(data.summary || data);
      } else {
        setSelected(data.result || data);
      }

      await loadHistory();
    } catch (error) {
      setMessage("Failed to run QA check. Backend may not be running.");
    } finally {
      setRunning("");
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  const passed = history.filter((item) => item.status === "passed").length;
  const failed = history.filter((item) => item.status === "failed").length;

  return (
    <main style={{ minHeight: "100vh", background: "#050816", color: "white", padding: "32px" }}>
      <section style={{ border: "1px solid #263044", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}>
        <p style={{ color: "#38bdf8", fontWeight: 800, letterSpacing: "2px", fontSize: "12px" }}>
          QA RUNNER V1
        </p>

        <h1 style={{ fontSize: "32px", fontWeight: 900, marginTop: "8px" }}>
          Run Build and Compile Checks
        </h1>

        <p style={{ color: "#94a3b8", marginTop: "8px" }}>
          Test frontend build and backend Python compile from the dashboard before pushing code.
        </p>
      </section>

      {message && (
        <section style={{ border: "1px solid #0e7490", borderRadius: "16px", padding: "16px", marginBottom: "24px", color: "#a5f3fc" }}>
          {message}
        </section>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <div style={{ border: "1px solid #263044", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Total Checks</p>
          <h2 style={{ fontSize: "30px", fontWeight: 900 }}>{history.length}</h2>
        </div>

        <div style={{ border: "1px solid #14532d", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Passed</p>
          <h2 style={{ fontSize: "30px", fontWeight: 900, color: "#86efac" }}>{passed}</h2>
        </div>

        <div style={{ border: "1px solid #7f1d1d", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Failed</p>
          <h2 style={{ fontSize: "30px", fontWeight: 900, color: "#fca5a5" }}>{failed}</h2>
        </div>
      </section>

      <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Run Checks</h2>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "16px" }}>
          <button
            onClick={() => runCheck("backend")}
            disabled={!!running}
            style={{ padding: "12px 16px", borderRadius: "10px", fontWeight: 800 }}
          >
            {running === "backend" ? "Running..." : "Run Backend Compile"}
          </button>

          <button
            onClick={() => runCheck("frontend")}
            disabled={!!running}
            style={{ padding: "12px 16px", borderRadius: "10px", fontWeight: 800 }}
          >
            {running === "frontend" ? "Running..." : "Run Frontend Build"}
          </button>

          <button
            onClick={() => runCheck("full")}
            disabled={!!running}
            style={{ padding: "12px 16px", borderRadius: "10px", fontWeight: 900, background: "#1e3a8a", color: "white", border: "1px solid #60a5fa" }}
          >
            {running === "full" ? "Running Full Check..." : "Run Full QA Check"}
          </button>
        </div>

        <p style={{ color: "#94a3b8", marginTop: "14px" }}>
          Full QA can take some time because npm run build is slower.
        </p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "24px" }}>
        <div style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800 }}>History</h2>
            <button onClick={loadHistory} style={{ padding: "10px 12px", borderRadius: "10px" }}>
              Refresh
            </button>
          </div>

          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            {history.length === 0 && <p style={{ color: "#94a3b8" }}>No QA checks yet.</p>}

            {history.map((item, index) => (
              <button
                key={index}
                onClick={() => setSelected(item)}
                style={{
                  textAlign: "left",
                  padding: "14px",
                  borderRadius: "14px",
                  border: item.status === "passed" ? "1px solid #14532d" : "1px solid #7f1d1d",
                  background: "#0b1020",
                  color: "white",
                }}
              >
                <div style={{ fontWeight: 800 }}>{item.title || item.type}</div>
                <div style={{ color: item.status === "passed" ? "#86efac" : "#fca5a5", fontSize: "12px", marginTop: "4px" }}>
                  {item.status?.toUpperCase()} ? {item.finished_at || item.started_at}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800 }}>
            Result Details {selected?.title ? `? ${selected.title}` : ""}
          </h2>

          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            <div style={{ border: "1px solid #263044", borderRadius: "14px", padding: "14px", background: "#0b1020" }}>
              <p style={{ color: "#94a3b8" }}>Command</p>
              <pre style={{ whiteSpace: "pre-wrap", color: "#cbd5e1", marginTop: "8px" }}>
                {selected?.command || "Select a result."}
              </pre>
            </div>

            <div style={{ border: "1px solid #263044", borderRadius: "14px", padding: "14px", background: "#0b1020" }}>
              <p style={{ color: "#94a3b8" }}>STDOUT</p>
              <pre style={{ whiteSpace: "pre-wrap", color: "#cbd5e1", marginTop: "8px", maxHeight: "300px", overflow: "auto" }}>
                {selected?.stdout || "No stdout."}
              </pre>
            </div>

            <div style={{ border: "1px solid #7f1d1d", borderRadius: "14px", padding: "14px", background: "#220b0b" }}>
              <p style={{ color: "#fca5a5" }}>STDERR / Errors</p>
              <pre style={{ whiteSpace: "pre-wrap", color: "#fecaca", marginTop: "8px", maxHeight: "300px", overflow: "auto" }}>
                {selected?.stderr || "No errors."}
              </pre>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

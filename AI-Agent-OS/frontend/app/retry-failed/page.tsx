
"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function RetryFailedPage() {
  const [latestFailed, setLatestFailed] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);

  async function loadData() {
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/retry-failed/latest`);
      const data = await res.json();

      if (data.ok) {
        setLatestFailed(data.latest_failed || null);
        setHistory(data.retry_history || []);
      } else {
        setMessage(data.message || "Failed to load retry data.");
      }
    } catch (error) {
      setMessage("Backend not running or retry routes not available.");
    }
  }

  async function retryLatest() {
    setRunning(true);
    setMessage("");
    setSelected(null);

    try {
      const res = await fetch(`${API_BASE}/retry-failed/retry-latest`, {
        method: "POST",
      });

      const data = await res.json();

      setMessage(data.message || "Retry completed.");
      setSelected(data.result || data.retry_record || data);

      await loadData();
    } catch (error) {
      setMessage("Failed to run retry. Backend may not be running.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const passed = history.filter((item) => item.retry_result?.status === "passed").length;
  const failed = history.filter((item) => item.retry_result?.status === "failed").length;

  return (
    <main style={{ minHeight: "100vh", background: "#050816", color: "white", padding: "32px" }}>
      <section style={{ border: "1px solid #263044", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}>
        <p style={{ color: "#38bdf8", fontWeight: 800, letterSpacing: "2px", fontSize: "12px" }}>
          RETRY FAILED STEP V1
        </p>

        <h1 style={{ fontSize: "32px", fontWeight: 900, marginTop: "8px" }}>
          Retry Failed QA Steps
        </h1>

        <p style={{ color: "#94a3b8", marginTop: "8px" }}>
          Finds the latest failed QA check and reruns it from the dashboard.
        </p>
      </section>

      {message && (
        <section style={{ border: "1px solid #0e7490", borderRadius: "16px", padding: "16px", marginBottom: "24px", color: "#a5f3fc" }}>
          {message}
        </section>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <div style={{ border: "1px solid #263044", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Retry Runs</p>
          <h2 style={{ fontSize: "30px", fontWeight: 900 }}>{history.length}</h2>
        </div>

        <div style={{ border: "1px solid #14532d", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Passed</p>
          <h2 style={{ fontSize: "30px", fontWeight: 900, color: "#86efac" }}>{passed}</h2>
        </div>

        <div style={{ border: "1px solid #7f1d1d", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Failed Again</p>
          <h2 style={{ fontSize: "30px", fontWeight: 900, color: "#fca5a5" }}>{failed}</h2>
        </div>
      </section>

      <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Latest Failed Step</h2>
            <p style={{ color: "#94a3b8", marginTop: "6px" }}>
              This is pulled from QA Runner history.
            </p>
          </div>

          <button onClick={loadData} style={{ padding: "10px 12px", borderRadius: "10px" }}>
            Refresh
          </button>
        </div>

        {!latestFailed && (
          <div style={{ border: "1px solid #14532d", borderRadius: "14px", padding: "16px", marginTop: "16px", color: "#86efac" }}>
            No failed QA step found. Good bro ?
          </div>
        )}

        {latestFailed && (
          <div style={{ border: "1px solid #7f1d1d", borderRadius: "14px", padding: "16px", marginTop: "16px", background: "#220b0b" }}>
            <h3 style={{ fontSize: "20px", fontWeight: 900, color: "#fca5a5" }}>
              {latestFailed.title || latestFailed.type}
            </h3>

            <p style={{ color: "#fecaca", marginTop: "8px" }}>
              Status: {latestFailed.status || "failed"} ? {latestFailed.finished_at || latestFailed.started_at}
            </p>

            <pre style={{ whiteSpace: "pre-wrap", color: "#cbd5e1", marginTop: "12px", fontSize: "12px" }}>
              {latestFailed.command || "No command found."}
            </pre>

            <button
              onClick={retryLatest}
              disabled={running}
              style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "10px", fontWeight: 900, background: "#1e3a8a", color: "white", border: "1px solid #60a5fa" }}
            >
              {running ? "Retrying..." : "Retry Latest Failed Step"}
            </button>
          </div>
        )}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "24px" }}>
        <div style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Retry History</h2>

          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            {history.length === 0 && <p style={{ color: "#94a3b8" }}>No retry history yet.</p>}

            {history.map((item, index) => (
              <button
                key={index}
                onClick={() => setSelected(item.retry_result || item)}
                style={{
                  textAlign: "left",
                  padding: "14px",
                  borderRadius: "14px",
                  border: item.retry_result?.status === "passed" ? "1px solid #14532d" : "1px solid #7f1d1d",
                  background: "#0b1020",
                  color: "white",
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  {item.retry_result?.title || "Retry"}
                </div>
                <div style={{ color: item.retry_result?.status === "passed" ? "#86efac" : "#fca5a5", fontSize: "12px", marginTop: "4px" }}>
                  {item.retry_result?.status?.toUpperCase()} ? {item.retried_at}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800 }}>
            Retry Result Details {selected?.title ? `? ${selected.title}` : ""}
          </h2>

          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            <div style={{ border: "1px solid #263044", borderRadius: "14px", padding: "14px", background: "#0b1020" }}>
              <p style={{ color: "#94a3b8" }}>Command</p>
              <pre style={{ whiteSpace: "pre-wrap", color: "#cbd5e1", marginTop: "8px" }}>
                {selected?.command || "Select a retry result."}
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

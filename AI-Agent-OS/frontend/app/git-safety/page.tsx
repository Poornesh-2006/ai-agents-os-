
"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type SafetyCheck = {
  name: string;
  path: string;
  status: string;
  message: string;
  branch?: string;
  changes?: string;
  remote?: string;
  command?: string;
};

export default function GitSafetyPage() {
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadSafety() {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(API_BASE + "/git-safety/check");
      const result = await response.json();

      if (!result.ok) {
        setMessage(result.message || result.error || "Git safety check failed.");
        setData(null);
        return;
      }

      setData(result);
    } catch {
      setMessage("Backend not reachable. Start FastAPI on port 8000.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSafety();
  }, []);

  function statusColor(status: string) {
    if (status === "safe") return "#10b981";
    if (status === "warning") return "#f59e0b";
    if (status === "danger") return "#ef4444";
    return "#94a3b8";
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setMessage("Copied.");
  }

  const checks: SafetyCheck[] = data?.checks || [];

  return (
    <main style={{ minHeight: "100vh", background: "#050816", color: "white", padding: "32px" }}>
      <section style={{ border: "1px solid #263044", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}>
        <p style={{ color: "#38bdf8", fontWeight: 800, letterSpacing: "2px", fontSize: "12px" }}>
          GIT SAFETY GUARD
        </p>

        <h1 style={{ fontSize: "32px", fontWeight: 900, marginTop: "8px" }}>
          Prevent Wrong Folder Git Push
        </h1>

        <p style={{ color: "#94a3b8", marginTop: "8px" }}>
          Checks home folder, frontend repo, backend repo, branch, remote, and uncommitted changes.
        </p>

        <button
          onClick={loadSafety}
          disabled={loading}
          style={{ marginTop: "20px", padding: "12px 16px", borderRadius: "12px" }}
        >
          {loading ? "Checking..." : "Run Safety Check"}
        </button>
      </section>

      {message && (
        <section style={{ border: "1px solid #0e7490", borderRadius: "16px", padding: "16px", marginBottom: "24px", color: "#a5f3fc" }}>
          {message}
        </section>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <div style={{ border: "1px solid #263044", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Safe</p>
          <h2 style={{ color: "#10b981", fontSize: "30px", marginTop: "8px" }}>{data?.safe_count ?? 0}</h2>
        </div>

        <div style={{ border: "1px solid #263044", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Warnings</p>
          <h2 style={{ color: "#f59e0b", fontSize: "30px", marginTop: "8px" }}>{data?.warning_count ?? 0}</h2>
        </div>

        <div style={{ border: "1px solid #263044", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Danger</p>
          <h2 style={{ color: "#ef4444", fontSize: "30px", marginTop: "8px" }}>{data?.danger_count ?? 0}</h2>
        </div>
      </section>

      <section style={{ display: "grid", gap: "16px", marginBottom: "24px" }}>
        {checks.map((item) => (
          <div key={item.name} style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: 800 }}>{item.name}</h2>
                <p style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: "12px", marginTop: "6px" }}>{item.path}</p>
              </div>

              <strong style={{ color: statusColor(item.status), textTransform: "uppercase" }}>
                {item.status}
              </strong>
            </div>

            <p style={{ color: "#e2e8f0", marginTop: "14px" }}>{item.message}</p>

            {item.branch && (
              <p style={{ color: "#94a3b8", marginTop: "10px" }}>Branch: {item.branch}</p>
            )}

            {item.changes && (
              <pre style={{ background: "#020617", border: "1px solid #263044", borderRadius: "12px", padding: "12px", marginTop: "12px", whiteSpace: "pre-wrap", color: "#fbbf24" }}>
                {item.changes}
              </pre>
            )}

            {item.remote && (
              <pre style={{ background: "#020617", border: "1px solid #263044", borderRadius: "12px", padding: "12px", marginTop: "12px", whiteSpace: "pre-wrap", color: "#a7f3d0" }}>
                {item.remote}
              </pre>
            )}

            {item.command && (
              <button
                onClick={() => copyText(item.command || "")}
                style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "10px" }}
              >
                Copy cd Command
              </button>
            )}
          </div>
        ))}
      </section>

      <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Rules</h2>

        <ul style={{ marginTop: "12px", color: "#cbd5e1", lineHeight: "28px" }}>
          {(data?.rules || []).map((rule: string) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>

        <p style={{ color: "#94a3b8", marginTop: "12px" }}>
          Updated: {data?.updated_at || "Not loaded"}
        </p>
      </section>
    </main>
  );
}

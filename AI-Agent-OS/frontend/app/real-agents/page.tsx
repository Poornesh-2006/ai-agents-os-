
"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function RealAgentsPage() {
  const [featureName, setFeatureName] = useState("Agent Tool Permissions Upgrade");
  const [priority, setPriority] = useState("High");
  const [style, setStyle] = useState("Dark AI dashboard");
  const [routeName, setRouteName] = useState("generated-feature");
  const [apiRoute, setApiRoute] = useState("generated-backend-feature");
  const [task, setTask] = useState("Create a safe permission system so agents can only use approved tools.");
  const [outputs, setOutputs] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState("");
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState("");

  async function loadOutputs() {
    try {
      const res = await fetch(`${API_BASE}/real-agents/outputs`);
      const data = await res.json();

      if (data.ok) {
        setOutputs(data.outputs || []);
      } else {
        setMessage(data.message || "Failed to load outputs.");
      }
    } catch (error) {
      setMessage("Backend not running or real agent routes not available.");
    }
  }

  async function runProductManager() {
    setRunning("pm");
    setMessage("");
    setSelectedReport("");

    try {
      const res = await fetch(`${API_BASE}/real-agents/product-manager/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task,
          feature_name: featureName,
          priority,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage("Product Manager Agent completed.");
        setSelectedReport(data.report || "");
        await loadOutputs();
      } else {
        setMessage(data.message || "Product Manager Agent failed.");
      }
    } catch (error) {
      setMessage("Backend not running or Product Manager route not available.");
    } finally {
      setRunning("");
    }
  }

  async function runUIUXDesigner() {
    setRunning("uiux");
    setMessage("");
    setSelectedReport("");

    try {
      const res = await fetch(`${API_BASE}/real-agents/ui-ux/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task,
          feature_name: featureName,
          priority,
          style,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage("UI/UX Designer Agent completed.");
        setSelectedReport(data.report || "");
        await loadOutputs();
      } else {
        setMessage(data.message || "UI/UX Designer Agent failed.");
      }
    } catch (error) {
      setMessage("Backend not running or UI/UX route not available.");
    } finally {
      setRunning("");
    }
  }


  async function runFrontendDeveloper() {
    setRunning("frontend");
    setMessage("");
    setSelectedReport("");

    try {
      const res = await fetch(`${API_BASE}/real-agents/frontend-developer/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task,
          feature_name: featureName,
          route_name: routeName,
          priority,
          style,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage(`Frontend Developer Agent created: ${data.output.generated_file}`);
        setSelectedReport(data.report || "");
        await loadOutputs();
      } else {
        setMessage(data.message || "Frontend Developer Agent failed.");
      }
    } catch (error) {
      setMessage("Backend not running or Frontend Developer route not available.");
    } finally {
      setRunning("");
    }
  }


  async function runBackendDeveloper() {
    setRunning("backend");
    setMessage("");
    setSelectedReport("");

    try {
      const res = await fetch(`${API_BASE}/real-agents/backend-developer/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task,
          feature_name: featureName,
          api_route: apiRoute,
          priority,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage(`Backend Developer Agent created: ${data.output.generated_file}`);
        setSelectedReport(data.report || "");
        await loadOutputs();
      } else {
        setMessage(data.message || "Backend Developer Agent failed.");
      }
    } catch (error) {
      setMessage("Backend not running or Backend Developer route not available.");
    } finally {
      setRunning("");
    }
  }


  async function runQATester() {
    setRunning("qa");
    setMessage("");
    setSelectedReport("");

    try {
      const res = await fetch(`${API_BASE}/real-agents/qa-tester/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task,
          feature_name: featureName,
          priority,
          run_frontend_build: true,
          run_backend_compile: true,
        }),
      });

      const data = await res.json();

      if (data.report) {
        setSelectedReport(data.report || "");
      }

      if (data.ok) {
        setMessage("QA Tester Agent passed.");
      } else {
        setMessage(data.message || "QA Tester Agent found errors.");
      }

      await loadOutputs();
    } catch (error) {
      setMessage("Backend not running or QA Tester route not available.");
    } finally {
      setRunning("");
    }
  }


  async function runProjectReviewer() {
    setRunning("reviewer");
    setMessage("");
    setSelectedReport("");

    try {
      const res = await fetch(`${API_BASE}/real-agents/project-reviewer/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task,
          feature_name: featureName,
          priority,
        }),
      });

      const data = await res.json();

      if (data.report) {
        setSelectedReport(data.report || "");
      }

      if (data.ok) {
        setMessage(data.approved ? "Project Reviewer approved this feature." : "Project Reviewer did not approve yet. Check missing items.");
      } else {
        setMessage(data.message || "Project Reviewer Agent failed.");
      }

      await loadOutputs();
    } catch (error) {
      setMessage("Backend not running or Project Reviewer route not available.");
    } finally {
      setRunning("");
    }
  }

  async function openReport(fileName: string) {
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/real-agents/reports/${encodeURIComponent(fileName)}`);
      const data = await res.json();

      if (data.ok) {
        setSelectedReport(data.content || "");
      } else {
        setMessage(data.message || "Failed to open report.");
      }
    } catch (error) {
      setMessage("Backend not running or report route not available.");
    }
  }

  async function copyReport() {
    await navigator.clipboard.writeText(selectedReport);
    setMessage("Report copied.");
  }

  useEffect(() => {
    loadOutputs();
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#050816", color: "white", padding: "32px" }}>
      <section style={{ border: "1px solid #263044", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}>
        <p style={{ color: "#38bdf8", fontWeight: 800, letterSpacing: "2px", fontSize: "12px" }}>
          REAL AGENT OUTPUTS V1
        </p>

        <h1 style={{ fontSize: "32px", fontWeight: 900, marginTop: "8px" }}>
          Product Manager + UI/UX Designer Agents
        </h1>

        <p style={{ color: "#94a3b8", marginTop: "8px" }}>
          Run real agents to create product requirements and UI/UX design reports from your task.
        </p>
      </section>

      {message && (
        <section style={{ border: "1px solid #0e7490", borderRadius: "16px", padding: "16px", marginBottom: "24px", color: "#a5f3fc" }}>
          {message}
        </section>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: "24px" }}>
        <div style={{ display: "grid", gap: "24px", alignContent: "start" }}>
          <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Run Real Agents</h2>

            <label style={{ display: "block", marginTop: "16px", color: "#94a3b8" }}>Feature name</label>
            <input
              value={featureName}
              onChange={(e) => setFeatureName(e.target.value)}
              style={{ width: "100%", padding: "12px", marginTop: "6px", borderRadius: "10px", background: "#020617", color: "white", border: "1px solid #263044" }}
            />

            <label style={{ display: "block", marginTop: "16px", color: "#94a3b8" }}>Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{ width: "100%", padding: "12px", marginTop: "6px", borderRadius: "10px", background: "#020617", color: "white", border: "1px solid #263044" }}
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>

            <label style={{ display: "block", marginTop: "16px", color: "#94a3b8" }}>UI style</label>
            <input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              style={{ width: "100%", padding: "12px", marginTop: "6px", borderRadius: "10px", background: "#020617", color: "white", border: "1px solid #263044" }}
            />

            <label style={{ display: "block", marginTop: "16px", color: "#94a3b8" }}>Route name</label>
            <input
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              style={{ width: "100%", padding: "12px", marginTop: "6px", borderRadius: "10px", background: "#020617", color: "white", border: "1px solid #263044" }}
            />

            <label style={{ display: "block", marginTop: "16px", color: "#94a3b8" }}>Backend API route</label>
            <input
              value={apiRoute}
              onChange={(e) => setApiRoute(e.target.value)}
              style={{ width: "100%", padding: "12px", marginTop: "6px", borderRadius: "10px", background: "#020617", color: "white", border: "1px solid #263044" }}
            />

            <label style={{ display: "block", marginTop: "16px", color: "#94a3b8" }}>Task / idea</label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={8}
              style={{ width: "100%", padding: "12px", marginTop: "6px", borderRadius: "10px", background: "#020617", color: "white", border: "1px solid #263044" }}
            />

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "16px" }}>
              <button
                onClick={runProductManager}
                disabled={!!running}
                style={{ padding: "12px 16px", borderRadius: "10px", fontWeight: 900, background: "#1e3a8a", color: "white", border: "1px solid #60a5fa" }}
              >
                {running === "pm" ? "PM Running..." : "Run Product Manager"}
              </button>

              <button
                onClick={runUIUXDesigner}
                disabled={!!running}
                style={{ padding: "12px 16px", borderRadius: "10px", fontWeight: 900, background: "#134e4a", color: "white", border: "1px solid #2dd4bf" }}
              >
                {running === "uiux" ? "UI/UX Running..." : "Run UI/UX Designer"}
              </button>

              <button
                onClick={runFrontendDeveloper}
                disabled={!!running}
                style={{ padding: "12px 16px", borderRadius: "10px", fontWeight: 900, background: "#581c87", color: "white", border: "1px solid #c084fc" }}
              >
                {running === "frontend" ? "Frontend Running..." : "Run Frontend Developer"}
              </button>

              <button
                onClick={runBackendDeveloper}
                disabled={!!running}
                style={{ padding: "12px 16px", borderRadius: "10px", fontWeight: 900, background: "#7c2d12", color: "white", border: "1px solid #fb923c" }}
              >
                {running === "backend" ? "Backend Running..." : "Run Backend Developer"}
              </button>

              <button
                onClick={runQATester}
                disabled={!!running}
                style={{ padding: "12px 16px", borderRadius: "10px", fontWeight: 900, background: "#14532d", color: "white", border: "1px solid #86efac" }}
              >
                {running === "qa" ? "QA Running..." : "Run QA Tester"}
              </button>

              <button
                onClick={runProjectReviewer}
                disabled={!!running}
                style={{ padding: "12px 16px", borderRadius: "10px", fontWeight: 900, background: "#172554", color: "white", border: "1px solid #818cf8" }}
              >
                {running === "reviewer" ? "Reviewer Running..." : "Run Project Reviewer"}
              </button>
            </div>
          </section>

          <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
              <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Outputs</h2>
              <button onClick={loadOutputs} style={{ padding: "10px 12px", borderRadius: "10px" }}>
                Refresh
              </button>
            </div>

            <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
              {outputs.length === 0 && <p style={{ color: "#94a3b8" }}>No real agent outputs yet.</p>}

              {outputs.map((item, index) => (
                <button
                  key={index}
                  onClick={() => openReport(item.report_file)}
                  style={{
                    textAlign: "left",
                    padding: "14px",
                    borderRadius: "14px",
                    border: "1px solid #263044",
                    background: "#0b1020",
                    color: "white",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{item.feature_name}</div>
                  <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                    {item.agent_name} ? {item.created_at}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Agent Report</h2>

            <button onClick={copyReport} disabled={!selectedReport} style={{ padding: "10px 12px", borderRadius: "10px" }}>
              Copy Report
            </button>
          </div>

          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#020617",
              border: "1px solid #263044",
              borderRadius: "14px",
              padding: "14px",
              marginTop: "14px",
              color: "#cbd5e1",
              fontSize: "12px",
              lineHeight: "20px",
              minHeight: "680px",
              overflow: "auto",
            }}
          >
            {selectedReport || "Run an agent or open a saved output."}
          </pre>
        </section>
      </section>
    </main>
  );
}


"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type WorkflowReport = {
  file_name: string;
  modified: string;
  size_kb: number;
  preview: string;
};

export default function WorkflowReportsPage() {
  const [reports, setReports] = useState<WorkflowReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<WorkflowReport | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadReports() {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(API_BASE + "/agent-workflow/reports");
      const data = await response.json();

      if (!data.ok) {
        setMessage(data.message || data.error || "Failed to load reports.");
        setReports([]);
        setSelectedReport(null);
        return;
      }

      const items = data.items || [];
      setReports(items);
      setSelectedReport(items[0] || null);
    } catch {
      setMessage("Backend not reachable. Start FastAPI on port 8000.");
      setReports([]);
      setSelectedReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function generateReport() {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(API_BASE + "/agent-workflow/report", {
        method: "POST",
      });

      const data = await response.json();

      if (!data.ok) {
        setMessage(data.message || data.error || "Failed to generate report.");
        return;
      }

      setMessage("Generated report: " + data.file_name);
      await loadReports();
    } catch {
      setMessage("Could not generate report. Check backend terminal.");
    } finally {
      setLoading(false);
    }
  }

  async function copyPreview() {
    if (!selectedReport || !selectedReport.preview) return;
    await navigator.clipboard.writeText(selectedReport.preview);
    setMessage("Report preview copied.");
  }

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#050816", color: "white", padding: "32px" }}>
      <section style={{ border: "1px solid #263044", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}>
        <p style={{ color: "#34d399", fontWeight: 800, letterSpacing: "2px", fontSize: "12px" }}>
          WORKFLOW REPORTS
        </p>

        <h1 style={{ fontSize: "32px", fontWeight: 900, marginTop: "8px" }}>
          Save Agent Workflow as Reports
        </h1>

        <p style={{ color: "#94a3b8", marginTop: "8px" }}>
          Generate readable markdown reports from the latest workflow.
        </p>

        <div style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap" }}>
          <button onClick={loadReports} disabled={loading} style={{ padding: "12px 16px", borderRadius: "12px" }}>
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button onClick={generateReport} disabled={loading} style={{ padding: "12px 16px", borderRadius: "12px" }}>
            Generate Report
          </button>

          <button onClick={copyPreview} disabled={!selectedReport} style={{ padding: "12px 16px", borderRadius: "12px" }}>
            Copy Preview
          </button>
        </div>
      </section>

      {message && (
        <section style={{ border: "1px solid #065f46", borderRadius: "16px", padding: "16px", marginBottom: "24px", color: "#a7f3d0" }}>
          {message}
        </section>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
        <div style={{ border: "1px solid #263044", borderRadius: "24px", padding: "24px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Saved Reports</h2>

          <p style={{ color: "#94a3b8", marginTop: "8px" }}>
            Total reports: {reports.length}
          </p>

          <div style={{ marginTop: "20px", display: "grid", gap: "12px" }}>
            {reports.map((report) => (
              <button
                key={report.file_name}
                onClick={() => setSelectedReport(report)}
                style={{
                  textAlign: "left",
                  padding: "14px",
                  borderRadius: "14px",
                  border: selectedReport?.file_name === report.file_name ? "1px solid #10b981" : "1px solid #263044",
                  background: selectedReport?.file_name === report.file_name ? "#064e3b" : "#0b1020",
                  color: "white",
                }}
              >
                <strong>{report.file_name}</strong>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "6px" }}>
                  {report.modified} ? {report.size_kb} KB
                </div>
              </button>
            ))}

            {reports.length === 0 && (
              <p style={{ color: "#94a3b8" }}>
                No workflow reports yet. Click Generate Report.
              </p>
            )}
          </div>
        </div>

        <div style={{ border: "1px solid #263044", borderRadius: "24px", padding: "24px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Report Preview</h2>

          <p style={{ color: "#94a3b8", marginTop: "8px", marginBottom: "16px" }}>
            Selected: {selectedReport?.file_name || "No report selected"}
          </p>

          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#020617", border: "1px solid #263044", borderRadius: "16px", padding: "16px", maxHeight: "70vh", overflow: "auto", fontSize: "12px", lineHeight: "20px" }}>
            {selectedReport?.preview || "No report selected."}
          </pre>
        </div>
      </section>
    </main>
  );
}

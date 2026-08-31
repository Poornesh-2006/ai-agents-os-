
"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type GeneratedFile = {
  file_name: string;
  path: string;
  size_bytes: number;
  updated_at: string;
  preview: string;
};

export default function AgentFileWriterPage() {
  const [fileName, setFileName] = useState("health-dashboard-page.tsx");
  const [description, setDescription] = useState("Generated page from Agent File Writer v1.");
  const [agentName, setAgentName] = useState("Frontend Developer");
  const [content, setContent] = useState(`export default function GeneratedHealthDashboardPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#050816", color: "white", padding: "32px" }}>
      <h1>Generated Health Dashboard</h1>
      <p>This file was created by Agent File Writer v1.</p>
    </main>
  );
}
`);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedContent, setSelectedContent] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadFiles() {
    try {
      const res = await fetch(`${API_BASE}/agent-file-writer/files`);
      const data = await res.json();
      if (data.ok) {
        setFiles(data.files || []);
      } else {
        setMessage(data.message || "Failed to load files.");
      }
    } catch (error) {
      setMessage("Backend not running or route not available.");
    }
  }

  async function createFile() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/agent-file-writer/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_name: fileName,
          content,
          description,
          agent_name: agentName,
          file_type: "page",
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage(`Created: ${data.file.file_name}`);
        await loadFiles();
      } else {
        setMessage(data.message || "Failed to create file.");
      }
    } catch (error) {
      setMessage("Backend not running or route not available.");
    } finally {
      setLoading(false);
    }
  }

  async function openFile(name: string) {
    setMessage("");
    setSelectedFileName(name);

    try {
      const res = await fetch(`${API_BASE}/agent-file-writer/files/${encodeURIComponent(name)}`);
      const data = await res.json();

      if (data.ok) {
        setSelectedContent(data.content || "");
      } else {
        setSelectedContent("");
        setMessage(data.message || "Failed to open file.");
      }
    } catch (error) {
      setSelectedContent("");
      setMessage("Backend not running or route not available.");
    }
  }

  async function copySelected() {
    await navigator.clipboard.writeText(selectedContent);
    setMessage("Selected file copied.");
  }

  useEffect(() => {
    loadFiles();
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#050816", color: "white", padding: "32px" }}>
      <section style={{ border: "1px solid #263044", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}>
        <p style={{ color: "#38bdf8", fontWeight: 800, letterSpacing: "2px", fontSize: "12px" }}>
          AGENT FILE WRITER V1
        </p>

        <h1 style={{ fontSize: "32px", fontWeight: 900, marginTop: "8px" }}>
          Let Agents Create Files Safely
        </h1>

        <p style={{ color: "#94a3b8", marginTop: "8px" }}>
          This saves generated code into generated_pages. Later we connect this to Safe Install.
        </p>
      </section>

      {message && (
        <section style={{ border: "1px solid #0e7490", borderRadius: "16px", padding: "16px", marginBottom: "24px", color: "#a5f3fc" }}>
          {message}
        </section>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Create Generated File</h2>

          <label style={{ display: "block", marginTop: "16px", color: "#94a3b8" }}>File name</label>
          <input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            style={{ width: "100%", padding: "12px", marginTop: "6px", borderRadius: "10px", background: "#020617", color: "white", border: "1px solid #263044" }}
          />

          <label style={{ display: "block", marginTop: "16px", color: "#94a3b8" }}>Agent name</label>
          <input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            style={{ width: "100%", padding: "12px", marginTop: "6px", borderRadius: "10px", background: "#020617", color: "white", border: "1px solid #263044" }}
          />

          <label style={{ display: "block", marginTop: "16px", color: "#94a3b8" }}>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: "100%", padding: "12px", marginTop: "6px", borderRadius: "10px", background: "#020617", color: "white", border: "1px solid #263044" }}
          />

          <label style={{ display: "block", marginTop: "16px", color: "#94a3b8" }}>Generated code</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={18}
            style={{ width: "100%", padding: "12px", marginTop: "6px", borderRadius: "10px", background: "#020617", color: "#cbd5e1", border: "1px solid #263044", fontFamily: "monospace", fontSize: "12px" }}
          />

          <button
            onClick={createFile}
            disabled={loading}
            style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "10px", fontWeight: 800 }}
          >
            {loading ? "Creating..." : "Create Generated File"}
          </button>
        </div>

        <div style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Generated Files</h2>
            <button onClick={loadFiles} style={{ padding: "10px 12px", borderRadius: "10px" }}>
              Refresh
            </button>
          </div>

          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            {files.length === 0 && (
              <p style={{ color: "#94a3b8" }}>No generated files yet.</p>
            )}

            {files.map((file) => (
              <button
                key={file.file_name}
                onClick={() => openFile(file.file_name)}
                style={{
                  textAlign: "left",
                  padding: "14px",
                  borderRadius: "14px",
                  border: selectedFileName === file.file_name ? "1px solid #38bdf8" : "1px solid #263044",
                  background: "#0b1020",
                  color: "white",
                }}
              >
                <div style={{ fontWeight: 800 }}>{file.file_name}</div>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                  {file.size_bytes} bytes ? {file.updated_at}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px", marginTop: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800 }}>
            Selected File Preview {selectedFileName ? `? ${selectedFileName}` : ""}
          </h2>

          <button onClick={copySelected} disabled={!selectedContent} style={{ padding: "10px 12px", borderRadius: "10px" }}>
            Copy Code
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
            minHeight: "180px",
          }}
        >
          {selectedContent || "Select a generated file to preview it."}
        </pre>
      </section>
    </main>
  );
}

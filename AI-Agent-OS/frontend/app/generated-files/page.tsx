
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

type Stats = {
  count: number;
  total_size_bytes: number;
  latest_file: null | {
    file_name: string;
    updated_at: string;
    size_bytes: number;
  };
  folder: string;
};

export default function GeneratedFilesPage() {
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedContent, setSelectedContent] = useState("");
  const [routePath, setRoutePath] = useState("generated-health-dashboard");
  const [preview, setPreview] = useState<any>(null);
  const [approval, setApproval] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  async function loadData() {
    setMessage("");

    try {
      const [filesRes, statsRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/agent-file-writer/files`),
        fetch(`${API_BASE}/agent-file-writer/stats`),
        fetch(`${API_BASE}/generated-files/safe-install-history`),
      ]);

      const filesData = await filesRes.json();
      const statsData = await statsRes.json();
      const historyData = await historyRes.json();

      if (filesData.ok) setFiles(filesData.files || []);
      if (statsData.ok) setStats(statsData);
      if (historyData.ok) setHistory(historyData.history || []);
    } catch (error) {
      setMessage("Backend not running or routes not available.");
    }
  }

  async function openFile(name: string) {
    setSelectedFileName(name);
    setSelectedContent("");
    setPreview(null);
    setApproval("");
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/agent-file-writer/files/${encodeURIComponent(name)}`);
      const data = await res.json();

      if (data.ok) {
        setSelectedContent(data.content || "");
      } else {
        setMessage(data.message || "Failed to open file.");
      }
    } catch (error) {
      setMessage("Backend not running or route not available.");
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(selectedContent);
    setMessage("Code copied.");
  }

  async function deleteFile(name: string) {
    const ok = confirm(`Delete generated file: ${name}?`);
    if (!ok) return;

    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/agent-file-writer/files/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.ok) {
        setMessage(`Deleted: ${name}`);
        if (selectedFileName === name) {
          setSelectedFileName("");
          setSelectedContent("");
          setPreview(null);
          setApproval("");
        }
        await loadData();
      } else {
        setMessage(data.message || "Delete failed.");
      }
    } catch (error) {
      setMessage("Backend not running or route not available.");
    }
  }

  async function previewSafeInstall() {
    if (!selectedFileName) {
      setMessage("Select a generated file first.");
      return;
    }

    setMessage("");
    setPreview(null);
    setApproval("");

    try {
      const res = await fetch(`${API_BASE}/generated-files/safe-install-preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_name: selectedFileName,
          route_path: routePath,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setPreview(data);
        setMessage("Safe install preview ready.");
      } else {
        setMessage(data.message || "Preview failed.");
      }
    } catch (error) {
      setMessage("Backend not running or route not available.");
    }
  }

  async function approveInstall() {
    if (!preview) {
      setMessage("Create preview first.");
      return;
    }

    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/generated-files/safe-install-approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_name: selectedFileName,
          route_path: routePath,
          approval,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage(`Installed safely. Open: ${data.open_url}`);
        setApproval("");
        await loadData();
      } else {
        setMessage(data.message || "Install failed.");
      }
    } catch (error) {
      setMessage("Backend not running or route not available.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#050816", color: "white", padding: "32px" }}>
      <section style={{ border: "1px solid #263044", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}>
        <p style={{ color: "#38bdf8", fontWeight: 800, letterSpacing: "2px", fontSize: "12px" }}>
          GENERATED FILE LIBRARY + SAFE INSTALL
        </p>

        <h1 style={{ fontSize: "32px", fontWeight: 900, marginTop: "8px" }}>
          Install Agent-Created Files Safely
        </h1>

        <p style={{ color: "#94a3b8", marginTop: "8px" }}>
          Select a generated file, preview the diff, approve install, and create a real Next.js route.
        </p>
      </section>

      {message && (
        <section style={{ border: "1px solid #0e7490", borderRadius: "16px", padding: "16px", marginBottom: "24px", color: "#a5f3fc" }}>
          {message}
        </section>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <div style={{ border: "1px solid #263044", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Files</p>
          <h2 style={{ fontSize: "30px", fontWeight: 900 }}>{stats?.count ?? files.length}</h2>
        </div>

        <div style={{ border: "1px solid #263044", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Total Size</p>
          <h2 style={{ fontSize: "30px", fontWeight: 900 }}>{stats?.total_size_bytes ?? 0} bytes</h2>
        </div>

        <div style={{ border: "1px solid #263044", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Installs</p>
          <h2 style={{ fontSize: "30px", fontWeight: 900 }}>{history.length}</h2>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "24px" }}>
        <div style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Files</h2>
            <button onClick={loadData} style={{ padding: "10px 12px", borderRadius: "10px" }}>
              Refresh
            </button>
          </div>

          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            {files.length === 0 && <p style={{ color: "#94a3b8" }}>No generated files yet.</p>}

            {files.map((file) => (
              <div
                key={file.file_name}
                style={{
                  padding: "14px",
                  borderRadius: "14px",
                  border: selectedFileName === file.file_name ? "1px solid #38bdf8" : "1px solid #263044",
                  background: "#0b1020",
                }}
              >
                <button
                  onClick={() => openFile(file.file_name)}
                  style={{ background: "transparent", color: "white", border: "none", padding: 0, textAlign: "left", width: "100%" }}
                >
                  <div style={{ fontWeight: 800 }}>{file.file_name}</div>
                  <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                    {file.size_bytes} bytes ? {file.updated_at}
                  </div>
                </button>

                <button
                  onClick={() => deleteFile(file.file_name)}
                  style={{ marginTop: "10px", padding: "8px 10px", borderRadius: "8px", background: "#220b0b", color: "#fca5a5", border: "1px solid #7f1d1d" }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: "24px" }}>
          <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "22px", fontWeight: 800 }}>
                Preview {selectedFileName ? `? ${selectedFileName}` : ""}
              </h2>

              <button onClick={copyCode} disabled={!selectedContent} style={{ padding: "10px 12px", borderRadius: "10px" }}>
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
                minHeight: "220px",
              }}
            >
              {selectedContent || "Select a generated file to preview it."}
            </pre>
          </section>

          <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Safe Install Bridge</h2>

            <p style={{ color: "#94a3b8", marginTop: "8px" }}>
              This installs selected generated code into your frontend route after approval.
            </p>

            <label style={{ display: "block", marginTop: "16px", color: "#94a3b8" }}>Target route</label>
            <input
              value={routePath}
              onChange={(e) => setRoutePath(e.target.value)}
              style={{ width: "100%", padding: "12px", marginTop: "6px", borderRadius: "10px", background: "#020617", color: "white", border: "1px solid #263044" }}
            />

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "16px" }}>
              <button onClick={previewSafeInstall} disabled={!selectedFileName} style={{ padding: "12px 16px", borderRadius: "10px", fontWeight: 800 }}>
                Preview Safe Install
              </button>
            </div>

            {preview && (
              <div style={{ marginTop: "18px" }}>
                <p style={{ color: "#a5f3fc" }}>Target: {preview.target_path}</p>
                <p style={{ color: preview.target_exists ? "#facc15" : "#86efac", marginTop: "6px" }}>
                  {preview.target_exists ? "Target page already exists. Backup will be created." : "New target page will be created."}
                </p>

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
                    maxHeight: "320px",
                    overflow: "auto",
                  }}
                >
                  {(preview.diff || []).join("\n") || "No diff. New file or same content."}
                </pre>

                <label style={{ display: "block", marginTop: "16px", color: "#fca5a5", fontWeight: 800 }}>
                  Type APPROVE INSTALL
                </label>

                <input
                  value={approval}
                  onChange={(e) => setApproval(e.target.value)}
                  placeholder="APPROVE INSTALL"
                  style={{ width: "100%", padding: "12px", marginTop: "6px", borderRadius: "10px", background: "#020617", color: "white", border: "1px solid #7f1d1d" }}
                />

                <button
                  onClick={approveInstall}
                  disabled={approval !== "APPROVE INSTALL"}
                  style={{ marginTop: "14px", padding: "12px 16px", borderRadius: "10px", fontWeight: 900, background: "#7f1d1d", color: "white", border: "1px solid #ef4444" }}
                >
                  Approve Safe Install
                </button>
              </div>
            )}
          </section>

          <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Install History</h2>

            <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
              {history.length === 0 && <p style={{ color: "#94a3b8" }}>No installs yet.</p>}

              {history.slice(0, 5).map((item, index) => (
                <div key={index} style={{ border: "1px solid #263044", borderRadius: "14px", padding: "12px", background: "#0b1020" }}>
                  <div style={{ fontWeight: 800 }}>{item.route_path}</div>
                  <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                    {item.source_file} ? {item.installed_at}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

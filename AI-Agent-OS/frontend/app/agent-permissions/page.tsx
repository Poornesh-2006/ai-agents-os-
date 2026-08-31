
"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type Permission = {
  tool_id: string;
  tool_name: string;
  category: string;
  risk: string;
  status: string;
  description: string;
  protected: boolean;
  updated_at?: string;
  last_reason?: string;
};

export default function AgentPermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [selected, setSelected] = useState<Permission | null>(null);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("Updated from dashboard.");

  async function loadData() {
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/agent-tool-permissions`);
      const data = await res.json();

      if (data.ok) {
        setPermissions(data.permissions || []);
        setAudit(data.audit || []);
        setCounts(data.counts || {});
      } else {
        setMessage(data.message || "Failed to load permissions.");
      }
    } catch (error) {
      setMessage("Backend not running or permission routes not available.");
    }
  }

  async function updatePermission(toolId: string, status: string) {
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/agent-tool-permissions/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool_id: toolId,
          status,
          reason,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage(`Updated ${toolId} ? ${status}`);
        await loadData();
      } else {
        setMessage(data.message || "Update failed.");
      }
    } catch (error) {
      setMessage("Backend not running or route not available.");
    }
  }

  async function checkPermission(toolId: string) {
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/agent-tool-permissions/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool_id: toolId,
          agent_name: "Dashboard Tester",
          task: "Manual permission test from UI",
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage(`Decision for ${toolId}: ${data.decision}`);
        await loadData();
      } else {
        setMessage(data.message || "Check failed.");
      }
    } catch (error) {
      setMessage("Backend not running or route not available.");
    }
  }

  async function resetDefaults() {
    const ok = confirm("Reset permissions to safe defaults?");
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/agent-tool-permissions/reset`, {
        method: "POST",
      });

      const data = await res.json();

      if (data.ok) {
        setMessage("Permissions reset to safe defaults.");
        await loadData();
      } else {
        setMessage(data.message || "Reset failed.");
      }
    } catch (error) {
      setMessage("Backend not running or route not available.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function statusColor(status: string) {
    if (status === "allowed") return "#86efac";
    if (status === "approval_required") return "#facc15";
    return "#fca5a5";
  }

  function borderColor(status: string) {
    if (status === "allowed") return "#14532d";
    if (status === "approval_required") return "#854d0e";
    return "#7f1d1d";
  }

  const categories = Array.from(new Set(permissions.map((item) => item.category)));

  return (
    <main style={{ minHeight: "100vh", background: "#050816", color: "white", padding: "32px" }}>
      <section style={{ border: "1px solid #263044", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}>
        <p style={{ color: "#38bdf8", fontWeight: 800, letterSpacing: "2px", fontSize: "12px" }}>
          AGENT TOOL PERMISSIONS V1
        </p>

        <h1 style={{ fontSize: "32px", fontWeight: 900, marginTop: "8px" }}>
          Control What Agents Can Do
        </h1>

        <p style={{ color: "#94a3b8", marginTop: "8px" }}>
          Set tools as allowed, approval required, or blocked before giving agents more autonomy.
        </p>
      </section>

      {message && (
        <section style={{ border: "1px solid #0e7490", borderRadius: "16px", padding: "16px", marginBottom: "24px", color: "#a5f3fc" }}>
          {message}
        </section>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <div style={{ border: "1px solid #263044", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Total Tools</p>
          <h2 style={{ fontSize: "30px", fontWeight: 900 }}>{counts.total || permissions.length}</h2>
        </div>

        <div style={{ border: "1px solid #14532d", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Allowed</p>
          <h2 style={{ fontSize: "30px", fontWeight: 900, color: "#86efac" }}>{counts.allowed || 0}</h2>
        </div>

        <div style={{ border: "1px solid #854d0e", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Approval</p>
          <h2 style={{ fontSize: "30px", fontWeight: 900, color: "#facc15" }}>{counts.approval_required || 0}</h2>
        </div>

        <div style={{ border: "1px solid #7f1d1d", borderRadius: "18px", padding: "18px" }}>
          <p style={{ color: "#94a3b8" }}>Blocked</p>
          <h2 style={{ fontSize: "30px", fontWeight: 900, color: "#fca5a5" }}>{counts.blocked || 0}</h2>
        </div>
      </section>

      <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Permission Reason</h2>
            <p style={{ color: "#94a3b8", marginTop: "6px" }}>
              This reason is saved in audit log when you change permission.
            </p>
          </div>

          <button onClick={resetDefaults} style={{ padding: "10px 12px", borderRadius: "10px", background: "#220b0b", color: "#fca5a5", border: "1px solid #7f1d1d" }}>
            Reset Safe Defaults
          </button>
        </div>

        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ width: "100%", padding: "12px", marginTop: "14px", borderRadius: "10px", background: "#020617", color: "white", border: "1px solid #263044" }}
        />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "24px" }}>
        <div style={{ display: "grid", gap: "24px" }}>
          {categories.map((category) => (
            <section key={category} style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: 800 }}>{category}</h2>

              <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
                {permissions
                  .filter((item) => item.category === category)
                  .map((item) => (
                    <div
                      key={item.tool_id}
                      style={{
                        border: `1px solid ${borderColor(item.status)}`,
                        borderRadius: "16px",
                        padding: "16px",
                        background: "#0b1020",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                        <div>
                          <h3 style={{ fontSize: "18px", fontWeight: 900 }}>{item.tool_name}</h3>
                          <p style={{ color: "#94a3b8", marginTop: "6px" }}>{item.description}</p>
                          <p style={{ color: "#64748b", marginTop: "6px", fontSize: "12px" }}>
                            ID: {item.tool_id} ? Risk: {item.risk} {item.protected ? "? Protected" : ""}
                          </p>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: statusColor(item.status), fontWeight: 900 }}>
                            {item.status.replace("_", " ").toUpperCase()}
                          </div>

                          <button onClick={() => setSelected(item)} style={{ marginTop: "8px", padding: "8px 10px", borderRadius: "8px" }}>
                            Details
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
                        <button onClick={() => updatePermission(item.tool_id, "allowed")} style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #14532d", color: "#86efac", background: "#052e16" }}>
                          Allow
                        </button>

                        <button onClick={() => updatePermission(item.tool_id, "approval_required")} style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #854d0e", color: "#facc15", background: "#1c1917" }}>
                          Need Approval
                        </button>

                        <button onClick={() => updatePermission(item.tool_id, "blocked")} style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #7f1d1d", color: "#fca5a5", background: "#220b0b" }}>
                          Block
                        </button>

                        <button onClick={() => checkPermission(item.tool_id)} style={{ padding: "8px 10px", borderRadius: "8px" }}>
                          Test Check
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>

        <aside style={{ display: "grid", gap: "24px", alignContent: "start" }}>
          <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Selected Tool</h2>

            {!selected && <p style={{ color: "#94a3b8", marginTop: "12px" }}>Select a tool to view details.</p>}

            {selected && (
              <div style={{ marginTop: "12px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: 900 }}>{selected.tool_name}</h3>
                <p style={{ color: "#94a3b8", marginTop: "8px" }}>{selected.description}</p>
                <p style={{ color: statusColor(selected.status), marginTop: "8px", fontWeight: 900 }}>
                  {selected.status.replace("_", " ").toUpperCase()}
                </p>
                <p style={{ color: "#64748b", marginTop: "8px", fontSize: "12px" }}>
                  Category: {selected.category}
                  <br />
                  Risk: {selected.risk}
                  <br />
                  Protected: {selected.protected ? "Yes" : "No"}
                </p>
              </div>
            )}
          </section>

          <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Audit Log</h2>

            <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
              {audit.length === 0 && <p style={{ color: "#94a3b8" }}>No audit yet.</p>}

              {audit.slice(0, 10).map((item, index) => (
                <div key={index} style={{ border: "1px solid #263044", borderRadius: "12px", padding: "12px", background: "#0b1020" }}>
                  <div style={{ fontWeight: 800 }}>{item.action}</div>
                  <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                    {item.created_at}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

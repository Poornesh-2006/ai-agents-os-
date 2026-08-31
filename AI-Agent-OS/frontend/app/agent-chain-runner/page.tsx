
"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function AgentChainRunnerPage() {
  const [featureName, setFeatureName] = useState("One Click Feature Builder");
  const [task, setTask] = useState("Build a safe generated dashboard feature from one click.");
  const [priority, setPriority] = useState("High");
  const [style, setStyle] = useState("Dark AI dashboard");
  const [frontendRoute, setFrontendRoute] = useState("one-click-feature");
  const [backendRoute, setBackendRoute] = useState("one-click-feature-api");
  const [runQa, setRunQa] = useState(false);

  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [latestFrontendFile, setLatestFrontendFile] = useState("");

  const [installPreview, setInstallPreview] = useState<any>(null);
  const [approvalText, setApprovalText] = useState("");
  const [installQaResult, setInstallQaResult] = useState<any>(null);
  const [installQaRunning, setInstallQaRunning] = useState(false);

  const [rollbackText, setRollbackText] = useState("");
  const [rollbackResult, setRollbackResult] = useState<any>(null);
  const [rollbackRunning, setRollbackRunning] = useState(false);

  const [registrySyncResult, setRegistrySyncResult] = useState<any>(null);
  const [registrySyncRunning, setRegistrySyncRunning] = useState(false);

  const [projectBrainSyncResult, setProjectBrainSyncResult] = useState<any>(null);
  const [projectBrainSyncRunning, setProjectBrainSyncRunning] = useState(false);

  const [handoffResult, setHandoffResult] = useState<any>(null);
  const [handoffRunning, setHandoffRunning] = useState(false);

  const [completeFlowApproval, setCompleteFlowApproval] = useState("");
  const [completeFlowRunning, setCompleteFlowRunning] = useState(false);
  const [completeFlowResult, setCompleteFlowResult] = useState<any>(null);

  const [safeFlowApproval, setSafeFlowApproval] = useState("");
  const [safeFlowRunning, setSafeFlowRunning] = useState(false);
  const [safeFlowResult, setSafeFlowResult] = useState<any>(null);

  const [liveTimeline, setLiveTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineGeneratedAt, setTimelineGeneratedAt] = useState("");

  const [runLockStatus, setRunLockStatus] = useState<any>(null);
  const [lockedFlowApproval, setLockedFlowApproval] = useState("");
  const [lockedFlowRunning, setLockedFlowRunning] = useState(false);
  const [lockedFlowResult, setLockedFlowResult] = useState<any>(null);
  const [clearLockText, setClearLockText] = useState("");

  const [approvalItems, setApprovalItems] = useState<any[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalActionType, setApprovalActionType] = useState("safe_install");
  const [approvalNote, setApprovalNote] = useState("Review this action before executing.");
  const [approvalInputById, setApprovalInputById] = useState<Record<string, string>>({});

  const [runReportResult, setRunReportResult] = useState<any>(null);
  const [runReportRunning, setRunReportRunning] = useState(false);
  const [runReportHistory, setRunReportHistory] = useState<any[]>([]);

  function findFrontendFile(run: any) {
    if (!run || !run.steps) return "";
    const found = run.steps.find((step: any) => String(step.file || "").endsWith(".tsx"));
    return found?.file || "";
  }

  async function loadHistory() {
    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/history`);
      const data = await res.json();
      if (data.ok) setHistory(data.history || []);
    } catch {
      setMessage("Backend not running or history route not available.");
    }
  }

  async function loadLatestRun() {
    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/latest`);
      const data = await res.json();
      if (data.ok) {
        setLatestFrontendFile(data.frontend_file || "");
        if (data.latest_run) setSelectedRun(data.latest_run);
      }
    } catch {}
  }

  async function loadLiveTimeline() {
    setTimelineLoading(true);
    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/live-timeline`);
      const data = await res.json();
      if (data.ok) {
        setLiveTimeline(data.events || []);
        setTimelineGeneratedAt(data.generated_at || "");
      }
    } catch {} 
    finally {
      setTimelineLoading(false);
    }
  }



  async function loadRunReportHistory() {
    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/run-report/history`);
      const data = await res.json();

      if (data.ok) {
        setRunReportHistory(data.history || []);
      }
    } catch {
      // keep quiet
    }
  }

  async function generateRunReport() {
    setRunReportRunning(true);
    setMessage("");
    setRunReportResult(null);

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/run-report/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_name: featureName,
          target_route: frontendRoute,
          backend_route: backendRoute,
          note: "Generated from Agent Chain Runner UI"
        })
      });

      const data = await res.json();

      if (data.ok) {
        setRunReportResult(data);
        setMessage(data.message || "Run report generated.");
        await loadRunReportHistory();
      } else {
        setMessage(data.message || "Run report generation failed.");
      }
    } catch {
      setMessage("Backend not running or run report route not available.");
    } finally {
      setRunReportRunning(false);
    }
  }

  async function copyRunReport() {
    if (!runReportResult?.report_text) {
      setMessage("No report text to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(runReportResult.report_text);
      setMessage("Run report copied.");
    } catch {
      setMessage("Copy failed. Select the report manually.");
    }
  }

  function downloadRunReport() {
    if (!runReportResult?.report_text) {
      setMessage("No report text to download.");
      return;
    }

    const blob = new Blob([runReportResult.report_text], { type: "text/markdown" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = runReportResult.report?.file_name || "agent_chain_run_report.md";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  }

  async function loadApprovalCenter() {
    setApprovalLoading(true);

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/approval-center`);
      const data = await res.json();

      if (data.ok) {
        setApprovalItems(data.items || []);
      }
    } catch {
      // keep quiet
    } finally {
      setApprovalLoading(false);
    }
  }

  async function createApprovalRequest() {
    setMessage("");

    try {
      const fileName = latestFrontendFile || findFrontendFile(selectedRun);

      const res = await fetch(`${API_BASE}/agent-chain-runner/approval-center/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: approvalActionType,
          feature_name: featureName,
          target_route: frontendRoute,
          backend_route: backendRoute,
          file_name: fileName,
          task,
          priority,
          style,
          note: approvalNote
        })
      });

      const data = await res.json();

      if (data.ok) {
        setMessage("Approval request created.");
        await loadApprovalCenter();
      } else {
        setMessage(data.message || "Could not create approval request.");
      }
    } catch {
      setMessage("Backend not running or Approval Center create route not available.");
    }
  }

  async function approveApprovalItem(item: any) {
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/approval-center/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: item.id,
          approval_text: approvalInputById[item.id] || "",
          execute: true
        })
      });

      const data = await res.json();

      if (data.ok) {
        setMessage(data.message || "Approval executed.");
      } else {
        setMessage(data.message || "Approval failed.");
      }

      await loadApprovalCenter();
      await loadLiveTimeline();
      await loadRunLockStatus();
    } catch {
      setMessage("Backend not running or Approval Center approve route not available.");
    }
  }

  async function rejectApprovalItem(item: any) {
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/approval-center/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: item.id,
          reason: "Rejected from Agent Chain Runner UI"
        })
      });

      const data = await res.json();

      if (data.ok) {
        setMessage(data.message || "Approval rejected.");
      } else {
        setMessage(data.message || "Reject failed.");
      }

      await loadApprovalCenter();
    } catch {
      setMessage("Backend not running or Approval Center reject route not available.");
    }
  }

  async function loadRunLockStatus() {
    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/run-lock-status`);
      const data = await res.json();
      if (data.ok) setRunLockStatus(data);
    } catch {}
  }

  async function runChain() {
    setRunning(true);
    setMessage("");
    setSelectedRun(null);

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_name: featureName,
          task,
          priority,
          style,
          frontend_route: frontendRoute,
          backend_route: backendRoute,
          run_qa: runQa
        })
      });

      const data = await res.json();

      if (data.ok) {
        setSelectedRun(data.run);
        setLatestFrontendFile(findFrontendFile(data.run));
        setMessage(data.message || "Agent chain completed.");
        await loadHistory();
        await loadLiveTimeline();
      } else {
        setMessage(data.message || "Agent chain failed.");
      }
    } catch {
      setMessage("Backend not running or chain route not available.");
    } finally {
      setRunning(false);
    }
  }

  async function previewSafeInstall() {
    setMessage("");
    setInstallPreview(null);
    const fileName = latestFrontendFile || findFrontendFile(selectedRun);

    if (!fileName) {
      setMessage("No generated frontend .tsx file found.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/safe-install-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: fileName, target_route: frontendRoute })
      });

      const data = await res.json();
      if (data.ok) {
        setInstallPreview(data);
        setMessage("Safe install preview created.");
      } else {
        setMessage(data.message || "Preview failed.");
      }
    } catch {
      setMessage("Backend not running or safe install preview route not available.");
    }
  }

  async function approveSafeInstall() {
    setMessage("");

    if (!installPreview) {
      setMessage("Create preview first.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/safe-install-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: installPreview.source_file,
          target_route: installPreview.target_route,
          approval_text: approvalText
        })
      });

      const data = await res.json();
      setMessage(data.message || (data.ok ? "Installed safely." : "Install failed."));
      await loadLiveTimeline();
    } catch {
      setMessage("Backend not running or approve route not available.");
    }
  }

  async function runQaAfterInstall() {
    setInstallQaRunning(true);
    setMessage("");
    setInstallQaResult(null);

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/qa-after-install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_route: frontendRoute, note: "QA after Agent Chain install" })
      });

      const data = await res.json();
      if (data.ok) {
        setInstallQaResult(data.result);
        setMessage(data.message || "QA finished.");
      } else {
        setMessage(data.message || "QA failed.");
      }
      await loadLiveTimeline();
    } catch {
      setMessage("Backend not running or QA route not available.");
    } finally {
      setInstallQaRunning(false);
    }
  }

  async function rollbackLastInstall() {
    setRollbackRunning(true);
    setMessage("");
    setRollbackResult(null);

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/rollback-last-install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_route: frontendRoute,
          approval_text: rollbackText,
          reason: "Rollback from Agent Chain Runner UI"
        })
      });

      const data = await res.json();
      if (data.ok) {
        setRollbackResult(data.rollback);
        setRollbackText("");
      }
      setMessage(data.message || "Rollback finished.");
      await loadLiveTimeline();
    } catch {
      setMessage("Backend not running or rollback route not available.");
    } finally {
      setRollbackRunning(false);
    }
  }

  async function syncFeatureRegistry() {
    setRegistrySyncRunning(true);
    setMessage("");
    setRegistrySyncResult(null);

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/sync-feature-registry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_name: featureName,
          target_route: frontendRoute,
          backend_route: backendRoute,
          priority,
          status: selectedRun?.status || "built",
          note: "Updated from Agent Chain Runner UI"
        })
      });

      const data = await res.json();
      if (data.ok) setRegistrySyncResult(data.feature);
      setMessage(data.message || "Feature Registry sync finished.");
      await loadLiveTimeline();
    } catch {
      setMessage("Backend not running or registry sync route not available.");
    } finally {
      setRegistrySyncRunning(false);
    }
  }

  async function syncProjectBrain() {
    setProjectBrainSyncRunning(true);
    setMessage("");
    setProjectBrainSyncResult(null);

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/sync-project-brain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_name: featureName,
          target_route: frontendRoute,
          backend_route: backendRoute,
          priority,
          note: "Updated from Agent Chain Runner UI"
        })
      });

      const data = await res.json();
      if (data.ok) setProjectBrainSyncResult(data.sync);
      setMessage(data.message || "Project Brain sync finished.");
      await loadLiveTimeline();
    } catch {
      setMessage("Backend not running or Project Brain sync route not available.");
    } finally {
      setProjectBrainSyncRunning(false);
    }
  }

  async function exportNewChatHandoff() {
    setHandoffRunning(true);
    setMessage("");
    setHandoffResult(null);

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/export-handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_name: featureName,
          target_route: frontendRoute,
          backend_route: backendRoute,
          next_task: "Continue building the next AI Agent OS feature step by step.",
          note: "Exported from Agent Chain Runner UI"
        })
      });

      const data = await res.json();
      if (data.ok) setHandoffResult(data);
      setMessage(data.message || "Handoff export finished.");
      await loadLiveTimeline();
    } catch {
      setMessage("Backend not running or handoff export route not available.");
    } finally {
      setHandoffRunning(false);
    }
  }

  async function copyHandoffToClipboard() {
    if (!handoffResult?.handoff) {
      setMessage("No handoff text to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(handoffResult.handoff);
      setMessage("Handoff copied.");
    } catch {
      setMessage("Copy failed. Select the text manually.");
    }
  }

  async function runOneClickCompleteFlow() {
    setCompleteFlowRunning(true);
    setMessage("");
    setCompleteFlowResult(null);

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/complete-flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_name: featureName,
          task,
          priority,
          style,
          frontend_route: frontendRoute,
          backend_route: backendRoute,
          approval_text: completeFlowApproval,
          run_chain_qa: false,
          note: "Started from Agent Chain Runner UI"
        })
      });

      const data = await res.json();
      setCompleteFlowResult(data.flow || data);
      setMessage(data.message || "Complete flow finished.");
      await loadHistory();
      await loadLiveTimeline();
    } catch {
      setMessage("Backend not running or complete flow route not available.");
    } finally {
      setCompleteFlowRunning(false);
    }
  }

  async function runSafeCompleteFlow() {
    setSafeFlowRunning(true);
    setMessage("");
    setSafeFlowResult(null);

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/complete-flow-safe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_name: featureName,
          task,
          priority,
          style,
          frontend_route: frontendRoute,
          backend_route: backendRoute,
          approval_text: safeFlowApproval,
          run_chain_qa: false,
          auto_rollback_on_qa_fail: true,
          note: "Started from Agent Chain Runner UI"
        })
      });

      const data = await res.json();
      setSafeFlowResult(data.flow || data);
      setMessage(data.message || "Safe flow finished.");
      await loadHistory();
      await loadLiveTimeline();
    } catch {
      setMessage("Backend not running or safe flow route not available.");
    } finally {
      setSafeFlowRunning(false);
    }
  }

  async function runLockedSafeFlow() {
    setLockedFlowRunning(true);
    setMessage("");
    setLockedFlowResult(null);

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/complete-flow-safe-locked`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_name: featureName,
          task,
          priority,
          style,
          frontend_route: frontendRoute,
          backend_route: backendRoute,
          approval_text: lockedFlowApproval,
          run_chain_qa: false,
          auto_rollback_on_qa_fail: true,
          note: "Started from locked safe flow UI"
        })
      });

      const data = await res.json();
      setLockedFlowResult(data);
      setMessage(data.message || "Locked safe flow finished.");
      await loadRunLockStatus();
      await loadLiveTimeline();
    } catch {
      setMessage("Backend not running or locked safe flow route not available.");
    } finally {
      setLockedFlowRunning(false);
    }
  }

  async function clearRunLock() {
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/agent-chain-runner/clear-run-lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_text: clearLockText, reason: "Cleared from UI" })
      });

      const data = await res.json();
      setMessage(data.message || "Clear lock finished.");
      if (data.ok) setClearLockText("");
      await loadRunLockStatus();
    } catch {
      setMessage("Backend not running or clear lock route not available.");
    }
  }

  useEffect(() => {
    loadHistory();
    loadLatestRun();
    loadLiveTimeline();
    loadRunLockStatus();
    loadApprovalCenter();
    loadRunReportHistory();

    const timer = window.setInterval(() => {
      loadLiveTimeline();
      loadRunLockStatus();
      loadApprovalCenter();
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <p style={eyebrowStyle}>AGENT CHAIN RUNNER</p>
        <h1 style={titleStyle}>One Click AI Software Factory</h1>
        <p style={mutedTextStyle}>
          Run agents, install safely, QA, rollback, sync memory, export handoff, and prevent duplicate runs.
        </p>
      </section>

      {message && <section style={messageStyle}>{message}</section>}



      <section style={reportPanelStyle}>
        <div style={rowStyle}>
          <div>
            <p style={eyebrowStyle}>RUN REPORT</p>
            <h2 style={sectionTitleStyle}>Download Run Report</h2>
            <p style={smallMutedStyle}>
              Generate a clean Markdown report for the latest chain/safe-flow state.
            </p>
          </div>

          <button onClick={generateRunReport} disabled={runReportRunning} style={smallButtonStyle}>
            {runReportRunning ? "Generating..." : "Generate Report"}
          </button>
        </div>

        {runReportResult && (
          <div style={innerPanelStyle}>
            <p style={successTextStyle}>Report Created</p>
            <p style={smallMutedStyle}>File: {runReportResult.report?.file_name}</p>

            <div style={reportButtonRowStyle}>
              <button onClick={copyRunReport} style={smallButtonStyle}>
                Copy Report
              </button>

              <button onClick={downloadRunReport} style={smallButtonStyle}>
                Download .md
              </button>
            </div>

            <textarea
              value={runReportResult.report_text || ""}
              readOnly
              rows={10}
              style={textAreaStyle}
            />
          </div>
        )}

        {runReportHistory.length > 0 && (
          <div style={innerPanelStyle}>
            <p style={successTextStyle}>Recent Reports</p>

            {runReportHistory.slice(0, 5).map((report, index) => (
              <p key={index} style={smallMutedStyle}>
                {report.file_name} ? {report.created_at}
              </p>
            ))}
          </div>
        )}
      </section>

      <section style={approvalPanelStyle}>
        <div style={rowStyle}>
          <div>
            <p style={eyebrowStyle}>APPROVAL CENTER</p>
            <h2 style={sectionTitleStyle}>Dangerous Action Queue</h2>
            <p style={smallMutedStyle}>
              Create, approve, execute, or reject risky actions from one place.
            </p>
          </div>

          <button onClick={loadApprovalCenter} style={smallButtonStyle}>
            {approvalLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div style={innerPanelStyle}>
          <label style={labelStyle}>Action type</label>
          <select
            value={approvalActionType}
            onChange={(event) => setApprovalActionType(event.target.value)}
            style={inputStyle}
          >
            <option value="safe_install">Safe Install</option>
            <option value="rollback">Rollback Last Install</option>
            <option value="clear_run_lock">Clear Run Lock</option>
            <option value="locked_safe_flow">Locked Safe Full Flow</option>
          </select>

          <label style={labelStyle}>Approval note</label>
          <input
            value={approvalNote}
            onChange={(event) => setApprovalNote(event.target.value)}
            style={inputStyle}
          />

          <button onClick={createApprovalRequest} style={goldButtonStyle}>
            Create Approval Request
          </button>
        </div>

        <div style={approvalQueueStyle}>
          {approvalItems.length === 0 && (
            <p style={mutedTextStyle}>No approval items yet.</p>
          )}

          {approvalItems.slice(0, 10).map((item) => (
            <div key={item.id} style={approvalItemStyle}>
              <div style={rowStyle}>
                <div>
                  <strong>{item.label}</strong>
                  <p style={smallMutedStyle}>
                    {item.status} ? /{item.target_route} ? {item.created_at}
                  </p>
                  <p style={smallMutedStyle}>
                    Required: {item.required_phrase}
                  </p>
                </div>

                <span style={badgeStyle}>{item.status}</span>
              </div>

              {item.status === "pending" && (
                <>
                  <label style={labelStyle}>Approval text</label>
                  <input
                    value={approvalInputById[item.id] || ""}
                    onChange={(event) =>
                      setApprovalInputById({
                        ...approvalInputById,
                        [item.id]: event.target.value
                      })
                    }
                    style={inputStyle}
                  />

                  <div style={approvalButtonRowStyle}>
                    <button
                      onClick={() => approveApprovalItem(item)}
                      style={successButtonStyle}
                    >
                      Approve + Execute
                    </button>

                    <button
                      onClick={() => rejectApprovalItem(item)}
                      style={dangerButtonStyle}
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}

              {item.execution_result && (
                <p style={item.execution_result.ok ? successTextStyle : dangerTextStyle}>
                  Execution: {item.execution_result.message || String(item.execution_result.ok)}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={safeCardStyle}>
        <h2 style={sectionTitleStyle}>Run Lock / Safest Flow</h2>
        <p style={mutedTextStyle}>
          Lock status: {runLockStatus?.locked ? "LOCKED - flow running" : "UNLOCKED - ready"}
        </p>

        {runLockStatus?.locked && (
          <div style={innerPanelStyle}>
            <p style={dangerTextStyle}>A flow is already running.</p>
            <p style={smallMutedStyle}>Feature: {runLockStatus.lock?.feature_name}</p>
            <p style={smallMutedStyle}>Started: {runLockStatus.lock?.started_at}</p>
            <label style={labelStyle}>Type CLEAR RUN LOCK only if stuck</label>
            <input value={clearLockText} onChange={(e) => setClearLockText(e.target.value)} style={inputStyle} />
            <button onClick={clearRunLock} style={dangerButtonStyle}>Clear Run Lock</button>
          </div>
        )}

        <label style={labelStyle}>Type APPROVE SAFE FULL FLOW</label>
        <input value={lockedFlowApproval} onChange={(e) => setLockedFlowApproval(e.target.value)} style={inputStyle} />

        <button
          onClick={runLockedSafeFlow}
          disabled={lockedFlowRunning || runLockStatus?.locked}
          style={successButtonStyle}
        >
          {lockedFlowRunning ? "Running Locked Safe Flow..." : "Run Locked Safe Flow"}
        </button>

        {lockedFlowResult && (
          <div style={innerPanelStyle}>
            <p style={lockedFlowResult.ok ? successTextStyle : dangerTextStyle}>
              Result: {lockedFlowResult.ok ? "OK" : "FAILED"}
            </p>
            <p style={smallMutedStyle}>{lockedFlowResult.message}</p>
          </div>
        )}
      </section>

      <section style={timelinePanelStyle}>
        <div style={rowStyle}>
          <div>
            <p style={eyebrowStyle}>LIVE PROGRESS</p>
            <h2 style={sectionTitleStyle}>Agent Chain Timeline</h2>
            <p style={smallMutedStyle}>Last refresh: {timelineGeneratedAt || "not loaded"}</p>
          </div>
          <button onClick={loadLiveTimeline} style={smallButtonStyle}>
            {timelineLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={timelineListStyle}>
          {liveTimeline.length === 0 && <p style={mutedTextStyle}>No timeline events yet.</p>}
          {liveTimeline.slice(0, 12).map((event, index) => (
            <div key={index} style={timelineItemStyle}>
              <div style={dotStyle} />
              <div style={{ flex: 1 }}>
                <div style={rowStyle}>
                  <strong>{event.title}</strong>
                  <span style={badgeStyle}>{event.status}</span>
                </div>
                <p style={smallMutedStyle}>{event.created_at} ? {event.source}</p>
                {event.message && <p style={timelineMessageStyle}>{event.message}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={gridStyle}>
        <div style={leftColumnStyle}>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Feature Input</h2>

            <label style={labelStyle}>Feature name</label>
            <input value={featureName} onChange={(e) => setFeatureName(e.target.value)} style={inputStyle} />

            <label style={labelStyle}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={inputStyle}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>

            <label style={labelStyle}>UI style</label>
            <input value={style} onChange={(e) => setStyle(e.target.value)} style={inputStyle} />

            <label style={labelStyle}>Frontend route</label>
            <input value={frontendRoute} onChange={(e) => setFrontendRoute(e.target.value)} style={inputStyle} />

            <label style={labelStyle}>Backend route</label>
            <input value={backendRoute} onChange={(e) => setBackendRoute(e.target.value)} style={inputStyle} />

            <label style={labelStyle}>Task</label>
            <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={5} style={inputStyle} />

            <label style={checkboxLabelStyle}>
              <input type="checkbox" checked={runQa} onChange={(e) => setRunQa(e.target.checked)} />
              Run QA during chain
            </label>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Manual Chain</h2>
            <button onClick={runChain} disabled={running} style={primaryButtonStyle}>
              {running ? "Running..." : "Run Full Agent Chain"}
            </button>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Safe Install + QA</h2>
            <p style={mutedTextStyle}>Generated file: {latestFrontendFile || findFrontendFile(selectedRun) || "none"}</p>
            <button onClick={previewSafeInstall} style={primaryButtonStyle}>Preview Safe Install</button>

            {installPreview && (
              <div style={innerPanelStyle}>
                <p style={successTextStyle}>Preview Ready</p>
                <p style={smallMutedStyle}>Target: {installPreview.target_path}</p>
                <p style={smallMutedStyle}>Old lines: {installPreview.preview?.old_line_count} ? New lines: {installPreview.preview?.new_line_count}</p>

                <label style={labelStyle}>Type APPROVE CHAIN INSTALL</label>
                <input value={approvalText} onChange={(e) => setApprovalText(e.target.value)} style={inputStyle} />

                <button onClick={approveSafeInstall} style={successButtonStyle}>Approve Install</button>
                <button onClick={runQaAfterInstall} disabled={installQaRunning} style={purpleButtonStyle}>
                  {installQaRunning ? "Running QA..." : "Run QA After Install"}
                </button>

                {installQaResult && (
                  <div style={innerPanelStyle}>
                    <p style={installQaResult.passed ? successTextStyle : dangerTextStyle}>
                      QA: {installQaResult.status}
                    </p>
                  </div>
                )}

                <label style={labelStyle}>Type ROLLBACK CHAIN INSTALL</label>
                <input value={rollbackText} onChange={(e) => setRollbackText(e.target.value)} style={inputStyle} />
                <button onClick={rollbackLastInstall} disabled={rollbackRunning} style={dangerButtonStyle}>
                  {rollbackRunning ? "Rolling back..." : "Rollback Last Install"}
                </button>

                {rollbackResult && <p style={successTextStyle}>Rollback completed.</p>}
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Sync + Handoff</h2>
            <button onClick={syncFeatureRegistry} disabled={registrySyncRunning} style={cyanButtonStyle}>
              {registrySyncRunning ? "Syncing..." : "Update Feature Registry"}
            </button>
            {registrySyncResult && <p style={successTextStyle}>Registry: {registrySyncResult.status}</p>}

            <button onClick={syncProjectBrain} disabled={projectBrainSyncRunning} style={indigoButtonStyle}>
              {projectBrainSyncRunning ? "Syncing..." : "Update Project Brain"}
            </button>
            {projectBrainSyncResult && <p style={successTextStyle}>Project Brain updated.</p>}

            <button onClick={exportNewChatHandoff} disabled={handoffRunning} style={goldButtonStyle}>
              {handoffRunning ? "Exporting..." : "Export New Chat Handoff"}
            </button>

            {handoffResult && (
              <div style={innerPanelStyle}>
                <p style={successTextStyle}>Handoff Exported</p>
                <p style={smallMutedStyle}>{handoffResult.handoff_file}</p>
                <button onClick={copyHandoffToClipboard} style={smallButtonStyle}>Copy Handoff Text</button>
                <textarea value={handoffResult.handoff || ""} readOnly rows={8} style={textAreaStyle} />
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>One Click Complete Flow</h2>
            <label style={labelStyle}>Type APPROVE FULL CHAIN FLOW</label>
            <input value={completeFlowApproval} onChange={(e) => setCompleteFlowApproval(e.target.value)} style={inputStyle} />
            <button onClick={runOneClickCompleteFlow} disabled={completeFlowRunning} style={goldButtonStyle}>
              {completeFlowRunning ? "Running..." : "Run One Click Complete Flow"}
            </button>
            {completeFlowResult && <p style={mutedTextStyle}>Status: {completeFlowResult.status || completeFlowResult.message}</p>}
          </section>

          <section style={safeCardStyle}>
            <h2 style={sectionTitleStyle}>Safe Complete Flow v2</h2>
            <label style={labelStyle}>Type APPROVE SAFE FULL FLOW</label>
            <input value={safeFlowApproval} onChange={(e) => setSafeFlowApproval(e.target.value)} style={inputStyle} />
            <button onClick={runSafeCompleteFlow} disabled={safeFlowRunning} style={successButtonStyle}>
              {safeFlowRunning ? "Running..." : "Run Safe Complete Flow v2"}
            </button>
            {safeFlowResult && <p style={mutedTextStyle}>Status: {safeFlowResult.status || safeFlowResult.message}</p>}
          </section>
        </div>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Run Details</h2>

          {!selectedRun && <p style={mutedTextStyle}>Run the chain or select history.</p>}

          {selectedRun && (
            <div style={innerPanelStyle}>
              <h3 style={detailTitleStyle}>{selectedRun.feature_name}</h3>
              <p style={mutedTextStyle}>{selectedRun.task}</p>
              <p style={successTextStyle}>{selectedRun.status}</p>

              <div style={stepsListStyle}>
                {(selectedRun.steps || []).map((step: any, index: number) => (
                  <div key={index} style={stepCardStyle}>
                    <strong>{step.agent || step.step}</strong>
                    <p style={smallMutedStyle}>Status: {step.status || String(step.ok)}</p>
                    <p style={smallMutedStyle}>{step.file || step.message || ""}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 style={{ ...sectionTitleStyle, marginTop: "24px" }}>History</h2>

          <button onClick={loadHistory} style={smallButtonStyle}>Refresh History</button>

          <div style={historyListStyle}>
            {history.length === 0 && <p style={mutedTextStyle}>No chain runs yet.</p>}
            {history.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedRun(item);
                  setLatestFrontendFile(findFrontendFile(item));
                }}
                style={historyItemStyle}
              >
                <div style={{ fontWeight: 900 }}>{item.feature_name}</div>
                <div style={smallMutedStyle}>{item.status} ? {item.created_at}</div>
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = { minHeight: "100vh", background: "#050816", color: "white", padding: "32px" };
const heroStyle: CSSProperties = { border: "1px solid #263044", borderRadius: "24px", padding: "24px", marginBottom: "24px" };
const eyebrowStyle: CSSProperties = { color: "#38bdf8", fontWeight: 800, letterSpacing: "2px", fontSize: "12px" };
const titleStyle: CSSProperties = { fontSize: "32px", fontWeight: 900, marginTop: "8px" };
const mutedTextStyle: CSSProperties = { color: "#94a3b8", marginTop: "8px" };
const smallMutedStyle: CSSProperties = { color: "#94a3b8", fontSize: "12px", marginTop: "6px" };
const messageStyle: CSSProperties = { border: "1px solid #0e7490", borderRadius: "16px", padding: "16px", marginBottom: "24px", color: "#a5f3fc" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "420px 1fr", gap: "24px" };
const leftColumnStyle: CSSProperties = { display: "grid", gap: "24px", alignContent: "start" };
const cardStyle: CSSProperties = { border: "1px solid #263044", borderRadius: "20px", padding: "20px", background: "#07111f" };
const safeCardStyle: CSSProperties = { border: "1px solid #22c55e", borderRadius: "20px", padding: "20px", marginBottom: "24px", background: "#03120a" };
const sectionTitleStyle: CSSProperties = { fontSize: "22px", fontWeight: 800 };
const labelStyle: CSSProperties = { display: "block", marginTop: "14px", color: "#94a3b8" };
const inputStyle: CSSProperties = { width: "100%", padding: "12px", marginTop: "6px", borderRadius: "10px", background: "#020617", color: "white", border: "1px solid #263044" };
const textAreaStyle: CSSProperties = { ...inputStyle, minHeight: "180px", fontSize: "12px" };
const checkboxLabelStyle: CSSProperties = { display: "flex", gap: "10px", alignItems: "center", marginTop: "16px", color: "#cbd5e1" };
const innerPanelStyle: CSSProperties = { marginTop: "16px", border: "1px solid #263044", borderRadius: "14px", padding: "14px", background: "#020617" };
const successTextStyle: CSSProperties = { color: "#86efac", fontWeight: 900, marginTop: "8px" };
const dangerTextStyle: CSSProperties = { color: "#fca5a5", fontWeight: 900, marginTop: "8px" };
const primaryButtonStyle: CSSProperties = { marginTop: "14px", padding: "14px 18px", borderRadius: "12px", fontWeight: 900, background: "#1e3a8a", color: "white", border: "1px solid #60a5fa", width: "100%" };
const successButtonStyle: CSSProperties = { ...primaryButtonStyle, background: "#14532d", border: "1px solid #86efac" };
const dangerButtonStyle: CSSProperties = { ...primaryButtonStyle, background: "#7f1d1d", border: "1px solid #fca5a5" };
const purpleButtonStyle: CSSProperties = { ...primaryButtonStyle, background: "#581c87", border: "1px solid #c084fc" };
const cyanButtonStyle: CSSProperties = { ...primaryButtonStyle, background: "#164e63", border: "1px solid #67e8f9" };
const indigoButtonStyle: CSSProperties = { ...primaryButtonStyle, background: "#312e81", border: "1px solid #a5b4fc" };
const goldButtonStyle: CSSProperties = { ...primaryButtonStyle, background: "#713f12", border: "1px solid #facc15" };
const smallButtonStyle: CSSProperties = { padding: "10px 12px", borderRadius: "10px", background: "#0f172a", color: "white", border: "1px solid #64748b" };
const timelinePanelStyle: CSSProperties = { border: "1px solid #263044", borderRadius: "20px", padding: "20px", marginBottom: "24px", background: "#07111f" };
const rowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" };
const timelineListStyle: CSSProperties = { display: "grid", gap: "12px", marginTop: "16px" };
const timelineItemStyle: CSSProperties = { display: "flex", gap: "12px", alignItems: "flex-start", border: "1px solid #263044", borderRadius: "14px", padding: "12px", background: "#020617" };
const dotStyle: CSSProperties = { width: "10px", height: "10px", borderRadius: "999px", background: "#38bdf8", marginTop: "5px", flexShrink: 0 };
const badgeStyle: CSSProperties = { fontSize: "11px", padding: "4px 8px", borderRadius: "999px", background: "#0f172a", color: "#cbd5e1", border: "1px solid #263044" };
const timelineMessageStyle: CSSProperties = { color: "#cbd5e1", marginTop: "6px", fontSize: "13px" };
const detailTitleStyle: CSSProperties = { fontSize: "22px", fontWeight: 900 };
const stepsListStyle: CSSProperties = { display: "grid", gap: "12px", marginTop: "12px" };
const stepCardStyle: CSSProperties = { border: "1px solid #263044", borderRadius: "14px", padding: "14px", background: "#020617" };
const historyListStyle: CSSProperties = { display: "grid", gap: "12px", marginTop: "16px" };
const historyItemStyle: CSSProperties = { textAlign: "left", padding: "14px", borderRadius: "14px", border: "1px solid #263044", background: "#0b1020", color: "white" };


const approvalPanelStyle: CSSProperties = {
  border: "1px solid #f59e0b",
  borderRadius: "20px",
  padding: "20px",
  marginBottom: "24px",
  background: "#120a02"
};

const approvalQueueStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  marginTop: "16px"
};

const approvalItemStyle: CSSProperties = {
  border: "1px solid #263044",
  borderRadius: "14px",
  padding: "14px",
  background: "#020617"
};

const approvalButtonRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
  marginTop: "12px"
};



const reportPanelStyle: CSSProperties = {
  border: "1px solid #38bdf8",
  borderRadius: "20px",
  padding: "20px",
  marginBottom: "24px",
  background: "#03111c"
};

const reportButtonRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
  marginTop: "12px",
  marginBottom: "12px"
};


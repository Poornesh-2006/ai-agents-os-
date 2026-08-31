"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type FeatureSummary = {
  done: number;
  building: number;
  planned: number;
  error: number;
};

export default function HomePage() {
  const [liveStatus, setLiveStatus] = useState<any>(null);
  const [outputFiles, setOutputFiles] = useState<any>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [message, setMessage] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [summary, setSummary] = useState<FeatureSummary>({
    done: 0,
    building: 0,
    planned: 0,
    error: 0,
  });

  const loadDashboard = async () => {
    try {
      const liveResponse = await fetch(`${API_BASE}/agents/live-status`);
      const liveData = await liveResponse.json();
      setLiveStatus(liveData);
    } catch {
      setLiveStatus(null);
    }
    try {
      const outputResponse = await fetch(`${API_BASE}/dashboard/output-files`);
      const outputData = await outputResponse.json();
      setOutputFiles(outputData);
    } catch {
      setOutputFiles(null);
    }


    try {
      const healthResponse = await fetch(`${API_BASE}/health`);
      const healthData = await healthResponse.json();
      setBackendOnline(Boolean(healthData.ok || healthData.status === "ok"));
    } catch {
      setBackendOnline(false);
    }

    try {
      const featuresResponse = await fetch(`${API_BASE}/features`);
      const featuresData = await featuresResponse.json();

      if (featuresData.ok && featuresData.summary) {
        setSummary(featuresData.summary);
      }
    } catch {
      setSummary({ done: 0, building: 0, planned: 0, error: 0 });
    }

    try {
      const logsResponse = await fetch(`${API_BASE}/control/logs`);
      const logsData = await logsResponse.json();
      const nextLogs = logsData.logs || logsData.lines || ["No logs yet."];
      setLogs(Array.isArray(nextLogs) ? nextLogs.slice(-8) : ["No logs yet."]);
    } catch {
      setLogs(["Logs not available yet."]);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const runAction = async (label: string, endpoint: string) => {
    try {
      setLoadingAction(label);
      setMessage("");

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
      });

      const data = await response.json();
      setMessage(data.message || `${label} completed.`);
      await loadDashboard();
    } catch {
      setMessage(`${label} failed. Check backend terminal.`);
    } finally {
      setLoadingAction("");
    }
  };

  const totalFeatures =
    summary.done + summary.building + summary.planned + summary.error;

  const completion =
    totalFeatures === 0 ? 0 : Math.round((summary.done / totalFeatures) * 100);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#050816] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-white/[0.04] to-cyan-500/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                Control Dashboard
              </p>
              <h1 className="mt-2 text-3xl font-black">
                AI Agent OS Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Run agents, monitor backend health, track features, and open build tools from one clean control center.
              </p>
            </div>

            <button
              onClick={loadDashboard}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Refresh
            </button>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Backend API</p>
            <p className={`mt-2 text-2xl font-black ${backendOnline ? "text-emerald-300" : "text-red-300"}`}>
              {backendOnline ? "Online" : "Offline"}
            </p>
            <p className="mt-1 text-xs text-slate-500">FastAPI port 8000</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Feature Progress</p>
            <p className="mt-2 text-2xl font-black text-violet-300">{completion}%</p>
            <p className="mt-1 text-xs text-slate-500">{summary.done} done / {totalFeatures} total</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Building</p>
            <p className="mt-2 text-2xl font-black text-amber-300">{summary.building}</p>
            <p className="mt-1 text-xs text-slate-500">Active tasks</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Errors</p>
            <p className="mt-2 text-2xl font-black text-red-300">{summary.error}</p>
            <p className="mt-1 text-xs text-slate-500">Needs attention</p>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-4">
          ...backend/status cards...
        </section>

        PASTE LIVE AGENT STATUS SECTION HERE

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Current Output Files</h2>
              <p className="mt-1 text-sm text-slate-400">
                Shows current run outputs, generated pages, reports, and design files.
              </p>
            </div>

            <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-200">
              {outputFiles?.total_files ?? 0} files
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            {(outputFiles?.groups || []).map((group: any) => (
              <div
                key={group.name}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-100">{group.name}</h3>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-slate-300">
                    {group.count}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {group.files.length === 0 && (
                    <p className="text-xs text-slate-500">No files yet.</p>
                  )}

                  {group.files.slice(0, 5).map((file: any) => (
                    <div
                      key={file.file_path}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <p className="break-words text-xs font-semibold text-slate-200">
                        {file.file_name}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {file.modified} · {Math.ceil(file.size / 1024)} KB
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          ...Agent Controls...
        </section>
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">Agent Controls</h2>
            <p className="mt-1 text-sm text-slate-400">
              Start, stop, resume, archive, and scan memory.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => runAction("Start Agents", "/control/start")}
                disabled={!!loadingAction}
                className="rounded-2xl bg-emerald-600 px-4 py-4 text-left font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                Start Agents
                <p className="mt-1 text-xs font-normal text-emerald-100/80">Begin workflow.</p>
              </button>

              <button
                onClick={() => runAction("Stop Agents", "/control/stop")}
                disabled={!!loadingAction}
                className="rounded-2xl bg-red-600 px-4 py-4 text-left font-semibold hover:bg-red-500 disabled:opacity-50"
              >
                Stop Agents
                <p className="mt-1 text-xs font-normal text-red-100/80">Stop execution.</p>
              </button>

              <button
                onClick={() => runAction("Resume Agents", "/control/resume")}
                disabled={!!loadingAction}
                className="rounded-2xl bg-violet-600 px-4 py-4 text-left font-semibold hover:bg-violet-500 disabled:opacity-50"
              >
                Resume Agents
                <p className="mt-1 text-xs font-normal text-violet-100/80">Continue work.</p>
              </button>

              <button
                onClick={() => runAction("Scan Memory", "/control/scan-memory")}
                disabled={!!loadingAction}
                className="rounded-2xl bg-cyan-600 px-4 py-4 text-left font-semibold hover:bg-cyan-500 disabled:opacity-50"
              >
                Scan Memory
                <p className="mt-1 text-xs font-normal text-cyan-100/80">Reload memory.</p>
              </button>

              <button
                onClick={() => runAction("Archive Run", "/control/archive")}
                disabled={!!loadingAction}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-left font-semibold hover:bg-white/15 disabled:opacity-50 sm:col-span-2"
              >
                Archive Current Run
                <p className="mt-1 text-xs font-normal text-slate-400">Save current run output.</p>
              </button>
            </div>

            {loadingAction && (
              <p className="mt-4 text-sm text-slate-400">Running: {loadingAction}...</p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">Quick Open</h2>
            <p className="mt-1 text-sm text-slate-400">Open the important builder pages.</p>

            <div className="mt-5 grid gap-3">
              <Link href="/features" className="rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 py-4 font-semibold text-violet-200 hover:bg-violet-500/20">
                Feature Registry
              </Link>

              <Link href="/page-builder" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 font-semibold hover:bg-white/15">
                Page Builder
              </Link>

              <Link href="/ui-references" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 font-semibold hover:bg-white/15">
                UI References
              </Link>

              <Link href="/generated" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 font-semibold hover:bg-white/15">
                Generated Pages
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-bold">Recent Logs</h2>

          <div className="mt-5 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-xs text-slate-300">
            {logs.map((log, index) => (
              <p key={index} className="border-b border-white/5 py-2 last:border-b-0">
                {log}
              </p>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}


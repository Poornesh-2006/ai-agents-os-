"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function ProjectSnapshotPage() {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadSnapshot = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API_BASE}/project-snapshot`);
      const data = await response.json();

      if (!data.ok) {
        setMessage(data.message || data.error || "Failed to load snapshot.");
        setSnapshot(null);
        return;
      }

      setSnapshot(data);
    } catch {
      setMessage("Backend not reachable. Start FastAPI on port 8000.");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  };

  const copySnapshot = async () => {
    if (!snapshot?.snapshot_markdown) return;
    await navigator.clipboard.writeText(snapshot.snapshot_markdown);
    setMessage("Project snapshot copied.");
  };

  useEffect(() => {
    loadSnapshot();
  }, []);

  return (
    <div className="min-h-screen bg-[#050816] px-8 pb-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-600/20 via-white/[0.04] to-cyan-500/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">
                Project Snapshot
              </p>
              <h1 className="mt-2 text-3xl font-black">
                Export AI Agent OS State
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                One readable report containing Project Brain, features, workflow, assignments, and errors.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadSnapshot}
                disabled={loading}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>

              <button
                onClick={copySnapshot}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold hover:bg-amber-500"
              >
                Copy Snapshot
              </button>
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs text-slate-500">Project Brain</p>
            <p className="mt-2 text-xl font-black text-cyan-300">
              {snapshot?.project_brain_chars ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs text-slate-500">Features</p>
            <p className="mt-2 text-xl font-black text-violet-300">
              {snapshot?.feature_registry_chars ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs text-slate-500">Assignments</p>
            <p className="mt-2 text-xl font-black text-emerald-300">
              {snapshot?.agent_assignments_chars ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs text-slate-500">Workflow</p>
            <p className="mt-2 text-xl font-black text-amber-300">
              {snapshot?.agent_workflow_chars ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs text-slate-500">Errors</p>
            <p className="mt-2 text-xl font-black text-red-300">
              {snapshot?.error_log_chars ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs text-slate-500">Snapshot</p>
            <p className="mt-2 text-xl font-black text-slate-100">
              {snapshot?.snapshot_chars ?? 0}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Snapshot Markdown</h2>
            <p className="text-xs text-slate-500">
              Generated: {snapshot?.generated_at || "Not loaded"}
            </p>
          </div>

          <pre className="mt-5 max-h-[75vh] overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/40 p-5 font-mono text-xs leading-6 text-slate-300">
            {snapshot?.snapshot_markdown || "No snapshot loaded."}
          </pre>
        </section>
      </div>
    </div>
  );
}

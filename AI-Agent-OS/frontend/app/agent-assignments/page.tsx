"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type Assignment = {
  agent: string;
  status: string;
  progress: number;
  current_task: string;
  next_output: string;
};

export default function AgentAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sourceReport, setSourceReport] = useState<any>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API_BASE}/agent-assignments`);
      const data = await response.json();

      if (!data.ok) {
        setMessage(data.message || data.error || "Failed to load assignments.");
        return;
      }

      setAssignments(data.assignments || []);
      setSourceReport(data.source_report || null);
      setUpdatedAt(data.updated_at || "");
    } catch {
      setMessage("Backend not reachable. Start FastAPI on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const resetAssignments = async () => {
    const approved = window.confirm("Reset agent assignments?");
    if (!approved) return;

    try {
      setMessage("");

      const response = await fetch(`${API_BASE}/agent-assignments/reset`, {
        method: "POST",
      });

      const data = await response.json();

      if (!data.ok) {
        setMessage(data.message || data.error || "Reset failed.");
        return;
      }

      setMessage("Agent assignments reset.");
      await loadAssignments();
    } catch {
      setMessage("Could not reset assignments.");
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const getStatusClass = (status: string) => {
    if (status === "running") return "text-emerald-300 bg-emerald-500/15";
    if (status === "waiting") return "text-amber-300 bg-amber-500/15";
    if (status === "done") return "text-cyan-300 bg-cyan-500/15";
    return "text-slate-300 bg-slate-500/15";
  };

  return (
    <div className="min-h-screen bg-[#050816] px-8 pb-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-600/20 via-white/[0.04] to-violet-500/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
                Agent Assignments
              </p>
              <h1 className="mt-2 text-3xl font-black">
                PM → UI/UX → Frontend → Backend → QA Board
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Shows what each agent is responsible for before the real autonomous execution pipeline.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadAssignments}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>

              <button
                onClick={resetAssignments}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20"
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Agents</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">
              {assignments.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Source Report</p>
            <p className="mt-2 break-words text-sm font-bold text-slate-100">
              {sourceReport?.file_name || "No report yet"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Updated</p>
            <p className="mt-2 text-sm font-bold text-slate-100">
              {updatedAt || "Not loaded"}
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {assignments.map((item) => (
            <div
              key={item.agent}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{item.agent}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Responsibility card
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                    item.status
                  )}`}
                >
                  {item.status}
                </span>
              </div>

              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Current Task
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {item.current_task}
                </p>
              </div>

              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Next Output
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {item.next_output}
                </p>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Progress</span>
                  <span>{item.progress || 0}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-cyan-500"
                    style={{ width: `${item.progress || 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-bold">Latest Decision Report Preview</h2>

          <pre className="mt-5 max-h-[45vh] overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/40 p-5 font-mono text-xs leading-6 text-slate-300">
            {sourceReport?.preview || "No decision report preview available."}
          </pre>
        </section>
      </div>
    </div>
  );
}
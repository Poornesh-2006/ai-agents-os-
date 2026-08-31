"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type Stage = {
  agent: string;
  status: string;
  progress: number;
  task: string;
  output: string;
};

export default function AgentWorkflowPage() {
  const [workflow, setWorkflow] = useState<any>(null);
  const [userRequest, setUserRequest] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadWorkflow = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API_BASE}/agent-workflow/latest`);
      const data = await response.json();

      if (!data.ok) {
        setMessage(data.message || data.error || "Failed to load workflow.");
        return;
      }

      setWorkflow(data);
    } catch {
      setMessage("Backend not reachable. Start FastAPI on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const startWorkflow = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API_BASE}/agent-workflow/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_request: userRequest || "Build next safe feature.",
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        setMessage(data.message || data.error || "Failed to start workflow.");
        return;
      }

      setWorkflow(data);
      setMessage(data.message || "Workflow started.");
    } catch {
      setMessage("Could not start workflow.");
    } finally {
      setLoading(false);
    }
  };

  const advanceWorkflow = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API_BASE}/agent-workflow/advance`, {
        method: "POST",
      });

      const data = await response.json();

      if (!data.ok) {
        setMessage(data.message || data.error || "Failed to advance workflow.");
        return;
      }

      setWorkflow(data);
      setMessage(data.message || "Workflow advanced.");
    } catch {
      setMessage("Could not advance workflow.");
    } finally {
      setLoading(false);
    }
  };

  const resetWorkflow = async () => {
    const approved = window.confirm("Reset latest workflow?");
    if (!approved) return;

    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API_BASE}/agent-workflow/reset`, {
        method: "POST",
      });

      const data = await response.json();

      if (!data.ok) {
        setMessage(data.message || data.error || "Reset failed.");
        return;
      }

      setWorkflow(data);
      setMessage(data.message || "Workflow reset.");
    } catch {
      setMessage("Could not reset workflow.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflow();
  }, []);

  const getStatusClass = (status: string) => {
    if (status === "done") return "text-emerald-300 bg-emerald-500/15";
    if (status === "running") return "text-cyan-300 bg-cyan-500/15";
    if (status === "waiting") return "text-amber-300 bg-amber-500/15";
    if (status === "failed") return "text-red-300 bg-red-500/15";
    return "text-slate-300 bg-slate-500/15";
  };

  const stages: Stage[] = workflow?.stages || [];
  const doneCount = stages.filter((stage) => stage.status === "done").length;
  const runningStage = stages.find((stage) => stage.status === "running");
  const totalStages = stages.length || 6;
  const overallProgress = Math.round((doneCount / totalStages) * 100);

  return (
    <div className="min-h-screen bg-[#050816] px-8 pb-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-600/20 via-white/[0.04] to-cyan-500/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">
                Agent Workflow v2
              </p>
              <h1 className="mt-2 text-3xl font-black">
                PM → UI/UX → Frontend → Backend → QA → Reviewer
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Safe stage-by-stage workflow controller before real autonomous AI file changes.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadWorkflow}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>

              <button
                onClick={resetWorkflow}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20"
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
            {message}
          </div>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-bold">Start New Workflow</h2>

          <textarea
            value={userRequest}
            onChange={(event) => setUserRequest(event.target.value)}
            rows={4}
            placeholder="Example: Build a health dashboard page connected to Project Brain and Safe Install."
            className="mt-4 w-full rounded-2xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-emerald-500"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={startWorkflow}
              disabled={loading}
              className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
            >
              Start Safe Workflow
            </button>

            <button
              onClick={advanceWorkflow}
              disabled={loading}
              className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-bold hover:bg-cyan-500 disabled:opacity-50"
            >
              Advance Next Stage
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Run ID</p>
            <p className="mt-2 break-words text-xs font-bold text-slate-100">
              {workflow?.run_id || "No run"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Status</p>
            <p className="mt-2 text-2xl font-black text-emerald-300">
              {workflow?.status || "Not loaded"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Current Agent</p>
            <p className="mt-2 text-sm font-bold text-cyan-300">
              {runningStage?.agent || "No running stage"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Overall Progress</p>
            <p className="mt-2 text-2xl font-black text-violet-300">
              {overallProgress}%
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Workflow Progress</span>
            <span>
              {doneCount}/{totalStages} stages done
            </span>
          </div>

          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {stages.map((stage: Stage, index: number) => (
            <div
              key={`${stage.agent}-${index}`}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Stage {index + 1}
                  </p>
                  <h2 className="mt-1 text-xl font-bold">{stage.agent}</h2>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                    stage.status
                  )}`}
                >
                  {stage.status}
                </span>
              </div>

              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Task
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {stage.task}
                </p>
              </div>

              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Output
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {stage.output || "Waiting for this stage."}
                </p>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Progress</span>
                  <span>{stage.progress || 0}%</span>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${stage.progress || 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

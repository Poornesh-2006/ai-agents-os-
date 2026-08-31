"use client";

import { useEffect, useState } from "react";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type DecisionReport = {
    file_name: string;
    title: string;
    modified: string;
    size: number;
    preview: string;
};

type TaskRun = {
    id: string;
    file_name: string;
    source_report: string;
    task_goal: string;
    target_route: string;
    build_mode: string;
    created_at: string;
    status: string;
    preview: string;
};

export default function TaskRunnerPage() {
    const [reports, setReports] = useState<DecisionReport[]>([]);
    const [runs, setRuns] = useState<TaskRun[]>([]);
    const [selectedReport, setSelectedReport] = useState("");
    const [taskGoal, setTaskGoal] = useState("");
    const [targetRoute, setTargetRoute] = useState("");
    const [buildMode, setBuildMode] = useState("plan_only");
    const [resultContent, setResultContent] = useState("");
    const [message, setMessage] = useState("");
    const [loadingReports, setLoadingReports] = useState(false);
    const [loadingRuns, setLoadingRuns] = useState(false);
    const [running, setRunning] = useState(false);

    const loadReports = async () => {
        try {
            setLoadingReports(true);
            setMessage("");

            const response = await fetch(`${API_BASE}/decision-reports`);
            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || "Failed to load decision reports.");
                return;
            }

            setReports(data.reports || []);

            if ((data.reports || []).length > 0 && !selectedReport) {
                setSelectedReport(data.reports[0].file_name);
            }
        } catch {
            setMessage("Backend not reachable. Start FastAPI on port 8000.");
        } finally {
            setLoadingReports(false);
        }
    };

    const loadRuns = async () => {
        try {
            setLoadingRuns(true);

            const response = await fetch(`${API_BASE}/task-runner/runs`);
            const data = await response.json();

            if (data.ok) {
                setRuns(data.runs || []);
            }
        } catch {
            setMessage("Could not load task runs. Check backend.");
        } finally {
            setLoadingRuns(false);
        }
    };

    const startTaskRunner = async () => {
        if (running) return;

        if (!selectedReport) {
            setMessage("Select a decision report first.");
            return;
        }

        try {
            setRunning(true);
            setMessage("");
            setResultContent("");

            const response = await fetch(`${API_BASE}/task-runner/start`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    report_file_name: selectedReport,
                    task_goal:
                        taskGoal.trim() ||
                        "Convert this decision report into a safe executable build task plan.",
                    target_route: targetRoute.trim(),
                    build_mode: buildMode,
                    save_to_memory: true,
                }),
            });

            const data = await response.json();

            if (!data.ok) {
                setMessage(data.error || data.message || "Task Runner failed.");
                return;
            }

            setResultContent(data.content || "");
            setMessage("Agent Task Runner completed.");
            await loadRuns();
        } catch {
            setMessage("Task Runner failed. Check backend terminal.");
        } finally {
            setRunning(false);
        }
    };

    const copyResult = async () => {
        if (!resultContent) return;

        try {
            await navigator.clipboard.writeText(resultContent);
            setMessage("Task run copied.");
        } catch {
            setMessage("Could not copy task run.");
        }
    };

    useEffect(() => {
        loadReports();
        loadRuns();
    }, []);

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050816] p-6 text-white">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-600/20 via-white/[0.04] to-violet-500/10 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">
                                Agent Task Runner
                            </p>
                            <h1 className="mt-2 text-3xl font-black">
                                Turn decision reports into executable build plans
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm text-slate-400">
                                Select an old Agent Team decision, give a task goal, and let the runner create a PM → UI/UX → Frontend → Backend → QA execution plan.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={loadReports}
                                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                            >
                                {loadingReports ? "Loading..." : "Refresh Reports"}
                            </button>

                            <button
                                onClick={loadRuns}
                                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                            >
                                {loadingRuns ? "Loading..." : "Refresh Runs"}
                            </button>
                        </div>
                    </div>
                </section>

                {message && (
                    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
                        {message}
                    </div>
                )}

                <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                    <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                        <h2 className="text-xl font-bold">Runner Setup</h2>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                Select Decision Report
                            </label>
                            <select
                                value={selectedReport}
                                onChange={(event) => setSelectedReport(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-emerald-500"
                            >
                                <option value="">Select report</option>
                                {reports.map((report) => (
                                    <option key={report.file_name} value={report.file_name}>
                                        {report.file_name}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-slate-500">
                                These reports come from Ask Agent Team.
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                Task Goal
                            </label>
                            <textarea
                                value={taskGoal}
                                onChange={(event) => setTaskGoal(event.target.value)}
                                placeholder="Example: Build the first version of the health dashboard page safely."
                                rows={5}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                Target Route
                            </label>
                            <input
                                value={targetRoute}
                                onChange={(event) => setTargetRoute(event.target.value)}
                                placeholder="/health-dashboard"
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-emerald-500"
                            />
                            <p className="mt-1 text-xs text-slate-500">
                                Optional. This tells the runner where the page may go later.
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                Build Mode
                            </label>
                            <select
                                value={buildMode}
                                onChange={(event) => setBuildMode(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-emerald-500"
                            >
                                <option value="plan_only">Plan only</option>
                                <option value="prepare_code_next">Prepare code next</option>
                                <option value="safe_install_ready">Safe install ready</option>
                            </select>
                        </div>

                        <button
                            onClick={startTaskRunner}
                            disabled={running}
                            className="w-full rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
                        >
                            {running ? "Running Agent Task Runner..." : "Start Task Runner"}
                        </button>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-bold">Task Run Output</h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    The runner output appears here after completion.
                                </p>
                            </div>

                            <button
                                onClick={copyResult}
                                disabled={!resultContent}
                                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
                            >
                                Copy
                            </button>
                        </div>

                        <div className="mt-5 max-h-[75vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-5">
                            {resultContent ? (
                                <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-7 text-slate-200">
                                    {resultContent}
                                </pre>
                            ) : (
                                <p className="text-sm text-slate-400">
                                    Select a decision report and click Start Task Runner.
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold">Previous Task Runs</h2>
                            <p className="mt-1 text-sm text-slate-400">
                                Saved task runs from the local backend.
                            </p>
                        </div>

                        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-200">
                            {runs.length}
                        </span>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {runs.length === 0 && (
                            <p className="text-sm text-slate-400">No task runs yet.</p>
                        )}

                        {runs.map((run) => (
                            <div
                                key={run.id}
                                className="rounded-2xl border border-white/10 bg-black/20 p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-slate-100">
                                            {run.task_goal}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {run.created_at} · {run.build_mode}
                                        </p>
                                    </div>

                                    <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] text-emerald-200">
                                        {run.status}
                                    </span>
                                </div>

                                <p className="mt-3 text-xs text-slate-500">
                                    Source: {run.source_report}
                                </p>

                                <p className="mt-3 line-clamp-4 text-xs leading-5 text-slate-400">
                                    {run.preview}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
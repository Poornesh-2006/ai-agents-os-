"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type DecisionReport = {
    file_name: string;
    title: string;
    modified: string;
    size: number;
    preview: string;
};

export default function DecisionReportsPage() {
    const [reports, setReports] = useState<DecisionReport[]>([]);
    const [selectedFile, setSelectedFile] = useState("");
    const [selectedContent, setSelectedContent] = useState("");
    const [message, setMessage] = useState("");
    const [loadingList, setLoadingList] = useState(false);
    const [loadingReport, setLoadingReport] = useState(false);

    const loadReports = async () => {
        try {
            setLoadingList(true);
            setMessage("");

            const response = await fetch(`${API_BASE}/decision-reports`);
            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || "Failed to load decision reports.");
                return;
            }

            setReports(data.reports || []);

            if ((data.reports || []).length > 0 && !selectedFile) {
                openReport(data.reports[0].file_name);
            }
        } catch {
            setMessage("Backend not reachable. Start FastAPI on port 8000.");
        } finally {
            setLoadingList(false);
        }
    };

    const openReport = async (fileName: string) => {
        try {
            setLoadingReport(true);
            setMessage("");
            setSelectedFile(fileName);
            setSelectedContent("");

            const response = await fetch(
                `${API_BASE}/decision-reports/${encodeURIComponent(fileName)}`
            );
            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || "Failed to open report.");
                return;
            }

            setSelectedContent(data.content || "");
        } catch {
            setMessage("Could not open report. Check backend terminal.");
        } finally {
            setLoadingReport(false);
        }
    };

    const copyReport = async () => {
        if (!selectedContent) return;

        try {
            await navigator.clipboard.writeText(selectedContent);
            setMessage("Report copied to clipboard.");
        } catch {
            setMessage("Could not copy report.");
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050816] p-6 text-white">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-white/[0.04] to-cyan-500/10 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                                Decision Reports
                            </p>
                            <h1 className="mt-2 text-3xl font-black">
                                Agent Team Plans
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm text-slate-400">
                                View all saved agent decisions, plans, risks, assignments, and next actions from Ask Agent Team.
                            </p>
                        </div>

                        <button
                            onClick={loadReports}
                            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                        >
                            {loadingList ? "Refreshing..." : "Refresh"}
                        </button>
                    </div>
                </section>

                {message && (
                    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
                        {message}
                    </div>
                )}

                <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold">Reports</h2>
                            <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-200">
                                {reports.length}
                            </span>
                        </div>

                        <div className="mt-5 space-y-3">
                            {reports.length === 0 && (
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                                    No decision reports found yet. Go to Agent Brief and click Ask Agent Team.
                                </div>
                            )}

                            {reports.map((report) => {
                                const active = selectedFile === report.file_name;

                                return (
                                    <button
                                        key={report.file_name}
                                        onClick={() => openReport(report.file_name)}
                                        className={`w-full rounded-2xl border p-4 text-left transition-all ${active
                                            ? "border-violet-400/40 bg-violet-500/15"
                                            : "border-white/10 bg-black/20 hover:bg-white/[0.06]"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-slate-100">
                                                    {report.title}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {report.modified}
                                                </p>
                                            </div>

                                            <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-slate-400">
                                                {Math.ceil(report.size / 1024)} KB
                                            </span>
                                        </div>

                                        <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400">
                                            {report.preview}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-bold">Report Content</h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    {selectedFile || "No report selected"}
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={copyReport}
                                    disabled={!selectedContent}
                                    className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
                                >
                                    Copy
                                </button>

                                <Link
                                    href="/agent-brief"
                                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
                                >
                                    Ask Again
                                </Link>
                            </div>
                        </div>

                        <div className="mt-5 max-h-[75vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-5">
                            {loadingReport ? (
                                <p className="text-sm text-slate-400">Loading report...</p>
                            ) : selectedContent ? (
                                <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-7 text-slate-200">
                                    {selectedContent}
                                </pre>
                            ) : (
                                <p className="text-sm text-slate-400">
                                    Select a report to read it.
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                <section className="grid gap-3 md:grid-cols-3">
                    <Link
                        href="/agent-brief"
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 font-semibold hover:bg-white/[0.08]"
                    >
                        Agent Brief
                        <p className="mt-1 text-xs font-normal text-slate-500">
                            Ask the team for a new plan.
                        </p>
                    </Link>

                    <Link
                        href="/project-brain"
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 font-semibold hover:bg-white/[0.08]"
                    >
                        Project Brain
                        <p className="mt-1 text-xs font-normal text-slate-500">
                            Update the main project memory.
                        </p>
                    </Link>

                    <Link
                        href="/features"
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 font-semibold hover:bg-white/[0.08]"
                    >
                        Feature Registry
                        <p className="mt-1 text-xs font-normal text-slate-500">
                            Convert reports into build tasks.
                        </p>
                    </Link>
                </section>
            </div>
        </div>
    );
}

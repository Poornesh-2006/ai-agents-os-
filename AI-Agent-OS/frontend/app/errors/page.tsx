"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type ErrorItem = {
    id: string;
    source: string;
    step: string;
    message: string;
    details: string;
    created_at: string;
    status: string;
};

export default function ErrorsPage() {
    const [errors, setErrors] = useState<ErrorItem[]>([]);
    const [selectedError, setSelectedError] = useState<ErrorItem | null>(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const loadErrors = async () => {
        try {
            setLoading(true);
            setMessage("");

            const response = await fetch(`${API_BASE}/errors`);
            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || "Failed to load errors.");
                return;
            }

            setErrors(data.errors || []);

            if ((data.errors || []).length > 0 && !selectedError) {
                setSelectedError(data.errors[0]);
            }
        } catch {
            setMessage("Backend not reachable. Start FastAPI on port 8000.");
        } finally {
            setLoading(false);
        }
    };

    const createTestError = async () => {
        try {
            setMessage("");

            const response = await fetch(`${API_BASE}/errors/test`, {
                method: "POST",
            });

            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || "Failed to create test error.");
                return;
            }

            setMessage("Test error created.");
            await loadErrors();
        } catch {
            setMessage("Could not create test error.");
        }
    };

    const clearErrors = async () => {
        const approved = window.confirm("Clear all errors?");
        if (!approved) return;

        try {
            setMessage("");

            const response = await fetch(`${API_BASE}/errors/clear`, {
                method: "POST",
            });

            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || "Failed to clear errors.");
                return;
            }

            setErrors([]);
            setSelectedError(null);
            setMessage("All errors cleared.");
        } catch {
            setMessage("Could not clear errors.");
        }
    };

    const copySelectedError = async () => {
        if (!selectedError) return;

        const text = `
Source: ${selectedError.source}
Step: ${selectedError.step}
Message: ${selectedError.message}
Details:
${selectedError.details}
Created: ${selectedError.created_at}
`.trim();

        try {
            await navigator.clipboard.writeText(text);
            setMessage("Error copied.");
        } catch {
            setMessage("Could not copy error.");
        }
    };

    useEffect(() => {
        loadErrors();
    }, []);

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050816] p-6 text-white">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-red-600/20 via-white/[0.04] to-violet-500/10 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-300">
                                Error Center
                            </p>
                            <h1 className="mt-2 text-3xl font-black">
                                Logs, failures, and agent errors
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm text-slate-400">
                                Track failed agent steps, backend errors, and debugging details.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={loadErrors}
                                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                            >
                                {loading ? "Refreshing..." : "Refresh"}
                            </button>

                            <button
                                onClick={createTestError}
                                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/20"
                            >
                                Test Error
                            </button>

                            <button
                                onClick={clearErrors}
                                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </section>

                {message && (
                    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
                        {message}
                    </div>
                )}

                <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold">Error List</h2>
                            <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-200">
                                {errors.length}
                            </span>
                        </div>

                        <div className="mt-5 space-y-3">
                            {errors.length === 0 && (
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                                    No errors found. Good bro âœ…
                                </div>
                            )}

                            {errors.map((error) => {
                                const active = selectedError?.id === error.id;

                                return (
                                    <button
                                        key={error.id}
                                        onClick={() => setSelectedError(error)}
                                        className={`w-full rounded-2xl border p-4 text-left transition-all ${active
                                            ? "border-red-400/40 bg-red-500/15"
                                            : "border-white/10 bg-black/20 hover:bg-white/[0.06]"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-slate-100">
                                                    {error.message}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {error.source} Â· {error.step}
                                                </p>
                                            </div>

                                            <span className="rounded-full bg-red-500/20 px-2 py-1 text-[10px] text-red-200">
                                                {error.status}
                                            </span>
                                        </div>

                                        <p className="mt-3 text-xs text-slate-500">
                                            {error.created_at}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-bold">Error Details</h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    {selectedError?.id || "No error selected"}
                                </p>
                            </div>

                            <button
                                onClick={copySelectedError}
                                disabled={!selectedError}
                                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
                            >
                                Copy
                            </button>
                        </div>

                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-5">
                            {!selectedError ? (
                                <p className="text-sm text-slate-400">
                                    Select an error to see details.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                            <p className="text-xs text-slate-500">Source</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-200">
                                                {selectedError.source}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                            <p className="text-xs text-slate-500">Step</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-200">
                                                {selectedError.step}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-500">Message</p>
                                        <p className="mt-2 text-sm text-slate-200">
                                            {selectedError.message}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-500">Details</p>
                                        <pre className="mt-2 max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-xs leading-6 text-slate-200">
                                            {selectedError.details || "No details."}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

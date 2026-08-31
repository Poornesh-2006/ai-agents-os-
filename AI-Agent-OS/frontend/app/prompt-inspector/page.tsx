"use client";

import { useEffect, useState } from "react";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function PromptInspectorPage() {
    const [data, setData] = useState<any>(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const loadPrompt = async () => {
        try {
            setLoading(true);
            setMessage("");

            const response = await fetch(`${API_BASE}/prompt-inspector/page-builder`);
            const result = await response.json();

            if (!result.ok) {
                setMessage(result.message || result.error || "Failed to load prompt.");
                setData(null);
                return;
            }

            setData(result);
        } catch {
            setMessage("Backend not reachable. Start FastAPI on port 8000.");
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const copyPrompt = async () => {
        if (!data?.final_prompt) return;
        await navigator.clipboard.writeText(data.final_prompt);
        setMessage("Prompt copied.");
    };

    useEffect(() => {
        loadPrompt();
    }, []);

    return (
        <div className="min-h-screen bg-[#050816] px-8 pb-8 text-white">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-600/20 via-white/[0.04] to-violet-500/10 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
                                Prompt Inspector
                            </p>
                            <h1 className="mt-2 text-3xl font-black">
                                See what the agents will read
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm text-slate-400">
                                Verify Project Brain, memory, UI style, page plan, and feature registry before running page generation.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={loadPrompt}
                                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                            >
                                {loading ? "Refreshing..." : "Refresh"}
                            </button>

                            <button
                                onClick={copyPrompt}
                                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold hover:bg-cyan-500"
                            >
                                Copy Prompt
                            </button>
                        </div>
                    </div>
                </section>

                {message && (
                    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
                        {message}
                    </div>
                )}

                <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs text-slate-500">Project Brain</p>
                        <p className="mt-2 text-xl font-black text-cyan-300">
                            {data?.project_brain_chars ?? 0}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs text-slate-500">Long Memory</p>
                        <p className="mt-2 text-xl font-black text-violet-300">
                            {data?.long_memory_chars ?? 0}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs text-slate-500">UI Style</p>
                        <p className="mt-2 text-xl font-black text-emerald-300">
                            {data?.ui_style_chars ?? 0}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs text-slate-500">Page Plan</p>
                        <p className="mt-2 text-xl font-black text-amber-300">
                            {data?.page_plan_chars ?? 0}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs text-slate-500">Features</p>
                        <p className="mt-2 text-xl font-black text-pink-300">
                            {data?.feature_registry_chars ?? 0}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs text-slate-500">Final Prompt</p>
                        <p className="mt-2 text-xl font-black text-slate-100">
                            {data?.final_prompt_chars ?? 0}
                        </p>
                    </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-xl font-bold">Final Page Builder Prompt</h2>
                        <p className="text-xs text-slate-500">
                            Updated: {data?.updated_at || "Not loaded"}
                        </p>
                    </div>

                    <pre className="mt-5 max-h-[70vh] overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/40 p-5 font-mono text-xs leading-6 text-slate-300">
                        {data?.final_prompt || "No prompt loaded."}
                    </pre>
                </section>
            </div>
        </div>
    );
}
"use client";

import { useEffect, useState } from "react";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function PageBuilderPage() {
    const [builderContext, setBuilderContext] = useState<any>(null);
    const [pageName, setPageName] = useState("");
    const [targetRoute, setTargetRoute] = useState("");
    const [pagePrompt, setPagePrompt] = useState("");
    const [uiStyle, setUiStyle] = useState("");
    const [generatedResult, setGeneratedResult] = useState<any>(null);
    const [message, setMessage] = useState("");
    const [loadingContext, setLoadingContext] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [installing, setInstalling] = useState(false);

    const loadBuilderContext = async () => {
        try {
            setLoadingContext(true);
            setMessage("");

            const response = await fetch(`${API_BASE}/page-builder/context`);
            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || data.error || "Failed to load builder context.");
                setBuilderContext(null);
                return;
            }

            setBuilderContext(data);
        } catch {
            setMessage("Backend not reachable. Start FastAPI on port 8000.");
            setBuilderContext(null);
        } finally {
            setLoadingContext(false);
        }
    };

    const generatePage = async () => {
        if (!pageName.trim()) {
            setMessage("Enter a page name first.");
            return;
        }

        if (!targetRoute.trim()) {
            setMessage("Enter a target route first. Example: /health-dashboard");
            return;
        }

        if (!pagePrompt.trim()) {
            setMessage("Enter what this page should build.");
            return;
        }

        try {
            setGenerating(true);
            setMessage("");
            setGeneratedResult(null);

            const response = await fetch(`${API_BASE}/builder/generate-page`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    page_name: pageName.trim(),
                    target_route: targetRoute.trim(),
                    route: targetRoute.trim(),
                    prompt: pagePrompt.trim(),
                    description: pagePrompt.trim(),
                    ui_style: uiStyle.trim(),
                    use_project_brain: true,
                    save_to_memory: true,
                }),
            });

            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || data.error || "Page generation failed.");
                setGeneratedResult(data);
                return;
            }

            setGeneratedResult(data);
            setMessage("Page generated. Check output before installing.");
        } catch {
            setMessage("Generate failed. Check backend terminal.");
        } finally {
            setGenerating(false);
        }
    };

    const installGeneratedPage = async () => {
        const generatedFile =
            generatedResult?.file_name ||
            generatedResult?.generated_file_name ||
            generatedResult?.output_file ||
            generatedResult?.page_file;

        if (!generatedFile) {
            setMessage("No generated file found from generation result.");
            return;
        }

        const approved = window.confirm(
            "Install generated page? Safer option is to use Safe Install page for preview, backup, and rollback."
        );

        if (!approved) return;

        try {
            setInstalling(true);
            setMessage("");

            const response = await fetch(`${API_BASE}/builder/install-page`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    generated_file_name: generatedFile,
                    target_route: targetRoute.trim(),
                    route: targetRoute.trim(),
                }),
            });

            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || data.error || "Install failed.");
                return;
            }

            setMessage("Generated page installed.");
        } catch {
            setMessage("Install failed. Use Safe Install page or check backend terminal.");
        } finally {
            setInstalling(false);
        }
    };

    const loadStarterPrompt = () => {
        setPageName("health_dashboard");
        setTargetRoute("/health-dashboard");
        setPagePrompt(
            "Build a clean health dashboard page for Devendra's personal AI health tracker. It should show recovery, sleep, steps, workouts, food, water, body progress, and AI recommendations. Keep it safe, modern, dark theme, card-based, and mobile-friendly."
        );
        setUiStyle(
            "Dark futuristic dashboard, glass cards, rounded corners, cyan/violet accents, clean spacing, premium AI control center look."
        );
    };

    useEffect(() => {
        loadBuilderContext();
    }, []);

    return (
        <div className="min-h-screen bg-[#050816] px-8 pb-8 text-white">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-white/[0.04] to-cyan-500/10 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                                Page Builder
                            </p>
                            <h1 className="mt-2 text-3xl font-black">
                                Build pages with Project Brain context
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm text-slate-400">
                                This builder checks Project Brain, UI style memory, page plans, and feature registry before generating pages.
                            </p>
                        </div>

                        <button
                            onClick={loadStarterPrompt}
                            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                        >
                            Load Example
                        </button>
                    </div>
                </section>

                {message && (
                    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
                        {message}
                    </div>
                )}

                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold">Project Brain Context</h2>
                            <p className="mt-1 text-sm text-slate-400">
                                Confirms whether Page Builder can read Project Brain and planning memory.
                            </p>
                        </div>

                        <button
                            onClick={loadBuilderContext}
                            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                        >
                            {loadingContext ? "Loading..." : "Refresh Context"}
                        </button>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs text-slate-500">Project Brain</p>
                            <p className="mt-2 text-lg font-bold text-cyan-300">
                                {builderContext?.project_brain_exists ? "Found" : "Missing"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {builderContext?.project_brain_chars ?? 0} chars
                            </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs text-slate-500">UI Style Memory</p>
                            <p className="mt-2 text-lg font-bold text-violet-300">
                                {builderContext?.ui_style_chars ?? 0}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">chars</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs text-slate-500">Page Plan Memory</p>
                            <p className="mt-2 text-lg font-bold text-emerald-300">
                                {builderContext?.page_plan_chars ?? 0}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">chars</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs text-slate-500">Feature Registry</p>
                            <p className="mt-2 text-lg font-bold text-amber-300">
                                {builderContext?.feature_registry_chars ?? 0}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">chars</p>
                        </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Project Brain Preview
                        </p>

                        <pre className="mt-3 max-h-[260px] overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-slate-300">
                            {builderContext?.project_brain_preview ||
                                "No Project Brain content loaded."}
                        </pre>
                    </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                        <h2 className="text-xl font-bold">Generate Page</h2>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                Page name
                            </label>
                            <input
                                value={pageName}
                                onChange={(event) => setPageName(event.target.value)}
                                placeholder="health_dashboard"
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                Target route
                            </label>
                            <input
                                value={targetRoute}
                                onChange={(event) => setTargetRoute(event.target.value)}
                                placeholder="/health-dashboard"
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                Page prompt
                            </label>
                            <textarea
                                value={pagePrompt}
                                onChange={(event) => setPagePrompt(event.target.value)}
                                rows={8}
                                placeholder="Describe what the page should build..."
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                UI style
                            </label>
                            <textarea
                                value={uiStyle}
                                onChange={(event) => setUiStyle(event.target.value)}
                                rows={4}
                                placeholder="Dark dashboard, clean cards, cyan/violet accents..."
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <button
                                onClick={generatePage}
                                disabled={generating}
                                className="rounded-2xl bg-violet-600 px-5 py-4 text-sm font-bold hover:bg-violet-500 disabled:opacity-50"
                            >
                                {generating ? "Generating..." : "Generate Page"}
                            </button>

                            <button
                                onClick={installGeneratedPage}
                                disabled={installing || !generatedResult}
                                className="rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
                            >
                                {installing ? "Installing..." : "Install Generated"}
                            </button>
                        </div>

                        <p className="text-xs leading-6 text-slate-500">
                            Safer workflow: generate first, then use Safe Install page for compare, approval, backup, and rollback.
                        </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                        <h2 className="text-xl font-bold">Generation Result</h2>

                        <div className="mt-5 max-h-[75vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-5">
                            {generatedResult ? (
                                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-slate-300">
                                    {JSON.stringify(generatedResult, null, 2)}
                                </pre>
                            ) : (
                                <p className="text-sm text-slate-400">
                                    Generate a page to see the backend result here.
                                </p>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
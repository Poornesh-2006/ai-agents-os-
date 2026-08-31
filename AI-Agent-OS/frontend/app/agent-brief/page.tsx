"use client";

import { useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function AgentBriefPage() {
    const [appName, setAppName] = useState("");
    const [appIdea, setAppIdea] = useState("");
    const [mainFeatures, setMainFeatures] = useState("");
    const [uiStyle, setUiStyle] = useState("");
    const [backendNeeds, setBackendNeeds] = useState("");
    const [privateRules, setPrivateRules] = useState(
        "Agents must ask before connecting database, APIs, local models, deployment, or private data."
    );
    const [agentQuestions, setAgentQuestions] = useState(
        "Ask me before choosing database. Ask me before using paid APIs. Ask me before changing main dashboard structure."
    );

    const [saveLong, setSaveLong] = useState(true);
    const [saveShort, setSaveShort] = useState(true);
    const [addFeatures, setAddFeatures] = useState(true);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState("");
    const [loadingDecision, setLoadingDecision] = useState(false);
    const [decision, setDecision] = useState("");

    const buildAgentGoal = () => {
        return `
App Name:
${appName || "Untitled App"}

App Idea:
${appIdea}

Main Features:
${mainFeatures || "Not provided"}

UI Style:
${uiStyle || "Not provided"}

Backend / Database Needs:
${backendNeeds || "Not provided"}

Private Rules:
${privateRules || "Not provided"}

Questions agents must ask:
${agentQuestions || "Not provided"}
`.trim();
    };

    const saveBrief = async () => {
        if (!appIdea.trim()) {
            setResult("App idea is required.");
            return;
        }

        try {
            setLoading(true);
            setResult("");

            const response = await fetch(`${API_BASE}/agent-brief/save`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    app_name: appName,
                    app_idea: appIdea,
                    main_features: mainFeatures,
                    ui_style: uiStyle,
                    backend_needs: backendNeeds,
                    private_rules: privateRules,
                    agent_questions: agentQuestions,
                    save_to_long_memory: saveLong,
                    save_to_short_memory: saveShort,
                    add_to_feature_registry: addFeatures,
                }),
            });

            const data = await response.json();

            if (!data.ok) {
                setResult(data.message || "Failed to save Agent Brief.");
                return;
            }

            setResult(
                `Saved successfully. Created ${data.created_feature_count || 0} features.`
            );
        } catch {
            setResult("Backend not reachable. Start FastAPI on port 8000.");
        } finally {
            setLoading(false);
        }
    };
    const askAgentTeam = async () => {
        if (loadingDecision) return;


        if (!appIdea.trim()) {
            setResult("Add your app idea before asking the agent team.");
            return;
        }

        try {
            setLoadingDecision(true);
            setResult("");
            setDecision("");

            const response = await fetch(`${API_BASE}/agents/decide`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    goal: `Plan this app/project: ${appName || "Untitled App"}`,
                    context: buildAgentGoal(),
                    model: "z-ai/glm-5.1",
                    save_to_memory: true,
                }),
            });

            const data = await response.json();

            if (!data.ok) {
                setResult(data.message || data.error || "Agent team decision failed.");
                return;
            }

            setDecision(data.decision || "No decision returned.");
            setResult("Agent team decision created and saved to memory.");
        } catch {
            setResult("Agent team failed. Check backend terminal and NVIDIA key.");
        } finally {
            setLoadingDecision(false);
        }
    };


    const loadExample = () => {
        setAppName("Personal AI Health Tracker");
        setAppIdea(
            "A private personal app for tracking health, gym, sleep, habits, finance, books, and tasks. The AI should help me plan my day, understand my body data, and build my app step by step."
        );
        setMainFeatures(
            "- Daily health dashboard\n- Gym workout planner\n- Sleep and recovery tracker\n- Food and water tracker\n- Finance tracker\n- Book reading tracker\n- 3D body progress page\n- AI chat assistant\n- Feature registry\n- Agent run dashboard"
        );
        setUiStyle(
            "Dark premium dashboard. Clean cards. Purple/cyan accent. 3D cute agent avatars later. Simple sidebar, not cluttered."
        );
        setBackendNeeds(
            "Local-first data. SQLite for now. Ask before Supabase or cloud database. Private reports should stay local."
        );
        setPrivateRules(
            "This is personal-only. No public SaaS. No community features. No public profiles. Agents must ask before database, API, local model, deployment, or private data connection."
        );
        setAgentQuestions(
            "Ask me before choosing database. Ask me before using paid APIs. Ask me before changing dashboard structure. Ask me before connecting local LLM. Ask me before uploading private data."
        );
    };

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050816] p-6 text-white">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-white/[0.04] to-cyan-500/10 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                                Agent Brief
                            </p>
                            <h1 className="mt-2 text-3xl font-black">
                                Tell your agents what to build
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm text-slate-400">
                                Give your app idea, features, UI style, backend needs, and rules. This saves to memory and creates feature registry items.
                            </p>
                        </div>

                        <button
                            onClick={loadExample}
                            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                        >
                            Load Example
                        </button>
                    </div>
                </section>

                {result && (
                    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
                        {result}
                    </div>
                )}

                <section className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
                    <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                App Name
                            </label>
                            <input
                                value={appName}
                                onChange={(event) => setAppName(event.target.value)}
                                placeholder="Example: Personal AI Health Tracker"
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                App Idea
                            </label>
                            <textarea
                                value={appIdea}
                                onChange={(event) => setAppIdea(event.target.value)}
                                placeholder="Explain the full app idea here..."
                                rows={6}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                Main Features
                            </label>
                            <textarea
                                value={mainFeatures}
                                onChange={(event) => setMainFeatures(event.target.value)}
                                placeholder="- Feature 1&#10;- Feature 2&#10;- Feature 3"
                                rows={8}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                UI Style
                            </label>
                            <textarea
                                value={uiStyle}
                                onChange={(event) => setUiStyle(event.target.value)}
                                placeholder="Dark, clean, premium, mobile responsive..."
                                rows={4}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                            <h2 className="text-xl font-bold">Agent Rules</h2>

                            <div className="mt-4">
                                <label className="text-sm font-semibold text-slate-300">
                                    Backend / Database Needs
                                </label>
                                <textarea
                                    value={backendNeeds}
                                    onChange={(event) => setBackendNeeds(event.target.value)}
                                    rows={4}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                                />
                            </div>

                            <div className="mt-4">
                                <label className="text-sm font-semibold text-slate-300">
                                    Private Rules
                                </label>
                                <textarea
                                    value={privateRules}
                                    onChange={(event) => setPrivateRules(event.target.value)}
                                    rows={4}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                                />
                            </div>

                            <div className="mt-4">
                                <label className="text-sm font-semibold text-slate-300">
                                    Questions agents must ask first
                                </label>
                                <textarea
                                    value={agentQuestions}
                                    onChange={(event) => setAgentQuestions(event.target.value)}
                                    rows={4}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                                />
                            </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                            <h2 className="text-xl font-bold">Save Targets</h2>

                            <div className="mt-4 space-y-3 text-sm text-slate-300">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={saveLong}
                                        onChange={(event) => setSaveLong(event.target.checked)}
                                    />
                                    Save to Long Memory
                                </label>

                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={saveShort}
                                        onChange={(event) => setSaveShort(event.target.checked)}
                                    />
                                    Save to Short Memory
                                </label>

                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={addFeatures}
                                        onChange={(event) => setAddFeatures(event.target.checked)}
                                    />
                                    Add features to Feature Registry
                                </label>
                            </div>

                            <button
                                onClick={saveBrief}
                                disabled={loading}
                                className="mt-5 w-full rounded-2xl bg-violet-600 px-5 py-4 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50"
                            >
                                {loading ? "Saving..." : "Save Agent Brief"}
                            </button>
                            <button
                                onClick={askAgentTeam}
                                disabled={loadingDecision}
                                className="mt-3 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                                {loadingDecision ? "Asking Agent Team..." : "Ask Agent Team"}
                            </button>


                            <div className="mt-4 grid gap-2">
                                <Link
                                    href="/features"
                                    className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-semibold hover:bg-white/15"
                                >
                                    Open Feature Registry
                                </Link>

                                <Link
                                    href="/long-memory"
                                    className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-semibold hover:bg-white/15"
                                >
                                    Open Long Memory
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
                {decision && (
                    <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                        <h2 className="text-xl font-bold text-emerald-200">
                            Agent Team Decision
                        </h2>
                        <pre className="mt-5 max-h-[70vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-5 font-mono text-sm leading-7 text-slate-200">
                            {decision}
                        </pre>
                    </section>
                )}    </div>
        </div>
    );
}


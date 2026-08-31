"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function ProjectBrainPage() {
    const [appMission, setAppMission] = useState("");
    const [userRules, setUserRules] = useState("");
    const [agentRules, setAgentRules] = useState("");
    const [privacyRules, setPrivacyRules] = useState("");
    const [uiDesignRules, setUiDesignRules] = useState("");
    const [currentTechStack, setCurrentTechStack] = useState("");
    const [currentPages, setCurrentPages] = useState("");
    const [currentBackendRoutes, setCurrentBackendRoutes] = useState("");
    const [featureRoadmap, setFeatureRoadmap] = useState("");
    const [completedWork, setCompletedWork] = useState("");
    const [blockedWork, setBlockedWork] = useState("");
    const [nextActions, setNextActions] = useState("");

    const [saveToLongMemory, setSaveToLongMemory] = useState(true);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [savedPreview, setSavedPreview] = useState("");

    const parseProjectBrain = (content: string) => {
        const getSection = (title: string) => {
            const regex = new RegExp(
                `## ${title}\\n([\\s\\S]*?)(?=\\n## |$)`,
                "i"
            );
            const match = content.match(regex);
            return match ? match[1].trim() : "";
        };

        setAppMission(getSection("App Mission"));
        setUserRules(getSection("User Rules"));
        setAgentRules(getSection("Agent Rules"));
        setPrivacyRules(getSection("Privacy Rules"));
        setUiDesignRules(getSection("UI Design Rules"));
        setCurrentTechStack(getSection("Current Tech Stack"));
        setCurrentPages(getSection("Current Pages"));
        setCurrentBackendRoutes(getSection("Current Backend Routes"));
        setFeatureRoadmap(getSection("Feature Roadmap"));
        setCompletedWork(getSection("Completed Work"));
        setBlockedWork(getSection("Blocked Work"));
        setNextActions(getSection("Next Actions"));
    };

    const loadProjectBrain = async () => {
        try {
            setMessage("");

            const response = await fetch(`${API_BASE}/project-brain`);
            const data = await response.json();

            if (data.ok && data.content) {
                parseProjectBrain(data.content);
                setSavedPreview(data.content);
            }
        } catch {
            setMessage("Backend not reachable. Start FastAPI on port 8000.");
        }
    };

    useEffect(() => {
        loadProjectBrain();
    }, []);

    const loadStarterBrain = () => {
        setAppMission(
            "Build a private local-first AI Agent OS that helps Devendra plan, design, code, test, and manage his personal apps. The first major app is a Personal AI Health Tracker."
        );

        setUserRules(
            "- Personal-only app\n- No public SaaS\n- No community features\n- No public profiles\n- Keep UI clean and not cluttered\n- Ask before risky decisions"
        );

        setAgentRules(
            "- Product Manager breaks ideas into features\n- UI/UX Designer creates clean premium UI rules\n- Frontend Developer builds pages and components\n- Backend Developer builds safe APIs\n- QA Tester checks errors and broken flows\n- Reviewer checks final quality\n- Agents must ask before database, APIs, local model, deployment, or private data connections"
        );

        setPrivacyRules(
            "- Private health files must stay local\n- Medical reports must not upload to cloud automatically\n- Body photos and personal data need explicit permission\n- Ask before using Supabase, cloud APIs, or external storage"
        );

        setUiDesignRules(
            "- Dark premium dashboard\n- Purple/cyan accent\n- Clean card layout\n- Collapsible sidebar like ChatGPT\n- No giant empty spaces\n- Pages must be mobile responsive\n- Future 3D cute panda agent avatars"
        );

        setCurrentTechStack(
            "- Frontend: Next.js app router\n- Styling: Tailwind CSS\n- Backend: FastAPI\n- Memory: Markdown files + SQLite\n- AI API: NVIDIA NIM OpenAI-compatible API\n- Local-first storage for private data"
        );

        setCurrentPages(
            "- / dashboard\n- /agent-brief\n- /project-brain\n- /features\n- /page-builder\n- /ui-references\n- /generated\n- /chat\n- /long-memory\n- /short-memory\n- /agent-workspace-safe-test"
        );

        setCurrentBackendRoutes(
            "- GET /health\n- GET /features\n- POST /features\n- PUT /features/{feature_id}\n- DELETE /features/{feature_id}\n- GET /memory/long-term\n- GET /memory/short-term\n- POST /memory/write\n- POST /agent-brief/save\n- GET /project-brain\n- POST /project-brain\n- POST /agents/decide\n- POST /control/start\n- POST /control/stop\n- POST /control/resume\n- POST /control/archive\n- POST /control/scan-memory"
        );

        setFeatureRoadmap(
            "- Clean dashboard control center\n- Feature Registry management\n- Agent Brief save flow\n- Project Brain memory\n- Ask Agent Team planning\n- Decision Reports page\n- Backup and rollback before installing generated pages\n- Better page generator validation\n- 3D agent avatar UI later"
        );

        setCompletedWork(
            "- GitHub repos created\n- Frontend pushed\n- Backend pushed\n- Sidebar cleaned\n- Sidebar collapsible\n- Dashboard page improved\n- Feature Registry backend working\n- Agent Brief page created\n- Long and short memory pages created"
        );

        setBlockedWork(
            "- Need confirm /agents/decide works with NVIDIA key\n- Need decision reports visible in frontend\n- Need project brain connected to all agent prompts\n- Need backup/rollback before installing generated pages"
        );

        setNextActions(
            "- Save Project Brain\n- Test /project-brain backend route\n- Test Ask Agent Team\n- Show saved decision reports\n- Add Project Brain to agent memory context\n- Commit frontend and backend changes to GitHub"
        );
    };

    const saveProjectBrain = async () => {
        try {
            setLoading(true);
            setMessage("");
            setSavedPreview("");

            const response = await fetch(`${API_BASE}/project-brain`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    app_mission: appMission,
                    user_rules: userRules,
                    agent_rules: agentRules,
                    privacy_rules: privacyRules,
                    ui_design_rules: uiDesignRules,
                    current_tech_stack: currentTechStack,
                    current_pages: currentPages,
                    current_backend_routes: currentBackendRoutes,
                    feature_roadmap: featureRoadmap,
                    completed_work: completedWork,
                    blocked_work: blockedWork,
                    next_actions: nextActions,
                    save_to_long_memory: saveToLongMemory,
                }),
            });

            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || "Failed to save Project Brain.");
                return;
            }

            setMessage("Project Brain saved successfully.");
            setSavedPreview(data.content || "");
        } catch {
            setMessage("Backend not reachable. Start FastAPI on port 8000.");
        } finally {
            setLoading(false);
        }
    };

    const fieldClass =
        "mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm leading-6 text-slate-200 outline-none focus:border-violet-500";

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050816] p-6 text-white">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-white/[0.04] to-cyan-500/10 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                                Project Brain
                            </p>
                            <h1 className="mt-2 text-3xl font-black">
                                Main memory for your AI Agent OS
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm text-slate-400">
                                Write your full app mission, features, rules, tech stack, completed work, blocked work, and next actions. Agents will use this as the main project brain.
                            </p>
                        </div>

                        <button
                            onClick={loadStarterBrain}
                            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                        >
                            Load Starter Brain
                        </button>
                    </div>
                </section>

                {message && (
                    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
                        {message}
                    </div>
                )}

                <section className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
                    <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                App Mission
                            </label>
                            <textarea
                                value={appMission}
                                onChange={(event) => setAppMission(event.target.value)}
                                rows={5}
                                placeholder="Write the main purpose of the app..."
                                className={fieldClass}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                Feature Roadmap
                            </label>
                            <textarea
                                value={featureRoadmap}
                                onChange={(event) => setFeatureRoadmap(event.target.value)}
                                rows={8}
                                placeholder="- Feature 1&#10;- Feature 2&#10;- Feature 3"
                                className={fieldClass}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                User Rules
                            </label>
                            <textarea
                                value={userRules}
                                onChange={(event) => setUserRules(event.target.value)}
                                rows={5}
                                className={fieldClass}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                Agent Rules
                            </label>
                            <textarea
                                value={agentRules}
                                onChange={(event) => setAgentRules(event.target.value)}
                                rows={6}
                                className={fieldClass}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                Privacy Rules
                            </label>
                            <textarea
                                value={privacyRules}
                                onChange={(event) => setPrivacyRules(event.target.value)}
                                rows={5}
                                className={fieldClass}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                UI Design Rules
                            </label>
                            <textarea
                                value={uiDesignRules}
                                onChange={(event) => setUiDesignRules(event.target.value)}
                                rows={5}
                                className={fieldClass}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                            <h2 className="text-xl font-bold">System State</h2>

                            <div className="mt-4">
                                <label className="text-sm font-semibold text-slate-300">
                                    Current Tech Stack
                                </label>
                                <textarea
                                    value={currentTechStack}
                                    onChange={(event) => setCurrentTechStack(event.target.value)}
                                    rows={5}
                                    className={fieldClass}
                                />
                            </div>

                            <div className="mt-4">
                                <label className="text-sm font-semibold text-slate-300">
                                    Current Pages
                                </label>
                                <textarea
                                    value={currentPages}
                                    onChange={(event) => setCurrentPages(event.target.value)}
                                    rows={6}
                                    className={fieldClass}
                                />
                            </div>

                            <div className="mt-4">
                                <label className="text-sm font-semibold text-slate-300">
                                    Current Backend Routes
                                </label>
                                <textarea
                                    value={currentBackendRoutes}
                                    onChange={(event) => setCurrentBackendRoutes(event.target.value)}
                                    rows={6}
                                    className={fieldClass}
                                />
                            </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                            <h2 className="text-xl font-bold">Progress</h2>

                            <div className="mt-4">
                                <label className="text-sm font-semibold text-slate-300">
                                    Completed Work
                                </label>
                                <textarea
                                    value={completedWork}
                                    onChange={(event) => setCompletedWork(event.target.value)}
                                    rows={5}
                                    className={fieldClass}
                                />
                            </div>

                            <div className="mt-4">
                                <label className="text-sm font-semibold text-slate-300">
                                    Blocked Work
                                </label>
                                <textarea
                                    value={blockedWork}
                                    onChange={(event) => setBlockedWork(event.target.value)}
                                    rows={5}
                                    className={fieldClass}
                                />
                            </div>

                            <div className="mt-4">
                                <label className="text-sm font-semibold text-slate-300">
                                    Next Actions
                                </label>
                                <textarea
                                    value={nextActions}
                                    onChange={(event) => setNextActions(event.target.value)}
                                    rows={5}
                                    className={fieldClass}
                                />
                            </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                            <h2 className="text-xl font-bold">Save</h2>

                            <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={saveToLongMemory}
                                    onChange={(event) => setSaveToLongMemory(event.target.checked)}
                                />
                                Also sync to Long-Term Memory
                            </label>

                            <button
                                onClick={saveProjectBrain}
                                disabled={loading}
                                className="mt-5 w-full rounded-2xl bg-violet-600 px-5 py-4 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50"
                            >
                                {loading ? "Saving..." : "Save Project Brain"}
                            </button>

                            <div className="mt-4 grid gap-2">
                                <Link
                                    href="/long-memory"
                                    className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-semibold hover:bg-white/15"
                                >
                                    Open Long Memory
                                </Link>

                                <Link
                                    href="/agent-brief"
                                    className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-semibold hover:bg-white/15"
                                >
                                    Open Agent Brief
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {savedPreview && (
                    <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                        <h2 className="text-xl font-bold text-emerald-200">
                            Saved Project Brain Preview
                        </h2>
                        <pre className="mt-5 max-h-[70vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-5 font-mono text-sm leading-7 text-slate-200">
                            {savedPreview}
                        </pre>
                    </section>
                )}
            </div>
        </div>
    );
}

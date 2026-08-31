"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type ChecklistItem = {
    id: string;
    category: string;
    title: string;
    description: string;
    done: boolean;
};

export default function CloudDeployPage() {
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [progress, setProgress] = useState(0);
    const [doneCount, setDoneCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [readyForCloud, setReadyForCloud] = useState(false);
    const [message, setMessage] = useState("");
    const [loadingItem, setLoadingItem] = useState("");

    const loadChecklist = async () => {
        try {
            setMessage("");

            const response = await fetch(`${API_BASE}/cloud-deploy/checklist`);
            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || "Failed to load cloud checklist.");
                return;
            }

            setItems(data.items || []);
            setProgress(data.progress || 0);
            setDoneCount(data.done_count || 0);
            setTotalCount(data.total_count || 0);
            setReadyForCloud(Boolean(data.ready_for_cloud));
        } catch {
            setMessage("Backend not reachable. Start FastAPI on port 8000.");
        }
    };

    const updateItem = async (itemId: string, done: boolean) => {
        try {
            setLoadingItem(itemId);
            setMessage("");

            const response = await fetch(`${API_BASE}/cloud-deploy/checklist`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    item_id: itemId,
                    done,
                }),
            });

            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || "Failed to update checklist.");
                return;
            }

            setItems(data.items || []);
            setProgress(data.progress || 0);
            setDoneCount(data.done_count || 0);
            setTotalCount(data.total_count || 0);
            setReadyForCloud(Boolean(data.ready_for_cloud));
        } catch {
            setMessage("Could not update checklist.");
        } finally {
            setLoadingItem("");
        }
    };

    const resetChecklist = async () => {
        const approved = window.confirm("Reset cloud deploy checklist?");
        if (!approved) return;

        try {
            setMessage("");

            await fetch(`${API_BASE}/cloud-deploy/checklist/reset`, {
                method: "POST",
            });

            await loadChecklist();
            setMessage("Checklist reset.");
        } catch {
            setMessage("Could not reset checklist.");
        }
    };

    useEffect(() => {
        loadChecklist();
    }, []);

    const categories = Array.from(new Set(items.map((item) => item.category)));

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050816] p-6 text-white">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-600/20 via-white/[0.04] to-violet-500/10 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
                                Cloud Deploy
                            </p>
                            <h1 className="mt-2 text-3xl font-black">
                                Cloud readiness checklist
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm text-slate-400">
                                Before deploying agents to cloud, complete safety, GitHub, backend, frontend, and memory checks.
                            </p>
                        </div>

                        <button
                            onClick={loadChecklist}
                            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                        >
                            Refresh
                        </button>
                    </div>
                </section>

                {message && (
                    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
                        {message}
                    </div>
                )}

                <section className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                        <p className="text-sm text-slate-400">Progress</p>
                        <p className="mt-2 text-3xl font-black text-cyan-300">
                            {progress}%
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                        <p className="text-sm text-slate-400">Completed</p>
                        <p className="mt-2 text-3xl font-black text-emerald-300">
                            {doneCount}/{totalCount}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:col-span-2">
                        <p className="text-sm text-slate-400">Deploy Status</p>
                        <p
                            className={`mt-2 text-2xl font-black ${readyForCloud ? "text-emerald-300" : "text-amber-300"
                                }`}
                        >
                            {readyForCloud ? "Ready for cloud" : "Not ready yet"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            Recommended: reach 90%+ before deploying agents.
                        </p>
                    </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                    <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                        <div
                            className="h-full bg-cyan-500 transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </section>

                <section className="space-y-6">
                    {categories.map((category) => (
                        <div
                            key={category}
                            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
                        >
                            <h2 className="text-xl font-bold">{category}</h2>

                            <div className="mt-5 grid gap-3 md:grid-cols-2">
                                {items
                                    .filter((item) => item.category === category)
                                    .map((item) => (
                                        <label
                                            key={item.id}
                                            className={`flex cursor-pointer gap-4 rounded-2xl border p-4 transition-all ${item.done
                                                    ? "border-emerald-500/30 bg-emerald-500/10"
                                                    : "border-white/10 bg-black/20 hover:bg-white/[0.06]"
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={item.done}
                                                disabled={loadingItem === item.id}
                                                onChange={(event) =>
                                                    updateItem(item.id, event.target.checked)
                                                }
                                                className="mt-1"
                                            />

                                            <div>
                                                <p className="font-semibold text-slate-100">
                                                    {item.title}
                                                </p>
                                                <p className="mt-1 text-sm leading-6 text-slate-400">
                                                    {item.description}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                            </div>
                        </div>
                    ))}
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                    <h2 className="text-xl font-bold">Important deploy rule</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-400">
                        Deploy dashboard first. Deploy autonomous cloud agents only after
                        Project Brain, Ask Agent Team, Decision Reports, Safe Install,
                        rollback, and environment security are working locally.
                    </p>

                    <button
                        onClick={resetChecklist}
                        className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20"
                    >
                        Reset Checklist
                    </button>
                </section>
            </div>
        </div>
    );
}

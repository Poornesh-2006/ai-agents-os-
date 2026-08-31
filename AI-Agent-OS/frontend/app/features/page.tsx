"use client";

import React, { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type FeatureStatus = "planned" | "building" | "done" | "error";
type FeaturePriority = "low" | "medium" | "high";

type Feature = {
    id: string;
    name: string;
    description: string;
    status: FeatureStatus;
    priority: FeaturePriority;
    owner_agent: string;
    frontend_file: string;
    backend_route: string;
    database_needed: boolean;
    notes: string;
};

type FeaturesResponse = {
    ok: boolean;
    total: number;
    summary: {
        done: number;
        building: number;
        planned: number;
        error: number;
    };
    features: Feature[];
};

const emptyFeature = {
    name: "",
    description: "",
    status: "planned" as FeatureStatus,
    priority: "medium" as FeaturePriority,
    owner_agent: "Product Manager",
    frontend_file: "",
    backend_route: "",
    database_needed: false,
    notes: "",
};

export default function FeaturesPage() {
    const [features, setFeatures] = useState<Feature[]>([]);
    const [summary, setSummary] = useState({
        done: 0,
        building: 0,
        planned: 0,
        error: 0,
    });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [newFeature, setNewFeature] = useState(emptyFeature);
    const [filter, setFilter] = useState<"all" | FeatureStatus>("all");

    const filteredFeatures = useMemo(() => {
        if (filter === "all") return features;
        return features.filter((feature) => feature.status === filter);
    }, [features, filter]);

    const total = features.length;

    const completionPercent = useMemo(() => {
        if (total === 0) return 0;
        return Math.round((summary.done / total) * 100);
    }, [summary.done, total]);

    const loadFeatures = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/features`);
            const data: FeaturesResponse = await response.json();

            if (!data.ok) {
                setMessage("Failed to load features.");
                return;
            }

            setFeatures(data.features || []);
            setSummary(data.summary || { done: 0, building: 0, planned: 0, error: 0 });
            setMessage("");
        } catch (error) {
            setMessage("Backend not reachable. Start FastAPI on port 8000.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFeatures();
    }, []);

    const createFeature = async () => {
        if (!newFeature.name.trim()) {
            setMessage("Feature name is required.");
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/features`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newFeature),
            });

            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || "Failed to create feature.");
                return;
            }

            setNewFeature(emptyFeature);
            setMessage("Feature created successfully.");
            await loadFeatures();
        } catch (error) {
            setMessage("Failed to create feature. Check backend.");
        }
    };

    const updateFeatureStatus = async (featureId: string, status: FeatureStatus) => {
        try {
            const response = await fetch(`${API_BASE}/features/${featureId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status }),
            });

            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || "Failed to update feature.");
                return;
            }

            setMessage("Feature status updated.");
            await loadFeatures();
        } catch (error) {
            setMessage("Failed to update feature. Check backend.");
        }
    };

    const deleteFeature = async (featureId: string) => {
        const confirmDelete = window.confirm("Delete this feature?");
        if (!confirmDelete) return;

        try {
            const response = await fetch(`${API_BASE}/features/${featureId}`, {
                method: "DELETE",
            });

            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || "Failed to delete feature.");
                return;
            }

            setMessage("Feature deleted.");
            await loadFeatures();
        } catch (error) {
            setMessage("Failed to delete feature. Check backend.");
        }
    };

    const getStatusClass = (status: FeatureStatus) => {
        if (status === "done") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
        if (status === "building") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
        if (status === "error") return "border-red-500/30 bg-red-500/10 text-red-300";
        return "border-slate-500/30 bg-slate-500/10 text-slate-300";
    };

    const getPriorityClass = (priority: FeaturePriority) => {
        if (priority === "high") return "text-red-300 bg-red-500/10 border-red-500/30";
        if (priority === "medium") return "text-amber-300 bg-amber-500/10 border-amber-500/30";
        return "text-sky-300 bg-sky-500/10 border-sky-500/30";
    };

    return (
        <div className="min-h-screen bg-[#0B0F19] text-white">
            <div className="border-b border-white/10 bg-[#0D1117] px-6 py-5">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Feature Registry</h1>
                        <p className="mt-1 text-sm text-slate-400">
                            Track every dashboard feature, agent task, backend route, and page status.
                        </p>
                    </div>

                    <button
                        onClick={loadFeatures}
                        className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/20"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            <main className="mx-auto max-w-7xl px-6 py-6">
                {message && (
                    <div className="mb-4 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
                        {message}
                    </div>
                )}

                <section className="grid gap-4 md:grid-cols-5">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                        <p className="text-sm text-slate-400">Total</p>
                        <p className="mt-2 text-3xl font-bold">{total}</p>
                    </div>

                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                        <p className="text-sm text-emerald-300">Done</p>
                        <p className="mt-2 text-3xl font-bold">{summary.done}</p>
                    </div>

                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                        <p className="text-sm text-amber-300">Building</p>
                        <p className="mt-2 text-3xl font-bold">{summary.building}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-500/20 bg-slate-500/5 p-5">
                        <p className="text-sm text-slate-300">Planned</p>
                        <p className="mt-2 text-3xl font-bold">{summary.planned}</p>
                    </div>

                    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
                        <p className="text-sm text-red-300">Errors</p>
                        <p className="mt-2 text-3xl font-bold">{summary.error}</p>
                    </div>
                </section>

                <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Completion</p>
                            <p className="mt-1 text-xl font-bold">{completionPercent}% complete</p>
                        </div>
                        <div className="h-3 w-64 overflow-hidden rounded-full bg-slate-800">
                            <div
                                className="h-full rounded-full bg-violet-500"
                                style={{ width: `${completionPercent}%` }}
                            />
                        </div>
                    </div>
                </section>

                <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="text-lg font-bold">Add New Feature</h2>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <input
                            value={newFeature.name}
                            onChange={(event) =>
                                setNewFeature((prev) => ({ ...prev, name: event.target.value }))
                            }
                            placeholder="Feature name"
                            className="rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                        />

                        <input
                            value={newFeature.owner_agent}
                            onChange={(event) =>
                                setNewFeature((prev) => ({ ...prev, owner_agent: event.target.value }))
                            }
                            placeholder="Owner agent"
                            className="rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                        />

                        <select
                            value={newFeature.status}
                            onChange={(event) =>
                                setNewFeature((prev) => ({
                                    ...prev,
                                    status: event.target.value as FeatureStatus,
                                }))
                            }
                            className="rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                        >
                            <option value="planned">Planned</option>
                            <option value="building">Building</option>
                            <option value="done">Done</option>
                            <option value="error">Error</option>
                        </select>

                        <select
                            value={newFeature.priority}
                            onChange={(event) =>
                                setNewFeature((prev) => ({
                                    ...prev,
                                    priority: event.target.value as FeaturePriority,
                                }))
                            }
                            className="rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                        >
                            <option value="low">Low priority</option>
                            <option value="medium">Medium priority</option>
                            <option value="high">High priority</option>
                        </select>

                        <input
                            value={newFeature.frontend_file}
                            onChange={(event) =>
                                setNewFeature((prev) => ({
                                    ...prev,
                                    frontend_file: event.target.value,
                                }))
                            }
                            placeholder="Frontend file, example: app/features/page.tsx"
                            className="rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                        />

                        <input
                            value={newFeature.backend_route}
                            onChange={(event) =>
                                setNewFeature((prev) => ({
                                    ...prev,
                                    backend_route: event.target.value,
                                }))
                            }
                            placeholder="Backend route, example: /features"
                            className="rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                        />

                        <textarea
                            value={newFeature.description}
                            onChange={(event) =>
                                setNewFeature((prev) => ({
                                    ...prev,
                                    description: event.target.value,
                                }))
                            }
                            placeholder="Description"
                            className="md:col-span-2 rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                        />

                        <textarea
                            value={newFeature.notes}
                            onChange={(event) =>
                                setNewFeature((prev) => ({ ...prev, notes: event.target.value }))
                            }
                            placeholder="Notes"
                            className="md:col-span-2 rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                        />
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input
                                type="checkbox"
                                checked={newFeature.database_needed}
                                onChange={(event) =>
                                    setNewFeature((prev) => ({
                                        ...prev,
                                        database_needed: event.target.checked,
                                    }))
                                }
                            />
                            Database needed
                        </label>

                        <button
                            onClick={createFeature}
                            className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
                        >
                            Add Feature
                        </button>
                    </div>
                </section>

                <section className="mt-6">
                    <div className="mb-4 flex flex-wrap gap-2">
                        {(["all", "planned", "building", "done", "error"] as const).map((item) => (
                            <button
                                key={item}
                                onClick={() => setFilter(item)}
                                className={`rounded-xl border px-4 py-2 text-sm capitalize ${filter === item
                                    ? "border-violet-500 bg-violet-500/20 text-violet-200"
                                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                                    }`}
                            >
                                {item}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-400">
                            Loading features...
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredFeatures.map((feature) => (
                                <div
                                    key={feature.id}
                                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-lg font-bold">{feature.name}</h3>
                                                <span
                                                    className={`rounded-full border px-3 py-1 text-xs ${getStatusClass(
                                                        feature.status
                                                    )}`}
                                                >
                                                    {feature.status}
                                                </span>
                                                <span
                                                    className={`rounded-full border px-3 py-1 text-xs ${getPriorityClass(
                                                        feature.priority
                                                    )}`}
                                                >
                                                    {feature.priority}
                                                </span>
                                            </div>

                                            <p className="mt-2 max-w-3xl text-sm text-slate-400">
                                                {feature.description || "No description added."}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <select
                                                value={feature.status}
                                                onChange={(event) =>
                                                    updateFeatureStatus(
                                                        feature.id,
                                                        event.target.value as FeatureStatus
                                                    )
                                                }
                                                className="rounded-xl border border-white/10 bg-[#0B0F19] px-3 py-2 text-sm"
                                            >
                                                <option value="planned">Planned</option>
                                                <option value="building">Building</option>
                                                <option value="done">Done</option>
                                                <option value="error">Error</option>
                                            </select>

                                            <button
                                                onClick={() => deleteFeature(feature.id)}
                                                className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                                        <div className="rounded-xl border border-white/10 bg-[#0B0F19] p-3">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Owner Agent
                                            </p>
                                            <p className="mt-1 text-slate-200">{feature.owner_agent}</p>
                                        </div>

                                        <div className="rounded-xl border border-white/10 bg-[#0B0F19] p-3">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Database
                                            </p>
                                            <p className="mt-1 text-slate-200">
                                                {feature.database_needed ? "Needed" : "Not needed"}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-white/10 bg-[#0B0F19] p-3">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Frontend File
                                            </p>
                                            <p className="mt-1 break-all text-slate-200">
                                                {feature.frontend_file || "Not set"}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-white/10 bg-[#0B0F19] p-3">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Backend Route
                                            </p>
                                            <p className="mt-1 break-all text-slate-200">
                                                {feature.backend_route || "Not set"}
                                            </p>
                                        </div>
                                    </div>

                                    {feature.notes && (
                                        <div className="mt-3 rounded-xl border border-white/10 bg-[#0B0F19] p-3">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Notes
                                            </p>
                                            <p className="mt-1 text-sm text-slate-300">{feature.notes}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

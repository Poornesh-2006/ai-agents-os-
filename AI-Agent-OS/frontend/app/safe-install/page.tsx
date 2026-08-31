"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type BackupItem = {
    file_name: string;
    modified: string;
    size: number;
};

export default function SafeInstallPage() {
    const [generatedFileName, setGeneratedFileName] = useState("");
    const [targetRoute, setTargetRoute] = useState("");
    const [message, setMessage] = useState("");
    const [preview, setPreview] = useState<any>(null);
    const [backups, setBackups] = useState<BackupItem[]>([]);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [loadingInstall, setLoadingInstall] = useState(false);
    const [loadingRollback, setLoadingRollback] = useState("");

    const loadBackups = async () => {
        try {
            const response = await fetch(`${API_BASE}/safe-install/backups`);
            const data = await response.json();

            if (data.ok) {
                setBackups(data.backups || []);
            }
        } catch {
            setMessage("Could not load backups. Check backend.");
        }
    };

    useEffect(() => {
        loadBackups();
    }, []);

    const previewInstall = async () => {
        if (!generatedFileName.trim() || !targetRoute.trim()) {
            setMessage("Generated file name and target route are required.");
            return;
        }

        try {
            setLoadingPreview(true);
            setMessage("");
            setPreview(null);

            const response = await fetch(`${API_BASE}/safe-install/preview`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    generated_file_name: generatedFileName.trim(),
                    target_route: targetRoute.trim(),
                }),
            });

            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || data.error || "Preview failed.");
                return;
            }

            setPreview(data);
            setMessage("Preview ready. Check diff before installing.");
        } catch {
            setMessage("Preview failed. Check backend terminal.");
        } finally {
            setLoadingPreview(false);
        }
    };

    const installPage = async () => {
        if (!preview) {
            setMessage("Preview first before installing.");
            return;
        }

        const approved = window.confirm(
            "Approve install? This will backup old page first, then overwrite target page."
        );

        if (!approved) return;

        try {
            setLoadingInstall(true);
            setMessage("");

            const response = await fetch(`${API_BASE}/safe-install/page`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    generated_file_name: generatedFileName.trim(),
                    target_route: targetRoute.trim(),
                }),
            });

            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || data.error || "Install failed.");
                return;
            }

            setMessage(`Installed safely. Backup: ${data.backup_file}`);
            await loadBackups();
        } catch {
            setMessage("Install failed. Check backend terminal.");
        } finally {
            setLoadingInstall(false);
        }
    };

    const rollback = async (backupFileName: string) => {
        const approved = window.confirm(
            `Rollback using backup: ${backupFileName}?`
        );

        if (!approved) return;

        try {
            setLoadingRollback(backupFileName);
            setMessage("");

            const response = await fetch(`${API_BASE}/safe-install/rollback`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    backup_file_name: backupFileName,
                }),
            });

            const data = await response.json();

            if (!data.ok) {
                setMessage(data.message || data.error || "Rollback failed.");
                return;
            }

            setMessage(data.message || "Rollback complete.");
        } catch {
            setMessage("Rollback failed. Check backend terminal.");
        } finally {
            setLoadingRollback("");
        }
    };

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050816] p-6 text-white">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-white/[0.04] to-cyan-500/10 p-6">
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                        Safe Install
                    </p>
                    <h1 className="mt-2 text-3xl font-black">
                        Backup, compare, install, rollback
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm text-slate-400">
                        Install AI-generated pages safely. Preview changes, approve install, create backup, and rollback if anything breaks.
                    </p>
                </section>

                {message && (
                    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
                        {message}
                    </div>
                )}

                <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                        <h2 className="text-xl font-bold">Install Setup</h2>

                        <div>
                            <label className="text-sm font-semibold text-slate-300">
                                Generated file name
                            </label>
                            <input
                                value={generatedFileName}
                                onChange={(event) => setGeneratedFileName(event.target.value)}
                                placeholder="example: health_dashboard.tsx"
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-4 py-3 text-sm outline-none focus:border-violet-500"
                            />
                            <p className="mt-1 text-xs text-slate-500">
                                This file must exist inside generated/pages.
                            </p>
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
                            <p className="mt-1 text-xs text-slate-500">
                                Example: /health-dashboard installs to app/health-dashboard/page.tsx
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <button
                                onClick={previewInstall}
                                disabled={loadingPreview}
                                className="rounded-2xl bg-violet-600 px-5 py-4 text-sm font-bold hover:bg-violet-500 disabled:opacity-50"
                            >
                                {loadingPreview ? "Previewing..." : "Preview Compare"}
                            </button>

                            <button
                                onClick={installPage}
                                disabled={loadingInstall || !preview}
                                className="rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
                            >
                                {loadingInstall ? "Installing..." : "Approve & Install"}
                            </button>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                        <h2 className="text-xl font-bold">Preview / Diff</h2>

                        <div className="mt-4 max-h-[65vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-5">
                            {!preview ? (
                                <p className="text-sm text-slate-400">
                                    Enter generated file name and target route, then click Preview Compare.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                            <p className="text-xs text-slate-500">Target file</p>
                                            <p className="mt-1 break-words text-sm text-slate-200">
                                                {preview.target_file}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                            <p className="text-xs text-slate-500">Generated file</p>
                                            <p className="mt-1 break-words text-sm text-slate-200">
                                                {preview.generated_file}
                                            </p>
                                        </div>
                                    </div>

                                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-slate-200">
                                        {preview.diff || "No diff. Files may be identical or target file is new."}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold">Rollback Backups</h2>
                            <p className="mt-1 text-sm text-slate-400">
                                Restore an older page if a generated page breaks your app.
                            </p>
                        </div>

                        <button
                            onClick={loadBackups}
                            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                        >
                            Refresh
                        </button>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {backups.length === 0 && (
                            <p className="text-sm text-slate-400">No backups yet.</p>
                        )}

                        {backups.map((backup) => (
                            <div
                                key={backup.file_name}
                                className="rounded-2xl border border-white/10 bg-black/20 p-4"
                            >
                                <p className="break-words font-semibold text-slate-100">
                                    {backup.file_name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {backup.modified} Â· {Math.ceil(backup.size / 1024)} KB
                                </p>

                                <button
                                    onClick={() => rollback(backup.file_name)}
                                    disabled={loadingRollback === backup.file_name}
                                    className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-500 disabled:opacity-50"
                                >
                                    {loadingRollback === backup.file_name
                                        ? "Rolling back..."
                                        : "Rollback"}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

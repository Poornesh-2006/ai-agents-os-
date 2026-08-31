"use client";

import { useEffect, useState } from "react";
import { getAllGeneratedFiles } from "@/lib/api";

const API_BASE_URL = "http://127.0.0.1:8000";

type GeneratedFile = {
    file_name: string;
    category: string;
    file_type: "image" | "text" | "file";
    file_path: string;
    size: number;
    modified: number;
    view_url: string;
};

type GeneratedResponse = {
    ok: boolean;
    generated: Record<string, GeneratedFile[]>;
};

const categoryLabels: Record<string, string> = {
    designs: "Design Notes",
    pages: "Generated Pages",
    components: "Components",
    ui_images: "UI Images",
    reports: "Reports",
    final_app: "Final App",
};

export default function GeneratedPage() {
    const [data, setData] = useState<GeneratedResponse | null>(null);
    const [selectedCategory, setSelectedCategory] = useState("designs");
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    async function loadGeneratedFiles() {
        setLoading(true);
        setMessage("");

        try {
            const result = await getAllGeneratedFiles();
            setData(result);

            if (!result.ok) {
                setMessage("Failed to load generated files.");
            }
        } catch {
            setMessage("Backend not running or generated API failed.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadGeneratedFiles();
    }, []);

    const files = data?.generated?.[selectedCategory] || [];

    return (
        <main className="min-h-screen bg-slate-950 px-6 py-6 text-white">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Generated Outputs</h1>
                        <p className="mt-2 text-gray-400">
                            View generated design notes, pages, components, reports, and UI images.
                        </p>
                    </div>

                    <button
                        onClick={loadGeneratedFiles}
                        className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-gray-200 hover:bg-white/10"
                    >
                        Refresh
                    </button>
                </div>

                {message && (
                    <div className="mb-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-200">
                        {message}
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                    <aside className="rounded-3xl border border-white/10 bg-white/5 p-5">
                        <h2 className="mb-4 text-lg font-semibold">Categories</h2>

                        <div className="space-y-2">
                            {Object.keys(categoryLabels).map((category) => {
                                const count = data?.generated?.[category]?.length || 0;

                                return (
                                    <button
                                        key={category}
                                        onClick={() => setSelectedCategory(category)}
                                        className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition ${selectedCategory === category
                                                ? "bg-blue-600 text-white"
                                                : "bg-black/30 text-gray-300 hover:bg-white/10"
                                            }`}
                                    >
                                        <span>{categoryLabels[category]}</span>
                                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                        <div className="mb-5">
                            <h2 className="text-xl font-bold">
                                {categoryLabels[selectedCategory]}
                            </h2>
                            <p className="mt-1 text-sm text-gray-400">
                                Folder: generated/{selectedCategory}
                            </p>
                        </div>

                        {loading ? (
                            <div className="rounded-2xl border border-white/10 bg-black/30 p-10 text-center text-gray-400">
                                Loading generated files...
                            </div>
                        ) : files.length === 0 ? (
                            <div className="rounded-2xl border border-white/10 bg-black/30 p-10 text-center text-gray-400">
                                No files found in this category yet.
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {files.map((file) => (
                                    <div
                                        key={`${file.category}-${file.file_name}`}
                                        className="rounded-2xl border border-white/10 bg-black/30 p-4"
                                    >
                                        {file.file_type === "image" ? (
                                            <img
                                                src={`${API_BASE_URL}${file.view_url}`}
                                                alt={file.file_name}
                                                className="mb-3 h-44 w-full rounded-xl object-cover"
                                            />
                                        ) : (
                                            <div className="mb-3 flex h-44 items-center justify-center rounded-xl border border-white/10 bg-slate-900 text-center text-sm text-gray-400">
                                                {file.file_type.toUpperCase()} FILE
                                            </div>
                                        )}

                                        <h3 className="truncate font-semibold">{file.file_name}</h3>

                                        <p className="mt-1 text-xs text-gray-500">
                                            {(file.size / 1024).toFixed(1)} KB
                                        </p>

                                        <a
                                            href={`${API_BASE_URL}${file.view_url}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                                        >
                                            Open File
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}

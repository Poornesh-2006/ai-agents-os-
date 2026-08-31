"use client";

import { useEffect, useState } from "react";
import {
    analyzeUiReferenceImage,
    getUiReferenceImages,
    uploadUiReferenceImage,
} from "@/lib/api";

type UiReferenceImage = {
    file_name: string;
    file_path: string;
    size: number;
    modified: number;
    view_url: string;
};

const API_BASE_URL = "http://127.0.0.1:8000";

export default function UiReferencesPage() {
    const [images, setImages] = useState<UiReferenceImage[]>([]);
    const [selectedImage, setSelectedImage] = useState<UiReferenceImage | null>(
        null
    );
    const [isUploading, setIsUploading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState("");
    const [message, setMessage] = useState("");

    async function loadImages() {
        try {
            const data = await getUiReferenceImages();
            setImages(data.images || []);

            if (!selectedImage && data.images?.length > 0) {
                setSelectedImage(data.images[0]);
            }
        } catch {
            setMessage("Failed to load UI reference images.");
        }
    }

    async function handleUpload(file: File) {
        setIsUploading(true);
        setMessage("");
        setAnalysis("");

        try {
            const result = await uploadUiReferenceImage(file);

            if (!result.ok) {
                setMessage(result.message || "Upload failed.");
                return;
            }

            setMessage("Image uploaded successfully.");
            await loadImages();
        } catch {
            setMessage("Upload failed. Make sure backend is running.");
        } finally {
            setIsUploading(false);
        }
    }

    async function handleAnalyze() {
        if (!selectedImage) {
            setMessage("Select an image first.");
            return;
        }

        setIsAnalyzing(true);
        setMessage("");
        setAnalysis("");

        try {
            const result = await analyzeUiReferenceImage({
                file_name: selectedImage.file_name,
                model: "moonshotai/kimi-k2.6",
                prompt:
                    "Analyze this UI screenshot in detail. Identify layout, colors, typography, spacing, sidebar, header, cards, buttons, input areas, navigation, and all important UI components. Also tell what pages and reusable React Tailwind components are needed to build a similar app. Do not generate final code yet. First create detailed UI notes.",
            });

            if (!result.ok) {
                setMessage(result.message || "Analysis failed.");
                return;
            }

            setAnalysis(result.analysis || "");
            setMessage("Analysis completed and saved to UI style memory.");
        } catch {
            setMessage("Analysis failed. Make sure backend and NVIDIA API are working.");
        } finally {
            setIsAnalyzing(false);
        }
    }

    useEffect(() => {
        loadImages();
    }, []);

    return (
        <main className="min-h-screen bg-slate-950 px-6 py-6 text-white">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold">UI Reference Images</h1>
                    <p className="mt-2 text-gray-400">
                        Upload UI screenshots, analyze them with AI, and save the design
                        notes into memory.
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                    <aside className="rounded-3xl border border-white/10 bg-white/5 p-5">
                        <h2 className="text-lg font-semibold">Upload reference</h2>

                        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/30 px-4 py-10 text-center hover:bg-white/10">
                            <span className="text-4xl">ï¼‹</span>
                            <span className="mt-3 text-sm text-gray-300">
                                Upload UI screenshot
                            </span>
                            <span className="mt-1 text-xs text-gray-500">
                                PNG, JPG, WEBP, GIF
                            </span>

                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    await handleUpload(file);
                                    e.target.value = "";
                                }}
                            />
                        </label>

                        {isUploading && (
                            <p className="mt-3 text-sm text-blue-300">Uploading...</p>
                        )}

                        {message && <p className="mt-3 text-sm text-gray-300">{message}</p>}

                        <div className="mt-6 flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Uploaded images</h2>

                            <button
                                onClick={loadImages}
                                className="rounded-lg border border-white/10 px-3 py-1 text-sm text-gray-300 hover:bg-white/10"
                            >
                                Refresh
                            </button>
                        </div>

                        <div className="mt-4 max-h-[480px] space-y-3 overflow-y-auto">
                            {images.length > 0 ? (
                                images.map((image) => (
                                    <button
                                        key={image.file_name}
                                        onClick={() => {
                                            setSelectedImage(image);
                                            setAnalysis("");
                                            setMessage("");
                                        }}
                                        className={`w-full rounded-2xl border p-3 text-left transition ${selectedImage?.file_name === image.file_name
                                            ? "border-blue-500 bg-blue-500/10"
                                            : "border-white/10 bg-black/30 hover:bg-white/10"
                                            }`}
                                    >
                                        <img
                                            src={`${API_BASE_URL}${image.view_url}`}
                                            alt={image.file_name}
                                            className="h-32 w-full rounded-xl object-cover"
                                        />

                                        <p className="mt-2 truncate text-sm text-white">
                                            {image.file_name}
                                        </p>

                                        <p className="text-xs text-gray-500">
                                            {(image.size / 1024).toFixed(1)} KB
                                        </p>
                                    </button>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500">No UI images uploaded yet.</p>
                            )}
                        </div>
                    </aside>

                    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="text-xl font-bold">Selected UI Reference</h2>
                                <p className="mt-1 text-sm text-gray-400">
                                    Analyze screenshot â†’ save notes â†’ build pages later.
                                </p>
                            </div>

                            <button
                                onClick={handleAnalyze}
                                disabled={!selectedImage || isAnalyzing}
                                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                                {isAnalyzing ? "Analyzing..." : "Analyze with AI"}
                            </button>
                        </div>

                        {selectedImage ? (
                            <div className="mt-6">
                                <img
                                    src={`${API_BASE_URL}${selectedImage.view_url}`}
                                    alt={selectedImage.file_name}
                                    className="max-h-[520px] w-full rounded-2xl border border-white/10 object-contain"
                                />

                                <p className="mt-3 text-sm text-gray-400">
                                    File: {selectedImage.file_name}
                                </p>
                            </div>
                        ) : (
                            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-10 text-center text-gray-400">
                                Upload or select a UI reference image.
                            </div>
                        )}

                        {analysis && (
                            <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-5">
                                <h3 className="mb-3 text-lg font-semibold">AI UI Analysis</h3>

                                <pre className="whitespace-pre-wrap text-sm leading-6 text-gray-200">
                                    {analysis}
                                </pre>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}


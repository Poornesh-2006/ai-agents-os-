"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_MODEL = "moonshotai/kimi-k2.6";

type Mode = "app" | "ui" | "code";

type ChatMessage = {
    id: number;
    role: "user" | "agent";
    agent: string;
    content: string;
};

type UiImage = {
    file_name: string;
    file_path: string;
    size: number;
    modified: number;
    view_url: string;
};

type GeneratedFile = {
    file_name: string;
    category: string;
    file_type: "image" | "text" | "file";
    file_path: string;
    size: number;
    modified: number;
    view_url: string;
};

export default function AiChatDashboardPage() {
    const [mode, setMode] = useState<Mode>("app");
    const [messages, setMessages] = useState<Record<Mode, ChatMessage[]>>({
        app: [
            {
                id: 1,
                role: "agent",
                agent: "App Builder Agent",
                content:
                    "Tell me what app/page you want. I can plan, design, generate pages, and save outputs.",
            },
        ],
        ui: [
            {
                id: 1,
                role: "agent",
                agent: "UI Reference Agent",
                content:
                    "Upload UI screenshots here. I can analyze layout, colors, spacing, components, and save UI memory.",
            },
        ],
        code: [
            {
                id: 1,
                role: "agent",
                agent: "Code Agent Team",
                content:
                    "Frontend Developer and UI/UX Designer can discuss code and design decisions here.",
            },
        ],
    });

    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [uiImages, setUiImages] = useState<UiImage[]>([]);
    const [selectedImage, setSelectedImage] = useState<UiImage | null>(null);
    const [generatedPages, setGeneratedPages] = useState<GeneratedFile[]>([]);
    const [status, setStatus] = useState("");
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const currentMessages = messages[mode];

    const activeAgent = useMemo(() => {
        if (mode === "app") return "All Agents";
        if (mode === "ui") return "UI/UX Designer";
        return "Frontend Developer";
    }, [mode]);

    const activeTitle = useMemo(() => {
        if (mode === "app") return "App Builder Chat";
        if (mode === "ui") return "UI Reference Chat";
        return "Code Agent Chat";
    }, [mode]);

    const activeSubtitle = useMemo(() => {
        if (mode === "app")
            return "Build apps, pages, architecture, features, and agent decisions.";
        if (mode === "ui")
            return "Upload, analyze, add, delete, and learn from UI reference images.";
        return "Frontend Developer + UI/UX Designer decisions for code and layout.";
    }, [mode]);

    function addMessage(targetMode: Mode, message: ChatMessage) {
        setMessages((old) => ({
            ...old,
            [targetMode]: [...old[targetMode], message],
        }));
    }

    function deleteMessage(id: number) {
        setMessages((old) => ({
            ...old,
            [mode]: old[mode].filter((msg) => msg.id !== id),
        }));
    }

    async function copyMessage(content: string) {
        await navigator.clipboard.writeText(content);
        setStatus("Copied message.");
    }

    async function sendToAgent(customPrompt?: string) {
        const text = customPrompt || input.trim();
        if (!text) return;

        const localMode = mode;
        const userMessage: ChatMessage = {
            id: Date.now(),
            role: "user",
            agent: "You",
            content: text,
        };

        addMessage(localMode, userMessage);
        setInput("");
        setLoading(true);
        setStatus("");

        try {
            const res = await fetch(`${API_BASE_URL}/chat/send`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    agent: activeAgent,
                    provider: "NVIDIA NIM",
                    model: DEFAULT_MODEL,
                    message: text,
                    file_name: null,
                    file_content: null,
                    session_id: null,
                }),
            });

            const data = await res.json();

            addMessage(localMode, {
                id: Date.now() + 1,
                role: "agent",
                agent: activeAgent,
                content: data.reply || "No reply received.",
            });
        } catch {
            addMessage(localMode, {
                id: Date.now() + 1,
                role: "agent",
                agent: activeAgent,
                content: "Backend/API error. Check FastAPI and NVIDIA API.",
            });
        } finally {
            setLoading(false);
        }
    }

    async function rethinkMessage(content: string) {
        await sendToAgent(
            `Rethink and improve this answer/request with better decisions:\n\n${content}`
        );
    }

    async function loadUiImages() {
        try {
            const res = await fetch(`${API_BASE_URL}/ui/reference-images`, {
                cache: "no-store",
            });
            const data = await res.json();
            setUiImages(data.images || []);
            if (!selectedImage && data.images?.length > 0) {
                setSelectedImage(data.images[0]);
            }
        } catch {
            setStatus("Failed to load UI reference images.");
        }
    }

    async function uploadUiImage(file: File) {
        const formData = new FormData();
        formData.append("file", file);

        setStatus("Uploading UI image...");

        try {
            const res = await fetch(`${API_BASE_URL}/ui/upload-reference`, {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (!data.ok) {
                setStatus(data.message || "Upload failed.");
                return;
            }

            setStatus("UI image uploaded.");
            await loadUiImages();
        } catch {
            setStatus("Upload failed. Check backend.");
        }
    }

    async function analyzeSelectedImage() {
        if (!selectedImage) {
            setStatus("Select a UI image first.");
            return;
        }

        setLoading(true);
        setStatus("Analyzing UI reference image...");

        try {
            const res = await fetch(`${API_BASE_URL}/ui/analyze-reference`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    file_name: selectedImage.file_name,
                    model: DEFAULT_MODEL,
                    prompt:
                        "Analyze this UI screenshot deeply. Extract layout, colors, typography, spacing, sidebar, cards, tables, charts, buttons, navigation, UX decisions, reusable components, and page-building instructions. Save useful design decisions into memory.",
                }),
            });

            const data = await res.json();

            if (!data.ok) {
                setStatus(data.message || "Analysis failed.");
                return;
            }

            addMessage("ui", {
                id: Date.now(),
                role: "agent",
                agent: "UI Reference Agent",
                content: data.analysis || "Analysis completed.",
            });

            setStatus("UI analysis completed and saved to memory.");
        } catch {
            setStatus("Image analysis failed. Check backend/NVIDIA API.");
        } finally {
            setLoading(false);
        }
    }

    async function deleteUiImage(fileName: string) {
        try {
            const res = await fetch(`${API_BASE_URL}/ui/reference-images/${fileName}`, {
                method: "DELETE",
            });

            const data = await res.json();

            if (!data.ok) {
                setStatus(data.message || "Delete failed.");
                return;
            }

            setStatus("UI image deleted.");
            setSelectedImage(null);
            await loadUiImages();
        } catch {
            setStatus("Delete failed. Make sure delete API is added in backend.");
        }
    }

    async function loadGeneratedPages() {
        try {
            const res = await fetch(`${API_BASE_URL}/generated/all`, {
                cache: "no-store",
            });

            const data = await res.json();
            setGeneratedPages(data.generated?.pages || []);
        } catch {
            setStatus("Failed to load generated pages.");
        }
    }

    function routeFromFileName(fileName: string) {
        return (
            "/" +
            fileName
                .replace(".tsx", "")
                .replaceAll("_", "-")
                .replaceAll(" ", "-")
                .toLowerCase()
        );
    }

    useEffect(() => {
        loadUiImages();
        loadGeneratedPages();
    }, []);

    return (
        <main className="min-h-screen bg-slate-950 p-8 text-white">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold">AI Agent Workspace</h1>
                    <p className="mt-3 text-gray-400">
                        App Builder, UI Reference Agent, Code Agent Team, and generated pages in one place.
                    </p>
                </div>

                <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
                    <aside className="space-y-5">
                        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                            <h2 className="text-xl font-semibold">Agent Chats</h2>

                            <div className="mt-4 space-y-3">
                                <button
                                    onClick={() => setMode("app")}
                                    className={`w-full rounded-2xl p-4 text-left ${mode === "app" ? "bg-blue-600" : "bg-black/30 hover:bg-white/10"
                                        }`}
                                >
                                    <div className="font-semibold">App Builder Chat</div>
                                    <div className="mt-1 text-xs text-gray-300">
                                        Product + architecture + pages
                                    </div>
                                </button>

                                <button
                                    onClick={() => setMode("ui")}
                                    className={`w-full rounded-2xl p-4 text-left ${mode === "ui" ? "bg-purple-600" : "bg-black/30 hover:bg-white/10"
                                        }`}
                                >
                                    <div className="font-semibold">UI Reference Chat</div>
                                    <div className="mt-1 text-xs text-gray-300">
                                        Images + design memory
                                    </div>
                                </button>

                                <button
                                    onClick={() => setMode("code")}
                                    className={`w-full rounded-2xl p-4 text-left ${mode === "code" ? "bg-emerald-600" : "bg-black/30 hover:bg-white/10"
                                        }`}
                                >
                                    <div className="font-semibold">Code Agent Chat</div>
                                    <div className="mt-1 text-xs text-gray-300">
                                        Frontend + UI/UX decisions
                                    </div>
                                </button>
                            </div>
                        </section>

                        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">Agent Created Pages</h2>
                                <button
                                    onClick={loadGeneratedPages}
                                    className="rounded-lg border border-white/10 px-3 py-1 text-xs hover:bg-white/10"
                                >
                                    Refresh
                                </button>
                            </div>

                            <div className="mt-4 space-y-3">
                                {generatedPages.length === 0 ? (
                                    <p className="text-sm text-gray-500">No generated pages yet.</p>
                                ) : (
                                    generatedPages.map((page) => (
                                        <div
                                            key={page.file_name}
                                            className="rounded-2xl border border-white/10 bg-black/30 p-3"
                                        >
                                            <div className="truncate text-sm font-semibold">
                                                {page.file_name}
                                            </div>
                                            <div className="mt-2 flex gap-2">
                                                <a
                                                    href={`${API_BASE_URL}${page.view_url}`}
                                                    target="_blank"
                                                    className="rounded-lg bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
                                                >
                                                    Code
                                                </a>
                                                <a
                                                    href={routeFromFileName(page.file_name)}
                                                    target="_blank"
                                                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs hover:bg-blue-500"
                                                >
                                                    Live
                                                </a>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </aside>

                    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h2 className="text-2xl font-bold">{activeTitle}</h2>
                                <p className="mt-1 text-gray-400">{activeSubtitle}</p>
                            </div>

                            <div className="rounded-xl bg-black/40 px-4 py-2 text-sm">
                                {DEFAULT_MODEL}
                            </div>
                        </div>

                        {mode === "ui" && (
                            <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
                                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold">UI Images</h3>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="rounded-lg bg-blue-600 px-3 py-1 text-xs hover:bg-blue-500"
                                        >
                                            Add
                                        </button>
                                    </div>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            await uploadUiImage(file);
                                            e.target.value = "";
                                        }}
                                    />

                                    <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
                                        {uiImages.map((img) => (
                                            <button
                                                key={img.file_name}
                                                onClick={() => setSelectedImage(img)}
                                                className={`w-full rounded-xl border p-2 text-left ${selectedImage?.file_name === img.file_name
                                                        ? "border-blue-500 bg-blue-500/10"
                                                        : "border-white/10 bg-slate-950"
                                                    }`}
                                            >
                                                <img
                                                    src={`${API_BASE_URL}${img.view_url}`}
                                                    className="h-24 w-full rounded-lg object-cover"
                                                    alt={img.file_name}
                                                />
                                                <p className="mt-2 truncate text-xs">{img.file_name}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                    {selectedImage ? (
                                        <>
                                            <img
                                                src={`${API_BASE_URL}${selectedImage.view_url}`}
                                                className="max-h-72 w-full rounded-xl object-contain"
                                                alt={selectedImage.file_name}
                                            />
                                            <div className="mt-4 flex gap-3">
                                                <button
                                                    onClick={analyzeSelectedImage}
                                                    className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500"
                                                >
                                                    Analyze
                                                </button>
                                                <button
                                                    onClick={() => deleteUiImage(selectedImage.file_name)}
                                                    className="rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex h-72 items-center justify-center text-gray-500">
                                            Select or add a UI image.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="mt-6 min-h-[420px] space-y-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                            {currentMessages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`group rounded-2xl p-4 ${msg.role === "user"
                                            ? "ml-auto max-w-3xl bg-blue-600"
                                            : "mr-auto max-w-4xl bg-slate-900"
                                        }`}
                                >
                                    <div className="mb-2 text-xs text-gray-300">{msg.agent}</div>
                                    <div className="whitespace-pre-wrap text-sm leading-6">
                                        {msg.content}
                                    </div>

                                    <div className="mt-3 flex gap-2 opacity-80">
                                        <button
                                            onClick={() => copyMessage(msg.content)}
                                            className="rounded-lg bg-black/30 px-3 py-1 text-xs hover:bg-black/50"
                                        >
                                            Copy
                                        </button>
                                        <button
                                            onClick={() => rethinkMessage(msg.content)}
                                            className="rounded-lg bg-black/30 px-3 py-1 text-xs hover:bg-black/50"
                                        >
                                            Rethink
                                        </button>
                                        <button
                                            onClick={() => deleteMessage(msg.id)}
                                            className="rounded-lg bg-red-500/20 px-3 py-1 text-xs text-red-200 hover:bg-red-500/30"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {loading && (
                                <div className="rounded-2xl bg-slate-900 p-4 text-sm text-gray-400">
                                    Agent thinking...
                                </div>
                            )}
                        </div>

                        <div className="mt-5 flex gap-3">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={
                                    mode === "ui"
                                        ? "image/png,image/jpeg,image/webp,image/gif"
                                        : ".txt,.md,.pdf,.json,.html,.htm,.tsx,.ts,.js,.jsx,.py,.yaml,.yml,image/png,image/jpeg,image/webp"
                                }
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    if (mode === "ui") {
                                        await uploadUiImage(file);
                                        addMessage("ui", {
                                            id: Date.now(),
                                            role: "user",
                                            agent: "You",
                                            content: `Uploaded UI reference image: ${file.name}`,
                                        });
                                    } else {
                                        setStatus("Uploading file...");
                                        try {
                                            const formData = new FormData();
                                            formData.append("file", file);

                                            const uploadRes = await fetch(`${API_BASE_URL}/chat/upload`, {
                                                method: "POST",
                                                body: formData,
                                            });

                                            const uploadData = await uploadRes.json();

                                            if (!uploadData.ok) {
                                                setStatus("File upload failed.");
                                                return;
                                            }

                                            const textToSend =
                                                input.trim() ||
                                                `Analyze this uploaded file/image and help me build the app/page/code from it.`;

                                            addMessage(mode, {
                                                id: Date.now(),
                                                role: "user",
                                                agent: "You",
                                                content: `${textToSend}\n\nAttached file: ${uploadData.file_name}`,
                                            });

                                            setInput("");
                                            setLoading(true);

                                            const chatRes = await fetch(`${API_BASE_URL}/chat/send`, {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type": "application/json",
                                                },
                                                body: JSON.stringify({
                                                    agent: activeAgent,
                                                    provider: "NVIDIA NIM",
                                                    model: DEFAULT_MODEL,
                                                    message: textToSend,
                                                    file_name: uploadData.file_name,
                                                    file_content: uploadData.extracted_text || "",
                                                    session_id: null,
                                                }),
                                            });

                                            const chatData = await chatRes.json();

                                            addMessage(mode, {
                                                id: Date.now() + 1,
                                                role: "agent",
                                                agent: activeAgent,
                                                content: chatData.reply || "No reply received.",
                                            });

                                            setStatus("File sent to agent.");
                                        } catch {
                                            setStatus("File upload/send failed. Check backend.");
                                        } finally {
                                            setLoading(false);
                                        }
                                    }

                                    e.target.value = "";
                                }}
                            />

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-gray-200 hover:bg-white/10"
                            >
                                {mode === "ui" ? "Add Image" : "Attach File"}
                            </button>

                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") sendToAgent();
                                }}
                                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-blue-500"
                                placeholder={`Message ${activeTitle}...`}
                            />

                            <button
                                onClick={() => sendToAgent()}
                                disabled={loading}
                                className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
                            >
                                Send
                            </button>
                        </div>

                        {status && (
                            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-gray-300">
                                {status}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}

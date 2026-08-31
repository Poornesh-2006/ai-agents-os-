"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type MemoryPageProps = {
  title: string;
  subtitle: string;
  endpoint: string;
};

export default function MemoryPage({
  title,
  subtitle,
  endpoint,
}: MemoryPageProps) {
  const [content, setContent] = useState("");
  const [fileStatus, setFileStatus] = useState("Checking...");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const lineCount = useMemo(() => {
    if (!content.trim()) return 0;
    return content.split("\n").length;
  }, [content]);

  const loadMemory = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API_BASE}${endpoint}`);
      const data = await response.json();

      const nextContent =
        data.content ||
        data.memory ||
        data.text ||
        data.data ||
        "";

      const exists =
        data.exists === true ||
        data.file_exists === true ||
        data.ok === true ||
        Boolean(String(nextContent).trim());

      setContent(String(nextContent || ""));
      setFileStatus(exists ? "Found" : "Missing");
    } catch {
      setContent("");
      setFileStatus("Backend offline");
      setMessage("Could not reach backend. Start FastAPI on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemory();
  }, [endpoint]);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#050816] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-white/[0.04] to-cyan-500/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                Memory
              </p>
              <h1 className="mt-2 text-3xl font-black">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                {subtitle}
              </p>
            </div>

            <button
              onClick={loadMemory}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Refresh
            </button>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Memory File</p>
            <p
              className={`mt-2 text-2xl font-black ${
                fileStatus === "Found"
                  ? "text-emerald-300"
                  : fileStatus === "Checking..."
                  ? "text-amber-300"
                  : "text-red-300"
              }`}
            >
              {fileStatus}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Lines</p>
            <p className="mt-2 text-2xl font-black text-violet-300">
              {lineCount}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Characters</p>
            <p className="mt-2 text-2xl font-black text-cyan-300">
              {content.length}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-bold">Content</h2>

          <div className="mt-5 max-h-[65vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-5">
            {loading ? (
              <p className="text-sm text-slate-400">Loading memory...</p>
            ) : content.trim() ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-7 text-slate-200">
                {content}
              </pre>
            ) : (
              <p className="text-sm text-slate-400">
                No memory content found yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


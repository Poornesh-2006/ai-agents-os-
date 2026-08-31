"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

type ActivityItem = {
  category: string;
  file_name: string;
  path: string;
  modified: string;
  size_kb: number;
  extension: string;
};

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadActivity = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API_BASE}/activity/recent`);
      const data = await response.json();

      if (!data.ok) {
        setMessage(data.message || data.error || "Failed to load activity.");
        setItems([]);
        return;
      }

      setItems(data.items || []);
      setUpdatedAt(data.updated_at || "");
    } catch {
      setMessage("Backend not reachable. Start FastAPI on port 8000.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, []);

  const categoryCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  const categoryClass = (category: string) => {
    if (category.includes("Reports")) return "text-violet-300 bg-violet-500/15";
    if (category.includes("Pages")) return "text-cyan-300 bg-cyan-500/15";
    if (category.includes("Designs")) return "text-pink-300 bg-pink-500/15";
    if (category.includes("Backups")) return "text-amber-300 bg-amber-500/15";
    if (category.includes("Memory")) return "text-emerald-300 bg-emerald-500/15";
    return "text-slate-300 bg-slate-500/15";
  };

  return (
    <div className="min-h-screen bg-[#050816] px-8 pb-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-white/[0.04] to-cyan-500/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                Recent Activity
              </p>
              <h1 className="mt-2 text-3xl font-black">
                AI Agent OS Timeline
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                See recent generated pages, reports, memory files, backups, and run outputs.
              </p>
            </div>

            <button
              onClick={loadActivity}
              disabled={loading}
              className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold hover:bg-violet-500 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Activity"}
            </button>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Total Items</p>
            <p className="mt-2 text-3xl font-black text-violet-300">
              {items.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Categories</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">
              {Object.keys(categoryCounts).length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Latest File</p>
            <p className="mt-2 break-words text-xs font-bold text-slate-100">
              {items[0]?.file_name || "No files"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Updated</p>
            <p className="mt-2 text-sm font-bold text-slate-100">
              {updatedAt || "Not loaded"}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-bold">Category Summary</h2>

          <div className="mt-5 flex flex-wrap gap-3">
            {Object.entries(categoryCounts).map(([category, count]) => (
              <span
                key={category}
                className={`rounded-full px-4 py-2 text-xs font-bold ${categoryClass(
                  category
                )}`}
              >
                {category}: {count}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.path}-${index}`}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${categoryClass(
                        item.category
                      )}`}
                    >
                      {item.category}
                    </span>

                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-300">
                      {item.extension}
                    </span>
                  </div>

                  <h2 className="mt-3 break-words text-lg font-bold">
                    {item.file_name}
                  </h2>

                  <p className="mt-2 break-all font-mono text-xs text-slate-500">
                    {item.path}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-slate-300">
                    {item.modified}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.size_kb} KB
                  </p>
                </div>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-sm text-slate-400">
              No activity found yet.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function WorkflowReportPage() {
  const [report, setReport] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadLatestReport = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API_BASE}/agent-workflow/export-report/latest`);
      const data = await response.json();

      if (!data.ok) {
        setMessage(data.message || data.error || "Failed to load report.");
        return;
      }

      setReport(data);
    } catch {
      setMessage("Backend not reachable. Start FastAPI on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API_BASE}/agent-workflow/export-report`, {
        method: "POST",
      });

      const data = await response.json();

      if (!data.ok) {
        setMessage(data.message || data.error || "Export failed.");
        return;
      }

      setReport({
        ok: true,
        found: true,
        file_name: data.file_name,
        preview: data.preview,
      });

      setMessage(data.message || "Workflow report exported.");
    } catch {
      setMessage("Could not export report.");
    } finally {
      setLoading(false);
    }
  };

  const copyReport = async () => {
    if (!report?.preview) return;
    await navigator.clipboard.writeText(report.preview);
    setMessage("Report preview copied.");
  };

  useEffect(() => {
    loadLatestReport();
  }, []);

  return (
    <div className="min-h-screen bg-[#050816] px-8 pb-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-600/20 via-white/[0.04] to-cyan-500/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">
                Workflow Report
              </p>
              <h1 className="mt-2 text-3xl font-black">
                Export agent workflow as a markdown report
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Save the current PM → UI/UX → Frontend → Backend → QA workflow as a reviewable report.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadLatestReport}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>

              <button
                onClick={exportReport}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold hover:bg-amber-500"
              >
                Export Current Workflow
              </button>

              <button
                onClick={copyReport}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold hover:bg-cyan-500"
              >
                Copy Preview
              </button>
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Report Found</p>
            <p className="mt-2 text-2xl font-black text-amber-300">
              {report?.found ? "Yes" : "No"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:col-span-2">
            <p className="text-sm text-slate-400">File Name</p>
            <p className="mt-2 break-words text-sm font-bold text-slate-100">
              {report?.file_name || "No exported workflow report yet"}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-bold">Report Preview</h2>

          <pre className="mt-5 max-h-[70vh] overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/40 p-5 font-mono text-xs leading-6 text-slate-300">
            {report?.preview || "No report preview yet. Click Export Current Workflow."}
          </pre>
        </section>
      </div>
    </div>
  );
}

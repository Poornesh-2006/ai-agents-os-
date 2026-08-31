"use client";

import { useEffect, useState } from "react";
import {
    archiveRun,
    getControlLogs,
    getControlStatus,
    resumeAgents,
    scanMemory,
    startAgents,
    stopAgents,
} from "@/lib/api";

export default function ControlPanel() {
    const [loading, setLoading] = useState("");
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState<any>(null);
    const [logs, setLogs] = useState<string[]>([]);

    async function refreshStatus() {
        try {
            const statusData = await getControlStatus();
            setStatus(statusData);

            try {
                const logsData = await getControlLogs();
                setLogs(logsData.logs || []);
            } catch {
                setLogs([]);
            }
        } catch {
            setStatus({
                running: false,
                message: "Backend status not available",
            });
        }
    }

    useEffect(() => {
        refreshStatus();

        const timer = setInterval(refreshStatus, 2000);

        return () => clearInterval(timer);
    }, []);

    async function runAction(actionName: string, action: () => Promise<any>) {
        try {
            setLoading(actionName);
            setMessage("");

            const result = await action();

            setMessage(result.message || JSON.stringify(result));

            await refreshStatus();
        } catch (error: any) {
            setMessage(error.message || "Something went wrong");
        } finally {
            setLoading("");
        }
    }

    const isRunning = status?.running === true;

    return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Agent Controls</h2>

                    <p className="mt-1 text-sm text-gray-400">
                        Start, resume, archive, scan memory, or stop your CrewAI agents.
                    </p>
                </div>

                <span
                    className={`rounded-full px-4 py-2 text-sm ${isRunning
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-gray-500/20 text-gray-300"
                        }`}
                >
                    {isRunning ? "Agents Running" : "Agents Stopped"}
                </span>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
                <p className="text-sm text-gray-400">Process Status</p>

                <p className="mt-1 text-white">
                    {status?.message || "Loading status..."}
                </p>

                {status?.exit_code !== undefined && (
                    <p className="mt-1 text-sm text-gray-400">
                        Exit code: {status.exit_code}
                    </p>
                )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
                <button
                    onClick={() => runAction("start", startAgents)}
                    disabled={loading !== "" || isRunning}
                    className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                    {loading === "start" ? "Starting..." : "Start Agents"}
                </button>

                <button
                    onClick={() => runAction("resume", resumeAgents)}
                    disabled={loading !== "" || isRunning}
                    className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                >
                    {loading === "resume" ? "Resuming..." : "Resume"}
                </button>

                <button
                    onClick={() => runAction("archive", archiveRun)}
                    disabled={loading !== "" || isRunning}
                    className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                >
                    {loading === "archive" ? "Archiving..." : "Archive"}
                </button>

                <button
                    onClick={() => runAction("memory", scanMemory)}
                    disabled={loading !== "" || isRunning}
                    className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                >
                    {loading === "memory" ? "Scanning..." : "Scan Memory"}
                </button>

                <button
                    onClick={refreshStatus}
                    disabled={loading !== ""}
                    className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                >
                    Refresh Status
                </button>

                <button
                    onClick={() => runAction("stop", stopAgents)}
                    disabled={loading !== "" || !isRunning}
                    className="rounded-xl bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                >
                    {loading === "stop" ? "Stopping..." : "Stop Agents"}
                </button>
            </div>

            {message && (
                <div className="mt-5 rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-gray-200">
                    {message}
                </div>
            )}

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/50 p-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white">Live Command Logs</h3>
                    <p className="text-xs text-gray-500">{logs.length} lines</p>
                </div>

                <pre className="mt-4 max-h-[360px] overflow-auto whitespace-pre-wrap text-sm leading-6 text-green-300">
                    {logs.length > 0
                        ? logs.join("\n")
                        : "No logs yet. Start or resume agents to see live logs."}
                </pre>
            </div>
        </div>
    );
}

import { getHealth } from "@/lib/api";

export default async function SettingsPage() {
    const health = await getHealth();

    return (
        <main className="min-h-screen bg-slate-950 p-8 text-white">
            <a href="/" className="text-blue-400">
                Back to Dashboard
            </a>

            <h1 className="mt-6 text-4xl font-bold">Settings</h1>

            <p className="mt-2 text-gray-400">
                Local dashboard configuration, storage paths, and safety status.
            </p>

            <div className="mt-8 grid gap-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-gray-400">Backend API</p>
                    <h2 className="mt-2 text-2xl font-bold text-green-300">
                        {health.api || "unknown"}
                    </h2>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-gray-400">CrewAI Project Path</p>
                    <p className="mt-2 break-all text-gray-200">
                        {health.crewai_dir}
                    </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-gray-400">Memory Database</p>
                    <h2 className="mt-2 text-xl font-bold">
                        {health.memory_db_exists ? "Ready" : "Missing"}
                    </h2>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-gray-400">Current Run Folder</p>
                    <h2 className="mt-2 text-xl font-bold">
                        {health.current_run_exists ? "Ready" : "Missing"}
                    </h2>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-gray-400">Archive Runs Folder</p>
                    <h2 className="mt-2 text-xl font-bold">
                        {health.runs_dir_exists ? "Ready" : "Missing"}
                    </h2>
                </div>

                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-5">
                    <h2 className="text-xl font-bold text-yellow-300">
                        Safety Mode: Read Only
                    </h2>
                    <p className="mt-2 text-yellow-100">
                        This dashboard currently only reads CrewAI outputs, memory, and logs.
                        It does not start, stop, delete, or modify your CrewAI files.
                    </p>
                </div>
            </div>
        </main>
    );
}

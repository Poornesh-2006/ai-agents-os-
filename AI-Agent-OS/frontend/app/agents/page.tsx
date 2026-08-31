import { getAgentStatus } from "@/lib/api";

export default async function AgentsPage() {
    const data = await getAgentStatus();

    return (
        <main className="min-h-screen bg-slate-950 p-8 text-white">
            <a href="/" className="text-blue-400">
                Back to Dashboard
            </a>

            <h1 className="mt-6 text-4xl font-bold">Agent Status</h1>

            <p className="mt-2 text-gray-400">
                Real-time status of your 8 CrewAI agents.
            </p>

            <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-gray-400">Latest Run</p>

                <h2 className="mt-2 text-2xl font-bold">
                    {data.run?.name || "No run found"}
                </h2>

                <p className="mt-1 text-gray-300">
                    Status: {data.run?.status || "unknown"}
                </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
                {data.agents?.map((agent: any) => (
                    <div
                        key={agent.task_order}
                        className="rounded-xl border border-white/10 bg-white/5 p-5"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-lg font-semibold">
                                Agent {agent.task_order}: {agent.agent_name}
                            </h2>

                            <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm text-green-300">
                                {agent.status}
                            </span>
                        </div>

                        <p className="mt-4 text-sm text-gray-400">Output File</p>

                        <p className="mt-1 break-all text-gray-200">
                            {agent.output_file || "No output file"}
                        </p>

                        {agent.error_message && (
                            <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-red-300">
                                {agent.error_message}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </main>
    );
}


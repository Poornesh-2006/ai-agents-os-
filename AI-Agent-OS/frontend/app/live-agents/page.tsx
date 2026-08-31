import { getAgentStatus } from "@/lib/api";
import AgentToyBoard from "@/components/AgentToyBoard";

export default async function LiveAgentsPage() {
    const data = await getAgentStatus();

    return (
        <section className="min-h-screen bg-slate-950 p-8 text-white">
            <h1 className="text-4xl font-bold">Live Agent Workspace</h1>

            <p className="mt-2 text-gray-400">
                Animated toy agents showing what each CrewAI agent is doing.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-gray-400">Current Run</p>
                <h2 className="mt-2 text-2xl font-bold">
                    {data.run?.name || "No run found"}
                </h2>
                <p className="mt-1 text-gray-300">
                    Status: {data.run?.status || "unknown"}
                </p>
            </div>

            <div className="mt-8">
                <AgentToyBoard agents={data.agents || []} />
            </div>
        </section>
    );
}

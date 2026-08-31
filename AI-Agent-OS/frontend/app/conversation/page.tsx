import { getCurrentOutputsWithContent } from "@/lib/api";

export default async function ConversationPage() {
    const data = await getCurrentOutputsWithContent();

    return (
        <section className="min-h-screen bg-slate-950 p-8 text-white">
            <h1 className="text-4xl font-bold">Agent Conversation</h1>

            <p className="mt-2 text-gray-400">
                See what each CrewAI agent produced in the current run.
            </p>

            <div className="mt-8 space-y-6">
                {data.files?.map((file: any, index: number) => (
                    <div
                        key={file.name}
                        className="rounded-2xl border border-white/10 bg-white/5 p-5"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm text-gray-400">
                                    Agent {index + 1}
                                </p>

                                <h2 className="text-2xl font-bold">
                                    {file.agent_name}
                                </h2>
                            </div>

                            <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm text-green-300">
                                completed
                            </span>
                        </div>

                        <p className="mt-4 text-sm text-gray-400">Output File</p>
                        <p className="mt-1 break-all text-gray-200">{file.name}</p>

                        <div className="mt-5 rounded-xl bg-black/40 p-4">
                            <p className="mb-3 text-sm font-semibold text-blue-300">
                                Message from {file.agent_name}
                            </p>

                            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-sm leading-6 text-gray-200">
                                {file.content}
                            </pre>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

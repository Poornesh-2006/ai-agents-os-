import { getRuns } from "@/lib/api";

export default async function RunsPage() {
    const data = await getRuns();

    return (
        <main className="min-h-screen bg-slate-950 p-8 text-white">
            <a href="/" className="text-blue-400">
                Back to Dashboard
            </a>

            <h1 className="mt-6 text-4xl font-bold">Archived Runs</h1>

            <p className="mt-2 text-gray-400">
                All saved CrewAI runs from your archive folder.
            </p>

            <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-gray-400">Total Archived Runs</p>
                <h2 className="mt-2 text-3xl font-bold">{data.count}</h2>
            </div>

            <div className="mt-8 grid gap-4">
                {data.runs?.map((run: any) => (
                    <div
                        key={run.name}
                        className="rounded-xl border border-white/10 bg-white/5 p-5"
                    >
                        <h2 className="text-xl font-semibold">{run.name}</h2>

                        <p className="mt-3 text-sm text-gray-400">Path</p>
                        <p className="mt-1 break-all text-gray-200">{run.path}</p>

                        <p className="mt-3 text-sm text-gray-400">Files</p>
                        <p className="mt-1 text-gray-200">{run.file_count}</p>
                    </div>
                ))}
            </div>
        </main>
    );
}

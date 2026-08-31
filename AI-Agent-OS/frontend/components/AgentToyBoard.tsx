"use client";

import { useEffect, useMemo, useState } from "react";

type Agent = {
    task_order: number;
    agent_name: string;
    status: string;
    output_file?: string;
};

const toyColors = [
    "from-cyan-400 to-blue-500",
    "from-violet-400 to-purple-600",
    "from-yellow-300 to-orange-500",
    "from-green-400 to-lime-600",
    "from-pink-400 to-rose-500",
    "from-indigo-400 to-purple-700",
    "from-red-400 to-orange-600",
    "from-emerald-400 to-teal-600",
];

function getShortFileName(path?: string) {
    if (!path) return "output file";
    const parts = path.split("\\");
    return parts[parts.length - 1] || path;
}

function getTaskTitle(agent: Agent) {
    const file = getShortFileName(agent.output_file);

    if (agent.status === "completed") return `Completed ${file}`;
    if (agent.status === "running") return `Working on ${agent.agent_name}`;
    if (agent.status === "failed") return `Fix error in ${agent.agent_name}`;

    return `Waiting: ${agent.agent_name}`;
}

function getMessage(agent: Agent) {
    if (agent.status === "completed") {
        return `Done bro âœ… I completed ${getShortFileName(agent.output_file)}.`;
    }

    if (agent.status === "failed") {
        return "I got an error bro âŒ Check the errors page.";
    }

    if (agent.status === "running") {
        return "I am working now... thinking, writing, and building step by step.";
    }

    return "Waiting for my turn...";
}

function statusClass(status: string) {
    if (status === "completed") return "bg-green-500/20 text-green-300";
    if (status === "failed") return "bg-red-500/20 text-red-300";
    if (status === "running") return "bg-blue-500/20 text-blue-300";
    return "bg-yellow-500/20 text-yellow-300";
}

function TypewriterText({ text }: { text: string }) {
    const [visibleText, setVisibleText] = useState("");

    useEffect(() => {
        setVisibleText("");

        let index = 0;

        const timer = setInterval(() => {
            setVisibleText(text.slice(0, index + 1));
            index++;

            if (index >= text.length) {
                clearInterval(timer);
            }
        }, 30);

        return () => clearInterval(timer);
    }, [text]);

    return (
        <p className="min-h-16 break-words text-sm leading-6 text-gray-200">
            {visibleText}
            <span className="animate-pulse text-blue-300">|</span>
        </p>
    );
}

function ToyAgent({
    agent,
    index,
    large = false,
}: {
    agent: Agent;
    index: number;
    large?: boolean;
}) {
    return (
        <div className="relative shrink-0">
            <div
                className={`${large ? "h-52 w-44 rounded-[3.5rem]" : "h-20 w-16 rounded-[1.6rem]"
                    } animate-bounce bg-gradient-to-br ${toyColors[index % toyColors.length]
                    } shadow-2xl`}
            >
                <div className="flex h-full flex-col items-center justify-center">
                    <div className={large ? "flex gap-5" : "flex gap-2"}>
                        <div
                            className={
                                large
                                    ? "h-9 w-9 rounded-full bg-white"
                                    : "h-3.5 w-3.5 rounded-full bg-white"
                            }
                        >
                            <div
                                className={
                                    large
                                        ? "ml-5 mt-3 h-4 w-4 rounded-full bg-black"
                                        : "ml-2 mt-1 h-1.5 w-1.5 rounded-full bg-black"
                                }
                            />
                        </div>

                        <div
                            className={
                                large
                                    ? "h-9 w-9 rounded-full bg-white"
                                    : "h-3.5 w-3.5 rounded-full bg-white"
                            }
                        >
                            <div
                                className={
                                    large
                                        ? "ml-2 mt-3 h-4 w-4 rounded-full bg-black"
                                        : "ml-1 mt-1 h-1.5 w-1.5 rounded-full bg-black"
                                }
                            />
                        </div>
                    </div>

                    <div
                        className={
                            large
                                ? "mt-8 h-7 w-20 rounded-b-full bg-black/70"
                                : "mt-2 h-2.5 w-7 rounded-b-full bg-black/70"
                        }
                    />
                </div>
            </div>

            <div
                className={
                    large
                        ? "absolute -top-3 left-8 h-9 w-2 rotate-[-25deg] rounded-full bg-white/60"
                        : "absolute -top-2 left-2 h-4 w-1 rotate-[-25deg] rounded-full bg-white/60"
                }
            />

            <div
                className={
                    large
                        ? "absolute -top-3 right-8 h-9 w-2 rotate-[25deg] rounded-full bg-white/60"
                        : "absolute -top-2 right-2 h-4 w-1 rotate-[25deg] rounded-full bg-white/60"
                }
            />
        </div>
    );
}

function MiniAgentRow({
    agent,
    index,
}: {
    agent: Agent;
    index: number;
}) {
    return (
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <ToyAgent agent={agent} index={index} />

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                    Agent {agent.task_order}: {agent.agent_name}
                </p>

                <p className="mt-1 truncate text-xs text-gray-400">
                    {getTaskTitle(agent)}
                </p>
            </div>

            <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs ${statusClass(
                    agent.status
                )}`}
            >
                {agent.status}
            </span>
        </div>
    );
}

export default function AgentToyBoard({ agents }: { agents: Agent[] }) {
    const sortedAgents = useMemo(
        () => [...agents].sort((a, b) => a.task_order - b.task_order),
        [agents]
    );

    const activeAgent =
        sortedAgents.find((agent) => agent.status === "running") ||
        sortedAgents.find((agent) => agent.status === "failed") ||
        [...sortedAgents].reverse().find((agent) => agent.status === "completed") ||
        sortedAgents[0];

    const activeIndex = Math.max(
        0,
        sortedAgents.findIndex(
            (agent) => agent.task_order === activeAgent?.task_order
        )
    );

    const beforeAgents = sortedAgents.slice(0, activeIndex);
    const afterAgents = sortedAgents.slice(activeIndex + 1);

    const completedCount = sortedAgents.filter(
        (agent) => agent.status === "completed"
    ).length;

    if (!activeAgent) {
        return (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-gray-300">
                No agents found.
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Top checklist */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            Agent Task Checklist
                        </h2>
                        <p className="mt-1 text-sm text-gray-400">
                            Shows before agent, current focus agent, and next agents.
                        </p>
                    </div>

                    <div className="rounded-full bg-blue-500/20 px-4 py-2 text-sm text-blue-300">
                        {completedCount} / {sortedAgents.length} completed
                    </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {sortedAgents.map((agent) => (
                        <div
                            key={agent.task_order}
                            className={`flex items-center gap-3 rounded-xl border p-3 ${agent.task_order === activeAgent.task_order
                                    ? "border-blue-400 bg-blue-500/20"
                                    : "border-white/10 bg-black/30"
                                }`}
                        >
                            <div
                                className={`flex h-6 w-6 items-center justify-center rounded-md border ${agent.status === "completed"
                                        ? "border-green-400 bg-green-500/30 text-green-200"
                                        : "border-gray-500 bg-white/5 text-gray-400"
                                    }`}
                            >
                                {agent.status === "completed" ? "âœ“" : ""}
                            </div>

                            <p className="line-clamp-2 text-sm text-gray-200">
                                Agent {agent.task_order}: {getShortFileName(agent.output_file)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main 3-column workspace */}
            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.3fr_0.8fr]">
                {/* Before agents */}
                <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-5">
                    <h2 className="text-2xl font-bold text-white">Before Agents</h2>
                    <p className="mt-1 text-sm text-green-200">
                        Agents completed before current focus.
                    </p>

                    <div className="mt-5 max-h-[620px] space-y-3 overflow-auto pr-1">
                        {beforeAgents.length === 0 && (
                            <p className="text-sm text-gray-300">
                                No previous agents before current focus.
                            </p>
                        )}

                        {beforeAgents.map((agent, index) => (
                            <MiniAgentRow
                                key={agent.task_order}
                                agent={agent}
                                index={index}
                            />
                        ))}
                    </div>
                </div>

                {/* Active agent */}
                <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-8 shadow-2xl">
                    <div className="flex flex-col items-center gap-8 text-center">
                        <ToyAgent agent={activeAgent} index={activeIndex} large />

                        <div className="min-w-0">
                            <p className="text-sm text-blue-300">Current Focus Agent</p>

                            <h2 className="mt-2 break-words text-4xl font-bold text-white">
                                Agent {activeAgent.task_order}: {activeAgent.agent_name}
                            </h2>

                            <span
                                className={`mt-4 inline-block rounded-full px-4 py-2 text-sm ${statusClass(
                                    activeAgent.status
                                )}`}
                            >
                                {activeAgent.status}
                            </span>
                        </div>

                        <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-5 text-left">
                            <p className="mb-3 text-sm font-semibold text-blue-300">
                                Live Message
                            </p>

                            <TypewriterText text={getMessage(activeAgent)} />
                        </div>

                        <div className="w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-left">
                            <p className="text-xs text-gray-400">Current task</p>
                            <p className="mt-1 break-words text-gray-100">
                                {getTaskTitle(activeAgent)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* After agents */}
                <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-5">
                    <h2 className="text-2xl font-bold text-white">After Agents</h2>
                    <p className="mt-1 text-sm text-yellow-100">
                        Agents coming after current focus.
                    </p>

                    <div className="mt-5 max-h-[620px] space-y-3 overflow-auto pr-1">
                        {afterAgents.length === 0 && (
                            <p className="text-sm text-gray-300">
                                No agents after current focus.
                            </p>
                        )}

                        {afterAgents.map((agent, index) => (
                            <MiniAgentRow
                                key={agent.task_order}
                                agent={agent}
                                index={activeIndex + index + 1}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

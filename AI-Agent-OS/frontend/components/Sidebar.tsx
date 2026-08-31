"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
    name: string;
    href: string;
    badge?: string;
    icon: string;
};

type NavGroup = {
    title: string;
    items: NavItem[];
};

const navGroups: NavGroup[] = [
    {
        title: "Control",
        items: [
            { name: "Dashboard / Run Agents", href: "/", badge: "Main", icon: "D" },
            { name: "Recent Activity", href: "/activity", badge: "Log", icon: "RA" },
            { name: "Agent Brief", href: "/agent-brief", badge: "Idea", icon: "B" },
            { name: "Task Runner", href: "/task-runner", badge: "Run", icon: "TR" },
            { name: "Agent Assignments", href: "/agent-assignments", badge: "Flow", icon: "AA" },
            { name: "Agent Workflow", href: "/agent-workflow", badge: "Flow", icon: "AW" },
            { name: "Workflow Reports", href: "/workflow-reports", badge: "Report", icon: "WR" },
            { name: "Project Brain", href: "/project-brain", badge: "Brain", icon: "PB" },
            { name: "Project Snapshot", href: "/project-snapshot", badge: "Export", icon: "PS" },
            { name: "Prompt Inspector", href: "/prompt-inspector", badge: "Prompt", icon: "PI" },
            { name: "Decision Reports", href: "/decision-reports", badge: "Plans", icon: "DR" },
            { name: "Agent Workspace", href: "/agent-workspace-safe-test", icon: "W" },
            { name: "Feature Registry", href: "/features", badge: "New", icon: "F" },
        ],
    },
    {
        title: "Build",
        items: [
            { name: "Page Builder", href: "/page-builder", icon: "P" },
            { name: "Workflow Report", href: "/workflow-report", badge: "Report", icon: "WR" },
            { name: "Safe Install", href: "/safe-install", badge: "Safe", icon: "SI" },
            { name: "Generated Outputs", href: "/generated", icon: "G" },
            { name: "UI References", href: "/ui-references", icon: "U" },
            { name: "AI Chat Dashboard", href: "/ai-chat-dashboard", icon: "AI" },
        ],
    },
    {
        title: "Agents",
        items: [
            { name: "Chat", href: "/chat", icon: "C" },
            { name: "Conversation", href: "/conversation", icon: "V" },
            { name: "Git Safety", href: "/git-safety", badge: "Safe", icon: "GS" },
            { name: "Command Center", href: "/command-center", badge: "Cmd", icon: "CC" },
  { name: "Agent File Writer", href: "/agent-file-writer", badge: "Files", icon: "FW" },
  { name: "Generated Files", href: "/generated-files", badge: "Files", icon: "GF" },
  { name: "QA Runner", href: "/qa-runner", badge: "QA", icon: "QA" },
  { name: "Retry Failed", href: "/retry-failed", badge: "Retry", icon: "RF" },
  { name: "Agent Permissions", href: "/agent-permissions", badge: "Safe", icon: "AP" },
  { name: "Real Agents", href: "/real-agents", badge: "AI", icon: "RA" },
  { name: "Agent Chain Runner", href: "/agent-chain-runner", badge: "Chain", icon: "AC" },
            { name: "Live Agents", href: "/live-agents", icon: "L" },
            { name: "Agents", href: "/agents", icon: "A" },
        ],
    },
    {
        title: "Memory",
        items: [
            { name: "Short Memory", href: "/short-memory", icon: "S" },
            { name: "Long Memory", href: "/long-memory", icon: "M" },
        ],
    },
    {
        title: "System",
        items: [
            { name: "Cloud Deploy", href: "/cloud-deploy", badge: "Cloud", icon: "CD" },
            { name: "Outputs", href: "/outputs", icon: "O" },
            { name: "Runs", href: "/runs", icon: "R" },
            { name: "Errors", href: "/errors", icon: "E" },
            { name: "Settings", href: "/settings", icon: "âš™" },
        ],
    },
];

function isActive(pathname: string, href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={`flex h-screen shrink-0 flex-col border-r border-white/10 bg-[#050816] text-white transition-all duration-300 ${collapsed ? "w-20" : "w-72"
                }`}
        >
            <div className="border-b border-white/10 px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                    {!collapsed && (
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">AI Agent OS</h1>
                            <p className="mt-1 text-xs text-slate-500">
                                Devendra Control Center
                            </p>
                        </div>
                    )}

                    {collapsed && (
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600 text-sm font-black">
                            AI
                        </div>
                    )}

                    <button
                        onClick={() => setCollapsed((value) => !value)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                        title={collapsed ? "Open sidebar" : "Close sidebar"}
                    >
                        {collapsed ? "â˜°" : "âŸ¨"}
                    </button>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
                <div className="space-y-5">
                    {navGroups.map((group) => (
                        <div key={group.title}>
                            {!collapsed && (
                                <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                                    {group.title}
                                </p>
                            )}

                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const active = isActive(pathname, item.href);

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            title={collapsed ? item.name : undefined}
                                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active
                                                ? "bg-violet-600/20 text-violet-200 ring-1 ring-violet-500/30"
                                                : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                                                } ${collapsed ? "justify-center" : "justify-between"}`}
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span
                                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-[10px] font-black ${active
                                                        ? "border-violet-400/40 bg-violet-500/20 text-violet-200"
                                                        : "border-white/10 bg-white/[0.04] text-slate-400"
                                                        }`}
                                                >
                                                    {item.icon}
                                                </span>

                                                {!collapsed && (
                                                    <span className="truncate">{item.name}</span>
                                                )}
                                            </div>

                                            {!collapsed && item.badge && (
                                                <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </nav>

            <div className="border-t border-white/10 p-3">
                {collapsed ? (
                    <div
                        className="mx-auto h-3 w-3 rounded-full bg-emerald-400"
                        title="Backend connected"
                    />
                ) : (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                            <p className="text-sm font-semibold text-emerald-300">
                                Backend connected
                            </p>
                        </div>
                        <p className="mt-1 text-xs text-emerald-200/60">
                            FastAPI on port 8000
                        </p>
                    </div>
                )}
            </div>
        </aside>
    );
}


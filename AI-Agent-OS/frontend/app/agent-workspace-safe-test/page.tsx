"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  image?: string;
}

interface AgentPage {
  id: string;
  name: string;
  route: string;
  icon: string;
  createdAt: string;
}

const initialMessages: Record<string, Message[]> = {
  general: [
    {
      id: "1",
      role: "agent",
      content: "Hello! I am your AI agent. How can I help you today?",
      timestamp: "10:30 AM",
    },
    {
      id: "2",
      role: "user",
      content: "I need help building a new dashboard feature.",
      timestamp: "10:31 AM",
    },
    {
      id: "3",
      role: "agent",
      content:
        "Sure. I can help with that. Let me gather the requirements and create a plan for you.",
      timestamp: "10:32 AM",
    },
  ],
  code: [
    {
      id: "4",
      role: "agent",
      content:
        "Code assistant ready. Share your snippets or describe what you need built.",
      timestamp: "11:00 AM",
    },
  ],
  debug: [
    {
      id: "5",
      role: "agent",
      content:
        "Debug mode active. Paste errors or describe issues you are facing.",
      timestamp: "09:15 AM",
    },
  ],
};

const agentPages: AgentPage[] = [
  {
    id: "p0",
    name: "Agent Workspace",
    route: "/agent-workspace-safe-test",
    icon: "HOME",
    createdAt: "Now",
  },
  {
    id: "p1",
    name: "Chat",
    route: "/chat",
    icon: "CHAT",
    createdAt: "Now",
  },
  {
    id: "p2",
    name: "UI References",
    route: "/ui-references",
    icon: "UI",
    createdAt: "Now",
  },
  {
    id: "p3",
    name: "Page Builder",
    route: "/page-builder",
    icon: "BUILD",
    createdAt: "Now",
  },
  {
    id: "p4",
    name: "Generated Outputs",
    route: "/generated",
    icon: "OUT",
    createdAt: "Now",
  },
  {
    id: "p5",
    name: "AI Chat Dashboard",
    route: "/ai-chat-dashboard",
    icon: "AI",
    createdAt: "Now",
  },
];

const chatTabs = [
  { key: "general", label: "General", icon: "GEN" },
  { key: "code", label: "Code", icon: "CODE" },
  { key: "debug", label: "Debug", icon: "BUG" },
];

export default function AgentWorkspaceSafeTest() {
  const [activeTab, setActiveTab] = useState("general");
  const [messages, setMessages] =
    useState<Record<string, Message[]>>(initialMessages);
  const [input, setInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentMessages = messages[activeTab] || [];

  const getTime = () => {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const generateAgentReply = (userMsg: string): string => {
    const lower = userMsg.toLowerCase();

    if (lower.includes("code")) {
      return "I can help with the code. Share the file, error, or feature requirement, and I will break it into safe steps.";
    }

    if (lower.includes("bug") || lower.includes("error")) {
      return "I will debug it. Send the exact terminal error and the file name, then I will tell you what to replace.";
    }

    if (lower.includes("build")) {
      return "Good. I will first create a plan, then generate the UI, then connect backend APIs step by step.";
    }

    return "Understood. I will process this and give you the next best action.";
  };

  const sendMessage = () => {
    if (!input.trim() && !imagePreview) return;

    const userText = input.trim();

    const newMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userText || "Uploaded an image.",
      timestamp: getTime(),
      image: imagePreview || undefined,
    };

    setMessages((prev) => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), newMsg],
    }));

    setInput("");
    setImagePreview(null);

    setTimeout(() => {
      const agentReply: Message = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: generateAgentReply(userText),
        timestamp: getTime(),
      };

      setMessages((prev) => ({
        ...prev,
        [activeTab]: [...(prev[activeTab] || []), agentReply],
      }));
    }, 700);
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const rethinkMessage = (id: string) => {
    setMessages((prev) => {
      const tabMsgs = [...(prev[activeTab] || [])];
      const index = tabMsgs.findIndex((message) => message.id === id);

      if (index !== -1 && tabMsgs[index].role === "agent") {
        tabMsgs[index] = {
          ...tabMsgs[index],
          content:
            "Let me rethink that. A better plan is: first verify the file, then check the exact error, then replace only the broken block safely.",
        };
      }

      return {
        ...prev,
        [activeTab]: tabMsgs,
      };
    });
  };

  const deleteMessage = (id: string) => {
    setMessages((prev) => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).filter(
        (message) => message.id !== id
      ),
    }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0F19] text-gray-100">
      <aside
        className={`${sidebarOpen ? "w-72" : "w-0"
          } flex flex-shrink-0 flex-col overflow-hidden border-r border-gray-800 bg-[#111827] transition-all duration-300`}
      >
        <div className="border-b border-gray-800 px-5 py-5">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-white">Agent</span>
            <span className="text-purple-500">OS</span>
          </h1>
          <p className="mt-1 text-xs text-gray-500">AI Workspace</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Real Pages
          </p>

          <nav className="space-y-1">
            {agentPages.map((page) => (
              <Link
                key={page.id}
                href={page.route}
                className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-300 transition-colors hover:bg-[#1E293B] hover:text-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 bg-[#0B0F19] text-[10px] font-bold text-purple-300">
                  {page.icon}
                </span>

                <div className="min-w-0 flex-1 text-left">
                  <span className="font-medium">{page.name}</span>
                  <p className="truncate text-[10px] text-gray-600 group-hover:text-gray-400">
                    {page.route}
                  </p>
                </div>

                <span className="text-[10px] text-gray-600">
                  {page.createdAt}
                </span>
              </Link>
            ))}
          </nav>

          <div className="mt-6">
            <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Quick Actions
            </p>

            <Link
              href="/page-builder"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-300 transition-colors hover:bg-[#1E293B] hover:text-white"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 bg-[#0B0F19] text-xs font-bold text-purple-300">
                +
              </span>
              <span>New Page</span>
            </Link>

            <Link
              href="/generated"
              className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-300 transition-colors hover:bg-[#1E293B] hover:text-white"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 bg-[#0B0F19] text-xs font-bold text-purple-300">
                F
              </span>
              <span>Open Generated Files</span>
            </Link>
          </div>
        </div>

        <div className="border-t border-gray-800 p-4">
          <div className="rounded-xl bg-gradient-to-br from-purple-600/30 to-pink-600/20 p-4">
            <p className="text-xs font-semibold text-purple-300">
              Agent Status
            </p>
            <p className="mt-1 text-[10px] text-gray-400">
              Backend connected routes ready
            </p>

            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((agent) => (
                <div
                  key={agent}
                  className="h-2 w-2 rounded-full bg-green-500"
                  title={`Agent ${agent}`}
                />
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-800 bg-[#0D1117] px-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-[#1E293B] hover:text-white"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div>
              <h2 className="text-base font-semibold text-white">
                Agent Workspace
              </h2>
              <p className="text-[11px] text-gray-500">
                Safe Test Environment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-[#111827] p-1">
            {chatTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === tab.key
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                  : "text-gray-400 hover:bg-[#1E293B] hover:text-white"
                  }`}
              >
                <span className="text-[10px] font-bold">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
            D
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {currentMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"
                }`}
            >
              <div
                className={`group relative max-w-[70%] rounded-2xl px-5 py-3.5 ${message.role === "user"
                  ? "rounded-br-md border border-purple-500/30 bg-purple-600/20"
                  : "rounded-bl-md border border-gray-800 bg-[#161B2E]"
                  }`}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className={`text-[11px] font-semibold ${message.role === "user"
                      ? "text-purple-400"
                      : "text-cyan-400"
                      }`}
                  >
                    {message.role === "user" ? "You" : "Agent"}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {message.timestamp}
                  </span>
                </div>

                {message.image && (
                  <div className="mb-3">
                    <img
                      src={message.image}
                      alt="Uploaded"
                      className="max-h-48 max-w-full rounded-lg border border-gray-700 object-cover"
                    />
                  </div>
                )}

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">
                  {message.content}
                </p>

                <div className="mt-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => copyMessage(message.id, message.content)}
                    className="rounded-md px-2.5 py-1 text-[11px] text-gray-400 transition-colors hover:bg-[#1E293B] hover:text-white"
                  >
                    {copiedId === message.id ? "Copied!" : "Copy"}
                  </button>

                  {message.role === "agent" && (
                    <button
                      onClick={() => rethinkMessage(message.id)}
                      className="rounded-md px-2.5 py-1 text-[11px] text-gray-400 transition-colors hover:bg-amber-400/10 hover:text-amber-400"
                    >
                      Rethink
                    </button>
                  )}

                  <button
                    onClick={() => deleteMessage(message.id)}
                    className="rounded-md px-2.5 py-1 text-[11px] text-gray-400 transition-colors hover:bg-red-400/10 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {currentMessages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-gray-500">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-800 bg-[#111827] text-sm font-bold text-purple-300">
                AI
              </div>
              <p className="text-lg font-medium">No messages yet</p>
              <p className="mt-1 text-sm">Start a conversation with the agent</p>
            </div>
          )}
        </div>

        {imagePreview && (
          <div className="border-t border-gray-800 bg-[#0D1117] px-6 py-2">
            <div className="flex items-center gap-3">
              <img
                src={imagePreview}
                alt="Preview"
                className="h-16 w-16 rounded-lg border border-gray-700 object-cover"
              />

              <div className="flex-1">
                <p className="text-xs text-gray-400">Image ready to send</p>
              </div>

              <button
                onClick={() => setImagePreview(null)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-500/20 hover:text-red-400"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        <div className="flex-shrink-0 border-t border-gray-800 bg-[#0D1117] px-5 py-4">
          <div className="flex items-end gap-3">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 rounded-xl border border-gray-700 bg-[#161B2E] p-2.5 text-gray-400 transition-colors hover:border-purple-500/50 hover:text-purple-400"
              title="Upload image"
            >
              Image
            </button>

            <div className="relative flex-1">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message in ${chatTabs.find((tab) => tab.key === activeTab)?.label
                  }...`}
                rows={1}
                className="w-full resize-none rounded-xl border border-gray-700 bg-[#161B2E] px-4 py-3 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/20"
              />
            </div>

            <button
              onClick={sendMessage}
              disabled={!input.trim() && !imagePreview}
              className="flex-shrink-0 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Send
            </button>
          </div>

          <p className="mt-2 text-center text-[10px] text-gray-600">
            Agent Workspace Safe Test Â· Press Enter to send Â· Shift+Enter for
            new line
          </p>
        </div>
      </main>
    </div>
  );
}

// END_OF_FILE

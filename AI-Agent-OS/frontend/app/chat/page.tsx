"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteChatSession,
  getChatHistory,
  getChatSessions,
  renameChatSession,
  sendAgentChat,
  uploadChatFile,
} from "@/lib/api";

type ChatMessage = {
  role: "user" | "agent";
  agent: string;
  text: string;
  fileName?: string;
};

type ChatSession = {
  id: number;
  title: string;
  agent: string;
  provider: string;
  model: string;
  created_at: string;
  updated_at: string;
};

const agents = [
  {
    id: "all",
    name: "All Agents",
    icon: "ðŸŒ",
    title: "Agent Team",
    description: "Talk to the full AI crew.",
    character: "ðŸ¤–",
  },
  {
    id: "product",
    name: "Product Manager",
    icon: "ðŸ“‹",
    title: "Product Manager",
    description: "Creates PRD, scope, features, and roadmap.",
    character: "ðŸ¼",
  },
  {
    id: "ui",
    name: "UI/UX Designer",
    icon: "ðŸŽ¨",
    title: "UI/UX Designer",
    description: "Designs pages, layout, user flow, and visual system.",
    character: "ðŸ¦Š",
  },
  {
    id: "frontend",
    name: "Frontend Developer",
    icon: "ðŸ’»",
    title: "Frontend Developer",
    description: "Builds Next.js screens and components.",
    character: "ðŸµ",
  },
  {
    id: "backend",
    name: "Backend Developer",
    icon: "ðŸ”§",
    title: "Backend Developer",
    description: "Builds APIs, backend logic, and server routes.",
    character: "ðŸº",
  },
  {
    id: "database",
    name: "Database Engineer",
    icon: "ðŸ—„ï¸",
    title: "Database Engineer",
    description: "Designs SQLite/Supabase schema and storage.",
    character: "ðŸ¦‰",
  },
  {
    id: "architect",
    name: "System Architect",
    icon: "ðŸ—ï¸",
    title: "System Architect",
    description: "Plans full system architecture and integration.",
    character: "ðŸ¦",
  },
  {
    id: "qa",
    name: "QA Tester",
    icon: "ðŸ§ª",
    title: "QA Tester",
    description: "Finds bugs, tests flows, and validates outputs.",
    character: "ðŸ¸",
  },
  {
    id: "reviewer",
    name: "Project Reviewer",
    icon: "âœ…",
    title: "Project Reviewer",
    description: "Reviews final output and creates improvement notes.",
    character: "ðŸ¯",
  },
];

const providers = ["NVIDIA NIM", "OpenAI", "Gemini", "Claude", "Ollama Local"];

const modelsByProvider: Record<string, string[]> = {
  "NVIDIA NIM": [
    "meta/llama-3.1-70b-instruct",
    "nvidia/nemotron-3-super-120b-a12b",
    "moonshotai/kimi-k2.6",
  ],
  OpenAI: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o"],
  Gemini: ["gemini-2.5-pro", "gemini-2.5-flash"],
  Claude: ["claude-sonnet", "claude-opus"],
  "Ollama Local": ["llama3.1", "qwen2.5", "mistral"],
};

const fileFolders = [
  "Prompt Library",
  "App Builder",
  "Health Tracker",
  "Business Ideas",
  "Study / College",
];

export default function AgentChatPage() {
  const [selectedAgentId, setSelectedAgentId] = useState("all");
  const [provider, setProvider] = useState("NVIDIA NIM");
  const [model, setModel] = useState("meta/llama-3.1-70b-instruct");
  const [message, setMessage] = useState("");

  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "agent",
      agent: "AI Agent OS",
      text:
        "NVIDIA 70B is selected by default. Choose an agent, upload a file if needed, type your message, and start chatting.",
    },
  ]);

  const selectedAgent = useMemo(() => {
    return agents.find((agent) => agent.id === selectedAgentId) || agents[0];
  }, [selectedAgentId]);

  function changeProvider(nextProvider: string) {
    setProvider(nextProvider);
    setModel(modelsByProvider[nextProvider][0]);
  }

  async function loadChatSessions() {
    try {
      const data = await getChatSessions();
      setChatSessions(data.sessions || []);
    } catch {
      setChatSessions([]);
    }
  }

  async function openChatSession(sessionId: number) {
    try {
      const data = await getChatHistory(sessionId);

      setCurrentSessionId(sessionId);
      setOpenMenuId(null);
      setFileName("");
      setFileContent("");

      const loadedMessages: ChatMessage[] = (data.messages || []).map(
        (msg: any) => ({
          role: msg.role === "user" ? "user" : "agent",
          agent: msg.agent,
          text: msg.content,
          fileName: msg.file_name || undefined,
        })
      );

      setMessages(
        loadedMessages.length > 0
          ? loadedMessages
          : [
            {
              role: "agent",
              agent: "System",
              text: "This chat has no messages yet.",
            },
          ]
      );
    } catch {
      setMessages([
        {
          role: "agent",
          agent: "System",
          text: "Failed to load chat history.",
        },
      ]);
    }
  }

  function startNewChat() {
    setCurrentSessionId(null);
    setOpenMenuId(null);
    setMessage("");
    setFileName("");
    setFileContent("");
    setIsUploadingFile(false);

    setMessages([
      {
        role: "agent",
        agent: "AI Agent OS",
        text:
          "New chat started. NVIDIA 70B is selected by default. Choose an agent and send your prompt.",
      },
    ]);
  }

  async function renameSession(sessionId: number, oldTitle: string) {
    const newTitle = window.prompt("Rename chat:", oldTitle);

    if (!newTitle || !newTitle.trim()) return;

    await renameChatSession(sessionId, newTitle.trim());
    setOpenMenuId(null);
    await loadChatSessions();
  }

  async function deleteSession(sessionId: number) {
    const ok = window.confirm("Delete this chat?");

    if (!ok) return;

    await deleteChatSession(sessionId);

    if (currentSessionId === sessionId) {
      startNewChat();
    }

    setOpenMenuId(null);
    await loadChatSessions();
  }

  async function copyMessage(text: string) {
    await navigator.clipboard.writeText(text);
  }

  async function rethinkMessage(agentMessageIndex: number) {
    let previousUserMessage: ChatMessage | null = null;

    for (let i = agentMessageIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        previousUserMessage = messages[i];
        break;
      }
    }

    if (!previousUserMessage) return;

    await sendMessage(previousUserMessage.text, previousUserMessage.fileName);
  }

  async function handleFileUpload(file: File) {
    setIsUploadingFile(true);
    setFileName(file.name);
    setFileContent("");

    try {
      const result = await uploadChatFile(file);

      setFileName(result.file_name || file.name);
      setFileContent(result.extracted_text || "");

      if (!result.extracted_text) {
        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            agent: "System",
            text:
              "File uploaded, but text was not extracted. PDF, TXT, MD, HTML, JSON, CSV and code files work best now.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          agent: "System",
          text: "File upload failed. Make sure backend is running.",
        },
      ]);
    } finally {
      setIsUploadingFile(false);
    }
  }

  useEffect(() => {
    loadChatSessions();
  }, []);

  async function sendMessage(forcedMessage?: string, forcedFileName?: string) {
    if (isSending || isUploadingFile) return;

    const userText = forcedMessage ?? message.trim();
    const currentFileName = forcedFileName ?? fileName;
    const currentFileContent = fileContent;

    if (!userText && !currentFileName) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        agent: "You",
        text: userText || "Uploaded file",
        fileName: currentFileName || undefined,
      },
    ]);

    setMessage("");
    setFileName("");
    setFileContent("");
    setIsSending(true);

    try {
      const result = await sendAgentChat({
        agent: selectedAgent.name,
        provider,
        model,
        message: userText || "Uploaded file",
        file_name: currentFileName || undefined,
        file_content: currentFileContent || undefined,
        session_id: currentSessionId,
      });

      if (result.session_id) {
        setCurrentSessionId(result.session_id);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          agent: selectedAgent.name,
          text: result.reply || "No reply received from backend.",
        },
      ]);

      await loadChatSessions();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          agent: "System",
          text:
            "Backend chat failed. Make sure FastAPI is running on http://127.0.0.1:8000.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col bg-slate-950 text-white xl:flex-row">
      <aside className="w-full border-b border-white/10 bg-black/50 p-4 xl:w-80 xl:border-b-0 xl:border-r">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">AgentGPT</h1>

          <button
            onClick={startNewChat}
            className="rounded-lg border border-white/10 px-3 py-1 text-sm text-gray-300 hover:bg-white/10"
          >
            New
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 xl:block xl:space-y-2">
          <button
            onClick={startNewChat}
            className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10"
          >
            ðŸ’¬ New chat
          </button>

          <button className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10">
            ðŸ” Search chats
          </button>

          <button className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10">
            ðŸ“š Prompt Library
          </button>

          <button className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10">
            ðŸ“ Projects
          </button>

          <button className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10">
            â° Scheduled
          </button>
        </div>

        <div className="mt-8">
          <p className="mb-3 text-sm font-semibold text-gray-400">
            Files / Folders
          </p>

          <div className="grid grid-cols-2 gap-2 xl:block xl:space-y-2">
            {fileFolders.map((folder) => (
              <button
                key={folder}
                className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10"
              >
                ðŸ“‚ {folder}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <p className="mb-3 text-sm font-semibold text-gray-400">Agents</p>

          <div className="grid grid-cols-2 gap-2 xl:block xl:space-y-2">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${selectedAgentId === agent.id
                    ? "bg-blue-600 text-white"
                    : "hover:bg-white/10"
                  }`}
              >
                <span className="mr-2">{agent.icon}</span>
                {agent.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-400">Recent chats</p>

            <button
              onClick={loadChatSessions}
              className="text-xs text-gray-500 hover:text-white"
            >
              Refresh
            </button>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {chatSessions.length > 0 ? (
              chatSessions.map((chat) => (
                <div
                  key={chat.id}
                  className={`relative rounded-xl hover:bg-white/10 ${currentSessionId === chat.id ? "bg-white/10" : ""
                    }`}
                >
                  <button
                    onClick={() => openChatSession(chat.id)}
                    className="w-full px-3 py-2 pr-10 text-left text-sm"
                  >
                    <div className="truncate text-white">{chat.title}</div>
                    <div className="truncate text-xs text-gray-500">
                      {chat.agent} Â· {chat.model}
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      setOpenMenuId(openMenuId === chat.id ? null : chat.id)
                    }
                    className="absolute right-2 top-2 rounded-md px-2 py-1 text-gray-400 hover:bg-white/10 hover:text-white"
                  >
                    â‹¯
                  </button>

                  {openMenuId === chat.id && (
                    <div className="absolute right-2 top-10 z-20 w-32 rounded-xl border border-white/10 bg-slate-900 p-1 shadow-xl">
                      <button
                        onClick={() => renameSession(chat.id, chat.title)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"
                      >
                        Rename
                      </button>

                      <button
                        onClick={() => deleteSession(chat.id)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No chats yet</p>
            )}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-4 border-b border-white/10 bg-slate-950 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div>
            <h2 className="text-xl font-bold">Agent Chat</h2>

            <p className="text-sm text-gray-400">
              Agent: {selectedAgent.name} Â· API: {provider} Â· Model: {model}
            </p>

            {currentSessionId && (
              <p className="mt-1 text-xs text-gray-500">
                Session ID: {currentSessionId}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={provider}
              onChange={(e) => changeProvider(e.target.value)}
              className="rounded-xl border border-white/10 bg-black px-4 py-2 text-white outline-none"
            >
              {providers.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-xl border border-white/10 bg-black px-4 py-2 text-white outline-none"
            >
              {modelsByProvider[provider].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        <section className="border-b border-white/10 bg-slate-900/40 px-4 py-6 lg:px-6">
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[220px_1fr]">
            <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-black/40 p-6">
              <div className="animate-bounce text-7xl">
                {selectedAgent.character}
              </div>

              <h3 className="mt-4 text-center text-lg font-bold">
                {selectedAgent.title}
              </h3>

              <p className="mt-2 text-center text-sm text-gray-400">
                {selectedAgent.description}
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-gray-400">Agent thinking panel</p>

                <p className="mt-2 text-lg">
                  {selectedAgent.name} is ready. Ask anything or attach an
                  image/file.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-gray-400">
                  Future 3D character area
                </p>

                <p className="mt-2 text-gray-300">
                  Later we replace this with a 3D model and talking animation.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
          <div className="mx-auto max-w-5xl space-y-5">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
              >
                <div
                  className={`flex max-w-[90%] flex-col md:max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"
                    }`}
                >
                  <div
                    className={`rounded-2xl px-5 py-4 ${msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-white/10 text-gray-100"
                      }`}
                  >
                    <p className="mb-1 text-xs text-gray-300">{msg.agent}</p>

                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {msg.fileName && (
                      <p className="mt-3 rounded-xl bg-black/30 px-3 py-2 text-sm text-gray-300">
                        ðŸ“Ž {msg.fileName}
                      </p>
                    )}
                  </div>

                  {msg.role === "agent" && (
                    <div className="mt-2 flex items-center gap-4 px-2 text-sm text-gray-400">
                      <button
                        onClick={() => copyMessage(msg.text)}
                        className="hover:text-white"
                        title="Copy"
                      >
                        â§‰
                      </button>

                      <button
                        className="hover:text-white"
                        title="Upload / share later"
                      >
                        â‡§
                      </button>

                      <button
                        onClick={() => rethinkMessage(index)}
                        className="hover:text-white"
                        title="Rethink"
                      >
                        â†»
                      </button>

                      <button className="hover:text-white" title="More">
                        â‹¯
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white/10 px-5 py-4 text-gray-300">
                  {selectedAgent.name} is thinking...
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-white/10 bg-slate-950 px-4 py-4 lg:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-2xl border border-white/10 bg-black p-2 md:flex-row md:items-center">
            <div className="flex gap-3">
              <label className="flex h-12 w-14 cursor-pointer items-center justify-center rounded-xl bg-white/10 text-2xl hover:bg-white/20">
                +
                <input
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    await handleFileUpload(file);
                  }}
                />
              </label>

              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="max-w-56 rounded-xl bg-black px-3 py-3 text-gray-300 outline-none"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.icon} {agent.name}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Message ${selectedAgent.name}...`}
              rows={1}
              className="max-h-32 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-white outline-none placeholder:text-gray-500"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />

            <button
              onClick={() => sendMessage()}
              disabled={isSending || isUploadingFile}
              className="flex h-12 w-full items-center justify-center rounded-full bg-orange-600 text-2xl font-bold text-white hover:bg-orange-500 disabled:opacity-50 md:w-12"
            >
              âžœ
            </button>
          </div>

          {(fileName || isUploadingFile) && (
            <p className="mx-auto mt-2 max-w-5xl text-sm text-gray-400">
              {isUploadingFile
                ? `Uploading: ${fileName || "file"}...`
                : `Attached: ${fileName}${fileContent ? " Â· text extracted" : ""}`}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}



"use client";

import { useState } from "react";

type CommandItem = {
  title: string;
  description: string;
  command: string;
  danger?: boolean;
};

const commands: CommandItem[] = [
  {
    title: "Start Backend",
    description: "Run FastAPI backend on port 8000.",
    command: `cd C:\\Users\\deven\\my-ai-agents\\my-ai-agents\\app_builder_crew
.\\.venv\\Scripts\\Activate.ps1
cd dashboard\\backend
python -m uvicorn main:app --reload --port 8000`,
  },
  {
    title: "Start Frontend",
    description: "Run Next.js dashboard on localhost:3000.",
    command: `cd C:\\Users\\deven\\dashboard\\frontend
npm run dev`,
  },
  {
    title: "Build Frontend",
    description: "Check frontend before pushing to GitHub/Vercel.",
    command: `cd C:\\Users\\deven\\dashboard\\frontend
npm run build`,
  },
  {
    title: "Push Frontend Safely",
    description: "Only run this inside frontend repo.",
    command: `cd C:\\Users\\deven\\dashboard\\frontend
npm run build
git status
git add .
git commit -m "update frontend"
git push`,
  },
  {
    title: "Push Backend Safely",
    description: "Only run this inside backend repo.",
    command: `cd C:\\Users\\deven\\my-ai-agents\\my-ai-agents\\app_builder_crew
python -m py_compile dashboard\\backend\\main.py
git status
git add dashboard\\backend\\main.py
git commit -m "update backend"
git push`,
  },
  {
    title: "Check Wrong Home Git",
    description: "Make sure C:\\Users\\deven does not have accidental .git.",
    command: `cd C:\\Users\\deven
Test-Path .git`,
    danger: true,
  },
  {
    title: "Remove Wrong Home Git",
    description: "Only use if C:\\Users\\deven has accidental .git.",
    command: `cd C:\\Users\\deven
Remove-Item .git -Recurse -Force`,
    danger: true,
  },
  {
    title: "Frontend Status",
    description: "Check frontend repo changes only.",
    command: `cd C:\\Users\\deven\\dashboard\\frontend
git status`,
  },
  {
    title: "Backend Status",
    description: "Check backend repo changes only.",
    command: `cd C:\\Users\\deven\\my-ai-agents\\my-ai-agents\\app_builder_crew
git status`,
  },
];

const importantUrls = [
  "http://localhost:3000",
  "http://localhost:3000/system-check",
  "http://localhost:3000/git-safety",
  "http://localhost:3000/project-snapshot",
  "http://localhost:3000/workflow-reports",
  "http://127.0.0.1:8000/health",
  "http://127.0.0.1:8000/docs",
];

export default function CommandCenterPage() {
  const [message, setMessage] = useState("");

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setMessage("Copied command.");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#050816", color: "white", padding: "32px" }}>
      <section style={{ border: "1px solid #263044", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}>
        <p style={{ color: "#38bdf8", fontWeight: 800, letterSpacing: "2px", fontSize: "12px" }}>
          COMMAND CENTER
        </p>

        <h1 style={{ fontSize: "32px", fontWeight: 900, marginTop: "8px" }}>
          Copy Safe Project Commands
        </h1>

        <p style={{ color: "#94a3b8", marginTop: "8px" }}>
          Use this page instead of typing commands from memory. It keeps frontend, backend, Git, and safety commands clear.
        </p>
      </section>

      {message && (
        <section style={{ border: "1px solid #0e7490", borderRadius: "16px", padding: "16px", marginBottom: "24px", color: "#a5f3fc" }}>
          {message}
        </section>
      )}

      <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Important URLs</h2>

        <div style={{ display: "grid", gap: "10px", marginTop: "16px" }}>
          {importantUrls.map((url) => (
            <button
              key={url}
              onClick={() => copyText(url)}
              style={{
                textAlign: "left",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #263044",
                background: "#0b1020",
                color: "#93c5fd",
                fontFamily: "monospace",
              }}
            >
              {url}
            </button>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gap: "18px" }}>
        {commands.map((item) => (
          <div
            key={item.title}
            style={{
              border: item.danger ? "1px solid #7f1d1d" : "1px solid #263044",
              borderRadius: "20px",
              padding: "20px",
              background: item.danger ? "#220b0b" : "transparent",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: 800 }}>{item.title}</h2>
                <p style={{ color: "#94a3b8", marginTop: "6px" }}>{item.description}</p>
              </div>

              <button
                onClick={() => copyText(item.command)}
                style={{ padding: "10px 14px", borderRadius: "10px", height: "42px" }}
              >
                Copy
              </button>
            </div>

            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#020617",
                border: "1px solid #263044",
                borderRadius: "14px",
                padding: "14px",
                marginTop: "14px",
                color: "#cbd5e1",
                fontSize: "12px",
                lineHeight: "20px",
              }}
            >
              {item.command}
            </pre>
          </div>
        ))}
      </section>

      <section style={{ border: "1px solid #263044", borderRadius: "20px", padding: "20px", marginTop: "24px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 800 }}>Golden Rule</h2>

        <p style={{ color: "#fca5a5", marginTop: "12px", fontWeight: 700 }}>
          Never run git add . from C:\\Users\\deven
        </p>

        <p style={{ color: "#94a3b8", marginTop: "8px" }}>
          Only use Git inside frontend repo or backend repo.
        </p>
      </section>
    </main>
  );
}

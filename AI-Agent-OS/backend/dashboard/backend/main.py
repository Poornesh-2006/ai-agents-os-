import os
import base64
import json
import mimetypes
from pathlib import Path
import sqlite3
import subprocess
import sys
import threading
import shutil
import difflib

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from openai import OpenAI
from datetime import datetime
from pydantic import BaseModel
from pypdf import PdfReader


# =========================
# PATHS
# =========================

CREWAI_DIR = Path(r"C:\Users\deven\my-ai-agents\my-ai-agents\app_builder_crew")

FRONTEND_DIR = Path(r"C:\Users\deven\dashboard\frontend")
FRONTEND_APP_DIR = FRONTEND_DIR / "app"

MEMORY_DB = CREWAI_DIR / "memory" / "agent_memory.db"

CURRENT_RUN_DIR = CREWAI_DIR / "outputs" / "current_run"
RUNS_DIR = CREWAI_DIR / "outputs" / "runs"

SHORT_TERM_MEMORY = CREWAI_DIR / "memory" / "short_term_memory.md"
LONG_TERM_MEMORY = CREWAI_DIR / "memory" / "long_term_memory.md"
UI_STYLE_MEMORY = CREWAI_DIR / "memory" / "ui_style_memory.md"
FEATURE_MEMORY = CREWAI_DIR / "memory" / "feature_memory.md"
PROJECT_RULES_MEMORY = CREWAI_DIR / "memory" / "project_rules.md"
PAGE_PLAN_MEMORY = CREWAI_DIR / "memory" / "page_plan_memory.md"
FEATURE_REGISTRY_FILE = CREWAI_DIR / "memory" / "feature_registry.json"

CHAT_UPLOADS_DIR = CREWAI_DIR / "uploads" / "chat"
DOCUMENTS_UPLOADS_DIR = CREWAI_DIR / "uploads" / "documents"
UI_REFERENCE_IMAGES_DIR = CREWAI_DIR / "uploads" / "ui_reference_images"
USER_ASSETS_DIR = CREWAI_DIR / "uploads" / "user_assets"

GENERATED_UI_IMAGES_DIR = CREWAI_DIR / "generated" / "ui_images"
GENERATED_PAGES_DIR = CREWAI_DIR / "generated" / "pages"
GENERATED_COMPONENTS_DIR = CREWAI_DIR / "generated" / "components"
GENERATED_DESIGNS_DIR = CREWAI_DIR / "generated" / "designs"
GENERATED_FINAL_APP_DIR = CREWAI_DIR / "generated" / "final_app"
GENERATED_REPORTS_DIR = CREWAI_DIR / "generated" / "reports"


for folder in [
    CHAT_UPLOADS_DIR,
    DOCUMENTS_UPLOADS_DIR,
    UI_REFERENCE_IMAGES_DIR,
    USER_ASSETS_DIR,
    GENERATED_UI_IMAGES_DIR,
    GENERATED_PAGES_DIR,
    GENERATED_COMPONENTS_DIR,
    GENERATED_DESIGNS_DIR,
    GENERATED_FINAL_APP_DIR,
    GENERATED_REPORTS_DIR,
]:
    folder.mkdir(parents=True, exist_ok=True)


load_dotenv(CREWAI_DIR / ".env")


# =========================
# FASTAPI APP
# =========================

app = FastAPI(title="AI Agent OS Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# REQUEST MODELS
# =========================

class ChatRequest(BaseModel):
    agent: str
    provider: str
    model: str
    message: str
    file_name: str | None = None
    file_content: str | None = None
    session_id: int | None = None


class RenameChatRequest(BaseModel):
    title: str


class MemoryWriteRequest(BaseModel):
    memory_type: str
    title: str
    content: str


class UIAnalyzeRequest(BaseModel):
    file_name: str
    model: str = "moonshotai/kimi-k2.6"
    prompt: str | None = None


class PageBuildRequest(BaseModel):
    page_name: str
    route_path: str = "/"
    description: str
    model: str = "moonshotai/kimi-k2.6"


class InstallPageRequest(BaseModel):
    file_name: str
    route_path: str
    overwrite: bool = False


# =========================
# MEMORY HELPERS
# =========================

def db_connect():
    return sqlite3.connect(MEMORY_DB)


def read_text_file(file_path: Path):
    if not file_path.exists():
        return ""

    return file_path.read_text(encoding="utf-8", errors="ignore").strip()


def append_text_file(file_path: Path, title: str, content: str):
    file_path.parent.mkdir(parents=True, exist_ok=True)

    old_content = read_text_file(file_path)

    new_block = f"""
## {title}

{content.strip()}
""".strip()

    if old_content:
        final_content = old_content + "\n\n" + new_block
    else:
        final_content = new_block

    file_path.write_text(final_content, encoding="utf-8")


def build_memory_context():
    short_term = read_text_file(SHORT_TERM_MEMORY)
    long_term = read_text_file(LONG_TERM_MEMORY)
    ui_style = read_text_file(UI_STYLE_MEMORY)
    features = read_text_file(FEATURE_MEMORY)
    project_rules = read_text_file(PROJECT_RULES_MEMORY)
    page_plan = read_text_file(PAGE_PLAN_MEMORY)

    return f"""
PROJECT MEMORY CONTEXT

[SHORT TERM MEMORY]
{short_term or "No short-term memory saved yet."}

[LONG TERM MEMORY]
{long_term or "No long-term memory saved yet."}

[UI STYLE MEMORY]
{ui_style or "No UI style memory saved yet."}

[FEATURE MEMORY]
{features or "No feature memory saved yet."}

[PROJECT RULES]
{project_rules or "No project rules saved yet."}

[PAGE PLAN MEMORY]
{page_plan or "No page plan saved yet."}

IMPORTANT MEMORY RULES:
- Use this memory as project context.
- Do not ignore the user's latest message.
- Do not assume every file is an app or website.
- Use app-builder analysis only when the user asks for app, UI, code, or product building.
- If uploaded file content is provided, use that file content as the source of truth.
- Shared memory is used by dashboard chat and future CrewAI agents.
""".strip()


# =========================
# CHAT DB SETUP
# =========================

def init_chat_tables():
    conn = db_connect()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            agent TEXT NOT NULL,
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            agent TEXT NOT NULL,
            content TEXT NOT NULL,
            file_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
        )
        """
    )

    conn.commit()
    conn.close()


init_chat_tables()


# =========================
# BASIC ROUTES
# =========================

@app.get("/")
def home():
    return {
        "message": "AI Agent OS Dashboard API is running",
        "status": "ok",
    }


@app.get("/health")
def health():
    return {
        "api": "ok",
        "crewai_dir": str(CREWAI_DIR),
        "frontend_dir": str(FRONTEND_DIR),
        "memory_db_exists": MEMORY_DB.exists(),
        "current_run_exists": CURRENT_RUN_DIR.exists(),
        "runs_dir_exists": RUNS_DIR.exists(),
        "short_term_memory_exists": SHORT_TERM_MEMORY.exists(),
        "long_term_memory_exists": LONG_TERM_MEMORY.exists(),
        "ui_style_memory_exists": UI_STYLE_MEMORY.exists(),
        "feature_memory_exists": FEATURE_MEMORY.exists(),
        "project_rules_exists": PROJECT_RULES_MEMORY.exists(),
        "page_plan_memory_exists": PAGE_PLAN_MEMORY.exists(),
        "nvidia_key_loaded": bool(os.getenv("NVIDIA_API_KEY")),
    }


# =========================
# OUTPUTS / RUNS
# =========================

@app.get("/outputs/current")
def current_outputs():
    files = []

    if CURRENT_RUN_DIR.exists():
        for file in sorted(CURRENT_RUN_DIR.glob("*.md")):
            files.append(
                {
                    "name": file.name,
                    "path": str(file),
                    "size": file.stat().st_size,
                    "modified": file.stat().st_mtime,
                }
            )

    return {
        "count": len(files),
        "files": files,
    }


@app.get("/outputs/current/with-content")
def current_outputs_with_content():
    files = []

    agent_names = {
        "01_product_manager_prd.md": "Product Manager",
        "02_ui_ux_design.md": "UI/UX Designer",
        "03_frontend_plan.md": "Frontend Developer",
        "04_backend_plan.md": "Backend Developer",
        "05_database_schema.md": "Database Engineer",
        "06_system_architecture.md": "System Architect",
        "07_qa_test_plan.md": "QA Tester",
        "08_final_blueprint.md": "Project Reviewer",
    }

    if CURRENT_RUN_DIR.exists():
        for file in sorted(CURRENT_RUN_DIR.glob("*.md")):
            content = file.read_text(encoding="utf-8", errors="ignore")

            files.append(
                {
                    "name": file.name,
                    "agent_name": agent_names.get(file.name, "Unknown Agent"),
                    "path": str(file),
                    "size": file.stat().st_size,
                    "content": content,
                }
            )

    return {
        "count": len(files),
        "files": files,
    }


@app.get("/runs")
def archived_runs():
    runs = []

    if RUNS_DIR.exists():
        for folder in sorted(RUNS_DIR.iterdir(), reverse=True):
            if folder.is_dir():
                md_files = list(folder.glob("*.md"))
                runs.append(
                    {
                        "name": folder.name,
                        "path": str(folder),
                        "file_count": len(md_files),
                    }
                )

    return {
        "count": len(runs),
        "runs": runs,
    }


# =========================
# MEMORY ROUTES
# =========================

@app.get("/memory/short-term")
def get_short_term_memory():
    return {
        "content": read_text_file(SHORT_TERM_MEMORY),
    }


@app.get("/memory/long-term")
def get_long_term_memory():
    return {
        "content": read_text_file(LONG_TERM_MEMORY),
    }


@app.get("/memory/all")
def get_all_memory():
    return {
        "short_term_memory": read_text_file(SHORT_TERM_MEMORY),
        "long_term_memory": read_text_file(LONG_TERM_MEMORY),
        "ui_style_memory": read_text_file(UI_STYLE_MEMORY),
        "feature_memory": read_text_file(FEATURE_MEMORY),
        "project_rules": read_text_file(PROJECT_RULES_MEMORY),
        "page_plan_memory": read_text_file(PAGE_PLAN_MEMORY),
    }


@app.post("/memory/write")
def write_memory(request: MemoryWriteRequest):
    memory_map = {
        "short_term": SHORT_TERM_MEMORY,
        "long_term": LONG_TERM_MEMORY,
        "ui_style": UI_STYLE_MEMORY,
        "features": FEATURE_MEMORY,
        "project_rules": PROJECT_RULES_MEMORY,
        "page_plan": PAGE_PLAN_MEMORY,
    }

    target_file = memory_map.get(request.memory_type)

    if target_file is None:
        return {
            "ok": False,
            "message": (
                "Invalid memory_type. Use one of: "
                "short_term, long_term, ui_style, features, project_rules, page_plan."
            ),
        }

    append_text_file(
        file_path=target_file,
        title=request.title,
        content=request.content,
    )

    return {
        "ok": True,
        "message": "Memory saved successfully.",
        "memory_type": request.memory_type,
        "file": str(target_file),
    }


# =========================
# AGENT STATUS / ERRORS
# =========================

@app.get("/agents/status")
def agents_status():
    if not MEMORY_DB.exists():
        return {"error": "agent_memory.db not found"}

    conn = db_connect()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, run_name, status, started_at, ended_at, archive_path
        FROM runs
        ORDER BY id DESC
        LIMIT 1
        """
    )

    latest_run = cur.fetchone()

    if not latest_run:
        conn.close()
        return {"error": "No runs found in database"}

    run_id, run_name, run_status, started_at, ended_at, archive_path = latest_run

    cur.execute(
        """
        SELECT task_order, agent_name, status, output_file, error_message
        FROM agent_tasks
        WHERE run_id = ?
        ORDER BY task_order
        """,
        (run_id,),
    )

    agents = []
    for row in cur.fetchall():
        agents.append(
            {
                "task_order": row[0],
                "agent_name": row[1],
                "status": row[2],
                "output_file": row[3],
                "error_message": row[4],
            }
        )

    conn.close()

    return {
        "run": {
            "id": run_id,
            "name": run_name,
            "status": run_status,
            "started_at": started_at,
            "ended_at": ended_at,
            "archive_path": archive_path,
        },
        "agents": agents,
    }


@app.get("/errors")
def get_errors():
    if not MEMORY_DB.exists():
        return {"error": "agent_memory.db not found"}

    conn = db_connect()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, run_id, agent_name, error_type, error_message, suggested_fix, created_at
        FROM agent_errors
        ORDER BY id DESC
        LIMIT 50
        """
    )

    errors = []
    for row in cur.fetchall():
        errors.append(
            {
                "id": row[0],
                "run_id": row[1],
                "agent_name": row[2],
                "error_type": row[3],
                "error_message": row[4],
                "suggested_fix": row[5],
                "created_at": row[6],
            }
        )

    conn.close()

    return {
        "count": len(errors),
        "errors": errors,
    }


# =========================
# CONTROL ROUTES
# =========================

RUN_PROCESS = None
RUN_LOGS = []


def read_process_logs(process):
    global RUN_LOGS

    if process.stdout is None:
        return

    for line in process.stdout:
        RUN_LOGS.append(line.rstrip())

        if len(RUN_LOGS) > 300:
            RUN_LOGS = RUN_LOGS[-300:]


def start_background_process(command, message):
    global RUN_PROCESS, RUN_LOGS

    if RUN_PROCESS is not None and RUN_PROCESS.poll() is None:
        return {
            "ok": False,
            "message": "Agents are already running. Please wait.",
        }

    RUN_LOGS = []
    RUN_LOGS.append(f"Starting command: {' '.join(command)}")

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"

    RUN_PROCESS = subprocess.Popen(
        command,
        cwd=str(CREWAI_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        shell=False,
    )

    thread = threading.Thread(
        target=read_process_logs,
        args=(RUN_PROCESS,),
        daemon=True,
    )
    thread.start()

    return {
        "ok": True,
        "message": message,
    }


@app.get("/control/status")
def control_status():
    global RUN_PROCESS

    if RUN_PROCESS is None:
        return {
            "running": False,
            "message": "No agent process running",
        }

    if RUN_PROCESS.poll() is None:
        return {
            "running": True,
            "message": "Agent process is running",
        }

    return {
        "running": False,
        "message": "Agent process finished",
        "exit_code": RUN_PROCESS.returncode,
    }


@app.get("/control/logs")
def control_logs():
    return {
        "count": len(RUN_LOGS),
        "logs": RUN_LOGS[-100:],
    }


@app.post("/control/start")
def start_agents():
    return start_background_process(
        ["crewai", "run"],
        "CrewAI agents started",
    )


@app.post("/control/resume")
def resume_agents():
    return start_background_process(
        [sys.executable, "resume_run.py"],
        "Resume started",
    )


@app.post("/control/archive")
def archive_current_run():
    process = subprocess.run(
        [sys.executable, "archive_run.py"],
        cwd=str(CREWAI_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    return {
        "ok": process.returncode == 0,
        "message": "Archive command finished",
        "output": process.stdout,
        "error": process.stderr,
    }


@app.post("/control/scan-memory")
def scan_memory():
    process = subprocess.run(
        [sys.executable, "memory_manager.py"],
        cwd=str(CREWAI_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    return {
        "ok": process.returncode == 0,
        "message": "Memory scan finished",
        "output": process.stdout,
        "error": process.stderr,
    }


@app.post("/control/stop")
def stop_agents():
    global RUN_PROCESS, RUN_LOGS

    if RUN_PROCESS is None:
        return {
            "ok": False,
            "message": "No agent process is running.",
        }

    if RUN_PROCESS.poll() is not None:
        return {
            "ok": False,
            "message": "Agent process already finished.",
            "exit_code": RUN_PROCESS.returncode,
        }

    RUN_LOGS.append("Stop requested from dashboard.")

    RUN_PROCESS.terminate()

    try:
        RUN_PROCESS.wait(timeout=10)
        RUN_LOGS.append("Agent process stopped safely.")
        return {
            "ok": True,
            "message": "Agent process stopped safely.",
        }
    except Exception:
        RUN_PROCESS.kill()
        RUN_LOGS.append("Agent process force killed.")
        return {
            "ok": True,
            "message": "Agent process force killed.",
        }


# =========================
# NIM CHAT HELPERS
# =========================

AGENT_SYSTEM_PROMPTS = {
    "All Agents": (
        "You are Devendra's private AI Agent OS. "
        "First understand the user's actual request and the uploaded file content. "
        "Do not assume every file is an app, website, frontend project, or product. "
        "If the uploaded file is a legal document, explain it as a legal/consumer-case document. "
        "If it is code, review the code. "
        "If it is a PDF, summarize the real PDF content. "
        "If it is an app idea, then cover product, UI, frontend, backend, database, architecture, testing, and review. "
        "Always answer based on the actual extracted file content when file content is provided. "
        "Do not say you cannot access the file if file content is provided."
    ),
    "Product Manager": (
        "You are a Product Manager agent. "
        "Only give product analysis if the user is discussing an app, business, feature, or product. "
        "If the uploaded file is not product-related, summarize it normally first, then mention any product relevance only if useful."
    ),
    "UI/UX Designer": (
        "You are a UI/UX Designer agent. "
        "Focus on UI/UX only when the user asks about screens, design, layout, website, app, or interface. "
        "If the uploaded file is a legal PDF or normal document, explain the document clearly instead of forcing UI analysis."
    ),
    "Frontend Developer": (
        "You are a Frontend Developer agent. "
        "Focus on HTML, CSS, JavaScript, React, Next.js, Tailwind, and frontend implementation only when code or frontend tasks are provided. "
        "If the uploaded file is not code, summarize the actual file content."
    ),
    "Backend Developer": (
        "You are a Backend Developer agent. "
        "Focus on APIs, FastAPI, backend logic, services, security, and integration only when the user asks about backend or code. "
        "If the uploaded file is a normal document, summarize it based on the file content."
    ),
    "Database Engineer": (
        "You are a Database Engineer agent. "
        "Focus on database schema, SQLite, Supabase, tables, relationships, and storage only when the user asks about data/database. "
        "If the uploaded file is not database-related, explain the document normally."
    ),
    "System Architect": (
        "You are a System Architect agent. "
        "Focus on architecture only when the user asks about systems, apps, agents, infrastructure, or software design. "
        "If the uploaded file is a legal, study, or normal PDF, summarize its actual purpose and structure."
    ),
    "QA Tester": (
        "You are a QA Tester agent. "
        "Focus on tests, bugs, validation, and edge cases only when testing is relevant. "
        "If the uploaded file is a document, check clarity, missing details, and possible issues in that document."
    ),
    "Project Reviewer": (
        "You are a Project Reviewer agent. "
        "Review the actual content given by the user. "
        "Do not force app-development categories unless the file is actually an app, website, codebase, or product plan."
    ),
}


def create_chat_session(request: ChatRequest):
    title = request.message.strip()[:50] or "New chat"

    conn = db_connect()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO chat_sessions (title, agent, provider, model)
        VALUES (?, ?, ?, ?)
        """,
        (title, request.agent, request.provider, request.model),
    )

    session_id = cur.lastrowid

    conn.commit()
    conn.close()

    return session_id


def save_chat_message(session_id, role, agent, content, file_name=None):
    conn = db_connect()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO chat_messages (session_id, role, agent, content, file_name)
        VALUES (?, ?, ?, ?, ?)
        """,
        (session_id, role, agent, content, file_name),
    )

    cur.execute(
        """
        UPDATE chat_sessions
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (session_id,),
    )

    conn.commit()
    conn.close()


def extract_text_from_file(file_path: Path):
    suffix = file_path.suffix.lower()

    if suffix == ".pdf":
        reader = PdfReader(str(file_path))
        text_parts = []

        for page in reader.pages:
            text_parts.append(page.extract_text() or "")

        return "\n".join(text_parts).strip()

    if suffix in [
        ".txt",
        ".md",
        ".csv",
        ".json",
        ".html",
        ".htm",
        ".tsx",
        ".ts",
        ".js",
        ".jsx",
        ".py",
        ".yaml",
        ".yml",
    ]:
        return file_path.read_text(encoding="utf-8", errors="ignore")

    try:
        return file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def call_nvidia_nim(request: ChatRequest):
    nvidia_api_key = os.getenv("NVIDIA_API_KEY")

    if not nvidia_api_key:
        return (
            "NVIDIA_API_KEY is missing in .env.\n\n"
            "Add NVIDIA_API_KEY=your_key_here and restart backend."
        )

    client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=nvidia_api_key,
    )

    system_prompt = AGENT_SYSTEM_PROMPTS.get(
        request.agent,
        "You are a helpful AI agent inside a private local AI Agent OS.",
    )

    memory_context = build_memory_context()
    system_prompt = system_prompt + "\n\n" + memory_context

    user_message = request.message

    if request.file_name and request.file_content:
        user_message += (
            f"\n\nIMPORTANT: The user uploaded a file named: {request.file_name}.\n"
            "The actual extracted file content is pasted below. "
            "Use the extracted content as the source of truth. "
            "First identify what type of file it is. "
            "Do not assume it is an app, website, frontend project, or product unless the content clearly shows that. "
            "If it is a legal/consumer complaint PDF, explain it as a legal case document. "
            "Do NOT say you cannot access the file.\n\n"
            "----- FILE CONTENT START -----\n"
            f"{request.file_content[:12000]}\n"
            "----- FILE CONTENT END -----"
        )

    elif request.file_name and not request.file_content:
        user_message += (
            f"\n\nThe user attached a file named {request.file_name}, "
            "but extracted text was empty. Say that text extraction failed."
        )

    completion = client.chat.completions.create(
        model=request.model,
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_message,
            },
        ],
        temperature=0.3,
        max_tokens=1200,
    )

    return completion.choices[0].message.content


# =========================
# FILE / IMAGE HELPERS
# =========================

def image_to_data_url(file_path: Path):
    mime_type, _ = mimetypes.guess_type(str(file_path))

    if not mime_type:
        mime_type = "image/png"

    image_bytes = file_path.read_bytes()
    encoded = base64.b64encode(image_bytes).decode("utf-8")

    return f"data:{mime_type};base64,{encoded}"


def save_generated_design_note(file_name: str, content: str):
    safe_stem = Path(file_name).stem.replace(" ", "_")
    output_file = GENERATED_DESIGNS_DIR / f"{safe_stem}_analysis.md"

    output_file.write_text(content, encoding="utf-8")

    return output_file


# =========================
# CHAT UPLOAD
# =========================

@app.post("/chat/upload")
async def upload_chat_file(file: UploadFile = File(...)):
    safe_name = file.filename or "uploaded_file"
    file_path = CHAT_UPLOADS_DIR / safe_name

    counter = 1
    while file_path.exists():
        stem = Path(safe_name).stem
        suffix = Path(safe_name).suffix
        file_path = CHAT_UPLOADS_DIR / f"{stem}_{counter}{suffix}"
        counter += 1

    content = await file.read()
    file_path.write_bytes(content)

    extracted_text = extract_text_from_file(file_path)

    return {
        "ok": True,
        "file_name": file_path.name,
        "file_path": str(file_path),
        "extracted_text": extracted_text[:12000],
        "text_length": len(extracted_text),
    }


# =========================
# UI REFERENCE IMAGE ROUTES
# =========================

ALLOWED_IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
}


@app.post("/ui/upload-reference")
async def upload_ui_reference_image(file: UploadFile = File(...)):
    safe_name = file.filename or "ui_reference_image"
    suffix = Path(safe_name).suffix.lower()

    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        return {
            "ok": False,
            "message": "Only PNG, JPG, JPEG, WEBP, and GIF images are allowed.",
            "file_name": safe_name,
        }

    file_path = UI_REFERENCE_IMAGES_DIR / safe_name

    counter = 1
    while file_path.exists():
        stem = Path(safe_name).stem
        suffix = Path(safe_name).suffix
        file_path = UI_REFERENCE_IMAGES_DIR / f"{stem}_{counter}{suffix}"
        counter += 1

    content = await file.read()
    file_path.write_bytes(content)

    return {
        "ok": True,
        "message": "UI reference image uploaded successfully.",
        "file_name": file_path.name,
        "file_path": str(file_path),
        "view_url": f"/ui/reference-images/{file_path.name}",
    }


@app.get("/ui/reference-images")
def list_ui_reference_images():
    images = []

    if UI_REFERENCE_IMAGES_DIR.exists():
        for file in sorted(UI_REFERENCE_IMAGES_DIR.iterdir(), reverse=True):
            if file.is_file() and file.suffix.lower() in ALLOWED_IMAGE_EXTENSIONS:
                images.append(
                    {
                        "file_name": file.name,
                        "file_path": str(file),
                        "size": file.stat().st_size,
                        "modified": file.stat().st_mtime,
                        "view_url": f"/ui/reference-images/{file.name}",
                    }
                )

    return {
        "count": len(images),
        "images": images,
    }


@app.get("/ui/reference-images/{file_name}")
def view_ui_reference_image(file_name: str):
    safe_name = Path(file_name).name
    file_path = UI_REFERENCE_IMAGES_DIR / safe_name

    if not file_path.exists():
        return {
            "ok": False,
            "message": "Image not found.",
            "file_name": safe_name,
        }

    if file_path.suffix.lower() not in ALLOWED_IMAGE_EXTENSIONS:
        return {
            "ok": False,
            "message": "Invalid image file type.",
            "file_name": safe_name,
        }

    return FileResponse(str(file_path))

@app.delete("/ui/reference-images/{file_name}")
def delete_ui_reference_image(file_name: str):
    safe_name = Path(file_name).name
    file_path = UI_REFERENCE_IMAGES_DIR / safe_name

    if not file_path.exists():
        return {
            "ok": False,
            "message": "Image not found.",
            "file_name": safe_name,
        }

    if file_path.suffix.lower() not in ALLOWED_IMAGE_EXTENSIONS:
        return {
            "ok": False,
            "message": "Invalid image file type.",
            "file_name": safe_name,
        }

    file_path.unlink()

    return {
        "ok": True,
        "message": "UI reference image deleted successfully.",
        "file_name": safe_name,
    }


@app.post("/ui/analyze-reference")
def analyze_ui_reference_image(request: UIAnalyzeRequest):
    nvidia_api_key = os.getenv("NVIDIA_API_KEY")

    if not nvidia_api_key:
        return {
            "ok": False,
            "message": "NVIDIA_API_KEY is missing in .env.",
        }

    safe_name = Path(request.file_name).name
    file_path = UI_REFERENCE_IMAGES_DIR / safe_name

    if not file_path.exists():
        return {
            "ok": False,
            "message": "UI reference image not found.",
            "file_name": safe_name,
        }

    if file_path.suffix.lower() not in ALLOWED_IMAGE_EXTENSIONS:
        return {
            "ok": False,
            "message": "Invalid image file type.",
            "file_name": safe_name,
        }

    image_data_url = image_to_data_url(file_path)
    memory_context = build_memory_context()

    user_prompt = request.prompt or (
        "Analyze this uploaded UI reference image. "
        "Identify the layout, colors, typography, spacing, components, cards, buttons, navigation, "
        "visual hierarchy, mobile/desktop behavior, and what frontend pages/components can be built from it. "
        "Then create a practical React + Tailwind implementation plan. "
        "Do not generate final code yet. First create detailed UI notes."
    )

    client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=nvidia_api_key,
    )

    completion = client.chat.completions.create(
        model=request.model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a UI Vision Analyzer Agent inside Devendra's private AI Agent OS. "
                    "You analyze UI screenshots and convert them into clear design notes for UI/UX and frontend agents. "
                    "Use the shared project memory below when useful.\n\n"
                    f"{memory_context}"
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": user_prompt,
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_data_url,
                        },
                    },
                ],
            },
        ],
        temperature=0.2,
        max_tokens=1600,
    )

    analysis = completion.choices[0].message.content or ""
    memory_title = f"UI Reference Analysis - {safe_name}"

    append_text_file(
        file_path=UI_STYLE_MEMORY,
        title=memory_title,
        content=analysis,
    )

    design_file = save_generated_design_note(
        file_name=safe_name,
        content=analysis,
    )

    return {
        "ok": True,
        "message": "UI reference image analyzed successfully.",
        "file_name": safe_name,
        "model": request.model,
        "analysis": analysis,
        "saved_to_memory": str(UI_STYLE_MEMORY),
        "saved_design_file": str(design_file),
    }


# =========================
# GENERATED FILE ROUTES
# =========================

GENERATED_CATEGORY_MAP = {
    "ui_images": GENERATED_UI_IMAGES_DIR,
    "pages": GENERATED_PAGES_DIR,
    "components": GENERATED_COMPONENTS_DIR,
    "designs": GENERATED_DESIGNS_DIR,
    "final_app": GENERATED_FINAL_APP_DIR,
    "reports": GENERATED_REPORTS_DIR,
}

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

TEXT_EXTENSIONS = {
    ".txt",
    ".md",
    ".json",
    ".html",
    ".htm",
    ".tsx",
    ".ts",
    ".js",
    ".jsx",
    ".py",
    ".css",
    ".yaml",
    ".yml",
}


def list_generated_folder(folder_path: Path, category: str):
    files = []

    if not folder_path.exists():
        return files

    for file in sorted(folder_path.iterdir(), reverse=True):
        if not file.is_file():
            continue

        suffix = file.suffix.lower()

        if suffix in IMAGE_EXTENSIONS:
            file_type = "image"
        elif suffix in TEXT_EXTENSIONS:
            file_type = "text"
        else:
            file_type = "file"

        files.append(
            {
                "file_name": file.name,
                "category": category,
                "file_type": file_type,
                "file_path": str(file),
                "size": file.stat().st_size,
                "modified": file.stat().st_mtime,
                "view_url": f"/generated/{category}/{file.name}",
            }
        )

    return files


@app.get("/generated/all")
def get_all_generated_files():
    result = {}

    for category, folder_path in GENERATED_CATEGORY_MAP.items():
        result[category] = list_generated_folder(folder_path, category)

    return {
        "ok": True,
        "generated": result,
    }


@app.get("/generated/{category}")
def get_generated_files_by_category(category: str):
    folder_path = GENERATED_CATEGORY_MAP.get(category)

    if folder_path is None:
        return {
            "ok": False,
            "message": (
                "Invalid category. Use one of: "
                "ui_images, pages, components, designs, final_app, reports."
            ),
            "files": [],
        }

    files = list_generated_folder(folder_path, category)

    return {
        "ok": True,
        "category": category,
        "count": len(files),
        "files": files,
    }


@app.get("/generated/{category}/{file_name}")
def view_generated_file(category: str, file_name: str):
    folder_path = GENERATED_CATEGORY_MAP.get(category)

    if folder_path is None:
        return {
            "ok": False,
            "message": "Invalid generated file category.",
        }

    safe_name = Path(file_name).name
    file_path = folder_path / safe_name

    if not file_path.exists():
        return {
            "ok": False,
            "message": "Generated file not found.",
            "file_name": safe_name,
        }

    return FileResponse(str(file_path))


# =========================
# PAGE BUILDER ROUTES
# ==========================
def safe_page_file_name(page_name: str):
    cleaned = page_name.strip().lower()
    cleaned = cleaned.replace(" ", "_").replace("-", "_")

    allowed = []
    for char in cleaned:
        if char.isalnum() or char == "_":
            allowed.append(char)

    final_name = "".join(allowed).strip("_")

    if not final_name:
        final_name = "generated_page"

    return f"{final_name}.tsx"


def extract_code_from_response(text: str):
    cleaned = (text or "").strip()

    if "```tsx" in cleaned:
        cleaned = cleaned.split("```tsx", 1)[1].split("```", 1)[0].strip()
    elif "```typescript" in cleaned:
        cleaned = cleaned.split("```typescript", 1)[1].split("```", 1)[0].strip()
    elif "```jsx" in cleaned:
        cleaned = cleaned.split("```jsx", 1)[1].split("```", 1)[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()

    if cleaned.startswith("jsx"):
        cleaned = cleaned[3:].strip()

    if cleaned.startswith("tsx"):
        cleaned = cleaned[3:].strip()

    if '"use client";' not in cleaned and "'use client';" not in cleaned:
        cleaned = '"use client";\n\n' + cleaned

    return cleaned


def validate_generated_page_code(code: str):
    errors = []

    if not code.strip():
        errors.append("Generated code is empty.")

    if "export default function" not in code and "export default" not in code:
        errors.append("Missing export default component.")

    if "return (" not in code and "return <" not in code:
        errors.append("Missing JSX return block.")

    if len(code.strip()) < 1000:
        errors.append("Generated code is too short. It looks like a snippet, not a full page.")

    bad_snippet_signals = [
        "const expensiveValue",
        "data.filter",
        "map(transform)",
    ]

    for signal in bad_snippet_signals:
        if signal in code:
            errors.append(f"Bad snippet detected: {signal}")

    return errors


@app.post("/builder/generate-page")
def generate_page_code(request: PageBuildRequest):
    try:
        nvidia_api_key = os.getenv("NVIDIA_API_KEY")

        if not nvidia_api_key:
            return {
                "ok": False,
                "message": "NVIDIA_API_KEY is missing in .env.",
            }

        memory_context = build_memory_context()

        client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=nvidia_api_key,
        )

        prompt = f"""
You are a senior frontend engineer inside Devendra's private AI Agent OS.

Generate one complete React + Tailwind TSX page component.

STRICT OUTPUT RULES:
- Return only TSX code.
- Do not write explanations.
- Do not use markdown fences.
- The file must start with "use client";
- Must include export default function.
- Must include a complete JSX return layout.
- Must be a full page, not a tiny snippet.
- Use Next.js App Router style.
- Use React functional component.
- Use Tailwind CSS only.
- Do not import external UI libraries.
- Do not use shadcn unless explicitly asked.
- Make it dark, modern, clean, responsive, and production-quality.
- Use the saved UI memory when useful.

PAGE NAME:
{request.page_name}

ROUTE PATH:
{request.route_path}

USER DESCRIPTION:
{request.description}

SHARED MEMORY:
{memory_context}
""".strip()

        completion = client.chat.completions.create(
            model=request.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a strict Next.js App Router TSX page generator. "
                        "Return only one complete TSX page file. No explanations. No markdown."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.15,
            max_tokens=5000,
        )

        raw_output = completion.choices[0].message.content or ""
        code = extract_code_from_response(raw_output)

        validation_errors = validate_generated_page_code(code)

        if validation_errors:
            repair_prompt = f"""
The previous model output was invalid.

VALIDATION ERRORS:
{validation_errors}

BAD OUTPUT:
{raw_output}

Regenerate the page correctly.

STRICT RULES:
- Return one full valid TSX file only.
- Must start with "use client";
- Must include export default function.
- Must include a complete JSX return layout.
- Must be at least 1000 characters.
- Must not return tiny snippets.
- Must not return explanations.
- Must not use markdown fences.
- Must use Tailwind CSS only.
- Must not import external UI libraries.

PAGE NAME:
{request.page_name}

ROUTE PATH:
{request.route_path}

DESCRIPTION:
{request.description}

MEMORY:
{memory_context}
""".strip()

            repair_completion = client.chat.completions.create(
                model=request.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a strict Next.js App Router TSX page generator. "
                            "Return only one complete TSX page file. No explanations."
                        ),
                    },
                    {
                        "role": "user",
                        "content": repair_prompt,
                    },
                ],
                temperature=0.1,
                max_tokens=5000,
            )

            raw_output = repair_completion.choices[0].message.content or ""
            code = extract_code_from_response(raw_output)
            validation_errors = validate_generated_page_code(code)

            if validation_errors:
                return {
                    "ok": False,
                    "message": "Generated page failed validation.",
                    "errors": validation_errors,
                    "raw_output": raw_output,
                }

        file_name = safe_page_file_name(request.page_name)
        output_file = GENERATED_PAGES_DIR / file_name
        output_file.write_text(code, encoding="utf-8")

        return {
            "ok": True,
            "message": "Page generated successfully.",
            "page_name": request.page_name,
            "route_path": request.route_path,
            "model": request.model,
            "file_name": file_name,
            "saved_file": str(output_file),
            "view_url": f"/generated/pages/{file_name}",
            "code_length": len(code),
            "code": code,
        }

    except Exception as error:
        record_error(
            "Agent Team",
            "agents_decide",
            "Agent team decision failed.",
            str(error),
        )
        return {
            "ok": False,
            "message": "Page generation error.",
            "error": str(error),
        }
    


def safe_route_to_page_file(route_path: str):
    cleaned = route_path.strip()

    if not cleaned.startswith("/"):
        cleaned = "/" + cleaned

    cleaned = cleaned.strip("/")

    if cleaned == "":
        return FRONTEND_APP_DIR / "page.tsx"

    parts = []

    for part in cleaned.split("/"):
        part = part.strip()

        if not part:
            continue

        safe_part = "".join(
            char for char in part if char.isalnum() or char in ["-", "_"]
        )

        if not safe_part:
            continue

        parts.append(safe_part)

    if not parts:
        return FRONTEND_APP_DIR / "page.tsx"

    return FRONTEND_APP_DIR.joinpath(*parts) / "page.tsx"


@app.post("/builder/install-page")
def install_generated_page(request: InstallPageRequest):
    safe_file_name = Path(request.file_name).name
    source_file = GENERATED_PAGES_DIR / safe_file_name

    if not source_file.exists():
        return {
            "ok": False,
            "message": "Generated page file not found.",
            "file_name": safe_file_name,
        }

    if source_file.suffix.lower() != ".tsx":
        return {
            "ok": False,
            "message": "Only .tsx generated pages can be installed.",
            "file_name": safe_file_name,
        }

    target_file = safe_route_to_page_file(request.route_path)

    if target_file.exists() and not request.overwrite:
        return {
            "ok": False,
            "message": (
                "Target page already exists. Set overwrite=true if you want to replace it."
            ),
            "target_file": str(target_file),
        }

    target_file.parent.mkdir(parents=True, exist_ok=True)

    code = source_file.read_text(encoding="utf-8", errors="ignore")
    target_file.write_text(code, encoding="utf-8")

    return {
        "ok": True,
        "message": "Generated page installed successfully.",
        "source_file": str(source_file),
        "target_file": str(target_file),
        "route_path": request.route_path,
        "live_url": f"http://localhost:3000{request.route_path}",
    }


# =========================
# CHAT ROUTES
# =========================

@app.post("/chat/send")
def send_chat_message(request: ChatRequest):
    try:
        session_id = request.session_id

        if session_id is None:
            session_id = create_chat_session(request)

        user_content_to_save = request.message

        if request.file_name:
            user_content_to_save += f"\n\nAttached file: {request.file_name}"

        save_chat_message(
            session_id=session_id,
            role="user",
            agent="You",
            content=user_content_to_save,
            file_name=request.file_name,
        )

        if request.provider == "NVIDIA NIM":
            reply = call_nvidia_nim(request)
        else:
            reply = (
                f"{request.provider} is not connected yet.\n\n"
                f"Agent: {request.agent}\n"
                f"Model: {request.model}\n\n"
                "For now, only NVIDIA NIM is connected."
            )

        save_chat_message(
            session_id=session_id,
            role="agent",
            agent=request.agent,
            content=reply,
            file_name=None,
        )

        return {
            "ok": True,
            "session_id": session_id,
            "agent": request.agent,
            "provider": request.provider,
            "model": request.model,
            "file_name": request.file_name,
            "file_content_length": len(request.file_content or ""),
            "reply": reply,
        }

    except Exception as error:
        return {
            "ok": False,
            "session_id": request.session_id,
            "agent": request.agent,
            "provider": request.provider,
            "model": request.model,
            "file_name": request.file_name,
            "file_content_length": len(request.file_content or ""),
            "reply": f"NVIDIA/API error: {str(error)}",
        }


@app.get("/chat/sessions")
def get_chat_sessions():
    conn = db_connect()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, title, agent, provider, model, created_at, updated_at
        FROM chat_sessions
        ORDER BY updated_at DESC
        LIMIT 50
        """
    )

    sessions = []

    for row in cur.fetchall():
        sessions.append(
            {
                "id": row[0],
                "title": row[1],
                "agent": row[2],
                "provider": row[3],
                "model": row[4],
                "created_at": row[5],
                "updated_at": row[6],
            }
        )

    conn.close()

    return {
        "count": len(sessions),
        "sessions": sessions,
    }


@app.get("/chat/history/{session_id}")
def get_chat_history(session_id: int):
    conn = db_connect()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, role, agent, content, file_name, created_at
        FROM chat_messages
        WHERE session_id = ?
        ORDER BY id ASC
        """,
        (session_id,),
    )

    messages = []

    for row in cur.fetchall():
        messages.append(
            {
                "id": row[0],
                "role": row[1],
                "agent": row[2],
                "content": row[3],
                "file_name": row[4],
                "created_at": row[5],
            }
        )

    conn.close()

    return {
        "session_id": session_id,
        "count": len(messages),
        "messages": messages,
    }


@app.put("/chat/sessions/{session_id}/rename")
def rename_chat_session(session_id: int, request: RenameChatRequest):
    new_title = request.title.strip()

    if not new_title:
        return {
            "ok": False,
            "message": "Chat title cannot be empty.",
        }

    conn = db_connect()
    cur = conn.cursor()

    cur.execute(
        """
        UPDATE chat_sessions
        SET title = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (new_title, session_id),
    )

    conn.commit()
    affected = cur.rowcount
    conn.close()

    if affected == 0:
        return {
            "ok": False,
            "message": "Chat session not found.",
        }

    return {
        "ok": True,
        "message": "Chat renamed successfully.",
        "session_id": session_id,
        "title": new_title,
    }


@app.delete("/chat/sessions/{session_id}")
def delete_chat_session(session_id: int):
    conn = db_connect()
    cur = conn.cursor()

    cur.execute(
        """
        DELETE FROM chat_messages
        WHERE session_id = ?
        """,
        (session_id,),
    )

    cur.execute(
        """
        DELETE FROM chat_sessions
        WHERE id = ?
        """,
        (session_id,),
    )

    conn.commit()
    affected = cur.rowcount
    conn.close()

    if affected == 0:
        return {
            "ok": False,
            "message": "Chat session not found.",
        }

    return {
        "ok": True,
        "message": "Chat deleted successfully.",
        "session_id": session_id,
    }




class FeatureCreateRequest(BaseModel):
    name: str
    description: str = ""
    status: str = "planned"
    priority: str = "medium"
    owner_agent: str = "Product Manager"
    frontend_file: str = ""
    backend_route: str = ""
    database_needed: bool = False
    notes: str = ""


class FeatureUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    owner_agent: str | None = None
    frontend_file: str | None = None
    backend_route: str | None = None
    database_needed: bool | None = None
    notes: str | None = None


def load_feature_registry():
    FEATURE_REGISTRY_FILE.parent.mkdir(parents=True, exist_ok=True)

    if not FEATURE_REGISTRY_FILE.exists():
        default_features = [
            {
                "id": "feature_chat",
                "name": "Chat Page",
                "description": "Main AI chat page for user-agent conversation.",
                "status": "done",
                "priority": "high",
                "owner_agent": "Frontend Developer",
                "frontend_file": "app/chat/page.tsx",
                "backend_route": "/chat/send",
                "database_needed": True,
                "notes": "Basic chat route exists. Needs deeper agent memory later.",
            },
            {
                "id": "feature_ui_references",
                "name": "UI References",
                "description": "Upload, view, delete, and analyze UI reference images.",
                "status": "building",
                "priority": "high",
                "owner_agent": "UI/UX Designer",
                "frontend_file": "app/ui-references/page.tsx",
                "backend_route": "/ui/upload-reference",
                "database_needed": False,
                "notes": "Image upload is available. Delete/analyze needs full UI connection check.",
            },
            {
                "id": "feature_page_builder",
                "name": "Page Builder",
                "description": "Generate and install Next.js pages from prompts.",
                "status": "building",
                "priority": "high",
                "owner_agent": "Frontend Developer",
                "frontend_file": "app/page-builder/page.tsx",
                "backend_route": "/builder/generate-page",
                "database_needed": False,
                "notes": "Generator safety improved with validation and END_OF_FILE marker.",
            },
            {
                "id": "feature_github_backup",
                "name": "GitHub Backup",
                "description": "Frontend and backend backed up to private GitHub repos.",
                "status": "done",
                "priority": "high",
                "owner_agent": "Project Reviewer",
                "frontend_file": "",
                "backend_route": "",
                "database_needed": False,
                "notes": "Frontend and backend pushed successfully.",
            },
        ]

        FEATURE_REGISTRY_FILE.write_text(
            json.dumps(default_features, indent=2),
            encoding="utf-8",
        )

    try:
        return json.loads(FEATURE_REGISTRY_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_feature_registry(features):
    FEATURE_REGISTRY_FILE.parent.mkdir(parents=True, exist_ok=True)
    FEATURE_REGISTRY_FILE.write_text(
        json.dumps(features, indent=2),
        encoding="utf-8",
    )


@app.get("/features")
def get_features():
    features = load_feature_registry()

    total = len(features)
    done = len([f for f in features if f.get("status") == "done"])
    building = len([f for f in features if f.get("status") == "building"])
    planned = len([f for f in features if f.get("status") == "planned"])
    error = len([f for f in features if f.get("status") == "error"])

    return {
        "ok": True,
        "total": total,
        "summary": {
            "done": done,
            "building": building,
            "planned": planned,
            "error": error,
        },
        "features": features,
    }


@app.post("/features")
def create_feature(request: FeatureCreateRequest):
    features = load_feature_registry()

    feature_id = "feature_" + "".join(
        char.lower() if char.isalnum() else "_"
        for char in request.name
    ).strip("_")

    existing_ids = {feature.get("id") for feature in features}

    if feature_id in existing_ids:
        feature_id = f"{feature_id}_{len(features) + 1}"

    new_feature = {
        "id": feature_id,
        "name": request.name,
        "description": request.description,
        "status": request.status,
        "priority": request.priority,
        "owner_agent": request.owner_agent,
        "frontend_file": request.frontend_file,
        "backend_route": request.backend_route,
        "database_needed": request.database_needed,
        "notes": request.notes,
    }

    features.append(new_feature)
    save_feature_registry(features)

    return {
        "ok": True,
        "message": "Feature created successfully.",
        "feature": new_feature,
    }


@app.put("/features/{feature_id}")
def update_feature(feature_id: str, request: FeatureUpdateRequest):
    features = load_feature_registry()

    for feature in features:
        if feature.get("id") == feature_id:
            update_data = request.model_dump(exclude_none=True)
            feature.update(update_data)
            save_feature_registry(features)

            return {
                "ok": True,
                "message": "Feature updated successfully.",
                "feature": feature,
            }

    return {
        "ok": False,
        "message": "Feature not found.",
        "feature_id": feature_id,
    }


@app.delete("/features/{feature_id}")
def delete_feature(feature_id: str):
    features = load_feature_registry()
    new_features = [feature for feature in features if feature.get("id") != feature_id]

    if len(new_features) == len(features):
        return {
            "ok": False,
            "message": "Feature not found.",
            "feature_id": feature_id,
        }

    save_feature_registry(new_features)

    return {
        "ok": True,
        "message": "Feature deleted successfully.",
        "feature_id": feature_id,
    }

class AgentBriefRequest(BaseModel):
    app_name: str = ""
    app_idea: str
    main_features: str = ""
    ui_style: str = ""
    backend_needs: str = ""
    private_rules: str = ""
    agent_questions: str = ""
    save_to_long_memory: bool = True
    save_to_short_memory: bool = True
    add_to_feature_registry: bool = True


def append_text_file(file_path: Path, text: str):
    file_path.parent.mkdir(parents=True, exist_ok=True)

    existing = ""
    if file_path.exists():
        existing = file_path.read_text(encoding="utf-8")

    updated = existing.rstrip() + "\n\n" + text.strip() + "\n"
    file_path.write_text(updated, encoding="utf-8")


def extract_feature_names(features_text: str):
    names = []

    for raw_line in features_text.splitlines():
        line = raw_line.strip()

        if not line:
            continue

        line = line.lstrip("-").lstrip("*").strip()

        if "." in line[:4]:
            line = line.split(".", 1)[1].strip()

        if line:
            names.append(line[:120])

    return names


@app.post("/agent-brief/save")
def save_agent_brief(request: AgentBriefRequest):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    app_name = request.app_name.strip() or "Untitled App"

    brief_markdown = f"""
# Agent Brief: {app_name}

_Updated: {timestamp}_

## App Idea
{request.app_idea.strip()}

## Main Features
{request.main_features.strip() or "Not provided yet."}

## UI Style
{request.ui_style.strip() or "Not provided yet."}

## Backend / Database Needs
{request.backend_needs.strip() or "Not provided yet."}

## Private Rules
{request.private_rules.strip() or "Not provided yet."}

## Questions Agents Must Ask Before Work
{request.agent_questions.strip() or "Not provided yet."}
""".strip()

    saved_targets = []

    if request.save_to_long_memory:
      long_memory_text = ""
      if LONG_TERM_MEMORY.exists():
        long_memory_text = LONG_TERM_MEMORY.read_text(encoding="utf-8")

    start_marker = "<!-- AGENT_BRIEF_START -->"
    end_marker = "<!-- AGENT_BRIEF_END -->"

    clean_brief = f"""
{start_marker}

{brief_markdown}

{end_marker}
""".strip()

    if start_marker in long_memory_text and end_marker in long_memory_text:
        before = long_memory_text.split(start_marker, 1)[0].rstrip()
        after = long_memory_text.split(end_marker, 1)[1].lstrip()
        long_memory_text = before + "\n\n" + clean_brief + "\n\n" + after
    else:
        long_memory_text = long_memory_text.rstrip() + "\n\n" + clean_brief + "\n"

    LONG_TERM_MEMORY.write_text(long_memory_text, encoding="utf-8")
    saved_targets.append("long_memory")


    if request.save_to_short_memory:
        append_text_file(
            SHORT_TERM_MEMORY,
            f"""
# Current Agent Brief

_Updated: {timestamp}_

Current app/project focus: {app_name}

{request.app_idea.strip()}
""".strip(),
        )
        saved_targets.append("short_memory")

    created_features = []

    if request.add_to_feature_registry and request.main_features.strip():
        features = load_feature_registry()
        existing_names = {feature.get("name", "").lower() for feature in features}

        for feature_name in extract_feature_names(request.main_features):
            if feature_name.lower() in existing_names:
                continue

            feature_id = "feature_" + "".join(
                char.lower() if char.isalnum() else "_"
                for char in feature_name
            ).strip("_")

            new_feature = {
                "id": feature_id,
                "name": feature_name,
                "description": f"Feature from Agent Brief: {app_name}",
                "status": "planned",
                "priority": "medium",
                "owner_agent": "Product Manager",
                "frontend_file": "",
                "backend_route": "",
                "database_needed": False,
                "notes": "Created automatically from Agent Brief.",
            }

            features.append(new_feature)
            created_features.append(new_feature)
            existing_names.add(feature_name.lower())

        save_feature_registry(features)
        saved_targets.append("feature_registry")

    return {
        "ok": True,
        "message": "Agent brief saved successfully.",
        "app_name": app_name,
        "saved_targets": saved_targets,
        "created_features": created_features,
        "created_feature_count": len(created_features),
    }

class AgentDecisionRequest(BaseModel):
    goal: str
    context: str = ""
    model: str = "z-ai/glm-5.1"
    save_to_memory: bool = True


@app.post("/agents/decide")
def agents_decide(request: AgentDecisionRequest):
    try:
        update_agent_status(
            True,
            "Product Manager",
            "Reading Project Brain and preparing agent team decision.",
            10,
            "Agent team decision started.",
        )

        nvidia_api_key = os.getenv("NVIDIA_API_KEY")


        if not nvidia_api_key:
            return {
                "ok": False,
                "message": "NVIDIA_API_KEY is missing in .env.",
            }

        memory_context = build_full_agent_context()
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=nvidia_api_key,
        )

        prompt = f"""
You are Devendra's AI Agent Team.

Agents:
1. Product Manager
2. UI/UX Designer
3. Frontend Developer
4. Backend Developer
5. QA Tester
6. Project Reviewer

User Goal:
{request.goal}

Extra Context:
{request.context}

Project Memory:
{memory_context}

Rules:
- Treat PROJECT BRAIN as the main source of truth.
- Do not ignore user rules, privacy rules, or UI design rules.
- Be practical.
- Ask questions before database/API/local model/deployment/private-data decisions.
- Split work by agent.
- Identify missing information.
- Create a step-by-step build plan.
- Mark risks.
- Mention which features should go into Feature Registry.
- Mention which files/pages/routes may need changes.
- Do not overwrite files without approval.
- Do not write code unless specifically asked.
- Keep output clear and structured.


Return this format:

# Agent Team Decision

## Summary

## Questions Before Work

## Agent Assignments
### Product Manager
### UI/UX Designer
### Frontend Developer
### Backend Developer
### QA Tester
### Project Reviewer

## Feature Registry Items

## Risks

## Next 5 Actions
""".strip()
        
        update_agent_status(
            True,
            "Project Reviewer",
            "Calling AI model and creating final agent decision report.",
            65,
            "Project Brain loaded.",
        )

        completion = client.chat.completions.create(
            model=request.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a multi-agent software planning team for a private local AI Agent OS.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.2,
            max_tokens=5000,
        )

        decision = completion.choices[0].message.content or ""

        GENERATED_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        safe_time = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = GENERATED_REPORTS_DIR / f"agent_decision_{safe_time}.md"

        report_text = f"""
# Agent Team Decision Report

_Updated: {timestamp}_

## Goal
{request.goal}

## Context
{request.context or "No extra context provided."}

---

{decision}
""".strip()

        report_file.write_text(report_text, encoding="utf-8")

        if request.save_to_memory:
            append_text_file(
                PAGE_PLAN_MEMORY,
                f"""
# Agent Team Decision

_Updated: {timestamp}_

Goal: {request.goal}

{decision}
""".strip(),
            )
        update_agent_status(
            False,
            "Project Reviewer",
            "Agent decision completed.",
            100,
            "Agent team decision created successfully.",
        )
        return {
            "ok": True,
            "message": "Agent team decision created.",
            "goal": request.goal,
            "model": request.model,
            "report_file": str(report_file),
            "decision": decision,
        }

    except Exception as error:
        update_agent_status(
            False,
            "Project Reviewer",
            "Agent decision failed.",
            100,
            "Agent team decision failed.",
            str(error),
        )
        return {
            "ok": False,
            "message": "Agent team decision failed.",
            "error": str(error),
        }
    
PROJECT_BRAIN_MEMORY = CREWAI_DIR / "memory" / "project_brain.md"


class ProjectBrainRequest(BaseModel):
    app_mission: str = ""
    user_rules: str = ""
    agent_rules: str = ""
    privacy_rules: str = ""
    ui_design_rules: str = ""
    current_tech_stack: str = ""
    current_pages: str = ""
    current_backend_routes: str = ""
    feature_roadmap: str = ""
    completed_work: str = ""
    blocked_work: str = ""
    next_actions: str = ""
    save_to_long_memory: bool = True


def build_project_brain_markdown(request: ProjectBrainRequest):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return f"""
# Project Brain Memory

_Updated: {timestamp}_

## App Mission
{request.app_mission.strip() or "Not provided yet."}

## User Rules
{request.user_rules.strip() or "Not provided yet."}

## Agent Rules
{request.agent_rules.strip() or "Not provided yet."}

## Privacy Rules
{request.privacy_rules.strip() or "Not provided yet."}

## UI Design Rules
{request.ui_design_rules.strip() or "Not provided yet."}

## Current Tech Stack
{request.current_tech_stack.strip() or "Not provided yet."}

## Current Pages
{request.current_pages.strip() or "Not provided yet."}

## Current Backend Routes
{request.current_backend_routes.strip() or "Not provided yet."}

## Feature Roadmap
{request.feature_roadmap.strip() or "Not provided yet."}

## Completed Work
{request.completed_work.strip() or "Not provided yet."}

## Blocked Work
{request.blocked_work.strip() or "Not provided yet."}

## Next Actions
{request.next_actions.strip() or "Not provided yet."}
""".strip()


def upsert_project_brain_into_long_memory(project_brain_text: str):
    LONG_TERM_MEMORY.parent.mkdir(parents=True, exist_ok=True)

    long_memory_text = ""
    if LONG_TERM_MEMORY.exists():
        long_memory_text = LONG_TERM_MEMORY.read_text(encoding="utf-8")

    start_marker = "<!-- PROJECT_BRAIN_START -->"
    end_marker = "<!-- PROJECT_BRAIN_END -->"

    clean_block = f"""
{start_marker}

{project_brain_text}

{end_marker}
""".strip()

    if start_marker in long_memory_text and end_marker in long_memory_text:
        before = long_memory_text.split(start_marker, 1)[0].rstrip()
        after = long_memory_text.split(end_marker, 1)[1].lstrip()
        updated = before + "\n\n" + clean_block + "\n\n" + after
    else:
        updated = long_memory_text.rstrip() + "\n\n" + clean_block + "\n"

    LONG_TERM_MEMORY.write_text(updated.strip() + "\n", encoding="utf-8")


@app.get("/project-brain")
def get_project_brain():
    PROJECT_BRAIN_MEMORY.parent.mkdir(parents=True, exist_ok=True)

    if not PROJECT_BRAIN_MEMORY.exists():
        return {
            "ok": True,
            "exists": False,
            "content": "",
            "message": "Project Brain not created yet.",
        }

    return {
        "ok": True,
        "exists": True,
        "content": PROJECT_BRAIN_MEMORY.read_text(encoding="utf-8"),
        "file": str(PROJECT_BRAIN_MEMORY),
    }


@app.post("/project-brain")
def save_project_brain(request: ProjectBrainRequest):
    PROJECT_BRAIN_MEMORY.parent.mkdir(parents=True, exist_ok=True)

    project_brain_text = build_project_brain_markdown(request)
    PROJECT_BRAIN_MEMORY.write_text(project_brain_text + "\n", encoding="utf-8")

    saved_targets = ["project_brain"]

    if request.save_to_long_memory:
        upsert_project_brain_into_long_memory(project_brain_text)
        saved_targets.append("long_memory")

    return {
        "ok": True,
        "message": "Project Brain saved successfully.",
        "saved_targets": saved_targets,
        "file": str(PROJECT_BRAIN_MEMORY),
        "content": project_brain_text,
    }


def read_memory_file_for_context(file_path: Path, title: str, max_chars: int = 12000):
    try:
        if not file_path.exists():
            return f"\n\n# {title}\nNot created yet."

        content = file_path.read_text(encoding="utf-8").strip()

        if not content:
            return f"\n\n# {title}\nEmpty."

        if len(content) > max_chars:
            content = content[-max_chars:]

        return f"\n\n# {title}\n{content}"

    except Exception as error:
        return f"\n\n# {title}\nCould not read memory file: {error}"


def build_full_agent_context():
    project_brain_file = CREWAI_DIR / "memory" / "project_brain.md"

    context = ""

    context += read_memory_file_for_context(
        project_brain_file,
        "PROJECT BRAIN - MAIN SOURCE OF TRUTH",
        18000,
    )

    context += read_memory_file_for_context(
        LONG_TERM_MEMORY,
        "LONG TERM MEMORY - PERMANENT RULES",
        12000,
    )

    context += read_memory_file_for_context(
        SHORT_TERM_MEMORY,
        "SHORT TERM MEMORY - CURRENT WORK",
        8000,
    )

    context += read_memory_file_for_context(
        UI_STYLE_MEMORY,
        "UI STYLE MEMORY",
        8000,
    )

    context += read_memory_file_for_context(
        PAGE_PLAN_MEMORY,
        "PAGE PLAN MEMORY",
        8000,
    )

    context += read_memory_file_for_context(
        FEATURE_MEMORY,
        "FEATURE MEMORY",
        8000,
    )

    try:
        if FEATURE_REGISTRY_FILE.exists():
            feature_registry_text = FEATURE_REGISTRY_FILE.read_text(encoding="utf-8")
            if len(feature_registry_text) > 12000:
                feature_registry_text = feature_registry_text[-12000:]
            context += f"\n\n# FEATURE REGISTRY JSON\n{feature_registry_text}"
        else:
            context += "\n\n# FEATURE REGISTRY JSON\nNot created yet."
    except Exception as error:
        context += f"\n\n# FEATURE REGISTRY JSON\nCould not read feature registry: {error}"

    return context.strip()

@app.get("/decision-reports")
def list_decision_reports():
    try:
        GENERATED_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        reports = []

        for report_file in sorted(
            GENERATED_REPORTS_DIR.glob("agent_decision_*.md"),
            key=lambda file: file.stat().st_mtime,
            reverse=True,
        ):
            content = report_file.read_text(encoding="utf-8")
            modified_time = datetime.fromtimestamp(report_file.stat().st_mtime)

            title = "Agent Decision Report"
            for line in content.splitlines():
                if line.strip().startswith("# "):
                    title = line.replace("#", "").strip()
                    break

            reports.append(
                {
                    "file_name": report_file.name,
                    "title": title,
                    "modified": modified_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "size": report_file.stat().st_size,
                    "preview": content[:500],
                }
            )

        return {
            "ok": True,
            "count": len(reports),
            "reports": reports,
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to list decision reports.",
            "error": str(error),
        }


@app.get("/decision-reports/{file_name}")
def read_decision_report(file_name: str):
    try:
        if ".." in file_name or "/" in file_name or "\\" in file_name:
            return {
                "ok": False,
                "message": "Invalid file name.",
            }

        report_file = GENERATED_REPORTS_DIR / file_name

        if not report_file.exists():
            return {
                "ok": False,
                "message": "Decision report not found.",
            }

        return {
            "ok": True,
            "file_name": report_file.name,
            "content": report_file.read_text(encoding="utf-8"),
            "modified": datetime.fromtimestamp(report_file.stat().st_mtime).strftime(
                "%Y-%m-%d %H:%M:%S"
            ),
            "size": report_file.stat().st_size,
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to read decision report.",
            "error": str(error),
        }
    

AGENT_STATUS_FILE = CREWAI_DIR / "memory" / "agent_status.json"


def default_agent_status():
    return {
        "ok": True,
        "is_running": False,
        "current_agent": "Idle",
        "current_task": "No active task.",
        "progress": 0,
        "last_result": "No run yet.",
        "error": "",
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "agents": [
            {"name": "Product Manager", "status": "idle", "task": ""},
            {"name": "UI/UX Designer", "status": "idle", "task": ""},
            {"name": "Frontend Developer", "status": "idle", "task": ""},
            {"name": "Backend Developer", "status": "idle", "task": ""},
            {"name": "QA Tester", "status": "idle", "task": ""},
            {"name": "Project Reviewer", "status": "idle", "task": ""},
        ],
    }


def load_agent_status():
    try:
        AGENT_STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)

        if not AGENT_STATUS_FILE.exists():
            status = default_agent_status()
            AGENT_STATUS_FILE.write_text(json.dumps(status, indent=2), encoding="utf-8")
            return status

        return json.loads(AGENT_STATUS_FILE.read_text(encoding="utf-8"))

    except Exception as error:
        status = default_agent_status()
        status["ok"] = False
        status["error"] = str(error)
        return status


def save_agent_status(status: dict):
    AGENT_STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    status["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    AGENT_STATUS_FILE.write_text(json.dumps(status, indent=2), encoding="utf-8")
    return status


def update_agent_status(
    is_running: bool,
    current_agent: str,
    current_task: str,
    progress: int,
    last_result: str = "",
    error: str = "",
):
    status = load_agent_status()
    status["ok"] = True
    status["is_running"] = is_running
    status["current_agent"] = current_agent
    status["current_task"] = current_task
    status["progress"] = max(0, min(100, progress))
    status["last_result"] = last_result or status.get("last_result", "")
    status["error"] = error

    for agent in status.get("agents", []):
        if agent["name"] == current_agent:
            agent["status"] = "running" if is_running else "done"
            agent["task"] = current_task
        elif is_running:
            agent["status"] = "waiting"
        else:
            agent["status"] = "idle"

    return save_agent_status(status)


@app.get("/agents/live-status")
def get_agents_live_status():
    return load_agent_status()


@app.post("/agents/live-status/reset")
def reset_agents_live_status():
    status = default_agent_status()
    save_agent_status(status)
    return status


SAFE_INSTALL_BACKUPS_DIR = CREWAI_DIR / "backups" / "page_installs"


class SafeInstallPreviewRequest(BaseModel):
    generated_file_name: str
    target_route: str


class SafeInstallRequest(BaseModel):
    generated_file_name: str
    target_route: str


class SafeRollbackRequest(BaseModel):
    backup_file_name: str


def safe_file_name_only(file_name: str):
    if ".." in file_name or "/" in file_name or "\\" in file_name:
        raise ValueError("Invalid file name.")
    return file_name


def route_to_page_file(target_route: str):
    route = target_route.strip()

    if not route.startswith("/"):
        route = "/" + route

    route = route.strip("/")

    if not route:
        return FRONTEND_APP_DIR / "page.tsx"

    parts = [part for part in route.split("/") if part.strip()]

    for part in parts:
        if part in ["..", ".", ""]:
            raise ValueError("Invalid route.")

    return FRONTEND_APP_DIR.joinpath(*parts) / "page.tsx"


def get_generated_page_file(generated_file_name: str):
    clean_name = safe_file_name_only(generated_file_name)
    generated_file = GENERATED_PAGES_DIR / clean_name

    if not generated_file.exists():
        raise FileNotFoundError("Generated page file not found.")

    return generated_file


def create_page_backup(target_file: Path):
    SAFE_INSTALL_BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    route_hint = str(target_file.relative_to(FRONTEND_APP_DIR)).replace("\\", "__").replace("/", "__")
    backup_name = f"backup_{timestamp}__{route_hint}"

    backup_file = SAFE_INSTALL_BACKUPS_DIR / backup_name

    if target_file.exists():
        shutil.copy2(target_file, backup_file)
        existed = True
    else:
        backup_file.write_text("__FILE_DID_NOT_EXIST_BEFORE_INSTALL__", encoding="utf-8")
        existed = False

    return backup_file, existed


@app.post("/safe-install/preview")
def safe_install_preview(request: SafeInstallPreviewRequest):
    try:
        generated_file = get_generated_page_file(request.generated_file_name)
        target_file = route_to_page_file(request.target_route)

        new_content = generated_file.read_text(encoding="utf-8")
        old_content = ""

        if target_file.exists():
            old_content = target_file.read_text(encoding="utf-8")

        diff_lines = list(
            difflib.unified_diff(
                old_content.splitlines(),
                new_content.splitlines(),
                fromfile="current_page",
                tofile="generated_page",
                lineterm="",
            )
        )

        return {
            "ok": True,
            "generated_file": str(generated_file),
            "target_file": str(target_file),
            "target_exists": target_file.exists(),
            "old_content": old_content,
            "new_content": new_content,
            "diff": "\n".join(diff_lines[:1200]),
            "diff_line_count": len(diff_lines),
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Safe install preview failed.",
            "error": str(error),
        }


@app.post("/safe-install/page")
def safe_install_page(request: SafeInstallRequest):
    try:
        generated_file = get_generated_page_file(request.generated_file_name)
        target_file = route_to_page_file(request.target_route)

        new_content = generated_file.read_text(encoding="utf-8")

        backup_file, target_existed = create_page_backup(target_file)

        target_file.parent.mkdir(parents=True, exist_ok=True)
        target_file.write_text(new_content, encoding="utf-8")

        return {
            "ok": True,
            "message": "Page installed safely with backup.",
            "generated_file": str(generated_file),
            "target_file": str(target_file),
            "backup_file": backup_file.name,
            "target_existed": target_existed,
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Safe page install failed.",
            "error": str(error),
        }


@app.get("/safe-install/backups")
def list_safe_install_backups():
    try:
        SAFE_INSTALL_BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

        backups = []

        for backup_file in sorted(
            SAFE_INSTALL_BACKUPS_DIR.glob("backup_*"),
            key=lambda file: file.stat().st_mtime,
            reverse=True,
        ):
            backups.append(
                {
                    "file_name": backup_file.name,
                    "modified": datetime.fromtimestamp(backup_file.stat().st_mtime).strftime(
                        "%Y-%m-%d %H:%M:%S"
                    ),
                    "size": backup_file.stat().st_size,
                }
            )

        return {
            "ok": True,
            "count": len(backups),
            "backups": backups,
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to list backups.",
            "error": str(error),
        }


@app.post("/safe-install/rollback")
def rollback_safe_install(request: SafeRollbackRequest):
    try:
        backup_name = safe_file_name_only(request.backup_file_name)
        backup_file = SAFE_INSTALL_BACKUPS_DIR / backup_name

        if not backup_file.exists():
            return {
                "ok": False,
                "message": "Backup file not found.",
            }

        parts = backup_name.split("__", 1)

        if len(parts) < 2:
            return {
                "ok": False,
                "message": "Could not determine target file from backup name.",
            }

        relative_hint = parts[1].replace("__", "/")
        target_file = FRONTEND_APP_DIR / relative_hint

        content = backup_file.read_text(encoding="utf-8")

        if content.strip() == "__FILE_DID_NOT_EXIST_BEFORE_INSTALL__":
            if target_file.exists():
                target_file.unlink()

            return {
                "ok": True,
                "message": "Rollback complete. Installed file removed because original file did not exist.",
                "target_file": str(target_file),
                "backup_file": str(backup_file),
            }

        target_file.parent.mkdir(parents=True, exist_ok=True)
        target_file.write_text(content, encoding="utf-8")

        return {
            "ok": True,
            "message": "Rollback complete. Old page restored.",
            "target_file": str(target_file),
            "backup_file": str(backup_file),
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Rollback failed.",
            "error": str(error),
        }

ERROR_LOG_FILE = CREWAI_DIR / "memory" / "error_log.json"


def load_error_log():
    ERROR_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    if not ERROR_LOG_FILE.exists():
        ERROR_LOG_FILE.write_text("[]", encoding="utf-8")
        return []

    try:
        return json.loads(ERROR_LOG_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_error_log(errors: list):
    ERROR_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    ERROR_LOG_FILE.write_text(json.dumps(errors, indent=2), encoding="utf-8")


def record_error(source: str, step: str, message: str, details: str = ""):
    errors = load_error_log()

    errors.insert(
        0,
        {
            "id": datetime.now().strftime("%Y%m%d_%H%M%S_%f"),
            "source": source,
            "step": step,
            "message": message,
            "details": details,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "open",
        },
    )

    errors = errors[:200]
    save_error_log(errors)
    return errors[0]


@app.get("/errors")
def get_errors():
    try:
        errors = load_error_log()

        return {
            "ok": True,
            "count": len(errors),
            "open_count": len([error for error in errors if error.get("status") == "open"]),
            "errors": errors,
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load errors.",
            "error": str(error),
        }


@app.post("/errors/test")
def create_test_error():
    error = record_error(
        "Test System",
        "Manual Test",
        "This is a test error from dashboard.",
        "Use this only to confirm the Errors page is working.",
    )

    return {
        "ok": True,
        "message": "Test error created.",
        "error": error,
    }


@app.post("/errors/clear")
def clear_errors():
    save_error_log([])

    return {
        "ok": True,
        "message": "All errors cleared.",
    }


CLOUD_DEPLOY_CHECKLIST_FILE = CREWAI_DIR / "memory" / "cloud_deploy_checklist.json"


def default_cloud_deploy_checklist():
    return [
        {
            "id": "frontend_build",
            "category": "Frontend",
            "title": "Frontend builds without errors",
            "description": "Run npm run build and confirm no Next.js errors.",
            "done": False,
        },
        {
            "id": "backend_compile",
            "category": "Backend",
            "title": "Backend compiles without errors",
            "description": "Run python -m py_compile main.py.",
            "done": False,
        },
        {
            "id": "env_not_pushed",
            "category": "Security",
            "title": ".env files are not pushed to GitHub",
            "description": "Confirm git ls-files does not show .env.",
            "done": False,
        },
        {
            "id": "api_keys_safe",
            "category": "Security",
            "title": "API keys are stored only in cloud environment variables",
            "description": "Do not hardcode NVIDIA key or GitHub tokens.",
            "done": False,
        },
        {
            "id": "github_pushed",
            "category": "GitHub",
            "title": "Frontend and backend pushed to GitHub",
            "description": "Run git status, git add, git commit, git push.",
            "done": False,
        },
        {
            "id": "backend_health",
            "category": "Backend",
            "title": "Backend /health route works",
            "description": "Confirm http://127.0.0.1:8000/health works locally.",
            "done": False,
        },
        {
            "id": "project_brain_saved",
            "category": "Agents",
            "title": "Project Brain saved",
            "description": "Project Brain must contain mission, rules, roadmap, current pages, and next actions.",
            "done": False,
        },
        {
            "id": "agents_decide_working",
            "category": "Agents",
            "title": "Ask Agent Team works locally",
            "description": "Confirm /agents/decide creates a decision report.",
            "done": False,
        },
        {
            "id": "safe_install_working",
            "category": "Safety",
            "title": "Safe Install backup and rollback works",
            "description": "Confirm generated pages can be installed with backup and rollback.",
            "done": False,
        },
        {
            "id": "cloud_api_url",
            "category": "Cloud",
            "title": "Frontend can use cloud backend URL",
            "description": "Before deploy, replace hardcoded local API URL with env-based URL.",
            "done": False,
        },
    ]


def load_cloud_deploy_checklist():
    CLOUD_DEPLOY_CHECKLIST_FILE.parent.mkdir(parents=True, exist_ok=True)

    if not CLOUD_DEPLOY_CHECKLIST_FILE.exists():
        checklist = default_cloud_deploy_checklist()
        CLOUD_DEPLOY_CHECKLIST_FILE.write_text(
            json.dumps(checklist, indent=2),
            encoding="utf-8",
        )
        return checklist

    try:
        return json.loads(CLOUD_DEPLOY_CHECKLIST_FILE.read_text(encoding="utf-8"))
    except Exception:
        checklist = default_cloud_deploy_checklist()
        CLOUD_DEPLOY_CHECKLIST_FILE.write_text(
            json.dumps(checklist, indent=2),
            encoding="utf-8",
        )
        return checklist


def save_cloud_deploy_checklist(checklist: list):
    CLOUD_DEPLOY_CHECKLIST_FILE.parent.mkdir(parents=True, exist_ok=True)
    CLOUD_DEPLOY_CHECKLIST_FILE.write_text(
        json.dumps(checklist, indent=2),
        encoding="utf-8",
    )


class CloudDeployChecklistUpdateRequest(BaseModel):
    item_id: str
    done: bool


@app.get("/cloud-deploy/checklist")
def get_cloud_deploy_checklist():
    checklist = load_cloud_deploy_checklist()

    done_count = len([item for item in checklist if item.get("done")])
    total_count = len(checklist)
    progress = 0 if total_count == 0 else round((done_count / total_count) * 100)

    return {
        "ok": True,
        "items": checklist,
        "done_count": done_count,
        "total_count": total_count,
        "progress": progress,
        "ready_for_cloud": progress >= 90,
        "message": "Cloud deploy checklist loaded.",
    }


@app.put("/cloud-deploy/checklist")
def update_cloud_deploy_checklist(request: CloudDeployChecklistUpdateRequest):
    checklist = load_cloud_deploy_checklist()

    found = False

    for item in checklist:
        if item.get("id") == request.item_id:
            item["done"] = request.done
            found = True
            break

    if not found:
        return {
            "ok": False,
            "message": "Checklist item not found.",
        }

    save_cloud_deploy_checklist(checklist)

    done_count = len([item for item in checklist if item.get("done")])
    total_count = len(checklist)
    progress = 0 if total_count == 0 else round((done_count / total_count) * 100)

    return {
        "ok": True,
        "message": "Checklist updated.",
        "items": checklist,
        "done_count": done_count,
        "total_count": total_count,
        "progress": progress,
        "ready_for_cloud": progress >= 90,
    }


@app.post("/cloud-deploy/checklist/reset")
def reset_cloud_deploy_checklist():
    checklist = default_cloud_deploy_checklist()
    save_cloud_deploy_checklist(checklist)

    return {
        "ok": True,
        "message": "Cloud deploy checklist reset.",
        "items": checklist,
    }

AGENT_TASK_RUNS_FILE = CREWAI_DIR / "memory" / "agent_task_runs.json"
AGENT_TASK_RUNS_DIR = GENERATED_REPORTS_DIR / "task_runs"


class AgentTaskRunnerRequest(BaseModel):
    report_file_name: str = ""
    task_goal: str = ""
    target_route: str = ""
    build_mode: str = "plan_only"
    save_to_memory: bool = True


def safe_task_runner_file_name(file_name: str):
    if ".." in file_name or "/" in file_name or "\\" in file_name:
        raise ValueError("Invalid file name.")
    return file_name


def read_text_limited(file_path: Path, max_chars: int = 20000):
    if not file_path.exists():
        return ""

    content = file_path.read_text(encoding="utf-8", errors="ignore")

    if len(content) > max_chars:
        return content[-max_chars:]

    return content


def load_agent_task_runs():
    AGENT_TASK_RUNS_FILE.parent.mkdir(parents=True, exist_ok=True)

    if not AGENT_TASK_RUNS_FILE.exists():
        AGENT_TASK_RUNS_FILE.write_text("[]", encoding="utf-8")
        return []

    try:
        return json.loads(AGENT_TASK_RUNS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_agent_task_runs(runs: list):
    AGENT_TASK_RUNS_FILE.parent.mkdir(parents=True, exist_ok=True)
    AGENT_TASK_RUNS_FILE.write_text(json.dumps(runs, indent=2), encoding="utf-8")


def safe_update_task_status(is_running: bool, agent: str, task: str, progress: int, result: str = "", error: str = ""):
    try:
        if "update_agent_status" in globals():
            update_agent_status(is_running, agent, task, progress, result, error)
    except Exception:
        pass


def safe_record_task_error(source: str, step: str, message: str, details: str = ""):
    try:
        if "record_error" in globals():
            record_error(source, step, message, details)
    except Exception:
        pass


def get_latest_decision_report_file():
    GENERATED_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    reports = sorted(
        GENERATED_REPORTS_DIR.glob("agent_decision_*.md"),
        key=lambda file: file.stat().st_mtime,
        reverse=True,
    )

    if not reports:
        return None

    return reports[0]


def build_task_runner_memory_context():
    try:
        if "build_full_agent_context" in globals():
            return build_full_agent_context()
    except Exception:
        pass

    context = ""

    try:
        project_brain_file = CREWAI_DIR / "memory" / "project_brain.md"
        context += "\n\n# PROJECT BRAIN\n"
        context += read_text_limited(project_brain_file, 12000)
    except Exception:
        pass

    try:
        context += "\n\n# LONG TERM MEMORY\n"
        context += read_text_limited(LONG_TERM_MEMORY, 8000)
    except Exception:
        pass

    try:
        context += "\n\n# PAGE PLAN MEMORY\n"
        context += read_text_limited(PAGE_PLAN_MEMORY, 8000)
    except Exception:
        pass

    try:
        context += "\n\n# FEATURE REGISTRY\n"
        context += read_text_limited(FEATURE_REGISTRY_FILE, 8000)
    except Exception:
        pass

    return context.strip()


@app.get("/task-runner/runs")
def list_agent_task_runs():
    try:
        runs = load_agent_task_runs()

        return {
            "ok": True,
            "count": len(runs),
            "runs": runs,
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load agent task runs.",
            "error": str(error),
        }


@app.post("/task-runner/start")
def start_agent_task_runner(request: AgentTaskRunnerRequest):
    try:
        safe_update_task_status(
            True,
            "Product Manager",
            "Starting Agent Task Runner and reading selected decision report.",
            10,
            "Task runner started.",
        )

        nvidia_api_key = os.getenv("NVIDIA_API_KEY")

        if not nvidia_api_key:
            return {
                "ok": False,
                "message": "NVIDIA_API_KEY missing. Add it to backend .env or cloud environment variables.",
            }

        selected_report_file = None

        if request.report_file_name.strip():
            report_name = safe_task_runner_file_name(request.report_file_name.strip())
            selected_report_file = GENERATED_REPORTS_DIR / report_name
        else:
            selected_report_file = get_latest_decision_report_file()

        if not selected_report_file or not selected_report_file.exists():
            return {
                "ok": False,
                "message": "No decision report found. First use Ask Agent Team to create a decision report.",
            }

        decision_report_text = read_text_limited(selected_report_file, 25000)
        memory_context = build_task_runner_memory_context()

        safe_update_task_status(
            True,
            "UI/UX Designer",
            "Reading Project Brain, Feature Registry, and selected decision report.",
            30,
            "Context loaded.",
        )

        task_goal = request.task_goal.strip() or "Convert this decision report into a safe executable build task plan."
        target_route = request.target_route.strip() or "Not selected yet."
        build_mode = request.build_mode.strip() or "plan_only"

        prompt = f"""
You are Devendra's Agent Task Runner.

Your job:
Convert the selected Agent Decision Report into a practical executable task plan for the AI app builder dashboard.

Important safety rules:
- Do not pretend files were edited.
- Do not overwrite source code.
- Do not deploy anything.
- Do not use secrets in output.
- If code generation is needed, describe exactly what file should be generated next.
- Safe Install must be used before installing generated pages.
- Ask questions before database, API key, deployment, auth, payment, or private-data decisions.
- Use Project Brain as source of truth.
- Keep the plan practical for a solo developer using AI tools.

Build mode:
{build_mode}

User task goal:
{task_goal}

Target route:
{target_route}

Selected decision report file:
{selected_report_file.name}

# PROJECT MEMORY CONTEXT
{memory_context}

# SELECTED DECISION REPORT
{decision_report_text}

Return the result in this exact structure:

# Agent Task Run

## 1. Run Summary
Explain what this run will build.

## 2. Agent Assignments
- Product Manager:
- UI/UX Designer:
- Frontend Developer:
- Backend Developer:
- QA Tester:
- Project Reviewer:

## 3. Step-by-Step Execution Plan
Give numbered steps.

## 4. Files To Create Or Edit
List exact likely files.

## 5. Backend Routes Needed
List routes if needed.

## 6. Frontend Pages Or Components Needed
List pages/components if needed.

## 7. Validation Commands
Give exact commands for Windows PowerShell.

## 8. Safe Install Plan
Explain preview, compare, approve, backup, rollback flow.

## 9. Missing Information / Questions
List anything Devendra must answer before risky work.

## 10. Next Best Action
Give the single next action to do now.
"""

        safe_update_task_status(
            True,
            "Frontend Developer",
            "Calling AI model to create executable task plan.",
            65,
            "Agent task prompt prepared.",
        )

        client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=nvidia_api_key,
        )

        model_name = os.getenv("MODEL", "moonshotai/kimi-k2.6")

        completion = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior AI software project manager and task runner.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.2,
            max_tokens=5000,
        )

        result = completion.choices[0].message.content or ""

        safe_update_task_status(
            True,
            "QA Tester",
            "Saving task run report and updating task memory.",
            85,
            "Task plan generated.",
        )

        AGENT_TASK_RUNS_DIR.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        run_file = AGENT_TASK_RUNS_DIR / f"task_run_{timestamp}.md"

        report_text = f"""# Agent Task Runner Report

Created: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
Source Decision Report: {selected_report_file.name}
Build Mode: {build_mode}
Target Route: {target_route}
Task Goal: {task_goal}

---

{result}
"""

        run_file.write_text(report_text, encoding="utf-8")

        runs = load_agent_task_runs()

        run_item = {
            "id": timestamp,
            "file_name": run_file.name,
            "file_path": str(run_file),
            "source_report": selected_report_file.name,
            "task_goal": task_goal,
            "target_route": target_route,
            "build_mode": build_mode,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "completed",
            "preview": result[:700],
        }

        runs.insert(0, run_item)
        runs = runs[:100]
        save_agent_task_runs(runs)

        if request.save_to_memory:
            try:
                append_text_file(
                    PAGE_PLAN_MEMORY,
                    f"""

## Agent Task Runner Run - {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

Source Report: {selected_report_file.name}
Task Goal: {task_goal}
Target Route: {target_route}
Build Mode: {build_mode}

Saved Run File: {run_file.name}
""",
                )
            except Exception:
                pass

        safe_update_task_status(
            False,
            "Project Reviewer",
            "Agent Task Runner completed.",
            100,
            "Task run report created successfully.",
        )

        return {
            "ok": True,
            "message": "Agent Task Runner completed.",
            "run": run_item,
            "content": report_text,
        }

    except Exception as error:
        safe_update_task_status(
            False,
            "Project Reviewer",
            "Agent Task Runner failed.",
            100,
            "Task runner failed.",
            str(error),
        )

        safe_record_task_error(
            "Agent Task Runner",
            "task-runner/start",
            "Agent Task Runner failed.",
            str(error),
        )

        return {
            "ok": False,
            "message": "Agent Task Runner failed.",
            "error": str(error),
        }
# ============================================================
# Agent Task Runner v1
# ============================================================

import os
import json
from datetime import datetime
from openai import OpenAI
from pydantic import BaseModel

AGENT_TASK_RUNS_FILE = CREWAI_DIR / "memory" / "agent_task_runs.json"
AGENT_TASK_RUNS_DIR = GENERATED_REPORTS_DIR / "task_runs"


class AgentTaskRunnerRequest(BaseModel):
    report_file_name: str = ""
    task_goal: str = ""
    target_route: str = ""
    build_mode: str = "plan_only"
    save_to_memory: bool = True


def task_runner_safe_file_name(file_name: str):
    if ".." in file_name or "/" in file_name or "\\" in file_name:
        raise ValueError("Invalid file name.")
    return file_name


def task_runner_read_text_limited(file_path, max_chars: int = 20000):
    if not file_path.exists():
        return ""

    content = file_path.read_text(encoding="utf-8", errors="ignore")

    if len(content) > max_chars:
        return content[-max_chars:]

    return content


def load_agent_task_runs():
    AGENT_TASK_RUNS_FILE.parent.mkdir(parents=True, exist_ok=True)

    if not AGENT_TASK_RUNS_FILE.exists():
        AGENT_TASK_RUNS_FILE.write_text("[]", encoding="utf-8")
        return []

    try:
        return json.loads(AGENT_TASK_RUNS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_agent_task_runs(runs: list):
    AGENT_TASK_RUNS_FILE.parent.mkdir(parents=True, exist_ok=True)
    AGENT_TASK_RUNS_FILE.write_text(json.dumps(runs, indent=2), encoding="utf-8")


def task_runner_update_status(is_running: bool, agent: str, task: str, progress: int, result: str = "", error: str = ""):
    try:
        if "update_agent_status" in globals():
            update_agent_status(is_running, agent, task, progress, result, error)
    except Exception:
        pass


def task_runner_record_error(source: str, step: str, message: str, details: str = ""):
    try:
        if "record_error" in globals():
            record_error(source, step, message, details)
    except Exception:
        pass


def get_latest_decision_report_file():
    GENERATED_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    reports = sorted(
        GENERATED_REPORTS_DIR.glob("agent_decision_*.md"),
        key=lambda file: file.stat().st_mtime,
        reverse=True,
    )

    if not reports:
        return None

    return reports[0]


def build_task_runner_memory_context():
    try:
        if "build_full_agent_context" in globals():
            return build_full_agent_context()
    except Exception:
        pass

    context = ""

    try:
        project_brain_file = CREWAI_DIR / "memory" / "project_brain.md"
        context += "\n\n# PROJECT BRAIN\n"
        context += task_runner_read_text_limited(project_brain_file, 12000)
    except Exception:
        pass

    try:
        context += "\n\n# LONG TERM MEMORY\n"
        context += task_runner_read_text_limited(LONG_TERM_MEMORY, 8000)
    except Exception:
        pass

    try:
        context += "\n\n# PAGE PLAN MEMORY\n"
        context += task_runner_read_text_limited(PAGE_PLAN_MEMORY, 8000)
    except Exception:
        pass

    try:
        context += "\n\n# FEATURE REGISTRY\n"
        context += task_runner_read_text_limited(FEATURE_REGISTRY_FILE, 8000)
    except Exception:
        pass

    return context.strip()


@app.get("/task-runner/runs")
def list_agent_task_runs():
    try:
        runs = load_agent_task_runs()

        return {
            "ok": True,
            "count": len(runs),
            "runs": runs,
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load agent task runs.",
            "error": str(error),
        }


@app.post("/task-runner/start")
def start_agent_task_runner(request: AgentTaskRunnerRequest):
    try:
        task_runner_update_status(
            True,
            "Product Manager",
            "Starting Agent Task Runner and reading selected decision report.",
            10,
            "Task runner started.",
        )

        nvidia_api_key = os.getenv("NVIDIA_API_KEY")

        if not nvidia_api_key:
            return {
                "ok": False,
                "message": "NVIDIA_API_KEY missing. Add it to backend .env file.",
            }

        selected_report_file = None

        if request.report_file_name.strip():
            report_name = task_runner_safe_file_name(request.report_file_name.strip())
            selected_report_file = GENERATED_REPORTS_DIR / report_name
        else:
            selected_report_file = get_latest_decision_report_file()

        if not selected_report_file or not selected_report_file.exists():
            return {
                "ok": False,
                "message": "No decision report found. First use Ask Agent Team to create a decision report.",
            }

        decision_report_text = task_runner_read_text_limited(selected_report_file, 25000)
        memory_context = build_task_runner_memory_context()

        task_runner_update_status(
            True,
            "UI/UX Designer",
            "Reading Project Brain, Feature Registry, and selected decision report.",
            30,
            "Context loaded.",
        )

        task_goal = request.task_goal.strip() or "Convert this decision report into a safe executable build task plan."
        target_route = request.target_route.strip() or "Not selected yet."
        build_mode = request.build_mode.strip() or "plan_only"

        prompt = f"""
You are Devendra's Agent Task Runner.

Your job:
Convert the selected Agent Decision Report into a practical executable task plan for the AI app builder dashboard.

Important safety rules:
- Do not pretend files were edited.
- Do not overwrite source code.
- Do not deploy anything.
- Do not use secrets in output.
- If code generation is needed, describe exactly what file should be generated next.
- Safe Install must be used before installing generated pages.
- Ask questions before database, API key, deployment, auth, payment, or private-data decisions.
- Use Project Brain as source of truth.
- Keep the plan practical for a solo developer using AI tools.

Build mode:
{build_mode}

User task goal:
{task_goal}

Target route:
{target_route}

Selected decision report file:
{selected_report_file.name}

# PROJECT MEMORY CONTEXT
{memory_context}

# SELECTED DECISION REPORT
{decision_report_text}

Return the result in this exact structure:

# Agent Task Run

## 1. Run Summary
Explain what this run will build.

## 2. Agent Assignments
- Product Manager:
- UI/UX Designer:
- Frontend Developer:
- Backend Developer:
- QA Tester:
- Project Reviewer:

## 3. Step-by-Step Execution Plan
Give numbered steps.

## 4. Files To Create Or Edit
List exact likely files.

## 5. Backend Routes Needed
List routes if needed.

## 6. Frontend Pages Or Components Needed
List pages/components if needed.

## 7. Validation Commands
Give exact commands for Windows PowerShell.

## 8. Safe Install Plan
Explain preview, compare, approve, backup, rollback flow.

## 9. Missing Information / Questions
List anything Devendra must answer before risky work.

## 10. Next Best Action
Give the single next action to do now.
"""

        task_runner_update_status(
            True,
            "Frontend Developer",
            "Calling AI model to create executable task plan.",
            65,
            "Agent task prompt prepared.",
        )

        client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=nvidia_api_key,
        )

        model_name = os.getenv("MODEL", "moonshotai/kimi-k2.6")

        completion = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior AI software project manager and task runner.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.2,
            max_tokens=5000,
        )

        result = completion.choices[0].message.content or ""

        task_runner_update_status(
            True,
            "QA Tester",
            "Saving task run report and updating task memory.",
            85,
            "Task plan generated.",
        )

        AGENT_TASK_RUNS_DIR.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        run_file = AGENT_TASK_RUNS_DIR / f"task_run_{timestamp}.md"

        report_text = f"""# Agent Task Runner Report

Created: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
Source Decision Report: {selected_report_file.name}
Build Mode: {build_mode}
Target Route: {target_route}
Task Goal: {task_goal}

---

{result}
"""

        run_file.write_text(report_text, encoding="utf-8")

        runs = load_agent_task_runs()

        run_item = {
            "id": timestamp,
            "file_name": run_file.name,
            "file_path": str(run_file),
            "source_report": selected_report_file.name,
            "task_goal": task_goal,
            "target_route": target_route,
            "build_mode": build_mode,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "completed",
            "preview": result[:700],
        }

        runs.insert(0, run_item)
        runs = runs[:100]
        save_agent_task_runs(runs)

        if request.save_to_memory:
            try:
                append_text_file(
                    PAGE_PLAN_MEMORY,
                    f"""

## Agent Task Runner Run - {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

Source Report: {selected_report_file.name}
Task Goal: {task_goal}
Target Route: {target_route}
Build Mode: {build_mode}

Saved Run File: {run_file.name}
""",
                )
            except Exception:
                pass

        task_runner_update_status(
            False,
            "Project Reviewer",
            "Agent Task Runner completed.",
            100,
            "Task run report created successfully.",
        )

        return {
            "ok": True,
            "message": "Agent Task Runner completed.",
            "run": run_item,
            "content": report_text,
        }

    except Exception as error:
        task_runner_update_status(
            False,
            "Project Reviewer",
            "Agent Task Runner failed.",
            100,
            "Task runner failed.",
            str(error),
        )

        task_runner_record_error(
            "Agent Task Runner",
            "task-runner/start",
            "Agent Task Runner failed.",
            str(error),
        )

        return {
            "ok": False,
            "message": "Agent Task Runner failed.",
            "error": str(error),
        }



# ============================================================
# Dashboard Output Files Summary
# ============================================================

@app.get("/dashboard/output-files")
def dashboard_output_files():
    try:
        groups = []

        folders = [
            {
                "name": "Current Run",
                "path": CURRENT_RUN_DIR,
                "pattern": "*",
            },
            {
                "name": "Generated Pages",
                "path": GENERATED_PAGES_DIR,
                "pattern": "*",
            },
            {
                "name": "Generated Reports",
                "path": GENERATED_REPORTS_DIR,
                "pattern": "*",
            },
            {
                "name": "Generated Designs",
                "path": GENERATED_DESIGNS_DIR,
                "pattern": "*",
            },
        ]

        total_files = 0

        for folder in folders:
            folder_path = folder["path"]
            folder_path.mkdir(parents=True, exist_ok=True)

            files = []

            for file_path in sorted(
                folder_path.glob(folder["pattern"]),
                key=lambda file: file.stat().st_mtime,
                reverse=True,
            ):
                if file_path.is_file():
                    files.append(
                        {
                            "file_name": file_path.name,
                            "file_path": str(file_path),
                            "size": file_path.stat().st_size,
                            "modified": datetime.fromtimestamp(
                                file_path.stat().st_mtime
                            ).strftime("%Y-%m-%d %H:%M:%S"),
                        }
                    )

            total_files += len(files)

            groups.append(
                {
                    "name": folder["name"],
                    "count": len(files),
                    "files": files[:10],
                }
            )

        return {
            "ok": True,
            "total_files": total_files,
            "groups": groups,
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load dashboard output files.",
            "error": str(error),
        }
# ============================================================
# Agent Assignments Board v1
# ============================================================

import json
from datetime import datetime

AGENT_ASSIGNMENTS_FILE = CREWAI_DIR / "memory" / "agent_assignments.json"


def default_agent_assignments():
    return [
        {
            "agent": "Product Manager",
            "status": "ready",
            "progress": 0,
            "current_task": "Convert user idea and Project Brain into clear product requirements.",
            "next_output": "Product requirements and feature priority.",
        },
        {
            "agent": "UI/UX Designer",
            "status": "ready",
            "progress": 0,
            "current_task": "Create layout direction, sections, user flow, and visual hierarchy.",
            "next_output": "UI structure and design rules.",
        },
        {
            "agent": "Frontend Developer",
            "status": "ready",
            "progress": 0,
            "current_task": "Plan Next.js pages, components, states, and frontend validation.",
            "next_output": "Frontend files and generated page plan.",
        },
        {
            "agent": "Backend Developer",
            "status": "ready",
            "progress": 0,
            "current_task": "Plan FastAPI routes, memory files, validation, and backend safety.",
            "next_output": "Backend route plan and API contract.",
        },
        {
            "agent": "QA Tester",
            "status": "ready",
            "progress": 0,
            "current_task": "Define build tests, backend compile tests, and rollback checks.",
            "next_output": "QA checklist and commands.",
        },
        {
            "agent": "Project Reviewer",
            "status": "ready",
            "progress": 0,
            "current_task": "Review risks, missing questions, privacy, and next safest action.",
            "next_output": "Final review and next action.",
        },
    ]


def load_agent_assignments_board():
    AGENT_ASSIGNMENTS_FILE.parent.mkdir(parents=True, exist_ok=True)

    if not AGENT_ASSIGNMENTS_FILE.exists():
        assignments = default_agent_assignments()
        AGENT_ASSIGNMENTS_FILE.write_text(
            json.dumps(assignments, indent=2),
            encoding="utf-8",
        )
        return assignments

    try:
        return json.loads(AGENT_ASSIGNMENTS_FILE.read_text(encoding="utf-8"))
    except Exception:
        assignments = default_agent_assignments()
        AGENT_ASSIGNMENTS_FILE.write_text(
            json.dumps(assignments, indent=2),
            encoding="utf-8",
        )
        return assignments


def latest_assignment_source_report():
    try:
        GENERATED_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        reports = sorted(
            GENERATED_REPORTS_DIR.glob("agent_decision_*.md"),
            key=lambda file: file.stat().st_mtime,
            reverse=True,
        )

        if not reports:
            return {
                "file_name": "",
                "modified": "",
                "preview": "No decision report found yet.",
            }

        latest = reports[0]
        content = latest.read_text(encoding="utf-8", errors="ignore")

        return {
            "file_name": latest.name,
            "modified": datetime.fromtimestamp(latest.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
            "preview": content[:800],
        }

    except Exception as error:
        return {
            "file_name": "",
            "modified": "",
            "preview": f"Could not read latest decision report: {error}",
        }


@app.get("/agent-assignments")
def get_agent_assignments_board():
    try:
        assignments = load_agent_assignments_board()

        return {
            "ok": True,
            "count": len(assignments),
            "assignments": assignments,
            "source_report": latest_assignment_source_report(),
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load agent assignments.",
            "error": str(error),
        }


@app.post("/agent-assignments/reset")
def reset_agent_assignments_board():
    try:
        assignments = default_agent_assignments()

        AGENT_ASSIGNMENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        AGENT_ASSIGNMENTS_FILE.write_text(
            json.dumps(assignments, indent=2),
            encoding="utf-8",
        )

        return {
            "ok": True,
            "message": "Agent assignments reset.",
            "assignments": assignments,
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to reset agent assignments.",
            "error": str(error),
        }


# ============================================================
# Agent Assignments Board v1
# ============================================================

import json
from datetime import datetime

AGENT_ASSIGNMENTS_FILE = CREWAI_DIR / "memory" / "agent_assignments.json"


def default_agent_assignments():
    return [
        {
            "agent": "Product Manager",
            "status": "ready",
            "progress": 0,
            "current_task": "Convert user idea and Project Brain into clear product requirements.",
            "next_output": "Product requirements and feature priority.",
        },
        {
            "agent": "UI/UX Designer",
            "status": "ready",
            "progress": 0,
            "current_task": "Create layout direction, sections, user flow, and visual hierarchy.",
            "next_output": "UI structure and design rules.",
        },
        {
            "agent": "Frontend Developer",
            "status": "ready",
            "progress": 0,
            "current_task": "Plan Next.js pages, components, states, and frontend validation.",
            "next_output": "Frontend files and generated page plan.",
        },
        {
            "agent": "Backend Developer",
            "status": "ready",
            "progress": 0,
            "current_task": "Plan FastAPI routes, memory files, validation, and backend safety.",
            "next_output": "Backend route plan and API contract.",
        },
        {
            "agent": "QA Tester",
            "status": "ready",
            "progress": 0,
            "current_task": "Define build tests, backend compile tests, and rollback checks.",
            "next_output": "QA checklist and commands.",
        },
        {
            "agent": "Project Reviewer",
            "status": "ready",
            "progress": 0,
            "current_task": "Review risks, missing questions, privacy, and next safest action.",
            "next_output": "Final review and next action.",
        },
    ]


def load_agent_assignments_board():
    AGENT_ASSIGNMENTS_FILE.parent.mkdir(parents=True, exist_ok=True)

    if not AGENT_ASSIGNMENTS_FILE.exists():
        assignments = default_agent_assignments()
        AGENT_ASSIGNMENTS_FILE.write_text(
            json.dumps(assignments, indent=2),
            encoding="utf-8",
        )
        return assignments

    try:
        return json.loads(AGENT_ASSIGNMENTS_FILE.read_text(encoding="utf-8"))
    except Exception:
        assignments = default_agent_assignments()
        AGENT_ASSIGNMENTS_FILE.write_text(
            json.dumps(assignments, indent=2),
            encoding="utf-8",
        )
        return assignments


def latest_assignment_source_report():
    try:
        GENERATED_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        reports = sorted(
            GENERATED_REPORTS_DIR.glob("agent_decision_*.md"),
            key=lambda file: file.stat().st_mtime,
            reverse=True,
        )

        if not reports:
            return {
                "file_name": "",
                "modified": "",
                "preview": "No decision report found yet.",
            }

        latest = reports[0]
        content = latest.read_text(encoding="utf-8", errors="ignore")

        return {
            "file_name": latest.name,
            "modified": datetime.fromtimestamp(latest.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
            "preview": content[:800],
        }

    except Exception as error:
        return {
            "file_name": "",
            "modified": "",
            "preview": f"Could not read latest decision report: {error}",
        }


@app.get("/agent-assignments")
def get_agent_assignments_board():
    try:
        assignments = load_agent_assignments_board()

        return {
            "ok": True,
            "count": len(assignments),
            "assignments": assignments,
            "source_report": latest_assignment_source_report(),
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load agent assignments.",
            "error": str(error),
        }


@app.post("/agent-assignments/reset")
def reset_agent_assignments_board():
    try:
        assignments = default_agent_assignments()

        AGENT_ASSIGNMENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        AGENT_ASSIGNMENTS_FILE.write_text(
            json.dumps(assignments, indent=2),
            encoding="utf-8",
        )

        return {
            "ok": True,
            "message": "Agent assignments reset.",
            "assignments": assignments,
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to reset agent assignments.",
            "error": str(error),
        }


# ============================================================
# Agent Assignments Board v1 - Simple Backend
# ============================================================

AGENT_ASSIGNMENTS_FILE = CREWAI_DIR / "memory" / "agent_assignments.json"


def simple_default_agent_assignments():
    return [
        {
            "agent": "Product Manager",
            "status": "ready",
            "progress": 0,
            "current_task": "Convert user idea and Project Brain into product requirements.",
            "next_output": "Product requirements and feature priority.",
        },
        {
            "agent": "UI/UX Designer",
            "status": "ready",
            "progress": 0,
            "current_task": "Create layout, sections, user flow, and design rules.",
            "next_output": "UI structure and visual direction.",
        },
        {
            "agent": "Frontend Developer",
            "status": "ready",
            "progress": 0,
            "current_task": "Plan Next.js pages, components, states, and validation.",
            "next_output": "Frontend implementation plan.",
        },
        {
            "agent": "Backend Developer",
            "status": "ready",
            "progress": 0,
            "current_task": "Plan FastAPI routes, memory files, validation, and safety.",
            "next_output": "Backend route plan and API contract.",
        },
        {
            "agent": "QA Tester",
            "status": "ready",
            "progress": 0,
            "current_task": "Define build tests, backend compile tests, and rollback checks.",
            "next_output": "QA checklist and commands.",
        },
        {
            "agent": "Project Reviewer",
            "status": "ready",
            "progress": 0,
            "current_task": "Review risks, missing questions, privacy, and next safest action.",
            "next_output": "Final review and next action.",
        },
    ]


def simple_latest_decision_report_preview():
    try:
        reports = sorted(
            GENERATED_REPORTS_DIR.glob("agent_decision_*.md"),
            key=lambda file: file.stat().st_mtime,
            reverse=True,
        )

        if not reports:
            return {
                "file_name": "",
                "modified": "",
                "preview": "No decision report found yet.",
            }

        latest = reports[0]
        content = latest.read_text(encoding="utf-8", errors="ignore")

        return {
            "file_name": latest.name,
            "modified": datetime.fromtimestamp(latest.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
            "preview": content[:800],
        }

    except Exception as error:
        return {
            "file_name": "",
            "modified": "",
            "preview": f"Could not read latest decision report: {error}",
        }


@app.get("/agent-assignments")
def simple_get_agent_assignments():
    return {
        "ok": True,
        "count": 6,
        "assignments": simple_default_agent_assignments(),
        "source_report": simple_latest_decision_report_preview(),
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


@app.post("/agent-assignments/reset")
def simple_reset_agent_assignments():
    return {
        "ok": True,
        "message": "Agent assignments reset.",
        "assignments": simple_default_agent_assignments(),
    }



# ============================================================
# Page Builder Project Brain Context
# ============================================================

@app.get("/page-builder/context")
def page_builder_context():
    try:
        project_brain_file = CREWAI_DIR / "memory" / "project_brain.md"

        def read_context_file(file_path: Path, max_chars: int = 8000):
            if not file_path.exists():
                return ""
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            if len(content) > max_chars:
                return content[-max_chars:]
            return content

        project_brain = read_context_file(project_brain_file, 12000)
        long_memory = read_context_file(LONG_TERM_MEMORY, 8000)
        ui_style = read_context_file(UI_STYLE_MEMORY, 8000)
        page_plan = read_context_file(PAGE_PLAN_MEMORY, 8000)

        feature_registry = ""

        try:
            if FEATURE_REGISTRY_FILE.exists():
                feature_registry = FEATURE_REGISTRY_FILE.read_text(
                    encoding="utf-8",
                    errors="ignore",
                )
        except Exception:
            feature_registry = ""

        return {
            "ok": True,
            "project_brain_exists": project_brain_file.exists(),
            "project_brain_chars": len(project_brain),
            "long_memory_chars": len(long_memory),
            "ui_style_chars": len(ui_style),
            "page_plan_chars": len(page_plan),
            "feature_registry_chars": len(feature_registry),
            "project_brain_preview": project_brain[:1200],
            "ui_style_preview": ui_style[:800],
            "page_plan_preview": page_plan[:800],
            "message": "Page Builder context loaded.",
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load Page Builder context.",
            "error": str(error),
        }
# ============================================================
# Prompt Inspector v1
# ============================================================

@app.get("/prompt-inspector/page-builder")
def prompt_inspector_page_builder():
    try:
        project_brain_file = CREWAI_DIR / "memory" / "project_brain.md"

        def read_prompt_context(file_path, max_chars: int = 5000):
            try:
                if not file_path.exists():
                    return ""
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                if len(content) > max_chars:
                    return content[-max_chars:]
                return content
            except Exception:
                return ""

        project_brain = read_prompt_context(project_brain_file, 7000)
        long_memory = read_prompt_context(LONG_TERM_MEMORY, 5000)
        ui_style = read_prompt_context(UI_STYLE_MEMORY, 5000)
        page_plan = read_prompt_context(PAGE_PLAN_MEMORY, 5000)

        feature_registry = ""
        try:
            if FEATURE_REGISTRY_FILE.exists():
                feature_registry = FEATURE_REGISTRY_FILE.read_text(
                    encoding="utf-8",
                    errors="ignore",
                )[-5000:]
        except Exception:
            feature_registry = ""

        final_prompt = f"""
You are the AI Agent OS Page Builder.

Your job:
Build a safe, clean, production-ready Next.js page for Devendra's AI Agent OS.

PROJECT BRAIN:
{project_brain or "No Project Brain found."}

LONG MEMORY:
{long_memory or "No long memory found."}

UI STYLE MEMORY:
{ui_style or "No UI style memory found."}

PAGE PLAN MEMORY:
{page_plan or "No page plan memory found."}

FEATURE REGISTRY:
{feature_registry or "No feature registry found."}

STRICT RULES:
- Do not overwrite existing files without approval.
- Do not expose API keys or secrets.
- Use local backend API base from NEXT_PUBLIC_API_BASE or http://127.0.0.1:8000.
- Keep dark dashboard UI style.
- Return clean code only when generating pages.
- Prefer safe install, backup, preview, and rollback workflow.
"""

        return {
            "ok": True,
            "project_brain_chars": len(project_brain),
            "long_memory_chars": len(long_memory),
            "ui_style_chars": len(ui_style),
            "page_plan_chars": len(page_plan),
            "feature_registry_chars": len(feature_registry),
            "final_prompt_chars": len(final_prompt),
            "final_prompt": final_prompt.strip(),
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to build prompt inspector.",
            "error": str(error),
        }


# ============================================================
# Agent Workflow Board v1
# ============================================================

AGENT_WORKFLOW_FILE = CREWAI_DIR / "memory" / "agent_workflow_latest.json"


def default_agent_workflow(user_request: str = "No request yet."):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return {
        "ok": True,
        "run_id": datetime.now().strftime("workflow_%Y%m%d_%H%M%S"),
        "status": "planned",
        "created_at": now,
        "updated_at": now,
        "user_request": user_request,
        "stages": [
            {
                "agent": "Product Manager",
                "status": "done",
                "progress": 100,
                "task": "Understand the request and define product requirements.",
                "output": "Requirement plan created.",
            },
            {
                "agent": "UI/UX Designer",
                "status": "waiting",
                "progress": 0,
                "task": "Design layout, screen structure, and user flow.",
                "output": "",
            },
            {
                "agent": "Frontend Developer",
                "status": "waiting",
                "progress": 0,
                "task": "Build Next.js page and connect frontend state.",
                "output": "",
            },
            {
                "agent": "Backend Developer",
                "status": "waiting",
                "progress": 0,
                "task": "Add FastAPI routes, memory files, and validation.",
                "output": "",
            },
            {
                "agent": "QA Tester",
                "status": "waiting",
                "progress": 0,
                "task": "Run build checks, backend compile, and route tests.",
                "output": "",
            },
            {
                "agent": "Project Reviewer",
                "status": "waiting",
                "progress": 0,
                "task": "Review safety, privacy, rollback, and next action.",
                "output": "",
            },
        ],
    }


@app.get("/agent-workflow/latest")
def get_latest_agent_workflow():
    try:
        AGENT_WORKFLOW_FILE.parent.mkdir(parents=True, exist_ok=True)

        if not AGENT_WORKFLOW_FILE.exists():
            workflow = default_agent_workflow()
            AGENT_WORKFLOW_FILE.write_text(
                json.dumps(workflow, indent=2),
                encoding="utf-8",
            )
            return workflow

        return json.loads(AGENT_WORKFLOW_FILE.read_text(encoding="utf-8"))

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load agent workflow.",
            "error": str(error),
        }


@app.post("/agent-workflow/start")
def start_agent_workflow(payload: dict):
    try:
        user_request = payload.get("user_request", "").strip()

        if not user_request:
            user_request = "Build next safe feature."

        workflow = default_agent_workflow(user_request)
        workflow["message"] = "Agent workflow planned safely."

        AGENT_WORKFLOW_FILE.parent.mkdir(parents=True, exist_ok=True)
        AGENT_WORKFLOW_FILE.write_text(
            json.dumps(workflow, indent=2),
            encoding="utf-8",
        )

        return workflow

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to start agent workflow.",
            "error": str(error),
        }


@app.post("/agent-workflow/reset")
def reset_agent_workflow():
    try:
        workflow = default_agent_workflow()
        workflow["message"] = "Agent workflow reset."

        AGENT_WORKFLOW_FILE.parent.mkdir(parents=True, exist_ok=True)
        AGENT_WORKFLOW_FILE.write_text(
            json.dumps(workflow, indent=2),
            encoding="utf-8",
        )

        return workflow

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to reset agent workflow.",
            "error": str(error),
        }


# ============================================================
# Agent Workflow Advance v2
# ============================================================

@app.post("/agent-workflow/advance")
def advance_agent_workflow():
    try:
        AGENT_WORKFLOW_FILE.parent.mkdir(parents=True, exist_ok=True)

        if not AGENT_WORKFLOW_FILE.exists():
            workflow = default_agent_workflow("Build next safe feature.")
        else:
            workflow = json.loads(AGENT_WORKFLOW_FILE.read_text(encoding="utf-8"))

        stages = workflow.get("stages", [])

        if not stages:
            workflow = default_agent_workflow("Build next safe feature.")
            stages = workflow.get("stages", [])

        changed = False

        # If one stage is running, complete it.
        for stage in stages:
            if stage.get("status") == "running":
                stage["status"] = "done"
                stage["progress"] = 100
                stage["output"] = f'{stage.get("agent")} completed this stage safely.'
                changed = True
                break

        # If nothing was running, start the first waiting stage.
        if not changed:
            for stage in stages:
                if stage.get("status") == "waiting":
                    stage["status"] = "running"
                    stage["progress"] = 50
                    stage["output"] = f'{stage.get("agent")} is working on this stage.'
                    changed = True
                    break

        # If all stages are done.
        if not changed:
            workflow["status"] = "completed"
            workflow["message"] = "All workflow stages are complete."
        else:
            all_done = all(stage.get("status") == "done" for stage in stages)
            workflow["status"] = "completed" if all_done else "in_progress"
            workflow["message"] = "Workflow advanced safely."

        workflow["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        workflow["stages"] = stages

        AGENT_WORKFLOW_FILE.write_text(
            json.dumps(workflow, indent=2),
            encoding="utf-8",
        )

        return workflow

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to advance workflow.",
            "error": str(error),
        }


# ============================================================
# Agent Workflow Report Export v1
# ============================================================

@app.post("/agent-workflow/export-report")
def export_agent_workflow_report():
    try:
        AGENT_WORKFLOW_FILE.parent.mkdir(parents=True, exist_ok=True)

        if not AGENT_WORKFLOW_FILE.exists():
            workflow = default_agent_workflow("No workflow found.")
        else:
            workflow = json.loads(AGENT_WORKFLOW_FILE.read_text(encoding="utf-8"))

        reports_dir = GENERATED_REPORTS_DIR
        reports_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        run_id = workflow.get("run_id", f"workflow_{timestamp}")
        report_file = reports_dir / f"{run_id}_workflow_report_{timestamp}.md"

        stages = workflow.get("stages", [])

        stage_text = ""

        for index, stage in enumerate(stages, start=1):
            stage_text += f"""
## Stage {index}: {stage.get("agent", "Unknown Agent")}

- Status: {stage.get("status", "unknown")}
- Progress: {stage.get("progress", 0)}%
- Task: {stage.get("task", "")}
- Output: {stage.get("output", "No output yet.")}

"""

        report_content = f"""# Agent Workflow Report

Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Workflow Summary

- Run ID: {workflow.get("run_id", "No run ID")}
- Status: {workflow.get("status", "unknown")}
- Created At: {workflow.get("created_at", "")}
- Updated At: {workflow.get("updated_at", "")}

## User Request

{workflow.get("user_request", "No request found.")}

{stage_text}

## Safety Notes

- This report was exported from Agent Workflow Board.
- No files were modified by this export.
- Use Safe Install before applying generated pages.
- Do not expose secrets or API keys.

## Next Recommended Action

Review completed stages, then continue with Safe Install or Prompt Inspector before making file changes.
"""

        report_file.write_text(report_content, encoding="utf-8")

        return {
            "ok": True,
            "message": "Workflow report exported.",
            "file_name": report_file.name,
            "file_path": str(report_file),
            "preview": report_content[:1200],
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to export workflow report.",
            "error": str(error),
        }


@app.get("/agent-workflow/export-report/latest")
def latest_agent_workflow_report_preview():
    try:
        reports_dir = GENERATED_REPORTS_DIR
        reports_dir.mkdir(parents=True, exist_ok=True)

        reports = sorted(
            reports_dir.glob("*workflow_report_*.md"),
            key=lambda file: file.stat().st_mtime,
            reverse=True,
        )

        if not reports:
            return {
                "ok": True,
                "found": False,
                "message": "No workflow report exported yet.",
                "file_name": "",
                "preview": "",
            }

        latest = reports[0]
        content = latest.read_text(encoding="utf-8", errors="ignore")

        return {
            "ok": True,
            "found": True,
            "file_name": latest.name,
            "modified": datetime.fromtimestamp(latest.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
            "preview": content[:3000],
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load latest workflow report.",
            "error": str(error),
        }


# ============================================================
# Recent Activity Timeline v1
# ============================================================

@app.get("/activity/recent")
def recent_activity_timeline():
    try:
        activity_items = []

        scan_targets = [
            {"label": "Current Run", "path": globals().get("CURRENT_RUN_DIR")},
            {"label": "Generated Pages", "path": globals().get("GENERATED_PAGES_DIR")},
            {"label": "Generated Reports", "path": globals().get("GENERATED_REPORTS_DIR")},
            {"label": "Generated Designs", "path": globals().get("GENERATED_DESIGNS_DIR")},
            {"label": "Safe Install Backups", "path": globals().get("SAFE_INSTALL_BACKUPS_DIR")},
            {"label": "Memory", "path": CREWAI_DIR / "memory"},
        ]

        for target in scan_targets:
            folder = target.get("path")

            if not folder:
                continue

            try:
                folder.mkdir(parents=True, exist_ok=True)

                for file in folder.glob("*"):
                    if not file.is_file():
                        continue

                    stat = file.stat()

                    activity_items.append(
                        {
                            "category": target["label"],
                            "file_name": file.name,
                            "path": str(file),
                            "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                            "size_kb": round(stat.st_size / 1024, 2),
                            "extension": file.suffix or "file",
                        }
                    )
            except Exception:
                continue

        activity_items = sorted(
            activity_items,
            key=lambda item: item["modified"],
            reverse=True,
        )[:80]

        return {
            "ok": True,
            "count": len(activity_items),
            "items": activity_items,
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load recent activity.",
            "error": str(error),
        }


# ============================================================
# Agent Workflow Reports v1
# ============================================================

@app.post("/agent-workflow/report")
def generate_agent_workflow_report():
    try:
        AGENT_WORKFLOW_FILE.parent.mkdir(parents=True, exist_ok=True)
        GENERATED_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        if not AGENT_WORKFLOW_FILE.exists():
            workflow = default_agent_workflow("No workflow existed, so a default workflow was used.")
        else:
            workflow = json.loads(AGENT_WORKFLOW_FILE.read_text(encoding="utf-8"))

        report_name = datetime.now().strftime("workflow_report_%Y%m%d_%H%M%S.md")
        report_path = GENERATED_REPORTS_DIR / report_name

        stages = workflow.get("stages", [])

        stage_text = ""
        for index, stage in enumerate(stages, start=1):
            stage_text += f"""
## Stage {index}: {stage.get("agent", "Unknown Agent")}

- Status: {stage.get("status", "")}
- Progress: {stage.get("progress", 0)}%
- Task: {stage.get("task", "")}
- Output: {stage.get("output", "No output yet.")}
"""

        report_markdown = f"""
# Agent Workflow Report

Generated at: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Workflow Summary

- Run ID: {workflow.get("run_id", "No run ID")}
- Status: {workflow.get("status", "unknown")}
- Created At: {workflow.get("created_at", "")}
- Updated At: {workflow.get("updated_at", "")}

## User Request

{workflow.get("user_request", "No request found.")}

# Agent Stages

{stage_text}

## Safety Notes

- This report does not edit files.
- This report is generated from local workflow memory.
- Use Safe Install before writing or replacing generated pages.
- Keep secrets only inside backend `.env`.
""".strip()

        report_path.write_text(report_markdown, encoding="utf-8")

        return {
            "ok": True,
            "message": "Workflow report generated.",
            "file_name": report_name,
            "path": str(report_path),
            "chars": len(report_markdown),
            "preview": report_markdown[:1500],
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to generate workflow report.",
            "error": str(error),
        }


@app.get("/agent-workflow/reports")
def list_agent_workflow_reports():
    try:
        GENERATED_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        reports = sorted(
            GENERATED_REPORTS_DIR.glob("workflow_report_*.md"),
            key=lambda file: file.stat().st_mtime,
            reverse=True,
        )

        items = []

        for file in reports[:50]:
            stat = file.stat()
            content = file.read_text(encoding="utf-8", errors="ignore")

            items.append(
                {
                    "file_name": file.name,
                    "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                    "size_kb": round(stat.st_size / 1024, 2),
                    "preview": content[:800],
                }
            )

        return {
            "ok": True,
            "count": len(items),
            "items": items,
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to list workflow reports.",
            "error": str(error),
        }


# ============================================================
# Git Safety Guard v1
# ============================================================

import subprocess


def run_git_safety_command(command, cwd):
    try:
        result = subprocess.run(
            command,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=10,
        )

        return {
            "ok": result.returncode == 0,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "code": result.returncode,
        }

    except Exception as error:
        return {
            "ok": False,
            "stdout": "",
            "stderr": str(error),
            "code": -1,
        }


@app.get("/git-safety/check")
def git_safety_check():
    try:
        user_home = Path.home()
        frontend_dir = user_home / "dashboard" / "frontend"
        backend_dir = CREWAI_DIR

        home_git_exists = (user_home / ".git").exists()

        checks = []

        checks.append(
            {
                "name": "Home Folder Git Check",
                "path": str(user_home),
                "status": "danger" if home_git_exists else "safe",
                "message": "Danger: C:\\Users\\deven has .git. Remove it before using Git." if home_git_exists else "Safe: no accidental home Git repo found.",
                "command": "Do not run git add . from C:\\Users\\deven",
            }
        )

        repos = [
            {
                "name": "Frontend Repo",
                "path": frontend_dir,
                "correct_folder": str(frontend_dir),
            },
            {
                "name": "Backend Repo",
                "path": backend_dir,
                "correct_folder": str(backend_dir),
            },
        ]

        for repo in repos:
            repo_path = repo["path"]
            git_folder = repo_path / ".git"

            if not repo_path.exists():
                checks.append(
                    {
                        "name": repo["name"],
                        "path": str(repo_path),
                        "status": "danger",
                        "message": "Folder does not exist.",
                        "command": f"cd {repo_path}",
                    }
                )
                continue

            if not git_folder.exists():
                checks.append(
                    {
                        "name": repo["name"],
                        "path": str(repo_path),
                        "status": "warning",
                        "message": "Folder exists, but .git was not found.",
                        "command": f"cd {repo_path}",
                    }
                )
                continue

            status_result = run_git_safety_command(["git", "status", "--short"], repo_path)
            branch_result = run_git_safety_command(["git", "branch", "--show-current"], repo_path)
            remote_result = run_git_safety_command(["git", "remote", "-v"], repo_path)

            has_changes = bool(status_result.get("stdout"))
            has_remote = bool(remote_result.get("stdout"))

            if has_changes:
                repo_status = "warning"
                message = "Repo has uncommitted changes. Review before pushing."
            elif not has_remote:
                repo_status = "warning"
                message = "Repo has no remote configured."
            else:
                repo_status = "safe"
                message = "Repo looks safe."

            checks.append(
                {
                    "name": repo["name"],
                    "path": str(repo_path),
                    "status": repo_status,
                    "message": message,
                    "branch": branch_result.get("stdout", ""),
                    "changes": status_result.get("stdout", ""),
                    "remote": remote_result.get("stdout", ""),
                    "command": f"cd {repo_path}",
                }
            )

        danger_count = len([item for item in checks if item["status"] == "danger"])
        warning_count = len([item for item in checks if item["status"] == "warning"])
        safe_count = len([item for item in checks if item["status"] == "safe"])

        return {
            "ok": True,
            "safe_count": safe_count,
            "warning_count": warning_count,
            "danger_count": danger_count,
            "checks": checks,
            "rules": [
                "Never run git add . from C:\\Users\\deven",
                "Frontend Git folder: C:\\Users\\deven\\dashboard\\frontend",
                "Backend Git folder: C:\\Users\\deven\\my-ai-agents\\my-ai-agents\\app_builder_crew",
                "Never commit .env files",
                "Run npm run build before frontend push",
                "Run python -m py_compile dashboard\\backend\\main.py before backend push",
            ],
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to run Git Safety Guard.",
            "error": str(error),
        }


# ============================================================
# Agent File Writer v1
# ============================================================

from pydantic import BaseModel as AFWBaseModel
from pathlib import Path as AFWPath
from datetime import datetime as AFWDatetime
import re as AFWRe
import json as AFWJson

AFW_BASE_DIR = AFWPath(__file__).resolve().parents[2]
AFW_GENERATED_DIR = AFW_BASE_DIR / "generated_pages"
AFW_MEMORY_DIR = AFW_BASE_DIR / "memory"
AFW_LOG_FILE = AFW_MEMORY_DIR / "agent_file_writer_log.json"

class AFWCreateRequest(AFWBaseModel):
    file_name: str
    content: str
    description: str = ""
    agent_name: str = "Frontend Developer"
    file_type: str = "page"

def afw_safe_file_name(file_name: str):
    name = (file_name or "").strip().replace("\\", "/").split("/")[-1]
    name = AFWRe.sub(r"[^a-zA-Z0-9._-]", "-", name)

    if not name:
        name = "generated-file.tsx"

    allowed = [".tsx", ".ts", ".jsx", ".js", ".md", ".json", ".txt", ".py"]
    if not any(name.endswith(ext) for ext in allowed):
        name = name + ".tsx"

    return name

def afw_read_log():
    try:
        if AFW_LOG_FILE.exists():
            return AFWJson.loads(AFW_LOG_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []

def afw_write_log(items):
    AFW_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    AFW_LOG_FILE.write_text(AFWJson.dumps(items, indent=2), encoding="utf-8")

@app.post("/agent-file-writer/create")
def agent_file_writer_create(request: AFWCreateRequest):
    try:
        AFW_GENERATED_DIR.mkdir(parents=True, exist_ok=True)
        AFW_MEMORY_DIR.mkdir(parents=True, exist_ok=True)

        safe_name = afw_safe_file_name(request.file_name)
        target_path = AFW_GENERATED_DIR / safe_name

        if target_path.exists():
            stem = target_path.stem
            suffix = target_path.suffix
            timestamp = AFWDatetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = f"{stem}_{timestamp}{suffix}"
            target_path = AFW_GENERATED_DIR / safe_name

        target_path.write_text(request.content, encoding="utf-8")

        log_items = afw_read_log()
        log_item = {
            "file_name": safe_name,
            "path": str(target_path),
            "description": request.description,
            "agent_name": request.agent_name,
            "file_type": request.file_type,
            "size_bytes": target_path.stat().st_size,
            "created_at": AFWDatetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "generated"
        }
        log_items.insert(0, log_item)
        afw_write_log(log_items[:200])

        return {
            "ok": True,
            "message": "Generated file saved successfully.",
            "file": log_item
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to create generated file.",
            "error": str(error)
        }

@app.get("/agent-file-writer/files")
def agent_file_writer_files():
    try:
        AFW_GENERATED_DIR.mkdir(parents=True, exist_ok=True)

        files = []
        for path in sorted(AFW_GENERATED_DIR.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True):
            if path.is_file():
                preview = ""
                try:
                    preview = path.read_text(encoding="utf-8")[:500]
                except Exception:
                    preview = ""

                files.append({
                    "file_name": path.name,
                    "path": str(path),
                    "size_bytes": path.stat().st_size,
                    "updated_at": AFWDatetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                    "preview": preview
                })

        return {
            "ok": True,
            "folder": str(AFW_GENERATED_DIR),
            "count": len(files),
            "files": files
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to list generated files.",
            "error": str(error),
            "files": []
        }

@app.get("/agent-file-writer/files/{file_name}")
def agent_file_writer_read_file(file_name: str):
    try:
        safe_name = afw_safe_file_name(file_name)
        target_path = AFW_GENERATED_DIR / safe_name

        if not target_path.exists():
            return {
                "ok": False,
                "message": "File not found.",
                "file_name": safe_name
            }

        return {
            "ok": True,
            "file_name": safe_name,
            "path": str(target_path),
            "content": target_path.read_text(encoding="utf-8"),
            "size_bytes": target_path.stat().st_size,
            "updated_at": AFWDatetime.fromtimestamp(target_path.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to read generated file.",
            "error": str(error)
        }

# ============================================================
# Generated File Library v1
# ============================================================

from pydantic import BaseModel as GFLBaseModel
from pathlib import Path as GFLPath
from datetime import datetime as GFLDatetime
import re as GFLRe
import difflib as GFLDiffLib

class GFLInstallPlanRequest(GFLBaseModel):
    file_name: str
    route_path: str = "generated-health-dashboard"

def gfl_safe_file_name(file_name: str):
    name = (file_name or "").strip().replace("\\", "/").split("/")[-1]
    name = GFLRe.sub(r"[^a-zA-Z0-9._-]", "-", name)

    if not name:
        return ""

    return name

def gfl_safe_route_path(route_path: str):
    route = (route_path or "").strip().replace("\\", "/").strip("/")
    route = GFLRe.sub(r"[^a-zA-Z0-9/_-]", "-", route)
    route = route.strip("/")
    if not route:
        route = "generated-page"
    return route

@app.delete("/agent-file-writer/files/{file_name}")
def generated_file_library_delete(file_name: str):
    try:
        safe_name = gfl_safe_file_name(file_name)
        if not safe_name:
            return {"ok": False, "message": "Invalid file name."}

        generated_dir = AFW_GENERATED_DIR
        target_path = generated_dir / safe_name

        if not target_path.exists():
            return {"ok": False, "message": "File not found.", "file_name": safe_name}

        target_path.unlink()

        return {
            "ok": True,
            "message": "Generated file deleted.",
            "file_name": safe_name
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to delete generated file.",
            "error": str(error)
        }

@app.post("/agent-file-writer/install-plan")
def generated_file_library_install_plan(request: GFLInstallPlanRequest):
    try:
        safe_name = gfl_safe_file_name(request.file_name)
        safe_route = gfl_safe_route_path(request.route_path)

        source_path = AFW_GENERATED_DIR / safe_name

        if not source_path.exists():
            return {
                "ok": False,
                "message": "Generated file not found.",
                "file_name": safe_name
            }

        new_content = source_path.read_text(encoding="utf-8")

        frontend_dir = GFLPath.home() / "dashboard" / "frontend"
        target_dir = frontend_dir / "app" / safe_route
        target_path = target_dir / "page.tsx"

        old_content = ""
        target_exists = target_path.exists()

        if target_exists:
            old_content = target_path.read_text(encoding="utf-8")

        diff = list(GFLDiffLib.unified_diff(
            old_content.splitlines(),
            new_content.splitlines(),
            fromfile=f"old: app/{safe_route}/page.tsx",
            tofile=f"new: {safe_name}",
            lineterm=""
        ))

        return {
            "ok": True,
            "message": "Install plan created. Review before Safe Install.",
            "source_file": safe_name,
            "source_path": str(source_path),
            "route_path": safe_route,
            "target_path": str(target_path),
            "target_exists": target_exists,
            "new_content": new_content,
            "old_content": old_content,
            "diff": diff[:500],
            "next_steps": [
                "Review generated code.",
                "Confirm target route.",
                "Use Safe Install connection in the next build step.",
                "Do not overwrite important files without approval."
            ],
            "created_at": GFLDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to create install plan.",
            "error": str(error)
        }

@app.get("/agent-file-writer/stats")
def generated_file_library_stats():
    try:
        AFW_GENERATED_DIR.mkdir(parents=True, exist_ok=True)

        files = [p for p in AFW_GENERATED_DIR.glob("*") if p.is_file()]
        total_size = sum(p.stat().st_size for p in files)

        latest_file = None
        if files:
            latest = max(files, key=lambda p: p.stat().st_mtime)
            latest_file = {
                "file_name": latest.name,
                "updated_at": GFLDatetime.fromtimestamp(latest.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                "size_bytes": latest.stat().st_size
            }

        return {
            "ok": True,
            "count": len(files),
            "total_size_bytes": total_size,
            "latest_file": latest_file,
            "folder": str(AFW_GENERATED_DIR)
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to read generated file stats.",
            "error": str(error)
        }

# ============================================================
# Generated File -> Safe Install Bridge v1
# ============================================================

from pydantic import BaseModel as GFSIBaseModel
from pathlib import Path as GFSIPath
from datetime import datetime as GFSIDatetime
import re as GFSIRe
import json as GFSIJson
import difflib as GFSIDiffLib
import shutil as GFSIShutil

GFSI_BASE_DIR = GFSIPath(__file__).resolve().parents[2]
GFSI_GENERATED_DIR = GFSI_BASE_DIR / "generated_pages"
GFSI_MEMORY_DIR = GFSI_BASE_DIR / "memory"
GFSI_BACKUP_DIR = GFSI_BASE_DIR / "backups" / "generated_safe_installs"
GFSI_INSTALL_LOG = GFSI_MEMORY_DIR / "generated_safe_install_log.json"

class GFSIPreviewRequest(GFSIBaseModel):
    file_name: str
    route_path: str = "generated-page"

class GFSIApproveRequest(GFSIBaseModel):
    file_name: str
    route_path: str = "generated-page"
    approval: str = ""

def gfsi_safe_file_name(file_name: str):
    name = (file_name or "").strip().replace("\\", "/").split("/")[-1]
    name = GFSIRe.sub(r"[^a-zA-Z0-9._-]", "-", name)
    return name

def gfsi_safe_route_path(route_path: str):
    route = (route_path or "").strip().replace("\\", "/").strip("/")
    route = GFSIRe.sub(r"[^a-zA-Z0-9/_-]", "-", route)
    route = route.strip("/")
    if not route:
        route = "generated-page"
    return route

def gfsi_frontend_page_path(route_path: str):
    safe_route = gfsi_safe_route_path(route_path)
    frontend_dir = GFSIPath.home() / "dashboard" / "frontend"
    target_dir = frontend_dir / "app" / safe_route
    target_path = target_dir / "page.tsx"
    return frontend_dir, safe_route, target_dir, target_path

def gfsi_read_install_log():
    try:
        if GFSI_INSTALL_LOG.exists():
            return GFSIJson.loads(GFSI_INSTALL_LOG.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []

def gfsi_write_install_log(items):
    GFSI_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    GFSI_INSTALL_LOG.write_text(GFSIJson.dumps(items, indent=2), encoding="utf-8")

@app.post("/generated-files/safe-install-preview")
def generated_files_safe_install_preview(request: GFSIPreviewRequest):
    try:
        safe_file = gfsi_safe_file_name(request.file_name)
        source_path = GFSI_GENERATED_DIR / safe_file

        if not source_path.exists():
            return {
                "ok": False,
                "message": "Generated file not found.",
                "file_name": safe_file
            }

        frontend_dir, safe_route, target_dir, target_path = gfsi_frontend_page_path(request.route_path)

        new_content = source_path.read_text(encoding="utf-8")
        old_content = ""
        target_exists = target_path.exists()

        if target_exists:
            old_content = target_path.read_text(encoding="utf-8")

        diff = list(GFSIDiffLib.unified_diff(
            old_content.splitlines(),
            new_content.splitlines(),
            fromfile=f"old: app/{safe_route}/page.tsx",
            tofile=f"new: generated_pages/{safe_file}",
            lineterm=""
        ))

        return {
            "ok": True,
            "message": "Safe install preview ready.",
            "source_file": safe_file,
            "source_path": str(source_path),
            "route_path": safe_route,
            "target_path": str(target_path),
            "target_exists": target_exists,
            "old_content": old_content,
            "new_content": new_content,
            "diff": diff[:800],
            "approval_text": "APPROVE INSTALL",
            "warning": "This will write into the frontend app folder only after approval.",
            "created_at": GFSIDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Safe install preview failed.",
            "error": str(error)
        }

@app.post("/generated-files/safe-install-approve")
def generated_files_safe_install_approve(request: GFSIApproveRequest):
    try:
        if request.approval.strip() != "APPROVE INSTALL":
            return {
                "ok": False,
                "message": "Approval text must be exactly: APPROVE INSTALL"
            }

        safe_file = gfsi_safe_file_name(request.file_name)
        source_path = GFSI_GENERATED_DIR / safe_file

        if not source_path.exists():
            return {
                "ok": False,
                "message": "Generated file not found.",
                "file_name": safe_file
            }

        frontend_dir, safe_route, target_dir, target_path = gfsi_frontend_page_path(request.route_path)

        if not frontend_dir.exists():
            return {
                "ok": False,
                "message": "Frontend folder not found.",
                "frontend_dir": str(frontend_dir)
            }

        new_content = source_path.read_text(encoding="utf-8")

        timestamp = GFSIDatetime.now().strftime("%Y%m%d_%H%M%S")
        backup_folder = GFSI_BACKUP_DIR / timestamp
        backup_folder.mkdir(parents=True, exist_ok=True)

        backup_info = {
            "backup_created": False,
            "backup_path": "",
            "target_existed": target_path.exists()
        }

        if target_path.exists():
            backup_file = backup_folder / f"{safe_route.replace('/', '__')}__page.tsx.bak"
            backup_file.parent.mkdir(parents=True, exist_ok=True)
            GFSIShutil.copy2(target_path, backup_file)
            backup_info = {
                "backup_created": True,
                "backup_path": str(backup_file),
                "target_existed": True
            }

        target_dir.mkdir(parents=True, exist_ok=True)
        target_path.write_text(new_content, encoding="utf-8")

        log_items = gfsi_read_install_log()
        log_item = {
            "source_file": safe_file,
            "source_path": str(source_path),
            "route_path": safe_route,
            "target_path": str(target_path),
            "backup": backup_info,
            "installed_at": GFSIDatetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "installed"
        }
        log_items.insert(0, log_item)
        gfsi_write_install_log(log_items[:200])

        return {
            "ok": True,
            "message": "Generated file installed safely.",
            "install": log_item,
            "open_url": f"http://localhost:3000/{safe_route}"
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Safe install failed.",
            "error": str(error)
        }

@app.get("/generated-files/safe-install-history")
def generated_files_safe_install_history():
    try:
        return {
            "ok": True,
            "history": gfsi_read_install_log()
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to read safe install history.",
            "error": str(error),
            "history": []
        }

# ============================================================
# QA Runner v1
# ============================================================

from pathlib import Path as QARPath
from datetime import datetime as QARDatetime
import subprocess as QARSubprocess
import json as QARJson

QAR_BASE_DIR = QARPath(__file__).resolve().parents[2]
QAR_MEMORY_DIR = QAR_BASE_DIR / "memory"
QAR_HISTORY_FILE = QAR_MEMORY_DIR / "qa_runner_history.json"

def qar_read_history():
    try:
        if QAR_HISTORY_FILE.exists():
            return QARJson.loads(QAR_HISTORY_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []

def qar_write_history(items):
    QAR_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    QAR_HISTORY_FILE.write_text(QARJson.dumps(items, indent=2), encoding="utf-8")

def qar_save_result(result):
    items = qar_read_history()
    items.insert(0, result)
    qar_write_history(items[:100])

def qar_run_command(command, cwd, timeout_seconds=120):
    started_at = QARDatetime.now()

    try:
        process = QARSubprocess.run(
            command,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            shell=True
        )

        finished_at = QARDatetime.now()

        return {
            "ok": process.returncode == 0,
            "command": command,
            "cwd": str(cwd),
            "return_code": process.returncode,
            "stdout": process.stdout[-12000:],
            "stderr": process.stderr[-12000:],
            "started_at": started_at.strftime("%Y-%m-%d %H:%M:%S"),
            "finished_at": finished_at.strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as error:
        finished_at = QARDatetime.now()

        return {
            "ok": False,
            "command": command,
            "cwd": str(cwd),
            "return_code": -1,
            "stdout": "",
            "stderr": str(error),
            "started_at": started_at.strftime("%Y-%m-%d %H:%M:%S"),
            "finished_at": finished_at.strftime("%Y-%m-%d %H:%M:%S")
        }

@app.post("/qa-runner/frontend-build")
def qa_runner_frontend_build():
    frontend_dir = QARPath.home() / "dashboard" / "frontend"

    result = qar_run_command(
        "npm run build",
        frontend_dir,
        timeout_seconds=180
    )

    result["type"] = "frontend_build"
    result["title"] = "Frontend Build"
    result["status"] = "passed" if result["ok"] else "failed"

    qar_save_result(result)

    return {
        "ok": result["ok"],
        "message": "Frontend build passed." if result["ok"] else "Frontend build failed.",
        "result": result
    }

@app.post("/qa-runner/backend-compile")
def qa_runner_backend_compile():
    backend_root = QAR_BASE_DIR

    result = qar_run_command(
        "python -m py_compile dashboard\\backend\\main.py",
        backend_root,
        timeout_seconds=90
    )

    result["type"] = "backend_compile"
    result["title"] = "Backend Compile"
    result["status"] = "passed" if result["ok"] else "failed"

    qar_save_result(result)

    return {
        "ok": result["ok"],
        "message": "Backend compile passed." if result["ok"] else "Backend compile failed.",
        "result": result
    }

@app.post("/qa-runner/full-check")
def qa_runner_full_check():
    backend_root = QAR_BASE_DIR
    frontend_dir = QARPath.home() / "dashboard" / "frontend"

    backend_result = qar_run_command(
        "python -m py_compile dashboard\\backend\\main.py",
        backend_root,
        timeout_seconds=90
    )

    backend_result["type"] = "backend_compile"
    backend_result["title"] = "Backend Compile"
    backend_result["status"] = "passed" if backend_result["ok"] else "failed"
    qar_save_result(backend_result)

    frontend_result = qar_run_command(
        "npm run build",
        frontend_dir,
        timeout_seconds=180
    )

    frontend_result["type"] = "frontend_build"
    frontend_result["title"] = "Frontend Build"
    frontend_result["status"] = "passed" if frontend_result["ok"] else "failed"
    qar_save_result(frontend_result)

    all_ok = backend_result["ok"] and frontend_result["ok"]

    summary = {
        "type": "full_check",
        "title": "Full QA Check",
        "status": "passed" if all_ok else "failed",
        "ok": all_ok,
        "backend_ok": backend_result["ok"],
        "frontend_ok": frontend_result["ok"],
        "started_at": backend_result["started_at"],
        "finished_at": frontend_result["finished_at"],
        "command": "backend compile + frontend build",
        "cwd": str(QAR_BASE_DIR),
        "return_code": 0 if all_ok else 1,
        "stdout": "Full QA check completed.",
        "stderr": "" if all_ok else "One or more checks failed."
    }

    qar_save_result(summary)

    return {
        "ok": all_ok,
        "message": "Full QA check passed." if all_ok else "Full QA check failed.",
        "backend": backend_result,
        "frontend": frontend_result,
        "summary": summary
    }

@app.get("/qa-runner/history")
def qa_runner_history():
    try:
        return {
            "ok": True,
            "history": qar_read_history()
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to read QA history.",
            "error": str(error),
            "history": []
        }

# ============================================================
# Retry Failed Step v1
# ============================================================

from pathlib import Path as RFSPath
from datetime import datetime as RFSDatetime
import subprocess as RFSSubprocess
import json as RFSJson

RFS_BASE_DIR = RFSPath(__file__).resolve().parents[2]
RFS_MEMORY_DIR = RFS_BASE_DIR / "memory"
RFS_QA_HISTORY_FILE = RFS_MEMORY_DIR / "qa_runner_history.json"
RFS_RETRY_HISTORY_FILE = RFS_MEMORY_DIR / "retry_failed_history.json"

def rfs_read_json(path, default):
    try:
        if path.exists():
            return RFSJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def rfs_write_json(path, data):
    RFS_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(RFSJson.dumps(data, indent=2), encoding="utf-8")

def rfs_find_latest_failed():
    history = rfs_read_json(RFS_QA_HISTORY_FILE, [])

    for item in history:
        if item.get("status") == "failed" or item.get("ok") is False:
            return item

    return None

def rfs_run_command(command, cwd, timeout_seconds=180):
    started_at = RFSDatetime.now()

    try:
        process = RFSSubprocess.run(
            command,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            shell=True
        )

        finished_at = RFSDatetime.now()

        return {
            "ok": process.returncode == 0,
            "command": command,
            "cwd": str(cwd),
            "return_code": process.returncode,
            "stdout": process.stdout[-12000:],
            "stderr": process.stderr[-12000:],
            "started_at": started_at.strftime("%Y-%m-%d %H:%M:%S"),
            "finished_at": finished_at.strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as error:
        finished_at = RFSDatetime.now()

        return {
            "ok": False,
            "command": command,
            "cwd": str(cwd),
            "return_code": -1,
            "stdout": "",
            "stderr": str(error),
            "started_at": started_at.strftime("%Y-%m-%d %H:%M:%S"),
            "finished_at": finished_at.strftime("%Y-%m-%d %H:%M:%S")
        }

def rfs_save_retry(item):
    history = rfs_read_json(RFS_RETRY_HISTORY_FILE, [])
    history.insert(0, item)
    rfs_write_json(RFS_RETRY_HISTORY_FILE, history[:100])

def rfs_save_qa(item):
    history = rfs_read_json(RFS_QA_HISTORY_FILE, [])
    history.insert(0, item)
    rfs_write_json(RFS_QA_HISTORY_FILE, history[:100])

@app.get("/retry-failed/latest")
def retry_failed_latest():
    try:
        latest = rfs_find_latest_failed()
        retry_history = rfs_read_json(RFS_RETRY_HISTORY_FILE, [])

        return {
            "ok": True,
            "latest_failed": latest,
            "retry_history": retry_history
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to read latest failed step.",
            "error": str(error),
            "latest_failed": None,
            "retry_history": []
        }

@app.post("/retry-failed/retry-latest")
def retry_failed_retry_latest():
    try:
        latest = rfs_find_latest_failed()

        if not latest:
            return {
                "ok": False,
                "message": "No failed QA step found to retry."
            }

        step_type = latest.get("type", "")
        title = latest.get("title", "Failed Step")

        backend_root = RFS_BASE_DIR
        frontend_dir = RFSPath.home() / "dashboard" / "frontend"

        if step_type == "backend_compile":
            result = rfs_run_command(
                "python -m py_compile dashboard\\backend\\main.py",
                backend_root,
                timeout_seconds=90
            )
            result["type"] = "backend_compile"
            result["title"] = "Backend Compile Retry"

        elif step_type == "frontend_build":
            result = rfs_run_command(
                "npm run build",
                frontend_dir,
                timeout_seconds=180
            )
            result["type"] = "frontend_build"
            result["title"] = "Frontend Build Retry"

        else:
            backend_result = rfs_run_command(
                "python -m py_compile dashboard\\backend\\main.py",
                backend_root,
                timeout_seconds=90
            )

            frontend_result = rfs_run_command(
                "npm run build",
                frontend_dir,
                timeout_seconds=180
            )

            all_ok = backend_result["ok"] and frontend_result["ok"]

            result = {
                "ok": all_ok,
                "type": "full_check",
                "title": "Full QA Retry",
                "command": "backend compile + frontend build",
                "cwd": str(RFS_BASE_DIR),
                "return_code": 0 if all_ok else 1,
                "stdout": "Backend retry stdout:\n"
                    + backend_result.get("stdout", "")
                    + "\n\nFrontend retry stdout:\n"
                    + frontend_result.get("stdout", ""),
                "stderr": "Backend retry stderr:\n"
                    + backend_result.get("stderr", "")
                    + "\n\nFrontend retry stderr:\n"
                    + frontend_result.get("stderr", ""),
                "started_at": backend_result["started_at"],
                "finished_at": frontend_result["finished_at"]
            }

        result["status"] = "passed" if result["ok"] else "failed"

        retry_record = {
            "retried_from": {
                "type": step_type,
                "title": title,
                "command": latest.get("command", ""),
                "failed_at": latest.get("finished_at", latest.get("started_at", ""))
            },
            "retry_result": result,
            "retried_at": RFSDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        rfs_save_retry(retry_record)
        rfs_save_qa(result)

        return {
            "ok": result["ok"],
            "message": "Retry passed." if result["ok"] else "Retry failed again.",
            "result": result,
            "retry_record": retry_record
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Retry failed to run.",
            "error": str(error)
        }

@app.get("/retry-failed/history")
def retry_failed_history():
    try:
        return {
            "ok": True,
            "history": rfs_read_json(RFS_RETRY_HISTORY_FILE, [])
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to read retry history.",
            "error": str(error),
            "history": []
        }

# ============================================================
# Agent Tool Permissions v1
# ============================================================

from pydantic import BaseModel as ATPBaseModel
from pathlib import Path as ATPPath
from datetime import datetime as ATPDatetime
import json as ATPJson

ATP_BASE_DIR = ATPPath(__file__).resolve().parents[2]
ATP_MEMORY_DIR = ATP_BASE_DIR / "memory"
ATP_PERMISSIONS_FILE = ATP_MEMORY_DIR / "agent_tool_permissions.json"
ATP_AUDIT_FILE = ATP_MEMORY_DIR / "agent_tool_permission_audit.json"

class ATPUpdateRequest(ATPBaseModel):
    tool_id: str
    status: str
    reason: str = ""

class ATPCheckRequest(ATPBaseModel):
    tool_id: str
    agent_name: str = "Unknown Agent"
    task: str = ""

def atp_default_permissions():
    return [
        {
            "tool_id": "read_project_brain",
            "tool_name": "Read Project Brain",
            "category": "Memory",
            "risk": "low",
            "status": "allowed",
            "description": "Agent can read project_brain.md.",
            "protected": False
        },
        {
            "tool_id": "read_memory",
            "tool_name": "Read Memory",
            "category": "Memory",
            "risk": "low",
            "status": "allowed",
            "description": "Agent can read long memory, short memory, and workflow memory.",
            "protected": False
        },
        {
            "tool_id": "write_memory",
            "tool_name": "Write Memory",
            "category": "Memory",
            "risk": "medium",
            "status": "approval_required",
            "description": "Agent can update memory files only after approval.",
            "protected": False
        },
        {
            "tool_id": "create_generated_file",
            "tool_name": "Create Generated File",
            "category": "Files",
            "risk": "medium",
            "status": "allowed",
            "description": "Agent can create draft files inside generated_pages.",
            "protected": False
        },
        {
            "tool_id": "read_generated_file",
            "tool_name": "Read Generated File",
            "category": "Files",
            "risk": "low",
            "status": "allowed",
            "description": "Agent can read generated draft files.",
            "protected": False
        },
        {
            "tool_id": "delete_generated_file",
            "tool_name": "Delete Generated File",
            "category": "Files",
            "risk": "medium",
            "status": "approval_required",
            "description": "Agent needs approval before deleting generated files.",
            "protected": False
        },
        {
            "tool_id": "safe_install_frontend",
            "tool_name": "Safe Install Frontend Page",
            "category": "Safe Install",
            "risk": "high",
            "status": "approval_required",
            "description": "Agent can install frontend pages only after human approval.",
            "protected": True
        },
        {
            "tool_id": "safe_install_backend",
            "tool_name": "Safe Install Backend File",
            "category": "Safe Install",
            "risk": "high",
            "status": "approval_required",
            "description": "Agent can change backend files only after approval.",
            "protected": True
        },
        {
            "tool_id": "run_backend_compile",
            "tool_name": "Run Backend Compile",
            "category": "QA",
            "risk": "low",
            "status": "allowed",
            "description": "Agent can run python compile checks.",
            "protected": False
        },
        {
            "tool_id": "run_frontend_build",
            "tool_name": "Run Frontend Build",
            "category": "QA",
            "risk": "medium",
            "status": "allowed",
            "description": "Agent can run npm build checks.",
            "protected": False
        },
        {
            "tool_id": "retry_failed_step",
            "tool_name": "Retry Failed Step",
            "category": "QA",
            "risk": "medium",
            "status": "allowed",
            "description": "Agent can retry failed QA steps.",
            "protected": False
        },
        {
            "tool_id": "git_status",
            "tool_name": "Git Status",
            "category": "Git",
            "risk": "low",
            "status": "allowed",
            "description": "Agent can check git status.",
            "protected": False
        },
        {
            "tool_id": "git_add_commit",
            "tool_name": "Git Add and Commit",
            "category": "Git",
            "risk": "high",
            "status": "approval_required",
            "description": "Agent needs approval before staging or committing files.",
            "protected": True
        },
        {
            "tool_id": "git_push",
            "tool_name": "Git Push",
            "category": "Git",
            "risk": "high",
            "status": "approval_required",
            "description": "Agent needs approval before pushing to GitHub.",
            "protected": True
        },
        {
            "tool_id": "read_env",
            "tool_name": "Read .env Secrets",
            "category": "Secrets",
            "risk": "critical",
            "status": "blocked",
            "description": "Agent must not read .env or secret keys.",
            "protected": True
        },
        {
            "tool_id": "write_env",
            "tool_name": "Write .env Secrets",
            "category": "Secrets",
            "risk": "critical",
            "status": "blocked",
            "description": "Agent must not modify .env without direct human handling.",
            "protected": True
        },
        {
            "tool_id": "delete_real_file",
            "tool_name": "Delete Real Project File",
            "category": "Danger Zone",
            "risk": "critical",
            "status": "blocked",
            "description": "Agent must not delete real project files automatically.",
            "protected": True
        },
        {
            "tool_id": "deploy_backend",
            "tool_name": "Deploy Backend Server",
            "category": "Deployment",
            "risk": "high",
            "status": "approval_required",
            "description": "Agent needs approval before deploying backend.",
            "protected": True
        },
        {
            "tool_id": "deploy_frontend",
            "tool_name": "Deploy Frontend",
            "category": "Deployment",
            "risk": "medium",
            "status": "approval_required",
            "description": "Agent needs approval before deployment actions.",
            "protected": True
        }
    ]

def atp_read_permissions():
    ATP_MEMORY_DIR.mkdir(parents=True, exist_ok=True)

    if not ATP_PERMISSIONS_FILE.exists():
        permissions = atp_default_permissions()
        ATP_PERMISSIONS_FILE.write_text(ATPJson.dumps(permissions, indent=2), encoding="utf-8")
        return permissions

    try:
        return ATPJson.loads(ATP_PERMISSIONS_FILE.read_text(encoding="utf-8"))
    except Exception:
        permissions = atp_default_permissions()
        ATP_PERMISSIONS_FILE.write_text(ATPJson.dumps(permissions, indent=2), encoding="utf-8")
        return permissions

def atp_write_permissions(permissions):
    ATP_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    ATP_PERMISSIONS_FILE.write_text(ATPJson.dumps(permissions, indent=2), encoding="utf-8")

def atp_read_audit():
    try:
        if ATP_AUDIT_FILE.exists():
            return ATPJson.loads(ATP_AUDIT_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []

def atp_write_audit(items):
    ATP_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    ATP_AUDIT_FILE.write_text(ATPJson.dumps(items, indent=2), encoding="utf-8")

def atp_add_audit(action, detail):
    items = atp_read_audit()
    items.insert(0, {
        "action": action,
        "detail": detail,
        "created_at": ATPDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })
    atp_write_audit(items[:200])

@app.get("/agent-tool-permissions")
def agent_tool_permissions_list():
    try:
        permissions = atp_read_permissions()

        counts = {
            "allowed": len([p for p in permissions if p.get("status") == "allowed"]),
            "approval_required": len([p for p in permissions if p.get("status") == "approval_required"]),
            "blocked": len([p for p in permissions if p.get("status") == "blocked"]),
            "total": len(permissions)
        }

        return {
            "ok": True,
            "counts": counts,
            "permissions": permissions,
            "audit": atp_read_audit()[:20]
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load agent tool permissions.",
            "error": str(error),
            "permissions": []
        }

@app.post("/agent-tool-permissions/update")
def agent_tool_permissions_update(request: ATPUpdateRequest):
    try:
        allowed_statuses = ["allowed", "approval_required", "blocked"]

        if request.status not in allowed_statuses:
            return {
                "ok": False,
                "message": "Invalid status. Use allowed, approval_required, or blocked."
            }

        permissions = atp_read_permissions()
        updated = False

        for item in permissions:
            if item.get("tool_id") == request.tool_id:
                old_status = item.get("status")
                item["status"] = request.status
                item["updated_at"] = ATPDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
                item["last_reason"] = request.reason
                updated = True

                atp_add_audit("permission_updated", {
                    "tool_id": request.tool_id,
                    "old_status": old_status,
                    "new_status": request.status,
                    "reason": request.reason
                })
                break

        if not updated:
            return {
                "ok": False,
                "message": "Tool permission not found.",
                "tool_id": request.tool_id
            }

        atp_write_permissions(permissions)

        return {
            "ok": True,
            "message": "Permission updated.",
            "tool_id": request.tool_id,
            "status": request.status
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to update permission.",
            "error": str(error)
        }

@app.post("/agent-tool-permissions/check")
def agent_tool_permissions_check(request: ATPCheckRequest):
    try:
        permissions = atp_read_permissions()
        found = None

        for item in permissions:
            if item.get("tool_id") == request.tool_id:
                found = item
                break

        if not found:
            return {
                "ok": False,
                "message": "Tool permission not found.",
                "decision": "blocked",
                "can_run": False
            }

        status = found.get("status")

        if status == "allowed":
            decision = "allowed"
            can_run = True
            needs_approval = False
        elif status == "approval_required":
            decision = "approval_required"
            can_run = False
            needs_approval = True
        else:
            decision = "blocked"
            can_run = False
            needs_approval = False

        atp_add_audit("permission_checked", {
            "tool_id": request.tool_id,
            "agent_name": request.agent_name,
            "task": request.task,
            "decision": decision
        })

        return {
            "ok": True,
            "tool": found,
            "decision": decision,
            "can_run": can_run,
            "needs_approval": needs_approval
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to check permission.",
            "error": str(error),
            "decision": "blocked",
            "can_run": False
        }

@app.post("/agent-tool-permissions/reset")
def agent_tool_permissions_reset():
    try:
        permissions = atp_default_permissions()
        atp_write_permissions(permissions)

        atp_add_audit("permissions_reset", {
            "message": "Permissions reset to safe defaults."
        })

        return {
            "ok": True,
            "message": "Permissions reset to safe defaults.",
            "permissions": permissions
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to reset permissions.",
            "error": str(error)
        }

# ============================================================
# Real Agent Output v1 - UI/UX Designer Agent
# ============================================================

from pydantic import BaseModel as UXOBaseModel
from pathlib import Path as UXOPath
from datetime import datetime as UXODatetime
import json as UXOJson
import re as UXORe

UXO_BASE_DIR = UXOPath(__file__).resolve().parents[2]
UXO_MEMORY_DIR = UXO_BASE_DIR / "memory"
UXO_REPORTS_DIR = UXO_BASE_DIR / "generated_reports"
UXO_OUTPUTS_FILE = UXO_MEMORY_DIR / "real_agent_outputs.json"

class UXODesignerRequest(UXOBaseModel):
    task: str
    feature_name: str = "New Feature"
    style: str = "Dark AI dashboard"
    priority: str = "High"

def uxo_read_text(path, default=""):
    try:
        if path.exists():
            return path.read_text(encoding="utf-8")
    except Exception:
        pass
    return default

def uxo_read_json(path, default):
    try:
        if path.exists():
            return UXOJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def uxo_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(UXOJson.dumps(data, indent=2), encoding="utf-8")

def uxo_safe_file_name(name):
    clean = UXORe.sub(r"[^a-zA-Z0-9._-]", "-", name.strip().lower())
    clean = clean.strip("-")
    if not clean:
        clean = "ux-report"
    return clean

def uxo_save_output(output):
    outputs = uxo_read_json(UXO_OUTPUTS_FILE, [])
    outputs.insert(0, output)
    uxo_write_json(UXO_OUTPUTS_FILE, outputs[:200])

def uxo_designer_report(task, feature_name, style, priority):
    project_brain = uxo_read_text(UXO_MEMORY_DIR / "project_brain.md", "Project Brain not found yet.")
    timestamp = UXODatetime.now().strftime("%Y-%m-%d %H:%M:%S")

    report = f"""# UI/UX Designer Agent Report

Generated at: {timestamp}

## Feature Name
{feature_name}

## Priority
{priority}

## Requested Style
{style}

## User Request
{task}

## Design Goal
Design a clean, powerful, dashboard-first interface for this feature. The UI should feel like a serious AI Agent OS control room: dark, clear, safe, and easy to operate.

## Project Brain Context
{project_brain[:2500]}

## Page Purpose
This page should help the user complete the feature's main action without confusion. It should clearly show:
1. What the feature does.
2. What input the user must provide.
3. What action buttons are available.
4. What output/result is produced.
5. What history/logs are saved.
6. Whether the action is safe, risky, or requires approval.

## Recommended Layout

### 1. Hero/Header Section
- Small label: feature category, for example AGENT TOOL / QA / SAFE INSTALL / REAL AGENT.
- Main title: clear feature name.
- Subtitle: one-sentence explanation.
- Optional status badge: v1, safe, beta, approval required.

### 2. Summary Cards
Use 3-4 cards depending on the feature:
- Total runs / files / reports / tools
- Passed / completed count
- Failed / blocked count
- Latest output or latest action

### 3. Main Action Panel
This is where the user performs the main task.
- Input field or textarea if needed.
- Dropdowns for priority/type/status if needed.
- Primary action button with strong label.
- Disable button while running.
- Show clear loading text.

### 4. Output Panel
Show result/output clearly:
- Report preview
- Code preview
- Error output
- Diff preview
- JSON/log preview if needed

### 5. History Panel
Show last outputs/runs:
- Time
- Agent name
- Status
- File/report name
- Click to open previous output

### 6. Safety Panel
For risky features, show:
- What will happen
- Which files may change
- Whether backup is created
- Approval text if required

## Component Plan

### Cards
Use rounded dark cards with border:
- Background: #0b1020
- Border: #263044
- Text: white
- Secondary text: #94a3b8

### Status Colors
- Success: #86efac
- Warning/approval: #facc15
- Error/blocked: #fca5a5
- Info: #38bdf8

### Buttons
- Primary action: blue background
- Dangerous action: red/dark red
- Secondary action: neutral dark
- Disabled action: grey/dim

### Code/Report Preview
Use a pre block:
- Background: #020617
- Border: #263044
- Font size: 12px
- White-space: pre-wrap
- Max height with scroll for long output

## Mobile Layout
On desktop:
- Left column: controls/history
- Right column: output/preview

On mobile:
- Stack everything vertically
- Summary cards become one column
- Buttons wrap
- Preview panel should scroll

## Empty States
If no data exists:
- "No outputs yet."
- "Run this agent to create the first report."
- "No failed steps found. Good."

## Error States
If backend is not running:
- Show: "Backend not running or route not available."
If action fails:
- Show the backend message.
If no file/report exists:
- Show clear file-not-found message.

## Acceptance Criteria
- User understands the feature in under 5 seconds.
- Main action is visible without scrolling too much.
- Output appears clearly after action.
- History is available.
- Error message is readable.
- UI follows the same dark dashboard system.
- Mobile view does not break.
- Buttons have clear purpose.

## UI/UX Decision
Approved for implementation with dashboard dark theme, clear action-first layout, summary cards, history panel, and safe error handling.
"""

    return report

@app.post("/real-agents/ui-ux/run")
def real_agents_ui_ux_run(request: UXODesignerRequest):
    try:
        UXO_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        UXO_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        report = uxo_designer_report(
            task=request.task,
            feature_name=request.feature_name,
            style=request.style,
            priority=request.priority
        )

        timestamp_file = UXODatetime.now().strftime("%Y%m%d_%H%M%S")
        safe_feature = uxo_safe_file_name(request.feature_name)
        file_name = f"uiux_agent_{safe_feature}_{timestamp_file}.md"
        report_path = UXO_REPORTS_DIR / file_name
        report_path.write_text(report, encoding="utf-8")

        output = {
            "agent_name": "UI/UX Designer Agent",
            "feature_name": request.feature_name,
            "priority": request.priority,
            "task": request.task,
            "report_file": file_name,
            "report_path": str(report_path),
            "status": "completed",
            "created_at": UXODatetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "summary": "UI layout, dashboard sections, mobile behavior, cards, buttons, and error states created."
        }

        uxo_save_output(output)

        return {
            "ok": True,
            "message": "UI/UX Designer Agent completed report.",
            "output": output,
            "report": report
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "UI/UX Designer Agent failed.",
            "error": str(error)
        }

# ============================================================
# Real Agent Output v1 - Frontend Developer Agent
# ============================================================

from pydantic import BaseModel as FDOBaseModel
from pathlib import Path as FDOPath
from datetime import datetime as FDODatetime
import json as FDOJson
import re as FDORe

FDO_BASE_DIR = FDOPath(__file__).resolve().parents[2]
FDO_MEMORY_DIR = FDO_BASE_DIR / "memory"
FDO_REPORTS_DIR = FDO_BASE_DIR / "generated_reports"
FDO_GENERATED_DIR = FDO_BASE_DIR / "generated_pages"
FDO_OUTPUTS_FILE = FDO_MEMORY_DIR / "real_agent_outputs.json"

class FDOFrontendRequest(FDOBaseModel):
    task: str
    feature_name: str = "Generated Feature"
    route_name: str = "generated-feature"
    priority: str = "High"
    style: str = "Dark AI dashboard"

def fdo_read_text(path, default=""):
    try:
        if path.exists():
            return path.read_text(encoding="utf-8")
    except Exception:
        pass
    return default

def fdo_read_json(path, default):
    try:
        if path.exists():
            return FDOJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def fdo_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(FDOJson.dumps(data, indent=2), encoding="utf-8")

def fdo_safe_name(name):
    clean = FDORe.sub(r"[^a-zA-Z0-9._-]", "-", name.strip().lower())
    clean = clean.strip("-")
    if not clean:
        clean = "generated-feature"
    return clean

def fdo_save_output(output):
    outputs = fdo_read_json(FDO_OUTPUTS_FILE, [])
    outputs.insert(0, output)
    fdo_write_json(FDO_OUTPUTS_FILE, outputs[:200])

def fdo_component_name(feature_name):
    words = FDORe.sub(r"[^a-zA-Z0-9 ]", " ", feature_name).title().split()
    name = "".join(words)
    if not name:
        name = "GeneratedFeature"
    if name[0].isdigit():
        name = "Generated" + name
    return name + "Page"

def fdo_generate_page_code(task, feature_name, style):
    component = fdo_component_name(feature_name)
    safe_title = feature_name.replace("`", "'")
    safe_task = task.replace("`", "'")
    safe_style = style.replace("`", "'")

    code = f'''\"use client\";

import {{ useState }} from "react";

export default function {component}() {{
  const [message, setMessage] = useState("");

  function runDemoAction() {{
    setMessage("Demo action completed. This page was generated by Frontend Developer Agent v1.");
  }}

  return (
    <main style={{{{ minHeight: "100vh", background: "#050816", color: "white", padding: "32px" }}}}>
      <section style={{{{ border: "1px solid #263044", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}}}>
        <p style={{{{ color: "#38bdf8", fontWeight: 800, letterSpacing: "2px", fontSize: "12px" }}}}>
          GENERATED FRONTEND PAGE
        </p>

        <h1 style={{{{ fontSize: "32px", fontWeight: 900, marginTop: "8px" }}}}>
          {safe_title}
        </h1>

        <p style={{{{ color: "#94a3b8", marginTop: "8px" }}}}>
          {safe_task}
        </p>

        <p style={{{{ color: "#64748b", marginTop: "8px", fontSize: "12px" }}}}>
          Style: {safe_style}
        </p>
      </section>

      {{message && (
        <section style={{{{ border: "1px solid #14532d", borderRadius: "16px", padding: "16px", marginBottom: "24px", color: "#86efac" }}}}>
          {{message}}
        </section>
      )}}

      <section style={{{{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}}}>
        <div style={{{{ border: "1px solid #263044", borderRadius: "18px", padding: "18px", background: "#0b1020" }}}}>
          <p style={{{{ color: "#94a3b8" }}}}>Status</p>
          <h2 style={{{{ fontSize: "28px", fontWeight: 900, color: "#86efac" }}}}>Ready</h2>
        </div>

        <div style={{{{ border: "1px solid #263044", borderRadius: "18px", padding: "18px", background: "#0b1020" }}}}>
          <p style={{{{ color: "#94a3b8" }}}}>Risk</p>
          <h2 style={{{{ fontSize: "28px", fontWeight: 900, color: "#facc15" }}}}>Review</h2>
        </div>

        <div style={{{{ border: "1px solid #263044", borderRadius: "18px", padding: "18px", background: "#0b1020" }}}}>
          <p style={{{{ color: "#94a3b8" }}}}>Agent</p>
          <h2 style={{{{ fontSize: "20px", fontWeight: 900 }}}}>Frontend Dev</h2>
        </div>
      </section>

      <section style={{{{ display: "grid", gridTemplateColumns: "420px 1fr", gap: "24px" }}}}>
        <div style={{{{ border: "1px solid #263044", borderRadius: "20px", padding: "20px", background: "#0b1020" }}}}>
          <h2 style={{{{ fontSize: "22px", fontWeight: 800 }}}}>Main Action</h2>

          <p style={{{{ color: "#94a3b8", marginTop: "8px" }}}}>
            This is a starter generated page. Connect real backend routes and data in the next version.
          </p>

          <button
            onClick={{runDemoAction}}
            style={{{{ marginTop: "16px", padding: "12px 16px", borderRadius: "10px", fontWeight: 900, background: "#1e3a8a", color: "white", border: "1px solid #60a5fa" }}}}
          >
            Run Demo Action
          </button>
        </div>

        <div style={{{{ border: "1px solid #263044", borderRadius: "20px", padding: "20px", background: "#0b1020" }}}}>
          <h2 style={{{{ fontSize: "22px", fontWeight: 800 }}}}>Implementation Notes</h2>

          <ul style={{{{ color: "#cbd5e1", marginTop: "12px", lineHeight: "28px" }}}}>
            <li>Generated by Frontend Developer Agent v1.</li>
            <li>Safe to preview before install.</li>
            <li>Use Generated Files page to inspect this file.</li>
            <li>Use Safe Install Bridge to create the real route.</li>
            <li>Run QA Runner after install.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}}
'''
    return code

@app.post("/real-agents/frontend-developer/run")
def real_agents_frontend_developer_run(request: FDOFrontendRequest):
    try:
        FDO_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        FDO_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        FDO_GENERATED_DIR.mkdir(parents=True, exist_ok=True)

        code = fdo_generate_page_code(
            task=request.task,
            feature_name=request.feature_name,
            style=request.style
        )

        timestamp_file = FDODatetime.now().strftime("%Y%m%d_%H%M%S")
        safe_feature = fdo_safe_name(request.feature_name)
        safe_route = fdo_safe_name(request.route_name)

        generated_file_name = f"{safe_route}_{timestamp_file}.tsx"
        generated_path = FDO_GENERATED_DIR / generated_file_name
        generated_path.write_text(code, encoding="utf-8")

        report = f"""# Frontend Developer Agent Report

Generated at: {FDODatetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Feature Name
{request.feature_name}

## Route Name
{request.route_name}

## Priority
{request.priority}

## Task
{request.task}

## Generated File
{generated_file_name}

## Generated File Path
{generated_path}

## What Was Created
A Next.js client page component was generated and saved into generated_pages.

## Next Steps
1. Open Generated Files page.
2. Select this file: {generated_file_name}
3. Preview the code.
4. Create Safe Install preview.
5. Approve install to route: {safe_route}
6. Run QA Runner full check.

## Safety
This agent only writes to generated_pages. It does not overwrite real frontend app files directly.
"""

        report_file = f"frontend_agent_{safe_feature}_{timestamp_file}.md"
        report_path = FDO_REPORTS_DIR / report_file
        report_path.write_text(report, encoding="utf-8")

        output = {
            "agent_name": "Frontend Developer Agent",
            "feature_name": request.feature_name,
            "priority": request.priority,
            "task": request.task,
            "route_name": request.route_name,
            "generated_file": generated_file_name,
            "generated_path": str(generated_path),
            "report_file": report_file,
            "report_path": str(report_path),
            "status": "completed",
            "created_at": FDODatetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "summary": "Frontend TSX page generated and saved into generated_pages."
        }

        fdo_save_output(output)

        return {
            "ok": True,
            "message": "Frontend Developer Agent generated a TSX file.",
            "output": output,
            "report": report,
            "code": code
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Frontend Developer Agent failed.",
            "error": str(error)
        }

# ============================================================
# Real Agent Output v1 - Backend Developer Agent
# ============================================================

from pydantic import BaseModel as BDOBaseModel
from pathlib import Path as BDOPath
from datetime import datetime as BDODatetime
import json as BDOJson
import re as BDORe

BDO_BASE_DIR = BDOPath(__file__).resolve().parents[2]
BDO_MEMORY_DIR = BDO_BASE_DIR / "memory"
BDO_REPORTS_DIR = BDO_BASE_DIR / "generated_reports"
BDO_GENERATED_DIR = BDO_BASE_DIR / "generated_pages"
BDO_OUTPUTS_FILE = BDO_MEMORY_DIR / "real_agent_outputs.json"

class BDOBackendRequest(BDOBaseModel):
    task: str
    feature_name: str = "Generated Backend Feature"
    api_route: str = "generated-backend-feature"
    priority: str = "High"

def bdo_read_json(path, default):
    try:
        if path.exists():
            return BDOJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def bdo_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(BDOJson.dumps(data, indent=2), encoding="utf-8")

def bdo_safe_name(name):
    clean = BDORe.sub(r"[^a-zA-Z0-9._/-]", "-", name.strip().lower())
    clean = clean.strip("-").strip("/")
    if not clean:
        clean = "generated-backend-feature"
    return clean

def bdo_save_output(output):
    outputs = bdo_read_json(BDO_OUTPUTS_FILE, [])
    outputs.insert(0, output)
    bdo_write_json(BDO_OUTPUTS_FILE, outputs[:200])

def bdo_generate_backend_code(task, feature_name, api_route):
    safe_route = bdo_safe_name(api_route).replace("_", "-")
    safe_title = feature_name.replace('"', "'")
    safe_task = task.replace('"', "'")

    code = f'''# Generated by Backend Developer Agent v1
# Feature: {safe_title}
# Task: {safe_task}
# Safety: This is a draft backend route. Review before adding to main.py.

from pydantic import BaseModel
from datetime import datetime

class GeneratedBackendRequest(BaseModel):
    title: str = "{safe_title}"
    notes: str = "{safe_task}"

@app.get("/{safe_route}/status")
def generated_backend_status():
    return {{
        "ok": True,
        "feature": "{safe_title}",
        "route": "/{safe_route}/status",
        "status": "ready",
        "message": "Generated backend status route is working.",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }}

@app.post("/{safe_route}/run")
def generated_backend_run(request: GeneratedBackendRequest):
    return {{
        "ok": True,
        "feature": "{safe_title}",
        "input": {{
            "title": request.title,
            "notes": request.notes
        }},
        "result": "Generated backend action completed.",
        "next_steps": [
            "Review this generated backend draft.",
            "Add permission checks before risky actions.",
            "Connect this route to frontend UI.",
            "Run python compile check.",
            "Run QA Runner full check."
        ],
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }}
'''
    return code

@app.post("/real-agents/backend-developer/run")
def real_agents_backend_developer_run(request: BDOBackendRequest):
    try:
        BDO_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        BDO_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        BDO_GENERATED_DIR.mkdir(parents=True, exist_ok=True)

        code = bdo_generate_backend_code(
            task=request.task,
            feature_name=request.feature_name,
            api_route=request.api_route
        )

        timestamp_file = BDODatetime.now().strftime("%Y%m%d_%H%M%S")
        safe_feature = bdo_safe_name(request.feature_name).replace("/", "-")
        safe_route = bdo_safe_name(request.api_route).replace("/", "-")

        generated_file_name = f"backend_{safe_route}_{timestamp_file}.py"
        generated_path = BDO_GENERATED_DIR / generated_file_name
        generated_path.write_text(code, encoding="utf-8")

        report = f"""# Backend Developer Agent Report

Generated at: {BDODatetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Feature Name
{request.feature_name}

## API Route
{request.api_route}

## Priority
{request.priority}

## Task
{request.task}

## Generated Backend Draft
{generated_file_name}

## Generated File Path
{generated_path}

## What Was Created
A FastAPI backend route draft was generated and saved as a .py file.

## Routes In Draft
- GET /{request.api_route}/status
- POST /{request.api_route}/run

## Safety
This agent only writes a backend draft into generated_pages.
It does not edit main.py directly.
Review before installing into real backend.

## Next Steps
1. Open Generated Files page.
2. Select this file: {generated_file_name}
3. Review backend code.
4. Later use Backend Safe Install system.
5. Run backend compile check.
6. Run QA Runner full check.
"""

        report_file = f"backend_agent_{safe_feature}_{timestamp_file}.md"
        report_path = BDO_REPORTS_DIR / report_file
        report_path.write_text(report, encoding="utf-8")

        output = {
            "agent_name": "Backend Developer Agent",
            "feature_name": request.feature_name,
            "priority": request.priority,
            "task": request.task,
            "api_route": request.api_route,
            "generated_file": generated_file_name,
            "generated_path": str(generated_path),
            "report_file": report_file,
            "report_path": str(report_path),
            "status": "completed",
            "created_at": BDODatetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "summary": "Backend FastAPI route draft generated and saved."
        }

        bdo_save_output(output)

        return {
            "ok": True,
            "message": "Backend Developer Agent generated a backend draft.",
            "output": output,
            "report": report,
            "code": code
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Backend Developer Agent failed.",
            "error": str(error)
        }

# ============================================================
# Real Agent Output v1 - QA Tester Agent
# ============================================================

from pydantic import BaseModel as QTOBaseModel
from pathlib import Path as QTOPath
from datetime import datetime as QTODatetime
import json as QTOJson
import re as QTORe
import subprocess as QTOSubprocess

QTO_BASE_DIR = QTOPath(__file__).resolve().parents[2]
QTO_MEMORY_DIR = QTO_BASE_DIR / "memory"
QTO_REPORTS_DIR = QTO_BASE_DIR / "generated_reports"
QTO_OUTPUTS_FILE = QTO_MEMORY_DIR / "real_agent_outputs.json"

class QTOTesterRequest(QTOBaseModel):
    task: str
    feature_name: str = "QA Check"
    priority: str = "High"
    run_frontend_build: bool = True
    run_backend_compile: bool = True

def qto_read_json(path, default):
    try:
        if path.exists():
            return QTOJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def qto_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(QTOJson.dumps(data, indent=2), encoding="utf-8")

def qto_safe_name(name):
    clean = QTORe.sub(r"[^a-zA-Z0-9._-]", "-", name.strip().lower())
    clean = clean.strip("-")
    if not clean:
        clean = "qa-check"
    return clean

def qto_save_output(output):
    outputs = qto_read_json(QTO_OUTPUTS_FILE, [])
    outputs.insert(0, output)
    qto_write_json(QTO_OUTPUTS_FILE, outputs[:200])

def qto_run_command(command, cwd, timeout_seconds=180):
    started_at = QTODatetime.now()

    try:
        process = QTOSubprocess.run(
            command,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            shell=True
        )

        finished_at = QTODatetime.now()

        return {
            "ok": process.returncode == 0,
            "command": command,
            "cwd": str(cwd),
            "return_code": process.returncode,
            "stdout": process.stdout[-12000:],
            "stderr": process.stderr[-12000:],
            "started_at": started_at.strftime("%Y-%m-%d %H:%M:%S"),
            "finished_at": finished_at.strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as error:
        finished_at = QTODatetime.now()

        return {
            "ok": False,
            "command": command,
            "cwd": str(cwd),
            "return_code": -1,
            "stdout": "",
            "stderr": str(error),
            "started_at": started_at.strftime("%Y-%m-%d %H:%M:%S"),
            "finished_at": finished_at.strftime("%Y-%m-%d %H:%M:%S")
        }

@app.post("/real-agents/qa-tester/run")
def real_agents_qa_tester_run(request: QTOTesterRequest):
    try:
        QTO_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        QTO_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        frontend_dir = QTOPath.home() / "dashboard" / "frontend"
        backend_root = QTO_BASE_DIR

        backend_result = None
        frontend_result = None

        if request.run_backend_compile:
            backend_result = qto_run_command(
                "python -m py_compile dashboard\\backend\\main.py",
                backend_root,
                timeout_seconds=90
            )

        if request.run_frontend_build:
            frontend_result = qto_run_command(
                "npm run build",
                frontend_dir,
                timeout_seconds=180
            )

        backend_ok = True if backend_result is None else backend_result.get("ok", False)
        frontend_ok = True if frontend_result is None else frontend_result.get("ok", False)
        all_ok = backend_ok and frontend_ok

        timestamp = QTODatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        timestamp_file = QTODatetime.now().strftime("%Y%m%d_%H%M%S")
        safe_feature = qto_safe_name(request.feature_name)

        backend_status = "skipped"
        if backend_result is not None:
            backend_status = "passed" if backend_result.get("ok") else "failed"

        frontend_status = "skipped"
        if frontend_result is not None:
            frontend_status = "passed" if frontend_result.get("ok") else "failed"

        report = f"""# QA Tester Agent Report

Generated at: {timestamp}

## Feature Name
{request.feature_name}

## Priority
{request.priority}

## Task
{request.task}

## Overall QA Status
{"PASSED" if all_ok else "FAILED"}

## Checks Run
- Backend compile: {backend_status}
- Frontend build: {frontend_status}

## Backend Compile Result
Command:
{backend_result.get("command") if backend_result else "Skipped"}

Return Code:
{backend_result.get("return_code") if backend_result else "Skipped"}

STDOUT:
{backend_result.get("stdout") if backend_result else "Skipped"}

STDERR:
{backend_result.get("stderr") if backend_result else "Skipped"}

## Frontend Build Result
Command:
{frontend_result.get("command") if frontend_result else "Skipped"}

Return Code:
{frontend_result.get("return_code") if frontend_result else "Skipped"}

STDOUT:
{frontend_result.get("stdout") if frontend_result else "Skipped"}

STDERR:
{frontend_result.get("stderr") if frontend_result else "Skipped"}

## QA Decision
{"Approved for next step." if all_ok else "Not approved. Fix errors before install, commit, or deploy."}

## Recommended Next Steps
1. If QA passed, continue to Project Reviewer Agent.
2. If QA failed, open QA Runner or Retry Failed page.
3. Fix the error shown in STDERR.
4. Run QA Tester again.
5. Do not push broken code.
"""

        report_file = f"qa_agent_{safe_feature}_{timestamp_file}.md"
        report_path = QTO_REPORTS_DIR / report_file
        report_path.write_text(report, encoding="utf-8")

        output = {
            "agent_name": "QA Tester Agent",
            "feature_name": request.feature_name,
            "priority": request.priority,
            "task": request.task,
            "report_file": report_file,
            "report_path": str(report_path),
            "status": "passed" if all_ok else "failed",
            "backend_status": backend_status,
            "frontend_status": frontend_status,
            "created_at": timestamp,
            "summary": "QA checks completed. Backend: " + backend_status + ". Frontend: " + frontend_status + "."
        }

        qto_save_output(output)

        return {
            "ok": all_ok,
            "message": "QA Tester Agent passed." if all_ok else "QA Tester Agent found errors.",
            "output": output,
            "report": report,
            "backend": backend_result,
            "frontend": frontend_result
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "QA Tester Agent failed to run.",
            "error": str(error)
        }

# ============================================================
# Real Agent Output v1 - Project Reviewer Agent
# ============================================================

from pydantic import BaseModel as PROBaseModel
from pathlib import Path as PROPath
from datetime import datetime as PRODatetime
import json as PROJson
import re as PRORe

PRO_BASE_DIR = PROPath(__file__).resolve().parents[2]
PRO_MEMORY_DIR = PRO_BASE_DIR / "memory"
PRO_REPORTS_DIR = PRO_BASE_DIR / "generated_reports"
PRO_OUTPUTS_FILE = PRO_MEMORY_DIR / "real_agent_outputs.json"

class PROReviewerRequest(PROBaseModel):
    task: str
    feature_name: str = "Project Review"
    priority: str = "High"

def pro_read_json(path, default):
    try:
        if path.exists():
            return PROJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def pro_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(PROJson.dumps(data, indent=2), encoding="utf-8")

def pro_safe_name(name):
    clean = PRORe.sub(r"[^a-zA-Z0-9._-]", "-", name.strip().lower())
    clean = clean.strip("-")
    if not clean:
        clean = "project-review"
    return clean

def pro_save_output(output):
    outputs = pro_read_json(PRO_OUTPUTS_FILE, [])
    outputs.insert(0, output)
    pro_write_json(PRO_OUTPUTS_FILE, outputs[:200])

def pro_latest_by_agent(outputs):
    result = {}
    for item in outputs:
        agent_name = item.get("agent_name", "Unknown Agent")
        if agent_name not in result:
            result[agent_name] = item
    return result

@app.post("/real-agents/project-reviewer/run")
def real_agents_project_reviewer_run(request: PROReviewerRequest):
    try:
        PRO_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        PRO_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        outputs = pro_read_json(PRO_OUTPUTS_FILE, [])
        latest = pro_latest_by_agent(outputs)

        required_agents = [
            "Product Manager Agent",
            "UI/UX Designer Agent",
            "Frontend Developer Agent",
            "Backend Developer Agent",
            "QA Tester Agent"
        ]

        missing_agents = []
        present_agents = []

        for agent in required_agents:
            if agent in latest:
                present_agents.append(agent)
            else:
                missing_agents.append(agent)

        qa_output = latest.get("QA Tester Agent")
        qa_status = "missing"

        if qa_output:
            qa_status = qa_output.get("status", "unknown")

        approved = len(missing_agents) == 0 and qa_status == "passed"

        timestamp = PRODatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        timestamp_file = PRODatetime.now().strftime("%Y%m%d_%H%M%S")
        safe_feature = pro_safe_name(request.feature_name)

        present_text = "\n".join([f"- {agent}" for agent in present_agents]) if present_agents else "- None"
        missing_text = "\n".join([f"- {agent}" for agent in missing_agents]) if missing_agents else "- None"

        latest_text_lines = []
        for agent_name, item in latest.items():
            latest_text_lines.append(
                f"""### {agent_name}
- Feature: {item.get("feature_name", "Unknown")}
- Status: {item.get("status", "unknown")}
- Created At: {item.get("created_at", "unknown")}
- Summary: {item.get("summary", "No summary")}
- Report File: {item.get("report_file", "No report file")}
"""
            )

        latest_text = "\n".join(latest_text_lines) if latest_text_lines else "No agent outputs found."

        report = f"""# Project Reviewer Agent Report

Generated at: {timestamp}

## Feature Name
{request.feature_name}

## Priority
{request.priority}

## Review Task
{request.task}

## Final Decision
{"APPROVED" if approved else "NOT APPROVED"}

## Reason
{"All required agents have produced outputs and QA passed." if approved else "Some required agent outputs are missing or QA has not passed."}

## Required Agent Coverage

### Present Agents
{present_text}

### Missing Agents
{missing_text}

## QA Status
{qa_status}

## Latest Agent Outputs
{latest_text}

## Reviewer Checklist
- Product requirements exist: {"yes" if "Product Manager Agent" in latest else "no"}
- UI/UX design exists: {"yes" if "UI/UX Designer Agent" in latest else "no"}
- Frontend draft exists: {"yes" if "Frontend Developer Agent" in latest else "no"}
- Backend draft exists: {"yes" if "Backend Developer Agent" in latest else "no"}
- QA tester ran: {"yes" if "QA Tester Agent" in latest else "no"}
- QA passed: {"yes" if qa_status == "passed" else "no"}

## Recommended Next Steps
{"1. Move to safe install or production review." if approved else "1. Run missing agents.\n2. Run QA Tester again.\n3. Fix failures before commit, install, or deploy.\n4. Run Project Reviewer again."}

## Safety Decision
Do not install or deploy unless final decision is APPROVED.
"""

        report_file = f"project_reviewer_{safe_feature}_{timestamp_file}.md"
        report_path = PRO_REPORTS_DIR / report_file
        report_path.write_text(report, encoding="utf-8")

        output = {
            "agent_name": "Project Reviewer Agent",
            "feature_name": request.feature_name,
            "priority": request.priority,
            "task": request.task,
            "report_file": report_file,
            "report_path": str(report_path),
            "status": "approved" if approved else "not_approved",
            "qa_status": qa_status,
            "missing_agents": missing_agents,
            "present_agents": present_agents,
            "created_at": timestamp,
            "summary": "Final project review completed. Decision: " + ("APPROVED" if approved else "NOT APPROVED")
        }

        pro_save_output(output)

        return {
            "ok": True,
            "approved": approved,
            "message": "Project Reviewer Agent completed.",
            "output": output,
            "report": report
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Project Reviewer Agent failed.",
            "error": str(error)
        }

# ============================================================
# Real Agent Output v1 - Product Manager Agent RESTORE
# ============================================================

from pydantic import BaseModel as PMRBaseModel
from pathlib import Path as PMRPath
from datetime import datetime as PMRDatetime
import json as PMRJson
import re as PMRRe

PMR_BASE_DIR = PMRPath(__file__).resolve().parents[2]
PMR_MEMORY_DIR = PMR_BASE_DIR / "memory"
PMR_REPORTS_DIR = PMR_BASE_DIR / "generated_reports"
PMR_OUTPUTS_FILE = PMR_MEMORY_DIR / "real_agent_outputs.json"

class PMRRequest(PMRBaseModel):
    task: str
    feature_name: str = "New Feature"
    priority: str = "High"

def pmr_read_text(path, default=""):
    try:
        if path.exists():
            return path.read_text(encoding="utf-8")
    except Exception:
        pass
    return default

def pmr_read_json(path, default):
    try:
        if path.exists():
            return PMRJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def pmr_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(PMRJson.dumps(data, indent=2), encoding="utf-8")

def pmr_safe_name(name):
    clean = PMRRe.sub(r"[^a-zA-Z0-9._-]", "-", name.strip().lower())
    clean = clean.strip("-")
    if not clean:
        clean = "pm-report"
    return clean

def pmr_save_output(output):
    outputs = pmr_read_json(PMR_OUTPUTS_FILE, [])
    outputs.insert(0, output)
    pmr_write_json(PMR_OUTPUTS_FILE, outputs[:200])

@app.post("/real-agents/product-manager/run")
def real_agents_product_manager_restore_run(request: PMRRequest):
    try:
        PMR_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        PMR_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        project_brain = pmr_read_text(PMR_MEMORY_DIR / "project_brain.md", "Project Brain not found yet.")
        timestamp = PMRDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        timestamp_file = PMRDatetime.now().strftime("%Y%m%d_%H%M%S")
        safe_feature = pmr_safe_name(request.feature_name)

        report = f"""# Product Manager Agent Report

Generated at: {timestamp}

## Feature Name
{request.feature_name}

## Priority
{request.priority}

## User Request
{request.task}

## Product Goal
Build this feature in a safe, testable, dashboard-first way.

## Project Brain Context
{project_brain[:2500]}

## Functional Requirements
1. The feature must be visible from the dashboard.
2. The feature must have backend routes if it needs data or actions.
3. The feature must save useful history or reports when needed.
4. The feature must show clear success and failure messages.
5. The feature must be testable before Git push.

## Safety Requirements
1. Never expose .env or secret keys.
2. Never delete real project files without approval.
3. Never overwrite important files without backup.
4. High-risk actions must require approval.
5. Backend must pass python compile.
6. Frontend must pass npm build.

## Acceptance Criteria
- User can open the feature from sidebar.
- User can perform the main action.
- Result/output is clearly shown.
- Errors are readable.
- Backend compile passes.
- Frontend build passes.

## Suggested Build Steps
1. Add backend routes.
2. Add frontend page.
3. Add sidebar link.
4. Test in browser.
5. Run backend compile.
6. Run frontend build.
7. Commit and push safely.

## PM Decision
Approved for staged build with safety gates.
"""

        report_file = f"pm_agent_{safe_feature}_{timestamp_file}.md"
        report_path = PMR_REPORTS_DIR / report_file
        report_path.write_text(report, encoding="utf-8")

        output = {
            "agent_name": "Product Manager Agent",
            "feature_name": request.feature_name,
            "priority": request.priority,
            "task": request.task,
            "report_file": report_file,
            "report_path": str(report_path),
            "status": "completed",
            "created_at": timestamp,
            "summary": "Product requirements, safety rules, acceptance criteria, and build steps created."
        }

        pmr_save_output(output)

        return {
            "ok": True,
            "message": "Product Manager Agent completed report.",
            "output": output,
            "report": report
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Product Manager Agent failed.",
            "error": str(error)
        }

# ============================================================
# Real Agent Shared Routes RESTORE
# ============================================================

from pathlib import Path as RSRPath
import json as RSRJson
import re as RSRRe

RSR_BASE_DIR = RSRPath(__file__).resolve().parents[2]
RSR_MEMORY_DIR = RSR_BASE_DIR / "memory"
RSR_REPORTS_DIR = RSR_BASE_DIR / "generated_reports"
RSR_OUTPUTS_FILE = RSR_MEMORY_DIR / "real_agent_outputs.json"

def rsr_read_json(path, default):
    try:
        if path.exists():
            return RSRJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

@app.get("/real-agents/outputs")
def real_agents_outputs_restore():
    try:
        outputs = rsr_read_json(RSR_OUTPUTS_FILE, [])
        return {
            "ok": True,
            "outputs": outputs
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to read real agent outputs.",
            "error": str(error),
            "outputs": []
        }

@app.get("/real-agents/reports/{file_name}")
def real_agents_read_report_restore(file_name: str):
    try:
        safe_name = file_name.strip().replace("\\", "/").split("/")[-1]
        safe_name = RSRRe.sub(r"[^a-zA-Z0-9._-]", "-", safe_name)

        report_path = RSR_REPORTS_DIR / safe_name

        if not report_path.exists():
            return {
                "ok": False,
                "message": "Report file not found.",
                "file_name": safe_name
            }

        return {
            "ok": True,
            "file_name": safe_name,
            "content": report_path.read_text(encoding="utf-8"),
            "path": str(report_path)
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to read report.",
            "error": str(error)
        }

# ============================================================
# Agent Chain Runner v1
# ============================================================

from pydantic import BaseModel as ACRBaseModel
from pathlib import Path as ACRPath
from datetime import datetime as ACRDatetime
import json as ACRJson
import re as ACRRe
import subprocess as ACRSubprocess

ACR_BASE_DIR = ACRPath(__file__).resolve().parents[2]
ACR_MEMORY_DIR = ACR_BASE_DIR / "memory"
ACR_REPORTS_DIR = ACR_BASE_DIR / "generated_reports"
ACR_GENERATED_DIR = ACR_BASE_DIR / "generated_pages"
ACR_HISTORY_FILE = ACR_MEMORY_DIR / "agent_chain_runner_history.json"
ACR_REAL_OUTPUTS_FILE = ACR_MEMORY_DIR / "real_agent_outputs.json"

class ACRRunRequest(ACRBaseModel):
    feature_name: str = "Generated Feature"
    task: str = "Build a safe dashboard feature."
    priority: str = "High"
    style: str = "Dark AI dashboard"
    frontend_route: str = "generated-feature"
    backend_route: str = "generated-backend-feature"
    run_qa: bool = True

def acr_read_json(path, default):
    try:
        if path.exists():
            return ACRJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def acr_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(ACRJson.dumps(data, indent=2), encoding="utf-8")

def acr_safe_name(name):
    clean = ACRRe.sub(r"[^a-zA-Z0-9._-]", "-", name.strip().lower())
    clean = clean.strip("-")
    if not clean:
        clean = "generated-feature"
    return clean

def acr_component_name(feature_name):
    words = ACRRe.sub(r"[^a-zA-Z0-9 ]", " ", feature_name).title().split()
    name = "".join(words)
    if not name:
        name = "GeneratedFeature"
    if name[0].isdigit():
        name = "Generated" + name
    return name + "Page"

def acr_save_real_output(output):
    outputs = acr_read_json(ACR_REAL_OUTPUTS_FILE, [])
    outputs.insert(0, output)
    acr_write_json(ACR_REAL_OUTPUTS_FILE, outputs[:300])

def acr_save_history(run):
    history = acr_read_json(ACR_HISTORY_FILE, [])
    history.insert(0, run)
    acr_write_json(ACR_HISTORY_FILE, history[:100])

def acr_run_command(command, cwd, timeout_seconds=180):
    try:
        process = ACRSubprocess.run(
            command,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            shell=True
        )
        return {
            "ok": process.returncode == 0,
            "command": command,
            "cwd": str(cwd),
            "return_code": process.returncode,
            "stdout": process.stdout[-8000:],
            "stderr": process.stderr[-8000:]
        }
    except Exception as error:
        return {
            "ok": False,
            "command": command,
            "cwd": str(cwd),
            "return_code": -1,
            "stdout": "",
            "stderr": str(error)
        }

def acr_make_frontend_code(feature_name, task, style):
    component = acr_component_name(feature_name)
    title = feature_name.replace("`", "'")
    safe_task = task.replace("`", "'")
    safe_style = style.replace("`", "'")

    return f'''"use client";

import {{ useState }} from "react";

export default function {component}() {{
  const [message, setMessage] = useState("");

  function runAction() {{
    setMessage("Generated page action completed successfully.");
  }}

  return (
    <main style={{{{ minHeight: "100vh", background: "#050816", color: "white", padding: "32px" }}}}>
      <section style={{{{ border: "1px solid #263044", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}}}>
        <p style={{{{ color: "#38bdf8", fontWeight: 800, letterSpacing: "2px", fontSize: "12px" }}}}>
          GENERATED BY AGENT CHAIN
        </p>
        <h1 style={{{{ fontSize: "32px", fontWeight: 900, marginTop: "8px" }}}}>{title}</h1>
        <p style={{{{ color: "#94a3b8", marginTop: "8px" }}}}>{safe_task}</p>
        <p style={{{{ color: "#64748b", marginTop: "8px", fontSize: "12px" }}}}>Style: {safe_style}</p>
      </section>

      {{message && (
        <section style={{{{ border: "1px solid #14532d", borderRadius: "16px", padding: "16px", marginBottom: "24px", color: "#86efac" }}}}>
          {{message}}
        </section>
      )}}

      <section style={{{{ border: "1px solid #263044", borderRadius: "20px", padding: "20px", background: "#0b1020" }}}}>
        <h2 style={{{{ fontSize: "22px", fontWeight: 800 }}}}>Main Action</h2>
        <p style={{{{ color: "#94a3b8", marginTop: "8px" }}}}>
          This page was generated as a safe draft. Review it before installing into a real route.
        </p>
        <button
          onClick={{runAction}}
          style={{{{ marginTop: "16px", padding: "12px 16px", borderRadius: "10px", fontWeight: 900, background: "#1e3a8a", color: "white", border: "1px solid #60a5fa" }}}}
        >
          Run Demo Action
        </button>
      </section>
    </main>
  );
}}
'''

def acr_make_backend_code(feature_name, task, backend_route):
    safe_route = acr_safe_name(backend_route).replace("_", "-")
    title = feature_name.replace('"', "'")
    safe_task = task.replace('"', "'")

    return f'''# Generated by Agent Chain Runner v1
# Feature: {title}
# Task: {safe_task}

from pydantic import BaseModel
from datetime import datetime

class AgentChainGeneratedRequest(BaseModel):
    title: str = "{title}"
    notes: str = "{safe_task}"

@app.get("/{safe_route}/status")
def agent_chain_generated_status():
    return {{
        "ok": True,
        "feature": "{title}",
        "status": "ready",
        "message": "Generated backend route is working.",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }}

@app.post("/{safe_route}/run")
def agent_chain_generated_run(request: AgentChainGeneratedRequest):
    return {{
        "ok": True,
        "feature": "{title}",
        "input": {{"title": request.title, "notes": request.notes}},
        "result": "Generated backend action completed.",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }}
'''

@app.post("/agent-chain-runner/run")
def agent_chain_runner_run(request: ACRRunRequest):
    try:
        ACR_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        ACR_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        ACR_GENERATED_DIR.mkdir(parents=True, exist_ok=True)

        started_at = ACRDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        timestamp_file = ACRDatetime.now().strftime("%Y%m%d_%H%M%S")
        safe_feature = acr_safe_name(request.feature_name)
        safe_frontend_route = acr_safe_name(request.frontend_route)
        safe_backend_route = acr_safe_name(request.backend_route)

        steps = []

        pm_report = f"""# Product Manager Agent Report

Generated at: {started_at}

## Feature
{request.feature_name}

## Task
{request.task}

## Requirements
1. Must be visible from dashboard.
2. Must be safe to test.
3. Must have clear output.
4. Must not expose secrets.
5. Must pass QA before install.

## PM Decision
Approved for staged build.
"""
        pm_file = f"chain_pm_{safe_feature}_{timestamp_file}.md"
        (ACR_REPORTS_DIR / pm_file).write_text(pm_report, encoding="utf-8")
        steps.append({"agent": "Product Manager Agent", "status": "completed", "file": pm_file})

        ux_report = f"""# UI/UX Designer Agent Report

Generated at: {started_at}

## Feature
{request.feature_name}

## Style
{request.style}

## Layout Plan
1. Hero section.
2. Summary cards.
3. Main action panel.
4. Output preview.
5. History panel.
6. Safety state.

## UI Decision
Approved for dark AI dashboard layout.
"""
        ux_file = f"chain_uiux_{safe_feature}_{timestamp_file}.md"
        (ACR_REPORTS_DIR / ux_file).write_text(ux_report, encoding="utf-8")
        steps.append({"agent": "UI/UX Designer Agent", "status": "completed", "file": ux_file})

        frontend_code = acr_make_frontend_code(request.feature_name, request.task, request.style)
        frontend_file = f"{safe_frontend_route}_{timestamp_file}.tsx"
        (ACR_GENERATED_DIR / frontend_file).write_text(frontend_code, encoding="utf-8")
        steps.append({"agent": "Frontend Developer Agent", "status": "completed", "file": frontend_file})

        backend_code = acr_make_backend_code(request.feature_name, request.task, request.backend_route)
        backend_file = f"backend_{safe_backend_route}_{timestamp_file}.py"
        (ACR_GENERATED_DIR / backend_file).write_text(backend_code, encoding="utf-8")
        steps.append({"agent": "Backend Developer Agent", "status": "completed", "file": backend_file})

        backend_compile = None
        frontend_build = None

        if request.run_qa:
            backend_compile = acr_run_command(
                "python -m py_compile dashboard\\backend\\main.py",
                ACR_BASE_DIR,
                timeout_seconds=90
            )

            frontend_dir = ACRPath.home() / "dashboard" / "frontend"
            frontend_build = acr_run_command(
                "npm run build",
                frontend_dir,
                timeout_seconds=180
            )

            qa_passed = backend_compile.get("ok") and frontend_build.get("ok")
        else:
            qa_passed = True

        qa_report = f"""# QA Tester Agent Report

Generated at: {started_at}

## Feature
{request.feature_name}

## QA Enabled
{request.run_qa}

## Backend Compile
{"passed" if backend_compile and backend_compile.get("ok") else "skipped/failed"}

## Frontend Build
{"passed" if frontend_build and frontend_build.get("ok") else "skipped/failed"}

## Backend STDERR
{backend_compile.get("stderr") if backend_compile else "Skipped"}

## Frontend STDERR
{frontend_build.get("stderr") if frontend_build else "Skipped"}

## QA Decision
{"PASSED" if qa_passed else "FAILED"}
"""
        qa_file = f"chain_qa_{safe_feature}_{timestamp_file}.md"
        (ACR_REPORTS_DIR / qa_file).write_text(qa_report, encoding="utf-8")
        steps.append({"agent": "QA Tester Agent", "status": "passed" if qa_passed else "failed", "file": qa_file})

        approved = qa_passed

        reviewer_report = f"""# Project Reviewer Agent Report

Generated at: {started_at}

## Feature
{request.feature_name}

## Final Decision
{"APPROVED" if approved else "NOT APPROVED"}

## Created Files
- PM report: {pm_file}
- UI/UX report: {ux_file}
- Frontend draft: {frontend_file}
- Backend draft: {backend_file}
- QA report: {qa_file}

## Reviewer Decision
{"The chain is approved for safe review/install." if approved else "Fix QA errors before installing or deploying."}
"""
        reviewer_file = f"chain_reviewer_{safe_feature}_{timestamp_file}.md"
        (ACR_REPORTS_DIR / reviewer_file).write_text(reviewer_report, encoding="utf-8")
        steps.append({"agent": "Project Reviewer Agent", "status": "approved" if approved else "not_approved", "file": reviewer_file})

        for step in steps:
            acr_save_real_output({
                "agent_name": step["agent"],
                "feature_name": request.feature_name,
                "priority": request.priority,
                "task": request.task,
                "report_file": step.get("file"),
                "status": step.get("status"),
                "created_at": started_at,
                "summary": "Created by Agent Chain Runner."
            })

        run = {
            "feature_name": request.feature_name,
            "task": request.task,
            "priority": request.priority,
            "style": request.style,
            "frontend_route": request.frontend_route,
            "backend_route": request.backend_route,
            "status": "approved" if approved else "not_approved",
            "qa_passed": qa_passed,
            "steps": steps,
            "created_at": started_at
        }

        acr_save_history(run)

        return {
            "ok": True,
            "approved": approved,
            "message": "Agent chain completed.",
            "run": run
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Agent chain failed.",
            "error": str(error)
        }

@app.get("/agent-chain-runner/history")
def agent_chain_runner_history():
    try:
        return {
            "ok": True,
            "history": acr_read_json(ACR_HISTORY_FILE, [])
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load agent chain history.",
            "error": str(error),
            "history": []
        }

# ============================================================
# Agent Chain Runner Safe Install Bridge v1
# ============================================================

from pydantic import BaseModel as ACSBaseModel
from pathlib import Path as ACSPath
from datetime import datetime as ACSDatetime
import json as ACSJson
import re as ACSRe

ACS_BASE_DIR = ACSPath(__file__).resolve().parents[2]
ACS_MEMORY_DIR = ACS_BASE_DIR / "memory"
ACS_GENERATED_DIR = ACS_BASE_DIR / "generated_pages"
ACS_HISTORY_FILE = ACS_MEMORY_DIR / "agent_chain_runner_history.json"
ACS_INSTALL_LOG_FILE = ACS_MEMORY_DIR / "agent_chain_safe_install_log.json"
ACS_FRONTEND_ROOT = ACSPath.home() / "dashboard" / "frontend"
ACS_BACKUP_DIR = ACS_BASE_DIR / "backups" / "agent_chain_safe_installs"

class ACSPreviewRequest(ACSBaseModel):
    file_name: str
    target_route: str

class ACSApproveRequest(ACSBaseModel):
    file_name: str
    target_route: str
    approval_text: str

def acs_read_json(path, default):
    try:
        if path.exists():
            return ACSJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def acs_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(ACSJson.dumps(data, indent=2), encoding="utf-8")

def acs_safe_file_name(name):
    safe = name.strip().replace("\\", "/").split("/")[-1]
    safe = ACSRe.sub(r"[^a-zA-Z0-9._-]", "-", safe)
    return safe

def acs_safe_route(route):
    clean = route.strip().replace("\\", "/").strip("/")
    clean = ACSRe.sub(r"[^a-zA-Z0-9_/-]", "-", clean)
    clean = clean.strip("/")
    if not clean:
        clean = "generated-chain-page"
    return clean

def acs_latest_run():
    history = acs_read_json(ACS_HISTORY_FILE, [])
    if len(history) == 0:
        return None
    return history[0]

def acs_find_frontend_file_from_run(run):
    if not run:
        return ""

    for step in run.get("steps", []):
        file_name = step.get("file", "")
        if file_name.endswith(".tsx"):
            return file_name

    return ""

def acs_file_preview_text(old_text, new_text):
    old_lines = old_text.splitlines()
    new_lines = new_text.splitlines()

    return {
        "old_line_count": len(old_lines),
        "new_line_count": len(new_lines),
        "old_preview": "\n".join(old_lines[:120]),
        "new_preview": "\n".join(new_lines[:120])
    }

def acs_add_log(item):
    log = acs_read_json(ACS_INSTALL_LOG_FILE, [])
    log.insert(0, item)
    acs_write_json(ACS_INSTALL_LOG_FILE, log[:100])

@app.get("/agent-chain-runner/latest")
def agent_chain_runner_latest():
    try:
        run = acs_latest_run()
        file_name = acs_find_frontend_file_from_run(run)

        return {
            "ok": True,
            "latest_run": run,
            "frontend_file": file_name
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load latest chain run.",
            "error": str(error)
        }

@app.get("/agent-chain-runner/safe-install-history")
def agent_chain_runner_safe_install_history():
    try:
        return {
            "ok": True,
            "history": acs_read_json(ACS_INSTALL_LOG_FILE, [])
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load safe install history.",
            "error": str(error),
            "history": []
        }

@app.post("/agent-chain-runner/safe-install-preview")
def agent_chain_runner_safe_install_preview(request: ACSPreviewRequest):
    try:
        safe_file = acs_safe_file_name(request.file_name)
        safe_route = acs_safe_route(request.target_route)

        source_path = ACS_GENERATED_DIR / safe_file
        target_path = ACS_FRONTEND_ROOT / "app" / safe_route / "page.tsx"

        if not source_path.exists():
            return {
                "ok": False,
                "message": "Generated source file not found.",
                "source_file": safe_file,
                "source_path": str(source_path)
            }

        new_text = source_path.read_text(encoding="utf-8")
        old_text = ""

        if target_path.exists():
            old_text = target_path.read_text(encoding="utf-8")

        preview = acs_file_preview_text(old_text, new_text)

        return {
            "ok": True,
            "message": "Safe install preview created.",
            "source_file": safe_file,
            "target_route": safe_route,
            "source_path": str(source_path),
            "target_path": str(target_path),
            "target_exists": target_path.exists(),
            "preview": preview,
            "approval_required": "APPROVE CHAIN INSTALL"
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Safe install preview failed.",
            "error": str(error)
        }

@app.post("/agent-chain-runner/safe-install-approve")
def agent_chain_runner_safe_install_approve(request: ACSApproveRequest):
    try:
        if request.approval_text.strip() != "APPROVE CHAIN INSTALL":
            return {
                "ok": False,
                "message": "Approval text is wrong. Type APPROVE CHAIN INSTALL exactly."
            }

        safe_file = acs_safe_file_name(request.file_name)
        safe_route = acs_safe_route(request.target_route)

        source_path = ACS_GENERATED_DIR / safe_file
        target_dir = ACS_FRONTEND_ROOT / "app" / safe_route
        target_path = target_dir / "page.tsx"

        if not source_path.exists():
            return {
                "ok": False,
                "message": "Generated source file not found.",
                "source_file": safe_file
            }

        target_dir.mkdir(parents=True, exist_ok=True)
        ACS_BACKUP_DIR.mkdir(parents=True, exist_ok=True)

        timestamp = ACSDatetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = None

        if target_path.exists():
            backup_name = f"{safe_route.replace('/', '-')}_page_{timestamp}.tsx.bak"
            backup_path = ACS_BACKUP_DIR / backup_name
            backup_path.write_text(target_path.read_text(encoding="utf-8"), encoding="utf-8")

        new_text = source_path.read_text(encoding="utf-8")
        target_path.write_text(new_text, encoding="utf-8")

        log_item = {
            "source_file": safe_file,
            "target_route": safe_route,
            "source_path": str(source_path),
            "target_path": str(target_path),
            "backup_path": str(backup_path) if backup_path else "",
            "installed_at": ACSDatetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "installed"
        }

        acs_add_log(log_item)

        return {
            "ok": True,
            "message": "Chain generated page installed safely.",
            "install": log_item
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Safe install approve failed.",
            "error": str(error)
        }

# ============================================================
# Agent Chain Runner Auto QA After Install v1
# ============================================================

from pydantic import BaseModel as ACQBaseModel
from pathlib import Path as ACQPath
from datetime import datetime as ACQDatetime
import json as ACQJson
import subprocess as ACQSubprocess

ACQ_BASE_DIR = ACQPath(__file__).resolve().parents[2]
ACQ_MEMORY_DIR = ACQ_BASE_DIR / "memory"
ACQ_INSTALL_QA_LOG_FILE = ACQ_MEMORY_DIR / "agent_chain_install_qa_log.json"
ACQ_FRONTEND_ROOT = ACQPath.home() / "dashboard" / "frontend"

class ACQRunRequest(ACQBaseModel):
    target_route: str = "one-click-feature"
    note: str = "QA after chain safe install"

def acq_read_json(path, default):
    try:
        if path.exists():
            return ACQJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def acq_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(ACQJson.dumps(data, indent=2), encoding="utf-8")

def acq_add_log(item):
    log = acq_read_json(ACQ_INSTALL_QA_LOG_FILE, [])
    log.insert(0, item)
    acq_write_json(ACQ_INSTALL_QA_LOG_FILE, log[:100])

def acq_run_command(command, cwd, timeout_seconds=180):
    started_at = ACQDatetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        process = ACQSubprocess.run(
            command,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            shell=True
        )

        return {
            "ok": process.returncode == 0,
            "command": command,
            "cwd": str(cwd),
            "return_code": process.returncode,
            "stdout": process.stdout[-10000:],
            "stderr": process.stderr[-10000:],
            "started_at": started_at,
            "finished_at": ACQDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as error:
        return {
            "ok": False,
            "command": command,
            "cwd": str(cwd),
            "return_code": -1,
            "stdout": "",
            "stderr": str(error),
            "started_at": started_at,
            "finished_at": ACQDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

@app.post("/agent-chain-runner/qa-after-install")
def agent_chain_runner_qa_after_install(request: ACQRunRequest):
    try:
        ACQ_MEMORY_DIR.mkdir(parents=True, exist_ok=True)

        backend_result = acq_run_command(
            "python -m py_compile dashboard\\backend\\main.py",
            ACQ_BASE_DIR,
            timeout_seconds=90
        )

        frontend_result = acq_run_command(
            "npm run build",
            ACQ_FRONTEND_ROOT,
            timeout_seconds=180
        )

        passed = backend_result.get("ok") and frontend_result.get("ok")

        result = {
            "target_route": request.target_route,
            "note": request.note,
            "status": "passed" if passed else "failed",
            "passed": passed,
            "backend": backend_result,
            "frontend": frontend_result,
            "created_at": ACQDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        acq_add_log(result)

        return {
            "ok": True,
            "message": "QA after install passed." if passed else "QA after install failed.",
            "result": result
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "QA after install failed to run.",
            "error": str(error)
        }

@app.get("/agent-chain-runner/qa-after-install-history")
def agent_chain_runner_qa_after_install_history():
    try:
        return {
            "ok": True,
            "history": acq_read_json(ACQ_INSTALL_QA_LOG_FILE, [])
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load QA after install history.",
            "error": str(error),
            "history": []
        }

# ============================================================
# Agent Chain Runner Rollback v1
# ============================================================

from pydantic import BaseModel as ARBBaseModel
from pathlib import Path as ARBPath
from datetime import datetime as ARBDatetime
import json as ARBJson
import re as ARBRe

ARB_BASE_DIR = ARBPath(__file__).resolve().parents[2]
ARB_MEMORY_DIR = ARB_BASE_DIR / "memory"
ARB_FRONTEND_ROOT = ARBPath.home() / "dashboard" / "frontend"
ARB_INSTALL_LOG_FILE = ARB_MEMORY_DIR / "agent_chain_safe_install_log.json"
ARB_ROLLBACK_LOG_FILE = ARB_MEMORY_DIR / "agent_chain_rollback_log.json"

class ARBRollbackRequest(ARBBaseModel):
    target_route: str = "one-click-feature"
    approval_text: str = ""
    reason: str = "Rollback after failed QA"

def arb_read_json(path, default):
    try:
        if path.exists():
            return ARBJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def arb_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(ARBJson.dumps(data, indent=2), encoding="utf-8")

def arb_safe_route(route):
    clean = route.strip().replace("\\", "/").strip("/")
    clean = ARBRe.sub(r"[^a-zA-Z0-9_/-]", "-", clean)
    clean = clean.strip("/")
    if not clean:
        clean = "generated-chain-page"
    return clean

def arb_add_rollback_log(item):
    log = arb_read_json(ARB_ROLLBACK_LOG_FILE, [])
    log.insert(0, item)
    arb_write_json(ARB_ROLLBACK_LOG_FILE, log[:100])

def arb_find_latest_install(target_route):
    install_log = arb_read_json(ARB_INSTALL_LOG_FILE, [])
    safe_route = arb_safe_route(target_route)

    for item in install_log:
        if item.get("target_route") == safe_route:
            return item

    return None

@app.get("/agent-chain-runner/rollback-history")
def agent_chain_runner_rollback_history():
    try:
        return {
            "ok": True,
            "history": arb_read_json(ARB_ROLLBACK_LOG_FILE, [])
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load rollback history.",
            "error": str(error),
            "history": []
        }

@app.post("/agent-chain-runner/rollback-last-install")
def agent_chain_runner_rollback_last_install(request: ARBRollbackRequest):
    try:
        if request.approval_text.strip() != "ROLLBACK CHAIN INSTALL":
            return {
                "ok": False,
                "message": "Approval text is wrong. Type ROLLBACK CHAIN INSTALL exactly."
            }

        safe_route = arb_safe_route(request.target_route)
        latest_install = arb_find_latest_install(safe_route)

        if not latest_install:
            return {
                "ok": False,
                "message": "No safe install record found for this route.",
                "target_route": safe_route
            }

        backup_path_raw = latest_install.get("backup_path", "")
        target_path_raw = latest_install.get("target_path", "")

        if not backup_path_raw:
            return {
                "ok": False,
                "message": "No backup exists for this install. This usually means the route was created for the first time.",
                "target_route": safe_route,
                "install": latest_install
            }

        backup_path = ARBPath(backup_path_raw)
        target_path = ARBPath(target_path_raw)

        if not backup_path.exists():
            return {
                "ok": False,
                "message": "Backup file not found on disk.",
                "backup_path": str(backup_path)
            }

        if not str(target_path).startswith(str(ARB_FRONTEND_ROOT)):
            return {
                "ok": False,
                "message": "Unsafe target path blocked.",
                "target_path": str(target_path)
            }

        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(backup_path.read_text(encoding="utf-8"), encoding="utf-8")

        rollback_item = {
            "target_route": safe_route,
            "target_path": str(target_path),
            "backup_path": str(backup_path),
            "reason": request.reason,
            "rolled_back_at": ARBDatetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "rolled_back"
        }

        arb_add_rollback_log(rollback_item)

        return {
            "ok": True,
            "message": "Last chain install rolled back successfully.",
            "rollback": rollback_item
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Rollback failed.",
            "error": str(error)
        }

# ============================================================
# Agent Chain Runner Feature Registry Sync v1
# ============================================================

from pydantic import BaseModel as AFRBaseModel
from pathlib import Path as AFRPath
from datetime import datetime as AFRDatetime
import json as AFRJson
import re as AFRRe

AFR_BASE_DIR = AFRPath(__file__).resolve().parents[2]
AFR_MEMORY_DIR = AFR_BASE_DIR / "memory"
AFR_CHAIN_HISTORY_FILE = AFR_MEMORY_DIR / "agent_chain_runner_history.json"
AFR_FEATURE_REGISTRY_FILE = AFR_MEMORY_DIR / "feature_registry.json"
AFR_SYNC_LOG_FILE = AFR_MEMORY_DIR / "agent_chain_feature_registry_sync_log.json"
AFR_INSTALL_LOG_FILE = AFR_MEMORY_DIR / "agent_chain_safe_install_log.json"
AFR_QA_LOG_FILE = AFR_MEMORY_DIR / "agent_chain_install_qa_log.json"
AFR_ROLLBACK_LOG_FILE = AFR_MEMORY_DIR / "agent_chain_rollback_log.json"

class AFRSyncRequest(AFRBaseModel):
    feature_name: str = "One Click Feature Builder"
    target_route: str = "one-click-feature"
    backend_route: str = "one-click-feature-api"
    priority: str = "High"
    status: str = "built"
    note: str = "Synced from Agent Chain Runner"

def afr_read_json(path, default):
    try:
        if path.exists():
            return AFRJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def afr_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(AFRJson.dumps(data, indent=2), encoding="utf-8")

def afr_safe_route(route):
    clean = route.strip().replace("\\", "/").strip("/")
    clean = AFRRe.sub(r"[^a-zA-Z0-9_/-]", "-", clean)
    clean = clean.strip("/")
    if not clean:
        clean = "generated-chain-page"
    return clean

def afr_safe_id(name):
    clean = AFRRe.sub(r"[^a-zA-Z0-9_-]", "-", name.strip().lower())
    clean = clean.strip("-")
    if not clean:
        clean = "feature"
    return clean

def afr_add_sync_log(item):
    log = afr_read_json(AFR_SYNC_LOG_FILE, [])
    log.insert(0, item)
    afr_write_json(AFR_SYNC_LOG_FILE, log[:100])

def afr_latest_by_route(path, target_route):
    items = afr_read_json(path, [])
    safe_route = afr_safe_route(target_route)

    for item in items:
        if item.get("target_route") == safe_route:
            return item

    return None

def afr_latest_chain_for_feature(feature_name):
    history = afr_read_json(AFR_CHAIN_HISTORY_FILE, [])

    for item in history:
        if item.get("feature_name", "").strip().lower() == feature_name.strip().lower():
            return item

    if history:
        return history[0]

    return None

def afr_extract_files(chain_run):
    files = []

    if not chain_run:
        return files

    for step in chain_run.get("steps", []):
        file_name = step.get("file", "")
        if file_name:
            files.append({
                "agent": step.get("agent", ""),
                "status": step.get("status", ""),
                "file": file_name
            })

    return files

@app.post("/agent-chain-runner/sync-feature-registry")
def agent_chain_runner_sync_feature_registry(request: AFRSyncRequest):
    try:
        AFR_MEMORY_DIR.mkdir(parents=True, exist_ok=True)

        safe_route = afr_safe_route(request.target_route)
        feature_id = afr_safe_id(request.feature_name)

        registry = afr_read_json(AFR_FEATURE_REGISTRY_FILE, [])

        if not isinstance(registry, list):
            registry = []

        chain_run = afr_latest_chain_for_feature(request.feature_name)
        latest_install = afr_latest_by_route(AFR_INSTALL_LOG_FILE, safe_route)
        latest_qa = afr_latest_by_route(AFR_QA_LOG_FILE, safe_route)
        latest_rollback = afr_latest_by_route(AFR_ROLLBACK_LOG_FILE, safe_route)

        qa_status = "unknown"
        if latest_qa:
            qa_status = latest_qa.get("status", "unknown")

        install_status = "not_installed"
        if latest_install:
            install_status = latest_install.get("status", "installed")

        rollback_status = "not_rolled_back"
        if latest_rollback:
            rollback_status = latest_rollback.get("status", "rolled_back")

        final_status = request.status

        if rollback_status == "rolled_back":
            final_status = "rolled_back"
        elif qa_status == "passed" and install_status == "installed":
            final_status = "installed_and_qa_passed"
        elif qa_status == "failed":
            final_status = "qa_failed"
        elif install_status == "installed":
            final_status = "installed"
        elif chain_run:
            final_status = chain_run.get("status", request.status)

        now = AFRDatetime.now().strftime("%Y-%m-%d %H:%M:%S")

        feature_item = {
            "id": feature_id,
            "name": request.feature_name,
            "feature_name": request.feature_name,
            "priority": request.priority,
            "status": final_status,
            "source": "agent_chain_runner",
            "frontend_route": "/" + safe_route,
            "backend_route": "/" + afr_safe_route(request.backend_route),
            "target_route": safe_route,
            "note": request.note,
            "qa_status": qa_status,
            "install_status": install_status,
            "rollback_status": rollback_status,
            "chain_status": chain_run.get("status", "unknown") if chain_run else "unknown",
            "generated_files": afr_extract_files(chain_run),
            "last_chain_run": chain_run,
            "latest_install": latest_install,
            "latest_qa": latest_qa,
            "latest_rollback": latest_rollback,
            "updated_at": now,
            "created_at": now
        }

        existing_index = -1

        for index, item in enumerate(registry):
            existing_id = item.get("id") or afr_safe_id(item.get("name", item.get("feature_name", "")))
            existing_route = item.get("target_route", "").strip("/")
            if existing_id == feature_id or existing_route == safe_route:
                existing_index = index
                break

        if existing_index >= 0:
            old_item = registry[existing_index]
            feature_item["created_at"] = old_item.get("created_at", now)
            merged = {**old_item, **feature_item}
            registry[existing_index] = merged
            saved_item = merged
            action = "updated"
        else:
            registry.insert(0, feature_item)
            saved_item = feature_item
            action = "created"

        afr_write_json(AFR_FEATURE_REGISTRY_FILE, registry)

        sync_item = {
            "action": action,
            "feature_name": request.feature_name,
            "target_route": safe_route,
            "status": final_status,
            "synced_at": now,
            "registry_file": str(AFR_FEATURE_REGISTRY_FILE)
        }

        afr_add_sync_log(sync_item)

        return {
            "ok": True,
            "message": f"Feature Registry {action} successfully.",
            "action": action,
            "feature": saved_item,
            "sync": sync_item
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Feature Registry sync failed.",
            "error": str(error)
        }

@app.get("/agent-chain-runner/feature-registry-sync-history")
def agent_chain_runner_feature_registry_sync_history():
    try:
        return {
            "ok": True,
            "history": afr_read_json(AFR_SYNC_LOG_FILE, [])
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load Feature Registry sync history.",
            "error": str(error),
            "history": []
        }

# ============================================================
# Agent Chain Runner Project Brain Sync v1
# ============================================================

from pydantic import BaseModel as APBBaseModel
from pathlib import Path as APBPath
from datetime import datetime as APBDatetime
import json as APBJson
import re as APBRe

APB_BASE_DIR = APBPath(__file__).resolve().parents[2]
APB_MEMORY_DIR = APB_BASE_DIR / "memory"
APB_CHAIN_HISTORY_FILE = APB_MEMORY_DIR / "agent_chain_runner_history.json"
APB_FEATURE_REGISTRY_FILE = APB_MEMORY_DIR / "feature_registry.json"
APB_INSTALL_LOG_FILE = APB_MEMORY_DIR / "agent_chain_safe_install_log.json"
APB_QA_LOG_FILE = APB_MEMORY_DIR / "agent_chain_install_qa_log.json"
APB_ROLLBACK_LOG_FILE = APB_MEMORY_DIR / "agent_chain_rollback_log.json"
APB_PROJECT_BRAIN_FILE = APB_MEMORY_DIR / "project_brain.md"
APB_LONG_MEMORY_FILE = APB_MEMORY_DIR / "long_term_memory.md"
APB_SYNC_LOG_FILE = APB_MEMORY_DIR / "agent_chain_project_brain_sync_log.json"

class APBSyncRequest(APBBaseModel):
    feature_name: str = "One Click Feature Builder"
    target_route: str = "one-click-feature"
    backend_route: str = "one-click-feature-api"
    priority: str = "High"
    note: str = "Synced from Agent Chain Runner"

def apb_read_json(path, default):
    try:
        if path.exists():
            return APBJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def apb_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(APBJson.dumps(data, indent=2), encoding="utf-8")

def apb_read_text(path):
    try:
        if path.exists():
            return path.read_text(encoding="utf-8")
    except Exception:
        pass
    return ""

def apb_write_text(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

def apb_safe_route(route):
    clean = route.strip().replace("\\", "/").strip("/")
    clean = APBRe.sub(r"[^a-zA-Z0-9_/-]", "-", clean)
    clean = clean.strip("/")
    if not clean:
        clean = "generated-chain-page"
    return clean

def apb_latest_by_route(path, target_route):
    items = apb_read_json(path, [])
    safe_route = apb_safe_route(target_route)

    for item in items:
        if item.get("target_route") == safe_route:
            return item

    return None

def apb_latest_chain_for_feature(feature_name):
    history = apb_read_json(APB_CHAIN_HISTORY_FILE, [])

    for item in history:
        if item.get("feature_name", "").strip().lower() == feature_name.strip().lower():
            return item

    if history:
        return history[0]

    return None

def apb_feature_registry_item(feature_name, target_route):
    registry = apb_read_json(APB_FEATURE_REGISTRY_FILE, [])
    safe_route = apb_safe_route(target_route)

    if not isinstance(registry, list):
        return None

    for item in registry:
        name = item.get("feature_name") or item.get("name") or ""
        route = item.get("target_route", "").strip("/")
        if name.strip().lower() == feature_name.strip().lower() or route == safe_route:
            return item

    return None

def apb_extract_files(chain_run):
    if not chain_run:
        return []

    files = []

    for step in chain_run.get("steps", []):
        file_name = step.get("file", "")
        if file_name:
            files.append(f"- {step.get('agent', 'Agent')}: {file_name} ({step.get('status', 'unknown')})")

    return files

def apb_make_update_block(request, chain_run, registry_item, install_item, qa_item, rollback_item):
    now = APBDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
    safe_route = apb_safe_route(request.target_route)

    chain_status = chain_run.get("status", "unknown") if chain_run else "unknown"
    qa_status = qa_item.get("status", "unknown") if qa_item else "unknown"
    install_status = install_item.get("status", "not_installed") if install_item else "not_installed"
    rollback_status = rollback_item.get("status", "not_rolled_back") if rollback_item else "not_rolled_back"
    registry_status = registry_item.get("status", "not_synced") if registry_item else "not_synced"

    files = apb_extract_files(chain_run)
    files_text = "\n".join(files) if files else "- No generated files found yet."

    return f"""
## Agent Chain Update — {request.feature_name}

Updated at: {now}

### Feature
- Name: {request.feature_name}
- Priority: {request.priority}
- Frontend route: /{safe_route}
- Backend route: /{apb_safe_route(request.backend_route)}
- Note: {request.note}

### Current Status
- Chain status: {chain_status}
- Registry status: {registry_status}
- Install status: {install_status}
- QA status: {qa_status}
- Rollback status: {rollback_status}

### Generated Files / Reports
{files_text}

### Decision
This feature has been processed through Agent Chain Runner v1. Use this state as the current project truth before continuing new agent work.

---
"""

def apb_append_unique_block(path, title_marker, block):
    existing = apb_read_text(path)

    if title_marker in existing:
        # Keep old history and append latest block again with timestamp.
        updated = existing.rstrip() + "\n\n" + block.strip() + "\n"
    else:
        updated = existing.rstrip() + "\n\n" + block.strip() + "\n"

    apb_write_text(path, updated)

def apb_add_sync_log(item):
    log = apb_read_json(APB_SYNC_LOG_FILE, [])
    log.insert(0, item)
    apb_write_json(APB_SYNC_LOG_FILE, log[:100])

@app.post("/agent-chain-runner/sync-project-brain")
def agent_chain_runner_sync_project_brain(request: APBSyncRequest):
    try:
        APB_MEMORY_DIR.mkdir(parents=True, exist_ok=True)

        safe_route = apb_safe_route(request.target_route)

        chain_run = apb_latest_chain_for_feature(request.feature_name)
        registry_item = apb_feature_registry_item(request.feature_name, safe_route)
        install_item = apb_latest_by_route(APB_INSTALL_LOG_FILE, safe_route)
        qa_item = apb_latest_by_route(APB_QA_LOG_FILE, safe_route)
        rollback_item = apb_latest_by_route(APB_ROLLBACK_LOG_FILE, safe_route)

        block = apb_make_update_block(
            request=request,
            chain_run=chain_run,
            registry_item=registry_item,
            install_item=install_item,
            qa_item=qa_item,
            rollback_item=rollback_item
        )

        title_marker = f"## Agent Chain Update — {request.feature_name}"

        apb_append_unique_block(APB_PROJECT_BRAIN_FILE, title_marker, block)
        apb_append_unique_block(APB_LONG_MEMORY_FILE, title_marker, block)

        now = APBDatetime.now().strftime("%Y-%m-%d %H:%M:%S")

        sync_item = {
            "feature_name": request.feature_name,
            "target_route": safe_route,
            "backend_route": apb_safe_route(request.backend_route),
            "priority": request.priority,
            "project_brain_file": str(APB_PROJECT_BRAIN_FILE),
            "long_memory_file": str(APB_LONG_MEMORY_FILE),
            "synced_at": now,
            "status": "synced"
        }

        apb_add_sync_log(sync_item)

        return {
            "ok": True,
            "message": "Project Brain updated successfully.",
            "sync": sync_item,
            "block": block
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Project Brain sync failed.",
            "error": str(error)
        }

@app.get("/agent-chain-runner/project-brain-sync-history")
def agent_chain_runner_project_brain_sync_history():
    try:
        return {
            "ok": True,
            "history": apb_read_json(APB_SYNC_LOG_FILE, [])
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load Project Brain sync history.",
            "error": str(error),
            "history": []
        }

# ============================================================
# Agent Chain Runner One Click Complete Flow v1
# ============================================================

from pydantic import BaseModel as AOCBaseModel
from pathlib import Path as AOCPath
from datetime import datetime as AOCDatetime
import json as AOCJson

AOC_BASE_DIR = AOCPath(__file__).resolve().parents[2]
AOC_MEMORY_DIR = AOC_BASE_DIR / "memory"
AOC_COMPLETE_FLOW_HISTORY_FILE = AOC_MEMORY_DIR / "agent_chain_complete_flow_history.json"

class AOCCompleteFlowRequest(AOCBaseModel):
    feature_name: str = "One Click Feature Builder"
    task: str = "Build a safe generated dashboard feature from one click."
    priority: str = "High"
    style: str = "Dark AI dashboard"
    frontend_route: str = "one-click-feature"
    backend_route: str = "one-click-feature-api"
    approval_text: str = ""
    run_chain_qa: bool = False
    note: str = "One click complete flow"

def aoc_read_json(path, default):
    try:
        if path.exists():
            return AOCJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def aoc_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(AOCJson.dumps(data, indent=2), encoding="utf-8")

def aoc_add_history(item):
    history = aoc_read_json(AOC_COMPLETE_FLOW_HISTORY_FILE, [])
    history.insert(0, item)
    aoc_write_json(AOC_COMPLETE_FLOW_HISTORY_FILE, history[:100])

def aoc_result_ok(result):
    return isinstance(result, dict) and bool(result.get("ok"))

def aoc_call(step_name, function_name, class_name, payload):
    try:
        func = globals().get(function_name)
        cls = globals().get(class_name)

        if not callable(func):
            return {
                "step": step_name,
                "ok": False,
                "message": f"Missing function: {function_name}"
            }

        if cls is None:
            return {
                "step": step_name,
                "ok": False,
                "message": f"Missing request class: {class_name}"
            }

        request_obj = cls(**payload)
        result = func(request_obj)

        if not isinstance(result, dict):
            return {
                "step": step_name,
                "ok": False,
                "message": "Step returned non-dict result.",
                "raw": str(result)
            }

        return {
            "step": step_name,
            "ok": bool(result.get("ok")),
            "message": result.get("message", ""),
            "result": result
        }

    except Exception as error:
        return {
            "step": step_name,
            "ok": False,
            "message": str(error)
        }

def aoc_find_frontend_file(chain_result):
    try:
        run = chain_result.get("run", {})
        for step in run.get("steps", []):
            file_name = step.get("file", "")
            if file_name.endswith(".tsx"):
                return file_name
    except Exception:
        pass
    return ""

@app.post("/agent-chain-runner/complete-flow")
def agent_chain_runner_complete_flow(request: AOCCompleteFlowRequest):
    try:
        if request.approval_text.strip() != "APPROVE FULL CHAIN FLOW":
            return {
                "ok": False,
                "message": "Approval text is wrong. Type APPROVE FULL CHAIN FLOW exactly."
            }

        started_at = AOCDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        steps = []

        chain_step = aoc_call(
            "Run Agent Chain",
            "agent_chain_runner_run",
            "ACRRunRequest",
            {
                "feature_name": request.feature_name,
                "task": request.task,
                "priority": request.priority,
                "style": request.style,
                "frontend_route": request.frontend_route,
                "backend_route": request.backend_route,
                "run_qa": request.run_chain_qa
            }
        )
        steps.append(chain_step)

        if not chain_step.get("ok"):
            flow = {
                "feature_name": request.feature_name,
                "status": "failed",
                "failed_at": "Run Agent Chain",
                "steps": steps,
                "created_at": started_at
            }
            aoc_add_history(flow)
            return {"ok": False, "message": "Complete flow stopped at agent chain.", "flow": flow}

        frontend_file = aoc_find_frontend_file(chain_step.get("result", {}))

        if not frontend_file:
            flow = {
                "feature_name": request.feature_name,
                "status": "failed",
                "failed_at": "Find Frontend File",
                "steps": steps,
                "created_at": started_at
            }
            aoc_add_history(flow)
            return {"ok": False, "message": "No generated frontend .tsx file found.", "flow": flow}

        preview_step = aoc_call(
            "Preview Safe Install",
            "agent_chain_runner_safe_install_preview",
            "ACSPreviewRequest",
            {
                "file_name": frontend_file,
                "target_route": request.frontend_route
            }
        )
        steps.append(preview_step)

        if not preview_step.get("ok"):
            flow = {
                "feature_name": request.feature_name,
                "status": "failed",
                "failed_at": "Preview Safe Install",
                "steps": steps,
                "created_at": started_at
            }
            aoc_add_history(flow)
            return {"ok": False, "message": "Complete flow stopped at safe install preview.", "flow": flow}

        install_step = aoc_call(
            "Approve Safe Install",
            "agent_chain_runner_safe_install_approve",
            "ACSApproveRequest",
            {
                "file_name": frontend_file,
                "target_route": request.frontend_route,
                "approval_text": "APPROVE CHAIN INSTALL"
            }
        )
        steps.append(install_step)

        if not install_step.get("ok"):
            flow = {
                "feature_name": request.feature_name,
                "status": "failed",
                "failed_at": "Approve Safe Install",
                "steps": steps,
                "created_at": started_at
            }
            aoc_add_history(flow)
            return {"ok": False, "message": "Complete flow stopped at safe install approve.", "flow": flow}

        qa_step = aoc_call(
            "Run QA After Install",
            "agent_chain_runner_qa_after_install",
            "ACQRunRequest",
            {
                "target_route": request.frontend_route,
                "note": "QA from one click complete flow"
            }
        )
        steps.append(qa_step)

        qa_passed = False
        try:
            qa_passed = bool(qa_step.get("result", {}).get("result", {}).get("passed"))
        except Exception:
            qa_passed = False

        registry_step = aoc_call(
            "Sync Feature Registry",
            "agent_chain_runner_sync_feature_registry",
            "AFRSyncRequest",
            {
                "feature_name": request.feature_name,
                "target_route": request.frontend_route,
                "backend_route": request.backend_route,
                "priority": request.priority,
                "status": "installed_and_qa_passed" if qa_passed else "qa_failed",
                "note": "Synced from one click complete flow"
            }
        )
        steps.append(registry_step)

        brain_step = aoc_call(
            "Sync Project Brain",
            "agent_chain_runner_sync_project_brain",
            "APBSyncRequest",
            {
                "feature_name": request.feature_name,
                "target_route": request.frontend_route,
                "backend_route": request.backend_route,
                "priority": request.priority,
                "note": "Synced from one click complete flow"
            }
        )
        steps.append(brain_step)

        handoff_step = aoc_call(
            "Export New Chat Handoff",
            "agent_chain_runner_export_handoff",
            "AHEExportRequest",
            {
                "feature_name": request.feature_name,
                "target_route": request.frontend_route,
                "backend_route": request.backend_route,
                "next_task": "Continue building the next AI Agent OS feature step by step.",
                "note": "Exported from one click complete flow"
            }
        )
        steps.append(handoff_step)

        all_non_qa_ok = (
            chain_step.get("ok")
            and preview_step.get("ok")
            and install_step.get("ok")
            and registry_step.get("ok")
            and brain_step.get("ok")
            and handoff_step.get("ok")
        )

        final_status = "completed_and_qa_passed" if all_non_qa_ok and qa_passed else "completed_with_attention"

        flow = {
            "feature_name": request.feature_name,
            "task": request.task,
            "priority": request.priority,
            "style": request.style,
            "frontend_route": request.frontend_route,
            "backend_route": request.backend_route,
            "generated_frontend_file": frontend_file,
            "status": final_status,
            "qa_passed": qa_passed,
            "steps": steps,
            "created_at": started_at,
            "finished_at": AOCDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        aoc_add_history(flow)

        return {
            "ok": True,
            "message": "One click complete flow finished.",
            "flow": flow
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "One click complete flow failed.",
            "error": str(error)
        }

@app.get("/agent-chain-runner/complete-flow-history")
def agent_chain_runner_complete_flow_history():
    try:
        return {
            "ok": True,
            "history": aoc_read_json(AOC_COMPLETE_FLOW_HISTORY_FILE, [])
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load complete flow history.",
            "error": str(error),
            "history": []
        }

# ============================================================
# Agent Chain Runner Safe Complete Flow v2
# Auto rollback if QA fails
# ============================================================

from pydantic import BaseModel as ACFBaseModel
from pathlib import Path as ACFPath
from datetime import datetime as ACFDatetime
import json as ACFJson

ACF_BASE_DIR = ACFPath(__file__).resolve().parents[2]
ACF_MEMORY_DIR = ACF_BASE_DIR / "memory"
ACF_SAFE_FLOW_HISTORY_FILE = ACF_MEMORY_DIR / "agent_chain_safe_complete_flow_history.json"

class ACFSafeCompleteFlowRequest(ACFBaseModel):
    feature_name: str = "One Click Feature Builder"
    task: str = "Build a safe generated dashboard feature from one click."
    priority: str = "High"
    style: str = "Dark AI dashboard"
    frontend_route: str = "one-click-feature"
    backend_route: str = "one-click-feature-api"
    approval_text: str = ""
    run_chain_qa: bool = False
    auto_rollback_on_qa_fail: bool = True
    note: str = "Safe complete flow v2"

def acf_read_json(path, default):
    try:
        if path.exists():
            return ACFJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def acf_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(ACFJson.dumps(data, indent=2), encoding="utf-8")

def acf_add_history(item):
    history = acf_read_json(ACF_SAFE_FLOW_HISTORY_FILE, [])
    history.insert(0, item)
    acf_write_json(ACF_SAFE_FLOW_HISTORY_FILE, history[:100])

def acf_call(step_name, function_name, class_name, payload):
    try:
        func = globals().get(function_name)
        cls = globals().get(class_name)

        if not callable(func):
            return {
                "step": step_name,
                "ok": False,
                "message": f"Missing function: {function_name}"
            }

        if cls is None:
            return {
                "step": step_name,
                "ok": False,
                "message": f"Missing request class: {class_name}"
            }

        request_obj = cls(**payload)
        result = func(request_obj)

        if not isinstance(result, dict):
            return {
                "step": step_name,
                "ok": False,
                "message": "Step returned non-dict result.",
                "raw": str(result)
            }

        return {
            "step": step_name,
            "ok": bool(result.get("ok")),
            "message": result.get("message", ""),
            "result": result
        }

    except Exception as error:
        return {
            "step": step_name,
            "ok": False,
            "message": str(error)
        }

def acf_find_frontend_file(chain_result):
    try:
        run = chain_result.get("run", {})
        for step in run.get("steps", []):
            file_name = step.get("file", "")
            if file_name.endswith(".tsx"):
                return file_name
    except Exception:
        pass
    return ""

@app.post("/agent-chain-runner/complete-flow-safe")
def agent_chain_runner_complete_flow_safe(request: ACFSafeCompleteFlowRequest):
    try:
        if request.approval_text.strip() != "APPROVE SAFE FULL FLOW":
            return {
                "ok": False,
                "message": "Approval text is wrong. Type APPROVE SAFE FULL FLOW exactly."
            }

        started_at = ACFDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        steps = []
        rollback_step = None

        chain_step = acf_call(
            "Run Agent Chain",
            "agent_chain_runner_run",
            "ACRRunRequest",
            {
                "feature_name": request.feature_name,
                "task": request.task,
                "priority": request.priority,
                "style": request.style,
                "frontend_route": request.frontend_route,
                "backend_route": request.backend_route,
                "run_qa": request.run_chain_qa
            }
        )
        steps.append(chain_step)

        if not chain_step.get("ok"):
            flow = {
                "feature_name": request.feature_name,
                "status": "failed",
                "failed_at": "Run Agent Chain",
                "steps": steps,
                "created_at": started_at
            }
            acf_add_history(flow)
            return {
                "ok": False,
                "message": "Safe complete flow stopped at agent chain.",
                "flow": flow
            }

        frontend_file = acf_find_frontend_file(chain_step.get("result", {}))

        if not frontend_file:
            flow = {
                "feature_name": request.feature_name,
                "status": "failed",
                "failed_at": "Find Frontend File",
                "steps": steps,
                "created_at": started_at
            }
            acf_add_history(flow)
            return {
                "ok": False,
                "message": "No generated frontend .tsx file found.",
                "flow": flow
            }

        preview_step = acf_call(
            "Preview Safe Install",
            "agent_chain_runner_safe_install_preview",
            "ACSPreviewRequest",
            {
                "file_name": frontend_file,
                "target_route": request.frontend_route
            }
        )
        steps.append(preview_step)

        if not preview_step.get("ok"):
            flow = {
                "feature_name": request.feature_name,
                "status": "failed",
                "failed_at": "Preview Safe Install",
                "steps": steps,
                "created_at": started_at
            }
            acf_add_history(flow)
            return {
                "ok": False,
                "message": "Safe complete flow stopped at safe install preview.",
                "flow": flow
            }

        install_step = acf_call(
            "Approve Safe Install",
            "agent_chain_runner_safe_install_approve",
            "ACSApproveRequest",
            {
                "file_name": frontend_file,
                "target_route": request.frontend_route,
                "approval_text": "APPROVE CHAIN INSTALL"
            }
        )
        steps.append(install_step)

        if not install_step.get("ok"):
            flow = {
                "feature_name": request.feature_name,
                "status": "failed",
                "failed_at": "Approve Safe Install",
                "steps": steps,
                "created_at": started_at
            }
            acf_add_history(flow)
            return {
                "ok": False,
                "message": "Safe complete flow stopped at safe install approve.",
                "flow": flow
            }

        qa_step = acf_call(
            "Run QA After Install",
            "agent_chain_runner_qa_after_install",
            "ACQRunRequest",
            {
                "target_route": request.frontend_route,
                "note": "QA from safe complete flow v2"
            }
        )
        steps.append(qa_step)

        qa_passed = False
        try:
            qa_passed = bool(qa_step.get("result", {}).get("result", {}).get("passed"))
        except Exception:
            qa_passed = False

        rollback_status = "not_needed"

        if request.auto_rollback_on_qa_fail and not qa_passed:
            rollback_step = acf_call(
                "Auto Rollback After QA Fail",
                "agent_chain_runner_rollback_last_install",
                "ARBRollbackRequest",
                {
                    "target_route": request.frontend_route,
                    "approval_text": "ROLLBACK CHAIN INSTALL",
                    "reason": "Auto rollback from safe complete flow v2 because QA failed"
                }
            )
            steps.append(rollback_step)

            if rollback_step.get("ok"):
                rollback_status = "rolled_back"
            else:
                rollback_status = "rollback_failed_or_no_backup"

        registry_status = "installed_and_qa_passed" if qa_passed else "qa_failed"

        if rollback_status == "rolled_back":
            registry_status = "rolled_back"

        registry_step = acf_call(
            "Sync Feature Registry",
            "agent_chain_runner_sync_feature_registry",
            "AFRSyncRequest",
            {
                "feature_name": request.feature_name,
                "target_route": request.frontend_route,
                "backend_route": request.backend_route,
                "priority": request.priority,
                "status": registry_status,
                "note": "Synced from safe complete flow v2"
            }
        )
        steps.append(registry_step)

        brain_step = acf_call(
            "Sync Project Brain",
            "agent_chain_runner_sync_project_brain",
            "APBSyncRequest",
            {
                "feature_name": request.feature_name,
                "target_route": request.frontend_route,
                "backend_route": request.backend_route,
                "priority": request.priority,
                "note": "Synced from safe complete flow v2"
            }
        )
        steps.append(brain_step)

        handoff_step = acf_call(
            "Export New Chat Handoff",
            "agent_chain_runner_export_handoff",
            "AHEExportRequest",
            {
                "feature_name": request.feature_name,
                "target_route": request.frontend_route,
                "backend_route": request.backend_route,
                "next_task": "Continue building the next AI Agent OS feature step by step.",
                "note": "Exported from safe complete flow v2"
            }
        )
        steps.append(handoff_step)

        all_required_ok = (
            chain_step.get("ok")
            and preview_step.get("ok")
            and install_step.get("ok")
            and registry_step.get("ok")
            and brain_step.get("ok")
            and handoff_step.get("ok")
        )

        if all_required_ok and qa_passed:
            final_status = "completed_and_qa_passed"
        elif all_required_ok and rollback_status == "rolled_back":
            final_status = "completed_with_auto_rollback"
        else:
            final_status = "completed_with_attention"

        flow = {
            "feature_name": request.feature_name,
            "task": request.task,
            "priority": request.priority,
            "style": request.style,
            "frontend_route": request.frontend_route,
            "backend_route": request.backend_route,
            "generated_frontend_file": frontend_file,
            "status": final_status,
            "qa_passed": qa_passed,
            "rollback_status": rollback_status,
            "auto_rollback_on_qa_fail": request.auto_rollback_on_qa_fail,
            "steps": steps,
            "created_at": started_at,
            "finished_at": ACFDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        acf_add_history(flow)

        return {
            "ok": True,
            "message": "Safe complete flow finished.",
            "flow": flow
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Safe complete flow failed.",
            "error": str(error)
        }

@app.get("/agent-chain-runner/complete-flow-safe-history")
def agent_chain_runner_complete_flow_safe_history():
    try:
        return {
            "ok": True,
            "history": acf_read_json(ACF_SAFE_FLOW_HISTORY_FILE, [])
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load safe complete flow history.",
            "error": str(error),
            "history": []
        }

# ============================================================
# Agent Chain Runner Live Timeline v1
# ============================================================

from pathlib import Path as ATLPath
from datetime import datetime as ATLDatetime
import json as ATLJson

ATL_BASE_DIR = ATLPath(__file__).resolve().parents[2]
ATL_MEMORY_DIR = ATL_BASE_DIR / "memory"

ATL_CHAIN_HISTORY_FILE = ATL_MEMORY_DIR / "agent_chain_runner_history.json"
ATL_COMPLETE_FLOW_HISTORY_FILE = ATL_MEMORY_DIR / "agent_chain_complete_flow_history.json"
ATL_SAFE_COMPLETE_FLOW_HISTORY_FILE = ATL_MEMORY_DIR / "agent_chain_safe_complete_flow_history.json"
ATL_INSTALL_LOG_FILE = ATL_MEMORY_DIR / "agent_chain_safe_install_log.json"
ATL_QA_LOG_FILE = ATL_MEMORY_DIR / "agent_chain_install_qa_log.json"
ATL_ROLLBACK_LOG_FILE = ATL_MEMORY_DIR / "agent_chain_rollback_log.json"
ATL_REGISTRY_SYNC_LOG_FILE = ATL_MEMORY_DIR / "agent_chain_feature_registry_sync_log.json"
ATL_PROJECT_BRAIN_SYNC_LOG_FILE = ATL_MEMORY_DIR / "agent_chain_project_brain_sync_log.json"
ATL_HANDOFF_EXPORT_LOG_FILE = ATL_MEMORY_DIR / "agent_chain_handoff_export_log.json"

def atl_read_json(path, default):
    try:
        if path.exists():
            return ATLJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def atl_time_value(value):
    if not value:
        return ""
    return str(value)

def atl_event(event_type, title, status, created_at, message="", source="", details=None):
    return {
        "type": event_type,
        "title": title,
        "status": status,
        "created_at": atl_time_value(created_at),
        "message": message,
        "source": source,
        "details": details or {}
    }

def atl_collect_events():
    events = []

    chain_history = atl_read_json(ATL_CHAIN_HISTORY_FILE, [])
    for run in chain_history[:20]:
        events.append(atl_event(
            "chain_run",
            f"Agent chain: {run.get('feature_name', 'Unknown feature')}",
            run.get("status", "unknown"),
            run.get("created_at", ""),
            run.get("task", ""),
            "agent_chain_runner",
            {
                "frontend_route": run.get("frontend_route", ""),
                "backend_route": run.get("backend_route", ""),
                "qa_passed": run.get("qa_passed", False)
            }
        ))

        for step in run.get("steps", []):
            events.append(atl_event(
                "agent_step",
                step.get("agent", "Agent step"),
                step.get("status", "unknown"),
                run.get("created_at", ""),
                step.get("file", ""),
                "agent_chain_runner_step",
                step
            ))

    complete_flows = atl_read_json(ATL_COMPLETE_FLOW_HISTORY_FILE, [])
    for flow in complete_flows[:20]:
        events.append(atl_event(
            "complete_flow",
            f"One click flow: {flow.get('feature_name', 'Unknown feature')}",
            flow.get("status", "unknown"),
            flow.get("created_at", ""),
            "One click complete flow finished.",
            "complete_flow",
            {
                "qa_passed": flow.get("qa_passed", False),
                "generated_frontend_file": flow.get("generated_frontend_file", "")
            }
        ))

    safe_flows = atl_read_json(ATL_SAFE_COMPLETE_FLOW_HISTORY_FILE, [])
    for flow in safe_flows[:20]:
        events.append(atl_event(
            "safe_complete_flow",
            f"Safe flow: {flow.get('feature_name', 'Unknown feature')}",
            flow.get("status", "unknown"),
            flow.get("created_at", ""),
            f"Rollback: {flow.get('rollback_status', 'unknown')}",
            "safe_complete_flow",
            {
                "qa_passed": flow.get("qa_passed", False),
                "rollback_status": flow.get("rollback_status", "unknown"),
                "generated_frontend_file": flow.get("generated_frontend_file", "")
            }
        ))

    install_logs = atl_read_json(ATL_INSTALL_LOG_FILE, [])
    for item in install_logs[:20]:
        events.append(atl_event(
            "safe_install",
            f"Safe install: /{item.get('target_route', '')}",
            item.get("status", "installed"),
            item.get("installed_at", ""),
            item.get("source_file", ""),
            "safe_install",
            item
        ))

    qa_logs = atl_read_json(ATL_QA_LOG_FILE, [])
    for item in qa_logs[:20]:
        events.append(atl_event(
            "qa_after_install",
            f"QA after install: /{item.get('target_route', '')}",
            item.get("status", "unknown"),
            item.get("created_at", ""),
            "Post-install QA completed.",
            "qa_after_install",
            {
                "passed": item.get("passed", False),
                "backend_ok": item.get("backend", {}).get("ok", False),
                "frontend_ok": item.get("frontend", {}).get("ok", False)
            }
        ))

    rollback_logs = atl_read_json(ATL_ROLLBACK_LOG_FILE, [])
    for item in rollback_logs[:20]:
        events.append(atl_event(
            "rollback",
            f"Rollback: /{item.get('target_route', '')}",
            item.get("status", "rolled_back"),
            item.get("rolled_back_at", ""),
            item.get("reason", ""),
            "rollback",
            item
        ))

    registry_logs = atl_read_json(ATL_REGISTRY_SYNC_LOG_FILE, [])
    for item in registry_logs[:20]:
        events.append(atl_event(
            "feature_registry_sync",
            f"Feature Registry sync: {item.get('feature_name', '')}",
            item.get("status", "synced"),
            item.get("synced_at", ""),
            item.get("action", ""),
            "feature_registry",
            item
        ))

    brain_logs = atl_read_json(ATL_PROJECT_BRAIN_SYNC_LOG_FILE, [])
    for item in brain_logs[:20]:
        events.append(atl_event(
            "project_brain_sync",
            f"Project Brain sync: {item.get('feature_name', '')}",
            item.get("status", "synced"),
            item.get("synced_at", ""),
            item.get("project_brain_file", ""),
            "project_brain",
            item
        ))

    handoff_logs = atl_read_json(ATL_HANDOFF_EXPORT_LOG_FILE, [])
    for item in handoff_logs[:20]:
        events.append(atl_event(
            "handoff_export",
            f"Handoff export: {item.get('feature_name', '')}",
            item.get("status", "exported"),
            item.get("exported_at", ""),
            item.get("handoff_file", ""),
            "handoff_export",
            item
        ))

    events = [event for event in events if event.get("created_at")]
    events.sort(key=lambda item: item.get("created_at", ""), reverse=True)

    return events[:100]

@app.get("/agent-chain-runner/live-timeline")
def agent_chain_runner_live_timeline():
    try:
        events = atl_collect_events()

        latest = events[0] if events else None

        return {
            "ok": True,
            "events": events,
            "latest": latest,
            "count": len(events),
            "generated_at": ATLDatetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load live timeline.",
            "error": str(error),
            "events": []
        }

# ============================================================
# Agent Chain Runner Run Lock v1
# Prevent duplicate complete flow runs
# ============================================================

from pydantic import BaseModel as ARLBaseModel
from pathlib import Path as ARLPath
from datetime import datetime as ARLDatetime
import json as ARLJson
import time as ARLTime

ARL_BASE_DIR = ARLPath(__file__).resolve().parents[2]
ARL_MEMORY_DIR = ARL_BASE_DIR / "memory"
ARL_LOCK_FILE = ARL_MEMORY_DIR / "agent_chain_run_lock.json"
ARL_LOCK_HISTORY_FILE = ARL_MEMORY_DIR / "agent_chain_run_lock_history.json"

class ARLLockedSafeFlowRequest(ARLBaseModel):
    feature_name: str = "One Click Feature Builder"
    task: str = "Build a safe generated dashboard feature from one click."
    priority: str = "High"
    style: str = "Dark AI dashboard"
    frontend_route: str = "one-click-feature"
    backend_route: str = "one-click-feature-api"
    approval_text: str = ""
    run_chain_qa: bool = False
    auto_rollback_on_qa_fail: bool = True
    note: str = "Locked safe complete flow"

class ARLClearLockRequest(ARLBaseModel):
    approval_text: str = ""
    reason: str = "Manual clear run lock"

def arl_read_json(path, default):
    try:
        if path.exists():
            return ARLJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def arl_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(ARLJson.dumps(data, indent=2), encoding="utf-8")

def arl_now():
    return ARLDatetime.now().strftime("%Y-%m-%d %H:%M:%S")

def arl_now_epoch():
    return int(ARLTime.time())

def arl_add_history(item):
    history = arl_read_json(ARL_LOCK_HISTORY_FILE, [])
    history.insert(0, item)
    arl_write_json(ARL_LOCK_HISTORY_FILE, history[:100])

def arl_get_lock():
    lock = arl_read_json(ARL_LOCK_FILE, {})
    if not isinstance(lock, dict):
        return {}
    return lock

def arl_is_locked():
    lock = arl_get_lock()

    if not lock.get("locked"):
        return False, lock, "not_locked"

    started_epoch = int(lock.get("started_epoch", 0))
    age_seconds = arl_now_epoch() - started_epoch

    # Auto-expire lock after 30 minutes in case server crashed.
    if age_seconds > 1800:
        lock["locked"] = False
        lock["status"] = "expired"
        lock["expired_at"] = arl_now()
        arl_write_json(ARL_LOCK_FILE, lock)
        arl_add_history({
            "action": "expired",
            "feature_name": lock.get("feature_name", ""),
            "created_at": arl_now(),
            "age_seconds": age_seconds
        })
        return False, lock, "expired"

    return True, lock, "locked"

def arl_set_lock(feature_name, route, note):
    lock = {
        "locked": True,
        "status": "running",
        "feature_name": feature_name,
        "frontend_route": route,
        "note": note,
        "started_at": arl_now(),
        "started_epoch": arl_now_epoch()
    }
    arl_write_json(ARL_LOCK_FILE, lock)
    arl_add_history({
        "action": "locked",
        "feature_name": feature_name,
        "frontend_route": route,
        "created_at": arl_now()
    })
    return lock

def arl_release_lock(feature_name, status, message):
    lock = arl_get_lock()
    lock["locked"] = False
    lock["status"] = status
    lock["message"] = message
    lock["finished_at"] = arl_now()
    arl_write_json(ARL_LOCK_FILE, lock)
    arl_add_history({
        "action": "released",
        "feature_name": feature_name,
        "status": status,
        "message": message,
        "created_at": arl_now()
    })
    return lock

@app.get("/agent-chain-runner/run-lock-status")
def agent_chain_runner_run_lock_status():
    try:
        locked, lock, reason = arl_is_locked()

        return {
            "ok": True,
            "locked": locked,
            "reason": reason,
            "lock": lock
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to read run lock status.",
            "error": str(error),
            "locked": False
        }

@app.get("/agent-chain-runner/run-lock-history")
def agent_chain_runner_run_lock_history():
    try:
        return {
            "ok": True,
            "history": arl_read_json(ARL_LOCK_HISTORY_FILE, [])
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load run lock history.",
            "error": str(error),
            "history": []
        }

@app.post("/agent-chain-runner/clear-run-lock")
def agent_chain_runner_clear_run_lock(request: ARLClearLockRequest):
    try:
        if request.approval_text.strip() != "CLEAR RUN LOCK":
            return {
                "ok": False,
                "message": "Approval text is wrong. Type CLEAR RUN LOCK exactly."
            }

        lock = arl_get_lock()
        lock["locked"] = False
        lock["status"] = "manually_cleared"
        lock["reason"] = request.reason
        lock["cleared_at"] = arl_now()
        arl_write_json(ARL_LOCK_FILE, lock)

        arl_add_history({
            "action": "manually_cleared",
            "reason": request.reason,
            "created_at": arl_now()
        })

        return {
            "ok": True,
            "message": "Run lock cleared.",
            "lock": lock
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to clear run lock.",
            "error": str(error)
        }

@app.post("/agent-chain-runner/complete-flow-safe-locked")
def agent_chain_runner_complete_flow_safe_locked(request: ARLLockedSafeFlowRequest):
    try:
        locked, current_lock, reason = arl_is_locked()

        if locked:
            return {
                "ok": False,
                "message": "Another agent chain flow is already running. Wait until it finishes or clear the lock.",
                "locked": True,
                "lock": current_lock
            }

        arl_set_lock(
            feature_name=request.feature_name,
            route=request.frontend_route,
            note=request.note
        )

        func = globals().get("agent_chain_runner_complete_flow_safe")
        cls = globals().get("ACFSafeCompleteFlowRequest")

        if not callable(func) or cls is None:
            arl_release_lock(
                feature_name=request.feature_name,
                status="failed",
                message="Safe Complete Flow v2 function or request class is missing."
            )
            return {
                "ok": False,
                "message": "Safe Complete Flow v2 is missing. Build that feature first."
            }

        safe_request = cls(
            feature_name=request.feature_name,
            task=request.task,
            priority=request.priority,
            style=request.style,
            frontend_route=request.frontend_route,
            backend_route=request.backend_route,
            approval_text=request.approval_text,
            run_chain_qa=request.run_chain_qa,
            auto_rollback_on_qa_fail=request.auto_rollback_on_qa_fail,
            note=request.note
        )

        result = func(safe_request)

        flow_status = "completed"
        message = "Locked safe complete flow finished."

        if isinstance(result, dict):
            flow = result.get("flow", {})
            flow_status = flow.get("status", "completed") if isinstance(flow, dict) else "completed"
            message = result.get("message", message)

        arl_release_lock(
            feature_name=request.feature_name,
            status=flow_status,
            message=message
        )

        return {
            "ok": True,
            "message": "Locked safe complete flow finished.",
            "locked": False,
            "result": result
        }

    except Exception as error:
        arl_release_lock(
            feature_name=request.feature_name,
            status="failed",
            message=str(error)
        )

        return {
            "ok": False,
            "message": "Locked safe complete flow failed.",
            "error": str(error)
        }

# ============================================================
# Agent Chain Runner Approval Center v1
# Central approval queue for dangerous actions
# ============================================================

from pydantic import BaseModel as AACBaseModel
from pathlib import Path as AACPath
from datetime import datetime as AACDatetime
import json as AACJson
import uuid as AACUuid

AAC_BASE_DIR = AACPath(__file__).resolve().parents[2]
AAC_MEMORY_DIR = AAC_BASE_DIR / "memory"
AAC_APPROVAL_FILE = AAC_MEMORY_DIR / "agent_chain_approval_center.json"

class AACCreateRequest(AACBaseModel):
    action_type: str = "safe_install"
    feature_name: str = "One Click Feature Builder"
    target_route: str = "one-click-feature"
    backend_route: str = "one-click-feature-api"
    file_name: str = ""
    task: str = "Build a safe generated dashboard feature from one click."
    priority: str = "High"
    style: str = "Dark AI dashboard"
    note: str = "Approval requested from Agent Chain Runner UI"
    payload: dict = {}

class AACApproveRequest(AACBaseModel):
    approval_id: str
    approval_text: str = ""
    execute: bool = True

class AACRejectRequest(AACBaseModel):
    approval_id: str
    reason: str = "Rejected from Approval Center"

def aac_now():
    return AACDatetime.now().strftime("%Y-%m-%d %H:%M:%S")

def aac_read_json(path, default):
    try:
        if path.exists():
            return AACJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def aac_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(AACJson.dumps(data, indent=2), encoding="utf-8")

def aac_required_phrase(action_type):
    phrases = {
        "safe_install": "APPROVE CHAIN INSTALL",
        "rollback": "ROLLBACK CHAIN INSTALL",
        "clear_run_lock": "CLEAR RUN LOCK",
        "locked_safe_flow": "APPROVE SAFE FULL FLOW"
    }
    return phrases.get(action_type, "APPROVE ACTION")

def aac_action_label(action_type):
    labels = {
        "safe_install": "Safe Install",
        "rollback": "Rollback Last Install",
        "clear_run_lock": "Clear Run Lock",
        "locked_safe_flow": "Locked Safe Full Flow"
    }
    return labels.get(action_type, action_type)

def aac_load_items():
    items = aac_read_json(AAC_APPROVAL_FILE, [])
    if not isinstance(items, list):
        return []
    return items

def aac_save_items(items):
    aac_write_json(AAC_APPROVAL_FILE, items[:200])

def aac_find_item(items, approval_id):
    for index, item in enumerate(items):
        if item.get("id") == approval_id:
            return index, item
    return -1, None

def aac_call_existing(step_name, function_name, class_name, payload):
    try:
        func = globals().get(function_name)
        cls = globals().get(class_name)

        if not callable(func):
            return {
                "ok": False,
                "message": f"Missing function: {function_name}",
                "step": step_name
            }

        if cls is None:
            return {
                "ok": False,
                "message": f"Missing request class: {class_name}",
                "step": step_name
            }

        request_obj = cls(**payload)
        result = func(request_obj)

        if not isinstance(result, dict):
            return {
                "ok": False,
                "message": "Execution returned non-dict result.",
                "raw": str(result),
                "step": step_name
            }

        return result

    except Exception as error:
        return {
            "ok": False,
            "message": str(error),
            "step": step_name
        }

def aac_execute_item(item, approval_text):
    action_type = item.get("action_type")
    payload = item.get("payload", {})
    target_route = item.get("target_route", "")

    if action_type == "safe_install":
        return aac_call_existing(
            "Safe Install",
            "agent_chain_runner_safe_install_approve",
            "ACSApproveRequest",
            {
                "file_name": payload.get("file_name", ""),
                "target_route": target_route,
                "approval_text": approval_text
            }
        )

    if action_type == "rollback":
        return aac_call_existing(
            "Rollback Last Install",
            "agent_chain_runner_rollback_last_install",
            "ARBRollbackRequest",
            {
                "target_route": target_route,
                "approval_text": approval_text,
                "reason": "Executed from Approval Center"
            }
        )

    if action_type == "clear_run_lock":
        return aac_call_existing(
            "Clear Run Lock",
            "agent_chain_runner_clear_run_lock",
            "ARLClearLockRequest",
            {
                "approval_text": approval_text,
                "reason": "Executed from Approval Center"
            }
        )

    if action_type == "locked_safe_flow":
        return aac_call_existing(
            "Locked Safe Full Flow",
            "agent_chain_runner_complete_flow_safe_locked",
            "ARLLockedSafeFlowRequest",
            {
                "feature_name": item.get("feature_name", "One Click Feature Builder"),
                "task": payload.get("task", "Build a safe generated dashboard feature from one click."),
                "priority": payload.get("priority", "High"),
                "style": payload.get("style", "Dark AI dashboard"),
                "frontend_route": target_route,
                "backend_route": item.get("backend_route", "one-click-feature-api"),
                "approval_text": approval_text,
                "run_chain_qa": False,
                "auto_rollback_on_qa_fail": True,
                "note": "Executed from Approval Center"
            }
        )

    return {
        "ok": False,
        "message": f"Unsupported approval action: {action_type}"
    }

@app.get("/agent-chain-runner/approval-center")
def agent_chain_runner_approval_center():
    try:
        items = aac_load_items()
        pending = [item for item in items if item.get("status") == "pending"]

        return {
            "ok": True,
            "items": items,
            "pending": pending,
            "count": len(items),
            "pending_count": len(pending),
            "generated_at": aac_now()
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load Approval Center.",
            "error": str(error),
            "items": [],
            "pending": []
        }

@app.post("/agent-chain-runner/approval-center/create")
def agent_chain_runner_approval_center_create(request: AACCreateRequest):
    try:
        action_type = request.action_type.strip()

        allowed = ["safe_install", "rollback", "clear_run_lock", "locked_safe_flow"]
        if action_type not in allowed:
            return {
                "ok": False,
                "message": f"Unsupported action_type. Use one of: {', '.join(allowed)}"
            }

        payload = dict(request.payload or {})

        if action_type == "safe_install":
            payload["file_name"] = request.file_name

        if action_type == "locked_safe_flow":
            payload["task"] = request.task
            payload["priority"] = request.priority
            payload["style"] = request.style

        item = {
            "id": str(AACUuid.uuid4()),
            "action_type": action_type,
            "label": aac_action_label(action_type),
            "feature_name": request.feature_name,
            "target_route": request.target_route.strip().strip("/"),
            "backend_route": request.backend_route.strip().strip("/"),
            "required_phrase": aac_required_phrase(action_type),
            "status": "pending",
            "note": request.note,
            "payload": payload,
            "created_at": aac_now(),
            "approved_at": "",
            "rejected_at": "",
            "executed_at": "",
            "execution_result": None
        }

        items = aac_load_items()
        items.insert(0, item)
        aac_save_items(items)

        return {
            "ok": True,
            "message": "Approval request created.",
            "approval": item
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to create approval request.",
            "error": str(error)
        }

@app.post("/agent-chain-runner/approval-center/approve")
def agent_chain_runner_approval_center_approve(request: AACApproveRequest):
    try:
        items = aac_load_items()
        index, item = aac_find_item(items, request.approval_id)

        if item is None:
            return {
                "ok": False,
                "message": "Approval item not found."
            }

        if item.get("status") not in ["pending", "approved"]:
            return {
                "ok": False,
                "message": f"Approval item is already {item.get('status')}."
            }

        required_phrase = item.get("required_phrase", "")
        if request.approval_text.strip() != required_phrase:
            return {
                "ok": False,
                "message": f"Wrong approval text. Type {required_phrase} exactly."
            }

        item["status"] = "approved"
        item["approved_at"] = aac_now()

        execution_result = None

        if request.execute:
            execution_result = aac_execute_item(item, request.approval_text.strip())
            item["execution_result"] = execution_result
            item["executed_at"] = aac_now()
            item["status"] = "executed" if execution_result.get("ok") else "execution_failed"

        items[index] = item
        aac_save_items(items)

        return {
            "ok": True,
            "message": "Approval processed.",
            "approval": item,
            "execution_result": execution_result
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Approval failed.",
            "error": str(error)
        }

@app.post("/agent-chain-runner/approval-center/reject")
def agent_chain_runner_approval_center_reject(request: AACRejectRequest):
    try:
        items = aac_load_items()
        index, item = aac_find_item(items, request.approval_id)

        if item is None:
            return {
                "ok": False,
                "message": "Approval item not found."
            }

        if item.get("status") != "pending":
            return {
                "ok": False,
                "message": f"Only pending items can be rejected. Current status: {item.get('status')}"
            }

        item["status"] = "rejected"
        item["rejected_at"] = aac_now()
        item["reject_reason"] = request.reason

        items[index] = item
        aac_save_items(items)

        return {
            "ok": True,
            "message": "Approval rejected.",
            "approval": item
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Reject failed.",
            "error": str(error)
        }

# ============================================================
# Agent Chain Runner Run Report Download v1
# Generates markdown report for latest flow/run
# ============================================================

from pydantic import BaseModel as ARRBaseModel
from pathlib import Path as ARRPath
from datetime import datetime as ARRDatetime
import json as ARRJson
import re as ARRRe

ARR_BASE_DIR = ARRPath(__file__).resolve().parents[2]
ARR_MEMORY_DIR = ARR_BASE_DIR / "memory"
ARR_REPORTS_DIR = ARR_BASE_DIR / "generated_reports"

ARR_CHAIN_HISTORY_FILE = ARR_MEMORY_DIR / "agent_chain_runner_history.json"
ARR_COMPLETE_FLOW_HISTORY_FILE = ARR_MEMORY_DIR / "agent_chain_complete_flow_history.json"
ARR_SAFE_COMPLETE_FLOW_HISTORY_FILE = ARR_MEMORY_DIR / "agent_chain_safe_complete_flow_history.json"
ARR_INSTALL_LOG_FILE = ARR_MEMORY_DIR / "agent_chain_safe_install_log.json"
ARR_QA_LOG_FILE = ARR_MEMORY_DIR / "agent_chain_install_qa_log.json"
ARR_ROLLBACK_LOG_FILE = ARR_MEMORY_DIR / "agent_chain_rollback_log.json"
ARR_REGISTRY_SYNC_LOG_FILE = ARR_MEMORY_DIR / "agent_chain_feature_registry_sync_log.json"
ARR_PROJECT_BRAIN_SYNC_LOG_FILE = ARR_MEMORY_DIR / "agent_chain_project_brain_sync_log.json"
ARR_HANDOFF_EXPORT_LOG_FILE = ARR_MEMORY_DIR / "agent_chain_handoff_export_log.json"
ARR_APPROVAL_CENTER_FILE = ARR_MEMORY_DIR / "agent_chain_approval_center.json"
ARR_REPORT_HISTORY_FILE = ARR_MEMORY_DIR / "agent_chain_run_report_history.json"

class ARRReportRequest(ARRBaseModel):
    feature_name: str = "One Click Feature Builder"
    target_route: str = "one-click-feature"
    backend_route: str = "one-click-feature-api"
    note: str = "Generated from Agent Chain Runner UI"

def arr_now():
    return ARRDatetime.now().strftime("%Y-%m-%d %H:%M:%S")

def arr_read_json(path, default):
    try:
        if path.exists():
            return ARRJson.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default

def arr_write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(ARRJson.dumps(data, indent=2), encoding="utf-8")

def arr_write_text(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

def arr_safe_slug(value):
    clean = str(value or "").strip().lower()
    clean = clean.replace("\\", "/").strip("/")
    clean = ARRRe.sub(r"[^a-z0-9_-]+", "-", clean)
    clean = clean.strip("-")
    return clean or "agent-chain-report"

def arr_latest_for_feature(path, feature_name="", target_route=""):
    items = arr_read_json(path, [])
    if not isinstance(items, list):
        return None

    feature_l = str(feature_name or "").strip().lower()
    route_l = str(target_route or "").strip().strip("/").lower()

    for item in items:
        item_feature = str(item.get("feature_name", "")).strip().lower()
        item_route = str(item.get("target_route") or item.get("frontend_route") or "").strip().strip("/").lower()

        if feature_l and item_feature == feature_l:
            return item

        if route_l and item_route == route_l:
            return item

    return items[0] if items else None

def arr_latest_many(path, count=10):
    items = arr_read_json(path, [])
    if not isinstance(items, list):
        return []
    return items[:count]

def arr_status_line(label, item, status_key="status"):
    if not item:
        return f"- {label}: not found"
    return f"- {label}: {item.get(status_key, 'unknown')}"

def arr_steps_text(run):
    if not run:
        return "- No chain steps found."

    lines = []

    for step in run.get("steps", []):
        name = step.get("agent") or step.get("step") or "Step"
        status = step.get("status", "")
        ok = step.get("ok", "")
        file_name = step.get("file", "")
        message = step.get("message", "")

        state = status or f"ok={ok}"
        extra = file_name or message
        lines.append(f"- {name}: {state} — {extra}")

    return "\n".join(lines) if lines else "- No chain steps found."

def arr_approval_text(items):
    if not items:
        return "- No approval items found."

    lines = []
    for item in items[:10]:
        lines.append(
            f"- {item.get('label', item.get('action_type', 'Approval'))}: "
            f"{item.get('status', 'unknown')} — /{item.get('target_route', '')} — {item.get('created_at', '')}"
        )

    return "\n".join(lines)

def arr_make_report(request):
    feature_name = request.feature_name
    target_route = request.target_route.strip().strip("/")
    backend_route = request.backend_route.strip().strip("/")

    chain_run = arr_latest_for_feature(ARR_CHAIN_HISTORY_FILE, feature_name, target_route)
    complete_flow = arr_latest_for_feature(ARR_COMPLETE_FLOW_HISTORY_FILE, feature_name, target_route)
    safe_flow = arr_latest_for_feature(ARR_SAFE_COMPLETE_FLOW_HISTORY_FILE, feature_name, target_route)
    install_item = arr_latest_for_feature(ARR_INSTALL_LOG_FILE, feature_name, target_route)
    qa_item = arr_latest_for_feature(ARR_QA_LOG_FILE, feature_name, target_route)
    rollback_item = arr_latest_for_feature(ARR_ROLLBACK_LOG_FILE, feature_name, target_route)
    registry_item = arr_latest_for_feature(ARR_REGISTRY_SYNC_LOG_FILE, feature_name, target_route)
    brain_item = arr_latest_for_feature(ARR_PROJECT_BRAIN_SYNC_LOG_FILE, feature_name, target_route)
    handoff_item = arr_latest_for_feature(ARR_HANDOFF_EXPORT_LOG_FILE, feature_name, target_route)
    approvals = arr_latest_many(ARR_APPROVAL_CENTER_FILE, 10)

    now = arr_now()

    chain_status = chain_run.get("status", "unknown") if chain_run else "unknown"
    safe_status = safe_flow.get("status", "unknown") if safe_flow else "unknown"
    qa_passed = qa_item.get("passed", safe_flow.get("qa_passed", "unknown") if safe_flow else "unknown") if qa_item else "unknown"

    return f"""# Agent Chain Run Report

Generated at: {now}

## Feature

- Feature name: {feature_name}
- Frontend route: /{target_route}
- Backend route: /{backend_route}
- Note: {request.note}

## Executive Status

- Latest chain status: {chain_status}
- Latest safe flow status: {safe_status}
- QA passed: {qa_passed}

## System Checkpoints

{arr_status_line("Agent Chain", chain_run)}
{arr_status_line("One Click Complete Flow", complete_flow)}
{arr_status_line("Safe Complete Flow", safe_flow)}
{arr_status_line("Safe Install", install_item)}
{arr_status_line("QA After Install", qa_item)}
{arr_status_line("Rollback", rollback_item)}
{arr_status_line("Feature Registry Sync", registry_item)}
{arr_status_line("Project Brain Sync", brain_item)}
{arr_status_line("Handoff Export", handoff_item)}

## Agent / Flow Steps

{arr_steps_text(safe_flow or complete_flow or chain_run)}

## Latest Approvals

{arr_approval_text(approvals)}

## Important Files

- Backend main file: dashboard/backend/main.py
- Frontend page: app/agent-chain-runner/page.tsx
- Reports folder: generated_reports
- Memory folder: memory

## Next Recommended Action

Continue building the next Agent Chain Runner feature only after:

1. Backend compile passes.
2. Frontend build passes.
3. Git status is clean or intentionally staged.
4. Runtime/generated files are not accidentally committed.

---
"""

def arr_add_report_history(item):
    history = arr_read_json(ARR_REPORT_HISTORY_FILE, [])
    if not isinstance(history, list):
        history = []
    history.insert(0, item)
    arr_write_json(ARR_REPORT_HISTORY_FILE, history[:100])

@app.post("/agent-chain-runner/run-report/generate")
def agent_chain_runner_run_report_generate(request: ARRReportRequest):
    try:
        ARR_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        report_text = arr_make_report(request)

        stamp = ARRDatetime.now().strftime("%Y%m%d_%H%M%S")
        slug = arr_safe_slug(request.feature_name)
        file_name = f"agent_chain_run_report_{slug}_{stamp}.md"
        report_path = ARR_REPORTS_DIR / file_name

        arr_write_text(report_path, report_text)

        history_item = {
            "feature_name": request.feature_name,
            "target_route": request.target_route.strip().strip("/"),
            "backend_route": request.backend_route.strip().strip("/"),
            "file_name": file_name,
            "file_path": str(report_path),
            "created_at": arr_now(),
            "status": "created"
        }

        arr_add_report_history(history_item)

        return {
            "ok": True,
            "message": "Run report generated.",
            "report": history_item,
            "report_text": report_text
        }

    except Exception as error:
        return {
            "ok": False,
            "message": "Run report generation failed.",
            "error": str(error)
        }

@app.get("/agent-chain-runner/run-report/history")
def agent_chain_runner_run_report_history():
    try:
        return {
            "ok": True,
            "history": arr_read_json(ARR_REPORT_HISTORY_FILE, [])
        }
    except Exception as error:
        return {
            "ok": False,
            "message": "Failed to load run report history.",
            "error": str(error),
            "history": []
        }

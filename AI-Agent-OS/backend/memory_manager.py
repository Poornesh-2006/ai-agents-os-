from pathlib import Path
import sqlite3
from datetime import datetime
from typing import Optional


BASE_DIR = Path(__file__).parent
MEMORY_DIR = BASE_DIR / "memory"
DB_PATH = MEMORY_DIR / "agent_memory.db"

CURRENT_RUN_DIR = BASE_DIR / "outputs" / "current_run"
RUNS_DIR = BASE_DIR / "outputs" / "runs"


AGENT_FILES = [
    ("product_manager", "01_product_manager_prd.md"),
    ("ui_ux_designer", "02_ui_ux_design.md"),
    ("frontend_developer", "03_frontend_plan.md"),
    ("backend_developer", "04_backend_plan.md"),
    ("database_engineer", "05_database_schema.md"),
    ("system_architect", "06_system_architecture.md"),
    ("qa_tester", "07_qa_test_plan.md"),
    ("project_reviewer", "08_final_blueprint.md"),
]


def now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def connect():
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(DB_PATH)


def init_db():
    conn = connect()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_name TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT,
        ended_at TEXT,
        archive_path TEXT,
        notes TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS agent_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER,
        agent_name TEXT NOT NULL,
        task_order INTEGER NOT NULL,
        status TEXT NOT NULL,
        output_file TEXT,
        started_at TEXT,
        ended_at TEXT,
        error_message TEXT,
        FOREIGN KEY(run_id) REFERENCES runs(id)
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS agent_outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER,
        agent_name TEXT NOT NULL,
        output_file TEXT NOT NULL,
        file_size INTEGER,
        created_at TEXT,
        summary TEXT,
        FOREIGN KEY(run_id) REFERENCES runs(id)
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS agent_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER,
        agent_name TEXT,
        error_type TEXT,
        error_message TEXT,
        suggested_fix TEXT,
        created_at TEXT,
        FOREIGN KEY(run_id) REFERENCES runs(id)
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS short_term_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER,
        memory_key TEXT NOT NULL,
        memory_value TEXT NOT NULL,
        created_at TEXT,
        FOREIGN KEY(run_id) REFERENCES runs(id)
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS long_term_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_key TEXT NOT NULL UNIQUE,
        memory_value TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
    )
    """)

    conn.commit()
    conn.close()

    print(f"✅ SQLite memory database ready: {DB_PATH}")


def create_run(run_name: Optional[str] = None, notes: str = "") -> int:
    if run_name is None:
        run_name = "run_" + datetime.now().strftime("%Y_%m_%d_%H%M%S")

    conn = connect()
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO runs (run_name, status, started_at, notes)
    VALUES (?, ?, ?, ?)
    """, (run_name, "started", now(), notes))

    run_id = cur.lastrowid

    for index, (agent_name, filename) in enumerate(AGENT_FILES, start=1):
        output_file = str(CURRENT_RUN_DIR / filename)
        cur.execute("""
        INSERT INTO agent_tasks
        (run_id, agent_name, task_order, status, output_file)
        VALUES (?, ?, ?, ?, ?)
        """, (run_id, agent_name, index, "pending", output_file))

    conn.commit()
    conn.close()

    print(f"✅ New run created: {run_name}")
    print(f"🆔 Run ID: {run_id}")
    return run_id


def scan_current_outputs(run_id: int):
    conn = connect()
    cur = conn.cursor()

    completed_count = 0

    for index, (agent_name, filename) in enumerate(AGENT_FILES, start=1):
        file_path = CURRENT_RUN_DIR / filename

        if file_path.exists() and file_path.stat().st_size > 0:
            file_size = file_path.stat().st_size
            completed_count += 1

            cur.execute("""
            UPDATE agent_tasks
            SET status = ?, ended_at = ?, output_file = ?
            WHERE run_id = ? AND agent_name = ?
            """, ("completed", now(), str(file_path), run_id, agent_name))

            cur.execute("""
            INSERT INTO agent_outputs
            (run_id, agent_name, output_file, file_size, created_at, summary)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (
                run_id,
                agent_name,
                str(file_path),
                file_size,
                now(),
                f"{agent_name} output saved successfully."
            ))
        else:
            cur.execute("""
            UPDATE agent_tasks
            SET status = ?
            WHERE run_id = ? AND agent_name = ?
            """, ("pending", run_id, agent_name))

    if completed_count == len(AGENT_FILES):
        cur.execute("""
        UPDATE runs
        SET status = ?, ended_at = ?
        WHERE id = ?
        """, ("completed", now(), run_id))
    else:
        cur.execute("""
        UPDATE runs
        SET status = ?
        WHERE id = ?
        """, ("partial", run_id))

    conn.commit()
    conn.close()

    print(f"✅ Current outputs scanned.")
    print(f"📄 Completed files found: {completed_count}/8")


def log_error(run_id: int, agent_name: str, error_message: str):
    error_type = detect_error_type(error_message)
    suggested_fix = suggest_fix(error_type)

    conn = connect()
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO agent_errors
    (run_id, agent_name, error_type, error_message, suggested_fix, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (run_id, agent_name, error_type, error_message, suggested_fix, now()))

    cur.execute("""
    UPDATE agent_tasks
    SET status = ?, error_message = ?
    WHERE run_id = ? AND agent_name = ?
    """, ("failed", error_message, run_id, agent_name))

    cur.execute("""
    UPDATE runs
    SET status = ?
    WHERE id = ?
    """, ("failed", run_id))

    conn.commit()
    conn.close()

    print("❌ Error logged.")
    print(f"Agent: {agent_name}")
    print(f"Type: {error_type}")
    print(f"Fix: {suggested_fix}")


def detect_error_type(error_message: str) -> str:
    text = error_message.lower()

    if "504" in text or "timeout" in text:
        return "NVIDIA_TIMEOUT_504"

    if "connection error" in text or "nvidia_nimexception" in text:
        return "NVIDIA_CONNECTION_ERROR"

    if "keyboardinterrupt" in text or "ctrl+c" in text:
        return "USER_STOPPED_RUN"

    if "pyproject.toml" in text:
        return "WRONG_FOLDER"

    if "no .md files" in text:
        return "NO_OUTPUT_FILES"

    return "UNKNOWN_ERROR"


def suggest_fix(error_type: str) -> str:
    fixes = {
        "NVIDIA_TIMEOUT_504": "Use 8B model for heavy agents, reduce output size, wait 2-5 minutes, then resume.",
        "NVIDIA_CONNECTION_ERROR": "Check internet/API, wait 2-5 minutes, then resume.",
        "USER_STOPPED_RUN": "Do not press Ctrl+C unless stopping. Resume from first missing file.",
        "WRONG_FOLDER": "Run commands inside app_builder_crew folder where pyproject.toml exists.",
        "NO_OUTPUT_FILES": "Run crewai run first. Archive only after .md output files exist.",
        "UNKNOWN_ERROR": "Check full traceback and retry safely."
    }

    return fixes.get(error_type, "Check logs and retry.")


def add_short_term_memory(run_id: int, key: str, value: str):
    conn = connect()
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO short_term_memory
    (run_id, memory_key, memory_value, created_at)
    VALUES (?, ?, ?, ?)
    """, (run_id, key, value, now()))

    conn.commit()
    conn.close()

    print(f"✅ Short-term memory added: {key}")


def add_long_term_memory(key: str, value: str):
    conn = connect()
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO long_term_memory
    (memory_key, memory_value, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(memory_key)
    DO UPDATE SET
        memory_value = excluded.memory_value,
        updated_at = excluded.updated_at
    """, (key, value, now(), now()))

    conn.commit()
    conn.close()

    print(f"✅ Long-term memory saved: {key}")


def show_status(run_id: int):
    conn = connect()
    cur = conn.cursor()

    cur.execute("""
    SELECT run_name, status, started_at, ended_at, archive_path
    FROM runs
    WHERE id = ?
    """, (run_id,))

    run = cur.fetchone()

    if not run:
        print(f"❌ No run found with ID: {run_id}")
        conn.close()
        return

    print("\n================ RUN STATUS ================")
    print(f"Run name: {run[0]}")
    print(f"Status: {run[1]}")
    print(f"Started: {run[2]}")
    print(f"Ended: {run[3]}")
    print(f"Archive: {run[4]}")
    print("============================================\n")

    cur.execute("""
    SELECT task_order, agent_name, status, output_file, error_message
    FROM agent_tasks
    WHERE run_id = ?
    ORDER BY task_order
    """, (run_id,))

    rows = cur.fetchall()

    for row in rows:
        task_order, agent_name, status, output_file, error_message = row
        symbol = "✅" if status == "completed" else "❌" if status == "failed" else "⏳"

        print(f"{symbol} Agent {task_order}: {agent_name} — {status}")
        print(f"   Output: {output_file}")

        if error_message:
            print(f"   Error: {error_message}")

    conn.close()


def set_archive_path(run_id: int, archive_path: str):
    conn = connect()
    cur = conn.cursor()

    cur.execute("""
    UPDATE runs
    SET archive_path = ?
    WHERE id = ?
    """, (archive_path, run_id))

    conn.commit()
    conn.close()

    print(f"✅ Archive path saved for run {run_id}")


def seed_default_long_term_memory():
    default_items = {
        "app_scope": "Devendra app is personal-only. No public SaaS, no community, no public profiles, no multi-user MVP.",
        "storage_rule": "Supabase is for normal structured data. Local encrypted storage is for medical reports, lab reports, body photos, private health notes, sensitive AI analysis, and local LLM memory.",
        "model_rule": "Use 70B for deep planning. Use 8B for backend, database, system architecture, QA, and project reviewer if 70B fails or times out.",
        "agent_8_rule": "Agent 8 final blueprint should stay under 2500 words to reduce timeout risk.",
        "resume_rule": "Resume system should skip completed output files and start from the first missing file.",
        "privacy_rule": "Private health files should never upload to cloud automatically."
    }

    for key, value in default_items.items():
        add_long_term_memory(key, value)

    print("✅ Default long-term memory seeded.")


def export_short_term_memory(run_id: int):
    short_term_path = MEMORY_DIR / "short_term_memory.md"

    conn = connect()
    cur = conn.cursor()

    cur.execute("""
    SELECT run_name, status, started_at, ended_at, archive_path
    FROM runs
    WHERE id = ?
    """, (run_id,))
    run = cur.fetchone()

    cur.execute("""
    SELECT task_order, agent_name, status, output_file, error_message
    FROM agent_tasks
    WHERE run_id = ?
    ORDER BY task_order
    """, (run_id,))
    tasks = cur.fetchall()

    conn.close()

    if not run:
        print(f"❌ No run found with ID: {run_id}")
        return

    lines = []
    lines.append("# Short-Term Memory\n")
    lines.append("## Current Run\n")
    lines.append(f"- Run name: {run[0]}")
    lines.append(f"- Status: {run[1]}")
    lines.append(f"- Started: {run[2]}")
    lines.append(f"- Ended: {run[3]}")
    lines.append(f"- Archive path: {run[4]}")
    lines.append("\n## Agent Status\n")

    for task_order, agent_name, status, output_file, error_message in tasks:
        symbol = "✅" if status == "completed" else "❌" if status == "failed" else "⏳"
        lines.append(f"- {symbol} Agent {task_order}: {agent_name} — {status}")
        lines.append(f"  - Output: {output_file}")
        if error_message:
            lines.append(f"  - Error: {error_message}")

    lines.append("\n## Next Step\n")
    lines.append("- Use resume_run.py if any output file is missing.")
    lines.append("- Use archive_run.py after successful runs.")
    lines.append("- Build dashboard UI after memory and resume are stable.")

    short_term_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"✅ Short-term memory exported: {short_term_path}")


def export_long_term_memory():
    long_term_path = MEMORY_DIR / "long_term_memory.md"

    conn = connect()
    cur = conn.cursor()

    cur.execute("""
    SELECT memory_key, memory_value, updated_at
    FROM long_term_memory
    ORDER BY memory_key
    """)
    memories = cur.fetchall()

    conn.close()

    lines = []
    lines.append("# Long-Term Memory\n")
    lines.append("Permanent rules and decisions for the AI Agent Operating System.\n")

    for key, value, updated_at in memories:
        lines.append(f"## {key}")
        lines.append("")
        lines.append(value)
        lines.append("")
        lines.append(f"_Updated: {updated_at}_")
        lines.append("")

    long_term_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"✅ Long-term memory exported: {long_term_path}")


def export_all_memory(run_id: int):
    export_short_term_memory(run_id)
    export_long_term_memory()
    print("✅ All memory exported to markdown files.")

if __name__ == "__main__":
    init_db()

    run_id = create_run(notes="Stage 5 memory export test run.")
    scan_current_outputs(run_id)
    seed_default_long_term_memory()
    show_status(run_id)
    export_all_memory(run_id)
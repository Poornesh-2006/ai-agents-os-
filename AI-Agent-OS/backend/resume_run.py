from pathlib import Path
import os
import yaml
from dotenv import load_dotenv

from crewai import Agent, Crew, LLM, Process, Task

from memory_manager import init_db, create_run, scan_current_outputs, log_error


load_dotenv()

BASE_DIR = Path(__file__).parent

AGENTS_CONFIG_PATH = BASE_DIR / "src" / "app_builder_crew" / "config" / "agents.yaml"
TASKS_CONFIG_PATH = BASE_DIR / "src" / "app_builder_crew" / "config" / "tasks.yaml"

MAX_CONTEXT_CHARS_PER_FILE = 8000

def safe_crewai_template(text: str) -> str:
    """
    CrewAI treats {word} as input variables.
    This removes all curly braces safely.
    """
    if text is None:
        return ""

    text = str(text)

    text = text.replace("{app_idea}", APP_IDEA)
    text = text.replace("{", "[").replace("}", "]")

    return text

APP_IDEA = """
Private personal AI health and life tracker app for Devendra.

Important:
- Personal-only app.
- No public SaaS.
- No public signup.
- No community.
- No social sharing.
- No public profiles.
- No multi-user MVP.
- Supabase for normal structured data.
- Local encrypted storage for medical reports, lab reports, body photos, private notes, sensitive AI analysis, and local LLM memory.
- Next.js frontend.
- Python analysis engine.
- Dashboard, health, workout, food, sleep, tasks, books, finance, rewards, medical reports, organ health, AI assistant, privacy settings.
"""


TASK_ORDER = [
    ("product_manager_task", "product_manager"),
    ("ui_ux_designer_task", "ui_ux_designer"),
    ("frontend_developer_task", "frontend_developer"),
    ("backend_developer_task", "backend_developer"),
    ("database_engineer_task", "database_engineer"),
    ("system_architect_task", "system_architect"),
    ("qa_tester_task", "qa_tester"),
    ("project_reviewer_task", "project_reviewer"),
]


FAST_TASKS = {
    "backend_developer_task",
    "database_engineer_task",
    "system_architect_task",
    "qa_tester_task",
    "project_reviewer_task",
}


def load_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as file:
        return yaml.safe_load(file)


def get_llm_for_task(task_name: str) -> LLM:
    if task_name in FAST_TASKS:
        return LLM(
            model="nvidia_nim/meta/llama-3.1-8b-instruct",
            api_key=os.getenv("NVIDIA_API_KEY_FAST") or os.getenv("NVIDIA_NIM_API_KEY"),
        )

    return LLM(
        model="nvidia_nim/meta/llama-3.1-70b-instruct",
        api_key=os.getenv("NVIDIA_API_KEY_HEAVY") or os.getenv("NVIDIA_NIM_API_KEY"),
    )


def get_output_file(tasks_config: dict, task_name: str) -> Path:
    output_file = tasks_config[task_name].get("output_file")

    if not output_file:
        raise ValueError(f"No output_file found for {task_name} in tasks.yaml")

    return BASE_DIR / output_file


def find_first_missing_task(tasks_config: dict) -> int:
    for index, (task_name, _) in enumerate(TASK_ORDER):
        output_path = get_output_file(tasks_config, task_name)

        if not output_path.exists() or output_path.stat().st_size == 0:
            return index

    return -1


def build_saved_context(tasks_config: dict, stop_before_index: int) -> str:
    context_parts = []

    for index in range(stop_before_index):
        task_name, _ = TASK_ORDER[index]
        output_path = get_output_file(tasks_config, task_name)

        if output_path.exists():
            content = output_path.read_text(encoding="utf-8", errors="ignore")
            content = safe_crewai_template(content)

            if len(content) > MAX_CONTEXT_CHARS_PER_FILE:
                content = content[:MAX_CONTEXT_CHARS_PER_FILE] + "\n\n[TRUNCATED FOR RESUME CONTEXT]"

            context_parts.append(
                f"""
==============================
SAVED OUTPUT FROM: {task_name}
FILE: {output_path}
==============================

{content}
"""
            )

    return "\n\n".join(context_parts)


def main():
    init_db()

    agents_config = load_yaml(AGENTS_CONFIG_PATH)
    tasks_config = load_yaml(TASKS_CONFIG_PATH)

    start_index = find_first_missing_task(tasks_config)

    if start_index == -1:
        print("✅ All 8 output files already exist.")
        print("Nothing to resume.")
        return

    start_task_name, start_agent_name = TASK_ORDER[start_index]
    print(f"🔁 Resume starting from: {start_task_name}")

    run_id = create_run(notes=f"Resume run starting from {start_task_name}")

    saved_context = build_saved_context(tasks_config, start_index)

    resume_agents = []
    resume_tasks = []
    created_tasks = []

    for index in range(start_index, len(TASK_ORDER)):
        task_name, agent_name = TASK_ORDER[index]

        agent = Agent(
            config=agents_config[agent_name],
            llm=get_llm_for_task(task_name),
            verbose=True,
        )

        task_config = tasks_config[task_name]
        output_file = task_config.get("output_file")

        Path(output_file).parent.mkdir(parents=True, exist_ok=True)

        description = safe_crewai_template(task_config["description"])

        if saved_context:
            description = f"""
{description}

IMPORTANT RESUME CONTEXT:
The crew is resuming from a failed or stopped run.
Previous agents already completed successfully.
Use the saved outputs below as context.
Do not ask previous agents to run again.
Continue from the current task only.

{saved_context}
"""

        task = Task(
            description=description,
            expected_output=safe_crewai_template(task_config["expected_output"]),
            agent=agent,
            output_file=output_file,
            context=created_tasks.copy(),
        )

        resume_agents.append(agent)
        resume_tasks.append(task)
        created_tasks.append(task)

    crew = Crew(
        agents=resume_agents,
        tasks=resume_tasks,
        process=Process.sequential,
        verbose=True,
    )

    try:
        result = crew.kickoff(
    inputs={
        "app_idea": APP_IDEA,
        "weight": "80 kg",
        "height": "5 feet 6 inches",
        "age": "18",
        "goal_weight": "70 kg",
    }
)
        scan_current_outputs(run_id)

        print("\n✅ Resume run finished.")
        print(result)

    except Exception as e:
        error_message = str(e)
        log_error(run_id, start_agent_name, error_message)

        print("\n❌ Resume run failed.")
        print(error_message)
        raise


if __name__ == "__main__":
    main()
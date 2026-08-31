import os
from dotenv import load_dotenv

from crewai import Agent, Crew, LLM, Process, Task
from crewai.project import CrewBase, agent, crew, task

load_dotenv()


@CrewBase
class AppBuilderCrew:
    """8-agent sequential app-building crew powered by NVIDIA NIM."""

    agents: list[Agent]
    tasks: list[Task]

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    # ── LLM CONFIG ────────────────────────────────────────────────────────────
    # Key 1: Heavy agents using Llama 3.1 70B
    llm_70b_heavy = LLM(
        model="nvidia_nim/meta/llama-3.1-70b-instruct",
        api_key=os.getenv("NVIDIA_API_KEY_HEAVY"),
    )

    # Key 2: Fast agents using Llama 3.1 8B
    llm_8b_fast = LLM(
        model="nvidia_nim/meta/llama-3.1-8b-instruct",
        api_key=os.getenv("NVIDIA_API_KEY_FAST"),
    )

    # ── AGENTS ────────────────────────────────────────────────────────────────

    @agent
    def product_manager(self) -> Agent:
        return Agent(
            config=self.agents_config["product_manager"],
            llm=self.llm_70b_heavy,
            verbose=True,
        )

    @agent
    def ui_ux_designer(self) -> Agent:
        return Agent(
            config=self.agents_config["ui_ux_designer"],
            llm=self.llm_70b_heavy,
            verbose=True,
        )

    @agent
    def frontend_developer(self) -> Agent:
        return Agent(
            config=self.agents_config["frontend_developer"],
            llm=self.llm_70b_heavy,
            verbose=True,
        )

    @agent
    def backend_developer(self) -> Agent:
        return Agent(
            config=self.agents_config["backend_developer"],
            llm=self.llm_70b_heavy,
            verbose=True,
        )

    @agent
    def database_engineer(self) -> Agent:
        return Agent(
            config=self.agents_config["database_engineer"],
            llm=self.llm_70b_heavy,
            verbose=True,
        )

    @agent
    def system_architect(self) -> Agent:
        return Agent(
            config=self.agents_config["system_architect"],
            llm=self.llm_8b_fast,
            verbose=True,
        )

    @agent
    def qa_tester(self) -> Agent:
        return Agent(
            config=self.agents_config["qa_tester"],
            llm=self.llm_8b_fast,
            verbose=True,
        )

    @agent
    def project_reviewer(self) -> Agent:
        return Agent(
            config=self.agents_config["project_reviewer"],
            llm=self.llm_70b_heavy,
            verbose=True,
        )

    # ── TASKS ─────────────────────────────────────────────────────────────────

    @task
    def product_manager_task(self) -> Task:
        return Task(
            config=self.tasks_config["product_manager_task"],
        )

    @task
    def ui_ux_designer_task(self) -> Task:
        return Task(
            config=self.tasks_config["ui_ux_designer_task"],
        )

    @task
    def frontend_developer_task(self) -> Task:
        return Task(
            config=self.tasks_config["frontend_developer_task"],
        )

    @task
    def backend_developer_task(self) -> Task:
        return Task(
            config=self.tasks_config["backend_developer_task"],
        )

    @task
    def database_engineer_task(self) -> Task:
        return Task(
            config=self.tasks_config["database_engineer_task"],
        )

    @task
    def system_architect_task(self) -> Task:
        return Task(
            config=self.tasks_config["system_architect_task"],
        )

    @task
    def qa_tester_task(self) -> Task:
        return Task(
            config=self.tasks_config["qa_tester_task"],
        )

    @task
    def project_reviewer_task(self) -> Task:
        return Task(
            config=self.tasks_config["project_reviewer_task"],
        )

    # ── CREW ──────────────────────────────────────────────────────────────────

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
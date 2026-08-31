#!/usr/bin/env python
from app_builder_crew.crew import AppBuilderCrew


def run():
    """
    Run the CrewAI app-builder crew.
    """

    inputs = {
        "app_idea": """
IMPORTANT:
This app is only for me, Devendra. Do not design this as a public SaaS app.
No public signup, no community, no social sharing, no subscription, no public profiles,
and no multi-user system in MVP.

Build a private personal AI health and life tracker app.

Main goal:
I want one private app that tracks my health, gym progress, sleep, food, tasks, finance,
books, knowledge, habits, medical reports, and long-term body transformation.

Privacy and storage:
- Supabase is for normal daily structured data.
- Local encrypted storage is for private medical reports, lab reports, body photos,
  private health notes, sensitive AI analysis, and local LLM memory.
- Private reports should never upload to cloud automatically.
- User must choose what syncs and what stays local.

Frontend:
Use Next.js if possible.

Pages needed:
- Dashboard
- Health tracking
- Workout tracking
- Food tracking
- Sleep tracking
- Tasks and habits
- Books and knowledge
- Finance
- Rewards / Solo Leveling
- Medical reports
- Organ health pages
- AI assistant
- Privacy settings

Backend:
Plan a Python analysis engine like life_os_engine/main.py.

The Python engine should analyze:
- Health
- Sleep
- Recovery
- Workouts
- Food
- Tasks
- Habits
- Books
- Skills
- Finance
- Rewards
- Organ health
- Lab reports
- Wearable data
- Daily briefing
- Weekly report
- Monthly report
- Yearly report

Core features:

1. Dashboard
Daily score, health score, sleep score, recovery score, workout score,
food score, task score, finance summary, knowledge progress, XP, streaks,
charts, progress cards, and AI recommendations.

2. Health tracking
Weight, BMI, body fat, waist, chest, arms, legs, shoulders, heart rate,
HRV, steps, calories, water, mood, energy, stress, blood pressure, glucose,
cholesterol, vitamins, liver markers, kidney markers, symptoms, and health notes.

3. Organ health pages
Heart, brain, liver, kidney, lungs, stomach/gut, bones, skin, muscles, blood, hormones.
Each organ page should show status, metrics, risks, habits affecting it,
foods, report insights, and improvement plan.

4. Gym and workout
Daily workout plan, exercise library, sets, reps, weight, rest time, calories,
strength progress, muscle group tracking, weekly split, recovery-based workout suggestions,
fat-loss roadmap, six-pack roadmap, and monthly comparison.

5. Food and nutrition
Calories, protein, carbs, fats, fiber, water, vegetarian foods, eggs, milk,
soya chunks, peanuts, almonds, rice, chapati, dal, curd, limited chicken if needed,
food score, protein warning, calorie warning, and weekly nutrition report.

6. Sleep and recovery
Sleep duration, bedtime, wake time, REM, deep sleep, sleep quality, sleep efficiency,
recovery score, and relationship with workout, mood, focus, and productivity.

7. Tasks, goals, and roadmap
Daily todo, weekly goals, monthly goals, yearly goals, habit tracker, streak system,
AI timetable, college, coding, gym, startup work, reading, and personal tasks.

8. Books and knowledge
Books to read, currently reading, completed books, pages, chapters, notes,
key ideas, skill tracking, radar chart, and daily learning plan.

9. Finance
Income, expenses, savings, investments, business income, stock/crypto manual tracking now,
APIs later, profit/loss, monthly spending analysis, and saving goals.

10. Reward / Solo Leveling system
XP, levels, badges, achievements, streaks, daily quests, weekly quests,
wishlist rewards, missed habit penalty, and motivation system.

11. Future features
DIY wearable integration, local LLM, 3D body twin, body photos, organ color status,
Supabase optional sync, and mobile app.

MVP:
- Personal-only app
- No public SaaS features
- Next.js frontend
- Supabase normal data
- Local private report storage plan
- Python analysis engine
- Dashboard
- Health, workout, food, sleep, tasks, books, finance, rewards
- AI recommendation page
- Basic charts and progress cards
- Privacy settings

Final output needed:
Create a complete app-building blueprint with PRD, UI/UX design, frontend plan,
backend plan, Supabase schema, local private storage design, AI analysis engine plan,
privacy architecture, testing plan, and step-by-step roadmap.
"""
    }

    try:
        AppBuilderCrew().crew().kickoff(inputs=inputs)
    except Exception as e:
        raise Exception(f"An error occurred while running the crew: {e}")


if __name__ == "__main__":
    run()
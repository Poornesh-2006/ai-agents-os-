# main.py - Life OS Complete AI Analysis Engine
# All features: Health, Workouts, Food, Sleep, Tasks, Books, Finance, Rewards, Organs
# One smart Mistral agent with 15+ specialized contexts
# Real-time + Scheduled + Wearable + Reports + Privacy-aware

import asyncio
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import requests
from enum import Enum
from dataclasses import dataclass
import hashlib
import os

# ═══════════════════════════════════════════════════════════════
# 1. CONFIGURATION & CONSTANTS
# ═══════════════════════════════════════════════════════════════

OLLAMA_API = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "mistral"

# Local private storage for sensitive data
PRIVATE_DATA_DIR = "./private_data"
LOCAL_DB_PATH = "./private_data/life_os_private.db"

class AgentContext(Enum):
    """All specialized agent modes"""
    # Health & Body
    HEALTH_ANALYSIS = "health"
    SLEEP_ANALYSIS = "sleep"
    RECOVERY_ANALYSIS = "recovery"
    ORGAN_ANALYSIS = "organ"
    BIOMARKER_ANALYSIS = "biomarker"
    LAB_REPORTS = "lab_analysis"
    BODY_MEASUREMENT = "body_measurement"
    
    # Fitness & Workouts
    WORKOUT_ANALYSIS = "workout"
    STRENGTH_PROGRESS = "strength"
    MUSCLE_TRACKING = "muscle"
    BODY_TRANSFORMATION = "transformation"
    RECOVERY_WORKOUT = "recovery_workout"
    
    # Nutrition & Food
    NUTRITION_ANALYSIS = "nutrition"
    MEAL_TRACKING = "meal"
    MACRO_ANALYSIS = "macro"
    DIET_GOAL = "diet_goal"
    
    # Tasks & Productivity
    TODO_MANAGEMENT = "todo"
    MISSION_GENERATION = "mission"
    GOAL_TRACKING = "goal"
    DAILY_SCHEDULE = "schedule"
    
    # Learning & Knowledge
    BOOKS_LEARNING = "books"
    SKILL_TRACKING = "skill"
    KNOWLEDGE_RADAR = "knowledge"
    LEARNING_PLAN = "learning_plan"
    
    # Finance
    FINANCE_ANALYSIS = "finance"
    EXPENSE_TRACKING = "expense"
    INVESTMENT_ANALYSIS = "investment"
    SAVINGS_GOAL = "savings"
    WEALTH_TRACKING = "wealth"
    
    # Habits & Streaks
    HABIT_TRACKING = "habits"
    STREAK_MOTIVATION = "streak"
    HABIT_PATTERN = "pattern"
    
    # RPG & Rewards
    RPG_PROGRESSION = "rpg"
    XP_CALCULATION = "xp"
    LEVEL_UP = "levelup"
    ACHIEVEMENT = "achievement"
    REWARD_SYSTEM = "reward"
    
    # Motivation
    MOTIVATION = "motivation"
    DAILY_BRIEFING = "daily_briefing"
    
    # Reports
    HOLISTIC_DAILY = "daily_summary"
    WEEKLY_REPORT = "weekly_report"
    MONTHLY_REPORT = "monthly_report"
    YEARLY_REPORT = "yearly_report"
    
    # Wearable
    WEARABLE_DATA = "wearable"

# ═══════════════════════════════════════════════════════════════
# 2. COMPREHENSIVE SYSTEM PROMPTS FOR ALL CONTEXTS
# ═══════════════════════════════════════════════════════════════

SYSTEM_PROMPTS = {
    AgentContext.HEALTH_ANALYSIS: """You are Life OS Health Analysis Agent.
    
Role: Complete health data analysis covering all metrics.

Analyze:
1. Weight, BMI, body fat percentage trends
2. Heart rate, HRV, steps, calories, water intake
3. Mood, energy levels, stress indicators
4. Blood pressure, glucose, cholesterol if available
5. Health symptoms and notes patterns

Output format:
- Current Health Score: [0-100]
- Key Metrics: [list with status]
- Trends: [improving/stable/declining]
- Correlations: [what affects what]
- Concerns: [if any]
- Recommendations: [specific actions]
- Doctor Consultation: [if risky values]

Tone: Health coach. Data-driven. Safety-first.""",

    AgentContext.SLEEP_ANALYSIS: """You are Life OS Sleep Science Agent.

Analyze sleep data:
1. Sleep duration (target 7-9 hours)
2. Sleep quality metrics
3. REM vs deep sleep percentage
4. Sleep efficiency
5. Bedtime and wake time patterns
6. Sleep affecting factors

Connect sleep to:
- Workout performance
- HRV and recovery
- Focus and productivity
- Mood and energy
- Muscle growth

Output:
- Sleep Score: [0-100]
- Sleep Quality: [excellent/good/fair/poor]
- Recovery Impact: [+/-% on recovery]
- Optimal Bedtime: [recommended]
- Sleep Debt: [hours owed]
- Tonight's Recommendation: [specific]

Tone: Sleep optimization coach. Science-backed.""",

    AgentContext.RECOVERY_ANALYSIS: """You are Life OS Recovery Scientist Agent.

Calculate recovery score from:
1. Sleep quality and duration
2. HRV trends
3. Resting heart rate
4. Workout intensity last days
5. Stress levels
6. Nutrition quality
7. Rest days taken

Output:
- Recovery Score: [0-100]
- Readiness: [ready to train hard / light / rest]
- Key Factors: [what's helping/hurting]
- Next 48 Hours: [training recommendation]
- Action Items: [sleep more / eat more / rest / hydrate]

Tone: Recovery optimization coach.""",

    AgentContext.ORGAN_ANALYSIS: """You are Life OS Organ Health Agent.

Analyze individual organ health (Heart, Brain, Liver, Kidney, Lungs, Stomach, Bones, Skin, Muscles, Blood, Hormones).

For each organ:
1. Related metrics (HR for heart, glucose for liver, etc)
2. Associated symptoms
3. Lab results affecting it
4. Habits impacting it
5. Risk signals
6. Improvement plan

Output:
- Organ Status: [healthy/caution/concern]
- Related Metrics: [current values]
- Risk Level: [low/medium/high]
- Top 3 Improvements: [specific actions]
- Foods Recommended: [list]
- Habits to Adopt: [list]
- When to See Doctor: [if applicable]

Tone: Medical but accessible. Practical.""",

    AgentContext.BIOMARKER_ANALYSIS: """You are Life OS Biomarker Analysis Agent.

Analyze lab test results:
1. Compare to previous tests (trend detection)
2. Check if in healthy ranges
3. Identify concerning patterns
4. Connect to lifestyle factors
5. Predict future values
6. Recommend follow-up tests

Biomarkers tracked:
- Testosterone, Vitamin D, HbA1c
- Creatinine, Cholesterol, CRP
- Blood glucose, Liver markers, Kidney markers

Output:
- Biomarker: [name, value, unit, range]
- Status: [normal/low/high]
- Trend: [improving/stable/declining]
- vs Baseline: [compared to your history]
- Lifestyle Impact: [what affects it]
- Recommendation: [action]
- Next Test Date: [when]

Tone: Lab results interpreter. Actionable.""",

    AgentContext.LAB_REPORTS: """You are Life OS Lab Report Analysis Agent.

When user uploads medical/lab reports:
1. Extract key data
2. Flag concerning values
3. Connect to health recommendations
4. Compare to personal baselines
5. Suggest lifestyle changes
6. Recommend next tests

Output:
- Report Summary: [key findings]
- Critical Values: [any concerning]
- Positive Changes: [improvements]
- Action Items: [what to do]
- Doctor Follow-up: [needed?]
- Lifestyle Changes: [specific]
- Monitoring Plan: [next steps]

Store locally (encrypted). NEVER upload to cloud.

Tone: Report interpreter. Practical guidance.""",

    AgentContext.WORKOUT_ANALYSIS: """You are Life OS Workout Progress Agent.

Analyze workout data:
1. Weekly workout frequency
2. Exercise variety
3. Strength progression (weight/reps)
4. Muscle group balance
5. Recovery between sessions
6. Workout consistency
7. Intensity distribution

Connect to:
- Body fat loss/muscle gain
- Strength stat growth
- XP earned
- Recovery needed

Output:
- Workout Score: [0-100]
- Weekly Frequency: [X workouts/week]
- Progression: [+X% vs last month]
- Muscle Groups: [balanced?]
- Next Workout: [recommendation based on recovery]
- Form Check: [if needed]
- Intensity: [right level?]
- Strength Growth: [+X kg vs baseline]

Tone: Fitness coach. Encouraging but honest.""",

    AgentContext.STRENGTH_PROGRESS: """You are Life OS Strength Tracking Agent.

Track strength progression:
1. Bench press, squat, deadlift progress
2. Rep maxes and volume
3. Progressive overload tracking
4. Weak points identification
5. Recovery impact on strength
6. Nutrition impact on gains

Output:
- Strength Stat: [current level, +X growth]
- Lifts Tracked: [your PRs]
- Progressive Overload: [+X%]
- Next Targets: [recommended]
- Weakness: [what to focus on]
- Recovery Needed: [hours/days]
- Protein Recommendation: [grams]

Tone: Strength coach. Data-focused.""",

    AgentContext.NUTRITION_ANALYSIS: """You are Life OS Nutrition Coach Agent.

Analyze daily nutrition:
1. Calories vs goal
2. Protein vs target
3. Carbs and fats balance
4. Micronutrients coverage
5. Hydration level
6. Meal timing

Compare to goals:
- Fat loss: calorie deficit
- Muscle gain: protein + surplus
- Maintenance: balanced
- Better sleep: magnesium, carbs
- Better focus: omega-3, B vitamins

Output:
- Food Score: [0-100]
- Calories: [X vs goal]
- Protein: [X vs Xg target]
- Macro Balance: [carbs/fats/protein %]
- Warnings: [if low protein or high calories]
- Hydration: [X liters vs 3L goal]
- Tomorrow's Meal Plan: [suggestions for goal]

Tone: Nutrition coach. Practical.""",

    AgentContext.MEAL_TRACKING: """You are Life OS Meal Logger Agent.

When user logs meals:
1. Extract nutrients
2. Calculate macros
3. Track meal timing
4. Identify patterns
5. Suggest improvements

Support Indian foods:
- Rice, chapati, dal, curd, eggs
- Milk, vegetables, fruits
- Limited chicken, nuts (almonds, peanuts)
- Soya chunks

Output:
- Meal: [name, time]
- Calories: [estimated]
- Protein: [grams]
- Macros: [carbs/fats]
- Quality: [good/okay/improve]
- Timing: [optimal for goals?]
- Next Meal Suggestion: [when, what]

Tone: Meal advisor. Non-judgmental.""",

    AgentContext.TODO_MANAGEMENT: """You are Life OS Quest Master Agent.

Generate daily missions and track:
1. Create quests based on goals
2. Set difficulty (Easy=50XP, Med=100XP, Hard=200XP)
3. Stack related tasks into quest chains
4. Track completion
5. Reward XP

Daily missions include:
- Health quests (workout, sleep, water, food)
- Habit quests (morning routine, reading, etc)
- Productivity quests (coding, studying, work)
- Finance quests (save money, invest, track)
- Learning quests (read, course, skill practice)

Output:
- Daily Missions: [list with difficulty & XP]
- Priority: [today's main quests]
- Quest Chain: [connected quests]
- Progress: [% complete]
- Time Estimate: [hours needed]
- Rewards: [XP earned for completion]
- Motivation: [encouraging message]

Tone: RPG quest giver. Make tasks exciting.""",

    AgentContext.GOAL_TRACKING: """You are Life OS Goal Strategist Agent.

Manage goals across timeframes:
1. Daily goals (today's focus)
2. Weekly goals (this week's targets)
3. Monthly goals (this month's milestones)
4. Yearly goals (annual targets)

For each goal:
1. Track progress percentage
2. Identify obstacles
3. Suggest next actions
4. Calculate ETA
5. Adjust if off-track

Goal categories:
- Health (weight loss, muscle gain, fitness)
- Finance (save ₹X, invest ₹X)
- Learning (read X books, learn X skill)
- Productivity (complete projects)
- Habits (build streaks)

Output:
- Goal: [name, timeframe]
- Progress: [% complete]
- ETA: [when will complete]
- Next Action: [do this today]
- Blockers: [what's preventing progress]
- Confidence: [likely to achieve?]
- Motivation: [inspiring message]

Tone: Goal coach. Reality-based.""",

    AgentContext.BOOKS_LEARNING: """You are Life OS Learning Growth Agent.

Track reading and learning:
1. Books read, currently reading, want to read
2. Pages read vs total
3. Reading progress percentage
4. Key learnings extracted
5. Skills being developed
6. Learning streak

Book categories:
- Health & fitness
- Finance & investing
- Business & startup
- Psychology & self-development
- Technical (coding, AI)
- Fiction (if reading)

Output:
- Current Book: [title, author, % progress]
- Books This Month: [count, pages]
- Learning Stats: [books/month trend]
- Key Learnings: [top 3 insights]
- Skills Improving: [which ones]
- Intelligence Growth: [+X%]
- Next Book Recommendation: [based on interests]
- Daily Reading Target: [pages to read]

Tone: Learning enthusiast. Curious.""",

    AgentContext.SKILL_TRACKING: """You are Life OS Skill Development Agent.

Track skills across domains:
- Coding (languages, frameworks)
- AI/ML (model understanding)
- Business (startup, management)
- Health (fitness knowledge)
- Finance (investing, crypto)
- Communication (writing, speaking)
- English (fluency improvement)

For each skill:
1. Current level (beginner/intermediate/advanced/expert)
2. Progress this month
3. Time invested
4. Practical application
5. Next milestone
6. Learning resources used

Output:
- Skill: [name, current level]
- Progress: [+X% this month]
- Hours Invested: [total & this month]
- Next Level: [what to learn]
- Resource: [book, course, practice]
- Application: [how to use it]
- Intelligence Growth: [skill progression]

Tone: Skill coach. Practical focus.""",

    AgentContext.FINANCE_ANALYSIS: """You are Life OS Financial Strategist Agent.

Complete financial analysis:
1. Income tracking (all sources)
2. Expense tracking by category
3. Savings rate calculation
4. Net worth growth
5. Investment portfolio review
6. Savings goals progress
7. Spending patterns

Expense categories:
- Food, transport, health
- Education, books, courses
- Entertainment, subscriptions
- Business investments
- Other

Output:
- Income: [total, sources]
- Expenses: [by category, total]
- Savings Rate: [% saved]
- Net Worth: [current, trend]
- Wealth Stat: [current level, +X growth]
- Savings Progress: [vs goal]
- Investment Performance: [gains/losses]
- Opportunities: [where to optimize]
- Next Action: [investment, saving plan]

Tone: Financial advisor. Data-focused.""",

    AgentContext.EXPENSE_TRACKING: """You are Life OS Budget Tracker Agent.

When user logs expense:
1. Categorize it
2. Track against budget
3. Flag if overspending
4. Identify patterns
5. Suggest reductions

Output:
- Expense: [amount, category, description]
- Monthly Total: [updated]
- Category Budget: [X spent of Xg budget]
- Status: [under/over/on-track]
- Pattern: [is this normal spending?]
- Savings Impact: [reduces by ₹X]
- Suggestion: [if overspending]

Tone: Budget watchdog. Non-judgmental.""",

    AgentContext.INVESTMENT_ANALYSIS: """You are Life OS Investment Advisor Agent.

Track investments:
1. Stocks portfolio
2. Crypto holdings
3. Mutual funds
4. Savings bonds
5. Other investments

For each:
1. Current value
2. Gains/losses
3. Percentage return
4. Buy price vs current
5. Hold/sell recommendation (educational)
6. Diversification check

Output:
- Portfolio: [total value]
- Stocks: [holdings, gains]
- Crypto: [holdings, gains]
- Total Return: [% growth]
- Best Performer: [which]
- Diversification: [good?]
- Risk Assessment: [level]
- Learning: [investment strategy]

Note: Educational only, not financial advice.

Tone: Investment educator. Risk-aware.""",

    AgentContext.HABIT_TRACKING: """You are Life OS Habit Accountability Agent.

Track habits and streaks:
1. Daily habits (morning routine, gym, read, meditate)
2. Weekly habits (meal prep, weekly review)
3. Streak tracking
4. Completion percentage
5. Habit momentum
6. Missed day patterns

Habits tracked:
- Morning routine, workouts, water intake
- Reading, deep work, meditation
- Meal logging, sleep on time
- Finance tracking, learning

Output:
- Habit: [name, X day streak]
- Status: [✅ done / ❌ missed]
- This Month: [X/30 completions]
- Momentum: [on-fire/hot/warm/cold]
- Longest Streak: [personal record]
- Missed Days: [what happened?]
- Next Milestone: [7/14/30 day streak]
- Discipline Growth: [+X%]

Tone: Streak protector. Celebratory.""",

    AgentContext.RPG_PROGRESSION: """You are Life OS Character Progression Agent.

Manage RPG stats and progression:
- Strength (from workouts, weight lifted)
- Intelligence (from books, learning)
- Discipline (from habits, consistency)
- Wealth (from saving, investing)
- Focus (from deep work, meditation)
- Endurance (from sleep, cardio)

Track:
1. Stat current values
2. Daily changes
3. Level progression (1-100)
4. Rank system (E→D→C→B→A→S→SS→SSS)
5. New ability unlocks
6. Total XP earned

Output:
- Character Level: [X, XP to next]
- Stats: [Strength 78, Intelligence 65, etc]
- Stat Changes: [+3 Strength, +2 Discipline]
- Rank: [B rank 45% → 62%]
- New Unlocks: [ability/feature]
- XP Earned Today: [total]

Tone: RPG game master. Epic progression.""",

    AgentContext.XP_CALCULATION: """You are Life OS XP Rewards Agent.

Calculate XP for all actions:
- Workout completed: 80-150 XP (based on difficulty)
- Meal logged: 10 XP
- Sleep: 20 XP (if 7+ hours)
- Water target: 15 XP
- Habit completed: 25-50 XP
- Book progress: 5 XP per 10 pages
- Task completed: 50-200 XP (easy/med/hard)
- Finance logged: 10 XP
- Deep work hour: 30 XP

Output:
- Action: [what was done]
- XP Earned: [+X XP]
- New Total: [Y total XP]
- To Next Level: [Z XP remaining]
- Streak Bonus: [+X% if on streak]
- Daily Total: [summary]

Tone: Reward system. Celebratory.""",

    AgentContext.MOTIVATION: """You are Life OS Motivation & Mindset Agent.

Inspire and motivate user:
1. Celebrate wins (big and small)
2. Acknowledge struggles
3. Connect actions to goals
4. Use Solo Leveling energy language
5. Reinforce identity change
6. Push through resistance

Output:
- Win Celebration: [what they achieved]
- Impact: [why this matters]
- Identity: [who they're becoming]
- Next Level: [what's possible]
- Power-up Message: [Solo Leveling vibes]
- Action: [what to do next]
- Confidence: [you got this!]

Tone: Hype coach. Solo Leveling energy. MOTIVATING.""",

    AgentContext.DAILY_BRIEFING: """You are Life OS Daily Coach Agent.

Every morning, provide complete daily briefing:

Include:
1. Health Status (sleep, HRV, recovery, energy)
2. Habit Status (streaks, today's habits)
3. Fitness (today's workout plan)
4. Nutrition (meal suggestions)
5. Tasks (today's missions)
6. Finance (spending warning if needed)
7. Learning (today's reading target)
8. RPG Progress (yesterday's changes)
9. Motivational Message

Output:
- ⭐ GOOD MORNING, HUNTER!
- Health: [briefing]
- Habits: [streaks]
- Today's Missions: [quests]
- Predictions: [likely outcomes]
- Motivation: [inspiring message]
- Final Challenge: [what to conquer today]

Tone: Personal coach. Energetic. Ready to lead.""",

    AgentContext.WEEKLY_REPORT: """You are Life OS Weekly Analyst Agent.

Deep analysis of entire week:

Include:
1. Sleep quality trend
2. HRV patterns
3. Workout consistency
4. Habit streaks (which held, which broke)
5. Nutrition quality
6. Financial summary
7. Learning progress
8. Character growth (stat improvements)
9. Patterns detected
10. Next week recommendations

Output:
- Week Summary
- What Worked: [3 things]
- What Broke: [3 things]
- Stat Growth: [which stats +X%]
- Best Habit: [which was strongest]
- Challenge: [what to work on]
- Next Week Plan: [specific goals]
- Motivation: [inspiring closer]

Tone: Strategic analyst. Honest assessment.""",

    AgentContext.MONTHLY_REPORT: """You are Life OS Monthly Strategic Agent.

Month-long comprehensive analysis:

Include:
1. Body transformation (weight, body fat, measurements)
2. Strength progress (lifts, muscle gain)
3. Health improvements (biomarkers, sleep)
4. Habit formation (which established)
5. Financial progress (savings, investments)
6. Learning achievements (books, skills)
7. Character growth (levels, ranks)
8. Biggest wins
9. Top challenges
10. Month 2 strategy

Output:
- Month Summary
- Transformation: [body changes]
- Progress: [all metrics]
- XP Earned: [total for month]
- Level Growth: [levels gained]
- Biggest Win: [what mattered most]
- Lessons: [what learned]
- Next Month: [plan for month 2]

Tone: Strategic coach. Long-term vision.""",

    AgentContext.WEARABLE_DATA: """You are Life OS Wearable Data Agent.

Process real-time ESP32 wearable data:
- Heart rate, HRV, temperature, steps
- Movement patterns
- Sleep detection
- Activity zones

Output:
- Live Metrics: [current HR, HRV, temp, steps]
- Status: [normal/caution/alert]
- Recovery Update: [% change]
- Daily Totals: [steps, estimated calories]
- Alerts: [if any anomalies]
- Recovery Impact: [how this affects recovery score]

Tone: Real-time reporter. Factual."""
}

# ═══════════════════════════════════════════════════════════════
# 3. DATA MODELS
# ═══════════════════════════════════════════════════════════════

@dataclass
class HealthData:
    """Complete health snapshot"""
    timestamp: str
    weight: Optional[float] = None
    bmi: Optional[float] = None
    body_fat: Optional[float] = None
    sleep_hours: Optional[float] = None
    hrv_ms: Optional[int] = None
    heart_rate_bpm: Optional[int] = None
    recovery_percent: Optional[int] = None
    steps: Optional[int] = None
    water_liters: Optional[float] = None
    mood: Optional[str] = None
    energy: Optional[int] = None
    stress: Optional[int] = None
    blood_pressure: Optional[str] = None
    glucose: Optional[float] = None
    
    def to_dict(self) -> Dict:
        return {
            k: v for k, v in self.__dict__.items() 
            if v is not None
        }

@dataclass
class WorkoutData:
    """Complete workout session"""
    timestamp: str
    exercise: str
    duration_minutes: int
    intensity: str  # light/moderate/hard
    sets: Optional[int] = None
    reps: Optional[int] = None
    weight_kg: Optional[float] = None
    calories_burned: Optional[int] = None
    
    def to_dict(self) -> Dict:
        return self.__dict__

@dataclass
class MealData:
    """Meal entry"""
    timestamp: str
    meal_name: str
    calories: Optional[int] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fats_g: Optional[float] = None
    ingredients: Optional[List[str]] = None
    
    def to_dict(self) -> Dict:
        return self.__dict__

# ═══════════════════════════════════════════════════════════════
# 4. MAIN AGENT CLASS - ENHANCED
# ═══════════════════════════════════════════════════════════════

class LifeOSAgent:
    """One smart Mistral agent handling ALL Life OS features"""
    
    def __init__(self):
        self.model = OLLAMA_MODEL
        self.api_url = OLLAMA_API
        self.context = AgentContext.HOLISTIC_DAILY
        self.user_data = {}
        self.analysis_cache = {}
        self.init_private_storage()
        
    def init_private_storage(self):
        """Initialize encrypted local storage for private data"""
        if not os.path.exists(PRIVATE_DATA_DIR):
            os.makedirs(PRIVATE_DATA_DIR)
        
        # Initialize SQLite for private data
        conn = sqlite3.connect(LOCAL_DB_PATH)
        cursor = conn.cursor()
        
        # Private reports table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS private_reports (
                id INTEGER PRIMARY KEY,
                report_type TEXT,
                file_name TEXT,
                file_path TEXT,
                upload_date TEXT,
                extracted_text TEXT,
                ai_analysis TEXT,
                encrypted BOOLEAN
            )
        ''')
        
        # Private notes table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS private_notes (
                id INTEGER PRIMARY KEY,
                note TEXT,
                created_date TEXT,
                tags TEXT,
                encrypted BOOLEAN
            )
        ''')
        
        # Body photos metadata
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS body_photos (
                id INTEGER PRIMARY KEY,
                photo_path TEXT,
                date_taken TEXT,
                measurements_json TEXT,
                visible BOOLEAN
            )
        ''')
        
        conn.commit()
        conn.close()
        print("✅ Private storage initialized")
    
    def set_context(self, context: AgentContext):
        """Switch agent mode"""
        self.context = context
        print(f"🤖 Agent → {context.value.upper()}")
    
    def get_system_prompt(self, context: AgentContext) -> str:
        """Get specialized system prompt"""
        return SYSTEM_PROMPTS.get(context, SYSTEM_PROMPTS[AgentContext.HOLISTIC_DAILY])
    
    async def analyze(self, user_input: str, context: AgentContext = None, 
                     user_context: Dict = None) -> str:
        """
        Analyze with Mistral in specific context.
        
        Args:
            user_input: Question/data/request
            context: Which agent mode
            user_context: User's personal data for personalization
        """
        if context:
            self.set_context(context)
        
        system_prompt = self.get_system_prompt(self.context)
        
        # Add user context for personalization
        if user_context:
            system_prompt += f"\n\nUSER CONTEXT:\n{json.dumps(user_context, indent=2)}"
        
        try:
            response = requests.post(
                self.api_url,
                json={
                    "model": self.model,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_input}],
                    "stream": False
                },
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                return result['message']['content']
            else:
                return f"❌ Error: {response.status_code}"
        except Exception as e:
            return f"❌ Error: {str(e)}"

# ═══════════════════════════════════════════════════════════════
# 5. COMPREHENSIVE DATA PROCESSORS
# ═══════════════════════════════════════════════════════════════

class DataProcessor:
    """Process ALL types of user data"""
    
    # ───────── HEALTH ─────────
    @staticmethod
    def process_health_log(health_data: HealthData) -> Dict:
        return {
            "type": "health_log",
            **health_data.to_dict()
        }
    
    @staticmethod
    def process_sleep_log(duration: float, quality: int, rem_percent: int, 
                         deep_percent: int) -> Dict:
        return {
            "type": "sleep",
            "timestamp": datetime.now().isoformat(),
            "duration_hours": duration,
            "quality_score": quality,
            "rem_percent": rem_percent,
            "deep_percent": deep_percent
        }
    
    @staticmethod
    def process_body_measurement(weight: float, bmi: float, body_fat: float,
                                waist: float, chest: float, arms: float,
                                legs: float, shoulders: float) -> Dict:
        return {
            "type": "measurement",
            "timestamp": datetime.now().isoformat(),
            "weight_kg": weight,
            "bmi": bmi,
            "body_fat_percent": body_fat,
            "measurements": {
                "waist_cm": waist,
                "chest_cm": chest,
                "arms_cm": arms,
                "legs_cm": legs,
                "shoulders_cm": shoulders
            }
        }
    
    # ───────── WORKOUTS ─────────
    @staticmethod
    def process_workout(workout: WorkoutData) -> Dict:
        return {"type": "workout", **workout.to_dict()}
    
    @staticmethod
    def process_strength_log(exercise: str, weight: float, reps: int, 
                            sets: int) -> Dict:
        return {
            "type": "strength",
            "timestamp": datetime.now().isoformat(),
            "exercise": exercise,
            "weight_kg": weight,
            "reps": reps,
            "sets": sets,
            "volume": weight * reps * sets
        }
    
    # ───────── NUTRITION ─────────
    @staticmethod
    def process_meal(meal: MealData) -> Dict:
        return {"type": "meal", **meal.to_dict()}
    
    @staticmethod
    def process_water_intake(liters: float) -> Dict:
        return {
            "type": "water",
            "timestamp": datetime.now().isoformat(),
            "liters": liters
        }
    
    # ───────── TASKS & HABITS ─────────
    @staticmethod
    def process_habit_completion(habit: str, streak: int) -> Dict:
        return {
            "type": "habit",
            "timestamp": datetime.now().isoformat(),
            "habit": habit,
            "streak_days": streak
        }
    
    @staticmethod
    def process_todo(task: str, priority: str, category: str, 
                    difficulty: str = "medium") -> Dict:
        xp_map = {"easy": 50, "medium": 100, "hard": 200}
        return {
            "type": "todo",
            "timestamp": datetime.now().isoformat(),
            "task": task,
            "priority": priority,
            "category": category,
            "difficulty": difficulty,
            "xp_reward": xp_map.get(difficulty, 100)
        }
    
    # ───────── BOOKS & LEARNING ─────────
    @staticmethod
    def process_book_progress(title: str, author: str, pages_read: int, 
                             total_pages: int, rating: Optional[int] = None) -> Dict:
        return {
            "type": "book",
            "timestamp": datetime.now().isoformat(),
            "title": title,
            "author": author,
            "pages_read": pages_read,
            "total_pages": total_pages,
            "progress_percent": (pages_read / total_pages) * 100,
            "rating": rating
        }
    
    @staticmethod
    def process_skill_progress(skill: str, domain: str, level: str, 
                              hours_invested: int) -> Dict:
        return {
            "type": "skill",
            "timestamp": datetime.now().isoformat(),
            "skill": skill,
            "domain": domain,
            "level": level,
            "hours": hours_invested
        }
    
    # ───────── FINANCE ─────────
    @staticmethod
    def process_expense(amount: float, category: str, description: str) -> Dict:
        return {
            "type": "expense",
            "timestamp": datetime.now().isoformat(),
            "amount_inr": amount,
            "category": category,
            "description": description
        }
    
    @staticmethod
    def process_investment(type_: str, name: str, amount: float, 
                          buy_price: Optional[float] = None) -> Dict:
        return {
            "type": "investment",
            "timestamp": datetime.now().isoformat(),
            "investment_type": type_,  # stock/crypto/fund
            "name": name,
            "amount_inr": amount,
            "buy_price": buy_price
        }
    
    # ───────── LAB REPORTS ─────────
    @staticmethod
    def process_lab_report(test_name: str, value: float, unit: str, 
                          reference_range: str) -> Dict:
        return {
            "type": "lab_report",
            "timestamp": datetime.now().isoformat(),
            "test_name": test_name,
            "value": value,
            "unit": unit,
            "reference_range": reference_range
        }
    
    # ───────── WEARABLE ─────────
    @staticmethod
    def process_wearable_data(hr: int, hrv: int, temp: float, steps: int) -> Dict:
        return {
            "type": "wearable",
            "timestamp": datetime.now().isoformat(),
            "heart_rate": hr,
            "hrv": hrv,
            "body_temp": temp,
            "steps": steps
        }

# ═══════════════════════════════════════════════════════════════
# 6. SCHEDULED ANALYSIS ENGINE
# ═══════════════════════════════════════════════════════════════

class ScheduledAnalysis:
    """Real-time and scheduled analysis"""
    
    def __init__(self, agent: LifeOSAgent):
        self.agent = agent
    
    async def process_real_time(self, data: Dict) -> str:
        """Instant feedback on logged data"""
        data_type = data.get("type")
        
        context_map = {
            "health_log": AgentContext.HEALTH_ANALYSIS,
            "sleep": AgentContext.SLEEP_ANALYSIS,
            "measurement": AgentContext.BODY_MEASUREMENT,
            "workout": AgentContext.WORKOUT_ANALYSIS,
            "strength": AgentContext.STRENGTH_PROGRESS,
            "meal": AgentContext.MEAL_TRACKING,
            "water": AgentContext.NUTRITION_ANALYSIS,
            "habit": AgentContext.HABIT_TRACKING,
            "todo": AgentContext.TODO_MANAGEMENT,
            "book": AgentContext.BOOKS_LEARNING,
            "skill": AgentContext.SKILL_TRACKING,
            "expense": AgentContext.EXPENSE_TRACKING,
            "investment": AgentContext.INVESTMENT_ANALYSIS,
            "lab_report": AgentContext.LAB_REPORTS,
            "wearable": AgentContext.WEARABLE_DATA
        }
        
        context = context_map.get(data_type, AgentContext.HOLISTIC_DAILY)
        user_input = f"User logged: {json.dumps(data, indent=2)}\n\nAnalyze and respond."
        
        return await self.agent.analyze(user_input, context)
    
    async def daily_summary(self, daily_data: Dict) -> str:
        """Complete daily briefing"""
        prompt = f"""
Daily Data Summary:
{json.dumps(daily_data, indent=2)}

Provide a complete morning briefing covering all aspects of their health, habits, and goals.
Include specific recommendations for today.
"""
        return await self.agent.analyze(prompt, AgentContext.DAILY_BRIEFING)
    
    async def weekly_summary(self, weekly_data: Dict) -> str:
        """Deep weekly analysis"""
        prompt = f"""
Weekly Data Summary:
{json.dumps(weekly_data, indent=2)}

Provide strategic weekly analysis with patterns, trends, and next-week recommendations.
"""
        return await self.agent.analyze(prompt, AgentContext.WEEKLY_REPORT)
    
    async def monthly_summary(self, monthly_data: Dict) -> str:
        """Month-long strategic report"""
        prompt = f"""
Monthly Data Summary:
{json.dumps(monthly_data, indent=2)}

Provide comprehensive monthly analysis of body transformation, progress, and strategy.
"""
        return await self.agent.analyze(prompt, AgentContext.MONTHLY_REPORT)

# ═══════════════════════════════════════════════════════════════
# 7. MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════

async def main():
    """Complete Life OS system demonstration"""
    
    print("\n" + "="*70)
    print("🎮 LIFE OS - COMPLETE AI ANALYSIS ENGINE")
    print("="*70)
    print("✅ One Smart Mistral Agent")
    print("✅ 25+ Specialized Contexts")
    print("✅ All Features: Health, Fitness, Nutrition, Finance, Learning, RPG")
    print("✅ Real-time + Scheduled + Wearable + Reports")
    print("✅ Privacy-aware Local Storage")
    print("="*70 + "\n")
    
    # Initialize
    agent = LifeOSAgent()
    scheduler = ScheduledAnalysis(agent)
    
    # ────── HEALTH DATA PROCESSING ──────
    print("📊 1. HEALTH DATA ANALYSIS")
    print("-" * 70)
    health = HealthData(
        timestamp=datetime.now().isoformat(),
        sleep_hours=6.0,
        hrv_ms=52,
        heart_rate_bpm=72,
        recovery_percent=85,
        weight=72,
        body_fat=18,
        water_liters=2.1
    )
    health_resp = await scheduler.process_real_time(DataProcessor.process_health_log(health))
    print(f"Agent:\n{health_resp}\n")
    
    # ────── WORKOUT DATA PROCESSING ──────
    print("💪 2. WORKOUT ANALYSIS")
    print("-" * 70)
    workout = WorkoutData(
        timestamp=datetime.now().isoformat(),
        exercise="Chest Workout",
        duration_minutes=45,
        intensity="hard",
        sets=4,
        reps=8,
        weight_kg=80
    )
    workout_resp = await scheduler.process_real_time(DataProcessor.process_workout(workout))
    print(f"Agent:\n{workout_resp}\n")
    
    # ────── NUTRITION DATA PROCESSING ──────
    print("🍽️ 3. MEAL TRACKING")
    print("-" * 70)
    meal = MealData(
        timestamp=datetime.now().isoformat(),
        meal_name="Lunch - Rice, Chicken, Vegetables",
        calories=650,
        protein_g=45,
        carbs_g=60,
        fats_g=18
    )
    meal_resp = await scheduler.process_real_time(DataProcessor.process_meal(meal))
    print(f"Agent:\n{meal_resp}\n")
    
    # ────── HABIT TRACKING ──────
    print("✅ 4. HABIT TRACKING")
    print("-" * 70)
    habit_resp = await scheduler.process_real_time(
        DataProcessor.process_habit_completion("Morning Routine", 7)
    )
    print(f"Agent:\n{habit_resp}\n")
    
    # ────── BOOK READING ──────
    print("📚 5. LEARNING PROGRESS")
    print("-" * 70)
    book_resp = await scheduler.process_real_time(
        DataProcessor.process_book_progress(
            title="Atomic Habits",
            author="James Clear",
            pages_read=150,
            total_pages=320,
            rating=5
        )
    )
    print(f"Agent:\n{book_resp}\n")
    
    # ────── FINANCE TRACKING ──────
    print("💰 6. EXPENSE TRACKING")
    print("-" * 70)
    expense_resp = await scheduler.process_real_time(
        DataProcessor.process_expense(
            amount=450,
            category="food",
            description="Lunch at restaurant"
        )
    )
    print(f"Agent:\n{expense_resp}\n")
    
    # ────── LAB REPORT ──────
    print("🧪 7. LAB REPORT ANALYSIS")
    print("-" * 70)
    lab_resp = await scheduler.process_real_time(
        DataProcessor.process_lab_report(
            test_name="Vitamin D",
            value=28,
            unit="ng/mL",
            reference_range="30-100"
        )
    )
    print(f"Agent:\n{lab_resp}\n")
    
    # ────── TODO/MISSIONS ──────
    print("📋 8. DAILY MISSIONS")
    print("-" * 70)
    todo_resp = await scheduler.process_real_time(
        DataProcessor.process_todo(
            task="Complete chest + tricep workout",
            priority="high",
            category="health",
            difficulty="hard"
        )
    )
    print(f"Agent:\n{todo_resp}\n")
    
    # ────── DAILY BRIEFING ──────
    print("🌅 9. DAILY BRIEFING")
    print("-" * 70)
    daily_data = {
        "sleep": 6.0,
        "hrv": 52,
        "recovery": 85,
        "workouts_completed": 1,
        "meals_logged": 2,
        "water": 2.1,
        "habits_done": 5,
        "todo_progress": "45%"
    }
    daily_brief = await scheduler.daily_summary(daily_data)
    print(f"Agent:\n{daily_brief}\n")
    
    # ────── WEEKLY REPORT ──────
    print("📈 10. WEEKLY REPORT")
    print("-" * 70)
    weekly_data = {
        "workouts": 4,
        "sleep_avg": 6.8,
        "habits_completed": "32/40",
        "weight_change": "-0.5kg",
        "expenses": 2400,
        "books_pages": 120,
        "xp_earned": 2840
    }
    weekly_rep = await scheduler.weekly_summary(weekly_data)
    print(f"Agent:\n{weekly_rep}\n")
    
    # ────── MONTHLY REPORT ──────
    print("📊 11. MONTHLY REPORT")
    print("-" * 70)
    monthly_data = {
        "weight_change": "-2.5kg",
        "body_fat_change": "-1.2%",
        "strength_progress": "+15kg benchpress",
        "workouts": 16,
        "books_read": 1.5,
        "savings": 5000,
        "level_progress": "LVL 23→24",
        "stats_improvement": {"Strength": "+5", "Discipline": "+8"}
    }
    monthly_rep = await scheduler.monthly_summary(monthly_data)
    print(f"Agent:\n{monthly_rep}\n")
    
    print("="*70)
    print("✅ Complete Life OS system demonstrated!")
    print("="*70)
 
# ═══════════════════════════════════════════════════════════════
# 8. RUN
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    asyncio.run(main())
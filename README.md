# SEO + GEO Intelligence Platform

An AI-powered intelligence platform that combines traditional SEO analysis with GEO (Generative Engine Optimization) / AI-search visibility intelligence.

## Purpose

The platform answers:

- **"How is my website performing in traditional search?"** — via SEO health analysis
- **"How visible is my website to AI answer/search systems?"** — via GEO readiness scoring
- **"What changed?"** / **"Why?"** — via historical tracking (planned)
- **"What should I do next?"** — via AI-powered recommendations (planned)
- **"What worked in the past?"** — via persistent agent memory (planned)

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full system architecture.

```
Frontend (React/Vite/TS)
    ↓
FastAPI Backend
    ↓
Supabase (Auth + PostgreSQL)
```

## Current Status: Phase 1 — Foundation

Phase 1 establishes the project scaffolding, authentication, database schema, and application shell. No crawler logic, scoring engines, or AI features are implemented yet.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- A Supabase project (see [Supabase Setup](#supabase-setup))

### Frontend Setup

```bash
# Install dependencies
npm install

# Create .env file from template
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Start development server
npm run dev
```

The frontend runs at `http://localhost:5173`.

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file in the project root
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Start the API server
uvicorn app.main:app --reload --port 8000
```

The backend runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. The database schema (tables, RLS policies, triggers) has been applied via migration
3. Copy the project URL and keys from **Settings > API** into your `.env` file

### Running Tests

```bash
# Backend tests
cd backend
pytest tests/ -v

# Frontend type checking
npx tsc --noEmit

# Frontend production build
npm run build
```

---

## Environment Variables

### PUBLIC (Frontend — `VITE_` prefix)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_API_URL` | Backend API URL (default: `http://localhost:8000`) |

### PRIVATE (Backend — never exposed to frontend)

| Variable | Description | Phase |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | 1 |
| `SUPABASE_ANON_KEY` | Supabase anon key | 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | 1 |
| `OPENAI_API_KEY` | OpenAI search visibility observations | 3+ |
| `GEMINI_API_KEY` | Google Gemini grounded search observations | 3+ |
| `ANTHROPIC_API_KEY` | Anthropic Claude provider architecture | 3+ |
| `XAI_API_KEY` | xAI Grok provider key | 3+ |
| `TAVILY_API_KEY` | Tavily public web & competitor research | 3+ |
| `GSC_CLIENT_ID` | Google Search Console OAuth client ID | 3+ |
| `GSC_CLIENT_SECRET` | Google Search Console OAuth client secret | 3+ |
| `HINDSIGHT_API_KEY` | Hindsight memory API key | 4 |
| `HINDSIGHT_BASE_URL` | Optional custom/self-hosted Hindsight endpoint | 4 |

---

## Phase 4: LangGraph + Hindsight + Recommendation Intelligence

Phase 4 establishes the autonomous intelligence layer connecting traditional SEO data, Google Search Console, AI search citations, and long-term memory.

### Architectural Separation of Responsibilities
* **Supabase**: Structured application data (projects, crawls, pages, SEO issues, GSC analytics, AI visibility checks, citations, recommendations, agent memories).
* **Hindsight**: Long-term agent memory retaining past strategies, outcomes, lessons learned, and user approval/rejection preferences.
* **LangGraph**: Stateful reasoning and orchestration graph running an evidence-based pipeline.
* **Tavily**: Independent public web research baseline for competitor discovery and content format insights.
* **GSC**: Traditional search performance data (clicks, impressions, CTR, average position).
* **AI Providers**: Observable citations and brand mentions across OpenAI, Gemini, Claude, and Grok.

### LangGraph Intelligence Workflow
```text
START
  ↓
collect_data              (Gathers crawl issues, GSC performance, and GEO visibility)
  ↓
analyze_seo               (Diagnoses low-CTR opportunities, missing metadata, and schema gaps)
  ↓
analyze_geo               (Identifies queries missing citations where competitors are cited)
  ↓
research_competitors      (Tavily queries competitor domains and content structures)
  ↓
recall_memory             (Queries Hindsight for historical experiments and policy constraints)
  ↓
reason                    (Synthesizes facts, evidence, hypotheses, and past lessons)
  ↓
generate_recommendation   (Constructs structured, actionable proposals with experiments)
  ↓
validate_recommendation   (Filters unevidenced proposals, guarantee claims, and duplicates)
  ↓
save_recommendation       (Persists in Supabase and records reflection in Hindsight)
  ↓
END
```

### Human-in-the-Loop Approval Workflow
The agent NEVER modifies the user's website automatically:
```text
Recommendation Generated (Pending)
       ↓
Human Reviews Evidence, Reason, Hypothesis, and Suggested Experiment
       ↓
[Approve] → Retains positive strategy memory in Hindsight → Queued for measurement
       OR
[Reject]  → Retains preference/constraint in Hindsight → Avoids repeating similar proposals
```

### Phase 4 API Endpoints
* `POST /api/v1/projects/{project_id}/agent/run` — Executes 9-node LangGraph intelligence pipeline.
* `GET /api/v1/projects/{project_id}/recommendations` — Lists project recommendations with status/priority/type filters.
* `GET /api/v1/recommendations/{recommendation_id}` — Retrieves full recommendation dossier.
* `POST /api/v1/recommendations/{recommendation_id}/approve` — Approves recommendation and triggers Hindsight memory feedback.
* `POST /api/v1/recommendations/{recommendation_id}/reject` — Rejects recommendation with reason and triggers Hindsight constraint feedback.
* `GET /api/v1/projects/{project_id}/memory` — Returns persistent memories and learned experiences for a project.

---

## Phase 5: Closed-Loop SEO & GEO Experiment Tracking

Phase 5 completes the feedback loop by transforming approved recommendations into measurable before-vs-after experiments, classifying outcomes based on evidence, and storing verified learnings into Hindsight memory.

### Closed-Loop Architecture
```text
Observe
   ↓
Analyze
   ↓
Remember
   ↓
Recommend
   ↓
Human Approval
   ↓
Experiment Created
   ↓
Baseline Captured
   ↓
Implementation Pending (User updates website)
   ↓
Measurement Window (7, 14, 28 days)
   ↓
Measure (GSC + GEO Visibility)
   ↓
Before vs After Comparison (Deltas & Position Inversion)
   ↓
Determine Outcome (positive / neutral / negative / inconclusive / insufficient_data)
   ↓
Store Learning in Hindsight (Feeds back into future LangGraph runs)
```

### Experiment Lifecycle Statuses
1. `draft` — Initial proposal before approval.
2. `approved` — Approved by human reviewer.
3. `baseline_captured` — Pre-implementation Search Console and GEO AI search metrics captured automatically.
4. `implementation_pending` — Awaiting human deployment on the website.
5. `running` / `measuring` — Active measurement window comparing live data against the captured baseline.
6. `completed` — Final deltas evaluated against success criteria, outcome classified, and structured takeaway retained in Hindsight.
7. `cancelled` — Experiment aborted.

### Accurate Metric Math & Causality Guardrails
* **CTR Delta**: Expressed both in absolute percentage-point delta (`+0.4pp`) and relative percentage delta (`+7.8%`).
* **Position Delta**: Inverted numerical math where a lower numerical position represents an improved search ranking (e.g. `8.4 -> 6.9` is `+1.5 positions` improvement).
* **GEO Citations**: Measures observable citation presence per provider (OpenAI, Gemini, Claude, Grok). Never generates fake AI scores or fabricated rankings.
* **Causality Warnings**: Clearly separates observed changes from causal claims. Flags confounding factors (search seasonality, Google core algorithm updates, competitor updates, and multiple concurrent site changes).

### Phase 5 API Endpoints
* `POST /api/v1/projects/{project_id}/experiments` — Creates experiment and automatically captures initial baseline.
* `GET /api/v1/projects/{project_id}/experiments` — Lists experiments with status and outcome filters.
* `GET /api/v1/experiments/{experiment_id}` — Retrieves experiment details.
* `POST /api/v1/experiments/{experiment_id}/baseline` — Refreshes pre-change baseline data.
* `POST /api/v1/experiments/{experiment_id}/confirm-implementation` — Confirms human deployment and starts measurement window.
* `POST /api/v1/experiments/{experiment_id}/measure` — Collects post-implementation metrics and calculates deltas.
* `POST /api/v1/experiments/{experiment_id}/complete` — Classifies final outcome and stores structured learning into Hindsight memory.
* `GET /api/v1/experiments/{experiment_id}/results` — Returns full before/after analysis dossier with causality limitations.

---

## Phase 6: Automation, Reporting & Production Intelligence

Phase 6 turns GEOlytics into a production-ready SEO + GEO intelligence platform with recurring automation, telemetry monitoring, periodic reporting, and contextual notifications.

### Core Automation Loop
```text
Scheduled Data Collection (GSC + GEO Checks + Crawler)
        ↓
SEO / GEO Analysis
        ↓
Competitor Monitoring (Tavily)
        ↓
LangGraph Reasoning
        ↓
Recommendations (Pending Review)
        ↓
Human Approval
        ↓
Closed-Loop Experiments
        ↓
Measurement & Deltas
        ↓
Hindsight Learning Retention
        ↓
Automated Weekly Report
        ↓
Notification Dispatched
```

### Automation Architecture
The automation system is decoupled into three modular layers:
1. **`AutomationScheduler`** (`backend/app/services/automation/scheduler.py`):
   - Independent of the execution trigger (supports cron, internal background worker, Supabase pg_cron, or n8n).
   - Scans due jobs where `enabled = true` and `next_run_at <= now()`.
   - Computes next run timestamps based on configured frequency (`hourly`, `daily`, `weekly`, `monthly`).
2. **`AutomationService`** (`backend/app/services/automation/service.py`):
   - Orchestrates job execution with failure isolation.
   - Enforces project ownership, logs execution runs into `automation_runs`, and filters notifications against user preferences.
   - Computes honest, transparent `ProjectHealthReport` without generating arbitrary 0–100 fake AI scores.
3. **`AutomationJobs`** (`backend/app/services/automation/jobs.py`):
   - Implements the 7 core jobs independently from how they are scheduled or triggered.

### 7 Autonomous Jobs
1. **`seo_sync`**: Refreshes Google Search Console search performance data, handles GSC reporting latency (48–72h), and deduplicates records.
2. **`geo_checks`**: Probes connected AI search providers (OpenAI, Gemini, Grok, Claude) with tracked queries and logs observable citations and brand mentions.
3. **`seo_audit`**: Crawls website pages, inspects robots.txt, schema markup, and calculates technical SEO health. Skips redundant crawls if a fresh audit was completed within 24h.
4. **`competitor_research`**: Uses Tavily web groundings to detect competitor content changes, comparison matrices, and FAQ structures.
5. **`agent_analysis`**: Triggers the LangGraph 9-node reasoning pipeline over the latest data to synthesize high-confidence proposals.
6. **`experiment_measurement`**: Tracks active experiments, collects post-change Search Console & GEO metrics, evaluates success criteria, and retains lessons in Hindsight upon completion.
7. **`report_generation`**: Compiles periodic summary reports with structured JSONB sections, executive summary, and data freshness disclosures.

### Idempotency & Failure Isolation
* **Partial Success**: If one AI provider (e.g. Grok or Claude) times out or is unconfigured, other providers (Gemini, OpenAI) still execute, and the run logs `partial_success` without failing the entire pipeline.
* **Crawler Guardrail**: Website audit crawls are skipped automatically if an audit was completed within the last 24 hours unless `force=true`.
* **Credential Protection**: The system status and health endpoints never leak API keys, OAuth tokens, or database secrets.

### Data Freshness & Methodological Limitations
* **Search Console Latency**: Google Search Console data carries a documented 48–72 hour data delay from Google. The UI and reports clearly label this latency.
* **AI Search Point-in-Time Observations**: Citations observed across AI search systems reflect observable point-in-time responses and are not guaranteed permanent search rankings.
* **Transparent Project Health**: Health is broken down into independent telemetry indicators (`SEO`, `GEO`, `GSC`, `Experiments`, `Automation`) rather than a fabricated composite score.

### Phase 6 API Endpoints
* `GET /api/v1/projects/{project_id}/automation/settings` — Lists automation job configurations for a project.
* `PATCH /api/v1/projects/{project_id}/automation/settings/{job_type}` — Updates job frequency or toggles enable/disable.
* `GET /api/v1/projects/{project_id}/automation/runs` — Returns recent automation run execution logs.
* `POST /api/v1/projects/{project_id}/automation/run/{job_type}` — Manually triggers any job with identical pipeline logic.
* `GET /api/v1/projects/{project_id}/automation/health` — Returns transparent project subsystem health and data freshness.
* `POST /api/v1/automation/check-due` — System scheduler trigger to scan and execute due jobs.
* `GET /api/v1/projects/{project_id}/reports` — Lists periodic intelligence reports.
* `POST /api/v1/reports/generate` — Compiles a new intelligence report on demand.
* `GET /api/v1/reports/{report_id}` — Retrieves full report dossier.
* `GET /api/v1/projects/{project_id}/notifications` — Lists project/user notifications.
* `POST /api/v1/notifications/{notification_id}/read` — Marks notification as read.
* `POST /api/v1/projects/{project_id}/notifications/read-all` — Marks all notifications as read.
* `GET /api/v1/projects/{project_id}/notifications/preferences` — Gets notification preference toggles.
* `PATCH /api/v1/projects/{project_id}/notifications/preferences` — Updates notification preferences.
* `GET /api/v1/health?detailed=true` — Subsystem readiness diagnostics (API, DB, GSC, OpenAI, Gemini, Grok, Claude, Tavily, Hindsight) without exposing credentials.

---

## Design System

- **Theme**: Light only. No dark mode.
- **Primary accent**: `#2563EB`
- **Typography**: Inter (Google Fonts)
- **Style**: Minimalistic, professional B2B SaaS
- **Tokens**: Centralized in `src/index.css` using Tailwind v4 `@theme`

---

## License

Private — not open source.

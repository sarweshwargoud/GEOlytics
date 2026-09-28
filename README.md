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
| `GEMINI_API_KEY` | Google Gemini API key | 2+ |
| `TAVILY_API_KEY` | Tavily search API key | 2+ |
| `GSC_CLIENT_ID` | Google Search Console OAuth client ID | 2+ |
| `GSC_CLIENT_SECRET` | Google Search Console OAuth client secret | 2+ |
| `HINDSIGHT_API_KEY` | Hindsight memory API key | 4+ |

---

## Folder Structure

```
seo-ai/
├── src/                          # Frontend (React/Vite/TypeScript)
│   ├── components/
│   │   ├── layout/               # AppLayout, ProtectedRoute
│   │   └── ui/                   # Button, Card, Input, Badge, StateDisplay
│   ├── contexts/                 # AuthContext
│   ├── hooks/                    # useApi
│   ├── lib/                      # supabase client, api client
│   ├── pages/                    # LoginPage, DashboardPage
│   ├── types/                    # TypeScript interfaces
│   ├── App.tsx                   # Router
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Design system (Tailwind v4 theme)
│
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI application
│   │   ├── api/routes/           # health, projects
│   │   ├── core/                 # config, database, auth, errors
│   │   ├── schemas/              # Pydantic request/response models
│   │   ├── models/               # (planned: ORM models)
│   │   ├── services/             # (planned: business logic)
│   │   ├── agents/               # (planned: LangGraph agents)
│   │   ├── integrations/         # (planned: external API clients)
│   │   └── utils/                # (planned: helpers)
│   ├── tests/                    # pytest tests
│   └── requirements.txt
│
├── docs/
│   └── architecture.md
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

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

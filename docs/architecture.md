# Architecture — SEO + GEO Intelligence Platform

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  Vite · TypeScript · Tailwind CSS                       │
│  Auth Context · Protected Routes · API Client           │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (REST)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  FastAPI Backend                         │
│  /api/v1/health · /api/v1/projects                      │
│  Auth middleware · Error handling · Logging              │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │       LangGraph Orchestrator (Planned)           │   │
│  │  SEO Agent · GEO Agent · Recommendation Agent    │   │
│  └───────────┬────────────────────┬─────────────────┘   │
│              │                    │                      │
│  ┌───────────▼───────┐ ┌─────────▼──────────────┐      │
│  │  SEO Services     │ │  GEO Services          │      │
│  │  (Planned)        │ │  (Planned)             │      │
│  │                   │ │                        │      │
│  │  • Crawler        │ │  • AI crawler access   │      │
│  │  • Technical SEO  │ │  • Schema/structured   │      │
│  │  • Content audit  │ │  • llms.txt check      │      │
│  │  • GSC sync       │ │  • Citation tracking   │      │
│  │  • Keyword track  │ │  • Platform readiness  │      │
│  └───────────┬───────┘ └─────────┬──────────────┘      │
│              │                    │                      │
│  ┌───────────▼────────────────────▼─────────────┐      │
│  │          External APIs (Planned)              │      │
│  │  • Gemini (recommendations)                   │      │
│  │  • Tavily (competitor research)               │      │
│  │  • Google Search Console (rankings)           │      │
│  └──────────────────────────────────────────────┘      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   Supabase                               │
│  PostgreSQL · Auth · Row Level Security                  │
│                                                          │
│  Tables:                                                 │
│    profiles (auto-created on signup)                     │
│    projects (user's websites)                            │
│    (future: audits, findings, scores, competitors, ...)  │
└──────────────────────┬──────────────────────────────────┘
                       │ (Planned)
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Hindsight (Planned)                         │
│  Persistent agent memory                                 │
│  Historical analysis · Trend tracking                    │
│  "What worked?" · "What changed?"                        │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1 — Foundation (Implemented)

### Frontend
- React + Vite + TypeScript + Tailwind CSS v4
- Light-theme design system with centralized tokens
- Supabase Auth integration (sign up / login / logout / session persistence)
- Protected route architecture
- Application shell with sidebar navigation
- Dashboard with project CRUD and empty state
- Reusable UI primitives (Button, Card, Input, Badge, StateDisplay)

### Backend
- FastAPI with `/api/v1` versioned routing
- `GET /api/v1/health` — health check
- `GET/POST/PATCH/DELETE /api/v1/projects` — project CRUD
- JWT authentication via Supabase SDK
- Centralized error handling (no stack trace leakage)
- Structured logging

### Database
- **profiles** — auto-created from auth.users via trigger
- **projects** — user's SEO/GEO analysis targets
- Row Level Security: SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid()`
- Indexes on `user_id` and `created_at`
- Auto-updated `updated_at` timestamps

---

## Phase 2 — Website Crawler + SEO Intelligence (Implemented)

### Crawler Service (`backend/app/services/crawler/`)
- **Safety & SSRF Protection**: Blocks private IP addresses (RFC1918), loopback (`127.0.0.1`, `::1`), `localhost`, `0.0.0.0`, link-local, `.local`, and non-HTTP protocols.
- **Scoping & Normalization**: Strict same-domain BFS crawler, configurable max pages (default 25) and max depth (default 3), tracking query param stripping (`utm_*`, `gclid`), canonical normalization, politeness delay.
- **Robots.txt Analysis**: Directives parser, sitemap extraction, AI crawler auditing (`GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, etc.).
- **Sitemap Discovery**: Automatic inspection of `/sitemap.xml` and robots.txt sitemaps, support for URL sets and nested sitemap indexes.
- **Page Extraction**: Title & length, meta description & length, canonical tags, meta robots, H1/H2/H3 headings, main body clean text & word count (Trafilatura/BS4), internal/external links, image count & missing alt attributes, JSON-LD Schema.org extraction & syntax validation, HTTPS & mixed content checks.

### SEO Audit & Diagnostic Scoring (`backend/app/services/analyzer/`)
- **Rules Evaluator**: Unreachable pages, 4xx/5xx status codes, slow response times (>2000ms), missing/duplicate/short/long titles, missing/duplicate meta descriptions, missing/multiple H1 tags, heading hierarchy skips, missing canonicals, missing alt text, thin content (<150 words), malformed JSON-LD, HTTP vs HTTPS, mixed content, broken internal links.
- **GEO Technical Signals**: AI bot accessibility in robots.txt, `/llms.txt` existence check, Schema entity extraction (Article, Organization, WebSite, Product, FAQ, etc.).
- **SEO Health Index (0-100)**: Fully explainable diagnostic health index computed across 6 weighted categories:
  - Technical (25%)
  - On-Page (25%)
  - Indexability (20%)
  - Content (10%)
  - Links (10%)
  - Structured Data (10%)
  *Explicitly documented as an informational diagnostic metric — NOT an official Google ranking score or probability.*

### Database Tables (Supabase)
- **`crawl_runs`**: Stores crawl lifecycle (queued, crawling, analyzing, completed, failed), pages crawled/failed counts, health score, category scores (JSONB), and site signals (JSONB).
- **`crawl_pages`**: Per-page extracted signals, metadata, headings, word counts, links, images, schema data, and response times.
- **`seo_issues`**: Audit issues with category, severity (critical, high, medium, low), affected URL, concrete evidence, and remediation recommendation.
- **Row Level Security**: All records restricted by `project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())`.

### API Endpoints
- `POST /api/v1/projects/{project_id}/crawl`: Trigger asynchronous crawl & audit.
- `GET /api/v1/projects/{project_id}/crawl-runs`: List project crawl runs.
- `GET /api/v1/projects/{project_id}/crawl-runs/{run_id}`: Detail of a specific run.
- `GET /api/v1/projects/{project_id}/audit`: Latest audit overview & scores.
- `GET /api/v1/projects/{project_id}/audit/issues`: Filterable detected issues.
- `GET /api/v1/projects/{project_id}/audit/pages`: List crawled pages.
- `GET /api/v1/projects/{project_id}/audit/pages/{page_id}`: Single page deep-dive.

### Frontend UI
- `AuditPage.tsx`: Interactive audit console with live crawl trigger & polling, SEO Health Index card, category breakdown bars, GEO signals & AI crawler directive cards, filterable issues list, searchable crawled pages explorer, and full page detail inspector modal.

---

## Planned — Next Phases

| Component | Phase | Description |
|---|---|---|
| Google Search Console sync | 3 | Keyword rankings, clicks, impressions, CTR, average position |
| Competitor analysis | 3 | Compare against competitor websites |
| LangGraph orchestrator | 3 | Multi-agent workflow coordination |
| Gemini recommendations | 3 | AI-powered action recommendations |
| Tavily research | 3 | Web research for competitor analysis |
| Full GEO / AI Search intelligence | 4 | Real AI citation measurement, entity clarity, brand presence across LLMs |
| Hindsight memory | 4 | Persistent agent memory, trend tracking ("What worked?") |
| Automated scheduling | 4 | Recurring audits and monitoring |
| PDF reports | 4 | Exportable analysis reports |

---

## Security Principles

### Authentication
- Supabase Auth handles user management
- JWT tokens validated on every API request
- Row Level Security enforced at the database level (not just frontend)

### Data Isolation
- Users can only access their own projects
- All queries filter by `auth.uid()` via RLS policies

### Untrusted Content Isolation (Planned)
When agents crawl external web pages, all content must be treated as **untrusted data**:
- Webpage content is never interpreted as agent instructions
- Crawled content is stored in a sandboxed data field
- Agent tool results are validated before use
- Prompt injection via webpage content is prevented at the architecture level

### Secret Management
- Service role keys, API keys, and OAuth secrets are **backend-only**
- Frontend only has access to the Supabase anon key (which respects RLS)
- `.env` files are excluded from version control

---

## Scoring Architecture (Types Only — Phase 1)

### SEO Health Index (0-100)
A diagnostic heuristic. **NOT** an official Google metric or ranking probability.

| Category | Weight |
|---|---|
| Crawlability | 0-30 |
| Technical | 0-25 |
| On-Page | 0-20 |
| Content | 0-15 |
| Authority | 0-10 |

### GEO Readiness Score (0-100)
A diagnostic heuristic. **NOT** an official AI-platform citation probability.

| Category | Weight |
|---|---|
| Platform Readiness | 0-25 |
| Content Citability | 0-25 |
| Technical Foundation | 0-20 |
| Schema/Structured | 0-15 |
| Entity Presence | 0-15 |

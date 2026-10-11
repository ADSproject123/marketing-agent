# Project Structure & Modularity Audit

**Scope:** Codebase Organization, Package Boundaries, Module Coupling, and Architectural Refactoring  
**Target:** Root, Backend (`api/`), Frontend (`web/`), and Storage Layer (`data/`)  
**Document Status:** Complete Architecture & Modularity Review  
**Location:** `docs/PROJECT_STRUCTURE_AND_MODULARITY_REPORT.md`  

---

## 1. Executive Summary

The **Marketing Agent** codebase has a strong functional core with impressive capabilities (multimodal AI video generation, Telegram bot approval gates, Facebook posting, and Khmer language font shaping).

However, as the project has grown, the codebase has accumulated **structural debt**:
1. **Monolithic Central Hubs:** A 920-line FastAPI file (`webapp.py`), a 448-line React context (`DashboardContext.jsx`), a 433-line wizard component (`ComposeForm.jsx`), and a 1,151-line global CSS file (`styles.css`).
2. **Fragmented Storage Architecture:** The database layer is split across **three independent SQLite files** (`jobs.db`, `users.db`, `integrations.db`), preventing foreign keys, unified transactions, and atomic backups.
3. **Inconsistent Module Boundaries:** Some domain logic lives in subpackages (`app/auth/`, `app/jobs/`, `app/llm/`), while closely related modules sit loose in the root (`app/storyboards.py`, `app/video_finishing.py`, `app/campaign_ingest.py`, `app/uploads.py`).
4. **Brittle Import Paths:** `sys.path.insert(0, ...)` hacks are used across entry points because `api/` is not configured as a standard Python package.

This report outlines the structural audit and presents a **Clean Target Architecture** to make the codebase maintainable, scalable, and modular.

---

## 2. Detailed Audit by Layer

### 2.1 Backend Structure (`api/app/`)

#### 🔴 Issue 1: Monolithic `webapp.py` (920 LOC, No APIRouter)
- **Current State:** Every route in the application (`/api/health`, `/api/auth/*`, `/api/promotions/*`, `/api/integrations/*`, `/api/jobs/*`, `/api/campaign/*`) is declared in a single file on the global `app = FastAPI(...)` object.
- **Why It Hurts:**
  - Violates the Single Responsibility Principle.
  - Merge conflicts occur constantly as multiple developers work on different features.
  - Testing or mocking individual routes is difficult because route handlers, validation logic, background task spawning, and static file serving are intertwined.
- **Solution:** Decompose into modular FastAPI `APIRouter` files grouped by business domain.

#### 🔴 Issue 2: The "Tri-Database" SQLite Anti-Pattern
- **Current State:** The application maintains three separate SQLite files in `data/`:
  - `data/jobs.db` (`JobStore` + `PromotionStore`)
  - `data/users.db` (`UserStore`)
  - `data/integrations.db` (`IntegrationStore`)
- **Why It Hurts:**
  - **No Foreign Key Integrity:** `jobs.owner_account_id` cannot reference `users.id` via foreign key constraints. If a user is deleted, orphaned jobs or integrations linger.
  - **No Cross-Domain Transactions:** You cannot atomically commit a user registration, default profile creation, and starter job in a single ACID transaction.
  - **Backup & Migration Complexity:** Creating database backups or managing schema migrations requires orchestrating three disconnected SQLite connections.
- **Solution:** Consolidate into a single unified SQLite database (`data/marketing_agent.db`) with separate tables and proper relational foreign keys.

#### 🟡 Issue 3: Loose Root Modules in `app/`
- **Current State:** 
  - `app/storyboards.py` (schema + prompt logic + validation)
  - `app/video_finishing.py` (FFmpeg engine, font shaping, subtitles)
  - `app/campaign_ingest.py` (web scraper + Gemini extraction)
  - `app/uploads.py` (brand assets + PDF compilation)
- **Why It Hurts:** Mixes domain models, infrastructure tools, and media processing directly into the root namespace alongside `main.py` and `webapp.py`.
- **Solution:** Reorganize into structured domain subpackages:
  - `app/storyboards/` (schemas, validation, prompts)
  - `app/media/` (`video_finishing.py`, `uploads.py`, `fonts.py`)
  - `app/services/` (`campaign_ingest.py`)

#### 🟡 Issue 4: Python Packaging & Brittle `sys.path` Hacks
- **Current State:** `main.py` and `webapp.py` use:
  ```python
  API_DIR = Path(__file__).resolve().parent.parent
  if str(API_DIR) not in sys.path:
      sys.path.insert(0, str(API_DIR))
  ```
- **Why It Hurts:** Brittle runtime path modifications break IDE auto-imports, linter resolutions, and standard packaging tools (e.g. `pytest`, `docker`).
- **Solution:** Add a standard `pyproject.toml` in `api/` and install in editable mode (`pip install -e api`).

---

### 2.2 Frontend Structure (`web/src/`)

#### 🔴 Issue 1: Monolithic `ComposeForm.jsx` (433 LOC)
- **Current State:** All 5 creation steps (Business, Audience, Offer & Action, Video Style, Review) are crammed into a single giant component file with hundreds of conditional branches.
- **Solution:** Extract each step into its own subcomponent:
  - `web/src/components/compose/StepBusiness.jsx`
  - `web/src/components/compose/StepAudience.jsx`
  - `web/src/components/compose/StepOffer.jsx`
  - `web/src/components/compose/StepStyle.jsx`
  - `web/src/components/compose/StepReview.jsx`

#### 🔴 Issue 2: Monolithic `styles.css` (1,151 LOC)
- **Current State:** One global stylesheet containing marketing styles, dashboard styles, SVG flow animations, form elements, and media queries.
- **Why It Hurts:** Unscoped global classes risk collision, styling unintended components, and increasing maintenance difficulty.
- **Solution:** Split into modular stylesheets or CSS Modules:
  - `styles/base.css` (variables, typography, resets)
  - `styles/marketing.css` (landing page, hero, footer)
  - `styles/dashboard.css` (app shell, sidebar, stat cards)
  - `styles/storyboard.css` (timeline, scene cards, audio waveforms)

#### 🟡 Issue 3: Flat `api.js` (225 LOC)
- **Current State:** All API interactions (Auth, Jobs, Promotions, Storyboard revisions, Facebook OAuth, Media streaming) are mixed into one file.
- **Solution:** Organize into domain-focused API clients:
  - `web/src/api/client.js` (base fetcher, token management, error parser)
  - `web/src/api/auth.js`
  - `web/src/api/jobs.js`
  - `web/src/api/promotions.js`
  - `web/src/api/integrations.js`

---

### 2.3 Storage & Deployment Structure

#### 🔴 Ephemeral Disk Risk on Free Cloud Providers (`render.yaml`)
- **Current State:** `render.yaml` deploys the API to Render on a `free` plan.
- **The Catch:** Render free instances use **ephemeral disks**. When the service sleeps or restarts after a deployment, all files in `data/` (`jobs.db`, `users.db`, `data/videos/*.mp4`) are wiped clean!
- **Solution:**
  - For production: Attach a persistent disk mount (`/var/data` on Render paid tier) or store generated MP4 videos and uploads in cloud object storage (Cloudflare R2, Google Cloud Storage, or AWS S3).
  - Use a managed SQLite/PostgreSQL connection string.

---

## 3. Target Modular Architecture (The Clean Blueprint)

### 3.1 Recommended Backend Structure (`api/`)

```
api/
├── pyproject.toml              # Modern Python packaging configuration
├── requirements.txt            # Production dependencies
├── run.py                      # Clean runner entry point
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application factory & lifespan
│   ├── config.py               # Pydantic BaseSettings (env vars & paths)
│   ├── runtime.py              # Lifespan dependency container & background tasks
│   │
│   ├── database/               # Unified Database Layer
│   │   ├── __init__.py
│   │   ├── connection.py       # Single SQLite/Postgres connection pool
│   │   ├── migrations/         # Schema evolution (or lightweight migration runner)
│   │   └── models.py           # Core SQL table schemas
│   │
│   ├── routers/                # FastAPI Modular APIRouters
│   │   ├── __init__.py
│   │   ├── health.py           # GET /api/health
│   │   ├── auth.py             # POST /api/auth/*
│   │   ├── promotions.py       # GET/POST /api/promotions
│   │   ├── campaign.py         # POST /api/campaign/ingest, draft
│   │   ├── jobs.py             # CRUD /api/jobs, approve, deny, events
│   │   └── integrations.py     # Facebook OAuth & settings
│   │
│   ├── services/               # Reusable Business & Domain Logic
│   │   ├── campaign_ingest.py  # Webpage scraping & metadata extraction
│   │   ├── storyboards.py      # Script generation, revisions, validation
│   │   ├── pipeline.py         # Generation orchestrator (Gemini -> Video -> Publish)
│   │   └── auth_service.py     # Token creation, hash verification
│   │
│   ├── media/                  # Media & Video Processing
│   │   ├── __init__.py
│   │   ├── video_finishing.py  # FFmpeg assembly, subtitles, sidechain ducking
│   │   ├── uploads.py          # Asset file uploads & PDF pack compilation
│   │   ├── endcard.py          # Dynamic KHQR & Telegram QR generator
│   │   └── fonts.py            # Khmer / system font detection & fallbacks
│   │
│   ├── llm/                    # AI & Model Integrations
│   │   ├── __init__.py
│   │   ├── gemini.py           # Gemini 2.0 Flash client & prompt rotation
│   │   ├── tts.py              # Neural Khmer / EdgeTTS voice synthesis
│   │   └── prompts/            # Clean, versioned Markdown prompt templates
│   │       ├── storyboards_en.md
│   │       └── storyboards_km.md
│   │
│   ├── telegram_bot/           # Telegram Gateway
│   │   ├── handlers.py
│   │   ├── hub.py
│   │   └── messages.py
│   │
│   └── integrations/           # Third-Party Social APIs
│       ├── facebook.py         # Graph API video poster
│       ├── crypto.py           # Fernet encryption at rest
│       └── store.py            # Account integration repository
│
└── tests/                      # Pytest unit & integration suite
```

---

### 3.2 Recommended Frontend Structure (`web/`)

```
web/
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   │
│   ├── api/                    # Modular API Service Layer
│   │   ├── client.js           # Fetch wrapper, token injection, error handler
│   │   ├── auth.js
│   │   ├── jobs.js
│   │   ├── promotions.js
│   │   └── integrations.js
│   │
│   ├── context/                # Focused React Contexts
│   │   ├── AuthContext.jsx     # User authentication & session
│   │   ├── JobsContext.jsx     # Active jobs, polling / SSE real-time state
│   │   └── ComposerContext.jsx # Multi-step campaign wizard draft
│   │
│   ├── components/             # Reusable UI Components
│   │   ├── common/             # Atomic components
│   │   │   ├── Icon.jsx
│   │   │   ├── Button.jsx
│   │   │   └── Modal.jsx
│   │   ├── compose/            # Wizard Step Components
│   │   │   ├── StepBusiness.jsx
│   │   │   ├── StepAudience.jsx
│   │   │   ├── StepOffer.jsx
│   │   │   ├── StepStyle.jsx
│   │   │   └── StepReview.jsx
│   │   ├── storyboard/         # Storyboard Studio
│   │   │   ├── StoryboardEditor.jsx
│   │   │   ├── SceneCard.jsx
│   │   │   └── HookSelector.jsx
│   │   ├── pipeline/           # Flow & Visualization
│   │   │   └── FlowDiagram.jsx
│   │   └── layout/             # Chrome & Shell
│   │       ├── DashboardSidebar.jsx
│   │       ├── MarketingHeader.jsx
│   │       └── SiteFooter.jsx
│   │
│   ├── styles/                 # Modular CSS Architecture
│   │   ├── tokens.css          # Design tokens (colors, spacing, shadows)
│   │   ├── base.css            # Typography & resets
│   │   ├── dashboard.css       # Layout grids & dashboard panels
│   │   ├── storyboard.css      # Storyboard timeline & scene inputs
│   │   └── marketing.css       # Landing page & auth forms
│   │
│   └── pages/                  # Route Views
│       ├── Landing.jsx
│       ├── Login.jsx
│       └── dashboard/
│           ├── OverviewPage.jsx
│           ├── ComposePage.jsx
│           ├── PipelinePage.jsx
│           └── JobsPage.jsx
```

---

## 4. Comparison: Before vs. After Refactoring

| Metric / Dimension | Current State | Target Modular State |
|---|---|---|
| **API Entry Point** | 920-line `webapp.py` with 26 inline endpoints | 80-line `main.py` mounting focused `APIRouter` modules |
| **Database Architecture** | 3 separate SQLite files (`jobs.db`, `users.db`, `integrations.db`) | 1 unified database (`marketing_agent.db`) with Foreign Keys |
| **Creation Form** | 433-line monolithic `ComposeForm.jsx` | 5 clean, single-responsibility step components |
| **State Management** | 448-line monolithic `DashboardContext.jsx` | Decoupled contexts (`Auth`, `Jobs`, `Composer`) |
| **CSS Architecture** | 1,151-line global `styles.css` | 5 scoped stylesheets with clear design tokens |
| **LLM Prompts** | Hardcoded Python string constants in code files | Externalized, versioned Markdown prompt templates in `app/llm/prompts/` |
| **Packaging & Imports** | `sys.path.insert(0, ...)` hacks | Standard `pyproject.toml` with editable install |

---

## 5. Step-by-Step Refactoring Plan (Low Risk)

You can refactor the codebase incrementally without breaking existing functionality:

### Step 1: Break `webapp.py` into FastAPI Routers (Zero breaking changes)
1. Create `api/app/routers/` directory.
2. Move `/api/auth/*` into `routers/auth.py`.
3. Move `/api/jobs/*` into `routers/jobs.py`.
4. Move `/api/promotions/*` into `routers/promotions.py`.
5. In `webapp.py`, simply mount routers: `app.include_router(jobs_router)`.

### Step 2: Unify SQLite Databases
1. Point `USERS_DB_PATH`, `INTEGRATIONS_DB_PATH`, and `DB_PATH` in `config.py` to the same `DATA_DIR / "marketing_agent.db"`.
2. Add a simple migration script to copy existing rows from the old files into the unified database.
3. Enable SQLite Foreign Key enforcement: `PRAGMA foreign_keys = ON;`.

### Step 3: Decompose `ComposeForm.jsx` on Frontend
1. Extract Steps 0 to 4 into `components/compose/Step*.jsx`.
2. Keep the props interface identical so `ComposePage.jsx` functions without change.

### Step 4: Modularize Styles
1. Split `styles.css` into `tokens.css`, `base.css`, `dashboard.css`, and `marketing.css`.
2. Import them via `@import` in `index.html` or `main.jsx`.

---

*Report prepared for the Marketing Agent project. Refer to this blueprint to guide code refactoring and long-term architectural scaling.*

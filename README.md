# Marketing Agent

Marketing agent where the **system starts the job** and **Telegram only approves or denies**:

1. Register / log in on the web app, then hit **Start** on the dashboard
2. Gemini invents campaign, caption, steering, and NotebookLM source text
3. NotebookLM generates a **short vertical Video Overview** (TikTok frame)
4. Telegram receives the preview — you only **Approve / Deny**
5. On approve, publishes to a **Facebook Page** (when configured)

## Architecture

```
web/  (React)
  → api/ (FastAPI + Telegram)
      → Gemini caption + steering
      → NotebookLM video (optional)
      → Telegram Approve / Deny
      → Facebook Graph Video API
```

## Project layout

```
marketing_agent/
  api/
    run.py                 # ← start the API here
    requirements.txt
    app/                   # FastAPI app, jobs, Telegram, auth
  web/                     # React landing + dashboard
  data/                    # SQLite + downloaded videos
  .env                     # secrets (project root)
  scripts/                 # helper scripts
```

## Requirements

- Python 3.10+
- Node.js 18+ (for the React frontend)
- Google account with NotebookLM access
- Telegram bot token
- Meta app + Facebook Page with publish permissions (optional)

## Setup

```bash
cd marketing_agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env
# edit .env with your tokens

cd web && npm install && cd ..
```

### 1. Telegram

1. Create a bot with [@BotFather](https://t.me/BotFather) → `TELEGRAM_BOT_TOKEN`
2. Get your user id (e.g. [@userinfobot](https://t.me/userinfobot)) → `ALLOWED_TELEGRAM_USER_ID`

### 2. NotebookLM / Gemini Notebook login (one-time)

```bash
source .venv/bin/activate
notebooklm login --browser-cookies chrome
```

### 3. Facebook Page (optional)

Set `FACEBOOK_APP_ID`, `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN` in `.env`.

### 4. Gemini LLM

Set `GEMINI_API_KEYS=key_one,key_two` (or `GEMINI_API_KEY`) in `.env`.

## Run (dev — recommended)

Two terminals:

**Terminal 1 — API**

```bash
source .venv/bin/activate
cd api
python run.py
```

API + Telegram gate: [http://127.0.0.1:8787](http://127.0.0.1:8787)

**Terminal 2 — Web**

```bash
cd web
npm run dev
```

Frontend: [http://127.0.0.1:5173](http://127.0.0.1:5173) (proxies `/api` to the backend)

Then open the site → **Create account** / **Log in** → **Dashboard**.

## Run (single process, production-style)

Build the React app, then start the API (serves `web/dist`):

```bash
source .venv/bin/activate
cd web && npm run build && cd ..
cd api && python run.py
```

Open [http://127.0.0.1:8787](http://127.0.0.1:8787).

For caption-only testing without NotebookLM video, set `SKIP_NOTEBOOKLM=1` in `.env`.

## Deploy (Vercel web + Render API)

### 1. Render — API

1. Push this repo to GitHub.
2. [Render](https://dashboard.render.com) → **New** → **Blueprint** (uses `render.yaml`), or **Web Service** with:
   - **Root directory:** `api`
   - **Build:** `pip install -r requirements.txt`
   - **Start:** `python run.py`
3. Set env vars (same as `.env`): `AUTH_SECRET`, `TELEGRAM_BOT_TOKEN`, `ALLOWED_TELEGRAM_USER_ID`, `GEMINI_API_KEYS`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, plus:
   - `PUBLIC_API_URL=https://YOUR-SERVICE.onrender.com`
   - `FRONTEND_URL=https://YOUR-APP.vercel.app`
   - `SKIP_NOTEBOOKLM=1` recommended on free Render (NotebookLM cookies need a real browser machine)
4. Copy the service URL (e.g. `https://marketing-agent-api.onrender.com`).

Free Render sleeps when idle — first request after sleep can take ~30–60s.

### 2. Vercel — Web

1. [Vercel](https://vercel.com) → **Add New Project** → import the repo.
2. **Root Directory:** `web`
3. Framework: Vite (auto). Build: `npm run build`. Output: `dist`.
4. Env var:
   - `VITE_API_URL=https://YOUR-SERVICE.onrender.com` (no trailing slash)
5. Deploy. Set that Vercel URL as `FRONTEND_URL` on Render, then **redeploy** the API so CORS picks it up.

### 3. Meta Facebook redirect

Add both (local + prod) under Facebook Login → Valid OAuth Redirect URIs:

```
http://127.0.0.1:8787/api/integrations/facebook/callback
https://YOUR-SERVICE.onrender.com/api/integrations/facebook/callback
```

## Telegram usage (approval only)

| Action | What it does |
|---|---|
| **Approve** | Allow publish (Facebook when configured) |
| **Deny** | Cancel — nothing is posted |
| `/status` | Recent jobs |
| `/login_notebook` | NotebookLM auth recovery |
| `/help` | Help text |

Jobs are **not** created from Telegram.

## Notes / risks

- NotebookLM has **no public API**; UI/RPC changes can break generation until the library updates.
- Video generation is slow; keep the API process running.
- Set a strong `AUTH_SECRET` in `.env` for production.

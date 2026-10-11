# Codebase Clean-Up Audit: Hardcoded Values, Unused Modules & Dead Code

**Scope:** Full repository review across Backend (`api/`), Frontend (`web/`), Scripts (`scripts/`), and Storage (`data/`)  
**Target:** Elimination of hardcoded secrets, dead code, unused imports, duplicate snippets, and scratch artifacts  
**Location:** `docs/CLEANUP_AND_HARDCODED_CODE_AUDIT_REPORT.md`  

---

## 1. Executive Summary

This audit identifies every instance of **hardcoded values**, **dead/unused code**, **accidental code duplicates**, and **leftover development artifacts** across the project.

### Critical Immediate Findings:
1. **Broken Frontend Build (`ComposeForm.jsx`):** An accidental copy-paste duplication on lines 139–149 of `web/src/components/ComposeForm.jsx` is currently causing `npm run build` to fail with a syntax error (`Unexpected "}"`).
2. **Circular Backend Dependencies:** All files in `api/app/routers/` import `from app import webapp as hub`, while `webapp.py` imports all routers at the bottom, creating a fragile circular import loop.
3. **Hardcoded Fallback Secrets:** `"marketing-agent-dev-secret-change-me"` is hardcoded in both `config.py` and `crypto.py`.
4. **Hardcoded Deployment URLs:** Specific Render and Vercel URLs are hardcoded inside the generic `render.yaml` deployment blueprint.
5. **~270MB of Scratch Artifacts:** `data/videos/` contains leftover test videos and frame directories that consume disk space.
6. **Dead/Unused Scripts & UI Components:** 3 scratch scripts in `scripts/` and unused components (`Card.jsx`, `Select.jsx`) in `web/src/components/ui/`.

---

## 2. Dead Code & Unused Modules

### 2.1 Accidental Duplicate Code in `web/src/components/ComposeForm.jsx`
* **File:** `web/src/components/ComposeForm.jsx` (Lines 127–150)
* **Problem:** A block of event handling code was accidentally duplicated, breaking Vite's build compiler:
```javascript
// Lines 127-138 (Original):
const handleSubmit = (event) => {
  if (showingBusinessList) {
    event.preventDefault();
    return;
  }
  onSubmit(event);
};

const handleEditStep = (nextStep) => {
  if (nextStep === 0) setBusinessView("form");
  onEditStep(nextStep);
};

// Lines 139-149 (ACCIDENTAL DUPLICATE — CAUSES BUILD ERROR):
if (showingBusinessList) {
    event.preventDefault();
    return;
  }
  onSubmit(event);
};

const handleEditStep = (nextStep) => {
  if (nextStep === 0) setBusinessView("form");
  onEditStep(nextStep);
};
```
* **Remedy:** Delete lines 139–149.

---

### 2.2 Unused UI Components in `web/src/components/ui/`
* **`web/src/components/ui/Card.jsx` (129 lines):**
  - Contains `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter`.
  - **Status:** **Completely unused.** No page or component imports `Card` (all pages use `StatCard` or direct panel classes).
* **`web/src/components/ui/Select.jsx` (23 lines):**
  - Contains a generic `<Select>` wrapper component.
  - **Status:** **Completely unused.** Components like `StoryboardEditor.jsx` use raw `<select>` elements directly.
* **Remedy:** Either adopt them in `OverviewPage` and `StoryboardEditor` or remove them to keep the bundle lean.

---

### 2.3 Dead Layout Engine in `web/src/flow.js`
* **File:** `web/src/flow.js` (Lines 84–180)
* **Problem:** `computeLayout(direction = "horizontal")` contains ~100 lines of complex geometric layout math for horizontal node layout.
* **Status:** `FlowDiagram.jsx` explicitly hardcodes `computeLayout("vertical")` on line 33:
  ```javascript
  // Always top → bottom (vertical stack)
  const layout = computeLayout("vertical");
  ```
* **Remedy:** Remove the horizontal branch in `computeLayout` or preserve it behind an explicit toggle if horizontal canvas mode is planned.

---

### 2.4 Scratch & Obsolete Scripts in `scripts/`
* **`scripts/_build_caption_py.py` (82 lines):** Scratch script used once to generate `caption.py` from base64 strings.
* **`scripts/_caption_skeleton.py` (18,014 bytes):** Skeleton template file used by `_build_caption_py.py`.
* **`scripts/_khmer_kiaros_draft.py` (8,859 bytes):** One-off test draft script for a specific brand test.
* **Status:** None of these are imported by the application, test suite, or CI/CD pipelines.
* **Remedy:** Delete these 3 scratch files from `scripts/`.

---

### 2.5 Leftover Video Artifacts in `data/videos/` (~270MB)
* **Directory:** `data/videos/`
* **Leftover Files:**
  - `_cloth_khmer_frames/` (directory)
  - `_khmer_kiaros_frames/` (directory)
  - `_khmer_kiaros_polish_frames/` (directory)
  - `_kiaros_frames/` (directory)
  - `_kiaros_frames_clean/` (directory)
  - `_feature_test_source.finished.mp4`, `_feature_test_source.mp4`, `_feature_test_source.narration.srt`
  - `feature_test_bgm_telegram_qr.mp4`
* **Remedy:** Prune scratch test files prefixed with `_` and `feature_test_` to free up ~270MB of disk space.

---

### 2.6 Unused Imports Across Backend
* **`api/app/webapp.py`:**
  - Lines 16–21: `RedirectResponse`, `UploadFile`, `ValidationError`, `asyncio`, `json`, `shutil`, `JobSource`, `JobStatus`, `ingest_campaign_url`, `draft_storyboard`, `revise_storyboard`, `save_job_assets`.
  - All route handlers were migrated to `routers/`, leaving these top-level imports unused.
* **`api/app/routers/health.py`:**
  - Unused: `Depends`, `HTTPException`, `Request`, `FileResponse`, `RedirectResponse`, `StreamingResponse`.
* **`api/app/routers/promotions.py`:**
  - Unused: `HTTPException`, `Request`, `FileResponse`, `RedirectResponse`, `StreamingResponse`.
* **`api/app/routers/auth.py`:**
  - Unused: `Request`, `FileResponse`, `RedirectResponse`, `StreamingResponse`.
* **`api/app/routers/campaign.py`:**
  - Unused: `FileResponse`, `RedirectResponse`, `StreamingResponse`.
* **`api/app/routers/integrations.py`:**
  - Unused: `Request`, `FileResponse`, `StreamingResponse`.
* **`api/app/llm/caption.py` (Line 92):**
  - `SYSTEM_PROMPT = GUIDED_SYSTEM_PROMPT` is an unreferenced alias variable.

---

## 3. Hardcoded Secrets, Credentials & Security Configurations

### 3.1 Hardcoded Insecure Secret Fallbacks
* **File:** `api/app/config.py` (Line 15) & `api/app/integrations/crypto.py` (Line 13)
* **The Code:**
  ```python
  # config.py:
  DEV_AUTH_SECRET = "marketing-agent-dev-secret-change-me"
  
  # crypto.py:
  secret = os.getenv("AUTH_SECRET", "").strip() or "marketing-agent-dev-secret-change-me"
  ```
* **Risk:** If a deployment fails to inject `AUTH_SECRET`, the encryption key falls back to a publicly known string on GitHub.
* **Remedy:** Fail fast if `AUTH_SECRET` is missing in production, and generate a random ephemeral key in development instead of hardcoding a predictable string.

---

### 3.2 Hardcoded Instance URLs in `render.yaml`
* **File:** `render.yaml` (Lines 32 & 34)
* **The Code:**
  ```yaml
  - key: PUBLIC_API_URL
    value: https://marketing-agent-api-s2rb.onrender.com
  - key: FRONTEND_URL
    value: https://marketing-agent-iota-taupe.vercel.app
  ```
* **Risk:** Hardcodes a specific user's temporary Render and Vercel domains into a shared deployment blueprint.
* **Remedy:** Change `value:` to `sync: false` so Render prompts the deploying user for their own URLs during setup.

---

### 3.3 Hardcoded CORS Origins in `webapp.py`
* **File:** `api/app/webapp.py` (Lines 46–50)
* **The Code:**
  ```python
  origins = {
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:8787",
      "http://localhost:8787",
  }
  ```
* **Remedy:** Allow dynamic configuration via `CORS_ORIGINS` environment variable and avoid hardcoded localhost assumptions in production builds.

---

## 4. Hardcoded Business Rules & Magic Values

### 4.1 Magic Floating-Point Epsilon Checks in `storyboards.py`
* **File:** `api/app/storyboards.py` (Lines 86–90)
* **The Code:**
  ```python
  if not 10 - 1e-6 <= total <= 60 + 1e-6:
      raise ValueError("The scene plan must run between 10 and 60 seconds.")
  ```
* **Remedy:** Extract to named constants:
  ```python
  MIN_STORYBOARD_DURATION = 10.0
  MAX_STORYBOARD_DURATION = 60.0
  ```

### 4.2 Hardcoded Khmer Vocabulary Checks
* **File:** `api/app/storyboards.py` (Line 234)
* **The Code:**
  ```python
  if no_offer and any(term in combined for term in ("បញ្ចុះតម្លៃ", "ឥតគិតថ្លៃ", "ទិញមួយថែមមួយ")):
      raise ValueError("The script added an offer that was not supplied...")
  ```
* **Remedy:** Move language check terms to a centralized `PROMOTIONAL_TERMS_KM` constant tuple in `api/app/config.py` or `api/app/llm/caption.py`.

### 4.3 Hardcoded Asset Keyword Matching
* **File:** `api/app/storyboards.py` (Line 136)
* **The Code:**
  ```python
  if "khqr" in label or "bakong" in label:
      return str(index)
  ```
* **Remedy:** Allow users to explicitly designate an uploaded image as the "Payment QR / End-Card Asset" in the UI rather than relying on brittle file name substrings.

### 4.4 Discrepancy in Field Length Limits
* **Mismatch:**
  - `web/src/campaign.js`: `offer: 400`, `destination: 400`
  - `api/app/storyboards.py`: `offer: 700`, `contact: 1000`
* **Remedy:** Standardize character limits between frontend constants and Pydantic schemas.

---

## 5. Circular Dependency Code Smell in `routers/`

### The Issue
Every file in `api/app/routers/` has:
```python
from app import webapp as hub
```
And `api/app/webapp.py` has:
```python
from app.routers import auth, health, integrations, jobs, promotions, campaign
```

### Why This Happened
1. Models (`RegisterRequest`, `LoginRequest`, `CreateJobRequest`) are defined in `webapp.py` instead of a dedicated `schemas/` module.
2. Dependencies (`_users()`, `_store()`, `_require_user`) are defined in `webapp.py` instead of a dedicated `dependencies.py` module.

### How to Fix
1. Create `api/app/schemas.py` and move all Pydantic request/response models there.
2. Create `api/app/dependencies.py` and move `get_current_user`, `get_job_store`, `get_user_store` there.
3. Routers import from `schemas` and `dependencies`, completely breaking the circular dependency with `webapp.py`.

---

## 6. Actionable Clean-Up Task List

| Priority | File / Location | Action Required |
|---|---|---|
| 🚨 **P0** | `web/src/components/ComposeForm.jsx:139-149` | **Delete duplicate code block** (fixes `npm run build` failure). |
| 🟡 **P1** | `api/app/webapp.py` & `api/app/routers/` | **Extract schemas & dependencies** to break circular imports and clean up 12+ unused imports. |
| 🟡 **P1** | `render.yaml:32-34` | **Remove hardcoded user URLs** (`sync: false`). |
| 🟢 **P2** | `scripts/_*.py` | **Delete 3 scratch scripts** (`_build_caption_py.py`, `_caption_skeleton.py`, `_khmer_kiaros_draft.py`). |
| 🟢 **P2** | `data/videos/` | **Prune ~270MB of leftover scratch test videos** and frame folders. |
| 🟢 **P2** | `web/src/components/ui/` | **Prune or integrate unused `Card.jsx` and `Select.jsx`**. |
| 🟢 **P3** | `web/src/flow.js:84-180` | **Prune unused horizontal layout math** (`computeLayout`). |
| 🟢 **P3** | `api/app/storyboards.py:86,234` | **Extract magic numbers and hardcoded Khmer strings** to named constants. |

---

*Report prepared for the Marketing Agent project. Refer to this checklist to safely remove dead code, fix the frontend build, and clean up technical debt.*

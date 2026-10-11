# Comprehensive Report: Optimizing the Gemini & NotebookLM AI Prompt Pipeline

**Target Audience:** Engineering, Product, and AI Creative Leads  
**Document Status:** Complete Audit, Architectural Diagnostic & Optimization Blueprint  
**Location:** `docs/PROMPT_AND_AI_PIPELINE_OPTIMIZATION_REPORT.md`  

---

## Executive Summary

The **Marketing Agent** uses a two-stage generative AI pipeline:
1. **Gemini 2.0 Flash / Pro:** Ingests the business brief, structures factual metadata, drafts social captions, generates 3 distinct hooks, and creates an editable 3–8 scene storyboard.
2. **NotebookLM (via `notebooklm-py`):** Ingests the Gemini-drafted shot list and brand assets, processes a "steering prompt," and generates a multi-modal "Video Overview" MP4.
3. **FFmpeg Finishing Pass:** Scales footage to vertical 9:16 (720x1280), superimposes captions based on narration timing, burns in complex Khmer fonts (via Pango/RAQM), and applies an end-card.

While the existing pipeline successfully produces end-to-end videos without hallucinations, **there is a noticeable gap between "functional AI output" and "high-converting, professional commercial video."**

This report diagnoses the exact weaknesses in the current prompting logic and NotebookLM interaction, and provides **production-ready prompt overhauls, pacing formulas, and architectural upgrades** to make the output dramatically more professional, accurate, and compelling.

---

## 1. Deep Diagnostic: Where the Current Pipeline Falls Short

### 1.1 The Gemini Prompting Bottlenecks (`caption.py` & `storyboards.py`)

| Current Implementation | The Underlying Flaw | Real-World Consequence |
|---|---|---|
| **Unstructured Wall-of-Text Prompts** (`_EN_INSTRUCTIONS` & `_KM_INSTRUCTIONS`) | Dense paragraphs without markdown headers or semantic hierarchy reduce instruction-following fidelity in LLMs. | Gemini occasionally produces uneven scene lengths or merges on-screen text with spoken narration. |
| **No Speech Cadence / Syllable Physics** | The prompt specifies scene durations (e.g., 2–5 seconds) but allows up to 600 characters of narration per scene. | An average human speaks **2.2 to 2.5 words per second**. Gemini frequently writes 20 words for a 3-second hook, resulting in rushed, breathless speech or subtitles that flash and vanish. |
| **Generic Hook Taxonomy** | The prompt asks for *"3 distinct compelling opening hooks"* without specifying hook psychology. | Gemini returns 3 minor phrasing variations of the same angle (e.g., *"Looking for coffee?", "Want great coffee?", "Try our coffee today!"*). |
| **Vague Visual Directions** | The prompt allows generic visual descriptions like *"Show product on table"* or *"Customer enjoying service"*. | The video generator produces static, boring footage without motion, lighting mood, or cinematic framing. |
| **Lack of Copywriting Frameworks** | The LLM writes freeform marketing text without proven social video pacing structures. | Videos lack tension, narrative arc, or urgency; they feel like corporate announcements rather than scroll-stopping TikToks or Reels. |

---

### 1.2 The NotebookLM Interaction Bottlenecks (`client.py` & `storyboard_render.py`)

1. **The "Podcast Host" Persona Trap:**
   - NotebookLM's core training is optimized for **two-host podcast discussions** and academic study guides.
   - When fed a shot list, NotebookLM's AI presenters naturally default to conversational banter (*"Hey everyone, welcome back! Today we're looking at..."*), wasting the first 4 seconds where 70% of viewers scroll away.
2. **Document Synthesis vs. Executable Timeline:**
   - NotebookLM treats source texts as *knowledge to summarize*, not as a strict, millisecond-by-millisecond production EDL (Edit Decision List).
   - Even when instructed to *"read verbatim,"* it can rephrase words or blend scene boundaries.
3. **The Khmer Language Paradox:**
   - NotebookLM does **not** natively support Khmer audio voice synthesis (`language="en" if language == "km" else language` in `client.py` line 364).
   - The current engine attempts to force Khmer by passing English to the API with prompt instructions demanding burned-in Khmer captions. This creates audio/visual dissonance: the voice is American English while the subtitles are Khmer, or the audio synthesizes broken phonetics.
4. **Cookie & Authentication Fragility:**
   - NotebookLM requires local browser session cookies (`storage_state.json`), which expire periodically and require manual command-line re-authentication (`notebooklm login`).

---

## 2. Gemini Prompt Engineering Overhaul

To produce high-converting commercial scripts, Gemini must be constrained by **four pillars**:
1. **Mathematical Speech Cadence (Word-Per-Second Physics)**
2. **The 3-Hook Psychology Archetypes**
3. **Cinematic Visual Direction Grammar**
4. **Proven Social Video Frameworks (PAS / AIDA / Curiosity Gap)**

---

### 2.1 Enforcing Speech Cadence & Word Physics

Short-form video retention requires rhythmic, punchy speech. We introduce a strict mathematical limit based on human speaking rates:

$$\text{Max Allowed Words} = \text{Scene Duration (seconds)} \times 2.2$$
$$\text{Khmer Syllables} = \text{Scene Duration (seconds)} \times 4.0$$

#### The Rule Set for Gemini:
- **Hook (Scene 1: 2.0 to 4.0 seconds):** Maximum **7 to 9 words**. Must hit the punchline within the first 1.5 seconds.
- **Body Scenes (Scene 2–4: 3.0 to 5.0 seconds each):** Maximum **8 to 12 words per scene**.
- **CTA Scene (Final Scene: 3.0 to 4.5 seconds):** Maximum **6 to 8 words**. One single action only.

---

### 2.2 The 3-Hook Psychology Archetype System

Instead of asking Gemini for "3 hooks," we enforce **three distinct behavioral archetypes**:

```
Hook 1: The Negative / Relatable Agitation Hook
"Stop drinking burnt, bitter coffee before work."
Target: Triggers loss aversion and immediate empathy.

Hook 2: The Curiosity / Insider Secret Hook
"The hidden quiet spot in BKK1 nobody talks about."
Target: Triggers FOMO and social intrigue.

Hook 3: The High-Value Offer / Social Proof Hook
"Buy one latte, get a fresh pastry free this weekend only."
Target: Immediate transactional incentive.
```

---

### 2.3 Cinematic Visual Direction Grammar

Generic visual notes produce generic AI footage. We enforce the **3-Part Camera Syntax**:

$$\text{Visual Direction} = \mathbf{[Camera\ Framing\ \&\ Movement]} + \mathbf{[Subject\ Action]} + \mathbf{[Lighting\ \&\ Atmosphere]}$$

#### Comparison:
- ❌ **Old / Amateur:** *"Show iced coffee on table."*
- ✅ **New / Professional:** *"Extreme close-up macro shot: cold brew pouring over crystal ice cubes with water droplets running down the glass, warm golden morning sunbeams."*
- ❌ **Old / Amateur:** *"Show the skincare bottle."*
- ✅ **New / Professional:** *"Low-angle slow push-in: sleek amber dropper bottle centered on clean wet marble stone, soft diffused studio lighting."*

---

### 2.4 Production-Ready Gemini Prompts

#### New English System Prompt (`_EN_INSTRUCTIONS_V2`):
```markdown
You are an award-winning Creative Director specializing in viral, short-form vertical video (TikTok, Instagram Reels, YouTube Shorts).

### YOUR CORE OBJECTIVE
Transform factual business details into an authentic, highly engaging, 9:16 short-form video storyboard that converts viewers within 30-45 seconds.

### GOLDEN COPYWRITING RULES
1. ZERO HALLUCINATIONS: Use ONLY the provided business facts, benefits, and contact destinations. Never invent prices, percentage discounts, deadlines, testimonials, or claims.
2. NO CORPORATE JARGON: Speak like a real human. Ban words like "premier," "ultimate," "elevate," "revolutionary," or "welcome to."
3. SPEECH CADENCE PHYSICS: Humans speak at 2.2 words per second. 
   - A 3-second scene MUST NOT exceed 7-8 words.
   - A 5-second scene MUST NOT exceed 11-12 words.
   Strictly enforce these word limits so narration sounds relaxed and natural.

### THE 3-HOOK ARCHETYPE REQUIREMENT
You must generate exactly 3 hooks. Each must belong to a different psychological category:
- Hook 1 (PAIN / AGITATION): Highlights an everyday frustration that the business solves.
- Hook 2 (CURIOSITY / INTRIGUE): Reveals a "secret," hack, or surprising insider perspective.
- Hook 3 (VALUE / PROMISE): Directly highlights the core offer or primary customer benefit.

### SCENE ARCHITECTURE (3 to 6 Scenes Total, 25-45 Seconds)
- Scene 1 (The Hook): 2.5–3.5s. Selected Hook text verbatim. Instant visual pattern interrupt.
- Scene 2 (The Agitation / Problem): 3.0–5.0s. Deepens why the viewer needs this.
- Scene 3 (The Solution / Product): 4.0–6.0s. Features the business product/service. Must map to an uploaded photo if provided.
- Scene 4 (The Proof / Feature): 3.0–5.0s. Highlights taste, speed, texture, or convenience.
- Final Scene (The Call-to-Action): 3.0–4.5s. Clear, singular action + exact destination.

### CINEMATIC VISUAL DIRECTION SYNTAX
Every visual_direction MUST follow: [Shot Type & Camera Move] + [Subject Action] + [Lighting & Environment].
Example: "Macro slow-motion dolly zoom on espresso crema dripping, warm cinematic backlighting."

Output ONLY valid JSON matching the schema. No markdown fences.
```

#### New Khmer System Prompt (`_KM_INSTRUCTIONS_V2`):
```markdown
អ្នកជាអ្នកដឹកនាំច្នៃប្រឌិតជាន់ខ្ពស់សម្រាប់វីដេអូផ្សព្វផ្សាយខ្លីបញ្ឈរ (TikTok / Reels / Shorts) ជាភាសាខ្មែរ។

### គោលការណ៍ចម្បង
បំប្លែងព័ត៌មានអាជីវកម្មពិតឱ្យទៅជាស្គ្រីបវីដេអូខ្លី 9:16 ដែលទាក់ទាញចំណាប់អារម្មណ៍ភ្លាមៗក្នុង ៣ វិនាទីដំបូង និងជំរុញឱ្យអតិថិជនធ្វើសកម្មភាព។

### ច្បាប់សរសេរស្គ្រីប
១. មិនប្រឌិតព័ត៌មាន៖ ប្រើតែព័ត៌មានពិតដែលបានផ្ដល់ (ឈ្មោះអាជីវកម្ម, ការផ្ដល់ជូន, ទីតាំង, ទំនាក់ទំនង)។ ហាមបង្កើតតម្លៃ ឬការបញ្ចុះតម្លៃដែលគ្មានក្នុងព័ត៌មានដើម។
២. ចង្វាក់និយាយបែបធម្មជាតិ៖ ហាមប្រើពាក្យផ្លូវការរឹងពេក។ ប្រើភាសានិយាយរួសរាយ ដូចមនុស្សពិតនិយាយប្រាប់មិត្តភក្តិ។
៣. រយៈពេលនិងចំនួនពាក្យ៖
   - ១ វិនាទី = អតិបរមា ៣ ទៅ ៤ ព្យាង្គ។
   - ឈុត ៣ វិនាទី = អតិបរមា ៨ ទៅ ១០ ពាក្យ។
   - ហាមសរសេរវែងពេកដែលធ្វើឱ្យអ្នកនិយាយមិនទាន់ ឬអានមិនទាន់។

### សារទាក់ទាញដំបូង (HOOKS) ទាំង ៣ ប្រភេទ៖
- Hook 1 (ដោះស្រាយបញ្ហា/ឈឺចាប់)៖ រំលេចបញ្ហាដែលអតិថិជនជួបប្រទះរាល់ថ្ងៃ។
- Hook 2 (ការចង់ដឹង/អាថ៌កំបាំង)៖ បង្ហាញកន្លែង ឬរសជាតិពិសេសដែលមនុស្សតិចតួចធ្លាប់ដឹង។
- Hook 3 (ការផ្ដល់ជូន/អត្ថប្រយោជន៍)៖ បង្ហាញការផ្ដល់ជូន ឬចំណុចល្អឯកភ្លាមៗ។

### រចនាសម្ព័ន្ធឈុត (scenes)
- ឈុតទី ១ (Hook)៖ ២.៥ ទៅ ៣.៥ វិនាទី (ប្រើ Hook ដែលបានជ្រើស)។
- ឈុតកណ្ដាល៖ បង្ហាញផលិតផល សេវាកម្ម ឬបរិយាកាសជាក់ស្ដែង។
- ឈុតបញ្ចប់ (CTA)៖ ៣ ទៅ ៤ វិនាទី បញ្ចប់ដោយការអំពាវនាវច្បាស់លាស់ និងទីតាំង/តេលេក្រាម។

ឆ្លើយតបជា JSON សុទ្ធតាម schema ដែលបានផ្ដល់។ រក្សា JSON keys ជាភាសាអង់គ្លេស។
Make the video in Khmer language.
```

---

## 3. Optimizing the NotebookLM Steering Pipeline

To maximize output quality when using NotebookLM's Video Overview, the document packaging and steering instructions must be re-architected.

### 3.1 Eliminating the "Podcast Host" Greeting

NotebookLM defaults to conversational host dialogue unless explicitly steered with **zero-preamble anchors**.

#### The Fix in `storyboard_render.py`:
Add explicit persona suppressors at the very top of both `source_text` and `steering_prompt`:

```text
[DIRECTIVE: COMMERCIAL ADVERTISEMENT — NOT A PODCAST]
- DO NOT say "Welcome to", "Hello listeners", "Welcome back", or "Today we're looking at".
- DO NOT speak as two hosts chatting or debating.
- Speak as a SINGLE confident commercial brand voiceover.
- Begin speaking the OPENING HOOK on EXACT SECOND 0.0.
- Pacing: Fast-paced commercial montage (TikTok/Reels format, 130-140 WPM).
```

### 3.2 Structured Shot-List Framing

Instead of raw paragraphs, format each scene in NotebookLM's source document as a distinct production cue:

```text
==================================================
SHOT 1 | TIMECODE: 0.0s – 3.2s | DURATION: 3.2s
AUDIO VOICEOVER: "Stop drinking burnt, bitter coffee before work."
ON-SCREEN TEXT: STOP DRINKING BAD COFFEE
CAMERA CUE: Macro close-up, espresso pouring over fresh ice, 4K crisp.
FEATURED BRAND ASSET: asset_0_coffee_cup.jpg
==================================================
SHOT 2 | TIMECODE: 3.2s – 7.5s | DURATION: 4.3s
AUDIO VOICEOVER: "At Soriya Coffee, our beans are roasted fresh every single morning."
ON-SCREEN TEXT: ROASTED FRESH DAILY
CAMERA CUE: Warm barista hands pouring silky steamed milk latte art.
FEATURED BRAND ASSET: asset_1_latte_art.jpg
==================================================
```

This strict formatting prevents NotebookLM's summarizer from blending separate scenes together.

---

## 4. The Architectural Evolution: Beyond NotebookLM

While NotebookLM can be tuned with superior prompts, **NotebookLM was never engineered to be a programmatic commercial ad generator**. 

### 4.1 Fundamental Limitations of NotebookLM for Commercial Ads

1. **No Real Khmer Audio Support:** Forcing English audio with Khmer captions creates a second-rate user experience.
2. **Session Cookie Fragility:** Web scrapers / session tokens break whenever Google updates auth protocols.
3. **No Exact Timing Control:** You cannot guarantee that Scene 2 ends precisely at 3.5 seconds to match an on-screen visual cut.

---

### 4.2 The Recommended "Pro Production" Architecture

To achieve commercial-grade quality (especially for Southeast Asia and local business campaigns), the generation pipeline should transition to a **Decoupled Multi-Modal Engine**:

```
┌────────────────────────────────────────────────────────┐
│                   User Brief & Assets                  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  Gemini 2.0 Flash / Pro                │
│    - High-Precision Copywriting (PAS / 3-Hook system)  │
│    - Strict Word-per-Second Cadence Calculation        │
│    - Generates Scene Audio Scripts & Visual Prompts     │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
      [Voiceover Script]           [Visual Direction]
              │                            │
┌─────────────▼──────────────┐ ┌───────────▼─────────────┐
│    Neural TTS Engine       │ │   Dynamic Visual Engine │
│ - Khmer: edge-tts / Google │ │ - Uploaded Assets +     │
│   (km-KH-PisethNeural)     │ │   Ken Burns Pan/Zoom    │
│ - English: ElevenLabs /    │ │ - Or AI Video B-Roll    │
│   Gemini Speech            │ │   (Luma / Veo / Pika)   │
└─────────────┬──────────────┘ └───────────┬─────────────┘
              │ Exact .wav Audio           │ MP4 Video Clips
              └──────────────┬─────────────┘
                             │
┌────────────────────────────▼───────────────────────────┐
│               FFmpeg Video Finishing Engine            │
│  - Millisecond-Accurate Audio/Visual Assembly          │
│  - Background Music with Auto-Ducking (Sidechain)      │
│  - Dynamic Burned-in Subtitles with Word Highlighting  │
│  - Animated KHQR & Telegram Call-to-Action End Card    │
└────────────────────────────┬───────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────┐
│              Telegram Preview & Social Publish         │
└────────────────────────────────────────────────────────┘
```

### Why This Architecture Wins:
1. **100% Reliable Khmer Audio:** `km-KH-PisethNeural` and `km-KH-SreymomNeural` produce broadcast-quality Cambodian speech for free, with zero session cookies or browser logins.
2. **Flawless Millisecond Lipsync & Subtitles:** Because the audio length is known down to the exact millisecond (`ffprobe`), subtitle cues are mathematically guaranteed to match the speaker's voice.
3. **Studio Visuals with Existing Photos:** FFmpeg's `zoompan` filter turns static product photos into cinematic video cuts (slow push-in, subtle glide) without needing heavy GPU video generation.
4. **Zero Authentication Downtime:** Pure API-based execution (Gemini API + EdgeTTS + FFmpeg), eliminating brittle browser-automation logins forever.

---

## 5. Ready-to-Implement Code Modifications

Here are the exact code enhancements to apply to the repository.

### 5.1 Updates to `api/app/storyboards.py`

#### 1. Integrate Duration-to-Word Limits in Validation:
```python
def validate_scene_word_count(scene: Scene, language: str) -> None:
    """Enforces human speaking cadence to prevent rushed or overcrowded narration."""
    words = len(scene.narration.split()) if language == "en" else len(scene.narration) // 3
    max_words = int(scene.duration_seconds * (2.4 if language == "en" else 3.8))
    if words > max_words:
        raise ValueError(
            f"Scene narration is too long for a {scene.duration_seconds}s scene "
            f"({words} words/chunks; max allowed is {max_words}). Make it more concise."
        )
```

#### 2. Enhanced Hook Generation Schema:
Update `Hook` model to categorize each hook by archetype:
```python
class Hook(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    id: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    archetype: Literal["pain_agitation", "curiosity_intrigue", "value_offer"]
    text: str = Field(min_length=1, max_length=180)  # Reduced from 300 to enforce punchiness
```

---

### 5.2 Updates to `api/app/llm/storyboard_render.py`

Replace `package_from_storyboard` with the anti-podcast commercial directive:

```python
def package_from_storyboard(
    brief: str, storyboard: dict, sources: list[JobSource]
) -> CaptionPackage:
    language = storyboard["language"]
    files = [source for source in sources if source.kind == "file"]
    
    lines = [
        "### PRODUCTION DIRECTIVE: VIRAL SHORT-FORM COMMERCIAL ADVERTISEMENT",
        "### STRICT ENFORCEMENT: THIS IS NOT A PODCAST. NO HOST INTRODUCTIONS. NO CHAT.",
        "Begin IMMEDIATELY on second 0.0 with the spoken hook. Maintain high energy and rapid cuts.",
        f"Brand / Business: {storyboard.get('business_name', '')}",
        f"Verified Offer: {storyboard.get('offer', '') or 'Promote stated benefit only; do not invent offers.'}",
        f"Call to Action: {storyboard.get('contact', '')}",
        f"Language Target: {language}",
        "",
        "### PRODUCTION TIMELINE & SHOT LIST:",
    ]
    
    elapsed = 0.0
    for index, scene in enumerate(storyboard["scenes"], start=1):
        duration = float(scene["duration_seconds"])
        end = elapsed + duration
        asset_id = scene.get("asset_id")
        asset_label = files[int(asset_id)].title if asset_id is not None else "Cinematic AI B-Roll"
        
        lines.extend([
            f"--- SHOT {index} (Timecode: {elapsed:g}s - {end:g}s | Length: {duration:g}s) ---",
            f"SPOKEN VOICEOVER: \"{scene['narration']}\"",
            f"ON-SCREEN BANNER: {scene['on_screen_text']}",
            f"CAMERA DIRECTION: {scene['visual_direction']}",
            f"FEATURED VISUAL ASSET: {asset_label}",
            "",
        ])
        elapsed = end
        
    steering = (
        f"High-energy vertical 9:16 mobile video advertisement (Length: {elapsed:g}s). "
        "Style: High-retention TikTok/Reels commercial. "
        "CRITICAL: Start immediately on second 0 with Shot 1 voiceover. Do not add intro greetings. "
        "Follow the shot list verbatim. Do not hallucinate prices or discounts. "
        + _video_language_instruction(language)
    )
    
    return CaptionPackage(
        brief=brief,
        title=storyboard["title"],
        caption=storyboard["caption"],
        steering_prompt=steering,
        source_text="\n".join(lines),
        video_format="short",
    )
```

---

## 6. Actionable Implementation Checklist

To roll out these optimizations cleanly:

- [ ] **Step 1: Upgrade Gemini System Prompts**
  - Replace `_EN_INSTRUCTIONS` and `_KM_INSTRUCTIONS` in `storyboards.py` with the structured Markdown versions featuring the 3 Hook Archetypes.
- [ ] **Step 2: Add Word-Per-Second Cadence Checks**
  - Add client-side and server-side word count warnings so Gemini (and users) cannot create a 5-second scene with 30 words.
- [ ] **Step 3: Update NotebookLM Packaging**
  - Inject the `[COMMERCIAL ADVERTISEMENT — NOT A PODCAST]` directive into `storyboard_render.py` to strip out conversational podcast chatter.
- [ ] **Step 4: Adopt Neural Khmer TTS (Sprint Upgrade)**
  - Integrate `edge-tts` for Khmer campaigns (`km-KH-PisethNeural`) to eliminate NotebookLM's English-voice fallback for Cambodian marketing videos.
- [ ] **Step 5: Add Visual Camera Syntax Guidance in UI**
  - In `StoryboardEditor.jsx`, add helper tags below "Visual direction" (e.g. `[Macro Zoom]`, `[Fast Pan]`, `[POV Shot]`) to encourage cinematic descriptions.

---

*Report authored for the Marketing Agent project. Refer to this specification for improving video accuracy, hook conversion rates, and multi-lingual professional quality.*

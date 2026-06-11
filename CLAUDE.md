# Math Speed Trainer

A browser-based mental math practice tool for students. No build system — plain HTML/CSS/JS hosted on GitHub Pages at **https://teja1995.github.io**.

---

## File Structure

```
index.html          — single-page app shell (all views + modals)
styles.css          — all styling (dark glassmorphism theme, Inter font)
models.js           — AI model registry: configs, icons, guides, API endpoints
script.js           — tab routing, settings/model-selection logic, practice session logic
auth.js             — Google Sign-in, auth state, all model key restore on login
upload.js           — file handling, multi-model API calls, retry + auto-failover logic
performance.js      — session save/load/delete, Chart.js chart, manual add modal
firebase-config.js  — Firebase project credentials + initialises firebase + db globals
```

---

## Features

### 1. Google Sign-In
- Firebase Authentication with Google provider (popup flow)
- Unauthenticated state → sign-in screen only
- Authenticated state → full app with 4 tabs: Practice, Check Worksheet, My Performance, Settings

### 2. Practice Tab
- User sets a duration (minutes) and selects one or more question types, then clicks Start
- Selection persists in localStorage across sessions
- Random questions from the selected types appear one at a time; answer submitted with Enter
- Four question types (toggled with chip buttons, at least one must be active):
  - **Addition** — two 2-digit numbers (10–99), e.g. `47 + 83 = ?`
  - **Subtraction** — two 2-digit numbers (larger − smaller, no negative results)
  - **Multiplication** — randomly alternates between 3-digit × single digit (100–899 × 2–9, not a multiple of 100) and simple times-table style (2–10 × 2–13)
  - **Percentages** — convert a fraction to % rounded to 2 decimal places
- Live score counters (Correct / Wrong) with bump animation on each answer
- Timer turns red and pulses at ≤ 30 seconds remaining
- Pause / Resume supported (timer + answer checking both freeze)
- On session end: summary shown + session auto-saved to Firebase RTDB

### 3. Check Worksheet Tab
- Student uploads a photo (JPG/PNG) or scan (PDF) of a completed handwritten worksheet
- PDF: rendered to canvas via pdf.js (page 1 only), then sent as JPEG base64
- Image: read as base64 via FileReader
- Sent to the **user's selected AI model** (see Settings) with a structured prompt
- AI returns JSON: `[{question, studentAnswer, correctAnswer, isCorrect}]`
- Results displayed as a table with ✓ / ✗ per question and a correct/wrong summary
- Shows which model was used at the bottom of the results

**Worksheet prompt design:** Worksheets typically have 4 columns of problems in `num + num = ____` format. The prompt is structured as two explicit steps and opens with a GOLDEN RULE:
- Act as an answer-**checker**, not an answer-**giver** — never compute and write an answer the student didn't write
- GOLDEN RULE: if the answer space after `=` is empty, `studentAnswer` must be `"blank"` and `isCorrect` must be `false`, no exceptions
- **Step 1 — Scan the full image first:** before reading anything, look at the entire image left-to-right, count all columns (typically 4), and commit to processing every one. The prompt explicitly warns: "if you find yourself returning fewer than 15 results for a full page, you have missed columns — look again at the right side of the image." This was added because Llama 4 Scout would read only the first column and stop.
- **Step 2 — Read each column:** left to right across columns, top to bottom within each column
- Only look at the blank/underscored space immediately after `=` on the same line for the student's answer
- Never borrow a number from the next question as the current answer
- Every problem visible on the sheet must appear in the output array
- If the entire sheet appears unanswered, every `studentAnswer` must be `"blank"` and every `isCorrect` must be `false`

**Client-side blank/unreadable enforcement (`upload.js → displayWorksheetResults`):**
Before rendering results, the app iterates every row and forces `isCorrect = false` if `studentAnswer` is `"blank"` or `"unreadable"`. This is a safety net in case a model ignores the prompt instruction.

**JSON response parsing (`upload.js → parseAIJSON`):**
Models (especially Groq/OpenRouter) frequently return malformed or decorated JSON. Five recovery passes are tried in order before giving up:
1. Direct `JSON.parse` (happy path)
2. Strip trailing commas before `]` or `}` — most common Groq mistake
3. Truncate to the last fully-closed `}` — handles responses cut off mid-generation
4. Convert single-quoted strings to double quotes — some models use JS object syntax
5. Extract every `{…}` block individually and assemble them into an array — last resort
- The extraction regex is `\[\s*\{…\}\s*\]` (requires array of objects), not just `\[…\]`, so preamble text like `[note: 4 columns detected]` doesn't poison the match
- All markdown fences (` ```json `) are stripped before parsing
- `console.error` logs the raw model output when all passes fail, for debugging

**Retry + auto-failover logic (upload.js):**
1. Try the selected model up to 3 times with exponential back-off (5s → 15s → 30s) on overload/503 errors
2. If still failing after 3 retries, automatically switch to the next model (in accuracy ranking order) that has an API key saved
3. Repeat until all available models are exhausted, then show an error
4. Live loading message updates at each step to tell the user what's happening

### 4. My Performance Tab
- Line chart (Chart.js): X = session date, Y = questions per minute
- Tooltip on each point shows: correct count, wrong count, duration
- Session history table sorted newest first
- Delete any session (confirmation modal)
- Manually add a session (date, duration, correct, wrong) — useful for paper sessions

### 5. Settings Tab — Multi-Model AI Selector
- 4 model cards displayed in a 2-column grid (1 column on mobile)
- Each card shows: provider icon, model name, provider name, tag badge, star accuracy rating, RPM, and key status indicator (✓ / ○)
- Clicking a card selects it and shows a panel below with:
  - API key guide (numbered steps with direct link to the key page)
  - API key input (pre-filled if already saved)
  - Save button
- Selected model is stored in `localStorage.selectedModel`
- Per-model keys saved to both localStorage and Firebase RTDB

**Available models (ranked by accuracy):**

| # | Model | Provider | Stars | Free RPM | localStorage key | Firebase key |
|---|---|---|---|---|---|---|
| 1 | Gemini 2.5 Flash | Google AI Studio | ★★★★★ | 5 RPM | `geminiApiKey` | `geminiKey` |
| 2 | Llama 4 Scout | Groq | ★★★★ | 30 RPM | `groqApiKey` | `groqKey` |
| 3 | Gemini 2.0 Flash (free) | OpenRouter | ★★★★ | Varies | `openrouterApiKey` | `openrouterKey` |
| 4 | Qwen 2.5 VL 72B (free) | OpenRouter | ★★★ | Varies | `openrouterApiKey` | `openrouterKey` |

Notes:
- OpenRouter models 3 and 4 share the same API key; saving either updates the same Firebase field
- Auto-failover skips any model with no saved key
- The upload tab shows a small badge with the currently selected model name

### 6. API Key Onboarding Modal
- On first login (or any login where no model has a key), a modal appears after 0.7s
- Modal suggests Google AI Studio (Gemini 2.5 Flash) as the quickest option, mentions Groq/OpenRouter as alternatives
- "Skip for now" dismisses the modal for that session
- Once any key is saved, the modal never reappears

---

## Tech Stack

| Concern | Library / Service |
|---|---|
| Authentication | Firebase Auth (Google provider) — compat CDN v9.23.0 |
| Database | Firebase Realtime Database — compat CDN v9.23.0 |
| Worksheet AI | Multi-model (Gemini 2.5 Flash, Groq Llama 4 Scout, OpenRouter) |
| PDF rendering | pdf.js v3.11.174 (CDN) |
| Charts | Chart.js v4.4.0 (CDN) |
| Fonts | Inter (Google Fonts) |
| Hosting | GitHub Pages (`main` branch) |

No npm, no bundler, no build step.

---

## API Format Details

**Gemini format** (`models.js`: `apiFormat: 'gemini'`):
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=KEY
Body: { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type, data: base64 } }] }] }
Response: candidates[0].content.parts[0].text
```

**OpenAI-compatible format** (Groq, OpenRouter — `apiFormat: 'openai'`):
```
POST https://api.groq.com/openai/v1/chat/completions  (or openrouter.ai/api/v1/...)
Headers: Authorization: Bearer KEY
         HTTP-Referer + X-Title (OpenRouter only, per their usage policy)
Body: { model: modelId, messages: [{ role: user, content: [{ type: text }, { type: image_url, image_url: { url: data:mimeType;base64,... } }] }] }
Response: choices[0].message.content
```

---

## Data Structure (Firebase Realtime Database)

```
sessions/
  {uid}/
    records/
      {pushId}/
        date        — ISO 8601 string
        durationMin — integer (minutes set by user)
        correct     — integer
        incorrect   — integer
        totalQ      — correct + incorrect
        qPerMin     — totalQ / durationMin (float, 2dp)

users/
  {uid}/
    geminiKey       — string (Google AI Studio key)
    groqKey         — string (Groq API key)
    openrouterKey   — string (OpenRouter API key, used for both OR models)
```

---

## Firebase Realtime Database Rules

```json
{
  "rules": {
    "sessions": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

Apply in: Firebase Console → Realtime Database → Rules → Publish.

---

## Deployment

- **Live URL:** https://teja1995.github.io (served from `main` branch)
- **Phase 2:** Custom domain (after limited-user testing). When switching:
  - Add new domain to Firebase → Authentication → Settings → Authorized domains
  - No code changes needed

---

## One-Time Setup (Firebase project)

1. **console.firebase.google.com** → Add project (disable Analytics)
2. **Authentication** → Get started → Enable Google provider
3. **Authentication** → Settings → Authorized domains → add `teja1995.github.io`
4. **Realtime Database** → Create Database → Start in test mode → apply rules above
5. **Project Settings** → Your Apps → Web (`</>`) → Register → copy config into `firebase-config.js`
   - Use only the plain `const firebaseConfig = { ... }` object — remove any `import` statements Google adds
   - The file must end with `firebase.initializeApp(firebaseConfig);` and `const db = firebase.database();`

---

## API Keys (per user, not developer)

### Google AI Studio (Gemini 2.5 Flash)
- Get from: **aistudio.google.com/app/apikey** (NOT Google Cloud Console — Cloud Console keys have 0 free quota)
- Free tier: 5 RPM, 250K TPM
- `gemini-2.0-flash` and `gemini-1.5-flash` showed 0/0 RPM on free-tier keys → `gemini-2.5-flash` is the only confirmed free model (v1beta endpoint)

### Groq (Llama 4 Scout)
- Get from: **console.groq.com/keys** (free account, no credit card)
- Free tier: 30 RPM, 14,400 req/day
- Uses OpenAI-compatible endpoint with `meta-llama/llama-4-scout-17b-16e-instruct`

### OpenRouter (Gemini 2.0 Flash free, Qwen 2.5 VL)
- Get from: **openrouter.ai/settings/keys** (free account)
- Free `:free` model variants — may have rate limits and queue delays
- One key covers both OpenRouter models (gemini-2.0-flash-exp:free and qwen2.5-vl-72b-instruct:free)
- OpenRouter requests include `HTTP-Referer: https://teja1995.github.io` per their usage policy

---

## Key Decisions & History

| Decision | Reason |
|---|---|
| Realtime Database instead of Firestore | Firestore requires billing/card details; RTDB free tier does not |
| `gemini-2.5-flash` (v1beta) as default/recommended | 2.0 Flash and 1.5 Flash show 0/0 RPM on free tier AI Studio keys; 2.5 Flash has confirmed 5 RPM |
| Multi-model support (Groq, OpenRouter) | Gemini 2.5 Flash has only 5 RPM — during high demand the model is unavailable; alternatives provide failover |
| Auto-failover to next model after 3 retries | Avoids silent failures: 3 retries on the selected model, then switches transparently to the next available model |
| OpenAI-compatible format for Groq/OpenRouter | Both use the same `/v1/chat/completions` format with `image_url` content type — one code path serves both |
| Model keys stored in Firebase (not only localStorage) | Mobile browsers clear localStorage; Firebase persists keys across devices and browser resets |
| No format validation on API keys | Prefix checks like `AIza` were rejecting valid keys; wrong keys now fail gracefully at the API with a clear message |
| CDN compat SDK (not ES modules) | No build step needed; works directly on GitHub Pages |
| Column-aware prompt | Generic prompt caused model to read numbers from adjacent rows as answers; explicit spatial layout rules fixed accuracy |
| GOLDEN RULE in prompt + client-side enforcement | Models (both Gemini and Groq) were filling in computed answers for blank spaces and marking them correct; opening the prompt with "you are a checker not a giver" + client-side `isCorrect=false` override fixed it |
| 5-pass JSON recovery | Groq and OpenRouter return trailing commas, single quotes, preamble text, or cut-off arrays; a single `JSON.parse` fails too often; five progressive recovery passes handle all observed failure modes |
| Extraction regex requires array of objects | Plain `\[[\s\S]*\]` matched `[note: 4 columns]` preambles and poisoned the parse; `\[\s*\{…\}\s*\]` requires the array to contain objects so only the real answer array matches |
| Two-step scan prompt for multi-column reading | Llama 4 Scout read only the first column and stopped; restructuring the prompt as "Step 1: scan full image and count columns" then "Step 2: read each column" with an explicit minimum-result warning fixed it |
| AI Studio key required for Gemini (not Cloud Console) | Cloud Console keys have 0 free-tier quota for Gemini regardless of model |
| models.js loaded before auth.js | auth.js iterates MODELS to restore keys; models.js must exist as a global first |
| Operation selection saved to localStorage | Students often practice the same type each day; persisting the chip selection avoids re-selecting every visit |

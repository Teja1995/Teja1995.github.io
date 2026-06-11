# Math Speed Trainer

A browser-based mental math practice tool for students. No build system — plain HTML/CSS/JS hosted on GitHub Pages at **https://teja1995.github.io**.

---

## File Structure

```
index.html          — single-page app shell (all views + modals)
styles.css          — all styling (dark glassmorphism theme, Inter font)
script.js           — tab routing, settings logic, practice session logic
auth.js             — Google Sign-in, auth state, Gemini key restore on login
upload.js           — worksheet file handling, Gemini Vision API call, results display
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
- User sets a duration (minutes) and clicks Start
- Random math questions appear one at a time; answer submitted with Enter
- Three question types chosen randomly (~equal probability):
  - **Arithmetic** — two 2-digit numbers (10–99) with `+`, `-`, or `×`
  - **Multiplication** — 3-digit number (not multiple of 100) × single digit (2–9)
  - **Percentage** — convert a fraction to % (2 decimal places)
- Live score counters (Correct / Wrong) with bump animation on each answer
- Timer turns red and pulses at ≤ 30 seconds remaining
- Pause / Resume supported (timer + answer checking both freeze)
- On session end: summary shown + session auto-saved to Firebase RTDB

### 3. Check Worksheet Tab
- Student uploads a photo (JPG/PNG) or scan (PDF) of a completed handwritten worksheet
- PDF: rendered to canvas via pdf.js (page 1 only), then sent as JPEG base64
- Image: read as base64 via FileReader
- Sent to **Gemini 1.5 Flash** vision API with a structured prompt
- Gemini returns JSON: `[{question, studentAnswer, correctAnswer, isCorrect}]`
- Results displayed as a table with ✓ / ✗ per question and a correct/wrong summary

**Important — API key source:** Keys must come from **aistudio.google.com/app/apikey**, NOT from Google Cloud Console. Cloud Console keys have 0 free-tier quota for Gemini and will throw a quota error immediately.

### 4. My Performance Tab
- Line chart (Chart.js): X = session date, Y = questions per minute
- Tooltip on each point shows: correct count, wrong count, duration
- Session history table sorted newest first
- Delete any session (confirmation modal)
- Manually add a session (date, duration, correct, wrong) — useful for paper sessions

### 5. Settings Tab
- Gemini API key input with step-by-step guide (link to AI Studio)
- Status badge shows whether a key is currently saved (green ✓ / red ⚠)
- Save writes key to both `localStorage` (fast cache) and Firebase RTDB (durable)

### 6. Gemini API Key Onboarding
- On first login (or any login where no key is found), a modal appears after 0.7s
- Modal explains what the key is for and shows 3-step instructions
- "Skip for now" dismisses the modal for that session
- Once a key is saved, the modal never reappears (key restored from Firebase on every login)

---

## Tech Stack

| Concern | Library / Service |
|---|---|
| Authentication | Firebase Auth (Google provider) — compat CDN v9.23.0 |
| Database | Firebase Realtime Database — compat CDN v9.23.0 |
| Worksheet AI | Google Gemini 2.5 Flash (vision) via REST API — v1beta endpoint |
| PDF rendering | pdf.js v3.11.174 (CDN) |
| Charts | Chart.js v4.4.0 (CDN) |
| Fonts | Inter (Google Fonts) |
| Hosting | GitHub Pages (`main` branch) |

No npm, no bundler, no build step.

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
    geminiKey     — string (user's Gemini API key)
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
- **Dev branch:** `revamp` — merge to `main` to deploy
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

## Gemini API Key (per user, not developer)

- Each user gets their own free key from **aistudio.google.com/app/apikey**
- Free tier: 1,500 requests/day, 15 requests/minute — sufficient for worksheet checking
- Key is saved to Firebase RTDB on first entry and restored automatically on every subsequent login
- No format validation on the key — invalid keys fail at the Gemini API with a clear error message

---

## Key Decisions & History

| Decision | Reason |
|---|---|
| Realtime Database instead of Firestore | Firestore requires billing/card details; RTDB free tier does not |
| Gemini 2.5 Flash (v1beta) | 2.0 Flash and 1.5 Flash show 0/0 RPM on free tier keys; 2.5 Flash has 5 RPM quota on AI Studio keys |
| API key stored in Firebase (not only localStorage) | Mobile browsers can clear localStorage; Firebase ensures key persists across logins and devices |
| No prefix validation on Gemini key | Original `AIza` check was wrong — rejected valid keys; wrong keys now fail gracefully at the API |
| CDN compat SDK (not ES modules) | No build step needed; works directly on GitHub Pages |

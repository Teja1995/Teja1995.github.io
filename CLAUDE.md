# Math Speed Trainer

A browser-based mental math practice tool for students. No build system — plain HTML/CSS/JS hosted on GitHub Pages.

---

## Current File Structure

```
index.html          — single-page app shell (all views)
styles.css          — all styling
script.js           — practice session logic (legacy name, kept for git history)
firebase-config.js  — Firebase project credentials (user must fill in)
auth.js             — Google Sign-in + auth state
upload.js           — worksheet upload + AI answer checking
performance.js      — session logging, Chart.js charts, add/delete data points
```

---

## Feature Overview

### 1. Google Sign-In
- Firebase Authentication with Google provider
- Unauthenticated users see only the sign-in screen
- Authenticated users see the full app with three tabs

### 2. Two Modes (tabs after sign-in)
- **Practice** — timed random question sessions (existing feature)
- **Upload** — upload a solved math worksheet (PDF or image) and check answers
- **My Performance** — charts + history of all practice sessions

### 3. Worksheet Upload & Answer Checker
**Flow:**
1. Student solves a printed math worksheet by hand
2. Takes a photo or scans it to PDF
3. Uploads the file on the Upload tab
4. The app sends the image to the Gemini Vision API
5. Gemini reads each question, reads the student's written answer, computes the correct answer, returns JSON
6. App displays a results table: question | student answer | correct answer | ✓/✗

**Supported question types on worksheets:**
- Addition, subtraction, multiplication, division (integers and decimals)
- Percentage calculations

**Tech:**
- PDF files: rendered to a canvas via `pdf.js` (CDN), then converted to base64 image
- Images: read as base64 via `FileReader`
- AI call: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent` with inline image data
- API key: stored in `localStorage` after the user configures it once in Settings

**Gemini prompt template:**
> "This is a math worksheet with student handwritten answers. For each visible question, extract: the question text, the student's written answer, the correct answer, and whether the student is correct. Return ONLY a JSON array: [{question, studentAnswer, correctAnswer, isCorrect}]"

### 4. Performance Tracking (My Performance tab)
**Data stored per session in Firestore:**
```
sessions/{uid}/records/{docId}:
  date        — ISO string
  durationMin — minutes set by user
  correct     — count of correct answers
  incorrect   — count of incorrect answers
  totalQ      — correct + incorrect
  qPerMin     — totalQ / durationMin  (speed metric)
```

**Chart:**
- X axis: session date
- Y axis: questions answered per minute (speed)
- Line chart via Chart.js (CDN)
- Each point is hoverable and shows full session detail

**Data point management:**
- User can delete any session record (click on point → modal with Delete button)
- User can manually add a session (date, duration, correct, incorrect — for sessions done on paper)

---

## Tech Stack

| Concern | Library / Service |
|---|---|
| Auth + DB | Firebase Auth + Firestore (CDN) |
| File storage | Not stored server-side — processed in browser |
| Worksheet AI | Google Gemini 2.0 Flash (vision, free tier) |
| PDF rendering | pdf.js (CDN) |
| Charts | Chart.js (CDN) |
| Hosting | GitHub Pages |

---

## Deployment Plan

- **Phase 1 (now):** GitHub Pages — `https://teja1995.github.io`
- **Phase 2 (after limited-user testing):** Custom domain (e.g. `https://yourdomain.com`)

When moving to a custom domain:
- Add the new domain to Firebase → Authentication → Settings → Authorized domains
- Update Gemini API key restrictions in Google Cloud Console to allow the new origin
- No code changes needed

---

## Setup Required (one-time, by developer/teacher)

### Firebase
1. Create a project at console.firebase.google.com
2. Enable Authentication → Google provider
3. Add authorized domains: `teja1995.github.io` (and your custom domain when ready)
4. Create a Firestore database (start in test mode, then secure with rules below)
5. Register a web app → copy the config object into `firebase-config.js`

### Gemini API Key
- Get a free key from aistudio.google.com
- Users paste the key once into the Settings panel — stored in `localStorage`
- Restrict the key in Google Cloud Console to only allow `generativelanguage.googleapis.com`

### Firestore Rules (production)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sessions/{uid}/records/{doc} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## View Structure (single-page, JS-driven)

```
#view-signin      — shown when user is not authenticated
#view-app         — shown when authenticated
  #tab-practice   — existing timed practice
  #tab-upload     — worksheet upload + results
  #tab-performance — Chart.js + session history table
  #tab-settings   — Gemini API key input
```

---

## Practice Session Logic

Same as before, with these additions on `endPractice()`:
- Saves a session record to Firestore under `sessions/{uid}/records`
- `qPerMin` = `(correct + incorrect) / durationMin`
- Shows a "Session saved" confirmation

Pause/Resume do NOT split a session — only one record per Start→End cycle.

---

## Known Issues (pre-new-features)
- `window.onload = initialize` referenced a non-existent function — fixed
- No final results screen — now handled by `endPractice()` + Firestore save

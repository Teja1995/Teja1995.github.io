# Math Speed Trainer

A timed mental math practice app that runs in the browser. No frameworks, no build step — three plain files.

## Files

- `index.html` — page skeleton with input, buttons, and display containers
- `script.js` — all app logic
- `styles.css` — layout and visual styling

## How it works

The user sets a duration (in minutes), clicks Start, and the app shows random math questions one at a time. Answers are typed and submitted with Enter. The app tracks correct/incorrect counts and stops when the timer runs out.

## Question Types

Randomly chosen each time with roughly equal probability:

- **Arithmetic** — two 2-digit numbers (10–99) with a random `+`, `-`, or `×` operator
- **Multiplication** — a 3-digit number (100–899, not a multiple of 100) × a single digit (2–9)
- **Percentage** — convert a fraction to a percentage, shown to 2 decimal places (e.g. "What is 3/7 as a percentage?")

## Core Flow

1. User enters time and clicks Start → resets counts, starts 1-second countdown, generates first question
2. Each question renders a `<p>` and `<input>` into `#question-container`; input is auto-focused
3. Pressing Enter submits the answer → compared as floats rounded to 2 decimal places
4. Feedback shown in `#correct-answer-container`, then next question generated immediately
5. Pause freezes the timer and blocks answer checking; Resume generates a fresh question
6. When timer hits 0, the session ends — no final summary screen is shown yet

## Known Issues / TODOs

- `window.onload = initialize` (script.js:59) references a non-existent function and silently fails; actual init is handled by the `load` event listener on line 55
- No final results screen — when the timer ends, questions stop but no summary is displayed
- On page load, a random motivational quote appears in `#correct-answer-container`; it gets replaced once the user starts answering

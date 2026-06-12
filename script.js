// Auto-stamped by .git/hooks (core.hooksPath = .githooks) on every commit — do not edit by hand.
const BUILD_TIME = '2026-06-12T05:17:39Z';
const REPO = 'Teja1995/Teja1995.github.io';

let time, timer;
let correctCount = 0;
let incorrectCount = 0;
let practiceOngoing = false;
let timerPaused = false;
let sessionDurationMin = 0;

// ─── Operation registry ────────────────────────────────────────

const OPERATIONS = [
    { id: 'addition',       label: 'Addition',       symbol: '+', fn: generateAdditionQuestion },
    { id: 'subtraction',    label: 'Subtraction',    symbol: '−', fn: generateSubtractionQuestion },
    { id: 'multiplication', label: 'Multiplication', symbol: '×', fn: generateMultiplicationQuestion },
    { id: 'percentages',    label: 'Percentages',    symbol: '%', fn: generatePercentageQuestion },
];

function getSelectedOps() {
    try {
        const saved = JSON.parse(localStorage.getItem('selectedOps'));
        if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch {}
    return OPERATIONS.map(o => o.id); // default: all selected
}

function saveSelectedOps(ops) {
    localStorage.setItem('selectedOps', JSON.stringify(ops));
}

function toggleOperation(id) {
    const current = getSelectedOps();
    const idx = current.indexOf(id);
    if (idx >= 0) {
        if (current.length === 1) return; // must keep at least one
        current.splice(idx, 1);
    } else {
        current.push(id);
    }
    saveSelectedOps(current);
    renderOperationSelector();
    document.getElementById('op-selector-error').classList.add('hidden');
}

function renderOperationSelector() {
    const container = document.getElementById('operation-selector');
    if (!container) return;
    const selected = getSelectedOps();
    container.innerHTML = OPERATIONS.map(op => `
        <button class="op-chip ${selected.includes(op.id) ? 'active' : ''}"
                onclick="toggleOperation('${op.id}')"
                aria-pressed="${selected.includes(op.id)}">
            <span class="op-symbol">${op.symbol}</span>
            ${op.label}
        </button>
    `).join('');
}

// ─── Tab routing ───────────────────────────────────────────────

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.remove('hidden');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    if (tabName === 'performance') loadPerformanceData();
    if (tabName === 'settings')    renderSettingsTab();
    if (tabName === 'upload')      refreshUploadModelBadge();
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// ─── Settings — model selection ────────────────────────────────

function renderSettingsTab() {
    renderModelGrid();
    const selectedId = localStorage.getItem('selectedModel') || 'gemini-2.5-flash';
    renderModelKeyPanel(selectedId);
}

function renderModelGrid() {
    const grid = document.getElementById('model-grid');
    if (!grid) return;
    const selectedId = localStorage.getItem('selectedModel') || 'gemini-2.5-flash';

    grid.innerHTML = MODELS.map(model => {
        const hasKey     = !!localStorage.getItem(model.keyStorageKey);
        const isSelected = model.id === selectedId;
        const stars      = '★'.repeat(model.accuracy) + '☆'.repeat(5 - model.accuracy);

        return `
        <div class="model-card ${isSelected ? 'selected' : ''}"
             onclick="selectModel('${model.id}')" role="button" tabindex="0"
             aria-pressed="${isSelected}">
            <div class="model-card-header">
                <div class="model-icon">${model.icon}</div>
                <div class="model-info">
                    <div class="model-name">${model.name}</div>
                    <div class="model-provider">${model.provider}</div>
                </div>
                <span class="model-tag ${model.tagClass}">${model.tag}</span>
            </div>
            <div class="model-meta">
                <span class="model-stars" aria-label="${model.accuracy} out of 5 stars">${stars}</span>
                <span class="model-rpm">${model.rpmLabel}</span>
                <span class="model-key-ind ${hasKey ? 'has-key' : 'no-key'}">
                    ${hasKey ? '✓ Key saved' : '○ No key'}
                </span>
            </div>
        </div>`;
    }).join('');
}

function selectModel(id) {
    localStorage.setItem('selectedModel', id);
    renderModelGrid();
    renderModelKeyPanel(id);
    refreshUploadModelBadge();
}

function renderModelKeyPanel(modelId) {
    const panel = document.getElementById('model-key-panel');
    if (!panel) return;
    const model = MODELS.find(m => m.id === modelId);
    if (!model) { panel.classList.add('hidden'); return; }

    const savedKey = localStorage.getItem(model.keyStorageKey) || '';
    const hasKey   = !!savedKey;

    const stepsHtml = model.keySteps.map((step, i) => {
        const content = step.link
            ? `${step.text}<a href="${step.link.url}" target="_blank" rel="noopener noreferrer">${step.link.label}</a>`
            : step.text;
        return `<li><span class="step-num">${i + 1}</span><div>${content}</div></li>`;
    }).join('');

    panel.innerHTML = `
        <h3 class="section-title">API Key — ${model.name}</h3>
        <div class="model-key-note">${model.keyNote}</div>
        <div class="guide-box" style="margin-top:16px">
            <p class="guide-title">How to get a free key</p>
            <ol class="guide-steps">${stepsHtml}</ol>
        </div>
        <div class="settings-group" style="margin-top:4px">
            <label class="settings-label" for="model-key-input">Your API Key</label>
            <div class="api-key-row">
                <input type="password" id="model-key-input" class="settings-input"
                       placeholder="${model.keyPlaceholder}"
                       value="${hasKey ? savedKey : ''}">
                <button class="btn btn-primary" onclick="saveSelectedModelKey('${model.id}')">Save</button>
            </div>
            <p id="model-key-status" class="key-status hidden"></p>
        </div>`;

    panel.classList.remove('hidden');
}

function saveSelectedModelKey(modelId) {
    const model  = MODELS.find(m => m.id === modelId);
    if (!model) return;

    const input  = document.getElementById('model-key-input');
    const status = document.getElementById('model-key-status');
    const key    = input.value.trim();

    if (!key || key.length < 10) {
        status.textContent = 'Please paste a valid API key.';
        status.className   = 'key-status error';
        status.classList.remove('hidden');
        return;
    }

    localStorage.setItem(model.keyStorageKey, key);
    if (currentUser) {
        db.ref('users/' + currentUser.uid + '/' + model.dbKey).set(key)
          .catch(e => console.error('Could not save key to database:', e));
    }

    status.textContent = `✓ ${model.name} key saved.`;
    status.className   = 'key-status success';
    status.classList.remove('hidden');
    renderModelGrid();
}

// ─── Upload tab — active model badge ──────────────────────────

function refreshUploadModelBadge() {
    const badge = document.getElementById('upload-model-badge');
    if (!badge) return;
    const selectedId = localStorage.getItem('selectedModel') || 'gemini-2.5-flash';
    const model = MODELS.find(m => m.id === selectedId);
    if (!model) return;
    const hasKey = !!localStorage.getItem(model.keyStorageKey);
    badge.innerHTML = hasKey
        ? `Using <strong>${model.name}</strong> · <button class="btn-link" onclick="showTab('settings')">Change model</button>`
        : `<span style="color:var(--wrong)">No key for ${model.name}</span> · <button class="btn-link" onclick="showTab('settings')">Add a key</button>`;
}

// ─── Gemini onboarding modal ───────────────────────────────────

function persistGeminiKey(key) {
    localStorage.setItem('geminiApiKey', key);
    if (currentUser) {
        db.ref('users/' + currentUser.uid + '/geminiKey').set(key)
          .catch(e => console.error('Could not save key to database:', e));
    }
}

function saveGeminiKeyFromOnboarding() {
    const key = document.getElementById('onboarding-key').value.trim();
    if (!key || key.length < 10) {
        document.getElementById('onboarding-error').classList.remove('hidden');
        return;
    }
    persistGeminiKey(key);
    closeModal('gemini-onboarding-modal');
}

function skipGeminiOnboarding() {
    closeModal('gemini-onboarding-modal');
}

// ─── Practice ──────────────────────────────────────────────────

function initializeQuote() {
    const quotes = [
        "No matter how you feel, get up, dress up and never give up",
        "Believe you can and you're halfway there",
        "The only way to do great work is to love what you do",
        "Push yourself, because no one else is going to do it for you",
        "Great things never come from comfort zones",
        "Dream it. Wish it. Do it.",
        "The harder you work, the greater you'll feel when you achieve it",
        "Don't stop when you're tired. Stop when you're done",
        "Do something today that your future self will thank you for",
        "It's going to be hard, but hard does not mean impossible",
        "The key to success is to focus on goals, not obstacles",
    ];
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    const card  = document.getElementById('correct-answer-container');
    if (card) {
        card.textContent = `"${quote}"`;
        card.className   = 'card feedback-card is-neutral';
    }
}

window.addEventListener('load', () => {
    initializeQuote();
    renderOperationSelector();
    showVersionBadge();
});

// Shows the deployed build time, then checks GitHub for the latest commit.
// If the page you're viewing is behind (e.g. a cached old version), the badge
// turns into a "hard refresh" warning. If current, it shows "✓ latest".
async function showVersionBadge() {
    const brand = document.querySelector('.app-brand');
    if (!brand) return;

    const badge = document.createElement('span');
    badge.className = 'version-badge';
    badge.textContent = 'build ' + BUILD_TIME.slice(0, 16).replace('T', ' ') + ' UTC';
    brand.appendChild(badge);

    try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`);
        if (!res.ok) return; // offline or rate-limited — leave build time shown
        const data = await res.json();
        const latestMs = new Date(data.commit.committer.date).getTime();
        const builtMs  = new Date(BUILD_TIME).getTime();
        const sha = data.sha.slice(0, 7);

        if (builtMs >= latestMs - 60000) {       // within 60s skew = up to date
            badge.textContent = `✓ latest · ${sha}`;
            badge.classList.add('version-ok');
        } else {
            badge.textContent = '⚠ update available — hard refresh (Ctrl+F5)';
            badge.classList.add('version-stale');
            badge.title = `This page was built ${BUILD_TIME}; latest commit is ${sha}.`;
        }
    } catch { /* network/API issue — keep the build time */ }
}

function startPractice() {
    const selectedOps = getSelectedOps();
    if (selectedOps.length === 0) {
        document.getElementById('op-selector-error').classList.remove('hidden');
        return;
    }

    if (practiceOngoing || correctCount > 0 || incorrectCount > 0) {
        if (!confirm("Starting a new session will reset your progress. Continue?")) return;
    }

    correctCount   = 0;
    incorrectCount = 0;
    updateResult();

    const inputVal = parseInt(document.getElementById('timeInput').value);
    if (!inputVal || inputVal <= 0) { alert("Please enter a valid duration."); return; }

    sessionDurationMin = inputVal;
    time = inputVal * 60;
    clearInterval(timer);
    timer = setInterval(countdown, 1000);
    practiceOngoing = true;

    document.getElementById('timer').classList.remove('warning');
    generateQuestion();
}

function generateQuestion() {
    if (!practiceOngoing) return;
    const container = document.getElementById('question-container');
    container.innerHTML = '';

    const selectedIds = getSelectedOps();
    const available   = OPERATIONS.filter(o => selectedIds.includes(o.id));
    if (available.length === 0) return;

    const op = available[Math.floor(Math.random() * available.length)];
    op.fn(container);
}

// ─── Question generators ───────────────────────────────────────

function generateAdditionQuestion(container) {
    let a, b;
    do {
        a = Math.floor(Math.random() * 90) + 10;
        b = Math.floor(Math.random() * 90) + 10;
    } while (a === b);
    displayQuestion(container, `${a} + ${b} = ?`, a + b);
}

function generateSubtractionQuestion(container) {
    let a, b;
    do {
        a = Math.floor(Math.random() * 90) + 10;
        b = Math.floor(Math.random() * 90) + 10;
    } while (a === b);
    if (a < b) [a, b] = [b, a];
    displayQuestion(container, `${a} − ${b} = ?`, a - b);
}

function generateMultiplicationQuestion(container) {
    // Mix: 3-digit × single digit (harder) and 2-digit × 2-digit
    if (Math.random() < 0.5) {
        let a, b;
        do {
            a = Math.floor(Math.random() * 800) + 100;
            b = Math.floor(Math.random() * 8) + 2;
        } while (a % 100 === 0);
        displayQuestion(container, `${a} × ${b} = ?`, a * b);
    } else {
        let a = Math.floor(Math.random() * 9) + 2;  // 2–10
        let b = Math.floor(Math.random() * 12) + 2; // 2–13
        displayQuestion(container, `${a} × ${b} = ?`, a * b);
    }
}

function generatePercentageQuestion(container) {
    let numerator, denominator;
    do {
        denominator = Math.floor(Math.random() * 15) + 2;
        numerator   = Math.floor(Math.random() * (denominator * 2 - 1)) + 1;
    } while (numerator === denominator || numerator > denominator * 2);
    const answer = ((numerator / denominator) * 100).toFixed(2);
    displayQuestion(container, `${numerator} / ${denominator} as a percentage?`, answer);
}

function displayQuestion(container, questionText, correctAnswer) {
    const questionEl  = document.createElement('p');
    questionEl.textContent = questionText;

    const answerInput = document.createElement('input');
    answerInput.type        = 'text';
    answerInput.className   = 'answer-input';
    answerInput.placeholder = 'Type your answer…';

    container.appendChild(questionEl);
    container.appendChild(answerInput);
    answerInput.focus();

    answerInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            submitAnswer(answerInput, correctAnswer);
        }
    });
}

function submitAnswer(answerInput, correctAnswer) {
    const userAnswer = parseFloat(answerInput.value);
    if (isNaN(userAnswer)) return;
    checkAnswer(userAnswer, correctAnswer);
    if (practiceOngoing && !timerPaused) generateQuestion();
}

function checkAnswer(userAnswer, correctAnswer) {
    if (!practiceOngoing || timerPaused) return;

    const rounded = Math.round(parseFloat(userAnswer) * 100) / 100;
    const correct = Math.round(parseFloat(correctAnswer) * 100) / 100;

    if (!isNaN(rounded) && rounded === correct) {
        correctCount++;
        displayFeedback(true, '');
    } else {
        incorrectCount++;
        displayFeedback(false, correctAnswer);
    }
    updateResult();
}

function displayFeedback(isCorrect, correctAnswer) {
    const card = document.getElementById('correct-answer-container');
    card.className = 'card feedback-card';
    void card.offsetWidth;

    if (isCorrect) {
        card.textContent = '✓  Correct!';
        card.className   = 'card feedback-card is-correct';
        bumpCount('correct-count');
    } else {
        card.textContent = `✗  The answer is ${correctAnswer}`;
        card.className   = 'card feedback-card is-wrong';
        bumpCount('incorrect-count');
    }
}

function bumpCount(id) {
    const el = document.getElementById(id);
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 200);
}

function countdown() {
    if (!timerPaused) time--;
    if (time <= 0) { endPractice(); return; }

    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    const timerEl = document.getElementById('timer');
    timerEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    if (time <= 30) timerEl.classList.add('warning');
}

function updateResult() {
    document.getElementById('correct-count').textContent   = correctCount;
    document.getElementById('incorrect-count').textContent = incorrectCount;
}

function pausePractice()  { timerPaused = true; }

function resumePractice() {
    timerPaused = false;
    generateQuestion();
}

async function endPractice() {
    clearInterval(timer);
    practiceOngoing = false;

    document.getElementById('question-container').innerHTML = '';
    document.getElementById('timer').textContent = '0:00';

    const totalQ = correctCount + incorrectCount;
    const pct    = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const card   = document.getElementById('correct-answer-container');
    card.className   = 'card feedback-card is-done';
    card.textContent = `Session complete! ${correctCount}/${totalQ} correct (${pct}%)`;

    if (currentUser && sessionDurationMin > 0 && totalQ > 0) {
        const qPerMin = parseFloat((totalQ / sessionDurationMin).toFixed(2));
        await saveSession({
            date:        new Date().toISOString(),
            durationMin: sessionDurationMin,
            correct:     correctCount,
            incorrect:   incorrectCount,
            totalQ,
            qPerMin
        });
    }
}

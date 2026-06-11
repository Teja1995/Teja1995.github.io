let time, timer;
let correctCount = 0;
let incorrectCount = 0;
let practiceOngoing = false;
let timerPaused = false;
let sessionDurationMin = 0;

// ─── Tab routing ───────────────────────────────────────────────

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.remove('hidden');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    if (tabName === 'performance') loadPerformanceData();
    if (tabName === 'settings') refreshSettingsTab();
}

function refreshSettingsTab() {
    const saved = localStorage.getItem('geminiApiKey');
    if (saved) document.getElementById('gemini-key').value = saved;

    const badge = document.getElementById('key-current-badge');
    if (!badge) return;
    if (saved) {
        badge.textContent = '✓ API key is saved';
        badge.className = 'key-badge saved';
    } else {
        badge.textContent = '⚠ No key saved — worksheet checking is disabled';
        badge.className = 'key-badge missing';
    }
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// ─── Settings ──────────────────────────────────────────────────

function persistGeminiKey(key) {
    localStorage.setItem('geminiApiKey', key);
    // Also save to Firebase so it survives browser clears and works across devices
    if (currentUser) {
        db.ref('users/' + currentUser.uid + '/geminiKey').set(key)
            .catch(e => console.error('Could not save key to database:', e));
    }
}

function saveGeminiKey() {
    const key = document.getElementById('gemini-key').value.trim();
    const status = document.getElementById('key-status');

    if (!key || key.length < 10) {
        status.textContent = 'Please paste a valid API key.';
        status.className = 'key-status error';
        status.classList.remove('hidden');
        return;
    }

    persistGeminiKey(key);
    status.textContent = '✓ API key saved successfully.';
    status.className = 'key-status success';
    status.classList.remove('hidden');
    refreshSettingsTab();
}

function saveGeminiKeyFromOnboarding() {
    const key = document.getElementById('onboarding-key').value.trim();
    if (!key || key.length < 10) {
        document.getElementById('onboarding-error').classList.remove('hidden');
        return;
    }
    persistGeminiKey(key);
    closeModal('gemini-onboarding-modal');
    const settingsInput = document.getElementById('gemini-key');
    if (settingsInput) settingsInput.value = key;
    refreshSettingsTab();
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
    const card = document.getElementById('correct-answer-container');
    if (card) {
        card.textContent = `"${quote}"`;
        card.className = 'card feedback-card is-neutral';
    }
}

window.addEventListener('load', initializeQuote);

function startPractice() {
    if (practiceOngoing || correctCount > 0 || incorrectCount > 0) {
        if (!confirm("Starting a new session will reset your progress. Continue?")) return;
    }

    correctCount = 0;
    incorrectCount = 0;
    updateResult();

    const inputVal = parseInt(document.getElementById('timeInput').value);
    if (!inputVal || inputVal <= 0) {
        alert("Please enter a valid duration.");
        return;
    }

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

    const roll = Math.random();
    if (roll < 0.33) {
        generateArithmeticQuestion(container);
    } else if (roll < 0.67) {
        generateMultiplicationQuestion(container);
    } else {
        generatePercentageQuestion(container);
    }
}

function generateMultiplicationQuestion(container) {
    let num1, num2;
    do {
        num1 = Math.floor(Math.random() * 800) + 100;
        num2 = Math.floor(Math.random() * 8) + 2;
    } while (num1 % 100 === 0);
    displayQuestion(container, `${num1} × ${num2} = ?`, num1 * num2);
}

function generateArithmeticQuestion(container) {
    let num1, num2;
    do {
        num1 = Math.floor(Math.random() * 90) + 10;
        num2 = Math.floor(Math.random() * 90) + 10;
    } while (num1 === num2);

    const ops = ['+', '-', '×'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let questionText, answer;

    switch (op) {
        case '+': questionText = `${num1} + ${num2} = ?`; answer = num1 + num2; break;
        case '-':
            if (num1 < num2) [num1, num2] = [num2, num1];
            questionText = `${num1} - ${num2} = ?`;
            answer = num1 - num2;
            break;
        case '×': questionText = `${num1} × ${num2} = ?`; answer = num1 * num2; break;
    }

    displayQuestion(container, questionText, answer);
}

function generatePercentageQuestion(container) {
    let numerator, denominator;
    do {
        denominator = Math.floor(Math.random() * 15) + 2;
        numerator = Math.floor(Math.random() * (denominator * 2 - 1)) + 1;
    } while (numerator === denominator || numerator > denominator * 2);

    const answer = ((numerator / denominator) * 100).toFixed(2);
    displayQuestion(container, `${numerator} / ${denominator} as a percentage?`, answer);
}

function displayQuestion(container, questionText, correctAnswer) {
    const questionEl = document.createElement('p');
    questionEl.textContent = questionText;

    const answerInput = document.createElement('input');
    answerInput.type = 'text';
    answerInput.className = 'answer-input';
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
        card.className = 'card feedback-card is-correct';
        bumpCount('correct-count');
    } else {
        card.textContent = `✗  The answer is ${correctAnswer}`;
        card.className = 'card feedback-card is-wrong';
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

    if (time <= 0) {
        endPractice();
        return;
    }

    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    const timerEl = document.getElementById('timer');
    timerEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    if (time <= 30) timerEl.classList.add('warning');
}

function updateResult() {
    document.getElementById('correct-count').textContent = correctCount;
    document.getElementById('incorrect-count').textContent = incorrectCount;
}

function pausePractice() { timerPaused = true; }

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
    const pct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const card = document.getElementById('correct-answer-container');
    card.className = 'card feedback-card is-done';
    card.textContent = `Session complete! ${correctCount}/${totalQ} correct (${pct}%)`;

    if (currentUser && sessionDurationMin > 0 && totalQ > 0) {
        const qPerMin = parseFloat((totalQ / sessionDurationMin).toFixed(2));
        await saveSession({
            date: new Date().toISOString(),
            durationMin: sessionDurationMin,
            correct: correctCount,
            incorrect: incorrectCount,
            totalQ,
            qPerMin
        });
    }
}

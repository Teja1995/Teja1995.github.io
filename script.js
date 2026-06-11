let time, timer;
let correctCount = 0;
let incorrectCount = 0;
let practiceOngoing = false;
let timerPaused = false;

function initializeQuote() {
    const quotes = [
        "No matter how you feel, get up, dress up and never give up",
        "Believe you can and you're halfway there",
        "The only way to do great work is to love what you do",
        "Success is not final, failure is not fatal: it is the courage to continue that counts",
        "Push yourself, because no one else is going to do it for you",
        "Great things never come from comfort zones",
        "Dream it. Wish it. Do it.",
        "The harder you work for something, the greater you'll feel when you achieve it",
        "Don't stop when you're tired. Stop when you're done",
        "Wake up with determination. Go to bed with satisfaction",
        "Do something today that your future self will thank you for",
        "It's going to be hard, but hard does not mean impossible",
        "Don't wait for opportunity. Create it",
        "The key to success is to focus on goals, not obstacles",
    ];

    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    const feedbackCard = document.getElementById('correct-answer-container');
    feedbackCard.textContent = `"${quote}"`;
    feedbackCard.className = 'card feedback-card is-neutral';
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
        case '+':
            questionText = `${num1} + ${num2} = ?`;
            answer = num1 + num2;
            break;
        case '-':
            if (num1 < num2) [num1, num2] = [num2, num1];
            questionText = `${num1} - ${num2} = ?`;
            answer = num1 - num2;
            break;
        case '×':
            questionText = `${num1} × ${num2} = ?`;
            answer = num1 * num2;
            break;
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

    answerInput.addEventListener('keydown', function(event) {
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
    if (practiceOngoing && !timerPaused) {
        generateQuestion();
    }
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

    // Reset class to re-trigger animation
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

    if (time <= 30) {
        timerEl.classList.add('warning');
    }
}

function updateResult() {
    document.getElementById('correct-count').textContent = correctCount;
    document.getElementById('incorrect-count').textContent = incorrectCount;
}

function pausePractice() {
    timerPaused = true;
}

function resumePractice() {
    timerPaused = false;
    generateQuestion();
}

function endPractice() {
    clearInterval(timer);
    practiceOngoing = false;

    document.getElementById('question-container').innerHTML = '';
    document.getElementById('timer').textContent = '0:00';

    const total = correctCount + incorrectCount;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const card = document.getElementById('correct-answer-container');
    card.className = 'card feedback-card is-done';
    card.textContent = `Session complete! ${correctCount}/${total} correct (${pct}%)`;
}

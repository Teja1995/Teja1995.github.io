let time, timer, totalQuestions, correctAnswers, startTime;

function startPractice() {
    time = document.getElementById('timeInput').value * 60; // Convert minutes to seconds
    totalQuestions = 0;
    correctAnswers = 0;
    startTime = new Date().getTime();
    timer = setInterval(countdown, 1000);
    generateQuestion(); // Call generateQuestion immediately after starting the practice
}

function generateQuestion() {
    if (time <= 0) {
        endPractice();
        return;
    }

    const operators = ['+', '-', '*'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    let num1, num2;

    if (operator === '*') {
        num1 = getRandomNumber(99);
        num2 = getRandomNumber(12);
    } else {
        num1 = getRandomNumber(99);
        num2 = getRandomNumber(99);
    }

    const question = `${num1} ${operator} ${num2}`;
    const questionContainer = document.getElementById('question-container');
    questionContainer.innerHTML = `<p>Question ${totalQuestions + 1}: ${question} = ?</p>`;

    const answerInput = document.createElement('input');
    answerInput.type = 'text';
    questionContainer.appendChild(answerInput);

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit Answer';
    submitButton.onclick = function () {
        const userAnswer = parseInt(answerInput.value);
        if (!isNaN(userAnswer)) {
            const answer = calculateAnswer(num1, num2, operator);
            checkAnswer(userAnswer, answer);
            generateQuestion();
        }
    };
    questionContainer.appendChild(submitButton);
}

function checkAnswer(userAnswer, correctAnswer) {
    totalQuestions++;
    if (userAnswer === correctAnswer) {
        correctAnswers++;
    }
}

function endPractice() {
    clearInterval(timer);

    // Check if the user has attempted at least one question
    if (totalQuestions > 0) {
        const endTime = new Date().getTime();
        const totalTime = (endTime - startTime) / 1000; // Convert milliseconds to seconds
        const averageTimePerQuestion = totalTime / totalQuestions;

        const resultContainer = document.getElementById('result-container');
        resultContainer.innerHTML = `
            <p>Total Questions: ${totalQuestions}</p>
            <p>Correct Answers: ${correctAnswers}</p>
            <p>Incorrect Answers: ${totalQuestions - correctAnswers}</p>
            <p>Average Time Per Question: ${averageTimePerQuestion.toFixed(2)} seconds</p>
        `;
    } else {
        // If no questions were attempted, provide a message
        const resultContainer = document.getElementById('result-container');
        resultContainer.innerHTML = `
            <p>No questions were attempted.</p>
            <p>Press the button below to start a new practice session.</p>
            <button onclick="resetPractice()">Start New Practice</button>
        `;
    }

    // Reset question container
    const questionContainer = document.getElementById('question-container');
    questionContainer.innerHTML = '';
}

function resetPractice() {
    document.getElementById('result-container').innerHTML = ''; // Clear previous results
    startPractice(); // Start a new practice session
}

function countdown() {
    time--;

    if (time <= 0 && totalQuestions > 0) {
        endPractice();
    } else {
        const timerDisplay = document.getElementById('timer');
        timerDisplay.textContent = `Time Remaining: ${formatTime(time)}`;
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function getRandomNumber(max) {
    return Math.floor(Math.random() * (max + 1));
}

function calculateAnswer(num1, num2, operator) {
    switch (operator) {
        case '+':
            return num1 + num2;
        case '-':
            return num1 - num2;
        case '*':
            return num1 * num2;
        default:
            return NaN; // Handle unsupported operators
    }
        }
        

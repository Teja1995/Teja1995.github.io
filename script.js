let time, timer, totalQuestions, correctAnswers, startTime;

function startPractice() {
    time = 60; // Set a fixed time for testing (in seconds)
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

    const questionContainer = document.getElementById('question-container');
    questionContainer.innerHTML = '<p>Question: 2 + 2 = ?</p>';

    const answerInput = document.createElement('input');
    answerInput.type = 'text';
    questionContainer.appendChild(answerInput);

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit Answer';
    submitButton.onclick = function () {
        const userAnswer = parseInt(answerInput.value);
        if (!isNaN(userAnswer)) {
            const answer = 4; // Correct answer for testing
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

    const endTime = new Date().getTime();
    const totalTime = (endTime - startTime) / 1000; // Convert milliseconds to seconds
    const averageTimePerQuestion = totalQuestions > 0 ? totalTime / totalQuestions : 0;

    const resultContainer = document.getElementById('result-container');
    resultContainer.innerHTML = `
        <p>Total Questions: ${totalQuestions}</p>
        <p>Correct Answers: ${correctAnswers}</p>
        <p>Incorrect Answers: ${totalQuestions - correctAnswers}</p>
        <p>Average Time Per Question: ${averageTimePerQuestion.toFixed(2)} seconds</p>
    `;
}

function countdown() {
    time--;

    if (time <= 0) {
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

startPractice(); // Test the startPractice function immediately on page load

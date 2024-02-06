let time, timer;

function startPractice() {
    time = parseInt(document.getElementById('timeInput').value) * 60; // Convert minutes to seconds
    timer = setInterval(countdown, 1000);
    generateQuestion(); // Call generateQuestion immediately after starting the practice
}

function generateQuestion() {
    if (time <= 0) {
        endPractice();
        return;
    }

    const questionContainer = document.getElementById('question-container');
    questionContainer.innerHTML = '<p>Question: 2 + 2 = ?</p>'; // Placeholder question

    // Implement actual question generation logic here
}

function endPractice() {
    clearInterval(timer);
    // Implement logic to display results here
}

function countdown() {
    time--;

    if (time <= 0) {
        endPractice();
    } else {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        const timerDisplay = document.getElementById('timer');
        timerDisplay.textContent = `Time Remaining: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
}

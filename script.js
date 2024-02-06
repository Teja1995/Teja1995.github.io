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
    questionContainer.innerHTML = ''; // Clear previous question

    const num1 = Math.floor(Math.random() * 10) + 1; // Generate random numbers between 1 and 10
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operator = ['+', '-', '×'][Math.floor(Math.random() * 3)]; // Randomly select an operator

    let question;
    let correctAnswer;

    switch (operator) {
        case '+':
            question = `${num1} + ${num2} = `;
            correctAnswer = num1 + num2;
            break;
        case '-':
            question = `${num1 + num2} - ${num2} = `;
            correctAnswer = num1;
            break;
        case '×':
            question = `${num1} × ${num2} = `;
            correctAnswer = num1 * num2;
            break;
        default:
            break;
    }

    const questionElement = document.createElement('p');
    questionElement.textContent = `Question: ${question}`;

    const answerInput = document.createElement('input');
    answerInput.type = 'text';

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit Answer';
    submitButton.onclick = function () {
        const userAnswer = parseInt(answerInput.value);
        if (!isNaN(userAnswer)) {
            checkAnswer(userAnswer, correctAnswer);
            generateQuestion();
        }
    };

    questionContainer.appendChild(questionElement);
    questionContainer.appendChild(answerInput);
    questionContainer.appendChild(submitButton);
}

function checkAnswer(userAnswer, correctAnswer) {
    if (userAnswer === correctAnswer) {
        alert('Correct!');
    } else {
        alert('Incorrect!');
    }
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

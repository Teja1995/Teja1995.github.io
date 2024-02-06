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
    const questionElement = document.createElement('p');
    questionElement.textContent = `Question ${totalQuestions + 1}: ${question} = ?`;
    questionContainer.appendChild(questionElement);

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
            questionContainer.removeChild(questionElement);
            questionContainer.removeChild(answerInput);
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

    if (time <= 0) {
        endPractice();
    }
}

function endPractice() {
    clearInterval(timer);
    const endTime = new Date().getTime();
    const totalTime = (endTime - startTime) / 1000; // Convert milliseconds to seconds
    const averageTimePerQuestion = totalTime / totalQuestions;
    const averageTimePerAddition = 0; // Placeholder for future implementation
    const averageTimePerSubtraction = 0; // Placeholder for future implementation
    const averageTimePerMultiplication = 0; // Placeholder for future implementation

    const resultContainer = document.getElementById('result-container');
    resultContainer.innerHTML = `
        <p>Total Questions: ${totalQuestions}</p>
        <p>Correct Answers: ${correctAnswers}</p>
        <p>Incorrect Answers: ${totalQuestions - correctAnswers}</p>
        <p>Average Time Per Question: ${averageTimePerQuestion.toFixed(2)} seconds</p>
        <p>Average Time Per Addition Question: ${averageTimePerAddition.toFixed(2)} seconds</p>
        <p>Average Time Per Subtraction Question: ${averageTimePerSubtraction.toFixed(2)} seconds</p>
        <p>Average Time Per Multiplication Question: ${averageTimePerMultiplication.toFixed(2)} seconds</p>
    `;
}

function countdown() {
    time--;
    if (time <= 0) {
        endPractice();
    }
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

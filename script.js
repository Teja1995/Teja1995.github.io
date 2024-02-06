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
    const userAnswer = prompt(`Question ${totalQuestions + 1}: ${question} = ?`);

    if (userAnswer !== null) {
        const answer = calculateAnswer(num1, num2, operator);
        checkAnswer(parseInt(userAnswer), answer);
    }
}

function checkAnswer(userAnswer, correctAnswer) {
    totalQuestions++;
    if (userAnswer === correctAnswer) {
        correctAnswers++;
    }

    if (time <= 0) {
        endPractice();
    } else {
        generateQuestion();
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

    alert(`
        Practice Summary:
        - Total Questions: ${totalQuestions}
        - Correct Answers: ${correctAnswers}
        - Incorrect Answers: ${totalQuestions - correctAnswers}
        - Average Time Per Question: ${averageTimePerQuestion.toFixed(2)} seconds
        - Average Time Per Addition Question: ${averageTimePerAddition.toFixed(2)} seconds
        - Average Time Per Subtraction Question: ${averageTimePerSubtraction.toFixed(2)} seconds
        - Average Time Per Multiplication Question: ${averageTimePerMultiplication.toFixed(2)} seconds
    `);
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

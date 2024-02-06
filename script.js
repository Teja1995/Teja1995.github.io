let time, timer;
let correctCount = 0;
let incorrectCount = 0;
let practiceOngoing = false;
let timerPaused = false;

// Function to start the practice session
function startPractice() {
    if (practiceOngoing || (correctCount > 0 || incorrectCount > 0)) {
        const confirmation = confirm("Starting a new practice session will reset your progress. Are you sure you want to continue?");
        if (!confirmation) return;
    }

    // Reset correct and incorrect counts
    correctCount = 0;
    incorrectCount = 0;
    updateResult(); // Update result display

    // Start practice session
    time = parseInt(document.getElementById('timeInput').value) * 60; // Convert minutes to seconds
    timer = setInterval(countdown, 1000);
    practiceOngoing = true;
    generateQuestion(); // Call generateQuestion immediately after starting the practice
}

// Function to generate a question
function generateQuestion() {
    if (!practiceOngoing) return; // Check if practice is ongoing
    const questionContainer = document.getElementById('question-container');
    questionContainer.innerHTML = ''; // Clear previous question

    // Generate two random numbers between 1 and 10
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;

    // Generate a random operator (+, -, *)
    const operators = ['+', '-', '×']; // Using '×' for multiplication symbol
    const operator = operators[Math.floor(Math.random() * operators.length)];

    let questionText, correctAnswer;

    // Construct the question text and calculate the correct answer
    switch (operator) {
        case '+':
            questionText = `${num1} + ${num2} = `;
            correctAnswer = num1 + num2;
            break;
        case '-':
            questionText = `${num1 + num2} - ${num2} = `;
            correctAnswer = num1;
            break;
        case '×':
            questionText = `${num1} × ${num2} = `;
            correctAnswer = num1 * num2;
            break;
        default:
            break;
    }

    // Create HTML elements to display the question and answer input field
    const questionElement = document.createElement('p');
    questionElement.textContent = `Question: ${questionText}`;

    const answerInput = document.createElement('input');
    answerInput.type = 'text';
    answerInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            submitAnswer(answerInput, correctAnswer);
        }
    });

    // Append the question and answer elements to the question container
    questionContainer.appendChild(questionElement);
    questionContainer.appendChild(answerInput);

    answerInput.focus(); // Focus on the answer input field
}

// Function to submit the answer
function submitAnswer(answerInput, correctAnswer) {
    const userAnswer = parseInt(answerInput.value);
    if (!isNaN(userAnswer)) {
        checkAnswer(userAnswer, correctAnswer);
        if (practiceOngoing) {
            generateQuestion(); // Update question after checking answer if practice ongoing
            answerInput.focus(); // Focus back on the answer input field
        }
    }
}

// Function to check the user's answer
function checkAnswer(userAnswer, correctAnswer) {
    if (userAnswer === correctAnswer) {
        correctCount++;
    } else {
        incorrectCount++;
    }
    updateResult(); // Update the result display
}

// Function to handle the countdown timer
function countdown() {
    if (!timerPaused) {
        time--;
    }

    if (time <= 0) {
        endPractice();
    } else {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        const timerDisplay = document.getElementById('timer');
        timerDisplay.textContent = `Time Remaining: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
}

// Function to update the result display
function updateResult() {
    const resultContainer = document.getElementById('result-container');
    resultContainer.innerHTML = `
        <p>Correct Answers: ${correctCount}</p>
        <p>Incorrect Answers: ${incorrectCount}</p>
    `;
}

// Function to pause the practice session
function pausePractice() {
    timerPaused = true;
}

// Function to resume the practice session
function resumePractice() {
    timerPaused = false;
}

// Function to end the practice session
function endPractice() {
    clearInterval(timer);
    practiceOngoing = false; // Set practiceOngoing to false when practice ends
    // Implement logic to display results here
}

// script.js
const questionElement = document.getElementById('question');
const answerElement = document.getElementById('answer');
const resultElement = document.getElementById('result');


let time, timer;
let correctCount = 0;
let incorrectCount = 0;
let practiceOngoing = false;
let timerPaused = false;

function initializeQuote() {
    const quotes = [
        "No matter how you feel, Get up, Dress up and never give up",
        "Believe you can and you're halfway there",
        "The only way to do great work is to love what you do",
        "Success is not final, failure is not fatal: It is the courage to continue that counts",
        "Your limitation—it's only your imagination",
        "Push yourself, because no one else is going to do it for you",
        "Great things never come from comfort zones",
        "Dream it. Wish it. Do it.",
        "Success doesn’t just find you. You have to go out and get it",
        "The harder you work for something, the greater you’ll feel when you achieve it",
        "Dream bigger. Do bigger",
        "Don’t stop when you’re tired. Stop when you’re done",
        "Wake up with determination. Go to bed with satisfaction",
        "Do something today that your future self will thank you for",
        "Little things make big days",
        "It’s going to be hard, but hard does not mean impossible",
        "Don’t wait for opportunity. Create it",
        "Sometimes we’re tested not to show our weaknesses, but to discover our strengths",
        "The key to success is to focus on goals, not obstacles",
        "Dream it. Believe it. Build it",
        "The only limit is your mind",
        "Push yourself, because no one else is going to do it for you",
        "You don’t get what you wish for. You get what you work for",
        "The harder you work for something, the greater you’ll feel when you achieve it",
        "Wake up with determination. Go to bed with satisfaction",
        "It’s going to be hard, but hard does not mean impossible",
        "Success doesn’t just find you. You have to go out and get it",
        "Dream bigger. Do bigger",
        "Don’t stop when you’re tired. Stop when you’re done",
        "The key to success is to focus on goals, not obstacles",
        "The only limit is your mind",
    ];

    const randomIndex = Math.floor(Math.random() * quotes.length);
    const randomQuote = quotes[randomIndex];

    const correctAnswerContainer = document.getElementById('correct-answer-container');
    correctAnswerContainer.textContent = randomQuote;;
}

window.addEventListener('load', initializeQuote);


// Call the initialization function when the page loads
window.onload = initialize;

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
    console.log('Generating question...'); // Debugging line
    if (!practiceOngoing) return; // Check if practice is ongoing
    const questionContainer = document.getElementById('question-container');
    questionContainer.innerHTML = ''; // Clear previous question

    const questionType = Math.random(); // Randomly select question type

    if (questionType < 0.33) {
        generateArithmeticQuestion(questionContainer);
    } else if (questionType < 0.67) {
        generateMultiplicationQuestion(questionContainer);
    } else {
        generatePercentageQuestion(questionContainer);
    }
}

// Function to generate a multiplication question
function generateMultiplicationQuestion(questionContainer) {
    let num1, num2;
    do {
        num1 = Math.floor(Math.random() * 800) + 100; // Random three-digit number not multiple of 100
        num2 = Math.floor(Math.random() * 8) + 2; // Random single-digit number between 2 and 9
    } while (num1 % 100 === 0); // Ensure num1 is not a multiple of 100

    const questionText = `${num1} × ${num2} = `;
    const correctAnswer = num1 * num2;

    // Display the multiplication question
    displayQuestion(questionContainer, questionText, correctAnswer);
}




// Function to generate an arithmetic question
function generateArithmeticQuestion(questionContainer) {
    let num1, num2;
    do {
        // Generate two random numbers between 10 and 99
        num1 = Math.floor(Math.random() * 90) + 10;
        num2 = Math.floor(Math.random() * 90) + 10;
    } while (num1 === num2); // Ensure num1 and num2 are not equal

    // Generate a random operator (+, -, *)
    const operators = ['+', '-', '×']; // Using '×' for multiplication symbol
    const operator = operators[Math.floor(Math.random() * operators.length)];

    let questionText, correctAnswer, userAnswer;

    // Construct the question text and calculate the correct answer
    switch (operator) {
        case '+':
            questionText = `${num1} + ${num2} = `;
            correctAnswer = num1 + num2;
            break;
        case '-':
            // Ensure num1 is greater than num2 to avoid negative results
            if (num1 < num2) {
                [num1, num2] = [num2, num1]; // Swap num1 and num2
            }
            questionText = `${num1} - ${num2} = `;
            correctAnswer = num1 - num2;
            break;
        case '×':
            questionText = `${num1} × ${num2} = `;
            correctAnswer = num1 * num2;
            break;
        default:
            break;
    }

    // Display the arithmetic question
    displayQuestion(questionContainer, questionText, correctAnswer);
}


// Function to generate a percentage question
function generatePercentageQuestion(questionContainer) {
    let numerator, denominator;
    let questionText, correctAnswer;
    do {
        denominator = Math.floor(Math.random() * 15) + 2; // Random number between 2 and 16
        numerator = Math.floor(Math.random() * (denominator * 2 - 1)) + 1; // Random number between 1 and 2 times the denominator
    } while (numerator === denominator || numerator > denominator * 2); // Ensure numerator is not the same as denominator and not more than twice the denominator

    questionText = `What is ${numerator}/${denominator} as a percentage?`;
    correctAnswer = ((numerator / denominator) * 100).toFixed(2); // Round off to two decimal places

    // Display the percentage question
    displayQuestion(questionContainer, questionText, correctAnswer);
}






// Function to display a question
function displayQuestion(questionContainer, questionText, correctAnswer) {
    // Create HTML elements to display the question and answer input field
    const questionElement = document.createElement('p');
    questionElement.textContent = `Question: ${questionText}`;

    const answerInput = document.createElement('input');
    answerInput.type = 'text';

    // Append the question and answer elements to the question container
    questionContainer.appendChild(questionElement);
    questionContainer.appendChild(answerInput);

    answerInput.focus(); // Focus on the answer input field

    // Set up event listener for submitting answer
    answerInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission
            submitAnswer(answerInput, correctAnswer);
        }
    });

    console.log('Event listener attached'); // Debugging line
}


function submitAnswer(answerInput, correctAnswer) {
    console.log('Submitting answer...'); // Debugging line
    const userAnswer = parseFloat(answerInput.value);
    if (!isNaN(userAnswer)) {
        checkAnswer(userAnswer, correctAnswer);
        if (practiceOngoing && !timerPaused) {
            console.log('Generating new question...'); // Debugging line
            generateQuestion(); // Update question after checking answer if practice ongoing and not paused
            answerInput.focus(); // Focus back on the answer input field
        }
    }
}



function checkAnswer(userAnswer, correctAnswer) {
    if (practiceOngoing && !timerPaused) {
        const userNumericAnswer = parseFloat(userAnswer);
        const correctNumericAnswer = parseFloat(correctAnswer);
        const roundedUserAnswer = Math.round(userNumericAnswer * 100) / 100; // Round to two decimal places
        const roundedCorrectAnswer = Math.round(correctNumericAnswer * 100) / 100; // Round to two decimal places
        if (!isNaN(userNumericAnswer) && roundedUserAnswer === roundedCorrectAnswer) {
            correctCount++;
            resultElement.textContent = 'Correct! 🎉';
            displayCorrectAnswer(true, ''); // Pass an empty string as correct answer
        } else {
            incorrectCount++;
            resultElement.textContent = 'Incorrect.';
            displayCorrectAnswer(false, correctAnswer); // Pass the correct answer for incorrect response
        }
        updateResult(); // Update the result display only if not paused
    }
}




// Function to display the correct answer or correctness message
function displayCorrectAnswer(isCorrect, correctAnswer) {
    const correctAnswerContainer = document.getElementById('correct-answer-container');
    correctAnswerContainer.innerHTML = ''; // Clear the container first

    if (isCorrect) {
        correctAnswerContainer.textContent = 'Correct! 🎉';
    } else {
        correctAnswerContainer.textContent = `Incorrect. The correct answer is: ${correctAnswer}`;
    }
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
    generateQuestion(); // Generate a new question upon resuming
}

// Function to end the practice session
function endPractice() {
    clearInterval(timer);
    practiceOngoing = false; // Set practiceOngoing to false when practice ends
    // Implement logic to display results here
}

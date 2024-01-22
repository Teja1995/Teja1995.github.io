let currentLevel = 1; // Default level

function generateQuestion() {
    let operators, operator, num1, num2;

    if (currentLevel === 1) {
        // Level 1: Two-digit addition and subtraction, limited multiplication, and single-digit division
        operators = ['+', '-', '*', '/'];
        operator = operators[Math.floor(Math.random() * 2)]; // Either addition or subtraction
        num1 = getRandomNumber(99);
        num2 = getRandomNumber(99);
        
        if (operator === '*') {
            // Limit multiplication to the multiplicand not exceeding 12
            num1 = getRandomNumber(12);
            num2 = getRandomNumber(9); // One digit multiplier
        } else if (operator === '/') {
            // Single-digit divisor for division
            num1 = num1 * num2;
            num2 = getRandomNumber(9) + 1; // Avoid division by zero
        }
    } else {
        // For other levels, use a broader range
        operators = ['+', '-', '*', '/'];
        operator = operators[Math.floor(Math.random() * operators.length)];
        num1 = getRandomNumber();
        num2 = getRandomNumber();
    }

    const question = `${num1} ${operator} ${num2}`;

    const questionContainer = document.getElementById('question-container');
    questionContainer.innerHTML = `<p>${question} = ?</p><button onclick="revealAnswer(${num1}, ${num2}, '${operator}')">Reveal Answer</button>`;
}

function revealAnswer(num1, num2, operator) {
    const answer = calculateAnswer(num1, num2, operator);
    const questionContainer = document.getElementById('question-container');
    questionContainer.innerHTML += `<p class="answer">Answer: ${answer}</p>`;
}

function getRandomNumber(max = 999) {
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
        case '/':
            return num1 / num2;
        default:
            return NaN; // Handle unsupported operators
    }
}

function changeLevel(level) {
    currentLevel = level;
    // Additional logic for changing levels can be added here
}

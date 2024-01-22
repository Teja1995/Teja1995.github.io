function generateQuestion() {
    const operators = ['+', '*', '/', '%'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let num1 = getRandomNumber();
    let num2 = getRandomNumber();

    if (operator === '/' && num1 % num2 !== 0) {
        // Ensure division results in a whole number
        num1 = num2 * getRandomNumber(5) + 1;
    }

    const question = `${num1} ${operator} ${num2}`;
    const answer = calculateAnswer(num1, num2, operator);

    const questionContainer = document.getElementById('question-container');
    questionContainer.innerHTML = `<p>${question} = ?</p><p>Answer: ${answer}</p>`;
}

function getRandomNumber(max = 999) {
    return Math.floor(Math.random() * (max + 1));
}

function calculateAnswer(num1, num2, operator) {
    switch (operator) {
        case '+':
            return num1 + num2;
        case '*':
            return num1 * num2;
        case '/':
            return num1 / num2;
        case '%':
            return (num1 * num2) / 100;
        default:
            return NaN; // Handle unsupported operators
    }
}
    

function generateQuestion() {
    const operators = ['+', '*', '/'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let num1 = Math.floor(Math.random() * 10) + 1;
    let num2 = Math.floor(Math.random() * 10) + 1;

    if (operator === '/' && num1 % num2 !== 0) {
        // Ensure division results in a whole number
        num1 = num2 * Math.floor(Math.random() * 5) + 1;
    }

    const question = `${num1} ${operator} ${num2}`;
    const answer = eval(question); // Evaluate the expression to get the answer

    const questionContainer = document.getElementById('question-container');
    questionContainer.innerHTML = `<p>${question} = ?</p><p>Answer: ${answer}</p>`;
}

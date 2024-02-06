function startPractice() {
    alert('Start Practice button clicked!');
    time = parseInt(document.getElementById('timeInput').value) * 60; // Convert minutes to seconds
    timer = setInterval(countdown, 1000);
    generateQuestion(); // Call generateQuestion immediately after starting the practice
}

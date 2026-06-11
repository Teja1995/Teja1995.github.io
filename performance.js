let performanceChart = null;
let sessionToDelete = null;
let allSessions = [];

function sessionsRef() {
    return db.ref('sessions/' + currentUser.uid + '/records');
}

// ─── Load & render ─────────────────────────────────────────────

async function loadPerformanceData() {
    if (!currentUser) return;

    try {
        const snapshot = await sessionsRef().orderByChild('date').once('value');
        allSessions = [];
        snapshot.forEach(child => {
            allSessions.push({ id: child.key, ...child.val() });
        });

        renderChart(allSessions);
        renderHistoryTable(allSessions);
    } catch (err) {
        console.error('Error loading sessions:', err);
    }
}

function renderChart(sessions) {
    const canvas = document.getElementById('performance-chart');
    const emptyMsg = document.getElementById('chart-empty');
    if (!canvas) return;

    if (sessions.length === 0) {
        emptyMsg.classList.remove('hidden');
        canvas.style.display = 'none';
        if (performanceChart) { performanceChart.destroy(); performanceChart = null; }
        return;
    }

    emptyMsg.classList.add('hidden');
    canvas.style.display = 'block';

    if (performanceChart) performanceChart.destroy();

    const labels = sessions.map(s =>
        new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    );
    const dataPoints = sessions.map(s => s.qPerMin || 0);

    performanceChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Questions per minute',
                data: dataPoints,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99,102,241,0.1)',
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#6366f1',
                pointRadius: 5,
                pointHoverRadius: 8,
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        afterBody(items) {
                            const s = sessions[items[0].dataIndex];
                            return [
                                `Correct: ${s.correct}`,
                                `Wrong: ${s.incorrect}`,
                                `Duration: ${s.durationMin} min`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#64748b' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#64748b' },
                    beginAtZero: true,
                    title: { display: true, text: 'Q / min', color: '#64748b' }
                }
            }
        }
    });
}

function renderHistoryTable(sessions) {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No sessions yet. Complete a practice session to see history.</td></tr>';
        return;
    }

    const sorted = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(s => {
        const tr = document.createElement('tr');
        const date = new Date(s.date).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
        tr.innerHTML = `
            <td>${date}</td>
            <td>${s.durationMin} min</td>
            <td class="cell-correct">${s.correct}</td>
            <td class="cell-wrong">${s.incorrect}</td>
            <td>${(s.qPerMin || 0).toFixed(1)}</td>
            <td><button class="delete-row-btn" onclick="promptDeleteSession('${s.id}')">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// ─── Save session (called from script.js after practice ends) ──

async function saveSession(sessionData) {
    if (!currentUser) return;

    try {
        await sessionsRef().push(sessionData);
        await loadPerformanceData();
    } catch (err) {
        console.error('Error saving session:', err);
    }
}

// ─── Add session manually ──────────────────────────────────────

function showAddSessionModal() {
    document.getElementById('ms-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('ms-duration').value = '';
    document.getElementById('ms-correct').value = '';
    document.getElementById('ms-incorrect').value = '';
    document.getElementById('add-session-modal').classList.remove('hidden');
}

async function addSessionManually() {
    const dateStr = document.getElementById('ms-date').value;
    const durationMin = parseInt(document.getElementById('ms-duration').value);
    const correct = parseInt(document.getElementById('ms-correct').value) || 0;
    const incorrect = parseInt(document.getElementById('ms-incorrect').value) || 0;

    if (!dateStr || !durationMin || durationMin <= 0) {
        alert('Please fill in a valid date and duration.');
        return;
    }

    const totalQ = correct + incorrect;
    const qPerMin = parseFloat((totalQ / durationMin).toFixed(2));

    await saveSession({
        date: new Date(dateStr).toISOString(),
        durationMin,
        correct,
        incorrect,
        totalQ,
        qPerMin
    });

    closeModal('add-session-modal');
}

// ─── Delete session ────────────────────────────────────────────

function promptDeleteSession(id) {
    sessionToDelete = id;
    document.getElementById('delete-session-modal').classList.remove('hidden');
}

async function confirmDeleteSession() {
    if (!sessionToDelete || !currentUser) return;

    try {
        await sessionsRef().child(sessionToDelete).remove();
        sessionToDelete = null;
        closeModal('delete-session-modal');
        await loadPerformanceData();
    } catch (err) {
        alert('Error deleting session: ' + err.message);
    }
}

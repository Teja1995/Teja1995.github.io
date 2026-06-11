let selectedFileData = null;

// ─── Drag-and-drop wiring ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const zone = document.getElementById('upload-zone');
    if (!zone) return;

    zone.addEventListener('dragover', e => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    });
});

// ─── File selection ────────────────────────────────────────────

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) processFile(file);
}

async function processFile(file) {
    selectedFileData = null;
    document.getElementById('check-btn').disabled = true;

    document.getElementById('file-name-display').textContent = file.name;
    document.getElementById('file-preview').classList.remove('hidden');
    document.getElementById('upload-results').classList.add('hidden');

    const imgPreview = document.getElementById('image-preview');
    const pdfCanvas = document.getElementById('pdf-canvas');
    imgPreview.classList.add('hidden');
    pdfCanvas.classList.add('hidden');

    try {
        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const base64 = await renderPDFToBase64(arrayBuffer);
            selectedFileData = { base64, mimeType: 'image/jpeg' };
            pdfCanvas.classList.remove('hidden');
        } else {
            const dataUrl = await readImageAsDataUrl(file);
            selectedFileData = { base64: dataUrl.split(',')[1], mimeType: file.type };
            imgPreview.src = dataUrl;
            imgPreview.classList.remove('hidden');
        }
        document.getElementById('check-btn').disabled = false;
    } catch (err) {
        alert('Could not read file: ' + err.message);
    }
}

async function renderPDFToBase64(arrayBuffer) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.getElementById('pdf-canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

function readImageAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function removeFile() {
    selectedFileData = null;
    document.getElementById('file-preview').classList.add('hidden');
    document.getElementById('upload-results').classList.add('hidden');
    document.getElementById('worksheet-input').value = '';
    document.getElementById('check-btn').disabled = true;
}

// ─── Worksheet checking ────────────────────────────────────────

async function checkWorksheet() {
    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey) {
        alert('Please set your Gemini API key in the Settings tab first.');
        showTab('settings');
        return;
    }

    if (!selectedFileData) return;

    document.getElementById('upload-loading').classList.remove('hidden');
    document.getElementById('upload-results').classList.add('hidden');
    document.getElementById('check-btn').disabled = true;

    try {
        const results = await analyzeWithGemini(selectedFileData, apiKey);
        displayWorksheetResults(results);
    } catch (err) {
        alert('Error checking worksheet: ' + err.message);
    } finally {
        document.getElementById('upload-loading').classList.add('hidden');
        document.getElementById('check-btn').disabled = false;
    }
}

async function analyzeWithGemini({ base64, mimeType }, apiKey) {
    const prompt =
        `This is a math worksheet with a student's handwritten answers.
For each visible math question on the worksheet:
1. Extract the exact question text (e.g. "24 + 37 = ")
2. Extract the student's written answer
3. Calculate the correct answer yourself
4. Determine if the student's answer is correct (for percentages allow up to 0.01 rounding difference)

Return ONLY a valid JSON array — no markdown fences, no explanation:
[{"question":"...","studentAnswer":"...","correctAnswer":"...","isCorrect":true}]

If you cannot clearly read a question or answer, set that field to "unreadable".`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: mimeType, data: base64 } }
                    ]
                }],
                generationConfig: { temperature: 0.1 }
            })
        }
    );

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Could not parse AI response. Try again.');

    return JSON.parse(match[0]);
}

// ─── Results rendering ─────────────────────────────────────────

function displayWorksheetResults(results) {
    const tbody = document.getElementById('results-tbody');
    tbody.innerHTML = '';

    let correct = 0, wrong = 0;

    results.forEach((r, i) => {
        if (r.isCorrect) correct++; else wrong++;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${esc(r.question)}</td>
            <td>${esc(String(r.studentAnswer))}</td>
            <td>${esc(String(r.correctAnswer))}</td>
            <td class="${r.isCorrect ? 'result-correct' : 'result-wrong'}">${r.isCorrect ? '✓' : '✗'}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('results-correct-count').textContent = `✓ ${correct} correct`;
    document.getElementById('results-wrong-count').textContent = `✗ ${wrong} wrong`;
    document.getElementById('upload-results').classList.remove('hidden');
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

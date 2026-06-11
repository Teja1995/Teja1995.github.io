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

// ─── Worksheet prompt (shared across all models) ───────────────

const WORKSHEET_PROMPT =
`You are an answer-CHECKER, not an answer-GIVER. Your only job is to read what a student physically wrote on a worksheet, then verify whether it is correct. You must NEVER supply, invent, or compute an answer the student did not write.

⚠ GOLDEN RULE: If the answer space after = is empty (no handwriting visible), you MUST set studentAnswer to "blank" and isCorrect to false. No exceptions.

THE WORKSHEET FORMAT:
Problems are printed on the page in this format:   NUMBER [operator] NUMBER = ______
The underscored/blank space after = is where the student handwrites their answer.
Problems are arranged in columns (typically 4 columns). Read column by column, left to right, top to bottom within each column. Each problem is on exactly one row — do NOT borrow numbers from adjacent rows.

HOW TO IDENTIFY THE STUDENT'S ANSWER:
- Look ONLY at the space immediately after the = sign on that problem's line.
- If you see handwriting there → that is studentAnswer.
- If the space is empty, blank, or only has the printed underline → studentAnswer is "blank".
- NEVER use a number from the next printed question as the current answer.
- NEVER compute the correct answer and write it as if the student wrote it.

HOW TO SET isCorrect:
- isCorrect is true ONLY IF: (a) the student actually wrote something (not "blank" or "unreadable") AND (b) what they wrote equals the mathematically correct answer.
- isCorrect is false if studentAnswer is "blank", "unreadable", or mathematically wrong.
- For decimals/percentages allow up to 0.01 rounding difference.

FOR EACH PROBLEM:
1. Read the printed question (e.g. 31 + 29).
2. Look at the answer space after = — is there handwriting? If yes, transcribe it. If no, write "blank".
3. Calculate the correct answer yourself (this goes in correctAnswer).
4. Set isCorrect according to the rule above.

Return ONLY a valid JSON array — no markdown, no code fences, no extra text:
[{"question":"31 + 29","studentAnswer":"60","correctAnswer":"60","isCorrect":true}]

If you cannot read the handwriting, set studentAnswer to "unreadable" and isCorrect to false.
If the entire sheet appears unanswered, every studentAnswer must be "blank" and every isCorrect must be false.`;

// ─── Per-format API callers ────────────────────────────────────

async function callGeminiAPI(model, base64, mimeType, apiKey) {
    const response = await fetch(`${model.endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: WORKSHEET_PROMPT },
                    { inline_data: { mime_type: mimeType, data: base64 } }
                ]
            }],
            generationConfig: { temperature: 0.1 }
        })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseAIJSON(text);
}

async function callOpenAICompatAPI(model, base64, mimeType, apiKey) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };
    // OpenRouter requires these headers to comply with their usage policy
    if (model.endpoint.includes('openrouter')) {
        headers['HTTP-Referer'] = 'https://teja1995.github.io';
        headers['X-Title'] = 'Math Speed Trainer';
    }
    const response = await fetch(model.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: model.modelId,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: WORKSHEET_PROMPT },
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
                ]
            }],
            temperature: 0.1
        })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return parseAIJSON(text);
}

function parseAIJSON(text) {
    // Strip all markdown fences (```json ... ``` or ``` ... ```)
    const stripped = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();

    // Use a specific pattern: array of objects [ { … } ] rather than any [ … ]
    // This avoids matching things like "[note: 4 columns]" that appear before the real array
    const match = stripped.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!match) {
        console.error('[worksheet] No JSON object-array found. Raw model output:', text.slice(0, 500));
        throw new Error('The AI did not return a recognisable answer list. Try again.');
    }

    let j = match[0];

    // Pass 1 – direct parse (happy path)
    try { return JSON.parse(j); } catch {}

    // Pass 2 – strip trailing commas before ] or }  (most common Groq/OpenRouter issue)
    try { return JSON.parse(j.replace(/,\s*([}\]])/g, '$1')); } catch {}

    // Pass 3 – truncate to last fully-closed object (handles cut-off responses)
    try {
        const last = j.lastIndexOf('}');
        if (last > 0) {
            const truncated = j.slice(0, last + 1) + ']';
            const parsed = JSON.parse(truncated.replace(/,\s*([}\]])/g, '$1'));
            if (parsed.length > 0) return parsed;
        }
    } catch {}

    // Pass 4 – model used single quotes instead of double quotes
    try {
        const dq = j
            .replace(/:\s*'([^']*)'/g,  ': "$1"')   // string values
            .replace(/([{,]\s*)'(\w+)'\s*:/g, '$1"$2":') // keys
            .replace(/,\s*([}\]])/g, '$1');          // trailing commas
        return JSON.parse(dq);
    } catch {}

    // Pass 5 – extract every {...} block individually and build the array manually
    try {
        const objects = [];
        const objPattern = /\{[^{}]*\}/g;
        let m;
        while ((m = objPattern.exec(j)) !== null) {
            try { objects.push(JSON.parse(m[0].replace(/,\s*([}\]])/g, '$1'))); } catch {}
        }
        if (objects.length > 0) return objects;
    } catch {}

    console.error('[worksheet] All parse passes failed. Raw model output:', text.slice(0, 600));
    throw new Error('The AI returned a response this app could not read. Please try again or switch models in Settings.');
}

async function callModel(model, { base64, mimeType }, apiKey) {
    if (model.apiFormat === 'gemini') {
        return callGeminiAPI(model, base64, mimeType, apiKey);
    } else {
        return callOpenAICompatAPI(model, base64, mimeType, apiKey);
    }
}

// ─── Retry + failover orchestration ───────────────────────────

function isOverloadError(err) {
    const m = err.message.toLowerCase();
    return m.includes('503') || m.includes('overload') || m.includes('high demand') ||
           m.includes('unavailable') || m.includes('retry') ||
           m.includes('rate limit') || m.includes('429') || m.includes('too many');
}

const RETRY_DELAYS = [5000, 15000, 30000];

async function tryModelWithRetries(model, fileData, apiKey) {
    let lastErr;
    for (let i = 0; i < 3; i++) {
        try {
            return await callModel(model, fileData, apiKey);
        } catch (err) {
            lastErr = err;
            if (isOverloadError(err) && i < 2) {
                const waitSec = RETRY_DELAYS[i] / 1000;
                setLoadingMessage(`${model.name} is busy — retrying in ${waitSec}s… (attempt ${i + 1}/3)`);
                await new Promise(r => setTimeout(r, RETRY_DELAYS[i]));
                setLoadingMessage(`Retrying with ${model.name}…`);
            } else {
                throw err;
            }
        }
    }
    throw lastErr;
}

function setLoadingMessage(msg) {
    const p = document.querySelector('#upload-loading p');
    if (p) p.textContent = msg;
}

async function checkWorksheet() {
    if (!selectedFileData) return;

    const selectedId = localStorage.getItem('selectedModel') || 'gemini-2.5-flash';
    const orderedModels = getFailoverOrder(selectedId);
    const available = orderedModels.filter(m => localStorage.getItem(m.keyStorageKey));

    if (available.length === 0) {
        alert('No API key found. Please go to Settings and add a key for at least one AI model.');
        showTab('settings');
        return;
    }

    document.getElementById('upload-loading').classList.remove('hidden');
    document.getElementById('upload-results').classList.add('hidden');
    document.getElementById('check-btn').disabled = true;
    setLoadingMessage(`Analysing with ${available[0].name}…`);

    let lastError;
    for (let mi = 0; mi < available.length; mi++) {
        const model = available[mi];
        const apiKey = localStorage.getItem(model.keyStorageKey);
        try {
            const results = await tryModelWithRetries(model, selectedFileData, apiKey);
            displayWorksheetResults(results, model);
            document.getElementById('upload-loading').classList.add('hidden');
            document.getElementById('check-btn').disabled = false;
            return;
        } catch (err) {
            lastError = err;
            if (isOverloadError(err) && mi < available.length - 1) {
                const next = available[mi + 1];
                setLoadingMessage(`${model.name} is unavailable. Switching to ${next.name}…`);
                await new Promise(r => setTimeout(r, 2000));
            } else {
                break;
            }
        }
    }

    document.getElementById('upload-loading').classList.add('hidden');
    document.getElementById('check-btn').disabled = false;
    alert('Could not check worksheet: ' + (lastError?.message || 'Unknown error'));
}

// ─── Results rendering ─────────────────────────────────────────

function displayWorksheetResults(results, model) {
    const tbody = document.getElementById('results-tbody');
    tbody.innerHTML = '';

    // Safety net: blank/unreadable answers can never be marked correct,
    // regardless of what the model returned
    results.forEach(r => {
        const s = String(r.studentAnswer).toLowerCase();
        if (s === 'blank' || s === 'unreadable') r.isCorrect = false;
    });

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

    const modelLabel = document.getElementById('results-model-label');
    if (modelLabel && model) modelLabel.textContent = `Checked with ${model.name} (${model.provider})`;

    document.getElementById('upload-results').classList.remove('hidden');
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

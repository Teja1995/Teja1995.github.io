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
`You are an answer-CHECKER, not an answer-GIVER. Read what the student physically wrote and verify it. Never supply, invent, or compute an answer the student did not write.

GOLDEN RULE: If the answer space after = is empty (no handwriting), you must set studentAnswer to "blank" and isCorrect to false, with no exceptions.

SCAN THE WHOLE IMAGE FIRST: Before reading any answers, look at the entire image from the left edge to the right edge. Count how many vertical columns of problems exist — a standard worksheet has 4 columns. You must process every column. A full page typically has 20–30 problems. If your output contains fewer than 15 items for a full page you have missed columns — go back and check the right side of the image.

WORKSHEET FORMAT: Each problem is printed as NUMBER [operator] NUMBER = ______ where the blank underlined space is where the student writes their answer. Process left to right across columns, then top to bottom within each column. Each problem occupies exactly one row — do not borrow numbers from the row above or below.

STUDENT ANSWER: Look only at the space immediately after = on that problem's line. If there is handwriting — even faint pencil marks — transcribe it exactly. Only write "blank" if the space is truly empty with no marks at all. Never use a number from the next printed question as the current answer.

isCorrect is true only when: (a) studentAnswer is not "blank" or "unreadable", and (b) it equals the mathematically correct answer. Allow 0.01 difference for decimals and percentages.

Return ONLY a valid JSON array with no markdown, no code fences, and no explanation before or after it:
[{"question":"31 + 29","studentAnswer":"60","correctAnswer":"60","isCorrect":true}]

Every problem on the page must be in the array. Unreadable handwriting → studentAnswer "unreadable", isCorrect false.`;

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
            generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
        })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseAIJSON(text, model.name);
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
            temperature: 0.1,
            max_tokens: 8192
        })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return parseAIJSON(text, model.name);
}

// ─── Parse error logger ────────────────────────────────────────

function logParseError(modelName, rawText, errorMsg) {
    if (!currentUser) return;
    try {
        db.ref('error_logs/' + currentUser.uid).push({
            ts:       new Date().toISOString(),
            model:    modelName,
            error:    errorMsg,
            response: rawText.slice(0, 3000)   // cap at 3 KB — no images
        });
    } catch (e) { /* never surface logging failures to the user */ }
}

function parseAIJSON(text, modelName = 'unknown') {
    // Strip markdown fences
    let s = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();

    // ── Pre-processing: fix known Llama output quirks before regex matching ──

    // 1. Truncated response: has [ but no closing ] — close it after the last }
    if (s.includes('[') && !s.includes(']')) {
        const openAt  = s.indexOf('[');
        const lastObj = s.lastIndexOf('}');
        if (openAt !== -1 && lastObj > openAt) {
            s = s.slice(openAt, lastObj + 1) + ']';
        }
    }

    // 2. Missing values for specific known keys (safe — only matches keys, not values,
    //    because in valid JSON these names are always followed by ':' not ',')
    //    "studentAnswer","nextKey": → "studentAnswer":"blank","nextKey":
    s = s.replace(/"studentAnswer"\s*,\s*"(\w+)":/g, '"studentAnswer":"blank","$1":');
    //    "correctAnswer","nextKey": → "correctAnswer":"","nextKey":
    s = s.replace(/"correctAnswer"\s*,\s*"(\w+)":/g, '"correctAnswer":"","$1":');

    // 3. Strip trailing commas (common across all models)
    s = s.replace(/,\s*([}\]])/g, '$1');

    // ── Regex extraction ──────────────────────────────────────────────────────

    // Strict: array of objects — avoids matching preamble like "[note: 4 columns]"
    let match = s.match(/\[\s*\{[\s\S]*\}\s*\]/);

    // Loose fallback: any [...]
    if (!match) match = s.match(/\[[\s\S]*?\]/);

    if (!match) {
        const msg = 'No JSON array found in model response';
        console.error('[worksheet]', msg, text);
        logParseError(modelName, text, msg);
        const preview = text.slice(0, 200).replace(/\n/g, ' ');
        throw new Error(`The AI did not return a recognisable answer list. Try again.\n\nModel responded: "${preview}"`);
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

    const msg = 'All 5 parse passes failed';
    console.error('[worksheet]', msg, text.slice(0, 600));
    logParseError(modelName, text, msg);
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

function isRateLimitError(err) {
    const m = err.message.toLowerCase();
    return m.includes('429') || m.includes('rate limit') || m.includes('too many') || m.includes('quota');
}

function isTransientError(err) {
    const m = err.message.toLowerCase();
    return m.includes('503') || m.includes('overload') || m.includes('high demand') ||
           m.includes('unavailable') || m.includes('retry');
}

const RETRY_DELAYS = [5000, 15000, 30000];

async function tryModelWithRetries(model, fileData, apiKey) {
    let lastErr;
    for (let i = 0; i < 3; i++) {
        try {
            return await callModel(model, fileData, apiKey);
        } catch (err) {
            lastErr = err;
            // Rate limit = switch immediately, no point retrying same model
            if (isRateLimitError(err)) throw err;
            // Transient overload = retry with backoff
            if (isTransientError(err) && i < 2) {
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

// ─── Client-side math verification ────────────────────────────
// The model reads the question and the student's handwriting.
// We compute the correct answer ourselves so model math errors don't
// affect the final isCorrect judgement.

function computeAnswer(questionStr) {
    const q = String(questionStr || '').replace(/\s*=\s*\??$/, '').trim();

    let m;
    // Addition:  31 + 29
    m = q.match(/^(\d+)\s*\+\s*(\d+)$/);
    if (m) return String(parseInt(m[1]) + parseInt(m[2]));

    // Subtraction: 45 - 12  or  45 − 12
    m = q.match(/^(\d+)\s*[−\-]\s*(\d+)$/);
    if (m) return String(parseInt(m[1]) - parseInt(m[2]));

    // Multiplication: 3 × 4  or  3 x 4
    m = q.match(/^(\d+)\s*[×x\*]\s*(\d+)$/i);
    if (m) return String(parseInt(m[1]) * parseInt(m[2]));

    // Percentage: 3 / 8 as a percentage
    m = q.match(/^(\d+)\s*\/\s*(\d+)\s*as\s*a\s*percentage/i);
    if (m) return ((parseInt(m[1]) / parseInt(m[2])) * 100).toFixed(2);

    return null; // unrecognised format — leave model's value unchanged
}

function verifyMath(results) {
    return results.map(r => {
        const computed = computeAnswer(r.question);
        if (computed === null) return r; // can't parse, leave as-is

        r.correctAnswer = computed; // override model's answer with ours

        const s = String(r.studentAnswer || '').trim().toLowerCase();
        if (s === 'blank' || s === 'unreadable' || s === '') {
            r.isCorrect = false;
        } else {
            r.isCorrect = Math.abs(parseFloat(s) - parseFloat(computed)) < 0.01;
        }
        return r;
    });
}

// ─── Results rendering ─────────────────────────────────────────

function displayWorksheetResults(results, model) {
    const tbody = document.getElementById('results-tbody');
    tbody.innerHTML = '';

    // Compute correct answers ourselves — model math can't be trusted
    results = verifyMath(results);

    // Safety net: blank/unreadable answers can never be marked correct
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

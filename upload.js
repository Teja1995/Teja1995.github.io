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
`You are checking a student's completed addition worksheet. Your ONLY job is to read what is printed and what the student wrote by hand. Never calculate any answer yourself.

LAYOUT
- The page is divided into 4 vertical columns, side by side.
- Each column holds about 48 problems stacked top to bottom (roughly 192 on the whole page).
- Every problem sits on ONE horizontal line and looks like:
      number  +  number  =  answer
  The student's answer is the handwritten number written after the = sign.

HOW TO READ EACH LINE
1. Find the + sign on the line. The number immediately LEFT of it and the number immediately RIGHT of it are the two operands. They are ALWAYS on the same line as that + sign.
2. Find the = sign on the same line. The handwritten number after it is the student's answer.
3. The two operands and the answer all share ONE horizontal line. NEVER take a digit from the line above or below.

The exact mistake to avoid (rows are packed close together):
   line 1:  21 + 38 = 59
   line 2:  46 + 85 = 131
   WRONG → reading line 2 as "46 + 38" (38 was borrowed from line 1 above) ✗
   RIGHT → reading line 2 as "46 + 85" (both numbers are on line 2's own line) ✓

READING ORDER
Work one full column at a time, left to right. Finish every line in column 1 before starting column 2, then column 3, then column 4. The columns on the right edge are the easiest to forget — make sure all four are read.

THE STUDENT'S ANSWER
- Handwriting present (even faint pencil) → copy the number exactly as written.
- Nothing written after the = sign → "blank"
- Written but impossible to read → "unreadable"

COMPLETENESS
Report every problem that is actually printed on the page — expect roughly 192. Only report rows you can actually see; NEVER invent, guess, or duplicate a problem just to reach a number. If your count is far below ~190 you have probably skipped a column — look again at the right side of the page.

OUTPUT
Return ONLY a JSON array, nothing else — no markdown, no code fences, no commentary:
[{"question":"46 + 85","studentAnswer":"131","correctAnswer":"","isCorrect":false}]
Always set "correctAnswer" to "" and "isCorrect" to false — the app fills these in itself.`;

// ─── Per-format API callers ────────────────────────────────────

const MAX_OUTPUT_TOKENS = 16384; // a full ~192-item response is ~6k tokens; headroom avoids truncation

// POST a request, throw a clean Error on failure, return parsed JSON body.
async function postJSON(url, headers, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }
    return response.json();
}

async function callGeminiAPI(model, base64, mimeType, apiKey) {
    const data = await postJSON(`${model.endpoint}?key=${apiKey}`, {}, {
        contents: [{
            parts: [
                { text: WORKSHEET_PROMPT },
                { inline_data: { mime_type: mimeType, data: base64 } }
            ]
        }],
        generationConfig: { temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS }
    });
    return parseAIJSON(data.candidates?.[0]?.content?.parts?.[0]?.text || '', model.name);
}

async function callOpenAICompatAPI(model, base64, mimeType, apiKey) {
    const data = await postJSON(model.endpoint, { 'Authorization': `Bearer ${apiKey}` }, {
        model: model.modelId,
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: WORKSHEET_PROMPT },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
            ]
        }],
        temperature: 0,
        max_tokens: MAX_OUTPUT_TOKENS
    });
    return parseAIJSON(data.choices?.[0]?.message?.content || '', model.name);
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
    const allAvailable = orderedModels.filter(m => localStorage.getItem(m.keyStorageKey));

    if (allAvailable.length === 0) {
        alert('No API key found. Please go to Settings and add a key for at least one AI model.');
        showTab('settings');
        return;
    }

    const autoRetry = document.getElementById('auto-retry-checkbox')?.checked ?? true;
    const queue = autoRetry ? allAvailable : allAvailable.slice(0, 1);

    document.getElementById('upload-loading').classList.remove('hidden');
    document.getElementById('upload-results').classList.add('hidden');
    document.getElementById('check-btn').disabled = true;
    setLoadingMessage(`Analysing with ${queue[0].name}…`);

    let lastError;
    for (let mi = 0; mi < queue.length; mi++) {
        const model = queue[mi];
        const apiKey = localStorage.getItem(model.keyStorageKey);
        try {
            const results = await tryModelWithRetries(model, selectedFileData, apiKey);
            displayWorksheetResults(results, model);
            document.getElementById('upload-loading').classList.add('hidden');
            document.getElementById('check-btn').disabled = false;
            return;
        } catch (err) {
            lastError = err;
            const canSwitch = (isRateLimitError(err) || isTransientError(err)) && mi < queue.length - 1;
            if (canSwitch) {
                const next = queue[mi + 1];
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
// The model only reads the question and the student's handwriting.
// We compute the correct answer ourselves so model math errors can
// never affect the final verdict.

function computeAnswer(questionStr) {
    const q = String(questionStr || '').replace(/\s*=\s*\??$/, '').trim();

    const ops = [
        [/^(\d+)\s*\+\s*(\d+)$/,                       (a, b) => a + b],            // addition
        [/^(\d+)\s*[−\-]\s*(\d+)$/,                    (a, b) => a - b],            // subtraction
        [/^(\d+)\s*[×x\*]\s*(\d+)$/i,                  (a, b) => a * b],            // multiplication
        [/^(\d+)\s*\/\s*(\d+)\s*as\s*a\s*percentage/i, (a, b) => +((a / b) * 100).toFixed(2)], // percentage
    ];

    for (const [pattern, fn] of ops) {
        const m = q.match(pattern);
        if (m) return String(fn(parseInt(m[1]), parseInt(m[2])));
    }
    return null; // unrecognised format
}

// Returns a new array with correctAnswer/isCorrect filled in by us.
function verifyMath(results) {
    return results.map(r => {
        const answer  = String(r.studentAnswer ?? '').trim();
        const isBlank = /^(blank|unreadable)$/i.test(answer) || answer === '';
        const computed = computeAnswer(r.question);

        return {
            question:      r.question,
            studentAnswer: r.studentAnswer,
            correctAnswer: computed ?? r.correctAnswer ?? '',
            // Blank/unreadable is never correct. Otherwise compare to our computed value.
            isCorrect: !isBlank && computed !== null &&
                       Math.abs(parseFloat(answer) - parseFloat(computed)) < 0.01,
        };
    });
}

// ─── Results rendering ─────────────────────────────────────────

function displayWorksheetResults(results, model) {
    results = verifyMath(results);

    const tbody = document.getElementById('results-tbody');
    tbody.innerHTML = '';

    let correct = 0;
    results.forEach((r, i) => {
        if (r.isCorrect) correct++;
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

    const total = results.length;
    document.getElementById('results-correct-count').textContent = `✓ ${correct} correct`;
    document.getElementById('results-wrong-count').textContent = `✗ ${total - correct} wrong`;

    const modelLabel = document.getElementById('results-model-label');
    if (modelLabel && model) {
        modelLabel.textContent = `${total} questions detected · checked with ${model.name} (${model.provider})`;
    }

    document.getElementById('upload-results').classList.remove('hidden');
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

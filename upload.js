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
    renderSplitPreview(null);

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
    renderSplitPreview(null);
}

// ─── Worksheet prompt (shared across all models) ───────────────

const WORKSHEET_PROMPT =
`You are transcribing a student's math practice worksheet. Your ONLY job is to read what is printed and what the student wrote by hand. You never calculate anything.

LAYOUT
- The page is divided into 4 vertical columns, side by side.
- Each column holds about 48 problems stacked top to bottom (roughly 192 on the whole page).
- Every problem sits on ONE horizontal line and looks like:
      number  operator  number  =  ________
  The operator can be +, −, × or ÷ — read whichever symbol is printed.
  After the = sign there is a printed underline where the student may have handwritten an answer.

HOW TO READ EACH LINE
1. Read the printed question: first number, the operator symbol between the numbers, second number — all on that ONE line.
2. Look at the space after the = sign on the SAME line for the student's handwritten answer.
3. NEVER take a digit from the line above or below.

The exact mistake to avoid (rows are packed close together):
   line 1:  21 + 38 = 59
   line 2:  46 + 85 = 131
   WRONG → reading line 2 as "46 + 38" (38 was borrowed from line 1 above) ✗
   RIGHT → reading line 2 as "46 + 85" (both numbers are on line 2's own line) ✓

READING ORDER
Work one full column at a time, left to right. Finish every line in column 1 before starting column 2, then 3, then 4. The right-edge columns are the easiest to forget.

THE STUDENT'S ANSWER
- Handwritten digits present (pen or faint pencil) → copy them exactly as written.
- Only the printed underline, no handwriting → "blank"
- Handwriting present but impossible to read → "unreadable"

GOLDEN RULE — blank means blank
Completely or partially unanswered sheets are very common. NEVER output a number the student did not physically write. If the space after = shows only the printed underline, studentAnswer is "blank" — even if you know what the result would be. Writing a computed answer for an empty line is the worst possible error you can make.

COMPLETENESS
Report every printed problem exactly once, only problems you can actually see. Never invent, guess, or duplicate a problem to reach a count. If your total is far below ~190 you probably skipped a column — re-check the right side of the page.

OUTPUT
Return ONLY a JSON array, nothing else — no markdown, no code fences, no commentary. Use the exact operator symbol you see:
[{"question":"46 + 85","studentAnswer":"131","correctAnswer":"","isCorrect":false},
 {"question":"72 − 19","studentAnswer":"blank","correctAnswer":"","isCorrect":false}]
Always set "correctAnswer" to "" and "isCorrect" to false — the app fills these in itself.`;

// Used when the page is split into single columns (one column per image).
const COLUMN_PROMPT =
`You are transcribing ONE COLUMN cut from a student's math practice worksheet. The image is a single vertical strip of problems stacked top to bottom (about 40–50 of them). Your ONLY job is to read; you never calculate anything.

Every problem sits on ONE horizontal line:
    number  operator  number  =  ________
The operator can be +, −, × or ÷ — read whichever symbol is printed. After the = sign there is a printed underline where the student may have handwritten an answer.

HOW TO READ EACH LINE
1. Read the printed question: first number, the operator symbol between the numbers, second number — all on that ONE line.
2. Look at the space after the = sign on the SAME line for the student's handwritten answer.
3. NEVER take a digit from the line above or below.

THE STUDENT'S ANSWER
- Handwritten digits present (pen or faint pencil) → copy them exactly as written.
- Only the printed underline, no handwriting → "blank"
- Handwriting present but impossible to read → "unreadable"

GOLDEN RULE — blank means blank
Completely or partially unanswered sheets are very common. NEVER output a number the student did not physically write. If the space after = shows only the printed underline, studentAnswer is "blank" — even if you know what the result would be. Writing a computed answer for an empty line is the worst possible error you can make.

COMPLETENESS
Read strictly top to bottom. Report every printed problem exactly once — never skip, invent, or duplicate one.

OUTPUT
Return ONLY a JSON array, nothing else — no markdown, no commentary. Use the exact operator symbol you see:
[{"question":"46 + 85","studentAnswer":"131","correctAnswer":"","isCorrect":false},
 {"question":"72 − 19","studentAnswer":"blank","correctAnswer":"","isCorrect":false}]
Always set "correctAnswer" to "" and "isCorrect" to false — the app fills these in itself.`;

// ─── Per-format API callers ────────────────────────────────────

const DEFAULT_MAX_TOKENS = 8192; // safe fallback; per-model limit set in models.js

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

async function callGeminiAPI(model, base64, mimeType, apiKey, prompt) {
    const data = await postJSON(`${model.endpoint}?key=${apiKey}`, {}, {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64 } }
            ]
        }],
        generationConfig: { temperature: 0, maxOutputTokens: model.maxTokens || DEFAULT_MAX_TOKENS }
    });
    return parseAIJSON(data.candidates?.[0]?.content?.parts?.[0]?.text || '', model.name);
}

async function callOpenAICompatAPI(model, base64, mimeType, apiKey, prompt) {
    const data = await postJSON(model.endpoint, { 'Authorization': `Bearer ${apiKey}` }, {
        model: model.modelId,
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
            ]
        }],
        temperature: 0,
        max_tokens: model.maxTokens || DEFAULT_MAX_TOKENS
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

async function callModel(model, { base64, mimeType }, apiKey, prompt) {
    if (model.apiFormat === 'gemini') {
        return callGeminiAPI(model, base64, mimeType, apiKey, prompt);
    } else {
        return callOpenAICompatAPI(model, base64, mimeType, apiKey, prompt);
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

async function tryModelWithRetries(model, fileData, apiKey, prompt) {
    let lastErr;
    for (let i = 0; i < 3; i++) {
        try {
            return await callModel(model, fileData, apiKey, prompt);
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

// Show the exact images sent to the AI so column-split problems are
// visible on demand. Collapsed by default; a split-failure warning is
// always shown because the user should know full-page mode kicked in.
function renderSplitPreview(prep) {
    const box = document.getElementById('split-preview');
    if (!box) return;
    if (!prep || !prep.previews || prep.previews.length === 0) {
        box.classList.add('hidden');
        box.innerHTML = '';
        return;
    }
    const title = prep.split
        ? `Detected ${prep.previews.length} columns — this is exactly what the AI reads:`
        : `Could not split columns reliably${prep.reason ? ` (${esc(prep.reason)})` : ''} — sending the whole enhanced page:`;
    box.innerHTML = `
        ${prep.split ? '' : `<p class="split-preview-title">${title}</p>`}
        <button type="button" class="split-preview-toggle" onclick="toggleSplitPreview(this)">Show image preview ▸</button>
        <div class="split-preview-body hidden">
            ${prep.split ? `<p class="split-preview-title">${title}</p>` : ''}
            <div class="split-preview-row">
                ${prep.previews.map(u => `<img src="${u}" alt="Column preview">`).join('')}
            </div>
        </div>`;
    box.classList.remove('hidden');
}

function toggleSplitPreview(btn) {
    const body = btn.parentElement.querySelector('.split-preview-body');
    const hidden = body.classList.toggle('hidden');
    btn.textContent = hidden ? 'Show image preview ▸' : 'Hide image preview ▾';
}

// Try each model in the queue for a single image; returns { results, model }
// or throws after exhausting the queue.
async function runWithFailover(queue, fileData, prompt, label) {
    let lastErr;
    for (let mi = 0; mi < queue.length; mi++) {
        const model = queue[mi];
        const apiKey = localStorage.getItem(model.keyStorageKey);
        setLoadingMessage(`${label} with ${model.name}…`);
        try {
            const results = await tryModelWithRetries(model, fileData, apiKey, prompt);
            return { results, model };
        } catch (err) {
            lastErr = err;
            const canSwitch = (isRateLimitError(err) || isTransientError(err)) && mi < queue.length - 1;
            if (!canSwitch) throw err;
            const next = queue[mi + 1];
            setLoadingMessage(`${model.name} unavailable — switching to ${next.name}…`);
            await new Promise(r => setTimeout(r, 1500));
        }
    }
    throw lastErr;
}

async function checkWorksheet() {
    if (!selectedFileData) return;

    const selectedId = localStorage.getItem('selectedModel') || 'gemini-2.5-flash';
    const available = getFailoverOrder(selectedId)
        .filter(m => localStorage.getItem(m.keyStorageKey));

    if (available.length === 0) {
        alert('No API key found. Please go to Settings and add a key for at least one AI model.');
        showTab('settings');
        return;
    }

    const autoRetry  = document.getElementById('auto-retry-checkbox')?.checked ?? true;
    const splitCols  = document.getElementById('split-columns-checkbox')?.checked ?? true;
    const queue      = autoRetry ? available : available.slice(0, 1);

    document.getElementById('upload-loading').classList.remove('hidden');
    document.getElementById('upload-results').classList.add('hidden');
    document.getElementById('check-btn').disabled = true;

    try {
        // Enhance and (optionally) split into per-column images.
        let prep;
        if (splitCols) {
            setLoadingMessage('Enhancing image and finding columns…');
            prep = await prepareColumnImages(selectedFileData);
        } else {
            setLoadingMessage('Enhancing image…');
            prep = { parts: [await prepareEnhancedImage(selectedFileData)], previews: [], split: false };
        }
        renderSplitPreview(prep);
        const images = prep.parts;
        const prompt = prep.split ? COLUMN_PROMPT : WORKSHEET_PROMPT;

        const allResults = [];
        const colCounts  = [];   // rows returned per column — maps results back to page geometry
        const modelsUsed = new Set();
        for (let c = 0; c < images.length; c++) {
            const label = images.length > 1 ? `Reading column ${c + 1} of ${images.length}` : 'Analysing worksheet';
            const { results, model } = await runWithFailover(queue, images[c], prompt, label);
            allResults.push(...results);
            colCounts.push(results.length);
            modelsUsed.add(model.name);
        }

        const cols = images.length;
        const labelText = [...modelsUsed].join(', ') + (cols > 1 ? ` · ${cols} columns` : '');
        displayWorksheetResults(allResults, labelText, prep, colCounts);
    } catch (err) {
        alert('Could not check worksheet: ' + (err?.message || 'Unknown error'));
    } finally {
        document.getElementById('upload-loading').classList.add('hidden');
        document.getElementById('check-btn').disabled = false;
    }
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
        [/^(\d+)\s*\/\s*(\d+)\s*as\s*a\s*percentage/i, (a, b) => (a / b) * 100],    // percentage (before plain /)
        [/^(\d+)\s*[÷:]\s*(\d+)$/,                     (a, b) => b === 0 ? NaN : a / b], // division
        [/^(\d+)\s*\/\s*(\d+)$/,                       (a, b) => b === 0 ? NaN : a / b], // division written with /
    ];

    for (const [pattern, fn] of ops) {
        const m = q.match(pattern);
        if (!m) continue;
        const v = fn(parseInt(m[1]), parseInt(m[2]));
        if (!Number.isFinite(v)) return null;
        return Number.isInteger(v) ? String(v) : String(+v.toFixed(2));
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

// Draw red boxes around wrongly-ANSWERED rows on the processed page image.
// Geometry comes from imaging.js (column cuts + per-row text bands); the AI
// reads each column strictly top to bottom, so result i of a column maps to
// that column's i-th text band. If the detected band count doesn't match the
// AI's row count, the rows are placed by even spacing across the table block
// instead. Blank/unreadable rows are not boxed — they aren't responses.
function renderAnnotatedSheet(prep, results, colCounts) {
    const box = document.getElementById('annotated-sheet');
    if (!box) return;
    box.classList.add('hidden');
    box.innerHTML = '';
    const g = prep && prep.geometry;
    if (!g || !colCounts || colCounts.length === 0) return;

    const src = g.canvas;
    const scale = Math.min(1, 1600 / src.width);  // display copy, keeps memory sane
    const c = document.createElement('canvas');
    c.width  = Math.round(src.width * scale);
    c.height = Math.round(src.height * scale);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0, c.width, c.height);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = Math.max(2, Math.round(c.width * 0.0025));

    let drawn = 0, idx = 0;
    for (let col = 0; col < colCounts.length; col++) {
        const n = colCounts[col];
        const bands = g.rowBands[col] || [];
        const useBands = bands.length === n;
        const x0 = g.cutsX[col], x1 = g.cutsX[col + 1];
        for (let i = 0; i < n; i++, idx++) {
            const r = results[idx];
            if (!r || r.isCorrect) continue;
            const ans = String(r.studentAnswer ?? '').trim();
            if (ans === '' || /^(blank|unreadable)$/i.test(ans)) continue;
            let y0, y1;
            if (useBands) {
                y0 = bands[i].y0; y1 = bands[i].y1;
            } else {
                y0 = g.top + (g.bottom - g.top) * i / n;
                y1 = g.top + (g.bottom - g.top) * (i + 1) / n;
            }
            const pad = (y1 - y0) * 0.2;
            ctx.strokeRect(x0 * scale, (y0 - pad) * scale,
                           (x1 - x0) * scale, (y1 - y0 + 2 * pad) * scale);
            drawn++;
        }
    }
    if (drawn === 0) return;

    const title = document.createElement('p');
    title.className = 'annotated-title';
    title.textContent = `${drawn} incorrect answer${drawn === 1 ? '' : 's'} marked in red:`;
    c.className = 'annotated-canvas';
    box.appendChild(title);
    box.appendChild(c);
    box.classList.remove('hidden');
}

function displayWorksheetResults(results, labelText, prep, colCounts) {
    results = verifyMath(results);
    renderAnnotatedSheet(prep, results, colCounts);

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
    if (modelLabel) {
        modelLabel.textContent = `${total} questions detected` + (labelText ? ` · ${labelText}` : '');
    }

    document.getElementById('upload-results').classList.remove('hidden');
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

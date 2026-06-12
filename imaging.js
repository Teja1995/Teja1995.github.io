// imaging.js — client-side enhancement, geometry correction and column splitting.
// Pure canvas/JS, no external dependencies. Runs BEFORE sending a worksheet
// to the AI. Pipeline:
//   1. enhance      — grayscale + contrast + sharpen (helps faint pencil)
//   2. find page    — bright paper region (ignores desk/background around it)
//   3. orientation  — auto-fix sideways (90°) and upside-down (180°) photos
//   4. deskew       — correct small tilt (±10°)
//   5. table block  — the printed problem grid inside the page (drops header)
//   6. column cuts  — 3 lowest-ink valleys relative to the TABLE, not the image
//   7. crop         — one JPEG per column + small previews for the UI
// Any failure falls back to a single enhanced full image.

const MAX_LONG_SIDE   = 3200;  // downscale huge phone photos (kept high: column crops need legible handwriting)
const ANALYSIS_WIDTH  = 520;   // small copy used for geometry analysis
const COLUMN_COUNT    = 4;
const CONTRAST        = 1.4;

// Per-run diagnostics, inspectable as window.__imagingDebug in the console.
let DBG = null;
function dbg(key, value) { if (DBG) DBG[key] = value; }

// ─── Basic helpers ─────────────────────────────────────────────

function base64ToImage(base64, mimeType) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => resolve(img);
        img.onerror = () => reject(new Error('Could not load image for processing'));
        img.src = `data:${mimeType};base64,${base64}`;
    });
}

function imageToCanvas(img) {
    let w = img.naturalWidth, h = img.naturalHeight;
    const long = Math.max(w, h);
    if (long > MAX_LONG_SIDE) {
        const s = MAX_LONG_SIDE / long;
        w = Math.round(w * s);
        h = Math.round(h * s);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    // White-fill first: transparent PNG pixels otherwise read as BLACK in
    // getImageData, which turns the whole background into "ink" and breaks
    // every geometry step downstream.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
}

function scaledCopy(canvas, width) {
    const c = document.createElement('canvas');
    c.width  = width;
    c.height = Math.max(1, Math.round(canvas.height * width / canvas.width));
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    return c;
}

// Rotate by deg, expanding the canvas so nothing is clipped; white background.
function rotateCanvas(canvas, deg) {
    const rad = deg * Math.PI / 180;
    const s = Math.abs(Math.sin(rad)), c = Math.abs(Math.cos(rad));
    const w = canvas.width, h = canvas.height;
    const W = Math.round(w * c + h * s), H = Math.round(w * s + h * c);
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(rad);
    ctx.drawImage(canvas, -w / 2, -h / 2);
    return out;
}

function thumbnail(canvas) {
    return scaledCopy(canvas, 260).toDataURL('image/jpeg', 0.75);
}

const firstIdx = (arr, pred) => { for (let i = 0; i < arr.length; i++) if (pred(arr[i])) return i; return -1; };
const lastIdx  = (arr, pred) => { for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i; return -1; };

// ─── Enhancement (grayscale + contrast + sharpen) ──────────────

function enhanceCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const intercept = 128 * (1 - CONTRAST);
    for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        let v = CONTRAST * lum + intercept;
        v = v < 0 ? 0 : v > 255 ? 255 : v;
        d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);

    const src = ctx.getImageData(0, 0, w, h);
    const out = ctx.createImageData(w, h);
    const s = src.data, o = out.data;
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const di = (y * w + x) * 4;
            if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
                o[di] = o[di + 1] = o[di + 2] = s[di];
                o[di + 3] = 255;
                continue;
            }
            let sum = 0, ki = 0;
            for (let ky = -1; ky <= 1; ky++)
                for (let kx = -1; kx <= 1; kx++)
                    sum += s[((y + ky) * w + (x + kx)) * 4] * kernel[ki++];
            const v = sum < 0 ? 0 : sum > 255 ? 255 : sum;
            o[di] = o[di + 1] = o[di + 2] = v;
            o[di + 3] = 255;
        }
    }
    ctx.putImageData(out, 0, 0);
}

// ─── Analysis on a small grayscale copy ────────────────────────

function otsu(hist, total) {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, maxVar = 0, thr = 127;
    for (let i = 0; i < 256; i++) {
        wB += hist[i];
        if (!wB) continue;
        const wF = total - wB;
        if (!wF) break;
        sumB += i * hist[i];
        const mB = sumB / wB, mF = (sum - sumB) / wF;
        const v = wB * wF * (mB - mF) * (mB - mF);
        if (v > maxVar) { maxVar = v; thr = i; }
    }
    return thr;
}

// Small copy → { small, mask, w, h, page }. The page box is the bright paper
// region; ink mask is dark pixels INSIDE the page only (desk is excluded).
function analyzeSmall(full) {
    const small = scaledCopy(full, ANALYSIS_WIDTH);
    const { width: w, height: h } = small;
    const d = small.getContext('2d').getImageData(0, 0, w, h).data;

    const lum = new Uint8Array(w * h);
    const hist = new Uint32Array(256);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        lum[p] = d[i];                  // canvas is grayscale after enhance
        hist[d[i]]++;
    }
    const thr = otsu(hist, w * h);

    // Page = rows/cols that are mostly bright (paper). Desk/background is darker.
    const rowBright = new Uint32Array(h), colBright = new Uint32Array(w);
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
            if (lum[y * w + x] >= thr) { rowBright[y]++; colBright[x]++; }

    let page = {
        y0: firstIdx(rowBright, v => v > w * 0.4),
        y1: lastIdx(rowBright,  v => v > w * 0.4),
        x0: firstIdx(colBright, v => v > h * 0.4),
        x1: lastIdx(colBright,  v => v > h * 0.4),
    };
    // Fallback: whole frame if detection failed or the "page" is implausibly small
    if (page.x0 < 0 || page.y0 < 0 ||
        (page.x1 - page.x0) * (page.y1 - page.y0) < w * h * 0.25) {
        page = { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
    }

    const mask = new Uint8Array(w * h);
    for (let y = page.y0; y <= page.y1; y++)
        for (let x = page.x0; x <= page.x1; x++)
            if (lum[y * w + x] < thr) mask[y * w + x] = 1;

    return { small, mask, w, h, page };
}

// Text lines give a strongly periodic horizontal projection. Try angles in
// ±10° and return the angle with the highest profile variance + that score.
// The score also tells us whether the text is horizontal at all (90° check).
function skewScore(mask, w, h) {
    let bestAngle = 0, bestVar = -1;
    for (let a = -10; a <= 10; a += 0.5) {
        const t = Math.tan(a * Math.PI / 180);
        const prof = new Float32Array(h);
        for (let y = 0; y < h; y += 2) {
            const row = y * w;
            for (let x = 0; x < w; x += 2) {
                if (!mask[row + x]) continue;
                const yy = Math.round(y + (x - w / 2) * t);
                if (yy >= 0 && yy < h) prof[yy]++;
            }
        }
        let s = 0, s2 = 0;
        for (let y = 0; y < h; y++) { s += prof[y]; s2 += prof[y] * prof[y]; }
        const mean = s / h, v = s2 / h - mean * mean;
        if (v > bestVar) { bestVar = v; bestAngle = a; }
    }
    return { angle: bestAngle, score: bestVar };
}

// Ink per row inside the page, and the longest contiguous run of inky rows
// (= the printed problem table; header and margins fall outside the run).
function tableBlock(mask, w, h, page) {
    const rowInk = new Uint32Array(h);
    for (let y = page.y0; y <= page.y1; y++) {
        let s = 0;
        for (let x = page.x0; x <= page.x1; x++) s += mask[y * w + x];
        rowInk[y] = s;
    }
    const pw = page.x1 - page.x0 + 1;
    const gap = Math.max(2, Math.round(h * 0.02));
    let bestT = -1, bestB = -2, t = -1, lastInk = -1;
    for (let y = page.y0; y <= page.y1; y++) {
        if (rowInk[y] > pw * 0.02) {
            if (t === -1) t = y;
            lastInk = y;
        } else if (t !== -1 && y - lastInk > gap) {
            if (lastInk - t > bestB - bestT) { bestT = t; bestB = lastInk; }
            t = -1;
        }
    }
    if (t !== -1 && lastInk - t > bestB - bestT) { bestT = t; bestB = lastInk; }
    if (bestT < 0 || bestB - bestT < (page.y1 - page.y0) * 0.3) {
        dbg('blockFail', { bestT, bestB, pageH: page.y1 - page.y0 });
        return null;
    }
    return { t: bestT, b: bestB, rowInk };
}

// On these worksheets the header (Date/Name/title) is printed ABOVE the table
// and the margin below it is empty. If most loose ink is BELOW the table the
// photo is upside down.
function flip180Needed(mask, w, h, page) {
    const block = tableBlock(mask, w, h, page);
    if (!block) return false;
    let above = 0, below = 0;
    for (let y = page.y0; y < block.t; y++) above += block.rowInk[y];
    for (let y = block.b + 1; y <= page.y1; y++) below += block.rowInk[y];
    return below > 60 && below > above * 2;
}

// Find the 4 column regions inside the table: vertical ink projection over the
// table rows, then snap each expected boundary (¼, ½, ¾ OF THE TABLE WIDTH —
// not the image width) to the emptiest nearby valley.
function columnCuts(mask, w, h, page) {
    const block = tableBlock(mask, w, h, page);
    if (!block) return null;

    const colInk = new Float32Array(w);
    for (let y = block.t; y <= block.b; y++) {
        const row = y * w;
        for (let x = page.x0; x <= page.x1; x++) colInk[x] += mask[row + x];
    }

    const bh = block.b - block.t + 1;
    const tx0 = firstIdx(colInk, v => v > bh * 0.02);
    const tx1 = lastIdx(colInk,  v => v > bh * 0.02);
    dbg('table', { t: block.t, b: block.b, tx0, tx1 });
    if (tx0 < 0 || tx1 - tx0 < w * 0.3) {
        dbg('tableXFail', { tx0, tx1, minWidth: Math.round(w * 0.3) });
        return null;
    }

    // Smooth with a small moving average so single noisy pixels don't win
    const win = Math.max(2, Math.round((tx1 - tx0) * 0.01));
    const smooth = new Float32Array(w);
    for (let x = tx0; x <= tx1; x++) {
        let s = 0, n = 0;
        for (let k = -win; k <= win; k++) {
            const xx = x + k;
            if (xx >= tx0 && xx <= tx1) { s += colInk[xx]; n++; }
        }
        smooth[x] = s / n;
    }

    const tw = tx1 - tx0;
    const cuts = [tx0];
    // Low-ink threshold relative to the busiest part of the profile.
    let maxSmooth = 0;
    for (let x = tx0; x <= tx1; x++) if (smooth[x] > maxSmooth) maxSmooth = smooth[x];
    const lowThr = Math.max(1, maxSmooth * 0.05);

    for (let k = 1; k < COLUMN_COUNT; k++) {
        const center = tx0 + Math.round(tw * k / COLUMN_COUNT);
        const winPx = Math.round(tw * 0.12);
        const lo = Math.max(tx0 + 1, center - winPx);
        const hi = Math.min(tx1 - 1, center + winPx);

        // Find the longest low-ink run in the window and cut at its RIGHT end,
        // i.e. just before the next column's first digit. Why not the deepest
        // valley: on BLANK sheets the printed answer underlines are too faint
        // to register at analysis scale, so the "empty" zone starts right
        // after the printed "=" — a min/argmin cut would slice the underline
        // away from its own question. The right end of the run is correct in
        // both cases (underline visible or not).
        let bestStart = -1, bestEnd = -1, runStart = -1;
        for (let x = lo; x <= hi + 1; x++) {
            const isLow = x <= hi && smooth[x] <= lowThr;
            if (isLow && runStart === -1) runStart = x;
            if (!isLow && runStart !== -1) {
                if (x - 1 - runStart > bestEnd - bestStart) { bestStart = runStart; bestEnd = x - 1; }
                runStart = -1;
            }
        }
        let cut;
        if (bestStart !== -1) {
            cut = Math.max(lo, bestEnd - 2);
        } else {
            // No clearly empty zone — fall back to the plain minimum.
            let bestVal = Infinity;
            cut = center;
            for (let x = lo; x <= hi; x++) {
                if (smooth[x] < bestVal) { bestVal = smooth[x]; cut = x; }
            }
        }
        cuts.push(cut);
    }
    cuts.push(tx1);

    // Sanity: 4 regions of roughly equal width (15%–40% of the table each).
    // The layout is a fixed grid, so if the valleys look uneven we don't give
    // up on splitting — we fall back to equal quarters OF THE TABLE, which is
    // almost always right once the table bounds are known.
    const widths = [];
    let uneven = false;
    for (let k = 0; k < COLUMN_COUNT; k++) {
        const frac = (cuts[k + 1] - cuts[k]) / tw;
        widths.push(+frac.toFixed(3));
        if (frac < 0.15 || frac > 0.40) uneven = true;
    }
    dbg('valleyCuts', cuts.slice());
    dbg('valleyWidths', widths);
    if (uneven) {
        for (let k = 1; k < COLUMN_COUNT; k++) {
            cuts[k] = tx0 + Math.round(tw * k / COLUMN_COUNT);
        }
        dbg('cutMode', 'equal-quarters (valleys uneven)');
    } else {
        dbg('cutMode', 'valleys');
    }
    return { cuts, t: block.t, b: block.b };
}

// Detect the horizontal text-line bands inside one column of the table
// (each band ≈ one printed problem row). Used to place red highlight boxes
// on the marked-up result image; counts that don't match the AI's row count
// fall back to even spacing at draw time, so imperfect detection is safe.
function detectRowBands(mask, w, x0, x1, t, b) {
    const colW = x1 - x0 + 1;
    const thr = Math.max(1, colW * 0.03);
    const bands = [];
    let start = -1, lastInk = -1, peak = 0;
    for (let y = t; y <= b + 1; y++) {
        let s = 0;
        if (y <= b) {
            const row = y * w;
            for (let x = x0; x <= x1; x++) s += mask[row + x];
        }
        if (y <= b && s >= thr) {
            if (start === -1) { start = y; peak = 0; }
            lastInk = y;
            if (s > peak) peak = s;
        } else if (start !== -1 && (y - lastInk > 1 || y > b)) {
            // gap tolerance of 1 row bridges specks inside a text line.
            // Skip printed table border lines: 1–2 rows tall with ink across
            // nearly the whole column width — text rows are never that solid.
            const isBorderLine = lastInk - start <= 1 && peak > colW * 0.6;
            if (!isBorderLine) bands.push({ y0: start, y1: lastInk });
            start = -1;
        }
    }
    return bands;
}

// ─── Public API ────────────────────────────────────────────────

// Enhance + geometry-correct + split into per-column images.
// Returns { parts: [{base64, mimeType}], previews: [dataUrl], split: bool,
//           geometry?: { canvas, cutsX, top, bottom, rowBands } } — geometry
// (full-res px) lets upload.js draw red boxes on wrongly-answered rows.
async function prepareColumnImages(fileData) {
    DBG = (typeof window !== 'undefined') ? (window.__imagingDebug = {}) : null;
    const img = await base64ToImage(fileData.base64, fileData.mimeType);
    let full = imageToCanvas(img);
    enhanceCanvas(full);

    try {
        // Orientation: worksheets are portrait. If the detected paper region
        // is landscape, stand it up; the 180° header check below corrects the
        // direction if this guess was the wrong way round. (A variance-based
        // "which way is the text" comparison was tried first and falsely
        // rotated upright photos — aspect ratio is deterministic.)
        let a = analyzeSmall(full);
        dbg('page', { ...a.page, w: a.w, h: a.h });
        const pageW = a.page.x1 - a.page.x0, pageH = a.page.y1 - a.page.y0;
        if (pageW > pageH * 1.15) {
            full = rotateCanvas(full, 90);
            a = analyzeSmall(full);
            dbg('rotated90', true);
        }

        // Upside down? (header ink should be above the table, margin below)
        if (flip180Needed(a.mask, a.w, a.h, a.page)) {
            full = rotateCanvas(full, 180);
            a = analyzeSmall(full);
            dbg('flipped180', true);
        }

        // Small tilt
        const skewAngle = skewScore(a.mask, a.w, a.h).angle;
        dbg('skewAngle', skewAngle);
        if (Math.abs(skewAngle) >= 0.5) {
            full = rotateCanvas(full, -skewAngle);
            a = analyzeSmall(full);
        }

        const layout = columnCuts(a.mask, a.w, a.h, a.page);
        if (!layout) throw new Error('table or columns not found (see __imagingDebug)');

        const scale = full.width / a.w;
        // Interior cuts sit just before the next column's first digit, so the
        // source pad must stay tiny or neighbouring digit slivers bleed in.
        // A white MARGIN is added around each crop instead — models misread
        // characters that touch the image edge.
        const padOuter = Math.round(full.width * 0.01);
        const padIn  = 4;
        const MARGIN = 14;
        const padY = Math.round(full.height * 0.01);
        const yTop = Math.max(0, Math.round(layout.t * scale) - padY);
        const yH = Math.min(full.height - yTop, Math.round((layout.b - layout.t) * scale) + 2 * padY);

        const parts = [], previews = [];
        for (let k = 0; k < COLUMN_COUNT; k++) {
            const xa = Math.max(0, Math.round(layout.cuts[k] * scale) - (k === 0 ? padOuter : padIn));
            const xb = Math.min(full.width, Math.round(layout.cuts[k + 1] * scale) + (k === COLUMN_COUNT - 1 ? padOuter : padIn));
            const c = document.createElement('canvas');
            c.width  = (xb - xa) + MARGIN * 2;
            c.height = yH + MARGIN * 2;
            const cx = c.getContext('2d');
            cx.fillStyle = '#fff';
            cx.fillRect(0, 0, c.width, c.height);
            cx.drawImage(full, xa, yTop, xb - xa, yH, MARGIN, MARGIN, xb - xa, yH);
            parts.push({ base64: c.toDataURL('image/jpeg', 0.92).split(',')[1], mimeType: 'image/jpeg' });
            previews.push(thumbnail(c));
        }

        // Geometry for the annotated result image (red boxes on wrong rows):
        // the processed page canvas plus column cuts and per-column text-line
        // bands, all in full-resolution pixel coordinates.
        const bandsPerCol = [];
        for (let k = 0; k < COLUMN_COUNT; k++) {
            bandsPerCol.push(
                detectRowBands(a.mask, a.w, layout.cuts[k], layout.cuts[k + 1], layout.t, layout.b)
                    .map(bd => ({ y0: Math.round(bd.y0 * scale), y1: Math.round((bd.y1 + 1) * scale) }))
            );
        }
        dbg('rowBandCounts', bandsPerCol.map(b => b.length));
        const geometry = {
            canvas: full,
            cutsX:  layout.cuts.map(x => Math.round(x * scale)),
            top:    Math.round(layout.t * scale),
            bottom: Math.round((layout.b + 1) * scale),
            rowBands: bandsPerCol
        };

        // Header strip (page top → table top): holds the handwritten Date
        // (top left) and Time in Sec (top right). Sent to the AI separately
        // so the worksheet's own date/time can be logged to My Performance.
        let headerPart = null;
        const hx0 = Math.max(0, Math.round(a.page.x0 * scale));
        const hx1 = Math.min(full.width, Math.round((a.page.x1 + 1) * scale));
        const hy0 = Math.max(0, Math.round(a.page.y0 * scale));
        const hy1 = Math.max(hy0, Math.round(layout.t * scale) - padY);
        if (hy1 - hy0 > full.height * 0.015) {
            const hc = document.createElement('canvas');
            hc.width  = (hx1 - hx0) + MARGIN * 2;
            hc.height = (hy1 - hy0) + MARGIN * 2;
            const hctx = hc.getContext('2d');
            hctx.fillStyle = '#fff';
            hctx.fillRect(0, 0, hc.width, hc.height);
            hctx.drawImage(full, hx0, hy0, hx1 - hx0, hy1 - hy0, MARGIN, MARGIN, hx1 - hx0, hy1 - hy0);
            headerPart = { base64: hc.toDataURL('image/jpeg', 0.92).split(',')[1], mimeType: 'image/jpeg' };
        }
        dbg('headerStrip', headerPart ? { hx0, hx1, hy0, hy1 } : 'none (too short)');

        return { parts, previews, split: true, geometry, headerPart };
    } catch (e) {
        console.warn('[imaging] column split fell back to full page:', e.message, window.__imagingDebug);
        return {
            parts: [{ base64: full.toDataURL('image/jpeg', 0.92).split(',')[1], mimeType: 'image/jpeg' }],
            previews: [thumbnail(full)],
            split: false,
            reason: e.message
        };
    }
}

// Enhance only (no split). Returns a single {base64, mimeType}.
async function prepareEnhancedImage(fileData) {
    const canvas = imageToCanvas(await base64ToImage(fileData.base64, fileData.mimeType));
    enhanceCanvas(canvas);
    return { base64: canvas.toDataURL('image/jpeg', 0.92).split(',')[1], mimeType: 'image/jpeg' };
}

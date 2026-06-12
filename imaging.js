// imaging.js — client-side image enhancement + column splitting.
// Pure canvas/JS, no external dependencies. Runs BEFORE sending a worksheet
// to the AI so that (a) handwriting is sharper and higher-contrast, and
// (b) each request covers only one column — far fewer problems per call
// means fewer miscounts and no cross-row digit borrowing.

const MAX_LONG_SIDE = 2600;   // downscale huge phone photos for processing speed
const COLUMN_COUNT  = 4;      // worksheets are laid out in 4 columns
const CONTRAST      = 1.4;    // >1 boosts contrast; keeps faint pencil visible

function base64ToImage(base64, mimeType) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => resolve(img);
        img.onerror = () => reject(new Error('Could not load image for processing'));
        img.src = `data:${mimeType};base64,${base64}`;
    });
}

// Draw the image onto a canvas, downscaling only if very large. Returns canvas.
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
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return canvas;
}

// Grayscale + contrast boost, then a 3x3 sharpen pass. Modifies canvas in place.
function enhanceCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    // Pass 1 — grayscale + linear contrast
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

    // Pass 2 — sharpen (3x3 high-pass kernel) to crisp up handwriting edges
    const src = ctx.getImageData(0, 0, w, h);
    const out = ctx.createImageData(w, h);
    const s = src.data, o = out.data;
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const di = (y * w + x) * 4;
            if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
                o[di] = o[di + 1] = o[di + 2] = s[di];   // copy edges unchanged
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

// Locate COLUMN_COUNT column regions by finding the lowest-ink vertical gaps
// near the expected column boundaries. Returns array of [startX, endX].
function detectColumnRegions(canvas) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d');

    // Sample the body only — skip header/footer where text spans full width.
    const y0 = Math.floor(h * 0.12), y1 = Math.floor(h * 0.95);
    const rows = y1 - y0;
    const d = ctx.getImageData(0, y0, w, rows).data;

    // density[x] = number of dark (ink) pixels in that pixel-column
    const density = new Float32Array(w);
    for (let y = 0; y < rows; y++) {
        const base = y * w * 4;
        for (let x = 0; x < w; x++) {
            if (d[base + x * 4] < 110) density[x]++;
        }
    }

    // For each internal boundary, snap to the emptiest column within a window.
    const cuts = [0];
    const win = Math.round(w * 0.08);
    for (let k = 1; k < COLUMN_COUNT; k++) {
        const center = Math.round((w * k) / COLUMN_COUNT);
        let bestX = center, bestVal = Infinity;
        const from = Math.max(1, center - win), to = Math.min(w - 2, center + win);
        for (let x = from; x <= to; x++) {
            if (density[x] < bestVal) { bestVal = density[x]; bestX = x; }
        }
        cuts.push(bestX);
    }
    cuts.push(w);

    const regions = [];
    for (let k = 0; k < cuts.length - 1; k++) regions.push([cuts[k], cuts[k + 1]]);
    return regions;
}

// Crop one [startX, endX] region (full height) to its own JPEG base64.
function cropColumn(canvas, [x0, x1]) {
    const pad = Math.round((x1 - x0) * 0.02);
    const sx = Math.max(0, x0 - pad);
    const sw = Math.min(canvas.width - sx, (x1 - x0) + pad * 2);
    const c = document.createElement('canvas');
    c.width = sw;
    c.height = canvas.height;
    c.getContext('2d').drawImage(canvas, sx, 0, sw, canvas.height, 0, 0, sw, canvas.height);
    return c.toDataURL('image/jpeg', 0.92).split(',')[1];
}

// Enhance, then split into 4 column images. Returns array of {base64, mimeType}.
// Falls back to a single enhanced image if column detection looks wrong.
async function prepareColumnImages(fileData) {
    const canvas = imageToCanvas(await base64ToImage(fileData.base64, fileData.mimeType));
    enhanceCanvas(canvas);

    const regions = detectColumnRegions(canvas);
    const minW = canvas.width * 0.10;
    const looksRight = regions.length === COLUMN_COUNT &&
                       regions.every(([a, b]) => (b - a) > minW);

    if (!looksRight) {
        return [{ base64: canvas.toDataURL('image/jpeg', 0.92).split(',')[1], mimeType: 'image/jpeg' }];
    }
    return regions.map(r => ({ base64: cropColumn(canvas, r), mimeType: 'image/jpeg' }));
}

// Enhance only (no split). Returns a single {base64, mimeType}.
async function prepareEnhancedImage(fileData) {
    const canvas = imageToCanvas(await base64ToImage(fileData.base64, fileData.mimeType));
    enhanceCanvas(canvas);
    return { base64: canvas.toDataURL('image/jpeg', 0.92).split(',')[1], mimeType: 'image/jpeg' };
}

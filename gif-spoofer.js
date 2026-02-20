/**
 * GIF Spoofer — converts any image to a single-frame static .gif
 *
 * Uses manual GIF89a binary construction — zero external dependencies.
 * The GIF specification is simple enough for single-frame images:
 *   Header  →  Logical Screen Descriptor  →  Global Color Table
 *   →  Image Descriptor  →  LZW Compressed Data  →  Trailer
 */

const GifSpoofer = (() => {
    /* ── LZW-compress pixel indices for GIF ── */
    function lzwEncode(indices, minCodeSize) {
        const clearCode = 1 << minCodeSize;
        const eoiCode = clearCode + 1;

        let codeSize = minCodeSize + 1;
        let nextCode = eoiCode + 1;
        const maxTableSize = 4096;

        // Build initial table
        let table = new Map();
        for (let i = 0; i < clearCode; i++) {
            table.set(String(i), i);
        }

        const output = [];
        let buffer = 0;
        let bufferLen = 0;

        function writeBits(code, size) {
            buffer |= code << bufferLen;
            bufferLen += size;
            while (bufferLen >= 8) {
                output.push(buffer & 0xff);
                buffer >>= 8;
                bufferLen -= 8;
            }
        }

        writeBits(clearCode, codeSize);

        let w = String(indices[0]);

        for (let i = 1; i < indices.length; i++) {
            const k = String(indices[i]);
            const wk = w + ',' + k;

            if (table.has(wk)) {
                w = wk;
            } else {
                writeBits(table.get(w), codeSize);

                if (nextCode < maxTableSize) {
                    table.set(wk, nextCode++);
                    if (nextCode > (1 << codeSize) && codeSize < 12) {
                        codeSize++;
                    }
                } else {
                    // Table full → clear
                    writeBits(clearCode, codeSize);
                    table = new Map();
                    for (let j = 0; j < clearCode; j++) {
                        table.set(String(j), j);
                    }
                    nextCode = eoiCode + 1;
                    codeSize = minCodeSize + 1;
                }

                w = k;
            }
        }

        writeBits(table.get(w), codeSize);
        writeBits(eoiCode, codeSize);

        if (bufferLen > 0) output.push(buffer & 0xff);

        return new Uint8Array(output);
    }

    /* ── Median-cut colour quantisation to 256 colours ── */
    function quantize(imageData) {
        const { data, width, height } = imageData;
        const pixelCount = width * height;

        // Gather unique-ish pixels (sample if huge image)
        const sampleStep = pixelCount > 100000 ? Math.floor(pixelCount / 50000) : 1;
        const samples = [];
        for (let i = 0; i < pixelCount; i += sampleStep) {
            const off = i * 4;
            samples.push([data[off], data[off + 1], data[off + 2]]);
        }

        // Median-cut
        function medianCut(pixels, depth) {
            if (depth === 0 || pixels.length === 0) {
                // Average colour
                let r = 0, g = 0, b = 0;
                for (const p of pixels) { r += p[0]; g += p[1]; b += p[2]; }
                const n = pixels.length || 1;
                return [[Math.round(r / n), Math.round(g / n), Math.round(b / n)]];
            }

            // Find channel with largest range
            let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
            for (const p of pixels) {
                if (p[0] < minR) minR = p[0]; if (p[0] > maxR) maxR = p[0];
                if (p[1] < minG) minG = p[1]; if (p[1] > maxG) maxG = p[1];
                if (p[2] < minB) minB = p[2]; if (p[2] > maxB) maxB = p[2];
            }
            const rangeR = maxR - minR, rangeG = maxG - minG, rangeB = maxB - minB;
            const ch = rangeR >= rangeG && rangeR >= rangeB ? 0 : rangeG >= rangeB ? 1 : 2;

            pixels.sort((a, b) => a[ch] - b[ch]);
            const mid = pixels.length >> 1;

            return [
                ...medianCut(pixels.slice(0, mid), depth - 1),
                ...medianCut(pixels.slice(mid), depth - 1),
            ];
        }

        const palette = medianCut(samples, 8); // up to 256 colours
        while (palette.length < 256) palette.push([0, 0, 0]);
        palette.length = 256;

        // Map every pixel to nearest palette index
        const indices = new Uint8Array(pixelCount);
        for (let i = 0; i < pixelCount; i++) {
            const off = i * 4;
            const pr = data[off], pg = data[off + 1], pb = data[off + 2];
            let bestIdx = 0, bestDist = Infinity;
            for (let c = 0; c < 256; c++) {
                const dr = pr - palette[c][0], dg = pg - palette[c][1], db = pb - palette[c][2];
                const d = dr * dr + dg * dg + db * db;
                if (d < bestDist) { bestDist = d; bestIdx = c; }
            }
            indices[i] = bestIdx;
        }

        return { palette, indices };
    }

    /* ── Build GIF binary ── */
    function buildGif(imageData) {
        const { width, height } = imageData;
        const { palette, indices } = quantize(imageData);

        const parts = [];

        // Helper: little-endian 16-bit
        const le16 = v => [v & 0xff, (v >> 8) & 0xff];

        // Header
        parts.push(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])); // GIF89a

        // Logical Screen Descriptor
        parts.push(new Uint8Array([
            ...le16(width), ...le16(height),
            0xf7,  // GCT flag, 8-bit colour
            0x00,  // bg colour index
            0x00,  // pixel aspect ratio
        ]));

        // Global Color Table (256 × 3)
        const gct = new Uint8Array(768);
        for (let i = 0; i < 256; i++) {
            gct[i * 3] = palette[i][0];
            gct[i * 3 + 1] = palette[i][1];
            gct[i * 3 + 2] = palette[i][2];
        }
        parts.push(gct);

        // Graphic Control Extension explicitly disables transparency
        // Fixes an issue on Discord where it might treat the Background Color Index (0) as transparent
        parts.push(new Uint8Array([
            0x21, 0xf9, 0x04, // Extension Introducer, Graphic Control Label, Block Size
            0x00,             // Packed Fields: no transparency (bit 0 is 0)
            0x00, 0x00,       // Delay Time
            0x00,             // Transparent Color Index (ignored)
            0x00              // Block Terminator
        ]));

        // Image Descriptor
        parts.push(new Uint8Array([
            0x2c,
            ...le16(0), ...le16(0),     // left, top
            ...le16(width), ...le16(height),
            0x00,  // no local colour table
        ]));

        // LZW Minimum Code Size
        const minCodeSize = 8;
        parts.push(new Uint8Array([minCodeSize]));

        // Image data sub-blocks
        const compressed = lzwEncode(indices, minCodeSize);
        let offset = 0;
        while (offset < compressed.length) {
            const chunkSize = Math.min(255, compressed.length - offset);
            parts.push(new Uint8Array([chunkSize]));
            parts.push(compressed.subarray(offset, offset + chunkSize));
            offset += chunkSize;
        }

        // Block terminator
        parts.push(new Uint8Array([0x00]));

        // Trailer
        parts.push(new Uint8Array([0x3b]));

        return new Blob(parts, { type: 'image/gif' });
    }

    /* ── Public API ── */
    function convert(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                try {
                    const gifBlob = buildGif(imageData);
                    resolve(gifBlob);
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    return { convert };
})();

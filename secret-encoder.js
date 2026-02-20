/**
 * Secret Encoder — LSB Steganography
 *
 * Hides text in the least-significant bits of R, G, B channels.
 * Format:
 *   - First 32 pixels → 32-bit message byte-length (1 bit per pixel, spread across R channel LSB)
 *   - Remaining pixels → UTF-8 encoded bytes, 3 bits per pixel (1 per R, G, B channel)
 *
 * Output MUST be PNG (lossless) to preserve the hidden data.
 */

const SecretEncoder = (() => {

    /* ── Encode secret into image ── */
    function encode(canvas, message) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const totalPixels = canvas.width * canvas.height;

        // Convert message to UTF-8 bytes
        const encoder = new TextEncoder();
        const msgBytes = encoder.encode(message);
        const msgLen = msgBytes.length;

        // Check capacity: 32 header pixels + ceil(msgLen * 8 / 3) data pixels
        const dataPixelsNeeded = Math.ceil(msgLen * 8 / 3);
        const totalNeeded = 32 + dataPixelsNeeded;

        if (totalNeeded > totalPixels) {
            throw new Error(`Message too long. Need ${totalNeeded} pixels but image only has ${totalPixels}.`);
        }

        // ── Write 32-bit length header (1 bit per pixel's R channel LSB) ──
        for (let i = 0; i < 32; i++) {
            const bit = (msgLen >> (31 - i)) & 1;
            const off = i * 4; // R channel
            data[off] = (data[off] & 0xfe) | bit;
        }

        // ── Write message bits into R, G, B LSBs (3 bits per pixel) ──
        // Flatten all message bytes into a bit stream
        const bits = [];
        for (let b = 0; b < msgLen; b++) {
            for (let bit = 7; bit >= 0; bit--) {
                bits.push((msgBytes[b] >> bit) & 1);
            }
        }

        let bitIdx = 0;
        for (let p = 32; p < totalPixels && bitIdx < bits.length; p++) {
            const off = p * 4;
            // R
            if (bitIdx < bits.length) {
                data[off] = (data[off] & 0xfe) | bits[bitIdx++];
            }
            // G
            if (bitIdx < bits.length) {
                data[off + 1] = (data[off + 1] & 0xfe) | bits[bitIdx++];
            }
            // B
            if (bitIdx < bits.length) {
                data[off + 2] = (data[off + 2] & 0xfe) | bits[bitIdx++];
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Return as PNG blob
        return new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), 'image/png');
        });
    }

    /* ── Decode hidden text from image ── */
    function decode(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const totalPixels = canvas.width * canvas.height;

        if (totalPixels < 32) {
            throw new Error('Image too small to contain a hidden message.');
        }

        // ── Read 32-bit length header ──
        let msgLen = 0;
        for (let i = 0; i < 32; i++) {
            const bit = data[i * 4] & 1;
            msgLen = (msgLen << 1) | bit;
        }

        // Sanity check
        if (msgLen <= 0 || msgLen > totalPixels) {
            throw new Error('No hidden message found or image is corrupted.');
        }

        const totalBits = msgLen * 8;
        const bits = [];

        // ── Read message bits from R, G, B LSBs ──
        let bitIdx = 0;
        for (let p = 32; p < totalPixels && bitIdx < totalBits; p++) {
            const off = p * 4;
            if (bitIdx < totalBits) bits.push(data[off] & 1), bitIdx++;
            if (bitIdx < totalBits) bits.push(data[off + 1] & 1), bitIdx++;
            if (bitIdx < totalBits) bits.push(data[off + 2] & 1), bitIdx++;
        }

        // Reconstruct bytes
        const bytes = new Uint8Array(msgLen);
        for (let b = 0; b < msgLen; b++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                byte = (byte << 1) | (bits[b * 8 + bit] || 0);
            }
            bytes[b] = byte;
        }

        const decoder = new TextDecoder();
        return decoder.decode(bytes);
    }

    /* ── Capacity: how many UTF-8 characters roughly fit ── */
    function capacity(canvas) {
        const totalPixels = canvas.width * canvas.height;
        const dataPixels = totalPixels - 32; // subtract header
        const totalBits = dataPixels * 3;    // 3 bits per pixel
        const totalBytes = Math.floor(totalBits / 8);
        // UTF-8 worst case: ~3 bytes/char for non-ASCII. Use 1 byte/char as upper bound hint.
        return Math.max(0, totalBytes);
    }

    return { encode, decode, capacity };
})();

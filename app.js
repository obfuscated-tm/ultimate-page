/**
 * App Shell — wires up sidebar navigation, drop-zones,
 * and connects the GIF Spoofer / Secret Encoder modules.
 */

document.addEventListener('DOMContentLoaded', () => {

    /* ═══════════ Helpers ═══════════ */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    function isImageFile(file) {
        if (!file) return false;
        if (file.type && file.type.startsWith('image/')) return true;
        const name = file.name ? file.name.toLowerCase() : '';
        return !!name.match(/\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|svg)$/);
    }

    function toast(msg) {
        const c = $('#toast-container');
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = msg;
        c.appendChild(el);
        setTimeout(() => el.remove(), 3200);
    }

    function loadFileToCanvas(file, canvas) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(img.src);
                resolve();
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    /* ═══════════ Generic drop-zone wiring ═══════════ */
    function wireDropZone(zoneEl, inputEl, onFile) {
        zoneEl.addEventListener('dragover', e => {
            e.preventDefault();
            zoneEl.classList.add('drop-zone--dragover');
        });

        zoneEl.addEventListener('dragleave', () => {
            zoneEl.classList.remove('drop-zone--dragover');
        });

        zoneEl.addEventListener('drop', e => {
            e.preventDefault();
            zoneEl.classList.remove('drop-zone--dragover');
            const file = e.dataTransfer.files[0];
            if (file) onFile(file);
        });

        inputEl.addEventListener('change', () => {
            const file = inputEl.files[0];
            if (file) onFile(file);
        });

        inputEl.addEventListener('click', (e) => {
            e.target.value = '';
        });
    }

    /* ═══════════ Sidebar ↔ Panel Navigation ═══════════ */
    const welcome = $('#welcome');
    const panels = $$('.module-panel');
    const toolBtns = $$('.sidebar__tool-btn');
    let activePanel = null;

    function openPanel(id) {
        // Hide welcome
        welcome.style.display = 'none';

        // Close any open panel
        panels.forEach(p => {
            p.classList.remove('module-panel--open');
            p.setAttribute('aria-hidden', 'true');
        });

        // Open the target
        const panel = $(`#panel-${id}`);
        if (!panel) return;
        panel.classList.add('module-panel--open');
        panel.setAttribute('aria-hidden', 'false');
        activePanel = id;

        // Highlight sidebar button
        toolBtns.forEach(b => b.classList.remove('active'));
        const btn = $(`[data-module="${id}"]`);
        if (btn) btn.classList.add('active');

        // Lazy init GitHub profile
        if (id === 'gh' && !window._ghLoaded) {
            window._ghLoaded = true;
            GitHubProfile.init('gh-profile-container');
        }

        // Close mobile sidebar if open
        sidebar.classList.remove('sidebar--open');
    }

    function closePanel() {
        panels.forEach(p => {
            p.classList.remove('module-panel--open');
            p.setAttribute('aria-hidden', 'true');
        });
        toolBtns.forEach(b => b.classList.remove('active'));
        welcome.style.display = '';
        activePanel = null;
    }

    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mod = btn.dataset.module;
            if (activePanel === mod) {
                // Toggle off if clicking the same button
                closePanel();
            } else {
                openPanel(mod);
            }
        });
    });

    /* ═══════════ Mobile Sidebar Toggle ═══════════ */
    const sidebar = $('#sidebar');
    const sidebarToggle = $('#sidebar-toggle');

    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar--open');
    });

    // Close sidebar on clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            sidebar.classList.contains('sidebar--open') &&
            !sidebar.contains(e.target) &&
            e.target !== sidebarToggle) {
            sidebar.classList.remove('sidebar--open');
        }
    });

    /* ═══════════ GIF Spoofer ═══════════ */
    const gifResult = $('#gif-result');
    const gifPreview = $('#gif-preview');
    const gifDownload = $('#gif-download');
    const gifOpen = $('#gif-open');

    async function handleGifFile(file) {
        if (!isImageFile(file)) {
            toast('Please drop an image file.');
            return;
        }

        toast('Converting to GIF…');
        try {
            const gifBlob = await GifSpoofer.convert(file);
            const url = URL.createObjectURL(gifBlob);

            gifPreview.src = url;
            gifDownload.href = url;
            gifOpen.href = url;
            gifResult.style.display = '';
            toast('GIF ready! 🎉');
        } catch (err) {
            console.error(err);
            toast('Conversion failed: ' + err.message);
        }
    }

    wireDropZone($('#gif-drop'), $('#gif-file-input'), handleGifFile);

    /* ═══════════ Secret Encoder ═══════════ */
    const stegCanvas = $('#steg-encode-canvas');
    const stegControls = $('#steg-encode-controls');
    const stegMessage = $('#steg-message');
    const stegCharCount = $('#steg-char-count');
    const stegCapacity = $('#steg-capacity');

    function updateStegCapacity() {
        if (stegCanvas.width > 0) {
            stegCapacity.textContent = SecretEncoder.capacity(stegCanvas).toLocaleString();
        }
    }

    stegMessage.addEventListener('input', () => {
        stegCharCount.textContent = new TextEncoder().encode(stegMessage.value).length;
    });

    // Upload image for encoding
    async function handleStegEncodeFile(file) {
        if (!isImageFile(file)) { toast('Please drop an image file.'); return; }
        try {
            await loadFileToCanvas(file, stegCanvas);
            stegControls.style.display = '';
            updateStegCapacity();
            toast('Image loaded — type your secret!');
        } catch (err) {
            toast('Failed to load image.');
        }
    }

    wireDropZone($('#steg-encode-drop'), $('#steg-encode-file'), handleStegEncodeFile);

    // Blank canvas
    $('#steg-blank-canvas').addEventListener('click', () => {
        stegCanvas.width = 512;
        stegCanvas.height = 512;
        const ctx = stegCanvas.getContext('2d');
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, 512, 512);
        stegControls.style.display = '';
        updateStegCapacity();
        toast('Blank canvas created (512 × 512).');
    });

    // Encode button
    $('#steg-encode-btn').addEventListener('click', async () => {
        const msg = stegMessage.value;
        if (!msg) { toast('Type a message first.'); return; }
        if (stegCanvas.width === 0) { toast('Load an image first.'); return; }

        try {
            // Work on a clone so the visible preview stays unchanged
            const clone = document.createElement('canvas');
            clone.width = stegCanvas.width;
            clone.height = stegCanvas.height;
            clone.getContext('2d').drawImage(stegCanvas, 0, 0);

            const blob = await SecretEncoder.encode(clone, msg);
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'encoded.png';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            toast('Encoded image downloaded!');
        } catch (err) {
            toast('Encode failed: ' + err.message);
        }
    });

    // Sub-tabs (Encode / Decode)
    $$('.sub-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.sub-tab').forEach(t => t.classList.remove('sub-tab--active'));
            tab.classList.add('sub-tab--active');
            const target = tab.dataset.subtab;
            $('#steg-encode').style.display = target === 'encode' ? '' : 'none';
            $('#steg-decode').style.display = target === 'decode' ? '' : 'none';
        });
    });

    // Decode
    const stegDecodeResult = $('#steg-decode-result');
    const stegDecodedText = $('#steg-decoded-text');

    async function handleStegDecodeFile(file) {
        if (!isImageFile(file)) { toast('Please drop an image file.'); return; }
        try {
            const canvas = document.createElement('canvas');
            await loadFileToCanvas(file, canvas);
            const text = SecretEncoder.decode(canvas);
            stegDecodedText.textContent = text;
            stegDecodeResult.style.display = '';
            toast('Message revealed!');
        } catch (err) {
            stegDecodeResult.style.display = 'none';
            toast('Decode failed: ' + err.message);
        }
    }

    wireDropZone($('#steg-decode-drop'), $('#steg-decode-file'), handleStegDecodeFile);

    /* ═══════════ Stencil ═══════════ */
    const stencilPreviewArea = $('#stencil-preview-area');
    const stencilPreviewImg = $('#stencil-preview-img');
    let stencilObjectURL = null;

    function handleStencilFile(file) {
        if (!isImageFile(file)) {
            toast('Please drop an image file.');
            return;
        }
        // Revoke previous preview URL
        if (stencilObjectURL) {
            URL.revokeObjectURL(stencilObjectURL);
        }
        stencilObjectURL = URL.createObjectURL(file);
        stencilPreviewImg.src = stencilObjectURL;
        stencilPreviewArea.style.display = '';
        toast('Image loaded — tap the button to go fullscreen!');
    }

    wireDropZone($('#stencil-drop'), $('#stencil-file-input'), handleStencilFile);

    // Fullscreen button
    $('#stencil-fullscreen-btn').addEventListener('click', () => {
        if (!stencilPreviewImg.src) {
            toast('Load an image first.');
            return;
        }
        Stencil.open(stencilPreviewImg.src);
    });

    /* ═══════════ Global Paste Handler ═══════════ */
    document.addEventListener('paste', (e) => {
        if (!activePanel) return;

        // The Font Inspector has its own paste handlers, so we ignore it here
        if (activePanel === 'font') return;

        const items = e.clipboardData.items;
        let imageFile = null;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image/') === 0) {
                imageFile = items[i].getAsFile();
                break;
            }
        }

        if (!imageFile) return;

        // Prevent default only if we found an image and we are handling it
        e.preventDefault();

        if (activePanel === 'gif') {
            handleGifFile(imageFile);
        } else if (activePanel === 'steg') {
            const activeTabMatch = document.querySelector('.sub-tab--active');
            if (activeTabMatch) {
                const activeTab = activeTabMatch.dataset.subtab;
                if (activeTab === 'encode') {
                    handleStegEncodeFile(imageFile);
                } else if (activeTab === 'decode') {
                    handleStegDecodeFile(imageFile);
                }
            }
        } else if (activePanel === 'stencil') {
            handleStencilFile(imageFile);
        }
    });

});

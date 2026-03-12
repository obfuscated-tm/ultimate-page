/**
 * Stencil Tool – Fullscreen image overlay for tracing.
 *
 * Features:
 *  - Upload or paste an image
 *  - Scale slider (1–500%) with number input for unlimited fine control
 *  - Opacity slider (default 100%)
 *  - X / Y position controls to pan the image
 *  - Background toggle (black ↔ white)
 *  - Pinch-zoom prevention specifically on the overlay (not whole page)
 *  - X button + Escape to exit
 */

const Stencil = (() => {

  /* ── DOM refs (set once in ensureOverlay) ── */
  let overlayEl = null;
  let imgEl = null;
  let imgWrap = null;
  let closeBtn = null;
  let bgToggleBtn = null;

  let scaleSlider, scaleInput;
  let opacitySlider, opacityInput;
  let xSlider, xInput;
  let ySlider, yInput;

  let imgSrc = null;

  /* ── State ── */
  let state = { scale: 100, opacity: 100, x: 0, y: 0, bgWhite: false, renderIdx: 0 };

  // image-rendering modes: [ cssValue, label ]
  const RENDER_MODES = [
    { css: 'auto',         label: 'Linear' },
    { css: 'pixelated',   label: 'Nearest' },
    { css: 'crisp-edges', label: 'Crisp' },
  ];

  function updateTransform() {
    imgEl.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale / 100})`;
    imgEl.style.opacity = state.opacity / 100;
  }

  function applyRenderMode() {
    const mode = RENDER_MODES[state.renderIdx];
    imgEl.style.imageRendering = mode.css;
  }

  /* ── Sync a slider ↔ number-input pair ── */
  function syncPair(slider, input, key, suffix, applyFn, isLogarithmic = false) {
    const handleInput = () => {
      state[key] = Number(input.value);
      if (isLogarithmic) {
        // Find what slider value maps to this scale mathematically
        const minVal = Math.log10(1); 
        const maxVal = Math.log10(500);
        const targetVal = Math.log10(Math.max(1, Math.min(500, state[key])));
        const range = maxVal - minVal;
        slider.value = ((targetVal - minVal) / range) * 1000;
      } else {
        slider.value = Math.min(Math.max(state[key], Number(slider.min)), Number(slider.max));
      }
      applyFn();
    };
    
    input.addEventListener('input', handleInput);

    slider.addEventListener('input', () => {
      if (isLogarithmic) {
        const minVal = Math.log10(1);
        const maxVal = Math.log10(500);
        const range = maxVal - minVal;
        const normalized = Number(slider.value) / 1000; // slider goes 0-1000 internally
        state[key] = Math.round(Math.pow(10, minVal + (range * normalized)));
      } else {
        state[key] = Number(slider.value);
      }
      input.value = state[key];
      applyFn();
    });
  }

  /* ── Build the fullscreen overlay (once) ── */
  function ensureOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.className = 'stencil-overlay';
    overlayEl.id = 'stencil-overlay';

    overlayEl.innerHTML = `
      <div class="stencil-overlay__img-wrap" id="stencil-img-wrap">
        <img class="stencil-overlay__img" id="stencil-overlay-img" draggable="false" alt="Stencil image">
      </div>

      <div class="stencil-overlay__toolbar" id="stencil-toolbar">
        <!-- Collapse / expand toggle -->
        <button class="stencil-toolbar__collapse" id="stencil-toolbar-collapse" aria-label="Toggle toolbar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        <div class="stencil-toolbar__body" id="stencil-toolbar-body">
          <!-- Row 1: Scale + Opacity + BG toggle -->
          <div class="stencil-toolbar__row">
            <div class="stencil-overlay__control">
              <label class="stencil-overlay__label" for="stencil-scale">Scale</label>
              <input type="range" id="stencil-scale" class="stencil-overlay__slider" min="0" max="1000" value="0" step="1">
              <input type="number" id="stencil-scale-input" class="stencil-overlay__num" value="100" min="1" max="9999" step="1">
              <span class="stencil-overlay__unit">%</span>
            </div>

            <div class="stencil-overlay__control">
              <label class="stencil-overlay__label" for="stencil-opacity">Opacity</label>
              <input type="range" id="stencil-opacity" class="stencil-overlay__slider" min="5" max="100" value="100" step="1">
              <input type="number" id="stencil-opacity-input" class="stencil-overlay__num" value="100" min="5" max="100" step="1">
              <span class="stencil-overlay__unit">%</span>
            </div>

            <button class="stencil-overlay__pill-toggle" id="stencil-bg-toggle" aria-label="Toggle background color">
              <span class="stencil-pill__swatch" id="stencil-bg-swatch"></span>
              <span class="stencil-pill__text" id="stencil-bg-text">Black BG</span>
            </button>
          </div>

          <!-- Row 2: X + Y + Fit toggle -->
          <div class="stencil-toolbar__row">
            <div class="stencil-overlay__control">
              <label class="stencil-overlay__label" for="stencil-x">X</label>
              <input type="range" id="stencil-x" class="stencil-overlay__slider" min="-2000" max="2000" value="0" step="1">
              <input type="number" id="stencil-x-input" class="stencil-overlay__num" value="0" step="1">
              <span class="stencil-overlay__unit">px</span>
            </div>

            <div class="stencil-overlay__control">
              <label class="stencil-overlay__label" for="stencil-y">Y</label>
              <input type="range" id="stencil-y" class="stencil-overlay__slider" min="-2000" max="2000" value="0" step="1">
              <input type="number" id="stencil-y-input" class="stencil-overlay__num" value="0" step="1">
              <span class="stencil-overlay__unit">px</span>
            </div>

            <button class="stencil-overlay__pill-toggle stencil-overlay__pill-toggle--active" id="stencil-render-toggle" aria-label="Cycle image rendering mode">
              <span class="stencil-pill__text" id="stencil-render-text">Linear</span>
            </button>
          </div>
        </div>
      </div>

      <button class="stencil-overlay__close" id="stencil-overlay-close" aria-label="Close stencil">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    document.body.appendChild(overlayEl);

    /* ── Grab refs ── */
    imgEl      = overlayEl.querySelector('#stencil-overlay-img');
    imgWrap    = overlayEl.querySelector('#stencil-img-wrap');
    closeBtn   = overlayEl.querySelector('#stencil-overlay-close');
    bgToggleBtn = overlayEl.querySelector('#stencil-bg-toggle');

    scaleSlider   = overlayEl.querySelector('#stencil-scale');
    scaleInput    = overlayEl.querySelector('#stencil-scale-input');
    opacitySlider = overlayEl.querySelector('#stencil-opacity');
    opacityInput  = overlayEl.querySelector('#stencil-opacity-input');
    xSlider       = overlayEl.querySelector('#stencil-x');
    xInput        = overlayEl.querySelector('#stencil-x-input');
    ySlider       = overlayEl.querySelector('#stencil-y');
    yInput        = overlayEl.querySelector('#stencil-y-input');

    /* ── Wire slider ↔ input pairs ── */
    syncPair(scaleSlider, scaleInput, 'scale', '%', updateTransform, true); // Logarithmic slider
    syncPair(opacitySlider, opacityInput, 'opacity', '%', updateTransform);
    syncPair(xSlider, xInput, 'x', 'px', updateTransform);
    syncPair(ySlider, yInput, 'y', 'px', updateTransform);

    /* ── Background Toggle ── */
    const bgSwatch = overlayEl.querySelector('#stencil-bg-swatch');
    const bgText   = overlayEl.querySelector('#stencil-bg-text');

    bgToggleBtn.addEventListener('click', () => {
      state.bgWhite = !state.bgWhite;
      if (state.bgWhite) {
        overlayEl.classList.add('stencil-overlay--white-bg');
        bgSwatch.style.background = '#fff';
        bgText.textContent = 'White BG';
        bgToggleBtn.classList.add('stencil-overlay__pill-toggle--active');
      } else {
        overlayEl.classList.remove('stencil-overlay--white-bg');
        bgSwatch.style.background = '#111';
        bgText.textContent = 'Black BG';
        bgToggleBtn.classList.remove('stencil-overlay__pill-toggle--active');
      }
    });

    /* ── Render Mode Cycle Toggle ── */
    const renderToggle = overlayEl.querySelector('#stencil-render-toggle');
    const renderText   = overlayEl.querySelector('#stencil-render-text');

    renderToggle.addEventListener('click', () => {
      state.renderIdx = (state.renderIdx + 1) % RENDER_MODES.length;
      const mode = RENDER_MODES[state.renderIdx];
      renderText.textContent = mode.label;
      // Highlight only when not on the default (Linear)
      renderToggle.classList.toggle('stencil-overlay__pill-toggle--active', state.renderIdx === 0);
      applyRenderMode();
    });

    /* ── Toolbar collapse/expand ── */
    const toolbarBody = overlayEl.querySelector('#stencil-toolbar-body');
    const collapseBtn = overlayEl.querySelector('#stencil-toolbar-collapse');
    const toolbar = overlayEl.querySelector('#stencil-toolbar');

    collapseBtn.addEventListener('click', () => {
      const isCollapsed = toolbar.classList.toggle('stencil-overlay__toolbar--collapsed');
      collapseBtn.setAttribute('aria-label', isCollapsed ? 'Expand toolbar' : 'Collapse toolbar');
    });

    /* ── Close ── */
    closeBtn.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlayEl.classList.contains('stencil-overlay--open')) {
        close();
      }
    });

    /* ══════════════════════════════════════════
       Mobile pinch-zoom prevention — overlay only
       ══════════════════════════════════════════ */

    // 1. Prevent touchmove on everything except sliders / inputs
    overlayEl.addEventListener('touchmove', (e) => {
      const tag = e.target.tagName;
      const isSlider = e.target.classList.contains('stencil-overlay__slider');
      const isInput  = tag === 'INPUT';
      if (!isSlider && !isInput) {
        e.preventDefault();
      }
    }, { passive: false });

    // 2. Block multi-touch (pinch gesture) globally on the overlay
    overlayEl.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });

    // 3. Safari-specific: gesturestart / gesturechange
    overlayEl.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    overlayEl.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
    overlayEl.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

    // 4. Prevent double-tap zoom on the overlay
    let lastTap = 0;
    overlayEl.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
      }
      lastTap = now;
    }, { passive: false });
  }

  /* ── Open overlay with current image ── */
  function open(src) {
    ensureOverlay();
    imgSrc = src;
    imgEl.src = src;

    // Reset state
    state = { scale: 100, opacity: 100, x: 0, y: 0, bgWhite: false, renderIdx: 0 };

    scaleInput.value = 100;
    // Logarithmic slider initialization (maps 100 to the 0-1000 range)
    const minVal = Math.log10(1); 
    const maxVal = Math.log10(500);
    const range = maxVal - minVal;
    scaleSlider.value = ((Math.log10(100) - minVal) / range) * 1000;
    
    opacitySlider.value = 100; opacityInput.value = 100;
    xSlider.value = 0;         xInput.value = 0;
    ySlider.value = 0;         yInput.value = 0;

    overlayEl.classList.remove('stencil-overlay--white-bg');
    overlayEl.querySelector('#stencil-bg-swatch').style.background = '#111';
    overlayEl.querySelector('#stencil-bg-text').textContent = 'Black BG';
    overlayEl.querySelector('#stencil-bg-toggle').classList.remove('stencil-overlay__pill-toggle--active');

    // Reset render mode toggle
    overlayEl.querySelector('#stencil-render-text').textContent = 'Linear';
    overlayEl.querySelector('#stencil-render-toggle').classList.add('stencil-overlay__pill-toggle--active');
    applyRenderMode();

    // Ensure toolbar is expanded on open
    overlayEl.querySelector('#stencil-toolbar').classList.remove('stencil-overlay__toolbar--collapsed');

    updateTransform();

    overlayEl.classList.add('stencil-overlay--open');
    document.body.style.overflow = 'hidden';
  }

  /* ── Close overlay ── */
  function close() {
    if (!overlayEl) return;
    overlayEl.classList.remove('stencil-overlay--open');
    document.body.style.overflow = '';
    if (imgSrc && imgSrc.startsWith('blob:')) {
      URL.revokeObjectURL(imgSrc);
    }
    imgSrc = null;
  }

  /* ── Handle a file ── */
  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return false;
    const url = URL.createObjectURL(file);
    open(url);
    return true;
  }

  return { open, close, handleFile };
})();

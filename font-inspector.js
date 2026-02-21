/**
 * Font Inspector
 *
 * Allows users to paste rich text into a contenteditable zone
 * to extract and inspect the applied fonts, sizes, weights, and colours.
 */

const FontInspector = (() => {
  const DEFAULT_TEXT = "Paste or type something above to inspect fonts.";

  /* ── DOM Elements ── */
  let pasteTarget;
  let inspectorOutput;
  let clearBtn;

  /* ── Helpers ── */
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const original = btn.textContent;
      btn.textContent = "Copied!";
      btn.classList.add("btn--success");
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("btn--success");
      }, 1200);
    });
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb.indexOf('rgb') !== 0) return rgb;
    // Parse 'rgb(r, g, b)' or 'rgba(r, g, b, a)'
    const values = rgb.match(/\d+(\.\d+)?/g);
    if (!values || values.length < 3) return rgb;
    const r = Number(values[0]);
    const g = Number(values[1]);
    const b = Number(values[2]);
    const a = values[3] !== undefined ? Number(values[3]) : undefined;

    const toHex = (n) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    if (a !== undefined) {
      return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a * 255)}`;
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /* ── Initialization ── */
  function init(targetId, outputId, clearBtnId) {
    pasteTarget = document.getElementById(targetId);
    inspectorOutput = document.getElementById(outputId);
    clearBtn = document.getElementById(clearBtnId);

    if (!pasteTarget || !inspectorOutput) return;

    pasteTarget.addEventListener("paste", (e) => {
      e.preventDefault();
      const html = e.clipboardData.getData("text/html");
      const plain = e.clipboardData.getData("text/plain");

      if (html) {
        pasteTarget.innerHTML = html;
        inspectRichText(pasteTarget, inspectorOutput);
      } else {
        pasteTarget.textContent = plain;
        inspectPlainText(plain, inspectorOutput);
      }
      clearBtn.style.display = "inline-flex";
    });

    pasteTarget.addEventListener("input", () => {
      if (!pasteTarget.innerHTML.trim() || pasteTarget.innerHTML === "<br>") {
        resetInspector();
      }
    });

    clearBtn.addEventListener("click", () => {
      pasteTarget.innerHTML = "";
      resetInspector();
    });
  }

  function resetInspector() {
    inspectorOutput.innerHTML = `<p class="inspector-empty">${DEFAULT_TEXT}</p>`;
    clearBtn.style.display = "none";
  }

  /* ── Inspection Logic ── */
  function inspectPlainText(text, output) {
    const style = getComputedStyle(pasteTarget);
    output.innerHTML = `
      <div class="source-badge source-badge--plain"><span class="badge-dot"></span> Plain text pasted</div>
      <div class="props-grid">
        ${makeProp("font-family", style.fontFamily)}
        ${makeProp("font-size", style.fontSize)}
        ${makeProp("font-weight", style.fontWeight)}
        ${makeProp("line-height", style.lineHeight)}
        ${style.letterSpacing !== 'normal' ? makeProp("letter-spacing", style.letterSpacing) : ""}
        ${makeProp("color (RGB)", style.color, true)}
        ${makeProp("color (HEX)", rgbToHex(style.color), true)}
      </div>`;
  }

  function inspectRichText(container, output) {
    const spans = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    let node;

    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (!text) continue;

      const el = node.parentElement;
      const cs = getComputedStyle(el);
      spans.push({
        text: text.slice(0, 60) + (text.length > 60 ? "…" : ""),
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textTransform: cs.textTransform,
        color: cs.color,
        fontStyle: cs.fontStyle,
      });
    }

    if (!spans.length) {
      output.innerHTML = '<div class="source-badge source-badge--error"><span class="badge-dot"></span> No inspectable text found</div>';
      return;
    }

    // Summary props (first span)
    const first = spans[0];
    let html = `
      <div class="source-badge source-badge--rich">
        <span class="badge-dot"></span> Rich text pasted — ${spans.length} text span${spans.length > 1 ? "s" : ""} detected
      </div>
      <div class="props-grid">
        ${makeProp("font-family", first.fontFamily)}
        ${makeProp("font-size", first.fontSize)}
        ${makeProp("font-weight", first.fontWeight)}
        ${makeProp("line-height", first.lineHeight)}
        ${first.letterSpacing !== 'normal' ? makeProp("letter-spacing", first.letterSpacing) : ""}
        ${first.fontStyle !== "normal" ? makeProp("font-style", first.fontStyle) : ""}
        ${first.textTransform !== "none" ? makeProp("text-transform", first.textTransform) : ""}
        ${makeProp("color (RGB)", first.color, true)}
        ${makeProp("color (HEX)", rgbToHex(first.color), true)}
      </div>`;

    // Spans table if there are multiple styles
    if (spans.length > 1) {
      html += `
        <div class="spans-table-wrap">
          <table class="spans-table">
            <thead>
              <tr><th>Text</th><th>Font</th><th>Size</th><th>Weight</th><th>Color</th></tr>
            </thead>
            <tbody>
              ${spans.map(s => `<tr>
                <td class="st-text">${esc(s.text)}</td>
                <td><span class="st-font" style="font-family:${esc(s.fontFamily)}">${esc(s.fontFamily)}</span></td>
                <td>${s.fontSize}</td>
                <td>${s.fontWeight}</td>
                <td><span class="color-swatch-sm" style="background:${s.color}"></span> <span class="st-color">${s.color}</span></td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    }

    output.innerHTML = html;
  }

  /* ── UI Rendering ── */
  function makeProp(label, value, isColor = false) {
    // Extract base property name for the copy-css action (e.g. "color (HEX)" -> "color")
    const cssProp = label.includes(' ') ? label.substring(0, label.indexOf(' ')) : label;
    const swatch = isColor ? `<span class="color-swatch" style="background:${value}"></span>` : "";
    const cssText = `${cssProp}: ${value};`;

    return `
      <div class="prop-card">
        ${swatch}
        <div class="prop-card__info">
          <span class="prop-card__label">${label}</span>
          <span class="prop-card__value" title="${esc(value)}">${esc(value)}</span>
        </div>
        <button class="btn btn--secondary btn--sm prop-card__copy" data-css="${esc(cssText.replace(/'/g, "\\'"))}">📋 Copy</button>
      </div>`;
  }

  // Global event delegation for copy buttons inserted via innerHTML
  document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.prop-card__copy');
    if (copyBtn) {
      copyToClipboard(copyBtn.dataset.css, copyBtn);
    }
  });

  return { init };
})();

// Auto-init on DOMContentLoaded inside app.js or below
document.addEventListener('DOMContentLoaded', () => {
  FontInspector.init('font-paste-target', 'font-inspector-output', 'font-clear-btn');
});

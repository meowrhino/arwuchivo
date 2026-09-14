/**
 * upload/status.js
 * Estado visual del proceso de subida: idle → loading-ffmpeg → compressing →
 * thumbnailing → ready → uploading → error.
 * Renderiza barras de progreso y mensajes en el modal.
 */

const TOTAL_STEPS = 4;

export function setStatus(currentStep, getCompressedBlob, state, extra = {}) {
  const statusEl = document.getElementById('compressionStatus');
  const nextBtn = document.getElementById('wizardNext');
  const submitBtn = document.getElementById('wizardSubmit');
  if (!statusEl) return state;

  const cfg = {
    'idle':            { html: '' },
    'loading-ffmpeg':  { html: progressHTML('preparando compresor', extra.label, extra.percent, extra.indeterminate) },
    'compressing':     { html: progressHTML('comprimiendo video', extra.label, extra.percent) },
    'thumbnailing':    { html: progressHTML('generando miniatura', null, null, true) },
    'ready':           { html: resultHTML(extra.originalSize, extra.finalSize) },
    'uploading':       { html: progressHTML('subiendo a la nube', null, extra.percent) },
    'error':           { html: `<div class="status-card status-error">${extra.message || 'error'}</div>` },
  }[state] || { html: '' };

  const busy = ['loading-ffmpeg', 'compressing', 'thumbnailing', 'uploading'].includes(state);
  const warning = busy
    ? `<div class="status-warning">⚠ no cierres ni minimices esta pestaña hasta que termine</div>`
    : '';

  statusEl.innerHTML = cfg.html + warning;

  if (currentStep === 1 && nextBtn) {
    nextBtn.disabled = busy || state === 'idle';
  }
  if (submitBtn && currentStep === TOTAL_STEPS) {
    submitBtn.disabled = busy || !getCompressedBlob();
    submitBtn.textContent = state === 'uploading' ? `subiendo ${extra.percent ?? 0}%` : 'subir';
  }
  return state;
}

export function progressHTML(title, sub, percent, indeterminate = false) {
  const p = Math.min(Math.max(percent ?? 0, 0), 100);
  const pctText = indeterminate ? '' : `<span class="progress-pct">${p}%</span>`;
  const fill = indeterminate
    ? `<div class="progress-fill indeterminate"></div>`
    : `<div class="progress-fill" style="width: ${p}%"></div>`;
  return `
    <div class="progress-block">
      <div class="progress-info">
        <span class="progress-label">${title}${sub ? ` · ${sub}` : ''}</span>
        ${pctText}
      </div>
      <div class="progress-bar">${fill}</div>
    </div>
  `;
}

export function resultHTML(originalSize, finalSize) {
  if (!originalSize || !finalSize) return '';
  const reduction = ((1 - finalSize / originalSize) * 100).toFixed(0);
  const sign = finalSize < originalSize ? '−' : '+';
  return `
    <div class="progress-block progress-done">
      <div class="progress-info">
        <span class="progress-label">listo</span>
        <span class="progress-pct">${formatSize(originalSize)} → ${formatSize(finalSize)} (${sign}${Math.abs(reduction)}%)</span>
      </div>
    </div>
  `;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

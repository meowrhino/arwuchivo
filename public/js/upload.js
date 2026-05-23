/**
 * upload.js
 * Interfaz de subida con compresion de video via ffmpeg.wasm
 */

import { resolvePersonColor, HTML_COLOR_HEX } from './colors.js';

let selectedPeople = [];
let legendPeopleMap = {};
let newPeopleCreated = {};

// FFmpeg state
let ffmpeg = null;
let ffmpegLoaded = false;
let ffmpegLoading = false;
let useRawUpload = false; // true cuando el navegador no puede comprimir
let compressedBlob = null;
let thumbnailBlob = null;
let originalFileSize = 0;
let currentStatus = 'idle'; // idle | loading-ffmpeg | compressing | thumbnailing | ready | uploading | error
let wakeLock = null;

// ─── Detección de capacidades del navegador ───────────────────

function detectCapabilities() {
  const hasWASM = typeof WebAssembly !== 'undefined';
  const hasSAB = typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated;
  const cores = navigator.hardwareConcurrency || 1;
  const lowEnd = cores <= 2;

  if (!hasWASM) {
    return {
      mode: 'no-wasm',
      message: 'tu navegador no soporta compresión. el video se subirá sin comprimir (debe pesar ≤ 95 MB).',
      canCompress: false,
    };
  }
  if (!hasSAB) {
    return {
      mode: 'no-sab',
      message: 'recarga la página una vez para activar el compresor. si no, se intentará subir sin comprimir (≤ 95 MB).',
      canCompress: false,
    };
  }
  if (lowEnd) {
    return {
      mode: 'medium',
      message: 'dispositivo con pocos cores, la compresión puede tardar varios minutos. mantén la pantalla activa.',
      canCompress: true,
    };
  }
  return { mode: 'fast', message: null, canCompress: true };
}

// ─── Wake Lock (mantener pantalla activa durante tareas largas) ─

async function acquireWakeLock() {
  if (wakeLock || !navigator.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (_) { wakeLock = null; }
}

function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

// Re-acquire if user briefly hides the tab and comes back during compression
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' &&
      (currentStatus === 'compressing' || currentStatus === 'uploading' || currentStatus === 'loading-ffmpeg')) {
    acquireWakeLock();
  }
});

// ─── Status / UI state ────────────────────────────────────────

function setStatus(state, extra = {}) {
  currentStatus = state;
  const statusEl = document.getElementById('compressionStatus');
  const submitBtn = document.querySelector('#uploadForm button[type="submit"]');
  if (!statusEl || !submitBtn) return;

  const cfg = {
    'idle':            { html: '', btn: 'subir', disabled: true },
    'loading-ffmpeg':  { html: progressHTML('preparando compresor', extra.label, extra.percent, extra.indeterminate), btn: extra.indeterminate ? 'preparando…' : `preparando ${extra.percent ?? 0}%`, disabled: true },
    'compressing':     { html: progressHTML('comprimiendo video', extra.label, extra.percent), btn: `comprimiendo ${extra.percent ?? 0}%`, disabled: true },
    'thumbnailing':    { html: progressHTML('generando miniatura', null, null, true), btn: 'casi listo…', disabled: true },
    'ready':           { html: resultHTML(extra.originalSize, extra.finalSize), btn: 'subir', disabled: false },
    'uploading':       { html: progressHTML('subiendo a la nube', null, extra.percent), btn: `subiendo ${extra.percent ?? 0}%`, disabled: true },
    'error':           { html: `<div class="status-card status-error">${extra.message || 'error'}</div>`, btn: 'subir', disabled: false },
  }[state] || { html: '', btn: 'subir', disabled: false };

  const busy = ['loading-ffmpeg', 'compressing', 'thumbnailing', 'uploading'].includes(state);
  const warning = busy
    ? `<div class="status-warning">⚠ no cierres ni minimices esta pestaña hasta que termine</div>`
    : '';

  statusEl.innerHTML = cfg.html + warning;
  submitBtn.textContent = cfg.btn;
  submitBtn.disabled = cfg.disabled;
}

function progressHTML(title, sub, percent, indeterminate = false) {
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

function resultHTML(originalSize, finalSize) {
  if (!originalSize || !finalSize) return '';
  const reduction = ((1 - finalSize / originalSize) * 100).toFixed(0);
  const sign = finalSize < originalSize ? '−' : '+';
  return `
    <div class="progress-block progress-done">
      <div class="progress-info">
        <span class="progress-label">listo para subir</span>
        <span class="progress-pct">${formatSize(originalSize)} → ${formatSize(finalSize)} (${sign}${Math.abs(reduction)}%)</span>
      </div>
    </div>
  `;
}

// Único preset: 720p con bitrate fijo. Balance calidad/peso para 2 min ≈ 28 MB.
// Con CRF 10 y cap a 2000 kbps, las escenas estáticas pesan aún menos.
const PRESET_720 = {
  label: '720p',
  maxWidth: 1280, maxHeight: 720,
  crf: 10,
  videoBitrate: '2000k',
  audioBitrate: '128k',
  cpuUsed: 4,
  fps: null,
};

const MAX_FILE_SIZE = 500 * 1024 * 1024;       // 500 MB (input antes de comprimir)
const MAX_COMPRESSED_SIZE = 95 * 1024 * 1024;   // 95 MB (límite duro del Worker es 100 MB)
const MAX_DURATION = 5 * 60;                    // 5 minutos
const WORKERFS_THRESHOLD = 200 * 1024 * 1024;   // 200 MB
const CORE_MT_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.9/dist/umd';

// ─── Init ─────────────────────────────────────────────────────

export function initUpload({ legendPeopleMap: legend, onUpload }) {
  legendPeopleMap = legend || {};

  const uploadBtn = document.getElementById('uploadBtn');
  const uploadOverlay = document.getElementById('uploadOverlay');
  const uploadOverlayClose = document.getElementById('uploadOverlayClose');
  const uploadCancel = document.getElementById('uploadCancel');
  const uploadForm = document.getElementById('uploadForm');
  const addPersonBtn = document.getElementById('addPersonBtn');
  const videoInput = document.getElementById('uploadVideo');

  if (!uploadBtn || !uploadOverlay || !uploadForm) return;

  uploadBtn.addEventListener('click', () => {
    uploadOverlay.hidden = false;
    selectedPeople = [];
    newPeopleCreated = {};
    compressedBlob = null;
    thumbnailBlob = null;
    renderSelectedPeople();
    setStatus('idle');
    hideVideoError();
    document.getElementById('uploadDate').value = new Date().toISOString().split('T')[0];

    // Si el dispositivo no puede comprimir, lo subimos tal cual (raw) y avisamos.
    const caps = detectCapabilities();
    useRawUpload = !caps.canCompress;
    const capWarn = document.getElementById('capabilityWarning');
    if (capWarn) {
      if (caps.message) {
        capWarn.textContent = caps.message;
        capWarn.dataset.mode = caps.mode;
        capWarn.hidden = false;
      } else {
        capWarn.hidden = true;
      }
    }
  });

  const closeModal = () => {
    uploadOverlay.hidden = true;
    uploadForm.reset();
    selectedPeople = [];
    compressedBlob = null;
    thumbnailBlob = null;
    setStatus('idle');
    hideVideoError();
    releaseWakeLock();
  };

  uploadOverlayClose.addEventListener('click', closeModal);
  uploadCancel.addEventListener('click', closeModal);
  uploadOverlay.addEventListener('click', (e) => {
    if (e.target === uploadOverlay) closeModal();
  });

  addPersonBtn.addEventListener('click', () => showPersonSelector());

  const compressFlow = async (file, meta) => {
    compressedBlob = null;
    thumbnailBlob = null;
    acquireWakeLock();

    if (useRawUpload) {
      if (file.size > MAX_COMPRESSED_SIZE) {
        setStatus('error', {
          message: `el original pesa ${formatSize(file.size)}, supera el límite del servidor (95 MB) y este navegador no puede comprimir.`
        });
        return;
      }
      compressedBlob = file;
      setStatus('thumbnailing');
      try {
        thumbnailBlob = await generateThumbnailNative(file, meta);
      } catch (_) {
        thumbnailBlob = null;
      }
      setStatus('ready', { originalSize: file.size, finalSize: file.size });
      return;
    }

    compressedBlob = await compressVideo(file, meta);
    if (compressedBlob) {
      setStatus('thumbnailing');
      thumbnailBlob = await generateThumbnail(file, meta).catch(() => null);
      setStatus('ready', { originalSize: file.size, finalSize: compressedBlob.size });
    }
  };

  // Video seleccionado → validar + comprimir
  videoInput.addEventListener('change', async () => {
    const file = videoInput.files[0];
    if (!file) {
      setStatus('idle');
      hideVideoError();
      compressedBlob = null;
      thumbnailBlob = null;
      return;
    }

    const meta = await validateVideo(file);
    if (!meta) {
      compressedBlob = null;
      thumbnailBlob = null;
      setStatus('idle');
      return;
    }

    await compressFlow(file, meta);
  });

  // Submit
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (selectedPeople.length === 0) {
      alert('selecciona al menos una persona');
      return;
    }

    if (!compressedBlob) {
      alert('espera a que termine la compresion');
      return;
    }

    if (compressedBlob.size > MAX_COMPRESSED_SIZE) {
      const mb = (compressedBlob.size / (1024 * 1024)).toFixed(1);
      alert(`comprimido pesa ${mb} MB, supera el limite del servidor (95 MB). prueba con un preset mas bajo (480p) o un video mas corto.`);
      return;
    }

    const originalName = videoInput.files[0]?.name || 'video';
    const compressedFile = new File(
      [compressedBlob],
      originalName.replace(/\.[^.]+$/, '.webm'),
      { type: 'video/webm' }
    );

    const formData = {
      video: compressedFile,
      thumbnail: thumbnailBlob,
      title: document.getElementById('uploadTitle').value || 'sin titulo',
      notes: document.getElementById('uploadNotes')?.value?.trim() || null,
      date: document.getElementById('uploadDate').value,
      people: selectedPeople,
      password: document.getElementById('uploadPassword').value || null,
      newPeople: Object.keys(newPeopleCreated).length ? newPeopleCreated : null,
    };

    try {
      setStatus('uploading', { percent: 0 });
      if (onUpload) await onUpload(formData, (percent) => {
        setStatus('uploading', { percent });
      });
      closeModal();
    } catch (err) {
      setStatus('error', { message: 'error al subir: ' + err.message });
    }
  });
}

// ─── Validation ───────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractVideoMetadata(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve({ duration: 0, width: 0, height: 0 });
    };
    video.src = URL.createObjectURL(file);
  });
}

async function validateVideo(file) {
  if (!file.type.startsWith('video/')) {
    showVideoError('solo se aceptan archivos de video');
    return null;
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    showVideoError(`archivo demasiado grande (${sizeMB} MB). maximo: 500 MB`);
    return null;
  }

  const meta = await extractVideoMetadata(file);
  if (meta.duration > MAX_DURATION) {
    const mins = Math.floor(meta.duration / 60);
    const secs = Math.round(meta.duration % 60);
    showVideoError(`video demasiado largo (${mins}:${String(secs).padStart(2, '0')}). maximo: 5 minutos`);
    return null;
  }

  hideVideoError();
  return meta;
}

function showVideoError(msg) {
  const el = document.getElementById('uploadVideoError');
  if (el) { el.textContent = msg; el.hidden = false; }
}

function hideVideoError() {
  const el = document.getElementById('uploadVideoError');
  if (el) { el.textContent = ''; el.hidden = true; }
}


// ─── FFmpeg compression ───────────────────────────────────────

async function toBlobURL(url, mimeType, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);

  if (!onProgress || !response.body) {
    const buffer = await response.arrayBuffer();
    return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  }

  const total = parseInt(response.headers.get('Content-Length') || '0', 10);
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onProgress(received / total, received, total);
  }
  return URL.createObjectURL(new Blob(chunks, { type: mimeType }));
}

async function loadFFmpeg() {
  if (ffmpegLoaded || ffmpegLoading) return;
  ffmpegLoading = true;

  // FFmpeg WASM requiere SharedArrayBuffer (multi-thread) para funcionar
  // fiablemente en Safari iOS. La versión single-thread cuelga en .load() ahí.
  // El coi-serviceworker.js activa SAB tras un reload inicial.
  if (typeof SharedArrayBuffer === 'undefined' || !self.crossOriginIsolated) {
    ffmpegLoading = false;
    setStatus('error', {
      message: 'recarga la página para activar el compresor. si persiste, usa "sin comprimir".'
    });
    return;
  }

  // Pesos para la barra (solo fase de descarga; init usa barra indeterminada)
  const W_JS = 150 * 1024;
  const W_WASM = 32 * 1024 * 1024;
  const W_WORKER = 30 * 1024;
  const TOTAL = W_JS + W_WASM + W_WORKER;
  let received = 0;

  const showProgress = (label, currentBytes = received) => {
    const pct = Math.min(99, Math.round((currentBytes / TOTAL) * 100));
    setStatus('loading-ffmpeg', { label, percent: pct });
  };

  try {
    showProgress('descargando compresor (1/3)');

    const { FFmpeg } = FFmpegWASM;
    ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => console.log('[ffmpeg]', message));

    const coreURL = await toBlobURL(
      `${CORE_MT_BASE}/ffmpeg-core.js`, 'text/javascript',
      (_p, got) => showProgress('descargando compresor (1/3)', received + got)
    );
    received += W_JS;

    const wasmURL = await toBlobURL(
      `${CORE_MT_BASE}/ffmpeg-core.wasm`, 'application/wasm',
      (_p, got, total) => {
        const mb = (got / 1024 / 1024).toFixed(1);
        const totalMb = (total / 1024 / 1024).toFixed(0);
        showProgress(`descargando compresor (2/3) · ${mb}/${totalMb} MB`, received + got);
      }
    );
    received += W_WASM;

    const workerURL = await toBlobURL(
      `${CORE_MT_BASE}/ffmpeg-core.worker.js`, 'text/javascript',
      (_p, got) => showProgress('descargando compresor (3/3)', received + got)
    );
    received += W_WORKER;

    // ffmpeg.load(): no podemos saber el % real, así que mostramos
    // un timer + barra animada (indeterminada).
    const initStart = Date.now();
    let initInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - initStart) / 1000);
      setStatus('loading-ffmpeg', {
        label: `inicializando compresor · ${elapsed}s`,
        indeterminate: true,
      });
    }, 250);

    try {
      await withTimeout(
        ffmpeg.load({ coreURL, wasmURL, workerURL }),
        180000,
        'inicialización'
      );
    } finally {
      clearInterval(initInterval);
    }
    received = TOTAL;
    ffmpegLoaded = true;
  } catch (err) {
    console.error('Error loading FFmpeg:', err);
    setStatus('error', {
      message: `no se pudo cargar el compresor (${err.message}). prueba "sin comprimir" o recarga la página.`
    });
    ffmpeg = null;
  } finally {
    ffmpegLoading = false;
  }
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout en ${label} (${ms / 1000}s)`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

async function compressVideo(file, meta) {
  if (!ffmpegLoaded) {
    await loadFFmpeg();
    if (!ffmpegLoaded) return null;
  }

  const preset = PRESET_720;
  originalFileSize = file.size;
  setStatus('compressing', { label: `${preset.label} · ${preset.videoBitrate}`, percent: 0 });

  try {
    const ext = file.name.split('.').pop().toLowerCase();
    const inputName = `input.${ext}`;
    const outputName = 'output.webm';
    let usedWorkerFS = false;
    const mountPoint = '/mounted';

    // Write input to virtual FS
    if (file.size >= WORKERFS_THRESHOLD) {
      try { await ffmpeg.unmount(mountPoint); } catch (_) {}
      try { await ffmpeg.createDir(mountPoint); } catch (_) {}
      await ffmpeg.mount('WORKERFS', { files: [file] }, mountPoint);
      usedWorkerFS = true;
    } else {
      const buf = await file.arrayBuffer();
      await ffmpeg.writeFile(inputName, new Uint8Array(buf));
    }

    const actualInput = usedWorkerFS ? `${mountPoint}/${file.name}` : inputName;

    // Scale filter
    let scaleFilter = null;
    if (meta.width > preset.maxWidth || meta.height > preset.maxHeight) {
      const ar = meta.width / meta.height;
      let nw, nh;
      if (ar > (preset.maxWidth / preset.maxHeight)) {
        nw = preset.maxWidth;
        nh = Math.round(preset.maxWidth / ar);
        nh = nh % 2 === 0 ? nh : nh - 1;
      } else {
        nh = preset.maxHeight;
        nw = Math.round(preset.maxHeight * ar);
        nw = nw % 2 === 0 ? nw : nw - 1;
      }
      scaleFilter = `scale=${nw}:${nh}`;
    }

    // Build args
    const args = [
      '-i', actualInput,
      '-c:v', 'libvpx',
      '-crf', String(preset.crf),
      '-b:v', preset.videoBitrate,
      '-cpu-used', String(preset.cpuUsed),
      '-lag-in-frames', '16',
      '-auto-alt-ref', '1',
      '-c:a', 'libvorbis',
      '-b:a', preset.audioBitrate,
      '-threads', '2',
    ];
    if (scaleFilter) args.push('-vf', scaleFilter);
    if (preset.fps) args.push('-r', String(preset.fps));
    args.push(outputName);

    // Progress
    const progressHandler = ({ progress }) => {
      const pct = Math.min(Math.round(progress * 100), 99);
      setStatus('compressing', { label: `${preset.label} · ${preset.videoBitrate}`, percent: pct });
    };
    ffmpeg.on('progress', progressHandler);

    const exitCode = await ffmpeg.exec(args);
    ffmpeg.off('progress', progressHandler);

    if (exitCode !== 0) throw new Error(`ffmpeg exit code ${exitCode}`);

    // Read output
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: 'video/webm' });

    // Cleanup
    try {
      if (usedWorkerFS) await ffmpeg.unmount(mountPoint);
      else await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (_) {}

    return blob;

  } catch (err) {
    console.error('Compression error:', err);
    setStatus('error', { message: 'error al comprimir. prueba con un video más corto o un preset más bajo.' });
    return null;
  }
}

// ─── Thumbnail nativo (canvas, sin FFmpeg) ────────────────────

function generateThumbnailNative(file, meta) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
    };

    const onSeeked = () => {
      try {
        const targetW = 480;
        const ar = video.videoWidth / video.videoHeight;
        const w = targetW;
        const h = Math.round(targetW / ar);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            cleanup();
            blob ? resolve(blob) : reject(new Error('toBlob failed'));
          },
          'image/jpeg',
          0.78
        );
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    video.addEventListener('loadedmetadata', () => {
      const t = meta.duration > 2 ? 1 : 0;
      video.currentTime = t;
    }, { once: true });
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', () => { cleanup(); reject(new Error('video load failed')); }, { once: true });
  });
}

// ─── Thumbnail generation (FFmpeg) ────────────────────────────

async function generateThumbnail(file, meta) {
  if (!ffmpegLoaded) return null;

  const ext = file.name.split('.').pop().toLowerCase();
  const inputName = `thumb_input.${ext}`;
  const outputName = 'thumb.jpg';

  try {
    const buf = await file.arrayBuffer();
    await ffmpeg.writeFile(inputName, new Uint8Array(buf));

    const seekTime = meta.duration > 2 ? '00:00:01' : '00:00:00';
    const targetW = 480;
    const ar = meta.width && meta.height ? meta.width / meta.height : 16 / 9;
    let nw = targetW;
    let nh = Math.round(targetW / ar);
    nh = nh % 2 === 0 ? nh : nh - 1;

    const args = [
      '-ss', seekTime,
      '-i', inputName,
      '-vframes', '1',
      '-vf', `scale=${nw}:${nh}`,
      '-q:v', '3',
      outputName,
    ];

    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) return null;

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: 'image/jpeg' });

    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (_) {}

    return blob;
  } catch (err) {
    console.error('Thumbnail error:', err);
    return null;
  }
}

// ─── Color grid (CSS named colors) ───────────────────────────

function renderColorGrid() {
  const grid = document.getElementById('colorGrid');
  const hiddenInput = document.getElementById('newPersonColor');
  if (!grid || !hiddenInput) return;

  grid.innerHTML = '';

  for (const [name, hex] of Object.entries(HTML_COLOR_HEX)) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch';
    swatch.style.background = hex;
    swatch.title = name;
    swatch.dataset.colorName = name;
    swatch.addEventListener('click', () => {
      const prev = grid.querySelector('.color-swatch.selected');
      if (prev) prev.classList.remove('selected');
      swatch.classList.add('selected');
      hiddenInput.value = name;
    });
    grid.appendChild(swatch);
  }

  // Default: gold
  const defaultSwatch = grid.querySelector('[data-color-name="gold"]');
  if (defaultSwatch) {
    defaultSwatch.classList.add('selected');
    hiddenInput.value = 'gold';
  }
}

// ─── Person selector ──────────────────────────────────────────

function showPersonSelector() {
  const existingPeople = Object.keys(legendPeopleMap);

  if (existingPeople.length === 0) {
    showNewPersonModal();
    return;
  }

  const html = `
    <div class="person-selector">
      <h4>selecciona persona</h4>
      <div class="person-list">
        ${existingPeople.map(name => {
          const { color } = resolvePersonColor(name, legendPeopleMap);
          const isSelected = selectedPeople.includes(name);
          return `
            <button
              class="person-option ${isSelected ? 'selected' : ''}"
              data-name="${name}"
              ${isSelected ? 'disabled' : ''}>
              <span class="person-option-dot" style="background: ${color}"></span>
              <span class="person-option-name">${name}</span>
            </button>
          `;
        }).join('')}
      </div>
      <button class="new-person-trigger">+ nueva persona</button>
    </div>
  `;

  const tempModal = document.createElement('div');
  tempModal.className = 'temp-modal';
  tempModal.innerHTML = `
    <div class="temp-modal-inner">
      <button class="temp-modal-close">\u00d7</button>
      ${html}
    </div>
  `;

  document.body.appendChild(tempModal);

  tempModal.querySelector('.temp-modal-close').addEventListener('click', () => tempModal.remove());
  tempModal.querySelector('.new-person-trigger').addEventListener('click', () => {
    tempModal.remove();
    showNewPersonModal();
  });

  tempModal.querySelectorAll('.person-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      if (!selectedPeople.includes(name)) {
        selectedPeople.push(name);
        renderSelectedPeople();
      }
      tempModal.remove();
    });
  });

  tempModal.addEventListener('click', (e) => {
    if (e.target === tempModal) tempModal.remove();
  });
}

function showNewPersonModal() {
  const newPersonOverlay = document.getElementById('newPersonOverlay');
  const newPersonOverlayClose = document.getElementById('newPersonOverlayClose');
  const newPersonCancel = document.getElementById('newPersonCancel');
  const newPersonForm = document.getElementById('newPersonForm');

  if (!newPersonOverlay || !newPersonForm) return;

  newPersonOverlay.hidden = false;
  renderColorGrid();

  const closeModal = () => {
    newPersonOverlay.hidden = true;
    newPersonForm.reset();
  };

  newPersonOverlayClose.addEventListener('click', closeModal, { once: true });
  newPersonCancel.addEventListener('click', closeModal, { once: true });
  newPersonOverlay.addEventListener('click', (e) => {
    if (e.target === newPersonOverlay) closeModal();
  }, { once: true });

  newPersonForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('newPersonName').value.trim();
    const colorName = document.getElementById('newPersonColor').value;
    if (!name || !colorName) return;

    // Capitalize first letter to match leyenda convention (e.g. "Gold")
    const color = colorName.charAt(0).toUpperCase() + colorName.slice(1);

    legendPeopleMap[name] = { color };
    newPeopleCreated[name] = { color };
    if (!selectedPeople.includes(name)) {
      selectedPeople.push(name);
      renderSelectedPeople();
    }
    closeModal();
  }, { once: true });
}

function renderSelectedPeople() {
  const container = document.getElementById('uploadPeople');
  if (!container) return;

  if (selectedPeople.length === 0) {
    container.innerHTML = '<div class="empty-people">ninguna persona seleccionada</div>';
    return;
  }

  const html = selectedPeople.map(name => {
    const { color } = resolvePersonColor(name, legendPeopleMap);
    return `
      <div class="person-chip">
        <span class="person-chip-dot" style="background: ${color}"></span>
        <span class="person-chip-name">${name}</span>
        <button class="person-chip-remove" data-name="${name}" type="button">\u00d7</button>
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  container.querySelectorAll('.person-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPeople = selectedPeople.filter(p => p !== btn.dataset.name);
      renderSelectedPeople();
    });
  });
}

// ─── Upload handler ───────────────────────────────────────────

export function handleUpload(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('video', formData.video);
    if (formData.thumbnail) body.append('thumbnail', formData.thumbnail, 'thumb.jpg');
    body.append('title', formData.title);
    if (formData.notes) body.append('notes', formData.notes);
    body.append('date', formData.date);
    body.append('people', JSON.stringify(formData.people));
    if (formData.password) body.append('password', formData.password);
    if (formData.newPeople) body.append('newPeople', JSON.stringify(formData.newPeople));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch (_) { resolve({ ok: true }); }
      } else {
        if (xhr.status === 401) {
          // sesión expirada → vuelve al login
          window.location.href = '/login';
          return;
        }
        let msg = 'upload failed';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch (_) {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('error de red'));
    xhr.send(body);
  });
}

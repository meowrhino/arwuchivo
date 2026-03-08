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
let selectedPreset = 'medium';
let compressedBlob = null;

const PRESETS = {
  high: {
    label: '1080p',
    maxWidth: 1920, maxHeight: 1080,
    crf: 10, videoBitrate: '1500k', audioBitrate: '128k',
    cpuUsed: 4, fps: null
  },
  medium: {
    label: '720p',
    maxWidth: 1280, maxHeight: 720,
    crf: 20, videoBitrate: '1200k', audioBitrate: '96k',
    cpuUsed: 5, fps: null
  },
  low: {
    label: '480p',
    maxWidth: 854, maxHeight: 480,
    crf: 33, videoBitrate: '800k', audioBitrate: '96k',
    cpuUsed: 8, fps: 24
  }
};

const MAX_FILE_SIZE = 100 * 1024 * 1024;       // 100 MB
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
    renderSelectedPeople();
    resetCompressionUI();
    hideVideoError();
    document.getElementById('presetField').hidden = true;
    document.getElementById('uploadDate').value = new Date().toISOString().split('T')[0];
  });

  const closeModal = () => {
    uploadOverlay.hidden = true;
    uploadForm.reset();
    selectedPeople = [];
    compressedBlob = null;
    resetCompressionUI();
    hideVideoError();
    document.getElementById('presetField').hidden = true;
  };

  uploadOverlayClose.addEventListener('click', closeModal);
  uploadCancel.addEventListener('click', closeModal);
  uploadOverlay.addEventListener('click', (e) => {
    if (e.target === uploadOverlay) closeModal();
  });

  addPersonBtn.addEventListener('click', () => showPersonSelector());

  // Video seleccionado → validar + comprimir
  videoInput.addEventListener('change', async () => {
    const file = videoInput.files[0];
    if (!file) {
      resetCompressionUI();
      hideVideoError();
      document.getElementById('presetField').hidden = true;
      compressedBlob = null;
      return;
    }

    const meta = await validateVideo(file);
    if (!meta) {
      compressedBlob = null;
      document.getElementById('presetField').hidden = true;
      return;
    }

    document.getElementById('compressionStatus').innerHTML =
      `<div class="compression-status">${formatSize(file.size)} original</div>`;
    document.getElementById('presetField').hidden = false;

    compressedBlob = await compressVideo(file, meta);
  });

  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPreset = btn.dataset.preset;

      const file = videoInput.files[0];
      if (file) {
        compressedBlob = null;
        const meta = await extractVideoMetadata(file);
        compressedBlob = await compressVideo(file, meta);
      }
    });
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

    const originalName = videoInput.files[0]?.name || 'video';
    const compressedFile = new File(
      [compressedBlob],
      originalName.replace(/\.[^.]+$/, '.webm'),
      { type: 'video/webm' }
    );

    const formData = {
      video: compressedFile,
      title: document.getElementById('uploadTitle').value || 'sin titulo',
      date: document.getElementById('uploadDate').value,
      people: selectedPeople,
      password: document.getElementById('uploadPassword').value || null,
      newPeople: Object.keys(newPeopleCreated).length ? newPeopleCreated : null,
    };

    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'subiendo...';
    submitBtn.disabled = true;

    try {
      if (onUpload) await onUpload(formData);
      closeModal();
    } catch (err) {
      alert('error al subir: ' + err.message);
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
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
    showVideoError(`archivo demasiado grande (${sizeMB} MB). maximo: 100 MB`);
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

function resetCompressionUI() {
  const statusEl = document.getElementById('compressionStatus');
  if (statusEl) statusEl.innerHTML = '';
}

// ─── FFmpeg compression ───────────────────────────────────────

async function toBlobURL(url, mimeType) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const blob = new Blob([buffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

async function loadFFmpeg() {
  if (ffmpegLoaded || ffmpegLoading) return;
  ffmpegLoading = true;

  const statusEl = document.getElementById('compressionStatus');
  if (statusEl) {
    statusEl.innerHTML = '<div class="compression-status">cargando ffmpeg (~31 MB)...</div>';
  }

  try {
    if (typeof SharedArrayBuffer === 'undefined') {
      throw new Error('SharedArrayBuffer no disponible. Recarga la pagina.');
    }

    const { FFmpeg } = FFmpegWASM;
    ffmpeg = new FFmpeg();

    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_MT_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_MT_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${CORE_MT_BASE}/ffmpeg-core.worker.js`, 'text/javascript'),
    });

    ffmpegLoaded = true;
  } catch (err) {
    console.error('Error loading FFmpeg:', err);
    if (statusEl) {
      statusEl.innerHTML = '<div class="compression-status">error al cargar ffmpeg. recarga la pagina.</div>';
    }
    ffmpeg = null;
  } finally {
    ffmpegLoading = false;
  }
}

async function compressVideo(file, meta) {
  const statusEl = document.getElementById('compressionStatus');
  if (!statusEl) return null;

  if (!ffmpegLoaded) {
    await loadFFmpeg();
    if (!ffmpegLoaded) return null;
  }

  const preset = PRESETS[selectedPreset];

  statusEl.innerHTML = `
    <div class="compression-status">comprimiendo (${preset.label})...</div>
    <div class="compression-progress">
      <div class="compression-progress-bar" id="compressionBar"></div>
    </div>
  `;

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
      const bar = document.getElementById('compressionBar');
      if (bar) bar.style.width = `${Math.min(Math.round(progress * 100), 99)}%`;
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

    // Show result
    const reduction = ((1 - blob.size / file.size) * 100).toFixed(0);
    statusEl.innerHTML = `
      <div class="compression-result">
        ${formatSize(file.size)} → ${formatSize(blob.size)} (-${reduction}%)
      </div>
    `;

    return blob;

  } catch (err) {
    console.error('Compression error:', err);
    statusEl.innerHTML = `
      <div class="compression-status">
        error al comprimir. prueba con un video mas corto o usa
        <a href="https://handbrake.fr" target="_blank" rel="noopener" style="color:#000;text-decoration:underline">handbrake</a>
      </div>
    `;
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

export async function handleUpload(formData) {
  const body = new FormData();
  body.append('video', formData.video);
  body.append('title', formData.title);
  body.append('date', formData.date);
  body.append('people', JSON.stringify(formData.people));
  if (formData.password) body.append('password', formData.password);
  if (formData.newPeople) body.append('newPeople', JSON.stringify(formData.newPeople));

  const res = await fetch('/api/upload', { method: 'POST', body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'upload failed' }));
    throw new Error(err.error || 'upload failed');
  }
  return res.json();
}

/**
 * upload.js
 * Interfaz de subida con compresion de video en el navegador
 */

import { resolvePersonColor } from './colors.js';

let selectedPeople = [];
let legendPeopleMap = {};

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
    renderSelectedPeople();
    resetCompressionUI();
    document.getElementById('uploadDate').value = new Date().toISOString().split('T')[0];
  });

  const closeModal = () => {
    uploadOverlay.hidden = true;
    uploadForm.reset();
    selectedPeople = [];
    resetCompressionUI();
  };

  uploadOverlayClose.addEventListener('click', closeModal);
  uploadCancel.addEventListener('click', closeModal);
  uploadOverlay.addEventListener('click', (e) => {
    if (e.target === uploadOverlay) closeModal();
  });

  addPersonBtn.addEventListener('click', () => showPersonSelector());

  // Mostrar info del video al seleccionar
  videoInput.addEventListener('change', () => {
    const file = videoInput.files[0];
    if (!file) {
      resetCompressionUI();
      return;
    }
    showVideoInfo(file);
  });

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (selectedPeople.length === 0) {
      alert('selecciona al menos una persona');
      return;
    }

    const formData = {
      video: videoInput.files[0],
      title: document.getElementById('uploadTitle').value || 'sin titulo',
      date: document.getElementById('uploadDate').value,
      people: selectedPeople,
      password: document.getElementById('uploadPassword').value || null
    };

    if (onUpload) await onUpload(formData);
    closeModal();
  });
}

// --- Compresion de video ---

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showVideoInfo(file) {
  const statusEl = document.getElementById('compressionStatus');
  if (!statusEl) return;

  statusEl.innerHTML = `
    <div class="compression-status">
      ${formatSize(file.size)} original
      <button type="button" id="compressBtn" class="compress-btn">comprimir</button>
    </div>
  `;

  document.getElementById('compressBtn').addEventListener('click', () => {
    compressVideo(file);
  });
}

function resetCompressionUI() {
  const statusEl = document.getElementById('compressionStatus');
  if (statusEl) statusEl.innerHTML = '';
}

async function compressVideo(file) {
  const statusEl = document.getElementById('compressionStatus');
  if (!statusEl) return;

  statusEl.innerHTML = `
    <div class="compression-status">comprimiendo...</div>
    <div class="compression-progress">
      <div class="compression-progress-bar" id="compressionBar"></div>
    </div>
  `;

  try {
    const compressed = await reencodeVideo(file, (progress) => {
      const bar = document.getElementById('compressionBar');
      if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
    });

    const reduction = ((1 - compressed.size / file.size) * 100).toFixed(0);
    const downloadURL = URL.createObjectURL(compressed);
    const ext = compressed.type.includes('webm') ? 'webm' : 'mp4';
    const name = file.name.replace(/\.[^.]+$/, '') + `_compressed.${ext}`;

    statusEl.innerHTML = `
      <div class="compression-result">
        ${formatSize(file.size)} → ${formatSize(compressed.size)} (-${reduction}%)
        <a href="${downloadURL}" download="${name}">descargar</a>
      </div>
    `;

  } catch (err) {
    console.error('Compression error:', err);
    statusEl.innerHTML = `
      <div class="compression-status">
        error al comprimir. prueba con un video mas corto o usa
        <a href="https://handbrake.fr" target="_blank" rel="noopener" style="color:#000;text-decoration:underline">handbrake</a>
      </div>
    `;
  }
}

/**
 * Re-encode video using canvas + MediaRecorder.
 * Reduces resolution to 720p max and uses VP9 at controlled bitrate.
 */
async function reencodeVideo(file, onProgress) {
  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = reject;
  });

  // Scale down to 720p max
  const maxDim = 720;
  let w = video.videoWidth;
  let h = video.videoHeight;
  if (Math.max(w, h) > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  // Ensure even dimensions
  w = w % 2 === 0 ? w : w + 1;
  h = h % 2 === 0 ? h : h + 1;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const canvasStream = canvas.captureStream(30);

  // Try to capture audio from the original video
  try {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(video);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    source.connect(audioCtx.destination);
    for (const track of dest.stream.getAudioTracks()) {
      canvasStream.addTrack(track);
    }
  } catch {
    // No audio or audio capture not supported - continue without audio
  }

  // Choose codec and bitrate
  const bitsPerPixel = 1.5;
  const bitrate = Math.round(w * h * bitsPerPixel);
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }

  const recorder = new MediaRecorder(canvasStream, {
    mimeType,
    videoBitsPerSecond: bitrate
  });

  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType });
      URL.revokeObjectURL(video.src);
      resolve(blob);
    };

    recorder.onerror = reject;
    recorder.start(100); // Collect data every 100ms

    const duration = video.duration;

    const drawFrame = () => {
      if (video.ended || video.paused) return;
      ctx.drawImage(video, 0, 0, w, h);
      if (onProgress && duration) {
        onProgress(Math.min(video.currentTime / duration, 1));
      }
      requestAnimationFrame(drawFrame);
    };

    video.onended = () => {
      // Draw final frame
      ctx.drawImage(video, 0, 0, w, h);
      onProgress?.(1);
      setTimeout(() => recorder.stop(), 200);
    };

    video.play().then(drawFrame).catch(reject);
  });
}

// --- Person selector ---

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
    const color = document.getElementById('newPersonColor').value;
    if (!name) return;

    legendPeopleMap[name] = { color };
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

export async function handleUpload(formData) {
  console.log('Upload data:', formData);
  alert(`video "${formData.title}" registrado\n\npersonas: ${formData.people.join(', ')}\nfecha: ${formData.date}\n\nrecuerda mover el archivo a videos/ y actualizar los json`);
}

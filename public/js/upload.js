/**
 * upload.js
 * Orquestador del modal de subida. La lógica vive en upload/.
 *
 * - upload/auth.js          - qué hacer si el Worker responde 401
 * - upload/wizard.js        - navegación entre los 4 pasos
 * - upload/status.js        - estado visual de compresión/subida
 * - upload/personSelector.js - selector de personas dentro del wizard
 * - upload/util.js          - helpers compartidos
 */

import { resolvePersonColor } from './colors.js';
import {
  detectCapabilities,
  acquireWakeLock, releaseWakeLock,
  compressVideo, generateThumbnail, generateThumbnailNative,
} from './compressor.js';

import { handleUnauthorized } from './upload/auth.js';
import { addPendingUpload } from './queue.js';
import { setStatus } from './upload/status.js';
import { goToStep, validateStep, TOTAL_STEPS } from './upload/wizard.js';
import { showPersonSelector, showNewPersonInline } from './upload/personSelector.js';
import { escapeHtml, extractVideoMetadata, showVideoError, hideVideoError } from './upload/util.js';

let selectedPeople = [];
let legendPeopleMap = {};
let newPeopleCreated = {};

let useRawUpload = false;
let compressedBlob = null;
let thumbnailBlob = null;
let currentStatus = 'idle';
let currentStep = 1;

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const MAX_COMPRESSED_SIZE = 95 * 1024 * 1024;
const MAX_DURATION = 5 * 60;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' &&
      (currentStatus === 'compressing' || currentStatus === 'uploading' || currentStatus === 'loading-ffmpeg')) {
    acquireWakeLock();
  }
});

function updateStatus(state, extra = {}) {
  currentStatus = setStatus(currentStep, () => compressedBlob, state, extra);
}

function onCompressorStatus(phase, info) {
  if (phase === 'error') updateStatus('error', { message: info.message });
  else if (phase === 'downloading' || phase === 'initializing') updateStatus('loading-ffmpeg', info);
  else if (phase === 'compressing') updateStatus('compressing', info);
}

export function initUpload({ legendPeopleMap: legend, onUpload }) {
  legendPeopleMap = legend || {};

  const uploadBtn = document.getElementById('uploadBtn');
  const uploadOverlay = document.getElementById('uploadOverlay');
  const uploadOverlayClose = document.getElementById('uploadOverlayClose');
  const uploadForm = document.getElementById('uploadForm');
  const addPersonBtn = document.getElementById('addPersonBtn');
  const videoInput = document.getElementById('uploadVideo');
  const captureInput = document.getElementById('uploadVideoCapture');
  const recordBtn = document.getElementById('recordBtn');
  const backBtn = document.getElementById('wizardBack');
  const nextBtn = document.getElementById('wizardNext');

  if (!uploadBtn || !uploadOverlay || !uploadForm) return;

  // "grabar": abre la cámara directamente (input con capture) y pasa el
  // archivo al input principal para reutilizar validación + compresión.
  if (recordBtn && captureInput) {
    recordBtn.addEventListener('click', () => captureInput.click());
    captureInput.addEventListener('change', () => {
      if (!captureInput.files.length) return;
      videoInput.files = captureInput.files;
      captureInput.value = '';
      videoInput.dispatchEvent(new Event('change'));
    });
  }

  uploadBtn.addEventListener('click', () => {
    selectedPeople = [];
    newPeopleCreated = {};
    compressedBlob = null;
    thumbnailBlob = null;
    uploadForm.reset();
    document.getElementById('uploadDate').value = new Date().toISOString().split('T')[0];
    renderSelectedPeople();
    updateStatus('idle');
    hideVideoError();
    currentStep = 1;
    goToStep(1, { selectedPeople, getCompressedBlob: () => compressedBlob });
    uploadOverlay.hidden = false;

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
    updateStatus('idle');
    hideVideoError();
    releaseWakeLock();
  };

  uploadOverlayClose.addEventListener('click', closeModal);
  uploadOverlay.addEventListener('click', (e) => {
    if (e.target === uploadOverlay) closeModal();
  });

  backBtn.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      goToStep(currentStep, { selectedPeople, getCompressedBlob: () => compressedBlob });
    }
  });
  nextBtn.addEventListener('click', () => {
    if (!validateStep(currentStep, { selectedPeople, getCompressedBlob: () => compressedBlob, showVideoError })) return;
    if (currentStep < TOTAL_STEPS) {
      currentStep++;
      goToStep(currentStep, { selectedPeople, getCompressedBlob: () => compressedBlob });
    }
  });

  addPersonBtn.addEventListener('click', () => {
    showPersonSelector({
      legendPeopleMap,
      selectedPeople,
      onSelect: (name) => {
        if (!selectedPeople.includes(name)) {
          selectedPeople.push(name);
          renderSelectedPeople();
        }
      },
      onNewPerson: () => {
        showNewPersonInline({
          legendPeopleMap,
          selectedPeople,
          newPeopleCreated,
          onSaved: () => renderSelectedPeople(),
        });
      },
    });
  });

  const compressFlow = async (file, meta) => {
    compressedBlob = null;
    thumbnailBlob = null;
    acquireWakeLock();

    if (useRawUpload) {
      if (file.size > MAX_COMPRESSED_SIZE) {
        updateStatus('error', {
          message: `el original pesa demasiado y este navegador no puede comprimir.`
        });
        return;
      }
      compressedBlob = file;
      updateStatus('thumbnailing');
      try { thumbnailBlob = await generateThumbnailNative(file, meta); }
      catch (_) { thumbnailBlob = null; }
      updateStatus('ready', { originalSize: file.size, finalSize: file.size });
      return;
    }

    compressedBlob = await compressVideo(file, meta, onCompressorStatus);
    if (compressedBlob) {
      updateStatus('thumbnailing');
      thumbnailBlob = await generateThumbnail(file, meta).catch(() => null);
      updateStatus('ready', { originalSize: file.size, finalSize: compressedBlob.size });
    }
  };

  videoInput.addEventListener('change', async () => {
    const file = videoInput.files[0];
    if (!file) {
      updateStatus('idle');
      hideVideoError();
      compressedBlob = null;
      thumbnailBlob = null;
      return;
    }

    const meta = await validateVideo(file);
    if (!meta) {
      compressedBlob = null;
      thumbnailBlob = null;
      updateStatus('idle');
      return;
    }

    await compressFlow(file, meta);
  });

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentStep !== TOTAL_STEPS) return;

    if (selectedPeople.length === 0) { alert('elige al menos una persona'); return; }
    if (!compressedBlob) { alert('espera a que termine la compresion'); return; }
    if (compressedBlob.size > MAX_COMPRESSED_SIZE) {
      const mb = (compressedBlob.size / (1024 * 1024)).toFixed(1);
      alert(`comprimido pesa ${mb} MB, supera el limite del servidor (95 MB).`);
      return;
    }

    // En modo raw compressedBlob ES el File original: no lo renombramos a
    // .webm ni le cambiamos el content-type (se subiría un mp4 disfrazado).
    const originalName = videoInput.files[0]?.name || 'video';
    const compressedFile = useRawUpload
      ? compressedBlob
      : new File(
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
      updateStatus('uploading', { percent: 0 });
      if (onUpload) await onUpload(formData, (percent) => updateStatus('uploading', { percent }));
      closeModal();
    } catch (err) {
      // Sesión caducada: el gate del Worker nos manda de vuelta al login.
      if (err.message === 'unauthorized') {
        handleUnauthorized();
        return;
      }
      // Sin red: guardamos en IndexedDB y se subirá al recuperar conexión
      if (err.message === 'error de red' || !navigator.onLine) {
        try {
          await addPendingUpload(formData);
          alert('sin conexión: el video queda guardado en este dispositivo y se subirá automáticamente al recuperar red.');
          closeModal();
          return;
        } catch (_) { /* IndexedDB falló: mostramos el error normal */ }
      }
      updateStatus('error', { message: 'error al subir: ' + err.message });
    }
  });
}

// ─── Validation ───────────────────────────────────────────────

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

function renderSelectedPeople() {
  const container = document.getElementById('uploadPeople');
  if (!container) return;

  if (selectedPeople.length === 0) {
    container.innerHTML = '<div class="empty-people">ninguna persona seleccionada</div>';
  } else {
    container.innerHTML = selectedPeople.map(name => {
      const { color } = resolvePersonColor(name, legendPeopleMap);
      return `
        <div class="person-chip">
          <span class="person-chip-dot" style="background: ${color}"></span>
          <span class="person-chip-name">${escapeHtml(name)}</span>
          <button class="person-chip-remove" data-name="${escapeHtml(name)}" type="button">×</button>
        </div>
      `;
    }).join('');
    container.querySelectorAll('.person-chip-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedPeople = selectedPeople.filter(p => p !== btn.dataset.name);
        renderSelectedPeople();
        if (currentStep === 3) {
          document.getElementById('wizardNext').disabled = selectedPeople.length === 0;
        }
      });
    });
  }
  if (currentStep === 3) {
    const next = document.getElementById('wizardNext');
    if (next) next.disabled = selectedPeople.length === 0;
  }
}

// ─── Upload HTTP request ──────────────────────────────────────

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
    // La autorización va en la cookie de sesión (gate del Worker).

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
          reject(new Error('unauthorized'));
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

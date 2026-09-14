/**
 * views/videoView.js
 * Overlay fullscreen para ver un video. Maneja también el password gating
 * por video y el prompt de password.
 */

import { withAccessHash, sha256hex } from './util.js';

export function initVideoOverlay() {
  const overlay = document.getElementById('videoOverlay');
  const closeBtn = document.getElementById('videoOverlayClose');
  if (!overlay || !closeBtn) return;

  const close = () => {
    overlay.hidden = true;
    const video = overlay.querySelector('video');
    if (video) video.pause();
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) close();
  });
}

export function initPasswordOverlay() {
  const overlay = document.getElementById('passwordOverlay');
  const closeBtn = document.getElementById('passwordOverlayClose');
  if (!overlay || !closeBtn) return;
  closeBtn.addEventListener('click', () => { overlay.hidden = true; });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });
}

export function initAuthOverlay() {
  const overlay = document.getElementById('authOverlay');
  const closeBtn = document.getElementById('authOverlayClose');
  const cancelBtn = document.getElementById('authCancel');
  if (!overlay || !closeBtn) return;
  const close = () => { overlay.hidden = true; };
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

/** Abre el video item: si tiene password, lo gatea; si no, fullscreen directo. */
export function openVideo(item, { onEdit, onDelete }) {
  if (item.hasPassword || item.password) {
    showPasswordPrompt(item, () => showVideoFullscreen(item, null, { onEdit, onDelete }), (hash) => {
      showVideoFullscreen(item, hash, { onEdit, onDelete });
    });
  } else {
    showVideoFullscreen(item, null, { onEdit, onDelete });
  }
}

export function showVideoFullscreen(item, accessHash, { onEdit, onDelete }) {
  const overlay = document.getElementById('videoOverlay');
  const body = document.getElementById('videoOverlayBody');
  if (!overlay || !body) return;

  body.innerHTML = '';

  const video = document.createElement('video');
  video.src = withAccessHash(item.src, accessHash);
  video.controls = true;
  video.autoplay = true;
  video.playsInline = true;
  if (item.thumb) video.poster = withAccessHash(item.thumb, accessHash);
  body.appendChild(video);

  if (item.title || item.notes) {
    const meta = document.createElement('div');
    meta.className = 'video-overlay-meta';
    if (item.title && item.title !== 'sin titulo') {
      const t = document.createElement('div');
      t.className = 'video-overlay-title';
      t.textContent = item.title;
      meta.appendChild(t);
    }
    if (item.notes) {
      const n = document.createElement('div');
      n.className = 'video-overlay-notes';
      n.textContent = item.notes;
      meta.appendChild(n);
    }
    body.appendChild(meta);
  }

  const authToken = localStorage.getItem('arwuchivo_auth_token');
  if (authToken && item.id && item.date) {
    const actions = document.createElement('div');
    actions.className = 'video-overlay-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'video-overlay-edit';
    editBtn.textContent = 'editar';
    editBtn.addEventListener('click', () => onEdit(item));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'video-overlay-delete';
    delBtn.textContent = 'borrar';
    delBtn.addEventListener('click', () => onDelete(item, authToken));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    body.appendChild(actions);
  }

  overlay.hidden = false;
}

function showPasswordPrompt(item, onLegacyOk, onHashedOk) {
  const overlay = document.getElementById('passwordOverlay');
  const input = document.getElementById('passwordInput');
  const submitBtn = document.getElementById('passwordSubmit');
  const cancelBtn = document.getElementById('passwordCancel');
  const errorEl = document.getElementById('passwordError');
  if (!overlay || !input || !submitBtn) return;

  overlay.hidden = false;
  input.value = '';
  input.focus();
  errorEl.hidden = true;

  const handleSubmit = async () => {
    if (item.password && input.value === item.password) {
      overlay.hidden = true;
      onLegacyOk();
      return;
    }
    const hash = await sha256hex(input.value);
    try {
      const res = await fetch(withAccessHash(item.src, hash), { method: 'HEAD' });
      if (res.ok) {
        overlay.hidden = true;
        onHashedOk(hash);
      } else {
        errorEl.textContent = 'password incorrecto';
        errorEl.hidden = false;
      }
    } catch {
      errorEl.textContent = 'error al verificar';
      errorEl.hidden = false;
    }
  };

  submitBtn.addEventListener('click', handleSubmit, { once: true });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  }, { once: true });
  cancelBtn.addEventListener('click', () => {
    overlay.hidden = true;
  }, { once: true });
}

export async function deleteVideo(item, authToken, { onDone }) {
  if (!confirm(`¿borrar "${item.title || 'este video'}"? esto no se puede deshacer.`)) return;
  try {
    const body = new FormData();
    body.append('id', item.id);
    body.append('dayKey', item.date);
    body.append('auth_token', authToken);
    const res = await fetch('/api/delete', { method: 'POST', body });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'error' }));
      if (res.status === 401) localStorage.removeItem('arwuchivo_auth_token');
      alert('no se pudo borrar: ' + (err.error || res.status));
      return;
    }
    document.getElementById('videoOverlay').hidden = true;
    onDone?.();
  } catch (e) {
    alert('error de red al borrar');
  }
}

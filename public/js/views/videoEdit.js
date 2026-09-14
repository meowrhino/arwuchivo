/**
 * views/videoEdit.js
 * Overlay para editar un video existente (título, notas, personas, password).
 * Lo abre el botón "editar" del overlay fullscreen.
 */

import { resolvePersonColor } from '../colors.js';
import { handleUnauthorized } from '../upload/auth.js';
import { escapeHtml } from './util.js';

let editTarget = null;
let editSelectedPeople = [];
let legendPeopleMap = {};
let onSaved = null;

export function initEditOverlay({ legendPeopleMap: legend, onSaved: onSavedCb }) {
  legendPeopleMap = legend;
  onSaved = onSavedCb;

  const overlay = document.getElementById('editOverlay');
  const closeBtn = document.getElementById('editOverlayClose');
  const cancelBtn = document.getElementById('editCancel');
  const form = document.getElementById('editForm');
  const addBtn = document.getElementById('editAddPersonBtn');
  if (!overlay || !form) return;

  const close = () => {
    overlay.hidden = true;
    editTarget = null;
    editSelectedPeople = [];
  };

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  addBtn.addEventListener('click', () => showEditPersonSelector());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editTarget) return;

    try {
      const body = new FormData();
      body.append('id', editTarget.id);
      body.append('dayKey', editTarget.date);
      body.append('title', document.getElementById('editTitle').value || 'sin titulo');
      body.append('notes', document.getElementById('editNotes').value || '');
      body.append('people', JSON.stringify(editSelectedPeople));
      body.append('password', document.getElementById('editPassword').value || '');
      const res = await fetch('/api/edit', { method: 'POST', body });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) return handleUnauthorized();
        alert('no se pudo guardar: ' + (err.error || res.status));
        return;
      }
      close();
      document.getElementById('videoOverlay').hidden = true;
      onSaved?.();
    } catch {
      alert('error de red');
    }
  });
}

export function updateLegendMap(legend) {
  legendPeopleMap = legend;
}

export function openEditOverlay(item) {
  editTarget = item;
  editSelectedPeople = Array.isArray(item.person) ? [...item.person] : (item.person ? [item.person] : []);
  document.getElementById('editTitle').value = item.title || '';
  document.getElementById('editNotes').value = item.notes || '';
  document.getElementById('editPassword').value = '';
  renderEditPeople();
  document.getElementById('editOverlay').hidden = false;
}

function renderEditPeople() {
  const container = document.getElementById('editPeople');
  if (!container) return;
  if (editSelectedPeople.length === 0) {
    container.innerHTML = '<div class="empty-people">ninguna persona</div>';
    return;
  }
  container.innerHTML = editSelectedPeople.map(name => {
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
      editSelectedPeople = editSelectedPeople.filter(p => p !== btn.dataset.name);
      renderEditPeople();
    });
  });
}

function showEditPersonSelector() {
  const existing = Object.keys(legendPeopleMap);
  if (existing.length === 0) return;

  const tempModal = document.createElement('div');
  tempModal.className = 'temp-modal';
  tempModal.innerHTML = `
    <div class="temp-modal-inner">
      <button class="temp-modal-close">×</button>
      <div class="person-selector">
        <h4>añadir persona</h4>
        <div class="person-list">
          ${existing.map(name => {
            const { color } = resolvePersonColor(name, legendPeopleMap);
            const sel = editSelectedPeople.includes(name);
            return `
              <button class="person-option ${sel ? 'selected' : ''}" data-name="${escapeHtml(name)}" ${sel ? 'disabled' : ''}>
                <span class="person-option-dot" style="background: ${color}"></span>
                <span class="person-option-name">${escapeHtml(name)}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(tempModal);

  tempModal.querySelector('.temp-modal-close').addEventListener('click', () => tempModal.remove());
  tempModal.querySelectorAll('.person-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      if (!editSelectedPeople.includes(name)) {
        editSelectedPeople.push(name);
        renderEditPeople();
      }
      tempModal.remove();
    });
  });
  tempModal.addEventListener('click', (e) => { if (e.target === tempModal) tempModal.remove(); });
}

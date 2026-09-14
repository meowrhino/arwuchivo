/**
 * views/peoplePanel.js
 * Panel de gestión de personas, abierto al hacer click en la leyenda.
 * Permite ver, editar y (con auth) borrar personas. Persiste en R2.
 */

import { resolvePersonColor } from '../colors.js';
import { handleUnauthorized, isAuthed } from '../upload/auth.js';
import { openPersonModal } from './personModal.js';
import { escapeHtml } from './util.js';

let legendPeopleMap = {};
let onMutate = null;  // callback al cambiar (renombrar/borrar) para refrescar UI

export function initPeoplePanel({ legendPeopleMap: legend, onMutate: onMutateCb }) {
  legendPeopleMap = legend;
  onMutate = onMutateCb;

  const legendBtn = document.getElementById('legend');
  const panel = document.getElementById('peoplePanel');
  const closeBtn = document.getElementById('peoplePanelClose');
  const addBtn = document.getElementById('peoplePanelAdd');

  if (!legendBtn || !panel) return;

  legendBtn.addEventListener('click', (e) => {
    // Click sobre un chip de persona = filtrar (lo maneja app.js).
    if (e.target.closest('.legend-item')) return;
    renderPanel();
    panel.hidden = false;
  });

  closeBtn.addEventListener('click', () => { panel.hidden = true; });
  panel.addEventListener('click', (e) => {
    if (e.target === panel) panel.hidden = true;
  });

  addBtn.addEventListener('click', () => {
    openPersonModal({
      onSaved: async (name, color) => {
        legendPeopleMap[name] = { color };
        await persistLegend();
        renderPanel();
        onMutate?.();
      }
    });
  });
}

export function updateLegendMap(legend) {
  legendPeopleMap = legend;
}

function renderPanel() {
  const list = document.getElementById('peoplePanelList');
  if (!list) return;

  const names = Object.keys(legendPeopleMap);
  const authed = isAuthed();

  if (names.length === 0) {
    list.innerHTML = '<div class="empty-people">no hay personas aún</div>';
    return;
  }

  list.innerHTML = names.map(name => {
    const { color } = resolvePersonColor(name, legendPeopleMap);
    return `
      <div class="people-row" data-name="${escapeHtml(name)}">
        <span class="people-row-dot" style="background: ${color}"></span>
        <span class="people-row-name">${escapeHtml(name)}</span>
        <span class="people-row-actions">
          <button type="button" class="people-row-edit" data-name="${escapeHtml(name)}">editar</button>
          ${authed ? `<button type="button" class="people-row-delete" data-name="${escapeHtml(name)}">borrar</button>` : ''}
        </span>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.people-row-edit').forEach(btn => {
    btn.addEventListener('click', () => editPerson(btn.dataset.name));
  });
  list.querySelectorAll('.people-row-delete').forEach(btn => {
    btn.addEventListener('click', () => deletePerson(btn.dataset.name));
  });
}

function editPerson(name) {
  const existing = legendPeopleMap[name];
  openPersonModal({
    mode: 'edit',
    initialName: name,
    initialColor: (existing?.color || '').toLowerCase(),
    onSaved: async (newName, color) => {
      if (newName !== name) delete legendPeopleMap[name];
      legendPeopleMap[newName] = { color };
      await persistLegend({ rename: newName !== name ? { from: name, to: newName } : null });
      renderPanel();
      onMutate?.();
    }
  });
}

async function deletePerson(name) {
  if (!confirm(`¿borrar a "${name}"? solo se borra de la leyenda, no de los videos.`)) return;

  try {
    const body = new FormData();
    body.append('name', name);
    const res = await fetch('/api/people/delete', { method: 'POST', body });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401) return handleUnauthorized();
      alert('no se pudo borrar: ' + (err.error || res.status));
      return;
    }
    delete legendPeopleMap[name];
    renderPanel();
    onMutate?.();
  } catch {
    alert('error de red');
  }
}

async function persistLegend({ rename = null } = {}) {

  try {
    const body = new FormData();
    body.append('people', JSON.stringify(legendPeopleMap));
    if (rename) body.append('rename', JSON.stringify(rename));
    const res = await fetch('/api/people/save', { method: 'POST', body });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401) return handleUnauthorized();
      alert('no se pudo guardar: ' + (err.error || res.status));
    }
  } catch {
    alert('error de red');
  }
}

/**
 * upload/personSelector.js
 * Dentro del wizard (paso 3): selector de personas existentes + crear nueva.
 * NO confundir con views/peoplePanel.js (gestión global desde la leyenda).
 */

import { resolvePersonColor, HTML_COLOR_HEX } from '../colors.js';
import { escapeHtml } from './util.js';

export function showPersonSelector({ legendPeopleMap, selectedPeople, onSelect, onNewPerson }) {
  const existingPeople = Object.keys(legendPeopleMap);

  if (existingPeople.length === 0) {
    onNewPerson();
    return;
  }

  const tempModal = document.createElement('div');
  tempModal.className = 'temp-modal';
  tempModal.innerHTML = `
    <div class="temp-modal-inner">
      <button class="temp-modal-close">×</button>
      <div class="person-selector">
        <h4>selecciona persona</h4>
        <div class="person-list">
          ${existingPeople.map(name => {
            const { color } = resolvePersonColor(name, legendPeopleMap);
            const isSelected = selectedPeople.includes(name);
            return `
              <button class="person-option ${isSelected ? 'selected' : ''}" data-name="${escapeHtml(name)}" ${isSelected ? 'disabled' : ''}>
                <span class="person-option-dot" style="background: ${color}"></span>
                <span class="person-option-name">${escapeHtml(name)}</span>
              </button>
            `;
          }).join('')}
        </div>
        <button class="new-person-trigger">+ nueva persona</button>
      </div>
    </div>
  `;
  document.body.appendChild(tempModal);

  tempModal.querySelector('.temp-modal-close').addEventListener('click', () => tempModal.remove());
  tempModal.querySelector('.new-person-trigger').addEventListener('click', () => {
    tempModal.remove();
    onNewPerson();
  });
  tempModal.querySelectorAll('.person-option').forEach(btn => {
    btn.addEventListener('click', () => {
      onSelect(btn.dataset.name);
      tempModal.remove();
    });
  });
  tempModal.addEventListener('click', (e) => {
    if (e.target === tempModal) tempModal.remove();
  });
}

/**
 * Modal "nueva persona" usado desde el wizard. Persiste la persona localmente
 * en `legendPeopleMap` y la añade a `newPeopleCreated` para que el upload
 * también la cree en la leyenda del servidor.
 */
export function showNewPersonInline({ legendPeopleMap, selectedPeople, newPeopleCreated, onSaved }) {
  const overlay = document.getElementById('newPersonOverlay');
  const form = document.getElementById('newPersonForm');
  const title = document.getElementById('newPersonTitle');
  const nameInput = document.getElementById('newPersonName');
  const colorInput = document.getElementById('newPersonColor');
  const closeBtn = document.getElementById('newPersonOverlayClose');
  const cancelBtn = document.getElementById('newPersonCancel');
  if (!overlay || !form) return;

  title.textContent = 'nueva persona';
  nameInput.value = '';
  colorInput.value = 'gold';
  overlay.hidden = false;
  renderColorGridLocal('gold');

  const close = () => {
    overlay.hidden = true;
    form.reset();
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const colorName = colorInput.value;
    if (!name || !colorName) return;
    const color = colorName.charAt(0).toUpperCase() + colorName.slice(1);
    legendPeopleMap[name] = { color };
    newPeopleCreated[name] = { color };
    if (!selectedPeople.includes(name)) {
      selectedPeople.push(name);
    }
    close();
    onSaved?.(name, color);
  };

  closeBtn.onclick = close;
  cancelBtn.onclick = close;
  form.onsubmit = onSubmit;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
}

function renderColorGridLocal(selected = 'gold') {
  const grid = document.getElementById('colorGrid');
  const hidden = document.getElementById('newPersonColor');
  if (!grid || !hidden) return;
  grid.innerHTML = '';
  for (const [name, hex] of Object.entries(HTML_COLOR_HEX)) {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'color-swatch';
    sw.style.background = hex;
    sw.title = name;
    sw.dataset.colorName = name;
    if (name === selected) sw.classList.add('selected');
    sw.addEventListener('click', () => {
      grid.querySelectorAll('.color-swatch.selected').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      hidden.value = name;
    });
    grid.appendChild(sw);
  }
  hidden.value = selected;
}

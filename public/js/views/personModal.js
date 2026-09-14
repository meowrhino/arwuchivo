/**
 * views/personModal.js
 * Modal compartido para crear o editar persona (nombre + color). El caller
 * recibe el resultado vía onSaved(name, color).
 */

import { HTML_COLOR_HEX } from '../colors.js';

export function openPersonModal({ mode = 'create', initialName = '', initialColor = '', onSaved }) {
  const overlay = document.getElementById('newPersonOverlay');
  const form = document.getElementById('newPersonForm');
  const title = document.getElementById('newPersonTitle');
  const nameInput = document.getElementById('newPersonName');
  const colorInput = document.getElementById('newPersonColor');
  const closeBtn = document.getElementById('newPersonOverlayClose');
  const cancelBtn = document.getElementById('newPersonCancel');
  if (!overlay || !form) return;

  title.textContent = mode === 'edit' ? 'editar persona' : 'nueva persona';
  nameInput.value = initialName;
  colorInput.value = initialColor;
  renderColorGrid(initialColor || 'gold');
  overlay.hidden = false;

  const close = () => {
    overlay.hidden = true;
    form.reset();
  };

  const submit = (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const colorName = colorInput.value;
    if (!name || !colorName) return;
    const color = colorName.charAt(0).toUpperCase() + colorName.slice(1);
    close();
    onSaved?.(name, color);
  };

  closeBtn.onclick = close;
  cancelBtn.onclick = close;
  form.onsubmit = submit;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
}

export function renderColorGrid(selectedColorName = 'gold') {
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
    if (name === selectedColorName) swatch.classList.add('selected');
    swatch.addEventListener('click', () => {
      const prev = grid.querySelector('.color-swatch.selected');
      if (prev) prev.classList.remove('selected');
      swatch.classList.add('selected');
      hiddenInput.value = name;
    });
    grid.appendChild(swatch);
  }
  hiddenInput.value = selectedColorName;
}

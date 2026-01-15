/**
 * upload.js
 * Interfaz de subida de videos con gestión de personas
 */

import { resolvePersonColor } from './colors.js';

let selectedPeople = [];
let legendPeopleMap = {};

/**
 * Inicializa la interfaz de subida
 * @param {Object} options - { legendPeopleMap, onUpload }
 */
export function initUpload({ legendPeopleMap: legend, onUpload }) {
  legendPeopleMap = legend || {};

  const uploadBtn = document.getElementById('uploadBtn');
  const uploadOverlay = document.getElementById('uploadOverlay');
  const uploadOverlayClose = document.getElementById('uploadOverlayClose');
  const uploadCancel = document.getElementById('uploadCancel');
  const uploadForm = document.getElementById('uploadForm');
  const addPersonBtn = document.getElementById('addPersonBtn');

  if (!uploadBtn || !uploadOverlay || !uploadForm) {
    console.error('Upload elements not found');
    return;
  }

  // Abrir modal
  uploadBtn.addEventListener('click', () => {
    uploadOverlay.hidden = false;
    selectedPeople = [];
    renderSelectedPeople();
    
    // Setear fecha actual por defecto
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('uploadDate').value = today;
  });

  // Cerrar modal
  const closeModal = () => {
    uploadOverlay.hidden = true;
    uploadForm.reset();
    selectedPeople = [];
  };

  uploadOverlayClose.addEventListener('click', closeModal);
  uploadCancel.addEventListener('click', closeModal);

  // Click fuera del modal
  uploadOverlay.addEventListener('click', (e) => {
    if (e.target === uploadOverlay) {
      closeModal();
    }
  });

  // Añadir persona
  addPersonBtn.addEventListener('click', () => {
    showPersonSelector();
  });

  // Submit form
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (selectedPeople.length === 0) {
      alert('Selecciona al menos una persona');
      return;
    }

    const formData = {
      video: document.getElementById('uploadVideo').files[0],
      title: document.getElementById('uploadTitle').value || 'Sin título',
      date: document.getElementById('uploadDate').value,
      people: selectedPeople,
      password: document.getElementById('uploadPassword').value || null
    };

    if (onUpload) {
      await onUpload(formData);
    }

    closeModal();
  });
}

/**
 * Muestra el selector de personas
 */
function showPersonSelector() {
  const existingPeople = Object.keys(legendPeopleMap);
  
  // Si no hay personas, abrir directamente el modal de nueva persona
  if (existingPeople.length === 0) {
    showNewPersonModal();
    return;
  }

  // Crear modal de selección
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

  // Mostrar en un modal temporal
  const tempModal = document.createElement('div');
  tempModal.className = 'temp-modal';
  tempModal.innerHTML = `
    <div class="temp-modal-inner">
      <button class="temp-modal-close">×</button>
      ${html}
    </div>
  `;

  document.body.appendChild(tempModal);

  // Event listeners
  tempModal.querySelector('.temp-modal-close').addEventListener('click', () => {
    tempModal.remove();
  });

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
    if (e.target === tempModal) {
      tempModal.remove();
    }
  });
}

/**
 * Muestra el modal de nueva persona
 */
function showNewPersonModal() {
  const newPersonOverlay = document.getElementById('newPersonOverlay');
  const newPersonOverlayClose = document.getElementById('newPersonOverlayClose');
  const newPersonCancel = document.getElementById('newPersonCancel');
  const newPersonForm = document.getElementById('newPersonForm');

  if (!newPersonOverlay || !newPersonForm) {
    console.error('New person modal elements not found');
    return;
  }

  newPersonOverlay.hidden = false;

  const closeModal = () => {
    newPersonOverlay.hidden = true;
    newPersonForm.reset();
  };

  newPersonOverlayClose.addEventListener('click', closeModal, { once: true });
  newPersonCancel.addEventListener('click', closeModal, { once: true });

  newPersonOverlay.addEventListener('click', (e) => {
    if (e.target === newPersonOverlay) {
      closeModal();
    }
  }, { once: true });

  newPersonForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('newPersonName').value.trim();
    const color = document.getElementById('newPersonColor').value;

    if (!name) {
      alert('Introduce un nombre');
      return;
    }

    // Guardar en leyenda
    legendPeopleMap[name] = { color };

    // Añadir a seleccionados
    if (!selectedPeople.includes(name)) {
      selectedPeople.push(name);
      renderSelectedPeople();
    }

    closeModal();

    // TODO: Guardar en leyenda.json (requiere backend)
    console.log('Nueva persona creada:', { name, color });
  }, { once: true });
}

/**
 * Renderiza las personas seleccionadas
 */
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
        <button class="person-chip-remove" data-name="${name}" type="button">×</button>
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  // Event listeners para remover
  container.querySelectorAll('.person-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      selectedPeople = selectedPeople.filter(p => p !== name);
      renderSelectedPeople();
    });
  });
}

/**
 * Procesa la subida de video (mock)
 * @param {Object} formData - Datos del formulario
 */
export async function handleUpload(formData) {
  console.log('Upload data:', formData);

  // TODO: Implementar subida real con backend
  // Por ahora, solo mostrar los datos en consola

  alert(`Video "${formData.title}" subido correctamente!\n\nPersonas: ${formData.people.join(', ')}\nFecha: ${formData.date}`);

  // Recargar la página para mostrar el nuevo video
  // window.location.reload();
}

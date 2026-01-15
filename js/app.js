/**
 * app.js
 * Orquestador principal - Versión 4.0 Minimal
 */

import { loadIndex, loadDayData, loadLegend } from './data.js';
import { resolvePersonColor } from './colors.js';
import { generateRandomLayout, calculateAverageVideoSize, calculateCanvasHeight } from './layout.js';
import { initSeasonMenu, updateDateButton } from './seasonMenu.js';
import { initUpload, handleUpload } from './upload.js';

// Estado global
let currentMonth = null;
let indexData = null;
let legendData = null;
let legendPeopleMap = {};

/**
 * Inicialización
 */
async function init() {
  try {
    // Cargar datos
    indexData = await loadIndex();
    legendData = await loadLegend();
    legendPeopleMap = legendData?.people || {};

    // Obtener mes desde URL o usar actual
    const urlParams = new URLSearchParams(window.location.search);
    const monthParam = urlParams.get('m');
    
    if (monthParam && indexData.months.includes(monthParam)) {
      currentMonth = monthParam;
    } else {
      // Usar el mes más reciente con contenido
      currentMonth = indexData.months[0] || getCurrentMonthString();
    }

    // Actualizar botón de fecha
    updateDateButton(currentMonth);

    // Inicializar menú de estaciones
    initSeasonMenu({
      monthsWithContent: indexData.months,
      currentMonth,
      onSeasonClick: navigateToMonth
    });

    // Inicializar interfaz de subida
    initUpload({
      legendPeopleMap,
      onUpload: handleUpload
    });

    // Cargar y renderizar mes actual
    await loadAndRenderMonth(currentMonth);

    // Inicializar overlay de video
    initVideoOverlay();

    // Inicializar overlay de password
    initPasswordOverlay();

  } catch (error) {
    console.error('Error initializing app:', error);
    showError('Error al cargar la aplicación');
  }
}

/**
 * Carga y renderiza un mes
 */
async function loadAndRenderMonth(monthStr) {
  try {
    const dayData = await loadDayData(monthStr);
    
    if (!dayData || dayData.length === 0) {
      showEmpty();
      return;
    }

    // Aplanar items de todos los días
    const allItems = dayData.flatMap(day => 
      day.items.map(item => ({ ...item, date: day.d }))
    );

    renderCanvas(allItems);

  } catch (error) {
    console.error('Error loading month:', error);
    showEmpty();
  }
}

/**
 * Renderiza el canvas con videos flotantes
 */
function renderCanvas(items) {
  const canvas = document.getElementById('canvas');
  const emptyEl = document.getElementById('empty');
  
  if (!canvas) return;

  // Limpiar canvas
  canvas.innerHTML = '';
  
  if (items.length === 0) {
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;

  // Calcular tamaño del canvas
  const containerSize = {
    width: canvas.clientWidth,
    height: window.innerHeight - (window.innerHeight * 0.08) // Restar header
  };

  // Calcular tamaño promedio de videos
  const videoSize = calculateAverageVideoSize(items, containerSize);

  // Generar layout aleatorio
  const positions = generateRandomLayout(items.length, containerSize, videoSize);

  // Calcular altura del canvas
  const canvasHeight = calculateCanvasHeight(positions, containerSize.height);
  canvas.style.minHeight = `${canvasHeight}px`;

  // Renderizar cada video
  items.forEach((item, index) => {
    const pos = positions[index];
    const videoEl = createVideoElement(item, pos);
    canvas.appendChild(videoEl);
  });
}

/**
 * Crea un elemento de video
 */
function createVideoElement(item, position) {
  const { color } = resolvePersonColor(item.person, legendPeopleMap);

  const div = document.createElement('div');
  div.className = 'video-item';
  div.style.left = `${position.x}px`;
  div.style.top = `${position.y}px`;
  div.style.width = `${position.width}px`;
  div.style.height = `${position.height}px`;
  div.style.setProperty('--video-color', color);
  div.dataset.itemId = item.id;

  // Crear elemento de video
  const video = document.createElement('video');
  video.src = item.src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';

  // Ajustar tamaño según orientación real del video
  video.addEventListener('loadedmetadata', () => {
    const isVertical = video.videoHeight > video.videoWidth;
    const aspectRatio = video.videoWidth / video.videoHeight;
    
    if (isVertical) {
      // Mantener ancho, ajustar altura
      div.style.height = `${position.width / aspectRatio}px`;
    } else {
      // Mantener altura, ajustar ancho
      div.style.width = `${position.height * aspectRatio}px`;
    }
  });

  // Click para abrir fullscreen
  div.addEventListener('click', () => {
    if (item.password) {
      showPasswordPrompt(item);
    } else {
      showVideoFullscreen(item);
    }
  });

  div.appendChild(video);

  return div;
}

/**
 * Muestra un video en fullscreen
 */
function showVideoFullscreen(item) {
  const overlay = document.getElementById('videoOverlay');
  const body = document.getElementById('videoOverlayBody');
  
  if (!overlay || !body) return;

  body.innerHTML = '';

  const video = document.createElement('video');
  video.src = item.src;
  video.controls = true;
  video.autoplay = true;
  video.playsInline = true;

  body.appendChild(video);
  overlay.hidden = false;
}

/**
 * Inicializa el overlay de video
 */
function initVideoOverlay() {
  const overlay = document.getElementById('videoOverlay');
  const closeBtn = document.getElementById('videoOverlayClose');
  
  if (!overlay || !closeBtn) return;

  closeBtn.addEventListener('click', () => {
    overlay.hidden = true;
    const video = overlay.querySelector('video');
    if (video) video.pause();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.hidden = true;
      const video = overlay.querySelector('video');
      if (video) video.pause();
    }
  });

  // ESC para cerrar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) {
      overlay.hidden = true;
      const video = overlay.querySelector('video');
      if (video) video.pause();
    }
  });
}

/**
 * Muestra el prompt de password
 */
function showPasswordPrompt(item) {
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

  const handleSubmit = () => {
    const password = input.value;
    if (password === item.password) {
      overlay.hidden = true;
      showVideoFullscreen(item);
    } else {
      errorEl.textContent = 'Password incorrecto';
      errorEl.hidden = false;
    }
  };

  submitBtn.addEventListener('click', handleSubmit, { once: true });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }, { once: true });

  cancelBtn.addEventListener('click', () => {
    overlay.hidden = true;
  }, { once: true });
}

/**
 * Inicializa el overlay de password
 */
function initPasswordOverlay() {
  const overlay = document.getElementById('passwordOverlay');
  const closeBtn = document.getElementById('passwordOverlayClose');
  
  if (!overlay || !closeBtn) return;

  closeBtn.addEventListener('click', () => {
    overlay.hidden = true;
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.hidden = true;
    }
  });
}

/**
 * Navega a un mes específico
 */
function navigateToMonth(monthStr) {
  currentMonth = monthStr;
  updateDateButton(monthStr);
  
  // Actualizar URL
  const url = new URL(window.location);
  url.searchParams.set('m', monthStr);
  window.history.pushState({}, '', url);

  // Cargar y renderizar
  loadAndRenderMonth(monthStr);
}

/**
 * Muestra el mensaje de vacío
 */
function showEmpty() {
  const canvas = document.getElementById('canvas');
  const emptyEl = document.getElementById('empty');
  
  if (!canvas || !emptyEl) return;

  canvas.innerHTML = '';
  emptyEl.hidden = false;
}

/**
 * Muestra un error
 */
function showError(message) {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  canvas.innerHTML = `
    <div class="empty" style="color: #dc2626;">
      ${message}
    </div>
  `;
}

/**
 * Obtiene el mes actual en formato YY-MM
 */
function getCurrentMonthString() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

// Renderizar leyenda
function renderLegend() {
  const legendEl = document.getElementById('legend');
  if (!legendEl || !legendPeopleMap) return;

  const people = Object.keys(legendPeopleMap);
  if (people.length === 0) {
    legendEl.innerHTML = '';
    return;
  }

  const html = people.map(name => {
    const { color } = resolvePersonColor(name, legendPeopleMap);
    return `
      <div class="legend-item">
        <span class="legend-dot" style="background: ${color}"></span>
        <span class="legend-name">${name}</span>
      </div>
    `;
  }).join('');

  legendEl.innerHTML = html;
}

// Iniciar app
init().then(() => {
  renderLegend();
});

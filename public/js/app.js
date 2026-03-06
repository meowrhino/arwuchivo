/**
 * app.js
 * Orquestador principal - v5.0 fusion minimal
 */

import { loadIndex, loadDayData, loadLegend } from './data.js';
import { resolvePersonColor, resolveFusionGradient } from './colors.js';
import { generateRandomLayout, calculateAverageVideoSize, calculateCanvasHeight } from './layout.js';
import { initSeasonMenu, updateDateButton } from './seasonMenu.js';
import { initUpload, handleUpload } from './upload.js';

let currentMonth = null;
let indexData = null;
let legendData = null;
let legendPeopleMap = {};

async function init() {
  try {
    indexData = await loadIndex();
    legendData = await loadLegend();
    legendPeopleMap = legendData?.people || {};

    const urlParams = new URLSearchParams(window.location.search);
    const monthParam = urlParams.get('m');

    if (monthParam && indexData.months.includes(monthParam)) {
      currentMonth = monthParam;
    } else {
      currentMonth = indexData.months[0] || getCurrentMonthString();
    }

    updateDateButton(currentMonth);

    initSeasonMenu({
      monthsWithContent: indexData.months,
      currentMonth,
      onSeasonClick: navigateToMonth
    });

    initUpload({
      legendPeopleMap,
      onUpload: async (formData) => {
        await handleUpload(formData);
        // Refresh: reload index, legend, and re-render current month
        indexData = await loadIndex();
        legendData = await loadLegend();
        legendPeopleMap = legendData?.people || {};
        renderLegend();
        // Navigate to the month of the uploaded video
        const uploadYY = formData.date.slice(2, 4);
        const uploadMM = formData.date.slice(5, 7);
        const uploadMonth = `${uploadYY}-${uploadMM}`;
        navigateToMonth(uploadMonth);
      }
    });

    await loadAndRenderMonth(currentMonth);
    initVideoOverlay();
    initPasswordOverlay();

  } catch (error) {
    console.error('Error initializing app:', error);
    showError('error al cargar');
  }
}

async function loadAndRenderMonth(monthStr) {
  try {
    const dayData = await loadDayData(monthStr);

    if (!dayData || dayData.length === 0) {
      showEmpty();
      return;
    }

    const allItems = dayData.flatMap(day =>
      day.items.map(item => ({ ...item, date: day.d }))
    );

    renderCanvas(allItems);

  } catch (error) {
    console.error('Error loading month:', error);
    showEmpty();
  }
}

function renderCanvas(items) {
  const canvas = document.getElementById('canvas');
  const emptyEl = document.getElementById('empty');

  if (!canvas) return;

  // Limpiar videos del canvas
  while (canvas.firstChild) canvas.removeChild(canvas.firstChild);

  if (items.length === 0) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  const containerSize = {
    width: canvas.clientWidth,
    height: window.innerHeight - (window.innerHeight * 0.06)
  };

  const videoSize = calculateAverageVideoSize(items, containerSize);
  const positions = generateRandomLayout(items.length, containerSize, videoSize);
  const canvasHeight = calculateCanvasHeight(positions, containerSize.height);
  canvas.style.minHeight = `${canvasHeight}px`;

  items.forEach((item, index) => {
    const pos = positions[index];
    const videoEl = createVideoElement(item, pos);
    canvas.appendChild(videoEl);
  });
}

function createVideoElement(item, position) {
  // Usa gradiente para fusion de colores
  const gradient = resolveFusionGradient(item.person, legendPeopleMap);

  const div = document.createElement('div');
  div.className = 'video-item';
  div.style.left = `${position.x}px`;
  div.style.top = `${position.y}px`;
  div.style.width = `${position.width}px`;
  div.style.height = `${position.height}px`;
  div.style.setProperty('--video-color', gradient);
  div.dataset.itemId = item.id;

  const video = document.createElement('video');
  video.src = item.src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';

  video.addEventListener('loadedmetadata', () => {
    const isVertical = video.videoHeight > video.videoWidth;
    const aspectRatio = video.videoWidth / video.videoHeight;

    if (isVertical) {
      div.style.height = `${position.width / aspectRatio}px`;
    } else {
      div.style.width = `${position.height * aspectRatio}px`;
    }
  });

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

function initVideoOverlay() {
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
    if (input.value === item.password) {
      overlay.hidden = true;
      showVideoFullscreen(item);
    } else {
      errorEl.textContent = 'password incorrecto';
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

function initPasswordOverlay() {
  const overlay = document.getElementById('passwordOverlay');
  const closeBtn = document.getElementById('passwordOverlayClose');

  if (!overlay || !closeBtn) return;

  closeBtn.addEventListener('click', () => { overlay.hidden = true; });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });
}

function navigateToMonth(monthStr) {
  currentMonth = monthStr;
  updateDateButton(monthStr);

  const url = new URL(window.location);
  url.searchParams.set('m', monthStr);
  window.history.pushState({}, '', url);

  loadAndRenderMonth(monthStr);
}

function showEmpty() {
  const canvas = document.getElementById('canvas');
  const emptyEl = document.getElementById('empty');

  if (!canvas) return;

  while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
  if (emptyEl) emptyEl.hidden = false;
}

function showError(message) {
  const canvas = document.getElementById('canvas');
  const emptyEl = document.getElementById('empty');
  if (!canvas) return;

  while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
  if (emptyEl) {
    emptyEl.textContent = message;
    emptyEl.hidden = false;
  }
}

function getCurrentMonthString() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

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
        <span class="legend-name">${name.toLowerCase()}</span>
      </div>
    `;
  }).join('');

  legendEl.innerHTML = html;
}

init().then(() => {
  renderLegend();
});

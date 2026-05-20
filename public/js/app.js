/**
 * app.js
 * Orquestador principal - v5.0 fusion minimal
 */

import { loadIndex, loadDayData, loadLegend } from './data.js';
import { resolvePersonColor, resolveFusionGradient } from './colors.js';
import { generateRandomLayout, calculateAverageVideoSize, calculateCanvasHeight } from './layout.js';
import { initSeasonMenu, updateDateButton } from './seasonMenu.js';
import { initUpload, handleUpload } from './upload.js';
import { renderTimeline } from './timeline.js';

let currentMonth = null;
let currentDay = null;  // YY-MM-DD when filtering, else null
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
    const dayParam = urlParams.get('d');

    if (dayParam && /^\d{2}-\d{2}-\d{2}$/.test(dayParam)) {
      currentDay = dayParam;
      currentMonth = dayParam.slice(0, 5);
    } else if (monthParam && indexData.months.includes(monthParam)) {
      currentMonth = monthParam;
    } else {
      // El más reciente: months puede venir en cualquier orden, así que ordeno
      // lexicográficamente — el formato YY-MM con padding hace que funcione.
      const sortedMonths = [...indexData.months].sort();
      currentMonth = sortedMonths.at(-1) || getCurrentMonthString();
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
    renderMonthTimeline(monthStr);
    const dayData = await loadDayData(monthStr);

    if (!dayData || dayData.length === 0) {
      showEmpty();
      return;
    }

    let allItems = dayData.flatMap(day =>
      day.items.map(item => ({ ...item, date: day.d }))
    );

    if (currentDay) {
      allItems = allItems.filter(item => item.date === currentDay);
    }

    renderCanvas(allItems);

  } catch (error) {
    console.error('Error loading month:', error);
    showEmpty();
  }
}

function renderMonthTimeline(monthStr) {
  const el = document.getElementById('timeline');
  if (!el || !indexData) return;

  renderTimeline({
    el,
    yyMM: monthStr,
    selectedDay: currentDay,
    indexDays: indexData.days || [],
    legendPeopleMap,
    onSelectDay: (d) => navigateToDay(d),
  });
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
    width: canvas.clientWidth || window.innerWidth || document.documentElement.clientWidth || 360,
    height: (window.innerHeight || 640) * 0.94
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
  if (item.thumb) video.poster = item.thumb;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = item.thumb ? 'none' : 'metadata';

  video.addEventListener('loadedmetadata', () => {
    const isVertical = video.videoHeight > video.videoWidth;
    const aspectRatio = video.videoWidth / video.videoHeight;

    if (isVertical) {
      div.style.height = `${position.width / aspectRatio}px`;
    } else {
      div.style.width = `${position.height * aspectRatio}px`;
    }
  });

  // If poster exists, infer aspect ratio from image to avoid loading video
  if (item.thumb) {
    const img = new Image();
    img.onload = () => {
      const ar = img.naturalWidth / img.naturalHeight;
      if (img.naturalHeight > img.naturalWidth) {
        div.style.height = `${position.width / ar}px`;
      } else {
        div.style.width = `${position.height * ar}px`;
      }
    };
    img.src = item.thumb;
  }

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
  if (item.thumb) video.poster = item.thumb;

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
  currentDay = null;
  updateDateButton(monthStr);

  const url = new URL(window.location);
  url.searchParams.set('m', monthStr);
  url.searchParams.delete('d');
  window.history.pushState({}, '', url);

  loadAndRenderMonth(monthStr);
}

function navigateToDay(dayStr) {
  // Toggle: clicking the selected day clears the filter
  if (currentDay === dayStr) {
    currentDay = null;
    const url = new URL(window.location);
    url.searchParams.delete('d');
    url.searchParams.set('m', currentMonth);
    window.history.pushState({}, '', url);
  } else {
    currentDay = dayStr;
    currentMonth = dayStr.slice(0, 5);
    const url = new URL(window.location);
    url.searchParams.set('d', dayStr);
    url.searchParams.delete('m');
    window.history.pushState({}, '', url);
  }
  loadAndRenderMonth(currentMonth);
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

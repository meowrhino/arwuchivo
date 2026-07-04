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
import { flushPendingUploads } from './queue.js';

let currentMonth = null;
let currentDay = null;  // YY-MM-DD when filtering, else null
let indexData = null;
let legendData = null;
let legendPeopleMap = {};
let activePersonFilter = null;  // nombre de persona al filtrar desde la leyenda

// Preview automático: hover en desktop, IntersectionObserver en táctil
const hoverCapable = window.matchMedia('(hover: hover)').matches;
let previewObserver = null;

function getPreviewObserver() {
  if (previewObserver) return previewObserver;
  previewObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const video = entry.target.querySelector('video');
      if (!video) continue;
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }
  }, { threshold: 0.6 });
  return previewObserver;
}

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
      onUpload: async (formData, onProgress) => {
        await handleUpload(formData, onProgress);
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
    initOfflineQueue();

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

  if (previewObserver) previewObserver.disconnect();

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
    // Aparición escalonada: cada video entra un poco después que el anterior
    videoEl.style.animationDelay = `${Math.min(index * 60, 800)}ms`;
    canvas.appendChild(videoEl);
  });

  applyPersonFilter();
}

function applyPersonFilter() {
  document.querySelectorAll('.video-item').forEach((el) => {
    const people = (el.dataset.people || '').split('|');
    const dimmed = !!activePersonFilter && !people.includes(activePersonFilter);
    el.classList.toggle('dimmed', dimmed);
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
  div.dataset.people = (Array.isArray(item.person) ? item.person : [item.person])
    .filter(Boolean).join('|');

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
    // Soporta formato nuevo (hasPassword) y legacy (password)
    if (item.hasPassword || item.password) {
      showPasswordPrompt(item);
    } else {
      showVideoFullscreen(item);
    }
  });

  // Preview: hover en desktop; en táctil se reproduce el que está en pantalla
  if (hoverCapable) {
    div.addEventListener('mouseenter', () => video.play().catch(() => {}));
    div.addEventListener('mouseleave', () => video.pause());
  } else {
    getPreviewObserver().observe(div);
  }

  div.appendChild(video);
  return div;
}

async function sha256hex(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function withAccessHash(url, hash) {
  if (!hash) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}p=${hash}`;
}

function showVideoFullscreen(item, accessHash = null) {
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

  // Si llegaste aquí estás autenticado por cookie (gate del Worker), así que
  // siempre mostramos el botón de borrar.
  if (item.id && item.date) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'video-overlay-delete';
    delBtn.textContent = 'borrar';
    delBtn.addEventListener('click', () => deleteVideo(item));
    body.appendChild(delBtn);
  }

  overlay.hidden = false;
}

async function deleteVideo(item) {
  if (!confirm(`¿borrar "${item.title || 'este video'}"? esto no se puede deshacer.`)) return;
  try {
    const body = new FormData();
    body.append('id', item.id);
    body.append('dayKey', item.date);
    const res = await fetch('/api/delete', { method: 'POST', body });
    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const err = await res.json().catch(() => ({ error: 'error' }));
      alert('no se pudo borrar: ' + (err.error || res.status));
      return;
    }
    // Recargar datos y vista
    document.getElementById('videoOverlay').hidden = true;
    indexData = await loadIndex();
    renderLegend();
    await loadAndRenderMonth(currentMonth);
  } catch (e) {
    alert('error de red al borrar');
  }
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

// Item pendiente de validar; los listeners viven en initPasswordOverlay
// (registrados una sola vez) para poder reintentar tras un fallo.
let passwordPromptItem = null;

function showPasswordPrompt(item) {
  const overlay = document.getElementById('passwordOverlay');
  const input = document.getElementById('passwordInput');
  const errorEl = document.getElementById('passwordError');

  if (!overlay || !input) return;

  passwordPromptItem = item;
  overlay.hidden = false;
  input.value = '';
  input.focus();
  errorEl.hidden = true;
}

function initPasswordOverlay() {
  const overlay = document.getElementById('passwordOverlay');
  const closeBtn = document.getElementById('passwordOverlayClose');
  const input = document.getElementById('passwordInput');
  const submitBtn = document.getElementById('passwordSubmit');
  const cancelBtn = document.getElementById('passwordCancel');
  const errorEl = document.getElementById('passwordError');

  if (!overlay || !closeBtn || !input || !submitBtn) return;

  const close = () => {
    overlay.hidden = true;
    passwordPromptItem = null;
  };

  const handleSubmit = async () => {
    const item = passwordPromptItem;
    if (!item) return;

    // Legacy: si el item tenía password en plano (uploads viejos), el Worker
    // ya no gatea el archivo. Aceptamos el match local como fallback.
    if (item.password && input.value === item.password) {
      close();
      showVideoFullscreen(item);
      return;
    }

    // Nuevo: hasheamos el input y pedimos al Worker que valide.
    const hash = await sha256hex(input.value);
    try {
      const res = await fetch(withAccessHash(item.src, hash), { method: 'HEAD' });
      if (res.ok) {
        close();
        showVideoFullscreen(item, hash);
      } else {
        errorEl.textContent = 'password incorrecto';
        errorEl.hidden = false;
      }
    } catch {
      errorEl.textContent = 'error al verificar';
      errorEl.hidden = false;
    }
  };

  submitBtn.addEventListener('click', handleSubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });
  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

function navigateToMonth(monthStr) {
  currentMonth = monthStr;
  currentDay = null;
  activePersonFilter = null;
  updateDateButton(monthStr);

  const url = new URL(window.location);
  url.searchParams.set('m', monthStr);
  url.searchParams.delete('d');
  window.history.pushState({}, '', url);

  renderLegend();
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
  renderLegend();
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

  // Solo gente que aparece en el mes/día visible. Si no hay nada cargado,
  // muestro toda la leyenda (fallback al estado inicial).
  let people;
  if (currentMonth && indexData?.days) {
    const daysInScope = currentDay
      ? indexData.days.filter(d => d.d === currentDay)
      : indexData.days.filter(d => d.d.startsWith(currentMonth));
    const set = new Set();
    for (const d of daysInScope) {
      (d.people || []).forEach(p => set.add(p));
    }
    people = [...set];
  } else {
    people = Object.keys(legendPeopleMap);
  }

  if (people.length === 0) {
    legendEl.innerHTML = '';
    return;
  }

  // Si la persona filtrada ya no está en el mes visible, soltamos el filtro
  if (activePersonFilter && !people.includes(activePersonFilter)) {
    activePersonFilter = null;
  }

  const html = people.map(name => {
    const { color } = resolvePersonColor(name, legendPeopleMap);
    const active = name === activePersonFilter ? ' active' : '';
    return `
      <div class="legend-item${active}" data-name="${name}" role="button" tabindex="0">
        <span class="legend-dot" style="background: ${color}"></span>
        <span class="legend-name">${name.toLowerCase()}</span>
      </div>
    `;
  }).join('');

  legendEl.innerHTML = html;

  // Clic en una persona: filtra el canvas (toggle)
  legendEl.querySelectorAll('.legend-item').forEach((el) => {
    el.addEventListener('click', () => {
      const name = el.dataset.name;
      activePersonFilter = activePersonFilter === name ? null : name;
      legendEl.querySelectorAll('.legend-item').forEach((it) => {
        it.classList.toggle('active', it.dataset.name === activePersonFilter);
      });
      applyPersonFilter();
    });
  });
}

// ─── Cola offline ─────────────────────────────────────────────

async function refreshAfterUploads() {
  indexData = await loadIndex();
  legendData = await loadLegend();
  legendPeopleMap = legendData?.people || {};
  renderLegend();
  await loadAndRenderMonth(currentMonth);
}

function initOfflineQueue() {
  const flush = async () => {
    try {
      const uploaded = await flushPendingUploads(handleUpload);
      if (uploaded > 0) {
        console.log(`cola offline: ${uploaded} video(s) subidos`);
        await refreshAfterUploads();
      }
    } catch (e) {
      console.warn('cola offline:', e);
    }
  };
  window.addEventListener('online', flush);
  flush();
}

init().then(() => {
  renderLegend();
});

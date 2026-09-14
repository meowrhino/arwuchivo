/**
 * app.js
 * Orquestador principal. Carga datos, inicia las vistas, maneja navegación.
 * La lógica vive en:
 *   - views/canvas.js      - render del canvas con los videos
 *   - views/videoView.js   - overlay fullscreen + delete + password gating
 *   - views/videoEdit.js   - editar metadata de un video
 *   - views/peoplePanel.js - gestión de personas (click en leyenda)
 *   - views/personModal.js - modal nueva/editar persona (compartido)
 *   - views/legend.js      - leyenda con contadores
 *   - upload.js            - wizard de subida
 *   - data.js              - carga de JSON
 *   - layout.js            - posicionamiento
 */

import { loadIndex, loadDayData, loadLegend } from './data.js';
import { initSeasonMenu, updateDateButton } from './seasonMenu.js';
import { initUpload, handleUpload } from './upload.js';

import { renderCanvas } from './views/canvas.js';
import { renderLegend } from './views/legend.js';
import { initVideoOverlay, initPasswordOverlay, initAuthOverlay, openVideo, deleteVideo } from './views/videoView.js';
import { initEditOverlay, openEditOverlay, updateLegendMap as updateEditLegend } from './views/videoEdit.js';
import { initPeoplePanel, updateLegendMap as updatePanelLegend } from './views/peoplePanel.js';

let currentMonth = null;
let currentDay = null;
let indexData = null;
let legendData = null;
let legendPeopleMap = {};
let currentItems = [];

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
        await reloadDataAndLegend();
        const uploadYY = formData.date.slice(2, 4);
        const uploadMM = formData.date.slice(5, 7);
        navigateToMonth(`${uploadYY}-${uploadMM}`);
      }
    });

    initVideoOverlay();
    initPasswordOverlay();
    initAuthOverlay();

    initPeoplePanel({
      legendPeopleMap,
      onMutate: () => doRenderLegend(),
    });

    initEditOverlay({
      legendPeopleMap,
      onSaved: async () => {
        await reloadDataAndLegend();
        await loadAndRenderMonth(currentMonth);
      }
    });

    await loadAndRenderMonth(currentMonth);

  } catch (error) {
    console.error('Error initializing app:', error);
    showError('error al cargar');
  }
}

async function reloadDataAndLegend() {
  indexData = await loadIndex();
  legendData = await loadLegend();
  legendPeopleMap = legendData?.people || {};
  updatePanelLegend(legendPeopleMap);
  updateEditLegend(legendPeopleMap);
  doRenderLegend();
}

async function loadAndRenderMonth(monthStr) {
  try {
    const dayData = await loadDayData(monthStr);

    if (!dayData || dayData.length === 0) {
      currentItems = [];
      showEmpty();
      doRenderLegend();
      return;
    }

    let allItems = dayData.flatMap(day =>
      day.items.map(item => ({ ...item, date: day.d }))
    );

    if (currentDay) {
      allItems = allItems.filter(item => item.date === currentDay);
    }

    currentItems = allItems;

    renderCanvas(allItems, {
      legendPeopleMap,
      onItemClick: (item) => openVideo(item, {
        onEdit: openEditOverlay,
        onDelete: (it, token) => deleteVideo(it, token, {
          onDone: async () => {
            await reloadDataAndLegend();
            await loadAndRenderMonth(currentMonth);
          }
        }),
      }),
    });

    doRenderLegend();

  } catch (error) {
    console.error('Error loading month:', error);
    showEmpty();
  }
}

function doRenderLegend() {
  let items = currentItems;
  // Si no hay nada cargado aún pero queremos mostrar todas las personas como
  // hint, dejamos que renderLegend caiga al fallback de "todas en leyenda".
  renderLegend({ items, legendPeopleMap });
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

init().then(() => {
  doRenderLegend();
});

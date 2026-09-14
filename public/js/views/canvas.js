/**
 * views/canvas.js
 * Render del canvas con los videos del mes/día. Cada video es un <div> con
 * <video> dentro, posicionado por layout.js.
 */

import { resolveFusionGradient } from '../colors.js';
import { generateRandomLayout, calculateAverageVideoSize, calculateCanvasHeight } from '../layout.js';

export function renderCanvas(items, { legendPeopleMap, onItemClick }) {
  const canvas = document.getElementById('canvas');
  const emptyEl = document.getElementById('empty');
  if (!canvas) return;

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
    const videoEl = createVideoElement(item, pos, { legendPeopleMap, onItemClick });
    canvas.appendChild(videoEl);
  });
}

function createVideoElement(item, position, { legendPeopleMap, onItemClick }) {
  const gradient = resolveFusionGradient(item.person, legendPeopleMap);

  const div = document.createElement('div');
  div.className = 'video-item';
  div.style.left = `${position.x}px`;
  div.style.top = `${position.y}px`;
  div.style.width = `${position.width}px`;
  div.style.height = `${position.height}px`;
  div.style.setProperty('--video-color', gradient);
  div.dataset.itemId = item.id;

  // Aspect ratio: la primera fuente que resuelva (poster o video) gana.
  let aspectApplied = false;
  const applyAspect = (ar) => {
    if (aspectApplied || !ar) return;
    aspectApplied = true;
    const maxW = Math.min(position.width, document.documentElement.clientWidth - position.x - 4);
    let w = position.width;
    let h = position.width / ar;
    if (h > position.height * 1.4) {
      h = position.height;
      w = position.height * ar;
    }
    if (w > maxW) {
      w = maxW;
      h = w / ar;
    }
    div.style.width = `${w}px`;
    div.style.height = `${h}px`;
  };

  const video = document.createElement('video');
  video.src = item.src;
  if (item.thumb) video.poster = item.thumb;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = item.thumb ? 'none' : 'metadata';

  video.addEventListener('loadedmetadata', () => {
    applyAspect(video.videoWidth / video.videoHeight);
  });

  if (item.thumb) {
    const img = new Image();
    img.onload = () => applyAspect(img.naturalWidth / img.naturalHeight);
    img.src = item.thumb;
  }

  div.addEventListener('click', () => onItemClick(item));
  div.appendChild(video);
  return div;
}

/**
 * upload/util.js
 * Helpers compartidos (escape, validación, extracción de metadata de video).
 */

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function extractVideoMetadata(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve({ duration: 0, width: 0, height: 0 });
    };
    video.src = URL.createObjectURL(file);
  });
}

export function showVideoError(msg) {
  const el = document.getElementById('uploadVideoError');
  if (el) { el.textContent = msg; el.hidden = false; }
}

export function hideVideoError() {
  const el = document.getElementById('uploadVideoError');
  if (el) { el.textContent = ''; el.hidden = true; }
}

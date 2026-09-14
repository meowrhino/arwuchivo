/**
 * Constantes compartidas del Worker.
 */

export const MIME = {
  json: 'application/json',
  mp4:  'video/mp4',
  webm: 'video/webm',
  mov:  'video/quicktime',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
};

// Validaciones estrictas para evitar path traversal en R2
export const VALID_DATE    = /^\d{4}-\d{2}-\d{2}$/;
export const VALID_DAYKEY  = /^\d{2}-\d{2}-\d{2}$/;
export const VALID_PERSON  = /^[a-zA-Z0-9_\- ]+$/;
export const VALID_ITEM_ID = /^[a-z0-9]+__[a-z0-9]+$/;
export const ALLOWED_EXT   = new Set(['mp4', 'webm', 'mov']);

export const ALLOWED_ORIGINS = new Set([
  'https://arwuchivo.meowrhino.studio',
  'http://localhost:8787',
]);
export const DEFAULT_ORIGIN = 'https://arwuchivo.meowrhino.studio';

export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;  // 100 MB

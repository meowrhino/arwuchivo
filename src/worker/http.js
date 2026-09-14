/**
 * http.js
 * Helpers HTTP genéricos: CORS, respuestas JSON, hashing, MIME por path.
 */

import { MIME, ALLOWED_ORIGINS, DEFAULT_ORIGIN } from './constants.js';

export function mimeFromPath(path) {
  const ext = path.split('.').pop().toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

export function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN;
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export function withCors(response, origin) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function sha256hex(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// X-Robots-Tag: noindex en TODAS las respuestas. La página es "no listada":
// accesible por link directo, pero nunca debe aparecer en buscadores. No usamos
// robots.txt con Disallow porque bloquear el rastreo impediría a Google leer
// este noindex (y aun así podría indexar la URL a ciegas).
export function withNoIndex(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Headers de cross-origin isolation para HTML (necesario para SAB / ffmpeg.wasm).
// Sin esto el coi-serviceworker.js del cliente intenta auto-recargar la página,
// lo que rompe la primera carga.
export function withCrossOriginIsolation(response) {
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) return response;

  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

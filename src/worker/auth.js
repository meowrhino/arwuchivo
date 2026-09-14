/**
 * auth.js
 * Rate limit por IP para el login. El Map vive en el isolate; se resetea
 * cuando CF lo recicla. No es perfecto, pero frena fuerza bruta trivial
 * contra UPLOAD_PASSWORD.
 *
 * Los endpoints de escritura NO necesitan comprobar nada aquí: el gate de
 * sesión (gate.js) corre antes que ellos en el router.
 */

const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX_AUTH_FAILS = 8;
const authFailures = new Map();  // ip → { count, firstAt }

export function getClientIP(request) {
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

export function checkRateLimit(request) {
  const ip = getClientIP(request);
  const now = Date.now();
  const entry = authFailures.get(ip);
  if (!entry) return true;
  if (now - entry.firstAt > RATE_WINDOW_MS) {
    authFailures.delete(ip);
    return true;
  }
  return entry.count < RATE_MAX_AUTH_FAILS;
}

export function recordAuthFailure(request) {
  const ip = getClientIP(request);
  const now = Date.now();
  const entry = authFailures.get(ip);
  if (!entry || now - entry.firstAt > RATE_WINDOW_MS) {
    authFailures.set(ip, { count: 1, firstAt: now });
  } else {
    entry.count++;
  }
  if (authFailures.size > 1000) {
    for (const [k, v] of authFailures) {
      if (now - v.firstAt > RATE_WINDOW_MS) authFailures.delete(k);
    }
  }
}

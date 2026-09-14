/**
 * auth.js
 * Rate limit por IP para endpoints de escritura.
 * Map persistente en el isolate; se resetea cuando CF lo recicla.
 * No es perfecto pero bloquea brute-force triviales contra UPLOAD_PASSWORD.
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

/**
 * Helper: chequea rate-limit + auth_token. Devuelve la respuesta de error
 * si no pasa, o null si todo OK.
 */
export function requireAuth(request, env, form) {
  // Importamos jsonResponse aquí para evitar dependencia cíclica
  // Ya lo importará el caller; este helper solo devuelve booleans/strings.
  if (!checkRateLimit(request)) {
    return { error: 'demasiados intentos, espera unos minutos', status: 429 };
  }
  const authToken = form.get('auth_token') || '';
  const expected = env.UPLOAD_PASSWORD || '';
  if (!expected || authToken !== expected) {
    recordAuthFailure(request);
    return { error: 'no autorizado', status: 401 };
  }
  return null;
}

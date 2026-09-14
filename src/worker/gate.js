/**
 * gate.js
 * Gate de sesión para TODO el sitio: sin cookie válida no se sirve nada
 * (ni assets, ni /data, ni /videos, ni /api).
 *
 * La cookie es `<expiry>.<HMAC-SHA256(UPLOAD_PASSWORD, expiry)>`: no guarda
 * el password, y solo el Worker puede firmarla. HttpOnly, 30 días.
 *
 * La pista del login sale de `env.LOGIN_HINT` (o de DEFAULT_HINT si no está
 * definida). Va detrás de un <details>, así que no se lee de primeras.
 */

import { checkRateLimit, recordAuthFailure } from './auth.js';

export const SESSION_COOKIE = 'arwuchivo_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;  // 30 días
export const ROBOTS_TAG = 'noindex, nofollow, noarchive, nosnippet, noimageindex';

const DEFAULT_HINT = 'el nombre de la escuela: wushu ______';

// ─── Firma HMAC ───────────────────────────────────────────────

async function hmacHex(key, msg) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEq(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : '';
}

async function makeSessionValue(env) {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const msg = String(expiry);
  return `${msg}.${await hmacHex(env.UPLOAD_PASSWORD || '', msg)}`;
}

async function verifySessionValue(value, env) {
  if (!value || !env.UPLOAD_PASSWORD) return false;
  const dot = value.indexOf('.');
  if (dot <= 0) return false;
  const expiryStr = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expiry = parseInt(expiryStr, 10);
  if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacHex(env.UPLOAD_PASSWORD, expiryStr);
  return constantTimeEq(expected, sig);
}

export async function isAuthenticated(request, env) {
  return await verifySessionValue(getCookie(request, SESSION_COOKIE), env);
}

function sessionCookieAttrs(url) {
  const secure = url.protocol === 'https:' ? 'Secure; ' : '';
  return `HttpOnly; ${secure}SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

// ─── Login / Logout ───────────────────────────────────────────

function escapeHtml(str) {
  return String(str).replace(/[<>&"']/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&#39;'
  }[c]));
}

export function loginPageResponse(env = {}, error = '') {
  const safeErr = escapeHtml(error);
  const hint = env.LOGIN_HINT ?? DEFAULT_HINT;
  const hintBlock = hint
    ? `<details class="hint">
    <summary>¿no te acuerdas?</summary>
    <p>${escapeHtml(hint)}</p>
  </details>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="${ROBOTS_TAG}" />
<meta name="referrer" content="no-referrer" />
<title>arwuchivo</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%;background:#fff;color:#000}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:300;letter-spacing:0.04em;display:flex;align-items:center;justify-content:center;padding:24px}
  form{display:flex;flex-direction:column;gap:14px;width:min(280px,90vw)}
  h1{font-weight:300;font-size:13px;letter-spacing:0.08em;text-transform:lowercase;text-align:center;margin-bottom:4px}
  label{text-transform:lowercase;letter-spacing:0.06em;color:#666;font-size:12px}
  input{appearance:none;border:none;border-bottom:1px solid #000;padding:8px 0;font-family:inherit;font-size:13px;background:transparent;letter-spacing:0.06em;outline:none;color:#000}
  input:focus{border-bottom-color:#ffa726}
  button{appearance:none;border:1px solid #000;background:#000;color:#fff;padding:10px 14px;font-family:inherit;font-size:13px;letter-spacing:0.06em;text-transform:lowercase;cursor:pointer;margin-top:4px;transition:background .15s,color .15s}
  button:hover{background:#fff;color:#000}
  .err{color:#c33;font-size:12px;min-height:1em;text-align:center}
  .hint{text-align:center;color:#999;font-size:12px;letter-spacing:0.06em}
  .hint summary{cursor:pointer;list-style:none;text-transform:lowercase;text-decoration:underline;text-underline-offset:3px}
  .hint summary::-webkit-details-marker{display:none}
  .hint p{margin-top:8px;color:#666}
  @media (prefers-color-scheme:dark){
    html,body{background:#111;color:#eee}
    input{color:#eee;border-bottom-color:#eee}
    button{background:#eee;color:#111;border-color:#eee}
    button:hover{background:#111;color:#eee}
    label,.hint p{color:#999}
  }
</style>
</head>
<body>
<form method="POST" action="/api/login" autocomplete="off">
  <h1>arwuchivo</h1>
  <label for="password">password</label>
  <input id="password" name="password" type="password" autofocus required />
  <button type="submit">entrar</button>
  <div class="err">${safeErr}</div>
  ${hintBlock}
</form>
</body>
</html>`;

  return new Response(html, {
    status: error ? 401 : 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': ROBOTS_TAG,
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function handleLogin(request, env, url) {
  if (!checkRateLimit(request)) {
    return loginPageResponse(env, 'demasiados intentos, espera unos minutos');
  }
  const form = await request.formData().catch(() => null);
  const password = form?.get('password') || '';
  const expected = env.UPLOAD_PASSWORD || '';
  if (!expected || password !== expected) {
    recordAuthFailure(request);
    // pequeño delay para frenar fuerza bruta básica
    await new Promise(r => setTimeout(r, 400));
    return loginPageResponse(env, 'contraseña incorrecta');
  }
  const value = await makeSessionValue(env);
  return new Response(null, {
    status: 303,
    headers: {
      'Location': '/',
      'Set-Cookie': `${SESSION_COOKIE}=${value}; ${sessionCookieAttrs(url)}`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': ROBOTS_TAG,
    },
  });
}

export function handleLogout(url) {
  const secure = url.protocol === 'https:' ? 'Secure; ' : '';
  return new Response(null, {
    status: 303,
    headers: {
      'Location': '/login',
      'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; ${secure}SameSite=Lax; Path=/; Max-Age=0`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': ROBOTS_TAG,
    },
  });
}

// ─── robots.txt ───────────────────────────────────────────────

export function robotsResponse() {
  const bots = [
    'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
    'ClaudeBot', 'anthropic-ai', 'Claude-Web',
    'Google-Extended', 'CCBot', 'PerplexityBot',
    'Bytespider', 'Amazonbot', 'meta-externalagent',
    'cohere-ai', 'Applebot-Extended', 'FacebookBot',
    'Diffbot', 'ImagesiftBot', 'omgili',
  ];
  const lines = ['User-agent: *', 'Disallow: /', ''];
  for (const b of bots) {
    lines.push(`User-agent: ${b}`, 'Disallow: /');
  }
  lines.push('');
  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': ROBOTS_TAG,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

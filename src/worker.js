/**
 * arwuchivo – Cloudflare Worker
 * Serves static assets, data/videos from R2, and handles uploads/deletes.
 */

const MIME = {
  json: 'application/json',
  mp4:  'video/mp4',
  webm: 'video/webm',
  mov:  'video/quicktime',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
};

// Validación estricta para evitar path traversal en R2
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_DAYKEY = /^\d{2}-\d{2}-\d{2}$/;
const VALID_PERSON = /^[a-zA-Z0-9_\- ]+$/;
const VALID_ITEM_ID = /^[a-z0-9]+__[a-z0-9]+$/;
const ALLOWED_EXT = new Set(['mp4', 'webm', 'mov']);

const ALLOWED_ORIGINS = new Set([
  'https://arwuchivo.meowrhino.studio',
  'http://localhost:8787',
]);
const DEFAULT_ORIGIN = 'https://arwuchivo.meowrhino.studio';

const SESSION_COOKIE = 'arwuchivo_session';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 días
const ROBOTS_TAG = 'noindex, nofollow, noarchive, nosnippet, noimageindex';

function mimeFromPath(path) {
  const ext = path.split('.').pop().toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // Rutas siempre públicas (no necesitan sesión)
    if (path === '/robots.txt') {
      return robotsResponse();
    }
    if (path === '/login' && request.method === 'GET') {
      return loginPageResponse();
    }
    if (path === '/api/login' && request.method === 'POST') {
      return await handleLogin(request, env, url);
    }
    if (path === '/api/logout' && request.method === 'POST') {
      return handleLogout(url);
    }

    // Gate: todo lo demás requiere cookie de sesión válida.
    // Si no, GET → redirige a /login; cualquier otro método → 401 JSON.
    const authed = await isAuthenticated(request, env);
    if (!authed) {
      if (request.method === 'GET') {
        return Response.redirect(new URL('/login', request.url).toString(), 302);
      }
      return finalize(jsonResponse({ error: 'no autorizado' }, 401), origin);
    }

    if (path === '/api/upload' && request.method === 'POST') {
      return finalize(await handleUpload(request, env), origin);
    }

    if (path === '/api/delete' && request.method === 'POST') {
      return finalize(await handleDelete(request, env), origin);
    }

    if (path.startsWith('/data/')) {
      // Nada bajo /data/private/ se sirve nunca (reservado para passwords/etc).
      if (path.startsWith('/data/private/')) {
        return finalize(new Response('Not found', { status: 404 }), origin);
      }
      return finalize(await serveDataFromR2(env.STORAGE, path.slice(1)), origin);
    }

    if (path.startsWith('/videos/')) {
      return finalize(await serveVideoFromR2(env.STORAGE, path.slice(1), request), origin);
    }

    // SAB/crossOriginIsolated is enabled by public/coi-serviceworker.js
    const assetRes = await env.ASSETS.fetch(request);
    return finalize(assetRes, origin);
  }
};

// ─── Upload Handler ──────────────────────────────────────────

async function handleUpload(request, env) {
  let videoPath = null;
  let thumbPath = null;
  try {
    const form = await request.formData();

    // Auth: la cookie de sesión ya validó al cliente en el gate de fetch().
    // No requerimos auth_token adicional.

    const video    = form.get('video');
    const thumbnail = form.get('thumbnail');
    const title    = form.get('title') || 'sin titulo';
    const notes    = form.get('notes') || null;
    const dateStr  = form.get('date') || '';
    const password = form.get('password') || null;

    // people: JSON inválido → 400 explícito, no 500
    let people;
    try {
      people = JSON.parse(form.get('people') || '[]');
    } catch {
      return jsonResponse({ error: 'campo "people" inválido' }, 400);
    }
    if (!Array.isArray(people) || people.length === 0) {
      return jsonResponse({ error: 'faltan personas' }, 400);
    }
    for (const p of people) {
      if (typeof p !== 'string' || !VALID_PERSON.test(p)) {
        return jsonResponse({ error: 'nombre de persona inválido' }, 400);
      }
    }

    // newPeople opcional
    let newPeople = null;
    const newPeopleRaw = form.get('newPeople');
    if (newPeopleRaw) {
      try {
        newPeople = JSON.parse(newPeopleRaw);
      } catch {
        return jsonResponse({ error: 'campo "newPeople" inválido' }, 400);
      }
      if (newPeople && typeof newPeople === 'object') {
        for (const [name, info] of Object.entries(newPeople)) {
          if (!VALID_PERSON.test(name) || typeof info?.color !== 'string') {
            return jsonResponse({ error: 'datos de nueva persona inválidos' }, 400);
          }
        }
      }
    }

    if (!video) {
      return jsonResponse({ error: 'falta el video' }, 400);
    }
    if (!VALID_DATE.test(dateStr)) {
      return jsonResponse({ error: 'fecha inválida (formato YYYY-MM-DD)' }, 400);
    }

    const contentType = video.type || '';
    if (!contentType.startsWith('video/')) {
      return jsonResponse({ error: 'solo se aceptan archivos de video' }, 415);
    }

    const MAX_SIZE = 100 * 1024 * 1024;
    if (video.size > MAX_SIZE) {
      const sizeMB = (video.size / (1024 * 1024)).toFixed(1);
      return jsonResponse({ error: `archivo demasiado grande (${sizeMB} MB). maximo: 100 MB` }, 413);
    }

    const ext = (video.name || 'video.mp4').split('.').pop().toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return jsonResponse({ error: `extensión no soportada: ${ext}` }, 400);
    }

    const yy = dateStr.slice(2, 4);
    const mm = dateStr.slice(5, 7);
    const dd = dateStr.slice(8, 10);
    const dayKey = `${yy}-${mm}-${dd}`;

    // personSlug: solo alfanumérico, lo demás fuera (protege paths)
    const personSlug = people[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'x';
    const seq = Date.now().toString(36);
    const id = `${personSlug}__${seq}`;

    videoPath = `videos/${yy}/${mm}/${dd}/${id}.${ext}`;

    // Password gating: hash y guardamos en customMetadata del objeto.
    // Así no aparece nunca en la respuesta pública del JSON.
    const passwordHash = password ? await sha256hex(password) : null;
    const customMetadata = passwordHash ? { passwordHash } : undefined;

    await env.STORAGE.put(videoPath, video.stream(), {
      httpMetadata: { contentType: video.type || mimeFromPath(videoPath) },
      customMetadata,
    });

    if (thumbnail && thumbnail.size > 0) {
      thumbPath = `videos/${yy}/${mm}/${dd}/${id}.jpg`;
      await env.STORAGE.put(thumbPath, thumbnail.stream(), {
        httpMetadata: { contentType: 'image/jpeg' },
        customMetadata,
      });
    }

    // Day JSON (atómico con etag)
    const dayJsonPath = `data/days/${dayKey}.json`;
    await updateJsonAtomic(env.STORAGE, dayJsonPath, (existing) => {
      const data = existing || { d: dayKey, items: [] };
      data.items.push({
        id,
        src: videoPath,
        thumb: thumbPath,
        title,
        notes,
        person: people,
        hasPassword: !!password,
      });
      return data;
    });

    // index.json (atómico)
    await updateJsonAtomic(env.STORAGE, 'data/index.json', (existing) => {
      const data = existing || { version: 1, days: [] };
      const entry = data.days.find(d => d.d === dayKey);
      if (entry) {
        entry.count = (entry.count || 0) + 1;
        entry.people = [...new Set([...(entry.people || []), ...people])];
      } else {
        data.days.push({ d: dayKey, people: [...people], count: 1 });
      }
      return data;
    });

    // leyenda.json (atómico, solo si hay nueva gente)
    if (newPeople && Object.keys(newPeople).length) {
      await updateJsonAtomic(env.STORAGE, 'data/leyenda.json', (existing) => {
        const data = existing || { people: {} };
        for (const [name, info] of Object.entries(newPeople)) {
          data.people[name] = info;
        }
        return data;
      });
    }

    return jsonResponse({ ok: true, id, src: videoPath });

  } catch (err) {
    // Rollback: si subimos el video/thumb y algo falló después, los borramos
    if (videoPath) {
      await env.STORAGE.delete(videoPath).catch(() => {});
    }
    if (thumbPath) {
      await env.STORAGE.delete(thumbPath).catch(() => {});
    }
    console.error('Upload error:', err?.message || err);
    return jsonResponse({ error: 'error interno' }, 500);
  }
}

// ─── Delete Handler ──────────────────────────────────────────

async function handleDelete(request, env) {
  try {
    const form = await request.formData();

    // Auth: la cookie de sesión ya validó al cliente en el gate de fetch().

    const id = form.get('id') || '';
    const dayKey = form.get('dayKey') || '';

    if (!VALID_DAYKEY.test(dayKey)) {
      return jsonResponse({ error: 'dayKey inválido' }, 400);
    }
    if (!VALID_ITEM_ID.test(id)) {
      return jsonResponse({ error: 'id inválido' }, 400);
    }

    const dayJsonPath = `data/days/${dayKey}.json`;
    const dayObj = await env.STORAGE.get(dayJsonPath);
    if (!dayObj) {
      return jsonResponse({ error: 'día no encontrado' }, 404);
    }
    const dayData = await dayObj.json();
    const item = (dayData.items || []).find(it => it.id === id);
    if (!item) {
      return jsonResponse({ error: 'video no encontrado' }, 404);
    }

    // Borrar archivos físicos (best effort)
    if (item.src)   await env.STORAGE.delete(item.src).catch(() => {});
    if (item.thumb) await env.STORAGE.delete(item.thumb).catch(() => {});

    // Quitar item del día
    const remaining = (dayData.items || []).filter(it => it.id !== id);

    if (remaining.length === 0) {
      // Día vacío: borramos el JSON del día y quitamos del index
      await env.STORAGE.delete(dayJsonPath).catch(() => {});
      await updateJsonAtomic(env.STORAGE, 'data/index.json', (existing) => {
        if (!existing) return { version: 1, days: [] };
        existing.days = (existing.days || []).filter(d => d.d !== dayKey);
        return existing;
      });
    } else {
      await updateJsonAtomic(env.STORAGE, dayJsonPath, () => ({
        ...dayData,
        items: remaining,
      }));
      // Recalcular count y people del día en el index
      const allPeople = [...new Set(
        remaining.flatMap(it => Array.isArray(it.person) ? it.person : [it.person]).filter(Boolean)
      )];
      await updateJsonAtomic(env.STORAGE, 'data/index.json', (existing) => {
        if (!existing) return { version: 1, days: [] };
        const entry = (existing.days || []).find(d => d.d === dayKey);
        if (entry) {
          entry.count = remaining.length;
          entry.people = allPeople;
        }
        return existing;
      });
    }

    return jsonResponse({ ok: true });

  } catch (err) {
    console.error('Delete error:', err?.message || err);
    return jsonResponse({ error: 'error interno' }, 500);
  }
}

// ─── R2 helpers ───────────────────────────────────────────────

async function updateJsonAtomic(bucket, key, updater, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const existing = await bucket.get(key);
    const data = existing ? await existing.json() : null;
    const updated = updater(data);

    const opts = {
      httpMetadata: { contentType: 'application/json' },
    };
    if (existing) {
      opts.onlyIf = { etagMatches: existing.etag };
    } else {
      opts.onlyIf = { etagDoesNotMatch: '*' };
    }

    const result = await bucket.put(key, JSON.stringify(updated, null, 2), opts);
    if (result !== null) return updated;

    // Conditional write falló (otro proceso modificó): backoff y reintenta
    await new Promise(r => setTimeout(r, 50 + Math.floor(Math.random() * 150)));
  }
  throw new Error(`updateJsonAtomic: ${maxRetries} reintentos agotados para ${key}`);
}

async function serveDataFromR2(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

  // Para day JSONs: nunca exponer passwords/hashes en la respuesta pública.
  // Soporta tanto el formato nuevo (hasPassword bool) como el legacy (password string).
  if (key.startsWith('data/days/') && key.endsWith('.json')) {
    try {
      const data = await object.json();
      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item.hasPassword === undefined) {
            // Legacy: el password en JSON nunca estuvo realmente protegido
            // a nivel servidor (URL pública). Lo marcamos como NO protegido
            // para no engañar al usuario con un prompt que no valida nada.
            item.hasPassword = false;
          }
          delete item.password;
          delete item.passwordHash;
        }
      }
      return new Response(JSON.stringify(data, null, 2), { status: 200, headers });
    } catch {
      // Si el JSON está corrupto, devuelve el original tal cual
      return new Response(object.body, { headers });
    }
  }

  return new Response(object.body, { headers });
}

async function serveVideoFromR2(bucket, key, request) {
  // Gate por password (si el objeto tiene customMetadata.passwordHash)
  const head = await bucket.head(key);
  if (!head) return new Response('Not found', { status: 404 });

  const requiredHash = head.customMetadata?.passwordHash;
  if (requiredHash) {
    const url = new URL(request.url);
    const provided = url.searchParams.get('p') || '';
    if (provided !== requiredHash) {
      return new Response('forbidden', { status: 403 });
    }
  }

  const range = request.headers.get('Range');
  let object;
  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1]);
      const end = match[2] ? parseInt(match[2]) : undefined;
      object = await bucket.get(key, {
        range: { offset: start, length: end !== undefined ? end - start + 1 : undefined },
      });
    } else {
      object = await bucket.get(key);
    }
  } else {
    object = await bucket.get(key);
  }

  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  const contentType = object.httpMetadata?.contentType || mimeFromPath(key);
  headers.set('Content-Type', contentType);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=86400');

  if (range && object.range) {
    const { offset, length } = object.range;
    const total = object.size;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${total}`);
    headers.set('Content-Length', length.toString());
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('Content-Length', object.size.toString());
  return new Response(object.body, { headers });
}

// ─── Misc helpers ─────────────────────────────────────────────

async function sha256hex(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function withCors(response, origin) {
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

// CORS + X-Robots-Tag + aislamiento cross-origin en una sola pasada.
// COOP/COEP activan SharedArrayBuffer (ffmpeg.wasm multi-thread) desde la
// primera carga, sin necesitar el coi-serviceworker ni recargar la página.
function finalize(response, origin) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) {
    headers.set(k, v);
  }
  if (!headers.has('X-Robots-Tag')) {
    headers.set('X-Robots-Tag', ROBOTS_TAG);
  }
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Auth: cookie firmada HMAC ────────────────────────────────

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
  const sig = await hmacHex(env.UPLOAD_PASSWORD || '', msg);
  return `${msg}.${sig}`;
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

async function isAuthenticated(request, env) {
  return await verifySessionValue(getCookie(request, SESSION_COOKIE), env);
}

function sessionCookieAttrs(url) {
  const secure = url.protocol === 'https:' ? 'Secure; ' : '';
  return `HttpOnly; ${secure}SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

// ─── Login / Logout ───────────────────────────────────────────

function loginPageResponse(error = '') {
  const safeErr = error.replace(/[<>&"']/g, c => ({
    '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;','\'':'&#39;'
  }[c]));
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
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
</style>
</head>
<body>
<form method="POST" action="/api/login" autocomplete="off">
  <h1>arwuchivo</h1>
  <label for="password">password</label>
  <input id="password" name="password" type="password" autofocus required />
  <button type="submit">entrar</button>
  <div class="err">${safeErr}</div>
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

async function handleLogin(request, env, url) {
  const form = await request.formData().catch(() => null);
  const password = form?.get('password') || '';
  const expected = env.UPLOAD_PASSWORD || '';
  if (!expected || password !== expected) {
    // pequeño delay para frenar fuerza bruta básica
    await new Promise(r => setTimeout(r, 400));
    return loginPageResponse('contraseña incorrecta');
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

function handleLogout(url) {
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

function robotsResponse() {
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

/**
 * serve handlers — GET /data/* y /videos/*
 * Sirve los JSONs y videos desde R2, con gating por password si el objeto
 * tiene customMetadata.passwordHash.
 */

import { mimeFromPath } from '../http.js';

export async function serveDataFromR2(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

  // Para day JSONs: nunca exponer passwords/hashes en la respuesta pública.
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
      return new Response(object.body, { headers });
    }
  }

  return new Response(object.body, { headers });
}

export async function serveVideoFromR2(bucket, key, request) {
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

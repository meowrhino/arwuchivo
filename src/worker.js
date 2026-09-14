/**
 * arwuchivo – Cloudflare Worker (router)
 * Sirve assets estáticos, data/videos desde R2, y maneja uploads/deletes/edits.
 *
 * Cada endpoint vive en `src/worker/handlers/<name>.js`. Este fichero solo
 * enruta y aplica CORS / cross-origin-isolation.
 */

import { corsHeaders, withCors, withCrossOriginIsolation, withNoIndex } from './worker/http.js';
import { handleUpload } from './worker/handlers/upload.js';
import { handleDelete } from './worker/handlers/delete.js';
import { handleEdit }   from './worker/handlers/edit.js';
import { handlePeopleSave, handlePeopleDelete } from './worker/handlers/people.js';
import { serveDataFromR2, serveVideoFromR2 } from './worker/handlers/serve.js';

export default {
  async fetch(request, env) {
    // Toda respuesta lleva X-Robots-Tag: noindex (sitio "no listado").
    return withNoIndex(await route(request, env));
  }
};

async function route(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (path === '/api/upload' && request.method === 'POST') {
      return withCors(await handleUpload(request, env), origin);
    }
    if (path === '/api/delete' && request.method === 'POST') {
      return withCors(await handleDelete(request, env), origin);
    }
    if (path === '/api/edit' && request.method === 'POST') {
      return withCors(await handleEdit(request, env), origin);
    }
    if (path === '/api/people/save' && request.method === 'POST') {
      return withCors(await handlePeopleSave(request, env), origin);
    }
    if (path === '/api/people/delete' && request.method === 'POST') {
      return withCors(await handlePeopleDelete(request, env), origin);
    }

    if (path.startsWith('/data/')) {
      // /data/private/* nunca se sirve (reservado para passwords/etc).
      if (path.startsWith('/data/private/')) {
        return withCors(new Response('Not found', { status: 404 }), origin);
      }
      return withCors(await serveDataFromR2(env.STORAGE, path.slice(1)), origin);
    }

    if (path.startsWith('/videos/')) {
      return withCors(await serveVideoFromR2(env.STORAGE, path.slice(1), request), origin);
    }

    // Assets estáticos. Para HTML añadimos COOP/COEP para que ffmpeg.wasm
    // funcione sin necesidad del coi-serviceworker.js auto-recargando.
    const assetResponse = await env.ASSETS.fetch(request);
    return withCrossOriginIsolation(assetResponse);
}

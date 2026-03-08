/**
 * arwuchivo – Cloudflare Worker
 * Serves static assets, data/videos from R2, and handles uploads.
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

function mimeFromPath(path) {
  const ext = path.split('.').pop().toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- CORS preflight ---
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // --- API: upload ---
    if (path === '/api/upload' && request.method === 'POST') {
      return withCors(await handleUpload(request, env));
    }

    // --- R2: data files ---
    if (path.startsWith('/data/')) {
      return withCors(await serveFromR2(env.STORAGE, path.slice(1), request));
    }

    // --- R2: video files ---
    if (path.startsWith('/videos/')) {
      return withCors(await serveFromR2(env.STORAGE, path.slice(1), request));
    }

    // --- Everything else: static assets ---
    return env.ASSETS.fetch(request);
  }
};

// ─── Upload Handler ──────────────────────────────────────────

async function handleUpload(request, env) {
  try {
    const form = await request.formData();
    const video    = form.get('video');
    const title    = form.get('title') || 'sin titulo';
    const dateStr  = form.get('date');          // YYYY-MM-DD
    const people   = JSON.parse(form.get('people'));  // ["Manu"]
    const password = form.get('password') || null;
    const newPeopleRaw = form.get('newPeople');
    const newPeople = newPeopleRaw ? JSON.parse(newPeopleRaw) : null;

    if (!video || !dateStr || !people?.length) {
      return jsonResponse({ error: 'faltan campos' }, 400);
    }

    // Validate file type
    const contentType = video.type || '';
    if (!contentType.startsWith('video/')) {
      return jsonResponse({ error: 'solo se aceptan archivos de video' }, 415);
    }

    // Validate file size (100MB max)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (video.size > MAX_SIZE) {
      const sizeMB = (video.size / (1024 * 1024)).toFixed(1);
      return jsonResponse({ error: `archivo demasiado grande (${sizeMB} MB). maximo: 100 MB` }, 413);
    }

    // Convert YYYY-MM-DD → YY, MM, DD
    const yy = dateStr.slice(2, 4);
    const mm = dateStr.slice(5, 7);
    const dd = dateStr.slice(8, 10);
    const dayKey = `${yy}-${mm}-${dd}`;

    // Generate unique ID
    const personSlug = people[0].toLowerCase().replace(/\s+/g, '');
    const seq = Date.now().toString(36);
    const id = `${personSlug}__${seq}`;
    const ext = (video.name || 'video.mp4').split('.').pop().toLowerCase();
    const videoPath = `videos/${yy}/${mm}/${dd}/${id}.${ext}`;

    // 1. Store video in R2
    await env.STORAGE.put(videoPath, video.stream(), {
      httpMetadata: { contentType: video.type || mimeFromPath(videoPath) },
    });

    // 2. Update/create day JSON
    const dayJsonPath = `data/days/${dayKey}.json`;
    let dayData;
    const existingDay = await env.STORAGE.get(dayJsonPath);
    if (existingDay) {
      dayData = await existingDay.json();
    } else {
      dayData = { d: dayKey, items: [] };
    }
    dayData.items.push({
      id,
      src: videoPath,
      thumb: null,
      title,
      person: people,
      password,
    });
    await env.STORAGE.put(dayJsonPath, JSON.stringify(dayData, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });

    // 3. Update index.json
    let indexData;
    const existingIndex = await env.STORAGE.get('data/index.json');
    if (existingIndex) {
      indexData = await existingIndex.json();
    } else {
      indexData = { version: 1, days: [] };
    }
    const dayEntry = indexData.days.find(d => d.d === dayKey);
    if (dayEntry) {
      dayEntry.count = dayData.items.length;
      // Merge all people from all items in that day
      dayEntry.people = [...new Set(
        dayData.items.flatMap(item =>
          Array.isArray(item.person) ? item.person : [item.person]
        )
      )];
    } else {
      indexData.days.push({ d: dayKey, people: [...people], count: 1 });
    }
    await env.STORAGE.put('data/index.json', JSON.stringify(indexData, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });

    // 4. Update leyenda.json if new people
    if (newPeople && Object.keys(newPeople).length) {
      let leyenda;
      const existingLeyenda = await env.STORAGE.get('data/leyenda.json');
      if (existingLeyenda) {
        leyenda = await existingLeyenda.json();
      } else {
        leyenda = { people: {} };
      }
      for (const [name, data] of Object.entries(newPeople)) {
        leyenda.people[name] = data;
      }
      await env.STORAGE.put('data/leyenda.json', JSON.stringify(leyenda, null, 2), {
        httpMetadata: { contentType: 'application/json' },
      });
    }

    return jsonResponse({ ok: true, id, src: videoPath });

  } catch (err) {
    console.error('Upload error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
}

// ─── R2 Serving (with Range support for video streaming) ─────

async function serveFromR2(bucket, key, request) {
  // Handle Range requests for video seeking
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

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  const contentType = object.httpMetadata?.contentType || mimeFromPath(key);
  headers.set('Content-Type', contentType);
  headers.set('Accept-Ranges', 'bytes');

  // JSON data changes on upload → no cache. Videos are immutable → cache.
  if (contentType === 'application/json') {
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    headers.set('Cache-Control', 'public, max-age=86400');
  }

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

// ─── Helpers ─────────────────────────────────────────────────

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
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

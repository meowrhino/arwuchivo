/**
 * upload handler — POST /api/upload
 */

import { jsonResponse, mimeFromPath, sha256hex } from '../http.js';
import { updateJsonAtomic } from '../r2-helpers.js';
import {
  VALID_DATE, VALID_PERSON, ALLOWED_EXT, MAX_UPLOAD_SIZE,
} from '../constants.js';

export async function handleUpload(request, env) {
  let videoPath = null;
  let thumbPath = null;
  try {
    const form = await request.formData();

    // Auth: el gate de sesión del router ya validó la cookie.
    const video     = form.get('video');
    const thumbnail = form.get('thumbnail');
    const title     = form.get('title') || 'sin titulo';
    const notes     = form.get('notes') || null;
    const dateStr   = form.get('date') || '';
    const password  = form.get('password') || null;

    let people;
    try { people = JSON.parse(form.get('people') || '[]'); }
    catch { return jsonResponse({ error: 'campo "people" inválido' }, 400); }
    if (!Array.isArray(people) || people.length === 0) {
      return jsonResponse({ error: 'faltan personas' }, 400);
    }
    for (const p of people) {
      if (typeof p !== 'string' || !VALID_PERSON.test(p)) {
        return jsonResponse({ error: 'nombre de persona inválido' }, 400);
      }
    }

    let newPeople = null;
    const newPeopleRaw = form.get('newPeople');
    if (newPeopleRaw) {
      try { newPeople = JSON.parse(newPeopleRaw); }
      catch { return jsonResponse({ error: 'campo "newPeople" inválido' }, 400); }
      if (newPeople && typeof newPeople === 'object') {
        for (const [name, info] of Object.entries(newPeople)) {
          if (!VALID_PERSON.test(name) || typeof info?.color !== 'string') {
            return jsonResponse({ error: 'datos de nueva persona inválidos' }, 400);
          }
        }
      }
    }

    if (!video) return jsonResponse({ error: 'falta el video' }, 400);
    if (!VALID_DATE.test(dateStr)) {
      return jsonResponse({ error: 'fecha inválida (formato YYYY-MM-DD)' }, 400);
    }
    if (!(video.type || '').startsWith('video/')) {
      return jsonResponse({ error: 'solo se aceptan archivos de video' }, 415);
    }
    if (video.size > MAX_UPLOAD_SIZE) {
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

    const personSlug = people[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'x';
    const seq = Date.now().toString(36);
    const id = `${personSlug}__${seq}`;

    videoPath = `videos/${yy}/${mm}/${dd}/${id}.${ext}`;

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

    const dayJsonPath = `data/days/${dayKey}.json`;
    await updateJsonAtomic(env.STORAGE, dayJsonPath, (existing) => {
      const data = existing || { d: dayKey, items: [] };
      data.items.push({
        id, src: videoPath, thumb: thumbPath,
        title, notes, person: people, hasPassword: !!password,
      });
      return data;
    });

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
    if (videoPath) await env.STORAGE.delete(videoPath).catch(() => {});
    if (thumbPath) await env.STORAGE.delete(thumbPath).catch(() => {});
    console.error('Upload error:', err?.message || err);
    return jsonResponse({ error: 'error interno' }, 500);
  }
}

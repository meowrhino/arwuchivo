/**
 * edit handler — POST /api/edit
 */

import { jsonResponse, sha256hex } from '../http.js';
import { requireAuth } from '../auth.js';
import { updateJsonAtomic } from '../r2-helpers.js';
import { VALID_DAYKEY, VALID_ITEM_ID, VALID_PERSON } from '../constants.js';

export async function handleEdit(request, env) {
  try {
    const form = await request.formData();

    const authErr = requireAuth(request, env, form);
    if (authErr) return jsonResponse({ error: authErr.error }, authErr.status);

    const id = form.get('id') || '';
    const dayKey = form.get('dayKey') || '';
    if (!VALID_DAYKEY.test(dayKey)) return jsonResponse({ error: 'dayKey inválido' }, 400);
    if (!VALID_ITEM_ID.test(id))    return jsonResponse({ error: 'id inválido' }, 400);

    const title = form.get('title') || 'sin titulo';
    const notes = form.get('notes') || null;
    const passwordRaw = form.get('password');
    const passwordChanged = passwordRaw !== null;
    const password = passwordRaw || '';

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

    const dayJsonPath = `data/days/${dayKey}.json`;
    const dayObj = await env.STORAGE.get(dayJsonPath);
    if (!dayObj) return jsonResponse({ error: 'día no encontrado' }, 404);
    const dayData = await dayObj.json();
    const item = (dayData.items || []).find(it => it.id === id);
    if (!item) return jsonResponse({ error: 'video no encontrado' }, 404);

    if (passwordChanged) {
      const passwordHash = password ? await sha256hex(password) : null;
      const customMetadata = passwordHash ? { passwordHash } : undefined;
      for (const path of [item.src, item.thumb].filter(Boolean)) {
        const obj = await env.STORAGE.get(path);
        if (!obj) continue;
        await env.STORAGE.put(path, obj.body, {
          httpMetadata: obj.httpMetadata,
          customMetadata,
        });
      }
      item.hasPassword = !!password;
    }

    item.title = title;
    item.notes = notes;
    item.person = people;
    delete item.password;
    delete item.passwordHash;

    await updateJsonAtomic(env.STORAGE, dayJsonPath, () => ({
      ...dayData,
      items: dayData.items.map(it => it.id === id ? item : it),
    }));

    const allPeople = [...new Set(
      (dayData.items || []).flatMap(it => {
        if (it.id === id) return people;
        return Array.isArray(it.person) ? it.person : [it.person];
      }).filter(Boolean)
    )];
    await updateJsonAtomic(env.STORAGE, 'data/index.json', (existing) => {
      if (!existing) return { version: 1, days: [] };
      const entry = (existing.days || []).find(d => d.d === dayKey);
      if (entry) entry.people = allPeople;
      return existing;
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('Edit error:', err?.message || err);
    return jsonResponse({ error: 'error interno' }, 500);
  }
}

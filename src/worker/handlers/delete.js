/**
 * delete handler — POST /api/delete
 */

import { jsonResponse } from '../http.js';
import { requireAuth } from '../auth.js';
import { updateJsonAtomic } from '../r2-helpers.js';
import { VALID_DAYKEY, VALID_ITEM_ID } from '../constants.js';

export async function handleDelete(request, env) {
  try {
    const form = await request.formData();

    const authErr = requireAuth(request, env, form);
    if (authErr) return jsonResponse({ error: authErr.error }, authErr.status);

    const id = form.get('id') || '';
    const dayKey = form.get('dayKey') || '';
    if (!VALID_DAYKEY.test(dayKey)) return jsonResponse({ error: 'dayKey inválido' }, 400);
    if (!VALID_ITEM_ID.test(id))    return jsonResponse({ error: 'id inválido' }, 400);

    const dayJsonPath = `data/days/${dayKey}.json`;
    const dayObj = await env.STORAGE.get(dayJsonPath);
    if (!dayObj) return jsonResponse({ error: 'día no encontrado' }, 404);
    const dayData = await dayObj.json();
    const item = (dayData.items || []).find(it => it.id === id);
    if (!item) return jsonResponse({ error: 'video no encontrado' }, 404);

    if (item.src)   await env.STORAGE.delete(item.src).catch(() => {});
    if (item.thumb) await env.STORAGE.delete(item.thumb).catch(() => {});

    const remaining = (dayData.items || []).filter(it => it.id !== id);

    if (remaining.length === 0) {
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

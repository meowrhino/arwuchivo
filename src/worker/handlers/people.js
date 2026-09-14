/**
 * people handlers — POST /api/people/save  +  POST /api/people/delete
 */

import { jsonResponse } from '../http.js';
import { requireAuth } from '../auth.js';
import { updateJsonAtomic } from '../r2-helpers.js';
import { VALID_PERSON } from '../constants.js';

export async function handlePeopleSave(request, env) {
  try {
    const form = await request.formData();

    const authErr = requireAuth(request, env, form);
    if (authErr) return jsonResponse({ error: authErr.error }, authErr.status);

    let people;
    try { people = JSON.parse(form.get('people') || '{}'); }
    catch { return jsonResponse({ error: 'people inválido' }, 400); }
    if (typeof people !== 'object' || people === null || Array.isArray(people)) {
      return jsonResponse({ error: 'people debe ser un objeto' }, 400);
    }
    for (const [name, info] of Object.entries(people)) {
      if (!VALID_PERSON.test(name) || typeof info?.color !== 'string') {
        return jsonResponse({ error: 'datos de persona inválidos' }, 400);
      }
    }

    let rename = null;
    const renameRaw = form.get('rename');
    if (renameRaw) {
      try {
        rename = JSON.parse(renameRaw);
        if (!rename?.from || !rename?.to || !VALID_PERSON.test(rename.from) || !VALID_PERSON.test(rename.to)) {
          rename = null;
        }
      } catch { rename = null; }
    }

    await updateJsonAtomic(env.STORAGE, 'data/leyenda.json', () => ({ people }));

    if (rename) {
      const indexObj = await env.STORAGE.get('data/index.json');
      const indexData = indexObj ? await indexObj.json() : { version: 1, days: [] };
      const affectedDays = (indexData.days || [])
        .filter(d => Array.isArray(d.people) && d.people.includes(rename.from))
        .map(d => d.d);

      for (const dayKey of affectedDays) {
        const dayJsonPath = `data/days/${dayKey}.json`;
        await updateJsonAtomic(env.STORAGE, dayJsonPath, (existing) => {
          if (!existing) return existing;
          existing.items = (existing.items || []).map(it => {
            const persons = Array.isArray(it.person) ? it.person : [it.person];
            const renamed = persons.map(p => p === rename.from ? rename.to : p);
            return { ...it, person: renamed };
          });
          return existing;
        });
      }

      await updateJsonAtomic(env.STORAGE, 'data/index.json', (existing) => {
        if (!existing) return existing;
        existing.days = (existing.days || []).map(d => ({
          ...d,
          people: (d.people || []).map(p => p === rename.from ? rename.to : p),
        }));
        return existing;
      });
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('People save error:', err?.message || err);
    return jsonResponse({ error: 'error interno' }, 500);
  }
}

export async function handlePeopleDelete(request, env) {
  try {
    const form = await request.formData();

    const authErr = requireAuth(request, env, form);
    if (authErr) return jsonResponse({ error: authErr.error }, authErr.status);

    const name = form.get('name') || '';
    if (!VALID_PERSON.test(name)) return jsonResponse({ error: 'nombre inválido' }, 400);

    await updateJsonAtomic(env.STORAGE, 'data/leyenda.json', (existing) => {
      if (!existing) return { people: {} };
      const next = { ...existing, people: { ...(existing.people || {}) } };
      delete next.people[name];
      return next;
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('People delete error:', err?.message || err);
    return jsonResponse({ error: 'error interno' }, 500);
  }
}

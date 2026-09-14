/**
 * data.js
 * Carga de datos JSON y utilidades de fecha
 */

// El index se cachea por llamada a loadIndex. loadDayData lo reutiliza si
// está fresco; si no, vuelve a pedirlo. Las invalidaciones reales suceden al
// llamar loadIndex() de nuevo tras una subida/borrado.
let cachedIndex = null;

export async function loadIndex() {
  const data = await fetchJSON('data/index.json');
  cachedIndex = data;
  const allMonths = Array.isArray(data?.days) ? data.days.map(d => d.d.slice(0, 5)) : [];
  return {
    months: [...new Set(allMonths)],
    days: Array.isArray(data?.days) ? data.days : []
  };
}

export async function loadDayData(monthStr) {
  const index = cachedIndex || await fetchJSON('data/index.json');
  const days = Array.isArray(index?.days)
    ? index.days.filter(d => d.d.startsWith(monthStr))
    : [];

  const dayData = await Promise.allSettled(
    days.map(d => fetchJSON(`data/days/${d.d}.json`))
  );

  // Loguear fallos en vez de tragárnoslos en silencio: si un día falla, el
  // canvas se quedaba vacío sin que supieras por qué. Reintenta una vez los
  // que fallaron por si fue un blip (carrera con el SW, red intermitente).
  const failed = [];
  const ok = [];
  dayData.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) ok.push(r.value);
    else failed.push({ day: days[i].d, reason: r.reason });
  });

  if (failed.length) {
    console.warn('[arwuchivo] day JSON fetch failed:', failed);
    const retried = await Promise.allSettled(
      failed.map(f => fetchJSON(`data/days/${f.day}.json`))
    );
    retried.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) ok.push(r.value);
      else console.error(`[arwuchivo] retry failed for ${failed[i].day}:`, r.reason);
    });
  }

  return ok;
}

export async function loadLegend() {
  try {
    return await fetchJSON('data/leyenda.json');
  } catch {
    return { people: {} };
  }
}

export async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${path} (${res.status})`);
  return await res.json();
}

export function daysInMonth(yyMM) {
  const [yy, mm] = yyMM.split("-").map(Number);
  return new Date(2000 + yy, mm, 0).getDate();
}

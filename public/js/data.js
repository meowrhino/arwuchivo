/**
 * data.js
 * Carga de datos JSON y utilidades de fecha
 */

let cachedIndex = null;

export async function loadIndex() {
  cachedIndex = null;  // Invalidate cache to get fresh data
  const data = await fetchJSON('data/index.json');
  cachedIndex = data;
  const allMonths = Array.isArray(data?.days) ? data.days.map(d => d.d.slice(0, 5)) : [];
  return {
    months: [...new Set(allMonths)],
    days: Array.isArray(data?.days) ? data.days : []
  };
}

export async function loadDayData(monthStr) {
  // Usar index cacheado si existe, si no cargar
  const index = cachedIndex || await fetchJSON('data/index.json');
  const days = Array.isArray(index?.days)
    ? index.days.filter(d => d.d.startsWith(monthStr))
    : [];

  const dayData = await Promise.allSettled(
    days.map(d => fetchJSON(`data/days/${d.d}.json`))
  );

  return dayData
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(Boolean);
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

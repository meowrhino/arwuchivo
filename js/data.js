export async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${path} (${res.status})`);
  return await res.json();
}

export function parseParams() {
  const u = new URL(location.href);
  return {
    m: u.searchParams.get("m"),
    d: u.searchParams.get("d"),
  };
}

export function nowYYMM() {
  const dt = new Date();
  const yy = String(dt.getFullYear() % 100).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export function monthFromDay(yyMMdd) {
  return yyMMdd.slice(0, 5); // YY-MM
}

/**
 * Dado YY-MM, devuelve número de días del mes (28-31).
 * Como jugamos a años de 2 dígitos (YY), asumimos 20YY para calcular Febrero/leap years.
 * Sí: 2002 y 2102 colisionan en índice, pero para días del mes necesitamos *algún* año
 * para que JS Date sepa si Febrero tiene 28 o 29. Usamos 2000+YY y listo.
 */
export function daysInMonth(yyMM) {
  const [yy, mm] = yyMM.split("-").map(Number);
  const year = 2000 + yy;
  const monthIndex = mm; // en Date, el día 0 del mes siguiente = último día del mes actual
  return new Date(year, monthIndex, 0).getDate();
}

export function formatMonthLabel(yyMM, locale = "es-ES") {
  const [yy, mm] = yyMM.split("-").map(Number);
  // Año “falso” 2000+YY solo para obtener nombre del mes en Date
  const dt = new Date(2000 + yy, mm - 1, 1);
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(dt);
  return `${capitalize(monthName)} ’${String(yy).padStart(2, "0")}`;
}

export function formatDayLabel(yyMMdd, locale = "es-ES") {
  const [yy, mm, dd] = yyMMdd.split("-").map(Number);
  const dt = new Date(2000 + yy, mm - 1, dd);
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(dt);
  return `${String(dd).padStart(2, "0")} ${capitalize(monthName)} ’${String(yy).padStart(2, "0")}`;
}

export function formatDayShort(yyMMdd) {
  const [yy, mm, dd] = yyMMdd.split("-").map(Number);
  return `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/’${String(yy).padStart(2, "0")}`;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

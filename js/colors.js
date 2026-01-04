/**
 * Colores:
 * - Oficiales vienen de leyenda.json
 * - Auto: se eligen de una paleta, de forma determinista por nombre (hash).
 */
export const AUTO_PALETTE = [
  "#FF1493", "#FF69B4", "#FFC0CB", "#FF4500", "#FFA500",
  "#FFD700", "#DAA520", "#7B68EE", "#4B0082", "#1E90FF",
  "#00CED1", "#20B2AA", "#32CD32", "#7FFF00", "#A52A2A",
  "#8B4513", "#F08080", "#DC143C", "#BDB76B", "#BC8F8F"
];

export function resolvePersonColor(name, legendPeopleMap) {
  const official = legendPeopleMap?.[name]?.color;
  if (official) return { color: official, isOfficial: true };
  return { color: autoColorForName(name), isOfficial: false };
}

export function autoColorForName(name) {
  const h = hashString(name);
  const idx = h % AUTO_PALETTE.length;
  return AUTO_PALETTE[idx];
}

/**
 * Promedio RGB equitativo por personas:
 * si hay N personas -> cada una aporta (100/N)%.
 * Eso es literalmente “regla de 3”: 100% repartido entre N.
 */
export function averageColorsHex(hexColors) {
  const colors = hexColors.filter(Boolean);
  const n = colors.length;
  if (n === 0) return "#808080";
  if (n === 1) return colors[0];

  const weight = 1 / n; // cada persona pesa 1/N (equivale a 100/N %)
  let r = 0, g = 0, b = 0;

  for (const hex of colors) {
    const { r: rr, g: gg, b: bb } = hexToRgb(hex);
    r += rr * weight;
    g += gg * weight;
    b += bb * weight;
  }
  return rgbToHex(Math.round(r), Math.round(g), Math.round(b));
}

export function hexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r, g, b) {
  const to = (x) => x.toString(16).padStart(2, "0");
  return `#${to(clamp(r))}${to(clamp(g))}${to(clamp(b))}`;
}

function clamp(n) { return Math.max(0, Math.min(255, n)); }

function hashString(s) {
  // hash simple y estable (no crypto): suficiente para elegir color
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

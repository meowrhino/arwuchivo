/**
 * lab.js
 * Mezcla de colores en espacio CIELAB (perceptualmente uniforme).
 *
 * Pipeline:
 *   sRGB → linear RGB → XYZ (D65) → Lab
 *   promedio en Lab
 *   Lab → XYZ → linear RGB → sRGB → hex
 *
 * Útil cuando HSL produce mezclas raras (ej: purple + gold = rojo en HSL,
 * porque los hues son casi opuestos en el círculo). LAB respeta mejor la
 * percepción humana del color y suele dar resultados más naturales.
 */

// ─── sRGB ⇄ linear RGB ───────────────────────────────────────

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, v)) * 255);
}

// ─── linear RGB ⇄ XYZ (D65) ───────────────────────────────────

function rgbToXyz(r, g, b) {
  // Matriz sRGB D65 estándar
  return {
    x: r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
    y: r * 0.2126729 + g * 0.7151522 + b * 0.0721750,
    z: r * 0.0193339 + g * 0.1191920 + b * 0.9503041,
  };
}

function xyzToRgb(x, y, z) {
  return {
    r:  x *  3.2404542 + y * -1.5371385 + z * -0.4985314,
    g:  x * -0.9692660 + y *  1.8760108 + z *  0.0415560,
    b:  x *  0.0556434 + y * -0.2040259 + z *  1.0572252,
  };
}

// ─── XYZ ⇄ Lab ───────────────────────────────────────────────

// White point D65 normalizado
const Xn = 0.95047;
const Yn = 1.00000;
const Zn = 1.08883;

const DELTA = 6 / 29;
const DELTA3 = DELTA ** 3;

function fLab(t) {
  return t > DELTA3
    ? Math.cbrt(t)
    : t / (3 * DELTA * DELTA) + 4 / 29;
}

function fLabInv(t) {
  return t > DELTA
    ? t ** 3
    : 3 * DELTA * DELTA * (t - 4 / 29);
}

function xyzToLab(x, y, z) {
  const fx = fLab(x / Xn);
  const fy = fLab(y / Yn);
  const fz = fLab(z / Zn);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function labToXyz(L, a, b) {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  return {
    x: Xn * fLabInv(fx),
    y: Yn * fLabInv(fy),
    z: Zn * fLabInv(fz),
  };
}

// ─── API pública ─────────────────────────────────────────────

// Acepta '#RRGGBB' o 'RRGGBB' (también 'rgb' corto). El caller debería
// pasarlo ya normalizado a hex (resolveFusionGradient lo hace).
export function hexToLab(hex) {
  if (!hex) return { L: 0, a: 0, b: 0 };
  let h = String(hex).replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const m = h.match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return { L: 0, a: 0, b: 0 };
  const r = srgbToLinear(parseInt(m[1], 16));
  const g = srgbToLinear(parseInt(m[2], 16));
  const b = srgbToLinear(parseInt(m[3], 16));
  const { x, y, z } = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

export function labToHex(L, a, b) {
  const { x, y, z } = labToXyz(L, a, b);
  const { r, g, b: bl } = xyzToRgb(x, y, z);
  const R = linearToSrgb(r);
  const G = linearToSrgb(g);
  const B = linearToSrgb(bl);
  const hex = (n) => n.toString(16).padStart(2, '0');
  return `#${hex(R)}${hex(G)}${hex(B)}`;
}

/**
 * Promedio en CIELAB. Si solo hay 1 color, lo devuelve tal cual.
 * Si hay varios, hace media aritmética en L, a, b por separado.
 */
export function averageColorsLAB(hexColors) {
  const labs = hexColors.map(hexToLab).filter(c => Number.isFinite(c.L));
  const n = labs.length;
  if (n === 0) return '#808080';
  if (n === 1) return labToHex(labs[0].L, labs[0].a, labs[0].b);

  let L = 0, a = 0, b = 0;
  for (const c of labs) { L += c.L; a += c.a; b += c.b; }
  return labToHex(L / n, a / n, b / n);
}

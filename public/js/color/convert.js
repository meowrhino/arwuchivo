/**
 * convert.js
 * Conversiones entre formatos de color (hex / rgb / hsl).
 * `colorToHex()` es la entrada principal: acepta "Purple", "#fa0", "rgb(...)" y devuelve "#RRGGBB".
 */

import { HTML_COLOR_HEX } from './palette.js';

const COLOR_CACHE = new Map();
let colorCtx = null;

export function colorToHex(color) {
  if (!color) return null;
  const raw = String(color).trim();
  if (!raw) return null;

  const cacheKey = raw.toLowerCase();
  if (COLOR_CACHE.has(cacheKey)) return COLOR_CACHE.get(cacheKey);

  let hex = normalizeHexColor(raw);
  if (!hex) {
    const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    hex = HTML_COLOR_HEX[key] || null;
  }
  if (!hex) hex = cssColorToHex(raw);

  COLOR_CACHE.set(cacheKey, hex);
  return hex;
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

export function hexToHSL(hex) {
  const { r: r255, g: g255, b: b255 } = hexToRgb(hex);
  const r = r255 / 255, g = g255 / 255, b = b255 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToHex(h, s, l) {
  const sN = s / 100, lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  );
}

function clamp(n) { return Math.max(0, Math.min(255, n)); }

function normalizeHexColor(input) {
  const match = String(input).trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  let hex = match[1].toLowerCase();
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  return `#${hex}`;
}

function cssColorToHex(color) {
  if (typeof document === "undefined") return null;
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return null;
  if (!CSS.supports("color", color)) return null;

  if (!colorCtx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    colorCtx = canvas.getContext("2d");
  }
  if (!colorCtx) return null;

  colorCtx.fillStyle = color;
  const computed = colorCtx.fillStyle;
  if (!computed) return null;
  if (computed.startsWith("#")) return normalizeHexColor(computed);

  const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  return rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]));
}

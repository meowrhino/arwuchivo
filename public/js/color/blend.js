/**
 * blend.js
 * Promedios de color en HSL y RGB. Para LAB ver ./lab.js.
 */

import { colorToHex, hexToRgb, rgbToHex, hexToHSL, hslToHex } from './convert.js';

/**
 * Promedio en HSL con boost de saturación. Cuidado: el promedio circular
 * del hue puede dar resultados inesperados cuando los colores son opuestos
 * en la rueda (ej: purple + gold = rojo). Para mezclas perceptualmente
 * más naturales usa averageColorsLAB.
 */
export function averageColorsHSL(hexColors) {
  const colors = hexColors.map(colorToHex).filter(Boolean);
  const n = colors.length;
  if (n === 0) return "#808080";
  if (n === 1) return colors[0];

  const hsls = colors.map(hexToHSL);

  let sinSum = 0, cosSum = 0;
  let sSum = 0, lSum = 0;
  for (const { h, s, l } of hsls) {
    const rad = (h * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
    sSum += s;
    lSum += l;
  }

  let avgH = (Math.atan2(sinSum / n, cosSum / n) * 180) / Math.PI;
  if (avgH < 0) avgH += 360;

  const avgS = Math.min(100, (sSum / n) * 1.15);
  const avgL = lSum / n;

  return hslToHex(avgH, avgS, avgL);
}

/** Promedio RGB plano. Útil como referencia o fallback. */
export function averageColorsHex(hexColors) {
  const colors = hexColors.map(colorToHex).filter(Boolean);
  const n = colors.length;
  if (n === 0) return "#808080";
  if (n === 1) return colors[0];

  const weight = 1 / n;
  let r = 0, g = 0, b = 0;
  for (const hex of colors) {
    const { r: rr, g: gg, b: bb } = hexToRgb(hex);
    r += rr * weight;
    g += gg * weight;
    b += bb * weight;
  }
  return rgbToHex(Math.round(r), Math.round(g), Math.round(b));
}

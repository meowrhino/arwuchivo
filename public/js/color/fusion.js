/**
 * fusion.js
 * Color final usado en la UI de un video con N autores.
 * 1 autor → color sólido del autor.
 * 2+ autores → mezcla LAB (una sola color, no gradiente).
 *
 * Por qué LAB y no HSL: HSL promedia el hue de forma circular, lo que con
 * colores casi opuestos (purple + gold) da rojo (camino corto pasa por el
 * rojo). LAB es perceptualmente uniforme y da una mezcla más natural.
 */

import { colorToHex } from './convert.js';
import { averageColorsLAB } from './lab.js';
import { autoColorForName } from './resolve.js';

function resolveColors(names, legendPeopleMap) {
  return names.map(name => {
    const official = legendPeopleMap?.[name]?.color;
    return official ? (colorToHex(official) || official) : autoColorForName(name);
  });
}

export function resolveFusionGradient(nameOrNames, legendPeopleMap) {
  const names = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames];
  if (names.length === 0) return "#808080";

  const colors = resolveColors(names, legendPeopleMap);
  if (colors.length === 1) return colors[0];
  return averageColorsLAB(colors);
}

/**
 * conic-gradient para usos donde sí queremos ver segmentos por autor
 * (ej: timeline dots si volvemos a meter timeline). No es el comportamiento
 * por defecto de la fusion principal.
 */
export function resolveFusionRadial(nameOrNames, legendPeopleMap) {
  const names = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames];
  if (names.length === 0) return "#808080";

  const colors = resolveColors(names, legendPeopleMap);
  if (colors.length === 1) return colors[0];

  const segDeg = 360 / colors.length;
  const stops = colors.map((c, i) => {
    const start = i * segDeg;
    const end = (i + 1) * segDeg;
    return `${c} ${start}deg ${end}deg`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

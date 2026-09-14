/**
 * resolve.js
 * Resolución de "qué color usar para X persona(s)".
 * Si la persona está en la leyenda, se usa su color oficial.
 * Si no, se asigna un color de la paleta de forma determinista (hash del nombre).
 */

import { AUTO_PALETTE } from './palette.js';
import { colorToHex } from './convert.js';
import { averageColorsHSL } from './blend.js';

export function resolvePersonColor(nameOrNames, legendPeopleMap) {
  const names = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames];

  if (names.length === 0) {
    return { color: "#808080", isOfficial: false, people: [] };
  }

  if (names.length === 1) {
    const name = names[0];
    const official = legendPeopleMap?.[name]?.color;
    if (official) {
      const normalized = colorToHex(official);
      return { color: normalized || official, isOfficial: true, people: [name] };
    }
    return { color: autoColorForName(name), isOfficial: false, people: [name] };
  }

  // Múltiples personas: en este contexto (dot pequeño de la leyenda, etc.)
  // seguimos usando HSL porque el dot es decorativo, no la fusion principal.
  const colors = names.map(name => {
    const official = legendPeopleMap?.[name]?.color;
    return official ? (colorToHex(official) || official) : autoColorForName(name);
  });
  const mixedColor = averageColorsHSL(colors);
  const allOfficial = names.every(name => legendPeopleMap?.[name]?.color);
  return { color: mixedColor, isOfficial: allOfficial, people: names };
}

export function autoColorForName(name) {
  const h = hashString(name);
  return AUTO_PALETTE[h % AUTO_PALETTE.length];
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

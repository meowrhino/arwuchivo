/**
 * Colores:
 * - Oficiales vienen de leyenda.json
 * - Auto: se eligen de una paleta, de forma determinista por nombre (hash).
 * - Nombres HTML/CSS se normalizan a hex para mezclar bien.
 */
export const HTML_COLOR_HEX = {
  lightcoral: "#f08080",
  salmon: "#fa8072",
  indianred: "#cd5c5c",
  red: "#ff0000",
  crimson: "#dc143c",
  firebrick: "#b22222",
  brown: "#a52a2a",
  darkred: "#8b0000",
  maroon: "#800000",

  papayawhip: "#ffefd5",
  blanchedalmond: "#ffebcd",
  bisque: "#ffe4c4",
  moccasin: "#ffe4b5",
  peachpuff: "#ffdab9",
  navajowhite: "#ffdead",
  lightsalmon: "#ffa07a",
  darksalmon: "#e9967a",
  orange: "#ffa500",
  darkorange: "#ff8c00",
  coral: "#ff7f50",
  tomato: "#ff6347",
  orangered: "#ff4500",

  wheat: "#f5deb3",
  burlywood: "#deb887",
  tan: "#d2b48c",
  sandybrown: "#f4a460",
  goldenrod: "#daa520",
  peru: "#cd853f",
  darkgoldenrod: "#b8860b",
  chocolate: "#d2691e",
  sienna: "#a0522d",
  saddlebrown: "#8b4513",

  lightyellow: "#ffffe0",
  cornsilk: "#fff8dc",
  lemonchiffon: "#fffacd",
  lightgoldenrodyellow: "#fafad2",
  palegoldenrod: "#eee8aa",
  khaki: "#f0e68c",
  yellow: "#ffff00",
  gold: "#ffd700",
  darkkhaki: "#bdb76b",
  olive: "#808000",

  greenyellow: "#adff2f",
  chartreuse: "#7fff00",
  lawngreen: "#7cfc00",
  yellowgreen: "#9acd32",
  olivedrab: "#6b8e23",
  darkolivegreen: "#556b2f",

  palegreen: "#98fb98",
  lightgreen: "#90ee90",
  mediumspringgreen: "#00fa9a",
  springgreen: "#00ff7f",
  lime: "#00ff00",
  darkseagreen: "#8fbc8f",
  limegreen: "#32cd32",
  mediumseagreen: "#3cb371",
  seagreen: "#2e8b57",
  forestgreen: "#228b22",
  green: "#008000",
  darkgreen: "#006400",

  lightcyan: "#e0ffff",
  paleturquoise: "#afeeee",
  aquamarine: "#7fffd4",
  aqua: "#00ffff",
  cyan: "#00ffff",
  aquacyan: "#00ffff",
  turquoise: "#40e0d0",
  mediumturquoise: "#48d1cc",
  darkturquoise: "#00ced1",
  mediumaquamarine: "#66cdaa",
  lightseagreen: "#20b2aa",
  cadetblue: "#5f9ea0",
  darkcyan: "#008b8b",
  teal: "#008080",

  lavender: "#e6e6fa",
  blueweb: "#cee7ff",
  powderblue: "#b0e0e6",
  lightblue: "#add8e6",
  lightskyblue: "#87cefa",
  skyblue: "#87ceeb",
  lightsteelblue: "#b0c4de",
  deepskyblue: "#00bfff",
  cornflowerblue: "#6495ed",
  dodgerblue: "#1e90ff",
  steelblue: "#4682b4",
  royalblue: "#4169e1",
  blue: "#0000ff",
  mediumblue: "#0000cd",
  darkblue: "#00008b",
  navy: "#000080",
  midnightblue: "#191970",
  darkslateblue: "#483d8b",

  thistle: "#d8bfd8",
  plum: "#dda0dd",
  violet: "#ee82ee",
  orchid: "#da70d6",
  fuchsia: "#ff00ff",
  magenta: "#ff00ff",
  fuchsiamagenta: "#ff00ff",
  mediumpurple: "#9370db",
  mediumorchid: "#ba55d3",
  mediumslateblue: "#7b68ee",
  slateblue: "#6a5acd",
  blueviolet: "#8a2be2",
  darkviolet: "#9400d3",
  darkorchid: "#9932cc",
  darkmagenta: "#8b008b",
  purple: "#800080",
  indigo: "#4b0082",

  mistyrose: "#ffe4e1",
  pink: "#ffc0cb",
  lightpink: "#ffb6c1",
  hotpink: "#ff69b4",
  rosybrown: "#bc8f8f",
  palevioletred: "#db7093",
  deeppink: "#ff1493",
  mediumvioletred: "#c71585",

  white: "#ffffff",
  whitesmoke: "#f5f5f5",
  snow: "#fffafa",
  seashell: "#fff5ee",
  linen: "#faf0e6",
  antiquewhite: "#faebd7",
  oldlace: "#fdf5e6",
  floralwhite: "#fffaf0",
  ivory: "#fffff0",
  beige: "#f5f5dc",
  honeydew: "#f0fff0",
  mintcream: "#f5fffa",
  azure: "#f0ffff",
  aliceblue: "#f0f8ff",
  ghostwhite: "#f8f8ff",
  lavenderblush: "#fff0f5",

  gainsboro: "#dcdcdc",
  lightgrey: "#d3d3d3",
  lightgray: "#d3d3d3",
  silver: "#c0c0c0",
  darkgray: "#a9a9a9",
  darkgrey: "#a9a9a9",
  lightslategray: "#778899",
  lightslategrey: "#778899",
  slategray: "#708090",
  slategrey: "#708090",
  gray: "#808080",
  grey: "#808080",
  dimgray: "#696969",
  dimgrey: "#696969",
  darkslategray: "#2f4f4f",
  darkslategrey: "#2f4f4f",
  black: "#000000"
};

export const AUTO_PALETTE = Object.values(HTML_COLOR_HEX);

const COLOR_CACHE = new Map();
let colorCtx = null;

/**
 * Resuelve el color para una o múltiples personas
 * @param {string|string[]} nameOrNames - Nombre(s) de persona(s)
 * @param {Object} legendPeopleMap - Mapa de personas oficiales
 * @returns {Object} { color, isOfficial, people }
 */
export function resolvePersonColor(nameOrNames, legendPeopleMap) {
  // Normalizar a array
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
  
  // Múltiples personas: mezclar colores
  const colors = names.map(name => {
    const official = legendPeopleMap?.[name]?.color;
    if (official) {
      return colorToHex(official) || official;
    }
    return autoColorForName(name);
  });
  
  const mixedColor = averageColorsHex(colors);
  const allOfficial = names.every(name => legendPeopleMap?.[name]?.color);
  
  return { color: mixedColor, isOfficial: allOfficial, people: names };
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
  const colors = hexColors.map(colorToHex).filter(Boolean);
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

export function colorToHex(color) {
  if (!color) return null;
  const raw = String(color).trim();
  if (!raw) return null;

  const cacheKey = raw.toLowerCase();
  if (COLOR_CACHE.has(cacheKey)) return COLOR_CACHE.get(cacheKey);

  let hex = normalizeHexColor(raw);
  if (!hex) {
    const key = normalizeColorKey(raw);
    hex = HTML_COLOR_HEX[key] || null;
  }
  if (!hex) hex = cssColorToHex(raw);

  COLOR_CACHE.set(cacheKey, hex);
  return hex;
}

function normalizeColorKey(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

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

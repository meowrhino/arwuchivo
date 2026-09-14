/**
 * colors.js
 * Facade — re-exporta de los submódulos en color/ para no romper imports
 * antiguos. Internamente, el código nuevo debería importar directamente del
 * submódulo correspondiente.
 */

export { HTML_COLOR_HEX, AUTO_PALETTE } from './color/palette.js';
export { colorToHex, hexToRgb, rgbToHex, hexToHSL, hslToHex } from './color/convert.js';
export { averageColorsHSL, averageColorsHex } from './color/blend.js';
export { hexToLab, labToHex, averageColorsLAB } from './color/lab.js';
export { resolvePersonColor, autoColorForName } from './color/resolve.js';
export { resolveFusionGradient, resolveFusionRadial } from './color/fusion.js';

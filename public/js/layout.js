/**
 * layout.js
 * Sistema de posicionamiento aleatorio para videos en canvas
 * Estilo minimal: videos flotantes sin grid
 */

/**
 * Genera posiciones aleatorias para videos sin solapamiento
 * @param {number} count - Número de videos
 * @param {Object} containerSize - { width, height } del canvas
 * @param {Object} videoSize - { width, height } del video (promedio)
 * @returns {Array} Array de posiciones { x, y, width, height }
 */
export function generateRandomLayout(count, containerSize, videoSize) {
  const padding = 8;

  // Escala según cantidad: pocos items → más grandes para ocupar presencia.
  const scale =
    count <= 2 ? 3.2 :
    count <= 4 ? 2.2 :
    count <= 6 ? 1.6 :
    count <= 9 ? 1.2 :
    1.0;

  const sizes = Array.from({ length: count }, () => ({
    width:  videoSize.width  * scale * (0.85 + Math.random() * 0.3),
    height: videoSize.height * scale * (0.85 + Math.random() * 0.3),
  }));

  // Tamaño base de la región: estimamos área necesaria para no apilarse.
  const totalArea = sizes.reduce((sum, s) => sum + s.width * s.height, 0);
  const targetArea = totalArea / 0.4;
  let layoutHeight = Math.max(
    containerSize.height,
    Math.ceil(targetArea / containerSize.width)
  );

  const useTight = count <= 6;
  let regionTop = useTight ? containerSize.height * 0.10 : 0;
  let regionBottom = useTight ? containerSize.height * 0.85 : layoutHeight;

  // Caps de seguridad por video
  for (const size of sizes) {
    if (size.width > containerSize.width * 0.95) {
      const ratio = size.height / size.width;
      size.width = containerSize.width * 0.95;
      size.height = size.width * ratio;
    }
  }

  const positions = [];

  // Intentamos colocar evitando solape. Si tras varias rondas no cabe, en vez
  // de plantar el video encima de otro, AMPLIAMOS la región hacia abajo y
  // reintentamos. Solo si tras crecimientos sigue sin haber hueco caemos al
  // fallback (caso extremo, prácticamente imposible).
  for (let i = 0; i < count; i++) {
    const size = sizes[i];
    let placed = false;

    let growIterations = 0;
    while (!placed && growIterations < 6) {
      const attempts = 40;
      for (let a = 0; a < attempts; a++) {
        const x = Math.random() * Math.max(0, containerSize.width - size.width);
        const yMin = regionTop;
        const yMax = Math.max(yMin + 1, regionBottom - size.height);
        const y = yMin + Math.random() * (yMax - yMin);
        const newRect = { x, y, width: size.width, height: size.height };
        const overlaps = positions.some(rect => rectanglesOverlap(rect, newRect, padding));
        if (!overlaps) {
          positions.push(newRect);
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Crecer la región y darle otra oportunidad
        regionBottom += containerSize.height * 0.5;
        layoutHeight = Math.max(layoutHeight, regionBottom);
        growIterations++;
      }
    }

    if (!placed) {
      // Fallback final: al fondo de la región, sin solape garantizado pero
      // empujado abajo para que al menos no se monte sobre los primeros.
      const lastBottom = positions.length
        ? Math.max(...positions.map(p => p.y + p.height))
        : regionTop;
      positions.push({
        x: Math.random() * Math.max(0, containerSize.width - size.width),
        y: lastBottom + padding,
        width: size.width,
        height: size.height,
      });
      regionBottom = Math.max(regionBottom, lastBottom + size.height + padding * 2);
    }
  }

  return positions;
}

/**
 * Verifica si dos rectángulos se solapan
 * @param {Object} rect1 - { x, y, width, height }
 * @param {Object} rect2 - { x, y, width, height }
 * @param {number} padding - Espacio mínimo entre rectángulos
 * @returns {boolean}
 */
function rectanglesOverlap(rect1, rect2, padding = 0) {
  return !(
    rect1.x + rect1.width + padding < rect2.x ||
    rect2.x + rect2.width + padding < rect1.x ||
    rect1.y + rect1.height + padding < rect2.y ||
    rect2.y + rect2.height + padding < rect1.y
  );
}

/**
 * Calcula el tamaño promedio de videos según orientación
 * @param {Array} items - Array de items con metadata de video
 * @param {Object} containerSize - { width, height } del canvas
 * @returns {Object} { width, height }
 */
export function calculateAverageVideoSize(items, containerSize) {
  // Tamaños base según orientación
  const mobileWidth = containerSize.width;
  
  // Videos pequeños: máximo 10% del ancho del canvas
  // Tanto vertical como horizontal
  const maxWidth = mobileWidth * 0.10;
  const verticalWidth = maxWidth;
  const horizontalWidth = maxWidth;
  
  // Aspect ratios comunes
  const verticalAspect = 9 / 16; // Vertical (ej: 1080x1920)
  const horizontalAspect = 16 / 9; // Horizontal (ej: 1920x1080)
  
  // Si no hay items, usar tamaño promedio
  if (items.length === 0) {
    return {
      width: (verticalWidth + horizontalWidth) / 2,
      height: ((verticalWidth / verticalAspect) + (horizontalWidth / horizontalAspect)) / 2
    };
  }
  
  // Por ahora, usar tamaño promedio
  // TODO: Detectar orientación real de cada video
  return {
    width: (verticalWidth + horizontalWidth) / 2,
    height: ((verticalWidth / verticalAspect) + (horizontalWidth / horizontalAspect)) / 2
  };
}

/**
 * Calcula la altura del canvas. Si los videos caben en el viewport,
 * devuelve la altura del viewport. Si no, crece para acomodarlos.
 */
export function calculateCanvasHeight(positions, viewportHeight) {
  if (!positions || positions.length === 0) return viewportHeight;
  const maxBottom = Math.max(...positions.map(p => p.y + p.height));
  return Math.max(viewportHeight, Math.ceil(maxBottom) + 16);
}

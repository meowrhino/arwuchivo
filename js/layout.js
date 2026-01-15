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
  const positions = [];
  const padding = 16; // Espacio mínimo entre videos
  const maxAttempts = 100; // Intentos máximos para colocar cada video

  // Tamaños aleatorios para cada video (variación ±20%)
  const sizes = Array.from({ length: count }, () => ({
    width: videoSize.width * (0.8 + Math.random() * 0.4),
    height: videoSize.height * (0.8 + Math.random() * 0.4)
  }));

  for (let i = 0; i < count; i++) {
    const size = sizes[i];
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < maxAttempts) {
      attempts++;

      // Posición aleatoria dentro del canvas
      const x = Math.random() * (containerSize.width - size.width);
      const y = Math.random() * (containerSize.height - size.height);

      const newRect = {
        x,
        y,
        width: size.width,
        height: size.height
      };

      // Verificar que no se solape con videos ya colocados
      const overlaps = positions.some(rect => 
        rectanglesOverlap(rect, newRect, padding)
      );

      if (!overlaps) {
        positions.push(newRect);
        placed = true;
      }
    }

    // Si no se pudo colocar, forzar posición (mejor solapado que invisible)
    if (!placed) {
      positions.push({
        x: Math.random() * (containerSize.width - size.width),
        y: Math.random() * (containerSize.height - size.height),
        width: size.width,
        height: size.height
      });
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
  
  // Vertical: 40% del ancho del canvas
  // Horizontal: 60% del ancho del canvas
  const verticalWidth = mobileWidth * 0.4;
  const horizontalWidth = mobileWidth * 0.6;
  
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
 * Calcula la altura mínima del canvas para contener todos los videos
 * @param {Array} positions - Array de posiciones { x, y, width, height }
 * @param {number} minHeight - Altura mínima del canvas
 * @returns {number}
 */
export function calculateCanvasHeight(positions, minHeight) {
  if (positions.length === 0) return minHeight;
  
  const maxY = Math.max(...positions.map(p => p.y + p.height));
  return Math.max(maxY + 100, minHeight); // +100px de padding inferior
}

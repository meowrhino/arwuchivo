/**
 * Grid que llena el área:
 *
 * Queremos distribuir N cards en un rectángulo de (width x height).
 * La intuición: si el rectángulo es más ancho, ponemos más columnas; si es más alto, más filas.
 *
 * Esto es literalmente una “regla de 3” de proporciones:
 *   cols / rows  ≈  width / height
 *
 * Y además:
 *   cols * rows >= N
 *
 * Implementación (legible y sin hardcode):
 * 1) Calculamos el ratio = width/height.
 * 2) Sacamos una primera estimación de columnas:
 *      cols ≈ sqrt(N * ratio)
 *    (si ratio > 1, esto sube cols; si ratio < 1, baja cols)
 * 3) Con cols, derivamos rows = ceil(N / cols).
 *
 * No es matemática “perfecta”, pero es estable, simple y se entiende.
 */
export function computeGrid(count, width, height) {
  if (!count) return { cols: 1, rows: 1 };

  const ratio = width / height;

  // “Lado grande manda”: ratio>1 => más columnas; ratio<1 => menos columnas.
  let cols = Math.ceil(Math.sqrt(count * ratio));
  cols = Math.max(1, cols);

  let rows = Math.ceil(count / cols);
  rows = Math.max(1, rows);

  return { cols, rows };
}

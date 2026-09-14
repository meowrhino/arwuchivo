/**
 * upload/auth.js
 * Con el gate de sesión del Worker ya no hay password por separado para
 * escribir: si esta página se está ejecutando es que hay cookie válida, y la
 * cookie viaja sola en cada fetch del mismo origen.
 *
 * Lo único que queda por resolver aquí es qué hacer cuando la sesión caduca
 * a mitad de camino: el Worker responde 401 y volvemos al login.
 */

export function handleUnauthorized() {
  window.location.href = '/login';
}

/** true siempre que la app esté cargada; útil para mostrar controles de edición. */
export function isAuthed() {
  return true;
}

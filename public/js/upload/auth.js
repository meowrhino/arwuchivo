/**
 * upload/auth.js
 * Auth token (UPLOAD_PASSWORD) persistido en localStorage. Si no existe,
 * se pide vía modal limpio (no `prompt()` nativo). Si el Worker devuelve 401,
 * lo borramos y volvemos a pedir.
 */

export const AUTH_STORAGE_KEY = 'arwuchivo_auth_token';

export function ensureAuthToken() {
  const existing = localStorage.getItem(AUTH_STORAGE_KEY);
  if (existing) return Promise.resolve(existing);
  return promptAuthToken();
}

export function promptAuthToken(errorMsg = null) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('authOverlay');
    const input = document.getElementById('authInput');
    const submit = document.getElementById('authSubmit');
    const cancel = document.getElementById('authCancel');
    const closeBtn = document.getElementById('authOverlayClose');
    const errorEl = document.getElementById('authError');
    if (!overlay || !input || !submit) {
      resolve(null);
      return;
    }

    input.value = '';
    errorEl.hidden = !errorMsg;
    if (errorMsg) errorEl.textContent = errorMsg;
    overlay.hidden = false;
    setTimeout(() => input.focus(), 50);

    const cleanup = (val) => {
      overlay.hidden = true;
      submit.onclick = null;
      cancel.onclick = null;
      closeBtn.onclick = null;
      input.onkeydown = null;
      resolve(val);
    };

    submit.onclick = () => {
      const val = input.value.trim();
      if (!val) return;
      localStorage.setItem(AUTH_STORAGE_KEY, val);
      cleanup(val);
    };
    cancel.onclick = () => cleanup(null);
    closeBtn.onclick = () => cleanup(null);
    input.onkeydown = (e) => { if (e.key === 'Enter') submit.click(); };
  });
}

export function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

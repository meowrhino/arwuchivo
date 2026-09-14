/** Helpers compartidos en las vistas. */

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export async function sha256hex(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function withAccessHash(url, hash) {
  if (!hash) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}p=${hash}`;
}

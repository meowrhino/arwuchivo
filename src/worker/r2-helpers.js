/**
 * r2-helpers.js
 * Operaciones sobre R2: actualización atómica de JSONs con etag y reintentos.
 */

export async function updateJsonAtomic(bucket, key, updater, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const existing = await bucket.get(key);
    const data = existing ? await existing.json() : null;
    const updated = updater(data);

    const opts = {
      httpMetadata: { contentType: 'application/json' },
    };
    if (existing) {
      opts.onlyIf = { etagMatches: existing.etag };
    } else {
      opts.onlyIf = { etagDoesNotMatch: '*' };
    }

    const result = await bucket.put(key, JSON.stringify(updated, null, 2), opts);
    if (result !== null) return updated;

    // Conditional write falló: backoff y reintentar
    await new Promise(r => setTimeout(r, 50 + Math.floor(Math.random() * 150)));
  }
  throw new Error(`updateJsonAtomic: ${maxRetries} reintentos agotados para ${key}`);
}

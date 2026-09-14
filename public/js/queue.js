/**
 * queue.js
 * Cola de subidas offline en IndexedDB.
 *
 * Si una subida falla por red, se guarda aquí (los File/Blob se clonan bien
 * a IndexedDB) y se reintenta al recuperar conexión o al abrir la app.
 */

const DB_NAME = 'arwuchivo';
const DB_VERSION = 1;
const STORE = 'pendingUploads';
const MAX_ATTEMPTS = 5;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const result = fn(store);
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
  });
}

export async function addPendingUpload(formData) {
  const db = await openDB();
  return tx(db, 'readwrite', (store) =>
    store.add({
      ...formData,
      attempts: 0,
      createdAt: Date.now(),
    })
  );
}

export async function getPendingUploads() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function countPendingUploads() {
  const pending = await getPendingUploads().catch(() => []);
  return pending.length;
}

async function removePendingUpload(id) {
  const db = await openDB();
  return tx(db, 'readwrite', (store) => store.delete(id));
}

async function bumpAttempts(record) {
  const db = await openDB();
  return tx(db, 'readwrite', (store) =>
    store.put({ ...record, attempts: (record.attempts || 0) + 1 })
  );
}

/**
 * Intenta subir todo lo pendiente. Devuelve cuántas subidas completó.
 * - Error de red → paramos (seguimos offline), se reintenta más tarde.
 * - Error del servidor → contamos el intento y seguimos; tras MAX_ATTEMPTS
 *   se descarta para no bloquear la cola.
 */
export async function flushPendingUploads(uploadFn) {
  let pending;
  try {
    pending = await getPendingUploads();
  } catch (_) {
    return 0;
  }

  let uploaded = 0;
  for (const record of pending) {
    const { id, attempts, createdAt, ...formData } = record;
    try {
      await uploadFn(formData);
      await removePendingUpload(id);
      uploaded++;
    } catch (err) {
      if (err?.message === 'error de red' || !navigator.onLine) break;
      if ((attempts || 0) + 1 >= MAX_ATTEMPTS) {
        console.warn('descartando subida pendiente tras varios intentos:', err?.message);
        await removePendingUpload(id);
      } else {
        await bumpAttempts(record);
      }
    }
  }
  return uploaded;
}

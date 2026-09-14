/**
 * compressor.js
 * Carga + uso de FFmpeg WASM para comprimir video a 720p VP8 y generar miniaturas.
 * Sin acoplamiento a DOM: la UI recibe progreso vía callback `onStatus(phase, info)`.
 */

// Preset único: 720p VP8 con CRF 10 y cap a 2000 kbps. Para 2 min → ~28 MB.
const PRESET_720 = {
  label: '720p',
  maxWidth: 1280, maxHeight: 720,
  crf: 10,
  videoBitrate: '2000k',
  audioBitrate: '128k',
  cpuUsed: 4,
  fps: null,
};

const WORKERFS_THRESHOLD = 200 * 1024 * 1024;
const CORE_MT_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.9/dist/umd';

// Estado interno
let ffmpeg = null;
let ffmpegLoaded = false;
let ffmpegLoading = false;
let wakeLock = null;

// ─── Capabilities ─────────────────────────────────────────────

export function detectCapabilities() {
  const hasWASM = typeof WebAssembly !== 'undefined';
  const hasSAB = typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated;
  const cores = navigator.hardwareConcurrency || 1;
  const lowEnd = cores <= 2;

  if (!hasWASM) {
    return {
      mode: 'no-wasm',
      message: 'tu navegador no soporta compresión. el video se subirá sin comprimir (debe pesar ≤ 95 MB).',
      canCompress: false,
    };
  }
  if (!hasSAB) {
    return {
      mode: 'no-sab',
      message: 'recarga la página una vez para activar el compresor. si no, se intentará subir sin comprimir (≤ 95 MB).',
      canCompress: false,
    };
  }
  if (lowEnd) {
    return {
      mode: 'medium',
      message: 'dispositivo con pocos cores, la compresión puede tardar varios minutos. mantén la pantalla activa.',
      canCompress: true,
    };
  }
  return { mode: 'fast', message: null, canCompress: true };
}

// ─── Wake lock ────────────────────────────────────────────────

export async function acquireWakeLock() {
  if (wakeLock || !navigator.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (_) { wakeLock = null; }
}

export function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

// ─── FFmpeg load (con progreso) ───────────────────────────────

async function toBlobURL(url, mimeType, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);

  if (!onProgress || !response.body) {
    const buffer = await response.arrayBuffer();
    return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  }

  const total = parseInt(response.headers.get('Content-Length') || '0', 10);
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onProgress(received / total, received, total);
  }
  return URL.createObjectURL(new Blob(chunks, { type: mimeType }));
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout en ${label} (${ms / 1000}s)`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

/**
 * Carga FFmpeg WASM. Llama onStatus con:
 *   ('downloading', { label, percent })
 *   ('initializing', { label, indeterminate: true })
 *   ('error', { message })
 */
export async function loadFFmpeg(onStatus) {
  if (ffmpegLoaded || ffmpegLoading) return;
  ffmpegLoading = true;

  if (typeof SharedArrayBuffer === 'undefined' || !self.crossOriginIsolated) {
    ffmpegLoading = false;
    onStatus?.('error', {
      message: 'recarga la página para activar el compresor. si persiste, usa "sin comprimir".'
    });
    return;
  }

  const W_JS = 150 * 1024;
  const W_WASM = 32 * 1024 * 1024;
  const W_WORKER = 30 * 1024;
  const TOTAL = W_JS + W_WASM + W_WORKER;
  let received = 0;

  const showProgress = (label, currentBytes = received) => {
    const pct = Math.min(99, Math.round((currentBytes / TOTAL) * 100));
    onStatus?.('downloading', { label, percent: pct });
  };

  try {
    showProgress('descargando compresor (1/3)');

    const { FFmpeg } = FFmpegWASM;
    ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => console.log('[ffmpeg]', message));

    const coreURL = await toBlobURL(
      `${CORE_MT_BASE}/ffmpeg-core.js`, 'text/javascript',
      (_p, got) => showProgress('descargando compresor (1/3)', received + got)
    );
    received += W_JS;

    const wasmURL = await toBlobURL(
      `${CORE_MT_BASE}/ffmpeg-core.wasm`, 'application/wasm',
      (_p, got, total) => {
        const mb = (got / 1024 / 1024).toFixed(1);
        const totalMb = (total / 1024 / 1024).toFixed(0);
        showProgress(`descargando compresor (2/3) · ${mb}/${totalMb} MB`, received + got);
      }
    );
    received += W_WASM;

    const workerURL = await toBlobURL(
      `${CORE_MT_BASE}/ffmpeg-core.worker.js`, 'text/javascript',
      (_p, got) => showProgress('descargando compresor (3/3)', received + got)
    );
    received += W_WORKER;

    // ffmpeg.load() no expone progreso; usamos barra indeterminada con timer
    const initStart = Date.now();
    const initInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - initStart) / 1000);
      onStatus?.('initializing', {
        label: `inicializando compresor · ${elapsed}s`,
        indeterminate: true,
      });
    }, 250);

    try {
      await withTimeout(
        ffmpeg.load({ coreURL, wasmURL, workerURL }),
        180000,
        'inicialización'
      );
    } finally {
      clearInterval(initInterval);
    }
    ffmpegLoaded = true;
  } catch (err) {
    console.error('Error loading FFmpeg:', err);
    onStatus?.('error', {
      message: `no se pudo cargar el compresor (${err.message}). prueba "sin comprimir" o recarga la página.`
    });
    ffmpeg = null;
  } finally {
    ffmpegLoading = false;
  }
}

// ─── Compression ──────────────────────────────────────────────

/**
 * Comprime el video. Llama onStatus con:
 *   ('compressing', { label, percent })
 *   ('error', { message })
 * Retorna Blob o null si falló.
 */
export async function compressVideo(file, meta, onStatus) {
  if (!ffmpegLoaded) {
    await loadFFmpeg(onStatus);
    if (!ffmpegLoaded) return null;
  }

  const preset = PRESET_720;
  onStatus?.('compressing', { label: `${preset.label} · ${preset.videoBitrate}`, percent: 0 });

  try {
    const ext = file.name.split('.').pop().toLowerCase();
    const inputName = `input.${ext}`;
    const outputName = 'output.webm';
    let usedWorkerFS = false;
    const mountPoint = '/mounted';

    if (file.size >= WORKERFS_THRESHOLD) {
      try { await ffmpeg.unmount(mountPoint); } catch (_) {}
      try { await ffmpeg.createDir(mountPoint); } catch (_) {}
      await ffmpeg.mount('WORKERFS', { files: [file] }, mountPoint);
      usedWorkerFS = true;
    } else {
      const buf = await file.arrayBuffer();
      await ffmpeg.writeFile(inputName, new Uint8Array(buf));
    }

    const actualInput = usedWorkerFS ? `${mountPoint}/${file.name}` : inputName;

    let scaleFilter = null;
    if (meta.width > preset.maxWidth || meta.height > preset.maxHeight) {
      const ar = meta.width / meta.height;
      let nw, nh;
      if (ar > (preset.maxWidth / preset.maxHeight)) {
        nw = preset.maxWidth;
        nh = Math.round(preset.maxWidth / ar);
        nh = nh % 2 === 0 ? nh : nh - 1;
      } else {
        nh = preset.maxHeight;
        nw = Math.round(preset.maxHeight * ar);
        nw = nw % 2 === 0 ? nw : nw - 1;
      }
      scaleFilter = `scale=${nw}:${nh}`;
    }

    const args = [
      '-i', actualInput,
      '-c:v', 'libvpx',
      '-crf', String(preset.crf),
      '-b:v', preset.videoBitrate,
      '-cpu-used', String(preset.cpuUsed),
      '-lag-in-frames', '16',
      '-auto-alt-ref', '1',
      '-c:a', 'libvorbis',
      '-b:a', preset.audioBitrate,
      '-threads', '2',
    ];
    if (scaleFilter) args.push('-vf', scaleFilter);
    if (preset.fps) args.push('-r', String(preset.fps));
    args.push(outputName);

    const progressHandler = ({ progress }) => {
      const pct = Math.min(Math.round(progress * 100), 99);
      onStatus?.('compressing', { label: `${preset.label} · ${preset.videoBitrate}`, percent: pct });
    };
    ffmpeg.on('progress', progressHandler);

    const exitCode = await ffmpeg.exec(args);
    ffmpeg.off('progress', progressHandler);

    if (exitCode !== 0) throw new Error(`ffmpeg exit code ${exitCode}`);

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: 'video/webm' });

    try {
      if (usedWorkerFS) await ffmpeg.unmount(mountPoint);
      else await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (_) {}

    return blob;
  } catch (err) {
    console.error('Compression error:', err);
    onStatus?.('error', { message: 'error al comprimir. prueba con un video más corto.' });
    return null;
  }
}

// ─── Thumbnail (FFmpeg) ───────────────────────────────────────

export async function generateThumbnail(file, meta) {
  if (!ffmpegLoaded) return null;

  const ext = file.name.split('.').pop().toLowerCase();
  const inputName = `thumb_input.${ext}`;
  const outputName = 'thumb.jpg';

  try {
    const buf = await file.arrayBuffer();
    await ffmpeg.writeFile(inputName, new Uint8Array(buf));

    const seekTime = meta.duration > 2 ? '00:00:01' : '00:00:00';
    const targetW = 480;
    const ar = meta.width && meta.height ? meta.width / meta.height : 16 / 9;
    let nw = targetW;
    let nh = Math.round(targetW / ar);
    nh = nh % 2 === 0 ? nh : nh - 1;

    const args = [
      '-ss', seekTime,
      '-i', inputName,
      '-vframes', '1',
      '-vf', `scale=${nw}:${nh}`,
      '-q:v', '3',
      outputName,
    ];

    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) return null;

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: 'image/jpeg' });

    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (_) {}

    return blob;
  } catch (err) {
    console.error('Thumbnail error:', err);
    return null;
  }
}

// ─── Thumbnail nativo (canvas) — fallback sin FFmpeg ──────────

export function generateThumbnailNative(file, meta) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
    };

    const onSeeked = () => {
      try {
        const targetW = 480;
        const ar = video.videoWidth / video.videoHeight;
        const w = targetW;
        const h = Math.round(targetW / ar);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            cleanup();
            blob ? resolve(blob) : reject(new Error('toBlob failed'));
          },
          'image/jpeg',
          0.78
        );
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    video.addEventListener('loadedmetadata', () => {
      const t = meta.duration > 2 ? 1 : 0;
      video.currentTime = t;
    }, { once: true });
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', () => { cleanup(); reject(new Error('video load failed')); }, { once: true });
  });
}

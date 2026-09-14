# TODO (arwuchivo)

## Hecho recientemente (v6.1 — 2026-05-18)
- [x] Backend Cloudflare Worker + R2 desplegado en https://arwuchivo.manuellatourf.workers.dev
- [x] Auth en `/api/upload` con secret `UPLOAD_PASSWORD` (persistido en localStorage del cliente)
- [x] Notas opcionales por video (campo `notes` en el schema, textarea en upload, render en overlay fullscreen)
- [x] Thumbnails JPEG generados con FFmpeg WASM en cliente (poster del video, lazy-load real)
- [x] Backfill de thumbnails para los 2 videos existentes
- [x] Timeline de días activado debajo del header (dots con fusión Steven Universe)
- [x] Vista de día individual vía `?d=YY-MM-DD` (click en dot del timeline)
- [x] Canvas scrollable cuando hay muchos videos (deja de truncar)
- [x] `.gitignore` añadido (.wrangler, node_modules, settings.local)

## Vídeos (conversión a WebM)
- [x] Compresión FFmpeg WASM en cliente (VP8 + Vorbis, 3 presets: 1080p/720p/480p)
- [ ] Decidir si pasar a VP9 (mejor compresión, requiere build WASM con libvpx-vp9)

## Fechas / años 2 dígitos (opción B)
- [x] Documentar la colisión de siglos: 2002 y 2102 comparten YY=02 por diseño.
- [ ] (Opcional) Marcar "siglo" por color o sufijo si un día hiciera falta.

## Mejoras futuras
- [ ] Endpoint de borrado/edición de videos (hoy solo upload).
- [ ] Detección de orientación real en `layout.js` (hoy asume promedio).
- [ ] Pie charts en dots del timeline (segmentos por persona en vez de conic uniforme).
- [ ] Rate-limiting en `/api/upload` si el password se filtra.

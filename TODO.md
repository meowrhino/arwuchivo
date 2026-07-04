# TODO (arwuchivo)

## Hecho
- [x] Subida real con Worker + R2, gate de sesión (cookie HMAC), borrado.
- [x] Compresión en cliente (ffmpeg.wasm, 720p/2000k) + thumbnail.
- [x] PWA: manifest + iconos, service worker (shell offline, data network-first,
      core de ffmpeg cacheado), cola de subidas offline en IndexedDB.
- [x] COOP/COEP servidos por el Worker (adiós coi-serviceworker y su reload).
- [x] Dark mode (prefers-color-scheme), leyenda clicable (filtro por persona),
      aparición escalonada, preview al hover/scroll, botón grabar desde cámara.

## Pendiente / ideas
- [ ] Navegación dentro del overlay de video (flechas/swipe al siguiente del día).
- [ ] Puntos del día con segmentos (pie) por persona en vez de promedio RGB.
- [ ] Swipe horizontal entre meses en móvil.
- [ ] Sacar del repo `prompt/`, `videos/`, `thumbs/` y `data/` locales
      (todo vive ya en R2; el repo solo necesita `public/` y `src/`).
- [ ] (Opcional) Secreto `SESSION_SECRET` separado de `UPLOAD_PASSWORD`.

## Notas
- Años a 2 dígitos: colisión 2002 vs 2102 por diseño ("juego").
- Dev local: `.dev.vars` con `UPLOAD_PASSWORD` + `npx wrangler dev` (config
  "arwuchivo-local", puerto 8788). Seed del R2 local con
  `npx wrangler r2 object put arwuchivo-storage/<key> --file=<f> --local`.

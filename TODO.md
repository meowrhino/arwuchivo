# TODO (arwuchivo)

## Vídeos (conversión a WebM)
- [x] Revisar `videoToWeb` (zip interno): ahora mismo convierte a **WebM VP8 (`libvpx`) + Opus (`libopus`)** con modo CRF (CQ) y bitrate de vídeo a `0`.
  - Rango CRF en el código: `CRF_MIN: 24`, `CRF_MAX: 38`, `DEFAULT_CRF: 30`.
  - `deadline: good`, `auto-alt-ref: 1`.
- [ ] Decidir si os quedáis con VP8 (más compatible) o queréis VP9 (mejor compresión).
  - Si queréis VP9, habría que ver si el build WASM incluye `libvpx-vp9` (no lo vi en el script actual).
- [ ] Definir preset “oficial” para vuestros entrenos:
  - CRF (p.ej. 30–36 para ahorrar)
  - resolución objetivo (p.ej. 720p si queréis que pese poco)
  - fps (p.ej. 30fps si queréis consistencia)
- [ ] Generar `thumb` (jpg/png) opcional por vídeo para que la grid vaya fluida en móvil.
- [ ] Decidir convención de paths:
  - `videos/YY/MM/DD/persona_slug__NN.webm`
  - `thumbs/YY/MM/DD/persona_slug__NN.jpg`

## Fechas / años 2 dígitos (opción B)
- [x] Documentar la colisión de siglos: 2002 y 2102 comparten YY=02 por diseño (“juego”).
- [ ] (Opcional) Marcar “siglo” por color o sufijo si un día hiciera falta (20XX vs 21XX).

## UX / mejoras futuras
- [ ] Puntos del día con segmentos (pie) en vez de promedio RGB.
- [ ] Subida real (backend) — en esta iteración NO.

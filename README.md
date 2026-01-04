# arwuchivo

Archivo web estático para vídeos de kung fu con 2 vistas:
- Vista mes: muestra todos los vídeos del mes.
- Vista día: muestra solo los vídeos de un día.

Incluye un mini editor (formateador) para generar/actualizar JSONs desde Live Server.

## Cómo correr
1) Abre la carpeta con VSCode
2) Live Server sobre `index.html`
3) Para el editor: Live Server sobre `formateador/index.html`

## Rutas (query params)
- Mes: `index.html?m=25-02`
- Día: `index.html?d=25-02-14`

> Nota: usamos años a 2 dígitos (opción “B” del prompt). Hay colisión 2002 vs 2102 por diseño: es un juego.

# Formateador — arwuchivo

## Qué hace
- Cargar (opcional) `index.json` / `leyenda.json` / un day-file
- Añadir persona (con color oficial) a `leyenda.json`
- Añadir vídeo (item) a un día:
  - actualiza el day-file del día
  - actualiza `index.json` (people únicos + count)
- Descargar los JSONs actualizados

## Por qué descarga y no “guarda”
En navegador, escribir sobre el sistema de archivos no es universal.
Descargar + reemplazar archivos en el repo funciona perfecto con Live Server.


## Personas auto (sin leyenda)
Si eliges “Escribir nombre (auto)…”, el nombre NO se añade a `leyenda.json`.
En la web, esa persona recibirá un color automático determinista.

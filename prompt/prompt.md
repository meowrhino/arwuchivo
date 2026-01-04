# Prompt final — arwuchivo (web + formateador)

Quiero que generes un proyecto llamado **arwuchivo**: una web estática (solo HTML, CSS y JS vainilla) para archivar vídeos de entreno de kung fu.

---

## 0) Filosofía (importante)
- Años con **2 dígitos** (`YY`) por diseño (opción B).  
  - `2002` y `2102` colisionan y se consideran “el mismo año” a nivel de índice.  
  - Esto **no es un bug**, es parte del juego. Documenta esto con un comentario natural en el código.
- Nada de frameworks.
- Todo se sirve desde Live Server en VSCode.

---

## 1) Arquitectura de datos (escalable y simple)

### 1.1 `data/index.json` (índice liviano)
Contiene lista de días disponibles + metadatos mínimos para:
- pintar la timeline del mes sin cargar todos los días
- saber qué gente aparece en cada día (para colorear el punto del día)

Ejemplo:

```json
{
  "version": 1,
  "days": [
    { "d": "25-02-14", "people": ["Manu","Berta"], "count": 3 }
  ]
}
```

Reglas:
- `d` en `YY-MM-DD`
- `people` son nombres únicos (sin repetidos)
- `count` número de items de ese día

### 1.2 `data/days/YY-MM-DD.json` (detalle de un día)
Ejemplo:

```json
{
  "d": "25-02-14",
  "items": [
    {
      "id": "25-02-14-manu-01",
      "title": "Bloqueo + contra",
      "person": "Manu",
      "src": "videos/25/02/14/manu__01.webm",
      "thumb": "thumbs/25/02/14/manu__01.jpg",
      "password": "tiger"
    }
  ]
}
```

Reglas:
- `src` preferiblemente `.webm`
- `thumb` opcional (si falta, usar `<video preload="metadata">` como miniatura)
- `password` opcional (esto es “juego”, hackeable)

### 1.3 `data/leyenda.json` (colores oficiales)
```json
{ "people": { "Manu": { "color": "#32CD32" } } }
```

Si una persona NO aparece aquí: se le asigna un color automático (determinista por nombre) desde una paleta.

### 1.4 `data/notaDeCurt.json`
```json
{ "nota_de_curt": 35, "text": "Texto..." }
```

---

## 2) Rutas (query params) / Vistas

- Vista MES: `index.html?m=25-02`
- Vista DÍA: `index.html?d=25-02-14`
- Si no hay query params, abrir el mes actual (tomando el `YY` local del dispositivo).

> El selector de mes puede usar `<input type="month">` (que devuelve `YYYY-MM`).  
> Convierte a `YY-MM` tomando las dos últimas cifras del año.

---

## 3) UI (super sencilla) — layout por alturas

- **Header**: 5dvh, centrado, muestra la fecha (click abre selector de mes)
- **Grid/List**: 85dvh, ocupa el resto del fondo
- **Bottom bar**: 10dvh
  - 80% de esa barra (8dvh) = timeline
  - 20% (2dvh) = leyenda

### 3.1 Header
- Vista mes: “{MES} ’{YY}”
- Vista día: “{DD} {MES} ’{YY}”
- Click => selector de mes => navega a `?m=YY-MM`

### 3.2 Grid (cards)
- Vista mes: todos los items de todos los días del mes.
- Vista día: solo items del día.
- Card:
  - miniatura (img si `thumb`, si no video)
  - borde con color de la persona
  - debajo: título + fecha
- La grid debe “llenar” el área disponible.
- Cálculo de columnas/filas:
  - Mira si el contenedor es más ancho que alto.
  - Usa el lado mayor para decidir divisiones.
  - Hazlo con una lógica transparente tipo “regla de 3” en comentarios (no hardcode).
  - Objetivo: `cols/rows` se aproxime a `width/height` y que `cols*rows >= items`.

### 3.3 Timeline (abajo)
- SIEMPRE visible, aunque no haya contenido.
- Muestra los **días del mes** como puntos (28–31).
- Días sin contenido:
  - punto gris / outline
  - no clickable
- Días con contenido:
  - clickable (abre vista día)
  - color del punto:
    - si ese día hay 1 persona => su color
    - si hay 2+ personas => **promedio RGB** (equilibrado por personas, no por nº de vídeos)
    - Mostrar el cálculo en el código de forma legible (regla de 3: cada persona aporta 100/n%)

### 3.4 Leyenda (abajo, 20% de la bottom bar)
- Solo si hay items visibles (mes o día).
- Solo muestra personas presentes en los items visibles.
- Dos bloques separados por un pequeño gap:
  - A) oficiales (en `leyenda.json`)
  - B) auto-asignadas (no estaban en `leyenda.json`)
- Cada entry: chip con punto de color + nombre

### 3.5 Nota de Curt
- Bloque con padding en la UI (puede ir encima del grid o entre grid y bottom bar).
- Estilo claro/oscuro según umbral (p.ej. 50).

---

## 4) Password UX (no prompt())
- Si un item tiene `password`, al clicar:
  - abre un modal pequeño con input y botón
  - si OK => abre overlay de vídeo grande
  - si mal => mensaje “Contraseña equivocada, intenta de nuevo”
- Hackeable: deja el password visible en el DOM (por ejemplo en `data-password` o un span oculto con clase `password`).

---

## 5) Formateador (editor mínimo)
Crear una interfaz aparte: `formateador/index.html`.

Objetivo: desde Live Server, poder generar/actualizar:
- `data/leyenda.json` (añadir personas + color)
- `data/index.json` (añadir días y metadatos)
- `data/days/YY-MM-DD.json` (añadir items/vídeos)

Restricción: el navegador no debería “escribir” en disco directamente (salvo que uses File System Access API, opcional).  
Solución: el formateador carga JSONs con `<input type="file">` y permite **descargar** los JSONs actualizados.

Flujo:
1) Cargar (opcional) `index.json` y `leyenda.json`
2) Añadir persona: nombre + hex color => actualiza leyenda
3) Añadir vídeo:
   - fecha `YY-MM-DD`
   - persona (dropdown)
   - título
   - src (.webm)
   - thumb opcional
   - password opcional
   => actualiza el day-file de ese día y actualiza el index (people únicos + count)
4) Botones: “Descargar index.json”, “Descargar leyenda.json”, “Descargar día (YY-MM-DD).json”

---

## 6) Archivos esperados
- `index.html`, `style.css`
- `js/app.js`, `js/data.js`, `js/timeline.js`, `js/colors.js`, `js/ui.js`, `js/grid.js`
- `data/index.json`, `data/leyenda.json`, `data/notaDeCurt.json`, `data/days/*.json`
- `formateador/index.html`, `formateador/style.css`, `formateador/formateador.js`

---

## 7) Vídeos: WebM
- Asumimos que convertiremos vídeos a `.webm` con una herramienta local tipo “videoToWeb”.
- Si no hay thumb, usar `preload="metadata"` y `muted playsinline` para no matar el móvil.


> Nota de implementación: la barra inferior puede repartirse como flex 8/2 (timeline/leyenda) para que sea 80/20 sin cálculos raros.

# Proceso de Rediseño Minimal - arwuchivo

**Fecha:** 04 de enero de 2026  
**Versión:** 4.0 - Minimal Mobile First

---

## 🎯 Objetivo del Rediseño

Transformar arwuchivo de una interfaz tipo "galería con grid" a un **canvas minimal mobile first** donde los videos flotan libremente en posiciones aleatorias, con una interfaz de subida y gestión de personas.

---

## 📋 Requisitos del Usuario

### Estética Minimal

1. **Canvas completo:** Toda la página es el espacio de trabajo
2. **Videos flotantes:** Posiciones aleatorias, no grid
3. **Sin colores dominantes:** Solo indicadores sutiles
4. **Sin bordes gruesos:** Todo menos redondeado (border-radius mínimo)
5. **Mobile first:** Diseño pensado primero para móvil con `dvh`

### Interfaz

1. **Header:** Mes/año centrado arriba → abre menú
2. **Menú por estaciones:** Organizado por año > estación (no meses individuales)
3. **Leyenda:** Pequeñita abajo derecha
4. **Botón de subida:** Flotante abajo izquierda (+)

### Funcionalidades Nuevas

1. **Soporte multi-persona:** Campo `person` como array
2. **Mezcla de colores:** Promedio equitativo (2 personas = 50/50, 3 = 33/33/33)
3. **Interfaz de subida:** Formulario completo con gestión de personas
4. **Nueva persona:** Modal para crear persona con color personalizado

### Videos

1. **Mostrar directamente:** Videos visibles en canvas (no thumbnails)
2. **Orientación natural:** Horizontal si es horizontal, vertical si es vertical
3. **Click → Fullscreen:** Expandir a pantalla completa
4. **Indicador de color:** Línea sutil en la parte inferior del video

---

## 🔄 Proceso de Implementación

### Fase 1: Actualizar Sistema de Colores ✅

**Archivo:** `js/colors.js`

**Cambios:**
- Actualizar `resolvePersonColor()` para aceptar `string | string[]`
- Si es array de 1 elemento → color individual
- Si es array de múltiples elementos → mezclar colores con `averageColorsHex()`
- Retornar objeto con `{ color, isOfficial, people }`

**Código:**
```javascript
export function resolvePersonColor(nameOrNames, legendPeopleMap) {
  const names = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames];
  
  if (names.length === 0) {
    return { color: "#808080", isOfficial: false, people: [] };
  }
  
  if (names.length === 1) {
    // Lógica para una persona
  }
  
  // Múltiples personas: mezclar colores
  const colors = names.map(name => /* obtener color */);
  const mixedColor = averageColorsHex(colors);
  
  return { color: mixedColor, isOfficial, people: names };
}
```

---

### Fase 2: Rediseñar HTML y CSS ✅

#### HTML (`index.html`)

**Estructura nueva:**
```html
<header class="header">
  <button id="dateBtn">mes/año</button>
</header>

<main class="canvas" id="canvas">
  <!-- Videos flotantes aquí -->
</main>

<div class="legend" id="legend">
  <!-- Leyenda pequeñita -->
</div>

<button id="uploadBtn" class="upload-btn">+</button>

<!-- Modales: seasonMenu, videoOverlay, passwordOverlay, uploadOverlay, newPersonOverlay -->
```

**Cambios clave:**
- Eliminar `topbar`, `stage`, `bottombar`, `grid`, `timeline`
- Canvas ocupa todo el espacio disponible
- Header fijo arriba con altura `8dvh`
- Leyenda fija abajo derecha
- Botón de subida fijo abajo izquierda

#### CSS (`style.css`)

**Principios de diseño:**
1. **Mobile first:** Diseño base para móvil, media queries para desktop
2. **Minimal:** Sin colores dominantes, solo blanco/negro/gris
3. **Menos redondeado:** `border-radius: 4px` (antes: 12-24px)
4. **dvh units:** Usar `dvh` para altura de viewport en móviles
5. **Sin bordes gruesos:** Bordes de 1px o sin bordes

**Variables CSS:**
```css
:root {
  --bg: #ffffff;
  --text: #000000;
  --text-muted: #666666;
  --border: #e0e0e0;
  --overlay-bg: rgba(0, 0, 0, 0.9);
  --header-h: 8dvh;
  --radius: 4px;
  --radius-sm: 2px;
}
```

**Componentes clave:**
- `.canvas`: `position: fixed`, ocupa todo el espacio bajo el header
- `.video-item`: `position: absolute`, posicionamiento dinámico con JS
- `.video-item::after`: Línea de color de 3px en la parte inferior
- `.legend`: `position: fixed`, `bottom: 16px`, `right: 16px`
- `.upload-btn`: `position: fixed`, `bottom: 16px`, `left: 16px`, circular

---

### Fase 3: Sistema de Posicionamiento Aleatorio ✅

**Archivo:** `js/layout.js` (NUEVO)

**Funciones:**

1. **`generateRandomLayout(count, containerSize, videoSize)`**
   - Genera posiciones aleatorias para N videos
   - Evita solapamiento con padding de 16px
   - Máximo 100 intentos por video
   - Si no puede colocar, fuerza posición (mejor solapado que invisible)
   - Retorna array de `{ x, y, width, height }`

2. **`rectanglesOverlap(rect1, rect2, padding)`**
   - Verifica si dos rectángulos se solapan
   - Considera padding entre rectángulos

3. **`calculateAverageVideoSize(items, containerSize)`**
   - Calcula tamaño promedio según orientación
   - Vertical: 40% del ancho del canvas
   - Horizontal: 60% del ancho del canvas
   - Aspect ratios: 9:16 (vertical), 16:9 (horizontal)

4. **`calculateCanvasHeight(positions, minHeight)`**
   - Calcula altura mínima del canvas para contener todos los videos
   - Añade 100px de padding inferior

**Algoritmo de posicionamiento:**
```
Para cada video:
  1. Generar tamaño aleatorio (±20% del tamaño base)
  2. Intentar colocar en posición aleatoria (máx 100 intentos)
  3. Verificar que no se solape con videos ya colocados
  4. Si se coloca exitosamente, continuar
  5. Si no, forzar posición después de 100 intentos
```

---

### Fase 4: Menú por Estaciones (EN PROGRESO)

**Archivo:** `js/seasonMenu.js` (NUEVO)

**Estructura:**
```
2025
  ├── Invierno (ene-mar)
  ├── Primavera (abr-jun)
  ├── Verano (jul-sep)
  └── Otoño (oct-dic)

2024
  ├── Invierno
  ├── Primavera
  ├── Verano
  └── Otoño
```

**Funcionalidades:**
- Generar menú a partir de `index.json`
- Agrupar meses por estaciones
- Destacar estaciones con contenido
- Marcar estación actual
- Navegación al hacer click

---

### Fase 5: Interfaz de Subida (PENDIENTE)

**Archivo:** `js/upload.js` (NUEVO)

**Componentes:**

1. **Modal de subida:**
   - Campo de archivo (video)
   - Campo de título
   - Campo de fecha
   - Selector de persona(s) múltiple
   - Campo de password opcional
   - Botones: cancelar, subir

2. **Selector de personas:**
   - Lista de personas existentes (checkboxes)
   - Botón "+ añadir persona" → abre modal de nueva persona
   - Chips con color de cada persona seleccionada

3. **Modal de nueva persona:**
   - Campo de nombre
   - Selector de color (input type="color")
   - Botones: cancelar, guardar

**Flujo:**
```
1. Usuario hace click en botón "+"
2. Se abre modal de subida
3. Usuario selecciona video y llena campos
4. Usuario selecciona persona(s) o crea nueva
5. Usuario hace click en "subir"
6. Se genera JSON y se guarda en data/days/
7. Se actualiza index.json
8. Se recarga la página
```

---

### Fase 6: Pruebas y Push (PENDIENTE)

**Tareas:**
1. Probar en navegador local
2. Verificar responsive en móvil
3. Verificar funcionalidades:
   - Posicionamiento aleatorio
   - Menú por estaciones
   - Subida de videos
   - Multi-persona con mezcla de colores
4. Hacer commit y push

---

## 📊 Comparación Antes/Después

### Antes (Versión 3.0)

**Estructura:**
- Topbar con fecha
- Stage con grid de tarjetas
- Bottombar con timeline y leyenda
- Selector de mes visual (grid de meses)

**Estética:**
- Colores Gold y beige dominantes
- Bordes redondeados grandes (12-24px)
- Tarjetas con bordes de color gruesos (4px)
- Tipografías grandes y bold
- Animaciones elásticas

**Datos:**
- Campo `person` como string
- Color individual por persona

### Después (Versión 4.0)

**Estructura:**
- Header minimal con mes/año
- Canvas completo con videos flotantes
- Leyenda pequeñita abajo derecha
- Botón de subida flotante
- Menú por estaciones (no meses individuales)

**Estética:**
- Blanco/negro/gris minimal
- Bordes redondeados mínimos (2-4px)
- Sin bordes en videos, solo línea de color inferior (3px)
- Tipografías pequeñas y legibles
- Animaciones sutiles

**Datos:**
- Campo `person` como array
- Mezcla de colores para múltiples personas

---

## 🎨 Decisiones de Diseño

### 1. ¿Por qué posicionamiento aleatorio?

**Ventajas:**
- Estética más orgánica y menos "IA"
- Cada carga es única
- Sensación de "collage" o "moodboard"
- Más espacio negativo (respiro visual)

**Desventajas:**
- Puede haber solapamiento en casos extremos
- Menos predecible para el usuario
- Requiere scroll para ver todos los videos

**Decisión:** Implementar con algoritmo anti-solapamiento pero permitir forzar posición si no se puede colocar después de 100 intentos.

### 2. ¿Por qué menú por estaciones?

**Ventajas:**
- Menos opciones = más fácil de navegar
- Agrupación natural del tiempo
- Menos clicks para llegar a un rango de fechas

**Desventajas:**
- Menos granularidad (no puedes ir a un mes específico directamente)

**Decisión:** Implementar menú por estaciones pero permitir navegación a mes específico desde la URL (`?m=25-02`).

### 3. ¿Por qué interfaz de subida?

**Ventajas:**
- Cualquiera puede contribuir
- No requiere conocimientos técnicos
- Gestión de personas integrada

**Desventajas:**
- Requiere backend para guardar archivos (por ahora solo frontend)
- Posibles problemas de permisos y seguridad

**Decisión:** Implementar interfaz frontend completa, backend se implementará después (puede ser Netlify Functions, Cloudflare Workers, o similar).

---

## 🔧 Tecnologías y Herramientas

**Frontend:**
- HTML5
- CSS3 (variables, flexbox, grid, dvh units)
- JavaScript ES6+ (modules, async/await)

**Sin dependencias externas:**
- No frameworks (React, Vue, etc.)
- No librerías (jQuery, Lodash, etc.)
- Solo HTML, CSS, JS vanilla

**Estructura modular:**
```
js/
├── app.js           - Orquestador principal
├── data.js          - Carga de datos
├── colors.js        - Sistema de colores (actualizado)
├── layout.js        - Posicionamiento aleatorio (nuevo)
├── seasonMenu.js    - Menú por estaciones (nuevo)
├── upload.js        - Interfaz de subida (nuevo)
└── ui.js            - Overlays y modales
```

---

## 📝 Próximos Pasos

1. ✅ Actualizar sistema de colores
2. ✅ Rediseñar HTML y CSS
3. ✅ Crear módulo de layout
4. 🔄 Crear módulo de menú por estaciones
5. ⏳ Crear módulo de interfaz de subida
6. ⏳ Integrar todo en app.js
7. ⏳ Probar y hacer push

---

## 🎯 Notas Importantes

### Mobile First

**Usar `dvh` en lugar de `vh`:**
```css
/* ❌ Mal (no considera barras de navegación) */
height: 100vh;

/* ✅ Bien (considera barras de navegación) */
height: 100dvh;
```

### Orientación de Videos

**Detectar orientación:**
```javascript
video.addEventListener('loadedmetadata', () => {
  const isVertical = video.videoHeight > video.videoWidth;
  // Ajustar tamaño según orientación
});
```

### Mezcla de Colores

**Promedio equitativo:**
```javascript
// 2 personas: 50% + 50%
// 3 personas: 33.33% + 33.33% + 33.33%
const weight = 1 / n;
```

---

**Estado actual:** Fase 3 completada, avanzando a Fase 4 (menú por estaciones).


---

## ✅ ACTUALIZACIÓN FINAL - Implementación Completa

**Fecha:** 04 de enero de 2026 - 16:30

### Módulos Implementados

1. ✅ **colors.js** - Actualizado para soportar múltiples personas
2. ✅ **layout.js** - Sistema de posicionamiento aleatorio (NUEVO)
3. ✅ **seasonMenu.js** - Menú organizado por estaciones (NUEVO)
4. ✅ **upload.js** - Interfaz de subida con gestión de personas (NUEVO)
5. ✅ **app.js** - Reescrito completamente para integrar todos los módulos
6. ✅ **data.js** - Actualizado con funciones `loadIndex()`, `loadDayData()`, `loadLegend()`
7. ✅ **index.html** - Rediseñado con estructura minimal
8. ✅ **style.css** - Rediseñado con estética minimal mobile first

### Archivos de Respaldo

- `js/app.js.backup` - Backup de la versión anterior

### Archivos Obsoletos (No eliminados, por si acaso)

- `js/timeline.js` - Ya no se usa (timeline eliminada)
- `js/grid.js` - Ya no se usa (grid eliminada)
- `js/monthPicker.js` - Reemplazado por `seasonMenu.js`
- `js/ui.js` - Funcionalidad integrada en `app.js`

### Estructura Final

```
arwuchivo/
├── index.html (rediseñado)
├── style.css (rediseñado)
├── js/
│   ├── app.js (reescrito)
│   ├── app.js.backup (backup)
│   ├── data.js (actualizado)
│   ├── colors.js (actualizado)
│   ├── layout.js (nuevo)
│   ├── seasonMenu.js (nuevo)
│   ├── upload.js (nuevo)
│   ├── timeline.js (obsoleto)
│   ├── grid.js (obsoleto)
│   ├── monthPicker.js (obsoleto)
│   └── ui.js (obsoleto)
├── data/
│   ├── index.json
│   ├── leyenda.json
│   ├── notaDeCurt.json (no usado en v4.0)
│   └── days/
│       ├── 25-02-14.json
│       └── 25-02-20.json
├── videos/
│   └── 25/02/14/ y 25/02/20/
├── thumbs/
│   └── 25/02/14/
└── prompt/
    ├── conversacion.txt
    ├── diagnostico_arwuchivo.md
    ├── DIAGNOSTICO_FINAL.md
    ├── CAMBIOS_REALIZADOS.md
    ├── CAMBIOS_ESTETICA.md
    ├── CAMBIOS_SELECTOR_Y_ESTETICA.md
    ├── TODO.md
    └── PROCESO_REDISENO_MINIMAL.md (este archivo)
```

### Próximo Paso

Probar la aplicación localmente y verificar que todo funciona correctamente antes de hacer push.

---

**Estado:** Implementación completa, listo para pruebas.

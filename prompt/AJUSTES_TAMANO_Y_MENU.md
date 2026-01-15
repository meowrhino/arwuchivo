# Ajustes de Tamaño y Menú - 15 de Enero 2026

**Fecha:** 15 de enero de 2026, 16:10
**Versión:** v4.1

---

## 🎯 Objetivo

Ajustar el tamaño de los videos a máximo 10% de la pantalla, eliminar scroll, hacer el posicionamiento más libre, mostrar todos los meses en el menú destacando los que tienen contenido, y subir 2 videos nuevos para el 15 de enero de 2026.

---

## 📋 Cambios Realizados

### 1. Tamaño de Videos Reducido

**Archivo:** `js/layout.js`

**Antes:**
- Vertical: 40% del ancho del canvas
- Horizontal: 60% del ancho del canvas

**Ahora:**
- Ambos: 10% del ancho del canvas (máximo)
- Variación: ±30% para más diversidad

**Código:**
```javascript
// Videos pequeños: máximo 10% del ancho del canvas
const maxWidth = mobileWidth * 0.10;
const verticalWidth = maxWidth;
const horizontalWidth = maxWidth;
```

---

### 2. Eliminación de Scroll

**Archivos:** `js/layout.js`, `style.css`

**layout.js:**
```javascript
export function calculateCanvasHeight(positions, viewportHeight) {
  // Sin scroll: altura fija igual al viewport
  return viewportHeight;
}
```

**style.css:**
```css
.canvas {
  overflow: hidden; /* Sin scroll */
}
```

---

### 3. Posicionamiento Más Libre

**Archivo:** `js/layout.js`

**Antes:**
- Padding: 16px entre videos
- MaxAttempts: 100 intentos para colocar cada video
- Sin solapamiento

**Ahora:**
- Padding: 0px (permitir solapamiento)
- MaxAttempts: 10 intentos (posicionamiento más libre)
- Solapamiento permitido

**Código:**
```javascript
const padding = 0; // Sin padding, permitir solapamiento
const maxAttempts = 10; // Menos intentos, posicionamiento más libre
```

---

### 4. Menú con Todos los Meses

**Archivo:** `js/seasonMenu.js`

**Antes:**
- Solo mostraba estaciones con contenido
- Organizado por año > estación

**Ahora:**
- Muestra **todos los meses** en el rango (desde el más antiguo hasta el más reciente)
- Grid de meses individuales
- Meses con contenido destacados en negro
- Mes actual marcado con outline rojo

**Función nueva:**
```javascript
function generateAllMonths(monthsWithContent) {
  // Genera todos los meses en el rango
  // desde el más antiguo hasta el más reciente
}
```

**Renderizado:**
```javascript
export function renderSeasonMenu(monthsWithContent, currentMonth, onMonthClick) {
  const allMonths = generateAllMonths(monthsWithContent);
  const monthsSet = new Set(monthsWithContent);
  
  // Grid de meses: ene '26, dic '25, nov '25, etc.
  // Destacar los que tienen contenido
}
```

---

### 5. CSS del Menú Actualizado

**Archivo:** `style.css`

**Antes:**
- `.season-year`, `.season-list`, `.season-item`

**Ahora:**
- `.month-grid` - Grid responsive
- `.month-item` - Botón de mes
- `.month-item.has-content` - Mes con contenido (negro)
- `.month-item.is-current` - Mes actual (outline rojo)

**Código:**
```css
.month-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
}

.month-item.has-content {
  background: var(--text);
  color: var(--bg);
  font-weight: 600;
}

.month-item.is-current {
  outline: 2px solid #dc2626;
  outline-offset: 2px;
}
```

---

### 6. Subida de 2 Videos Nuevos

**Fecha:** 15 de enero de 2026

**Videos:**
1. `videos/26/01/15/manu__01.mp4` (21 MB)
2. `videos/26/01/15/manu__02.mp4` (25 MB)

**Archivo JSON:** `data/days/26-01-15.json`
```json
{
  "d": "26-01-15",
  "items": [
    {
      "id": "manu__01",
      "src": "videos/26/01/15/manu__01.mp4",
      "title": "Entrenamiento 1",
      "person": ["Manu"]
    },
    {
      "id": "manu__02",
      "src": "videos/26/01/15/manu__02.mp4",
      "title": "Entrenamiento 2",
      "person": ["Manu"]
    }
  ]
}
```

**Index actualizado:** `data/index.json`
- Añadido día `26-01-15` con 2 videos de Manu

---

## 🎨 Resultado Visual

### Videos
- ✅ Tamaño: ~10% del ancho de la pantalla
- ✅ Posiciones: Aleatorias, pueden solaparse
- ✅ Sin scroll: Todo visible en una sola pantalla
- ✅ Línea de color: 3px en la parte inferior (Gold para Manu)

### Menú
- ✅ Muestra todos los meses desde feb '25 hasta ene '26
- ✅ Meses con contenido: Negro (ene '26, feb '25)
- ✅ Meses vacíos: Gris claro
- ✅ Mes actual: Outline rojo

---

## 📊 Archivos Modificados

1. `js/layout.js` - Tamaño reducido, sin scroll, posicionamiento libre
2. `js/seasonMenu.js` - Menú con todos los meses
3. `style.css` - Estilos del menú actualizado
4. `data/index.json` - Añadido día 26-01-15
5. `data/days/26-01-15.json` - Nuevo archivo con 2 videos
6. `videos/26/01/15/` - 2 videos nuevos

---

## 🚀 Próximos Pasos Sugeridos

1. **Generar miniaturas** para los videos nuevos
2. **Optimizar posicionamiento** para evitar que todos los videos queden en el mismo lugar
3. **Añadir animaciones** de entrada para los videos
4. **Implementar backend** para subida real de videos

---

**Commit:** Pendiente
**Mensaje:** "Fix: Ajustar tamaño de videos a 10%, eliminar scroll, mostrar todos los meses en menú, añadir 2 videos nuevos"

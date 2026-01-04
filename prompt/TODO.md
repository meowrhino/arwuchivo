# TODO: arwuchivo

## 📝 Tareas Pendientes

### 1. Integración con videoToWeb
- [ ] Revisar el proyecto **videoToWeb** para entender el proceso de conversión
- [ ] Verificar formatos de entrada soportados (MP4, MOV, etc.)
- [ ] Confirmar que la salida es WebM con compresión adecuada
- [ ] Documentar el flujo: video original → videoToWeb → archivo WebM optimizado
- [ ] Considerar generación automática de miniaturas (thumbs) durante la conversión

### 2. Mejoras del Formateador
- [ ] Revisar y probar la interfaz del formateador (`formateador/index.html`)
- [ ] Asegurar que puede añadir personas a `leyenda.json`
- [ ] Asegurar que puede añadir videos a la timeline (actualizar `index.json` y archivos de días)
- [ ] Implementar validación de datos antes de guardar
- [ ] Considerar preview de videos antes de añadirlos

### 3. Gestión de Videos
- [ ] Definir convención de nombres para archivos de video
  - Actual: `{nombre}__{numero}.webm` (ej: `manu__01.webm`)
  - ¿Mantener esta convención?
- [ ] Definir estructura de carpetas para años futuros
  - Actual: `videos/YY/MM/DD/`
  - ¿Qué pasa cuando llegue el año 2100? (colisión YY)
- [ ] Considerar límite de tamaño de archivos WebM
- [ ] Documentar proceso de backup de videos

### 4. Miniaturas (Thumbs)
- [ ] Decidir si todas las entradas deben tener miniatura
- [ ] Si no hay miniatura, el código usa `<video>` directamente (funciona bien)
- [ ] Considerar generación automática de thumbs desde el primer frame del video
- [ ] Optimizar tamaño de imágenes JPG para carga rápida

### 5. Sistema de Passwords
- [ ] Documentar que los passwords son "hackeables" (visible en inspector)
- [ ] Esto es **intencional** según el diseño original
- [ ] Considerar añadir una nota en la UI explicando esto
- [ ] ¿Necesitamos diferentes niveles de privacidad?

### 6. Colores y Leyenda
- [ ] Verificar que todos los nombres en los JSON tienen entrada en `leyenda.json`
- [ ] Si no tienen entrada, el sistema asigna color automático (funciona bien)
- [ ] Considerar añadir más personas a la leyenda según vayan apareciendo
- [ ] Documentar la paleta de colores HTML disponibles

### 7. Años de 2 Dígitos (YY)
- [ ] Actualmente: 25 = 2025, 00 = 2000, 99 = 2099
- [ ] **Problema futuro:** 2100 y 2000 comparten índice "00"
- [ ] **Solución propuesta en el prompt original:**
  - Marcar con colores en la leyenda (ej: "manu 20XX" vs "manu 21XX")
  - O añadir un campo extra en los JSON si es necesario
- [ ] Implementar solución antes de llegar al año 2100 😄

### 8. Testing y QA
- [ ] Probar navegación entre meses
- [ ] Probar navegación entre días
- [ ] Probar reproducción de videos
- [ ] Probar sistema de passwords
- [ ] Probar en diferentes navegadores (Chrome, Firefox, Safari)
- [ ] Probar en móviles (responsive)
- [ ] Verificar que la grid se adapta correctamente a diferentes tamaños de pantalla

### 9. Optimización
- [ ] Considerar lazy loading de videos para meses con muchos items
- [ ] Optimizar carga de `index.json` (podría crecer mucho con el tiempo)
- [ ] Considerar paginación si un día tiene demasiados videos
- [ ] Evaluar performance con 100+ videos en un mes

### 10. Documentación
- [ ] Crear README.md con instrucciones de uso
- [ ] Documentar estructura de archivos JSON
- [ ] Documentar proceso de añadir nuevos videos manualmente
- [ ] Documentar proceso de añadir nuevas personas a la leyenda
- [ ] Crear guía de troubleshooting

---

## 🎯 Prioridades

**Alta:**
1. Revisar videoToWeb para integración
2. Probar formateador y documentar su uso
3. Testing básico de la web

**Media:**
4. Optimizar miniaturas
5. Documentación completa

**Baja:**
6. Solución para problema del año 2100
7. Optimizaciones de performance avanzadas

---

## 💡 Ideas Futuras

- [ ] Añadir filtros por persona
- [ ] Añadir búsqueda por título
- [ ] Añadir tags/categorías a los videos
- [ ] Estadísticas: videos por persona, por mes, etc.
- [ ] Exportar timeline como PDF o imagen
- [ ] Compartir días específicos con URL directa
- [ ] Modo oscuro/claro (actualmente solo oscuro)
- [ ] Añadir comentarios a los videos
- [ ] Sistema de favoritos

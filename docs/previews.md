# Previews / “protocódigo” — arwuchivo

Esto no pretende ser “documentación perfecta”, solo una vista rápida de cómo debería verse y cómo se conectan piezas.

## UI (mental picture)

- 5dvh: fecha centrada (click => selector de mes)
- 85dvh: grid de cards (ocupa todo el fondo)
- 10dvh: barra inferior
  - 80%: timeline de puntos (días del mes)
  - 20%: leyenda (chips)

En un mes con contenido:
- algunos puntos están coloreados (días activos)
- al clicar un punto -> vista día
- si ese día hay 2+ personas -> el punto es un color “intermedio” (promedio RGB)

## JSONs

### `data/index.json`
- sirve para pintar la timeline sin cargar 30 ficheros

```json
{
  "version": 1,
  "days": [
    { "d": "25-02-14", "people": ["Manu","Berta"], "count": 2 },
    { "d": "25-02-20", "people": ["Manu"], "count": 1 }
  ]
}
```

### `data/days/25-02-14.json`
- items completos del día

```json
{
  "d": "25-02-14",
  "items": [
    { "id":"25-02-14-manu-01", "title":"...", "person":"Manu", "src":"videos/25/02/14/manu__01.webm" },
    { "id":"25-02-14-berta-01", "title":"...", "person":"Berta", "src":"videos/25/02/14/berta__01.webm", "password":"tiger" }
  ]
}
```

### `data/leyenda.json`
- colores oficiales

```json
{ "people": { "Manu": { "color":"#32CD32" } } }
```

## Color “intermedio” por día (timeline)

Pseudocódigo:

```js
const people = meta.people;        // nombres únicos
const N = people.length;           // N personas
const weight = 1 / N;              // regla de 3: cada una aporta 100/N %
let r=0,g=0,b=0;
for (name of people){
  const hex = colorDe(name);
  const rgb = hexToRgb(hex);
  r += rgb.r * weight;
  g += rgb.g * weight;
  b += rgb.b * weight;
}
return rgbToHex(round(r), round(g), round(b));
```

## Grid “que llena”

Pseudocódigo:

```js
ratio = width/height;
cols = ceil(sqrt(N * ratio));
rows = ceil(N / cols);
gridTemplateColumns = `repeat(${cols}, 1fr)`;
```

## Formateador (flujo)

- Cargas (opcional) JSONs.
- Añades personas a leyenda.
- Añades vídeos:
  - fecha YY-MM-DD
  - persona (de leyenda o “escribir nombre (auto)”)
  - src webm, thumb opcional, password opcional
- Descargas JSONs y los reemplazas en el repo.

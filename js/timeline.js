import { daysInMonth } from "./data.js";
import { resolvePersonColor, averageColorsHex } from "./colors.js";

/**
 * Timeline siempre visible:
 * - Crea 28-31 puntos (según mes)
 * - Días con contenido -> activos y coloreados
 * - Color por día -> promedio RGB de las personas presentes en ese día (equilibrado por personas)
 */
export function renderTimeline({
  el,
  yyMM,
  selectedDay,
  indexDays, // array de { d, people, count }
  legendPeopleMap,
  onSelectDay
}) {
  el.innerHTML = "";

  const dim = daysInMonth(yyMM);
  const dayMap = new Map();
  for (const entry of indexDays) {
    if (entry.d?.startsWith(yyMM)) dayMap.set(entry.d, entry);
  }

  for (let day = 1; day <= dim; day++) {
    const dd = String(day).padStart(2, "0");
    const d = `${yyMM}-${dd}`;

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "day-dot";
    dot.setAttribute("aria-label", `Día ${dd}`);

    if (d === selectedDay) dot.classList.add("is-selected");

    const meta = dayMap.get(d);
    if (meta?.count > 0) {
      dot.classList.add("is-active");

      // Regla de 3 “real”: si hay N personas -> cada una aporta 100/N%.
      const people = Array.isArray(meta.people) ? meta.people : [];
      const colors = people.map(p => resolvePersonColor(p, legendPeopleMap).color);
      const mix = averageColorsHex(colors);

      dot.style.background = mix;

      dot.addEventListener("click", () => onSelectDay(d));
    }

    el.appendChild(dot);
  }
}

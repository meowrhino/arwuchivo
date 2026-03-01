import { daysInMonth } from "./data.js";
import { resolveFusionRadial } from "./colors.js";

/**
 * Timeline con fusion de colores:
 * - Dias con 1 persona -> color solido
 * - Dias con 2+ personas -> conic-gradient (fusion Steven Universe)
 */
export function renderTimeline({
  el,
  yyMM,
  selectedDay,
  indexDays,
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
    dot.setAttribute("aria-label", `Dia ${dd}`);

    if (d === selectedDay) dot.classList.add("is-selected");

    const meta = dayMap.get(d);
    if (meta?.count > 0) {
      dot.classList.add("is-active");

      const people = Array.isArray(meta.people) ? meta.people : [];
      const fusionBg = resolveFusionRadial(people, legendPeopleMap);
      dot.style.background = fusionBg;

      dot.addEventListener("click", () => onSelectDay(d));
    }

    el.appendChild(dot);
  }
}

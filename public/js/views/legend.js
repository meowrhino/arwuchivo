/**
 * views/legend.js
 * Render de la leyenda (esquina inferior derecha). Cuenta videos por persona
 * desde los items renderizados ahora mismo en el canvas.
 */

import { resolvePersonColor } from '../colors.js';
import { escapeHtml } from './util.js';

export function renderLegend({ items, legendPeopleMap }) {
  const legendEl = document.getElementById('legend');
  if (!legendEl || !legendPeopleMap) return;

  const counts = new Map();
  for (const item of items || []) {
    const persons = Array.isArray(item.person) ? item.person : [item.person];
    for (const p of persons.filter(Boolean)) {
      counts.set(p, (counts.get(p) || 0) + 1);
    }
  }

  const peopleInScope = [...counts.keys()];
  const people = peopleInScope.length > 0 ? peopleInScope : Object.keys(legendPeopleMap);

  if (people.length === 0) {
    legendEl.innerHTML = '<span class="legend-hint">+ personas</span>';
    return;
  }

  legendEl.innerHTML = people.map(name => {
    const { color } = resolvePersonColor(name, legendPeopleMap);
    const count = counts.get(name) || 0;
    const countHtml = count > 0 ? `<span class="legend-count">${count}</span>` : '';
    // Orden DOM con row-reverse: visual queda "nombre · count · dot"
    return `
      <span class="legend-item">
        <span class="legend-dot" style="background: ${color}"></span>
        ${countHtml}
        <span class="legend-name">${escapeHtml(name.toLowerCase())}</span>
      </span>
    `;
  }).join('');
}

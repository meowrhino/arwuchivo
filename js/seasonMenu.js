/**
 * seasonMenu.js
 * Menú organizado por estaciones en lugar de meses individuales
 */

const SEASON_NAMES = {
  winter: 'invierno',
  spring: 'primavera',
  summer: 'verano',
  fall: 'otoño'
};

const SEASON_MONTHS = {
  winter: [12, 1, 2],   // dic, ene, feb
  spring: [3, 4, 5],    // mar, abr, may
  summer: [6, 7, 8],    // jun, jul, ago
  fall: [9, 10, 11]     // sep, oct, nov
};

/**
 * Obtiene la estación para un mes dado
 * @param {number} month - Mes (1-12)
 * @returns {string} - 'winter', 'spring', 'summer', 'fall'
 */
export function getSeasonForMonth(month) {
  for (const [season, months] of Object.entries(SEASON_MONTHS)) {
    if (months.includes(month)) {
      return season;
    }
  }
  return 'winter'; // fallback
}

/**
 * Agrupa meses por año y estación
 * @param {Array} monthsWithContent - Array de strings "YY-MM"
 * @returns {Object} - { year: { season: [months] } }
 */
export function groupMonthsBySeason(monthsWithContent) {
  const grouped = {};

  for (const monthStr of monthsWithContent) {
    const [yy, mm] = monthStr.split('-').map(Number);
    const year = 2000 + yy; // Convertir YY a YYYY
    const month = mm;
    const season = getSeasonForMonth(month);

    if (!grouped[year]) {
      grouped[year] = {
        winter: [],
        spring: [],
        summer: [],
        fall: []
      };
    }

    grouped[year][season].push(monthStr);
  }

  return grouped;
}

/**
 * Renderiza el menú de estaciones
 * @param {Array} monthsWithContent - Array de strings "YY-MM" que tienen contenido
 * @param {string} currentMonth - Mes actual "YY-MM"
 * @param {Function} onSeasonClick - Callback al hacer click en una estación
 * @returns {string} - HTML del menú
 */
export function renderSeasonMenu(monthsWithContent, currentMonth, onSeasonClick) {
  const grouped = groupMonthsBySeason(monthsWithContent);
  const years = Object.keys(grouped).sort((a, b) => b - a); // Orden descendente

  let html = '';

  for (const year of years) {
    const seasons = grouped[year];
    
    html += `<div class="season-year">`;
    html += `<div class="season-year-title">${year}</div>`;
    html += `<div class="season-list">`;

    // Orden de estaciones: invierno, primavera, verano, otoño
    const seasonOrder = ['winter', 'spring', 'summer', 'fall'];
    
    for (const season of seasonOrder) {
      const months = seasons[season];
      
      if (months.length === 0) continue; // Saltar estaciones sin contenido

      const hasContent = months.length > 0;
      const isCurrent = months.includes(currentMonth);
      
      const classes = [
        'season-item',
        hasContent ? 'has-content' : '',
        isCurrent ? 'is-current' : ''
      ].filter(Boolean).join(' ');

      const seasonName = SEASON_NAMES[season];
      const firstMonth = months[0]; // Usar el primer mes de la estación para navegación

      html += `<button 
        class="${classes}" 
        data-month="${firstMonth}"
        data-season="${season}"
        data-year="${year}">
        ${seasonName}
      </button>`;
    }

    html += `</div>`;
    html += `</div>`;
  }

  return html;
}

/**
 * Inicializa el menú de estaciones
 * @param {Object} options - { monthsWithContent, currentMonth, onSeasonClick }
 */
export function initSeasonMenu({ monthsWithContent, currentMonth, onSeasonClick }) {
  const menuEl = document.getElementById('seasonMenu');
  const contentEl = document.getElementById('seasonMenuContent');
  const closeBtn = document.getElementById('seasonMenuClose');
  const dateBtn = document.getElementById('dateBtn');

  if (!menuEl || !contentEl || !closeBtn || !dateBtn) {
    console.error('Season menu elements not found');
    return;
  }

  // Renderizar contenido
  const html = renderSeasonMenu(monthsWithContent, currentMonth, onSeasonClick);
  contentEl.innerHTML = html;

  // Event listeners
  dateBtn.addEventListener('click', () => {
    menuEl.hidden = false;
  });

  closeBtn.addEventListener('click', () => {
    menuEl.hidden = true;
  });

  // Click fuera del menú para cerrar
  menuEl.addEventListener('click', (e) => {
    if (e.target === menuEl) {
      menuEl.hidden = true;
    }
  });

  // Click en estaciones
  contentEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.season-item');
    if (!btn) return;

    const month = btn.dataset.month;
    if (month && onSeasonClick) {
      onSeasonClick(month);
      menuEl.hidden = true;
    }
  });
}

/**
 * Actualiza el botón de fecha con el mes actual
 * @param {string} monthStr - Mes en formato "YY-MM"
 */
export function updateDateButton(monthStr) {
  const dateBtn = document.getElementById('dateBtn');
  if (!dateBtn) return;

  const [yy, mm] = monthStr.split('-').map(Number);
  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  const monthName = monthNames[mm - 1];
  const year = 2000 + yy;

  dateBtn.textContent = `${monthName} '${yy}`;
}

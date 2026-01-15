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
 * Genera lista de todos los meses en un rango
 * @param {Array} monthsWithContent - Array de strings "YY-MM" que tienen contenido
 * @returns {Array} Array de todos los meses en orden descendente
 */
function generateAllMonths(monthsWithContent) {
  if (monthsWithContent.length === 0) {
    // Si no hay contenido, generar últimos 24 meses
    const now = new Date();
    const months = [];
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yy = String(d.getFullYear() % 100).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      months.push(`${yy}-${mm}`);
    }
    return months;
  }

  // Encontrar rango de meses con contenido
  const sorted = [...monthsWithContent].sort();
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];

  // Parsear fechas
  const [oldYY, oldMM] = oldest.split('-').map(Number);
  const [newYY, newMM] = newest.split('-').map(Number);

  const oldDate = new Date(2000 + oldYY, oldMM - 1, 1);
  const newDate = new Date(2000 + newYY, newMM - 1, 1);

  // Generar todos los meses en el rango
  const allMonths = [];
  const current = new Date(newDate);

  while (current >= oldDate) {
    const yy = String(current.getFullYear() % 100).padStart(2, '0');
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    allMonths.push(`${yy}-${mm}`);
    current.setMonth(current.getMonth() - 1);
  }

  return allMonths;
}

/**
 * Renderiza el menú de meses (todos, destacando los llenos)
 * @param {Array} monthsWithContent - Array de strings "YY-MM" que tienen contenido
 * @param {string} currentMonth - Mes actual "YY-MM"
 * @param {Function} onMonthClick - Callback al hacer click en un mes
 * @returns {string} - HTML del menú
 */
export function renderSeasonMenu(monthsWithContent, currentMonth, onMonthClick) {
  const allMonths = generateAllMonths(monthsWithContent);
  const monthsSet = new Set(monthsWithContent);

  const monthNames = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
  ];

  let html = '<div class="month-grid">';

  for (const monthStr of allMonths) {
    const [yy, mm] = monthStr.split('-').map(Number);
    const monthName = monthNames[mm - 1];
    const hasContent = monthsSet.has(monthStr);
    const isCurrent = monthStr === currentMonth;

    const classes = [
      'month-item',
      hasContent ? 'has-content' : '',
      isCurrent ? 'is-current' : ''
    ].filter(Boolean).join(' ');

    html += `<button 
      class="${classes}" 
      data-month="${monthStr}">
      <span class="month-name">${monthName}</span>
      <span class="month-year">'${String(yy).padStart(2, '0')}</span>
    </button>`;
  }

  html += '</div>';
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

  // Click en meses
  contentEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.month-item');
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

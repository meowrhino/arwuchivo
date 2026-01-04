/**
 * monthPicker.js
 * Selector de mes visual que muestra meses con contenido destacados
 */

export function setupMonthPicker({ indexDays, currentMonth, onSelectMonth }) {
  const picker = document.getElementById("monthPickerOverlay");
  const grid = document.getElementById("monthPickerGrid");
  const closeBtn = document.getElementById("monthPickerClose");

  // Extraer meses únicos del index
  const monthsWithContent = new Set();
  for (const entry of indexDays) {
    if (entry.d && typeof entry.d === "string") {
      const yyMM = entry.d.substring(0, 5); // "25-02"
      monthsWithContent.add(yyMM);
    }
  }

  // Generar últimos 24 meses (2 años)
  const months = generateMonths(24);

  // Renderizar grid de meses
  grid.innerHTML = "";
  for (const m of months) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "month-btn";
    btn.textContent = formatMonth(m);
    btn.dataset.month = m;

    // Destacar mes actual
    if (m === currentMonth) {
      btn.classList.add("is-current");
    }

    // Destacar meses con contenido
    if (monthsWithContent.has(m)) {
      btn.classList.add("has-content");
    }

    btn.addEventListener("click", () => {
      picker.hidden = true;
      onSelectMonth(m);
    });

    grid.appendChild(btn);
  }

  // Cerrar picker
  const close = () => {
    picker.hidden = true;
  };

  closeBtn.addEventListener("click", close);
  picker.addEventListener("click", (e) => {
    if (e.target === picker) close();
  });

  return {
    open() {
      picker.hidden = false;
    }
  };
}

/**
 * Genera array de meses en formato YY-MM
 * @param {number} count - Número de meses a generar
 * @returns {string[]}
 */
function generateMonths(count) {
  const now = new Date();
  const months = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yy = String(d.getFullYear() % 100).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${yy}-${mm}`);
  }

  return months;
}

/**
 * Formatea mes YY-MM a texto legible
 * @param {string} yyMM - Mes en formato YY-MM
 * @returns {string}
 */
function formatMonth(yyMM) {
  const [yy, mm] = yyMM.split("-");
  const monthNames = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic"
  ];
  const monthName = monthNames[parseInt(mm, 10) - 1] || mm;
  return `${monthName} '${yy}`;
}

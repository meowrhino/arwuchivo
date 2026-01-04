import { fetchJSON, parseParams, nowYYMM, monthFromDay, formatMonthLabel, formatDayLabel, formatDayShort } from "./data.js";
import { resolvePersonColor } from "./colors.js";
import { renderTimeline } from "./timeline.js";
import { setupOverlay } from "./ui.js";
import { computeGrid } from "./grid.js";

const dateBtn = document.getElementById("dateBtn");
const monthPicker = document.getElementById("monthPicker");
const gridEl = document.getElementById("grid");
const emptyEl = document.getElementById("empty");
const legendEl = document.getElementById("legend");
const noteEl = document.getElementById("note");

const overlay = setupOverlay();

init().catch((err) => {
  console.error(err);
  emptyEl.hidden = false;
  emptyEl.textContent = "Error cargando datos.";
});

async function init() {
  const { m, d } = parseParams();

  const month = d ? monthFromDay(d) : (m || nowYYMM());
  const day = d || null;

  // Header label
  dateBtn.textContent = day ? formatDayLabel(day) : formatMonthLabel(month);

  // month picker: usa YYYY-MM, convertimos a YY-MM (últimas 2 cifras)
  dateBtn.addEventListener("click", () => {
    monthPicker.value = toYYYYMM(month);
    monthPicker.click();
  });

  monthPicker.addEventListener("change", () => {
    if (!monthPicker.value) return;
    const [yyyy, mm] = monthPicker.value.split("-");
    const yy = yyyy.slice(-2);
    location.href = `index.html?m=${yy}-${mm}`;
  });

  const [index, leyenda, nota] = await Promise.all([
    fetchJSON("data/index.json"),
    fetchJSON("data/leyenda.json"),
    fetchJSON("data/notaDeCurt.json"),
  ]);

  const legendPeopleMap = leyenda?.people || {};
  const indexDays = Array.isArray(index?.days) ? index.days : [];

  // Render timeline (siempre)
  const timelineEl = document.getElementById("timeline");
  renderTimeline({
    el: timelineEl,
    yyMM: month,
    selectedDay: day,
    indexDays,
    legendPeopleMap,
    onSelectDay: (sel) => location.href = `index.html?d=${sel}`
  });

  // Load content (month or day)
  let items = [];
  if (day) {
    items = await loadDayItems(day);
  } else {
    items = await loadMonthItems(month, indexDays);
  }

  // Empty state
  emptyEl.hidden = items.length > 0;
  gridEl.hidden = items.length === 0;

  // Note de Curt: solo si hay items
  if (items.length > 0 && nota?.text) {
    noteEl.hidden = false;
    noteEl.textContent = nota.text;
    const value = Number(nota.nota_de_curt ?? 0);
    noteEl.classList.toggle("is-light", value >= 50);
    noteEl.classList.toggle("is-dark", value < 50);
  } else {
    noteEl.hidden = true;
  }

  // Grid: calcula cols/rows según el rectángulo disponible
  if (items.length > 0) {
    const rect = gridEl.getBoundingClientRect();
    const { cols } = computeGrid(items.length, rect.width, rect.height);
    gridEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  }

  renderCards(items, legendPeopleMap);

  // Leyenda (20% bottom): solo si hay items
  if (items.length > 0) {
    renderLegend(items, legendPeopleMap);
  } else {
    legendEl.innerHTML = "";
  }
}

async function loadDayItems(yyMMdd) {
  const data = await fetchJSON(`data/days/${yyMMdd}.json`);
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(it => ({ ...it, _day: yyMMdd }));
}

async function loadMonthItems(yyMM, indexDays) {
  const days = indexDays
    .map(x => x.d)
    .filter(d => typeof d === "string" && d.startsWith(yyMM))
    .sort();

  const dayData = await Promise.allSettled(days.map(d => loadDayItems(d)));
  const out = [];
  for (const r of dayData) {
    if (r.status === "fulfilled") out.push(...r.value);
  }
  return out;
}

function renderCards(items, legendPeopleMap) {
  gridEl.innerHTML = "";

  for (const it of items) {
    const person = it.person || "¿?";
    const { color } = resolvePersonColor(person, legendPeopleMap);

    const card = document.createElement("article");
    card.className = "card";
    card.style.borderColor = color;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-btn";

    const media = document.createElement("div");
    media.className = "media";

    if (it.thumb) {
      const img = document.createElement("img");
      img.src = it.thumb;
      img.alt = it.title || "Vídeo";
      media.appendChild(img);
    } else {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "metadata";
      v.src = it.src;
      media.appendChild(v);
    }

    const meta = document.createElement("div");
    meta.className = "meta";

    const t = document.createElement("div");
    t.className = "t";
    t.textContent = it.title || "(sin título)";

    const d = document.createElement("div");
    d.className = "d";
    d.textContent = it._day ? formatDayShort(it._day) : "";

    meta.append(t, d);

    btn.append(media, meta);

    // Hackeable a propósito:
    // - si hay password, dejamos el valor en el DOM (span.password).
    if (it.password) {
      const pw = document.createElement("span");
      pw.className = "password";
      pw.textContent = it.password;
      btn.appendChild(pw);
    }

    btn.addEventListener("click", () => {
      if (!it.password) {
        overlay.openVideo(it.src);
        return;
      }
      overlay.openPassword({
        onSubmit: (val) => {
          if (val === it.password) {
            overlay.openVideo(it.src);
            return true;
          }
          return false;
        }
      });
    });

    card.appendChild(btn);
    gridEl.appendChild(card);
  }
}

function renderLegend(items, legendPeopleMap) {
  // personas visibles
  const people = Array.from(new Set(items.map(it => it.person).filter(Boolean)));

  const official = [];
  const auto = [];

  for (const name of people) {
    const entry = resolvePersonColor(name, legendPeopleMap);
    (entry.isOfficial ? official : auto).push({ name, color: entry.color });
  }

  legendEl.innerHTML = "";
  legendEl.append(
    legendBlock("oficial", official),
    legendBlock("auto", auto)
  );
}

function legendBlock(title, rows) {
  const block = document.createElement("div");
  block.className = "legend-block";

  const t = document.createElement("div");
  t.className = "legend-title";
  t.textContent = title;

  const chips = document.createElement("div");
  chips.className = "legend-chips";

  for (const r of rows) {
    const chip = document.createElement("span");
    chip.className = "chip";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = r.color;
    chip.append(dot, document.createTextNode(r.name));
    chips.appendChild(chip);
  }

  block.append(t, chips);
  return block;
}

function toYYYYMM(yyMM) {
  const [yy, mm] = yyMM.split("-");
  // Solo para rellenar el <input type="month">: asumimos 20YY como año real.
  return `20${yy}-${mm}`;
}

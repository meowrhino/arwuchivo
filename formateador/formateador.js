/**
 * Formateador minimal:
 * - Cargar index.json / leyenda.json / un day-file opcional
 * - Añadir personas (con color oficial) a leyenda.json
 * - Añadir vídeos a un día (genera/actualiza el day-file y el index)
 * - Descargar JSONs actualizados
 *
 * Nota: no escribimos directamente en disco (por compatibilidad).
 * El flujo “Live Server” es: descargas JSONs -> reemplazas ficheros en el repo.
 */

let state = {
  index: { version: 1, days: [] },
  leyenda: { people: {} },
  currentDay: { d: "", items: [] }
};

const els = {
  fileIndex: document.getElementById("fileIndex"),
  fileLeyenda: document.getElementById("fileLeyenda"),
  fileDay: document.getElementById("fileDay"),

  personName: document.getElementById("personName"),
  personColor: document.getElementById("personColor"),
  addPerson: document.getElementById("addPerson"),
  peoplePreview: document.getElementById("peoplePreview"),

  vDate: document.getElementById("vDate"),
  vPerson: document.getElementById("vPerson"),
  vPersonCustom: document.getElementById("vPersonCustom"),
  vTitle: document.getElementById("vTitle"),
  vSrc: document.getElementById("vSrc"),
  vThumb: document.getElementById("vThumb"),
  vPw: document.getElementById("vPw"),
  addVideo: document.getElementById("addVideo"),
  dayPreview: document.getElementById("dayPreview"),

  dlIndex: document.getElementById("dlIndex"),
  dlLeyenda: document.getElementById("dlLeyenda"),
  dlDay: document.getElementById("dlDay"),
};

boot();

function boot() {
  els.fileIndex.addEventListener("change", async () => {
    const file = els.fileIndex.files?.[0];
    if (!file) return;
    state.index = await readJSON(file);
    ensureIndexShape();
    refreshUI();
  });

  els.fileLeyenda.addEventListener("change", async () => {
    const file = els.fileLeyenda.files?.[0];
    if (!file) return;
    state.leyenda = await readJSON(file);
    ensureLeyendaShape();
    refreshUI();
  });

  els.fileDay.addEventListener("change", async () => {
    const file = els.fileDay.files?.[0];
    if (!file) return;
    state.currentDay = await readJSON(file);
    ensureDayShape();
    refreshUI();
  });

  els.addPerson.addEventListener("click", () => {
    const name = (els.personName.value || "").trim();
    const color = (els.personColor.value || "").trim();

    if (!name) return;

    // Si este bloque es "persona a la leyenda", lo normal es meter un color.
    // Si no meten color, dejamos la entrada igualmente (por si queréis “reservar” el nombre).
    if (color && !/^#([0-9a-fA-F]{6})$/.test(color)) {
      alert("Color inválido. Usa formato #RRGGBB.");
      return;
    }

    state.leyenda.people[name] = color ? { color } : state.leyenda.people[name] || {};
    refreshUI();
  });

  els.vPerson.addEventListener("change", () => {
    const isCustom = els.vPerson.value === "__custom__";
    els.vPersonCustom.hidden = !isCustom;
    if (isCustom) els.vPersonCustom.focus();
  });

  els.addVideo.addEventListener("click", () => {
    const d = (els.vDate.value || "").trim();
    if (!/^[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(d)) {
      alert("Fecha inválida. Usa YY-MM-DD (p.ej. 25-02-14).");
      return;
    }

    const person = getSelectedPerson();
    if (!person) {
      alert("Elige una persona o escribe una (auto).");
      return;
    }

    const title = (els.vTitle.value || "").trim() || "(sin título)";
    const src = (els.vSrc.value || "").trim();
    if (!src) {
      alert("Falta src (ruta al .webm).");
      return;
    }

    const thumb = (els.vThumb.value || "").trim();
    const password = (els.vPw.value || "").trim();

    // Si el día actual no coincide, “cambiamos” de día (creamos uno nuevo)
    if (state.currentDay.d !== d) {
      state.currentDay = { d, items: [] };
    }

    const id = makeId(d, person);
    const item = {
      id,
      title,
      person,
      src,
      ...(thumb ? { thumb } : {}),
      ...(password ? { password } : {})
    };

    state.currentDay.items.push(item);

    // Actualiza index.json (metadatos)
    upsertIndexDayFromCurrent();

    refreshUI();
  });

  els.dlIndex.addEventListener("click", () => downloadJSON("index.json", state.index));
  els.dlLeyenda.addEventListener("click", () => downloadJSON("leyenda.json", state.leyenda));
  els.dlDay.addEventListener("click", () => {
    const d = state.currentDay.d || "YY-MM-DD";
    downloadJSON(`${d}.json`, state.currentDay);
  });

  refreshUI();
}

function getSelectedPerson() {
  const v = els.vPerson.value || "";
  if (v === "__custom__") return (els.vPersonCustom.value || "").trim();
  return v;
}

function refreshUI() {
  ensureIndexShape();
  ensureLeyendaShape();
  ensureDayShape();

  // People dropdown
  const names = Object.keys(state.leyenda.people).sort((a,b)=>a.localeCompare(b));
  els.vPerson.innerHTML = "";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "— elige —";
  els.vPerson.appendChild(opt0);

  for (const n of names) {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    els.vPerson.appendChild(opt);
  }

  const optC = document.createElement("option");
  optC.value = "__custom__";
  optC.textContent = "Escribir nombre (auto)…";
  els.vPerson.appendChild(optC);

  els.peoplePreview.textContent = JSON.stringify(state.leyenda, null, 2);
  els.dayPreview.textContent = JSON.stringify(state.currentDay, null, 2);

  // Autoprellenar fecha si estamos “en” un day-file
  if (state.currentDay.d && !els.vDate.value) els.vDate.value = state.currentDay.d;

  // Si no hay selección, hide custom
  const isCustom = els.vPerson.value === "__custom__";
  els.vPersonCustom.hidden = !isCustom;
}

function ensureIndexShape() {
  if (!state.index || typeof state.index !== "object") state.index = { version: 1, days: [] };
  if (!Array.isArray(state.index.days)) state.index.days = [];
  if (!state.index.version) state.index.version = 1;
}

function ensureLeyendaShape() {
  if (!state.leyenda || typeof state.leyenda !== "object") state.leyenda = { people: {} };
  if (!state.leyenda.people || typeof state.leyenda.people !== "object") state.leyenda.people = {};
}

function ensureDayShape() {
  if (!state.currentDay || typeof state.currentDay !== "object") state.currentDay = { d: "", items: [] };
  if (!Array.isArray(state.currentDay.items)) state.currentDay.items = [];
  if (typeof state.currentDay.d !== "string") state.currentDay.d = "";
}

async function readJSON(file) {
  const txt = await file.text();
  return JSON.parse(txt);
}

function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function makeId(d, person) {
  const slug = person.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const n = String(state.currentDay.items.length + 1).padStart(2, "0");
  return `${d}-${slug}-${n}`;
}

function upsertIndexDayFromCurrent() {
  const d = state.currentDay.d;
  if (!d) return;

  const people = Array.from(new Set(state.currentDay.items.map(x => x.person).filter(Boolean)));
  const count = state.currentDay.items.length;

  const i = state.index.days.findIndex(x => x.d === d);
  const row = { d, people, count };

  if (i >= 0) state.index.days[i] = row;
  else state.index.days.push(row);

  // Ordena
  state.index.days.sort((a,b) => (a.d || "").localeCompare(b.d || ""));
}

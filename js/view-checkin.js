/* ===== Týdenní check-in =====
   Kopíruje strukturu záložky CHECK-IN v tabulce trenéra: váha, obvody,
   dodržování, škály 1–10 a poznámka. Řádek jde zkopírovat rovnou do tabulky. */
"use strict";

const CV = {
  form: null,        // rozpracovaný check-in (null = jen výpis)
  editId: null,
  trendKey: "waist"  // vybraný obvod v grafu trendu
};

function renderCheckin() {
  return CV.form ? renderCheckinForm() : renderCheckinList();
}

/* ---- Výpis check-inů + trend obvodů ---- */
function renderCheckinList() {
  const list = checkinsSorted();
  const since = daysSinceCheckin();

  const dueCard = `
    <div class="card">
      <div class="h2">Týdenní check-in</div>
      <p class="muted" style="margin:0 0 12px">${
        since === null
          ? "Zapiš první check-in — obvody a pocity, které trenér sleduje v tabulce."
          : since >= 7
            ? `Poslední byl před ${since} dny — je na řadě další.`
            : `Poslední před ${since === 0 ? "chvílí" : since === 1 ? "1 dnem" : since + " dny"}. Další za ${7 - since} ${7 - since === 1 ? "den" : 7 - since < 5 ? "dny" : "dní"}.`
      }</p>
      <button class="btn primary full" data-act="ci-new">+ Nový check-in</button>
    </div>`;

  if (!list.length) return dueCard;

  /* trend obvodů */
  const opts = MEASURES.map(m =>
    `<option value="${m.key}"${m.key === CV.trendKey ? " selected" : ""}>${m.label}</option>`).join("");
  const series = list.slice().reverse()
    .filter(c => c.measures && c.measures[CV.trendKey] != null)
    .map(c => ({ date: c.date, value: c.measures[CV.trendKey] }));
  const trendCard = `
    <div class="card">
      <div class="h2">Trend obvodů <span class="small">(cm)</span></div>
      <select class="input" data-change="ci-trend" style="margin-bottom:12px">${opts}</select>
      ${lineChart(series, { color: "chart" })}
    </div>`;

  /* seznam se změnami proti předchozímu */
  const rows = list.map((c, i) => {
    const prev = list[i + 1];
    const parts = [];
    if (c.weightKg != null) {
      const d = prev && prev.weightKg != null ? kgOut(c.weightKg) - kgOut(prev.weightKg) : null;
      parts.push(`${fmtWeight(c.weightKg)}${d != null && Math.abs(d) >= 0.05 ? ` <span class="small">(${d > 0 ? "+" : ""}${fmtNum(d, 1)})</span>` : ""}`);
    }
    const waist = c.measures && c.measures.waist;
    if (waist != null) {
      const d = prev && prev.measures && prev.measures.waist != null ? waist - prev.measures.waist : null;
      parts.push(`pas ${fmtNum(waist, 1)} cm${d != null && Math.abs(d) >= 0.05 ? ` <span class="small">(${d > 0 ? "+" : ""}${fmtNum(d, 1)})</span>` : ""}`);
    }
    if (c.adherence != null) parts.push(`${c.adherence} %`);
    return `
      <div class="list-item" data-act="ci-edit" data-id="${c.id}" style="cursor:pointer">
        <div class="grow">
          <div class="name">${fmtDate(c.date)}</div>
          <div class="small">${parts.join(" · ") || "bez hodnot"}</div>
        </div>
        <button class="btn sm ghost" data-act="ci-copy" data-id="${c.id}">Kopírovat</button>
      </div>`;
  }).join("");

  return dueCard + trendCard + `
    <div class="card">
      <div class="h2">Historie <span class="small">(${list.length})</span></div>${rows}
      <p class="small mt">„Kopírovat" dá řádek do schránky ve stejném pořadí sloupců jako tabulka trenéra — v Sheetu stačí vložit do buňky DATUM.</p>
    </div>`;
}

/* ---- Formulář ---- */
function scaleRow(key, label, value, hint) {
  const chips = Array.from({ length: 10 }, (_, k) => k + 1).map(n =>
    `<button class="scale-chip${value === n ? " on" : ""}" data-act="ci-scale" data-key="${key}" data-val="${n}">${n}</button>`).join("");
  return `
    <div class="mt">
      <div class="h3" style="margin-bottom:${hint ? "2px" : "6px"}">${label}</div>
      ${hint ? `<div class="small" style="margin-bottom:6px">${esc(hint)}</div>` : ""}
      <div class="scale-row">${chips}</div>
    </div>`;
}

function renderCheckinForm() {
  const f = CV.form;
  const sug = checkinSuggestions();
  const prev = checkinsSorted().find(c => c.id !== CV.editId && c.date <= f.date);

  const measureInputs = MEASURES.map(m => {
    const p = prev && prev.measures ? prev.measures[m.key] : null;
    return `<label class="field"><span>${m.label} (cm)</span>
      <input class="input ci-m" data-key="${m.key}" type="text" inputmode="decimal"
        value="${f.measures[m.key] ?? ""}" placeholder="${p != null ? fmtNum(p, 1) : "—"}"></label>`;
  }).join("");

  return `
    <div class="card">
      <div class="row between">
        <span class="h2" style="margin:0">${CV.editId ? "Upravit check-in" : "Nový check-in"}</span>
        <button class="btn sm ghost" data-act="ci-cancel">Zpět</button>
      </div>
      <div class="input-row mt">
        <label class="field"><span>Datum</span>
          <input class="input" id="ciDate" type="date" value="${f.date}"></label>
        <label class="field"><span>Váha (${weightUnit()})</span>
          <input class="input" id="ciWeight" type="text" inputmode="decimal" value="${f.weight}"
            placeholder="${sug.weightKg != null ? fmtNum(kgOut(sug.weightKg), 1) : "—"}"></label>
      </div>
      ${sug.weightAvg != null ? `<p class="small" style="margin:-4px 0 0">7denní průměr váhy: <b style="color:var(--text)">${fmtWeight(sug.weightAvg)}</b></p>` : ""}
    </div>

    <div class="card">
      <div class="h2">Obvody <span class="small">(šedě je minulý check-in)</span></div>
      <div class="ci-measures">${measureInputs}</div>
    </div>

    <div class="card">
      <div class="h2">Jak se ti dařilo</div>
      <label class="field"><span>Dodržování plánu (%)</span>
        <input class="input" id="ciAdherence" type="text" inputmode="numeric" value="${f.adherence}"
          placeholder="${sug.adherence != null ? sug.adherence : "—"}"></label>
      ${sug.adherenceNote ? `<p class="small" style="margin:-6px 0 0">Podle appky: ${esc(sug.adherenceNote)}${sug.adherence != null ? ` (${sug.adherence} %)` : ""}</p>` : ""}
      ${SCALES.map(s => scaleRow(s.key, s.label, f.scales[s.key],
        s.key === "quality" && sug.quality ? `Z hodnocení tréninků vychází ${sug.quality}` : null)).join("")}
      <label class="field mt"><span>Poznámka pro trenéra</span>
        <textarea class="input" id="ciNote" rows="3" placeholder="jak ses cítil, co drhlo, na co se zeptat…">${esc(f.note)}</textarea></label>
    </div>

    <div class="row" style="gap:8px">
      ${CV.editId ? `<button class="btn danger" data-act="ci-del" data-id="${CV.editId}">Smazat</button>` : ""}
      <button class="btn primary grow" data-act="ci-save">Uložit check-in</button>
    </div>`;
}

/* ---- Akce ---- */
function openCheckinForm(id) {
  const c = id ? S.checkins.find(x => x.id === id) : null;
  const sug = checkinSuggestions();
  CV.editId = id || null;
  CV.form = c
    ? {
        date: c.date,
        weight: c.weightKg != null ? fmtNum(kgOut(c.weightKg), 1) : "",
        measures: Object.assign({}, c.measures),
        adherence: c.adherence != null ? String(c.adherence) : "",
        scales: Object.assign({}, c.scales),
        note: c.note || ""
      }
    : {
        date: todayStr(),
        weight: sug.weightKg != null ? fmtNum(kgOut(sug.weightKg), 1) : "",
        measures: {},
        adherence: sug.adherence != null ? String(sug.adherence) : "",
        scales: sug.quality ? { quality: sug.quality } : {},
        note: ""
      };
  render();
}

/* načte hodnoty z formuláře do CV.form (aby přežily překreslení) */
function captureCheckinForm() {
  if (!CV.form) return;
  const d = document.getElementById("ciDate");
  if (!d) return;
  CV.form.date = d.value || todayStr();
  CV.form.weight = document.getElementById("ciWeight").value.trim();
  CV.form.adherence = document.getElementById("ciAdherence").value.trim();
  CV.form.note = document.getElementById("ciNote").value;
  document.querySelectorAll(".ci-m").forEach(inp => {
    const v = parseDec(inp.value);
    if (isNaN(v)) delete CV.form.measures[inp.dataset.key];
    else CV.form.measures[inp.dataset.key] = v;
  });
}

function saveCheckin() {
  captureCheckinForm();
  const f = CV.form;
  const kg = f.weight ? kgIn(f.weight) : null;
  const adherence = f.adherence ? clamp(parseInt(f.adherence, 10) || 0, 0, 100) : null;
  const rec = {
    id: CV.editId || uid(),
    date: f.date,
    weightKg: kg,
    measures: f.measures,
    adherence,
    scales: f.scales,
    note: f.note.trim() || null
  };
  const hasSomething = kg != null || adherence != null || rec.note
    || Object.keys(rec.measures).length || Object.keys(rec.scales).length;
  if (!hasSomething) { toast("Vyplň aspoň jednu hodnotu", "err"); return; }

  if (CV.editId) {
    const i = S.checkins.findIndex(c => c.id === CV.editId);
    if (i >= 0) S.checkins[i] = rec;
  } else {
    S.checkins.push(rec);
  }
  if (kg != null) logBodyWeight(kg, rec.date); // váha se propíše i do grafu váhy
  CV.form = null; CV.editId = null;
  save();
  render();
  toast("Check-in uložen ✓", "ok");
}

/* Řádek ve stejném pořadí sloupců jako tabulka trenéra (tabulátory =
   po vložení do Sheetu se rozprostře do buněk). */
function checkinTsv(c) {
  const m = c.measures || {}, s = c.scales || {};
  const num = v => v == null ? "" : String(v).replace(".", ",");
  return [
    fmtDate(c.date), num(c.weightKg != null ? Math.round(kgOut(c.weightKg) * 10) / 10 : null),
    num(m.chest), num(m.waist), num(m.hips), num(m.glutes), num(m.arm), num(m.thigh), num(m.calf),
    num(c.adherence), num(s.energy), num(s.hunger), num(s.sleep), num(s.stress), num(s.quality),
    "", "", (c.note || "").replace(/\s+/g, " ")
  ].join("\t");
}

async function copyCheckin(id) {
  const c = S.checkins.find(x => x.id === id);
  if (!c) return;
  const row = checkinTsv(c);
  try {
    await navigator.clipboard.writeText(row);
    toast("Řádek zkopírován — vlož do tabulky ✓", "ok");
  } catch (e) {
    // fallback pro prohlížeče bez clipboard API (nebo bez oprávnění)
    openModal(`${modalTitle("Řádek pro tabulku")}
      <p class="small" style="margin:0 0 10px">Zkopírování do schránky se nepodařilo — označ a zkopíruj ručně.</p>
      <textarea class="input" rows="4" onclick="this.select()">${esc(row)}</textarea>`);
  }
}

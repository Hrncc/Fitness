/* ===== Postava — týdenní check-in + fotky postupu (v1.24) =====
   Dřív dvě samostatné stránky; teď jedna, protože odpovídají na stejnou
   otázku — mění se postava? Váha, obvody a pocity jdou do S (sync),
   fotky zůstávají jen v IndexedDB tohoto zařízení (photos.js). Fotku jde
   přidat rovnou k check-inu a obojí se potká na jedné časové ose.
   Řádek check-inu jde dál zkopírovat ve sloupcích tabulky (Sheet). */
"use strict";

const CV = {
  form: null,        // rozpracovaný check-in (null = jen výpis)
  editId: null,
  trendKey: "waist", // vybraný obvod v grafu trendu
  photoFile: null,   // fotka vybraná ve formuláři check-inu
  photoUrl: null     // její náhled (objectURL)
};

function renderBody() {
  // uvolnit objectURL z předchozího vykreslení (obrázky se vytvářejí znovu)
  PV.urls.forEach(u => URL.revokeObjectURL(u));
  PV.urls = [];
  if (CV.form) return renderCheckinForm();
  const photos = bodyPhotos();
  return bodyStatusHtml() + photoCompareHtml(photos) + measureTrendHtml() + bodyTimelineHtml(photos);
}

/* Fotky se načítají asynchronně — do té doby null a stránka se překreslí sama */
function bodyPhotos() {
  if (PV.items === null) {
    if (!PV.loading) {
      PV.loading = true;
      Photos.list().then(list => {
        PV.items = list;
        PV.loading = false;
        if (App.route.page === "body") render();
      }).catch(e => {
        PV.items = []; PV.loading = false;
        toast("Fotky se nepodařilo načíst: " + e.message, "err");
      });
    }
    return null;
  }
  return PV.items;
}

function bodyStatusHtml() {
  const since = daysSinceCheckin();
  const due = since === null || since >= 7;
  const text = since === null
    ? "Jednou týdně váha, obvody a pocity. S fotkou ukážou změnu, kterou samotná váha neukáže."
    : since >= 7
      ? `Poslední byl před ${since} dny — je na řadě další.`
      : `Poslední před ${since === 0 ? "chvílí" : since === 1 ? "1 dnem" : since + " dny"}. Další za ${7 - since} ${7 - since === 1 ? "den" : 7 - since < 5 ? "dny" : "dní"}.`;
  return `
    <div class="card${due ? " item-hero" : ""}">
      ${cardHead("clipboard", "Týdenní check-in", `<span class="badge ${due ? "green" : "neutral"}">${
        since === null ? "první" : due ? "na řadě" : `za ${7 - since} d`}</span>`)}
      <p class="muted" style="margin:0 0 14px">${text}</p>
      <div class="row" style="gap:8px">
        <button class="btn primary grow" data-act="ci-new">${ic("plus", 18, 2.4)} Nový check-in</button>
        <button class="btn tonal" data-act="ph-add">${ic("camera", 18)} Fotka</button>
      </div>
      <input type="file" id="photoAddInput" accept="image/*" style="display:none">
    </div>`;
}

/* porovnání dvou fotek — výchozí nejstarší vs. nejnovější */
function photoCompareHtml(items) {
  if (!items || items.length < 2) return "";
  const ids = items.map(p => p.id);
  if (!ids.includes(PV.cmpA)) PV.cmpA = items[items.length - 1].id; // nejstarší
  if (!ids.includes(PV.cmpB)) PV.cmpB = items[0].id;                // nejnovější
  const a = items.find(p => p.id === PV.cmpA), b = items.find(p => p.id === PV.cmpB);
  const opts = sel => items.map(p =>
    `<option value="${p.id}"${p.id === sel ? " selected" : ""}>${fmtDate(p.date)}</option>`).join("");
  const days = Math.round((parseDate(b.date) - parseDate(a.date)) / 86400000);
  return `
    <div class="card">
      ${cardHead("camera", "Před a po", days ? `<span class="small">${Math.abs(days)} dní</span>` : "")}
      <div class="photo-cmp">
        <div>
          <img src="${photoUrl(a)}" alt="Fotka ${fmtDate(a.date)}" data-act="ph-detail" data-id="${a.id}">
          <select class="input" data-change="ph-cmp-a">${opts(PV.cmpA)}</select>
        </div>
        <div>
          <img src="${photoUrl(b)}" alt="Fotka ${fmtDate(b.date)}" data-act="ph-detail" data-id="${b.id}">
          <select class="input" data-change="ph-cmp-b">${opts(PV.cmpB)}</select>
        </div>
      </div>
    </div>`;
}

/* ---- Trend obvodů ---- */
function measureTrendHtml() {
  const list = checkinsSorted();
  const has = key => list.some(c => c.measures && c.measures[key] != null);
  const keys = MEASURES.filter(m => has(m.key));
  if (!keys.length) return "";
  if (!has(CV.trendKey)) CV.trendKey = keys[0].key;
  const series = list.slice().reverse()
    .filter(c => c.measures && c.measures[CV.trendKey] != null)
    .map(c => ({ date: c.date, value: c.measures[CV.trendKey] }));
  const chips = keys.map(m =>
    `<button class="chip${m.key === CV.trendKey ? " on" : ""}" data-act="ci-trend" data-key="${m.key}">${m.label}</button>`).join("");
  const d = series.length >= 2 ? series[series.length - 1].value - series[0].value : null;
  return `
    <div class="card">
      ${cardHead("trend", "Obvody", d != null && Math.abs(d) >= 0.05
        ? `<span class="small">od ${fmtDate(series[0].date)} <b style="color:var(--text)">${d > 0 ? "+" : ""}${fmtNum(d, 1)} cm</b></span>` : "")}
      <div class="chips scroll">${chips}</div>
      ${lineChart(series, { unit: " cm" })}
    </div>`;
}

/* ---- Časová osa: check-iny a fotky podle data ---- */
function bodyTimelineHtml(photos) {
  const list = checkinsSorted();
  const ph = photos || [];
  const dates = [...new Set(list.map(c => c.date).concat(ph.map(p => p.date)))].sort().reverse();
  if (!dates.length) {
    return photos === null ? `<div class="card"><div class="spin" style="margin:18px auto"></div></div>` : "";
  }
  const items = dates.map(date => {
    const cis = list.filter(c => c.date === date).map(c => {
      const i = list.indexOf(c);
      const prev = list[i + 1];
      const parts = [];
      if (c.weightKg != null) {
        const dd = prev && prev.weightKg != null ? kgOut(c.weightKg) - kgOut(prev.weightKg) : null;
        parts.push(`${fmtWeight(c.weightKg)}${dd != null && Math.abs(dd) >= 0.05 ? ` <span class="small">(${dd > 0 ? "+" : ""}${fmtNum(dd, 1)})</span>` : ""}`);
      }
      const waist = c.measures && c.measures.waist;
      if (waist != null) {
        const dd = prev && prev.measures && prev.measures.waist != null ? waist - prev.measures.waist : null;
        parts.push(`pas ${fmtNum(waist, 1)} cm${dd != null && Math.abs(dd) >= 0.05 ? ` <span class="small">(${dd > 0 ? "+" : ""}${fmtNum(dd, 1)})</span>` : ""}`);
      }
      if (c.adherence != null) parts.push(`${c.adherence} %`);
      return `
        <div class="list-item" data-act="ci-edit" data-id="${c.id}">
          <span class="card-ic" style="width:30px;height:30px">${ic("clipboard", 15)}</span>
          <div class="grow">
            <div class="name" style="font-size:14px">Check-in</div>
            <div class="small">${parts.join(" · ") || "bez hodnot"}</div>
          </div>
          <button class="iconbtn sm soft" data-act="ci-copy" data-id="${c.id}" aria-label="Kopírovat řádek">${ic("copy", 15)}</button>
        </div>`;
    }).join("");
    const pics = ph.filter(p => p.date === date);
    return `
      <div class="tl-item">
        <div class="tl-date">${fmtDate(date)}</div>
        ${cis}
        ${pics.length ? `<div class="tl-photos">${pics.map(p =>
          `<img src="${photoUrl(p)}" alt="Fotka ${fmtDate(p.date)}" loading="lazy" data-act="ph-detail" data-id="${p.id}">`).join("")}</div>` : ""}
      </div>`;
  }).join("");
  return `
    <div class="card">
      ${cardHead("calendar", "Historie", `<span class="small">${list.length} check-inů · ${ph.length} fotek</span>`)}
      ${items}
      <p class="small mt" style="margin-bottom:0">Fotky zůstávají jen v tomto zařízení — nejdou do cloud syncu ani do zálohy.
        Stáhneš je v detailu fotky. Ikona kopírování dá řádek check-inu do schránky ve sloupcích tabulky.</p>
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
        value="${f.measures[m.key] != null ? String(f.measures[m.key]).replace(".", ",") : ""}" placeholder="${p != null ? fmtNum(p, 1) : "—"}"></label>`;
  }).join("");

  return `
    <div class="card">
      <div class="row between" style="margin-bottom:14px">
        <span class="h2" style="margin:0">${CV.editId ? "Upravit check-in" : "Nový check-in"}</span>
        <button class="btn sm ghost" data-act="ci-cancel">${ic("chevL", 16, 2.4)} Zpět</button>
      </div>
      <div class="input-row">
        <label class="field"><span>Datum</span>
          <input class="input" id="ciDate" type="date" value="${f.date}"></label>
        <label class="field"><span>Váha (${weightUnit()})</span>
          <input class="input" id="ciWeight" type="text" inputmode="decimal" value="${f.weight}"
            placeholder="${sug.weightKg != null ? fmtNum(kgOut(sug.weightKg), 1) : "—"}"></label>
      </div>
      ${sug.weightAvg != null ? `<p class="small" style="margin:-4px 0 0">7denní průměr váhy: <b style="color:var(--text)">${fmtWeight(sug.weightAvg)}</b></p>` : ""}
    </div>

    <div class="card">
      ${cardHead("target", "Obvody", `<span class="small">šedě minulý check-in</span>`)}
      <div class="ci-measures">${measureInputs}</div>
    </div>

    <div class="card">
      ${cardHead("spark", "Jak se ti dařilo")}
      <label class="field"><span>Dodržování plánu (%)</span>
        <input class="input" id="ciAdherence" type="text" inputmode="numeric" value="${f.adherence}"
          placeholder="${sug.adherence != null ? sug.adherence : "—"}"></label>
      ${sug.adherenceNote ? `<p class="small" style="margin:-6px 0 0">Podle appky: ${esc(sug.adherenceNote)}${sug.adherence != null ? ` (${sug.adherence} %)` : ""}</p>` : ""}
      ${SCALES.map(s => scaleRow(s.key, s.label, f.scales[s.key],
        s.key === "quality" && sug.quality ? `Z hodnocení tréninků vychází ${sug.quality}` : null)).join("")}
      <label class="field mt"><span>Poznámka</span>
        <textarea class="input" id="ciNote" rows="3" placeholder="jak ses cítil, co drhlo, co příště jinak…">${esc(f.note)}</textarea></label>
    </div>

    <div class="card">
      ${cardHead("camera", "Fotka", `<span class="small">jen v tomto zařízení</span>`)}
      ${CV.photoUrl ? `<img class="ci-photo" src="${CV.photoUrl}" alt="Náhled fotky">`
        : `<p class="small" style="margin:-4px 0 12px">Foť se za stejných podmínek — ráno, stejné světlo, stejný úhel.</p>`}
      <input type="file" id="ciPhotoInput" accept="image/*" style="display:none">
      <button class="btn tonal full${CV.photoUrl ? " mt" : ""}" data-act="ci-photo">${ic("camera", 18)} ${CV.photoUrl ? "Vyměnit fotku" : "Přidat fotku"}</button>
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
  const photo = CV.photoFile;
  CV.form = null; CV.editId = null;
  clearCheckinPhoto();
  save();
  render();
  toast(photo ? "Check-in uložen, ukládám fotku…" : "Check-in uložen ✓", "ok");
  // fotka jde do IndexedDB se stejným datem jako check-in — na časové ose se potkají
  if (photo) {
    Photos.add(photo, rec.date, "check-in").then(() => {
      PV.items = null;
      if (App.route.page === "body") render();
      toast("Check-in i fotka uloženy ✓", "ok");
    }).catch(e => toast("Fotku se nepodařilo uložit: " + e.message, "err"));
  }
}

/* fotka vybraná ve formuláři check-inu (náhled přes objectURL) */
function setCheckinPhoto(file) {
  clearCheckinPhoto();
  CV.photoFile = file;
  CV.photoUrl = URL.createObjectURL(file);
}
function clearCheckinPhoto() {
  if (CV.photoUrl) URL.revokeObjectURL(CV.photoUrl);
  CV.photoFile = null;
  CV.photoUrl = null;
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

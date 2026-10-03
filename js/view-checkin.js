/* ===== Pokrok → Tělo: váha, check-in, fotky a obvody =====
   Odpovídá na otázku „mění se postava?". Váha, obvody a pocity jdou do S
   (sync), fotky zůstávají jen v IndexedDB tohoto zařízení (photos.js).
   Fotku jde přidat rovnou k check-inu a obojí se potká na jedné časové ose.
   Formulář check-inu je samostatná stránka (page "checkin") se šipkou zpět.
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
  const photos = bodyPhotos();
  return bodyWeightHtml() + checkinStatusHtml() + photoCompareHtml(photos) + measureTrendHtml() + bodyTimelineHtml(photos);
}

function bodyVisible() {
  return App.route.tab === "progress" && !App.route.page && PG.seg === "body";
}

/* Fotky se načítají asynchronně — do té doby null a stránka se překreslí sama */
function bodyPhotos() {
  if (PV.items === null) {
    if (!PV.loading) {
      PV.loading = true;
      Photos.list().then(list => {
        PV.items = list;
        PV.loading = false;
        if (bodyVisible()) render();
      }).catch(e => {
        PV.items = []; PV.loading = false;
        toast("Fotky se nepodařilo načíst: " + e.message, "err");
      });
    }
    return null;
  }
  return PV.items;
}

/* ---- Váha: 7denní průměr, změna a graf ---- */
function bodyWeightHtml() {
  const t = todayStr();
  const addBtn = `<button class="btn sm" data-act="bw-open" data-date="${t}">${ic("plus", 16, 2.4)} Zapsat</button>`;
  if (!S.bodyLog.length) {
    return sec("Váha", `<div class="card"><p class="muted" style="margin:0">Zatím žádné vážení. Stačí ráno jedno číslo — průměr za 7 dní pak ukáže skutečný trend.</p></div>`, { right: addBtn });
  }
  const avg = movingAvgAt(S.bodyLog, t);
  const latest = lastBodyWeight();
  const shown = avg != null ? avg : latest.weightKg;
  const wk = movingAvgAt(S.bodyLog, addDays(t, -7));
  const mo = movingAvgAt(S.bodyLog, addDays(t, -30));
  const dW = avg != null && wk != null ? kgOut(avg) - kgOut(wk) : null;
  const dM = avg != null && mo != null ? kgOut(avg) - kgOut(mo) : null;

  const days = PG.wRange === "all" ? null : Number(PG.wRange);
  const from = days ? addDays(t, -(days - 1)) : "";
  const inRange = S.bodyLog.filter(b => b.date >= from);
  const wl = inRange.length >= 2 ? inRange : S.bodyLog;
  const maSeries = wl.map(b => {
    const v = movingAvgAt(S.bodyLog, b.date);
    return { date: b.date, value: v == null ? null : Math.round(kgOut(v) * 10) / 10 };
  });
  const rawSeries = wl.map(b => ({ date: b.date, value: Math.round(kgOut(b.weightKg) * 10) / 10 }));
  const chg = (v, lbl) => v == null ? "" : `<span class="delta${v > 0.04 ? " up" : ""}">${fmtSigned(v, 1)} ${weightUnit()} ${lbl}</span>`;
  return sec("Váha", `
    <div class="card">
      <div class="idx-head">
        <div>
          <div class="cap">${avg != null ? "Průměr posledních 7 dní" : `Poslední vážení · ${relDay(latest.date)}`}</div>
          <div class="hero-fig" style="margin-top:6px">${fmtNum(kgOut(shown), 1)}<small>${weightUnit()}</small></div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;padding-bottom:4px">${chg(dW, "za týden")}${chg(dM, "za 30 dní")}</div>
      </div>
      ${segHtml([["30", "30 dní"], ["90", "90 dní"], ["all", "Vše"]], PG.wRange, "pg-wrange", "r", "sm")}
      <div class="mt2">${lineChart(maSeries, { raw: rawSeries, unit: " " + weightUnit() })}</div>
      <div class="chart-cap">Čára = 7denní průměr, tečky = jednotlivá vážení</div>
    </div>`, { right: addBtn });
}

/* ---- Check-in: stav a akce ---- */
function checkinStatusHtml() {
  const since = daysSinceCheckin();
  const due = since === null || since >= 7;
  const last = lastCheckin();
  const text = since === null
    ? "Jednou týdně váha, obvody a pocity. S fotkou ukážou změnu, kterou samotná váha neukáže."
    : due ? `Poslední byl ${relDay(last.date)} — je na řadě další.`
    : `Poslední ${relDay(last.date)}. Další za ${7 - since} ${plural(7 - since, "den", "dny", "dní")}.`;
  return sec("Check-in", `
    <div class="card">
      <p class="muted" style="margin:0 0 16px">${text}</p>
      <div class="btn-row">
        <button class="btn${due ? " primary" : ""}" data-act="ci-new">${ic("plus", 18, 2.4)} Nový check-in</button>
        <button class="btn fit" data-act="ph-add">${ic("camera", 18)} Fotka</button>
      </div>
      <input type="file" id="photoAddInput" accept="image/*" style="display:none">
    </div>`, { right: `<span class="badge${due ? " green" : ""}">${since === null ? "první" : due ? "na řadě" : `za ${7 - since} d`}</span>` });
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
  return sec("Před a po", `
    <div class="photo-cmp">
      <div>
        <img src="${photoUrl(a)}" alt="Fotka ${fmtDate(a.date)}" data-act="ph-detail" data-id="${a.id}">
        <select class="input" data-change="ph-cmp-a">${opts(PV.cmpA)}</select>
      </div>
      <div>
        <img src="${photoUrl(b)}" alt="Fotka ${fmtDate(b.date)}" data-act="ph-detail" data-id="${b.id}">
        <select class="input" data-change="ph-cmp-b">${opts(PV.cmpB)}</select>
      </div>
    </div>`, { sub: days ? `${Math.abs(days)} ${plural(Math.abs(days), "den", "dny", "dní")} mezi fotkami` : "" });
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
  return sec("Obvody", `
    <div class="card">
      <div class="chips scroll">${chips}</div>
      ${lineChart(series, { unit: " cm" })}
    </div>`, { sub: d != null && Math.abs(d) >= 0.05 ? `od ${fmtShort(series[0].date)} ${fmtSigned(d, 1)} cm` : "" });
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
        parts.push(`${fmtWeight(c.weightKg)}${dd != null && Math.abs(dd) >= 0.05 ? ` (${fmtSigned(dd, 1)})` : ""}`);
      }
      const waist = c.measures && c.measures.waist;
      if (waist != null) {
        const dd = prev && prev.measures && prev.measures.waist != null ? waist - prev.measures.waist : null;
        parts.push(`pas ${fmtNum(waist, 1)} cm${dd != null && Math.abs(dd) >= 0.05 ? ` (${fmtSigned(dd, 1)})` : ""}`);
      }
      if (c.adherence != null) parts.push(`${c.adherence} %`);
      return `
        <div class="list-item" data-act="ci-edit" data-id="${c.id}">
          <span class="chev" style="color:var(--text2)">${ic("clipboard", 19)}</span>
          <div class="grow">
            <div class="name">Check-in</div>
            <div class="li-sub">${parts.join(" · ") || "bez hodnot"}</div>
          </div>
          <button class="iconbtn sm soft" data-act="ci-copy" data-id="${c.id}" aria-label="Kopírovat řádek">${ic("copy", 15)}</button>
        </div>`;
    }).join("");
    const pics = ph.filter(p => p.date === date);
    return `
      <div class="tl-item">
        <div class="tl-date">${capFirst(`${CZ_DAYS_FULL[parseDate(date).getDay()]} ${fmtDate(date)}`)}</div>
        ${cis}
        ${pics.length ? `<div class="tl-photos">${pics.map(p =>
          `<img src="${photoUrl(p)}" alt="Fotka ${fmtDate(p.date)}" loading="lazy" data-act="ph-detail" data-id="${p.id}">`).join("")}</div>` : ""}
      </div>`;
  }).join("");
  return sec("Historie", `
    <div class="card" style="padding-top:8px;padding-bottom:8px">${items}</div>
    <p class="small" style="margin:4px 4px 0">Fotky zůstávají jen v tomto zařízení — nejdou do cloud syncu ani do zálohy.
      Ikona kopírování dá řádek check-inu do schránky ve sloupcích tabulky.</p>`,
    { sub: `${list.length} ${plural(list.length, "check-in", "check-iny", "check-inů")} · ${ph.length} ${plural(ph.length, "fotka", "fotky", "fotek")}` });
}

/* ---- Formulář (stránka „checkin") ---- */
function scaleRow(key, label, value, hint) {
  const chips = Array.from({ length: 10 }, (_, k) => k + 1).map(n =>
    `<button class="scale-chip${value === n ? " on" : ""}" data-act="ci-scale" data-key="${key}" data-val="${n}">${n}</button>`).join("");
  return `
    <div style="margin-top:16px">
      <div class="row between" style="margin:0 2px 8px"><span class="cap" style="font-weight:600">${label}</span>
        ${hint ? `<span class="small">${esc(hint)}</span>` : ""}</div>
      <div class="scale-row">${chips}</div>
    </div>`;
}

function renderCheckinForm() {
  const f = CV.form;
  if (!f) return `<div class="card"><div class="empty-note">Check-in není rozepsaný.</div></div>`;
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
      <div class="input-row">
        <label class="field"><span>Datum</span>
          <input class="input" id="ciDate" type="date" value="${f.date}"></label>
        <label class="field"><span>Váha (${weightUnit()})</span>
          <input class="input" id="ciWeight" type="text" inputmode="decimal" value="${f.weight}"
            placeholder="${sug.weightKg != null ? fmtNum(kgOut(sug.weightKg), 1) : "—"}"></label>
      </div>
      ${sug.weightAvg != null ? `<p class="small" style="margin:-4px 2px 0">7denní průměr váhy: <b style="color:var(--text)">${fmtWeight(sug.weightAvg)}</b></p>` : ""}
    </div>

    ${sec("Obvody", `<div class="card"><div class="ci-measures">${measureInputs}</div></div>`, { sub: "šedě minulý check-in" })}

    ${sec("Jak se ti dařilo", `
    <div class="card">
      <label class="field"><span>Dodržování plánu (%)</span>
        <input class="input" id="ciAdherence" type="text" inputmode="numeric" value="${f.adherence}"
          placeholder="${sug.adherence != null ? sug.adherence : "—"}"></label>
      ${sug.adherenceNote ? `<p class="small" style="margin:-6px 2px 0">Podle appky: ${esc(sug.adherenceNote)}${sug.adherence != null ? ` (${sug.adherence} %)` : ""}</p>` : ""}
      ${SCALES.map(s => scaleRow(s.key, s.label, f.scales[s.key],
        s.key === "quality" && sug.quality ? `z tréninků ${sug.quality}` : null)).join("")}
      <label class="field" style="margin:18px 0 0"><span>Poznámka</span>
        <textarea class="input" id="ciNote" rows="3" placeholder="jak ses cítil, co drhlo, co příště jinak…">${esc(f.note)}</textarea></label>
    </div>`)}

    ${sec("Fotka", `
    <div class="card">
      ${CV.photoUrl ? `<img class="ci-photo" src="${CV.photoUrl}" alt="Náhled fotky">`
        : `<p class="muted" style="margin:0 0 14px">Foť se za stejných podmínek — ráno, stejné světlo, stejný úhel.</p>`}
      <input type="file" id="ciPhotoInput" accept="image/*" style="display:none">
      <button class="btn full${CV.photoUrl ? " mt" : ""}" data-act="ci-photo">${ic("camera", 18)} ${CV.photoUrl ? "Vyměnit fotku" : "Přidat fotku"}</button>
    </div>`, { sub: "zůstane jen v tomto zařízení" })}

    <div class="mt2">
      <button class="btn primary full" data-act="ci-save">Uložit check-in</button>
      ${CV.editId ? `<button class="btn text danger full" data-act="ci-del" data-id="${CV.editId}">Smazat check-in</button>`
        : `<button class="btn text full" data-act="ci-cancel">Zrušit</button>`}
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
  App.route = { tab: App.route.tab, page: "checkin" };
  closeModal();
  render({ top: true });
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
  if (App.route.page === "checkin") App.route.page = null;
  save();
  render({ top: true });
  toast(photo ? "Check-in uložen, ukládám fotku…" : "Check-in uložen ✓", "ok");
  // fotka jde do IndexedDB se stejným datem jako check-in — na časové ose se potkají
  if (photo) {
    Photos.add(photo, rec.date, "check-in").then(() => {
      PV.items = null;
      if (bodyVisible()) render();
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

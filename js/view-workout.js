/* ===== Obrazovka: Trénink — start, gym mód, historie a rekordy =====
   Barevná logika: volt = hlavní akce a hotový cvik, zlatá = rekordy,
   partie jen jako proužek nebo tečka, bílá = vybraný stav. */
"use strict";

const CARDIO_SPORTS = ["Běh", "Chůze", "Kolo", "Plavání", "Veslování", "Švihadlo", "Eliptický", "Turistika", "Jiné"];

const WV = {
  date: todayStr(),           // den, do kterého se zapisuje (i zpětně/dopředně)
  openIdx: null,              // rozbalený cvik v aktivní session (akordeon)
  counterOpen: false,         // counter partií: pruh (false) | detail s cviky (true)
  pickerIndex: null,          // null = přidání cviku, číslo = výměna na indexu
  editSet: null,              // {i, j} — opravovaná série v otevřeném cviku
  cardioEdit: null,           // id upravovaného kardia (null = nový zápis)
  sportChoice: CARDIO_SPORTS[0],
  sw: null,                   // běžící stopky u výdrže {i, start}
  lastFinish: null            // pořadí cviků z dokončeného tréninku (shrnutí → šablona)
};

function renderWorkout() {
  return S.activeSession ? renderLive() : renderWorkoutStart();
}

function setWordTop(n) { return plural(n, "série", "série", "sérií"); }
function sessionSets(s) { return (s.entries || []).reduce((n, e) => n + (e.sets || []).length, 0); }

/* Velký titulek. Při probíhajícím tréninku nese jeho název a průběh —
   v posilovně je místo na obrazovce nejcennější. Bez tréninku je vpravo
   pilulka s datem, do kterého se zapisuje. */
function workoutHead() {
  const a = S.activeSession;
  if (a && a.type === "weights" && a.editOf) {
    const sets = sessionSets(a);
    return {
      title: sessionLabel(a),
      sub: `Úprava uloženého tréninku · <b>${a.entries.length}</b> cviků · <b>${sets}</b> ${setWordTop(sets)}`
    };
  }
  if (a && a.type === "weights") {
    const total = a.entries.length;
    const done = a.entries.filter(e => e.done).length;
    const sets = sessionSets(a);
    const dateInfo = a.date !== todayStr() ? `${fmtShort(a.date)} · ` : a.startedAt ? `${startedLabel(a)} · ` : "";
    const pct = total ? done / total * 100 : 0;
    return {
      title: sessionLabel(a),
      cls: "live",   // v posilovně mají přednost čísla série, ne název tréninku
      right: `<button class="iconbtn" data-act="lv-min" aria-label="Zmenšit trénink do lišty">${ic("chevD", 22, 2.2)}</button>`,
      sub: `${dateInfo}<b>${done}/${total}</b> cviků · <b>${sets}</b> ${setWordTop(sets)}`,
      below: `<div class="page-prog"><i style="width:${pct.toFixed(0)}%"></i></div>`
    };
  }
  const today = todayStr();
  const lbl = WV.date === today ? "dnes" : WV.date === addDays(today, -1) ? "včera" : fmtShort(WV.date);
  return {
    title: "Trénink",
    right: `${WV.date !== today ? `<button class="btn text" data-act="w-date-today" style="min-height:32px;padding:4px">Dnes</button>` : ""}
      <label class="date-pill">${ic("calendar", 14)}<span>${lbl}</span>
        <input type="date" data-change="w-date" value="${WV.date}" aria-label="Den zápisu tréninku"></label>`
  };
}

/* ---- Start (v5.0): trénink na řadě s dnešními cíli, rutiny, prázdný trénink, kardio ---- */
function renderWorkoutStart() {
  const day = WV.date;
  const today = todayStr();
  const next = nextTemplate();
  const out = [];

  /* zapsané tréninky vybraného dne */
  const daySessions = sessionsOn(day);
  if (daySessions.length) {
    out.push(sec(day === today ? "Dnes zapsáno" : `Zapsáno ${fmtShort(day)}`,
      `<div class="card rows">${daySessions.map(sessionRowHtml).join("")}</div>`));
  }

  out.push(nextCardHtml({ day }));
  out.push(`<div class="start-two">
      <button class="btn" data-act="w-begin" data-template="custom">${ic("plus", 16, 2.4)} Prázdný trénink</button>
      <button class="btn" data-act="w-cardio"><i class="p-dot" style="background:var(--p-cardio)"></i> Kardio</button>
    </div>`);

  /* ostatní rutiny — během silového bloku jen jeho šablony, staré zůstávají ve Šablonách */
  const rest = S.templates.filter(t => (!next || t.id !== next.id) && (!blockOn(day) || blockDayKey(t.id)));
  if (rest.length) {
    out.push(sec("Rutiny", `<div class="card rows">${rest.map(t => {
      const n = t.exercises.filter(getExercise).length;
      const last = lastTemplateSession(t.id);
      const counts = {};
      for (const id of t.exercises) { const c = exCategory(id); if (c) counts[c] = (counts[c] || 0) + 1; }
      return `<button class="rt-row" data-act="rt-open" data-id="${t.id}">
          <span class="grow"><span class="name">${esc(t.name)}</span>
            <span class="small">${n} ${plural(n, "cvik", "cviky", "cviků")}${last ? ` · naposledy ${relDay(last.date)}` : ""}</span></span>
          ${catPipsHtml(counts)}${ic("chevR", 16, 2.2)}</button>`;
    }).join("")}</div>`, { right: secLink("Upravit", "menu", `data-page="templates"`) }));
  }

  out.push(adaptCardHtml());
  out.push(freshnessHtml());

  /* poslední tréninky */
  const recent = S.sessions.filter(s => !(daySessions.includes(s)))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id))).slice(0, 3);
  if (recent.length) {
    out.push(sec("Naposledy", `<div class="card rows">${recent.map(sessionRowHtml).join("")}</div>`,
      { right: secLink("Historie", "menu", `data-page="history"`) }));
  }

  out.push(`<div class="quick-links">
      <button class="start-opt" data-act="menu" data-page="records">${ic("trophy", 15)}<span>Rekordy</span></button>
      <button class="start-opt" data-act="menu" data-page="templates">${ic("list", 15)}<span>Šablony</span></button>
      <button class="start-opt" data-act="menu" data-page="exlib">${ic("book", 15)}<span>Cviky</span></button>
    </div>`);
  return out.join("");
}

/* ---- Čerstvost partií (v4.0) ----
   Kolik dní od poslední série na každé partii — pomůže vybrat, co dnes.
   Dnes a včera = regeneruje (šedě), přes 14 dní zlatě (něco utíká, stejný
   práh jako „naposledy" v Pokroku). Pořadí podle těla (CAT_ORDER), core se
   počítá i z přepínače. Záměrně jen dny, žádné procento regenerace —
   to by předstíralo přesnost, kterou z dat neznáme. */
function freshnessHtml() {
  const last = partLastTrained();
  if (!Object.keys(last).length) return "";
  const today = todayStr();
  const cells = CAT_ORDER.map(c => {
    const d = last[c] ? daysBetween(last[c], today) : null;
    const cls = d == null ? " none" : d <= 1 ? " rest" : d > 14 ? " stale" : "";
    const val = d == null ? "—" : d <= 0 ? "dnes" : d === 1 ? "včera" : `${d} d`;
    return `<div class="fr-c${cls}"><i style="background:${catColor(c)}"></i><b>${cls === " stale" ? ic("alert", 12, 2.2) : ""}${val}</b><span>${c}</span></div>`;
  }).join("");
  // obal nese container query: při větším textu se 7 sloupců zalomí na 4 + 3
  return sec("Čerstvost partií", `<div class="card fr-wrap"><div class="fr">${cells}</div></div>`,
    { sub: "dny od poslední série · šedě regeneruje" });
}

/* Řádek tréninku v seznamu: datum, název, čísla, pokrytí partií, rekordy */
function sessionRowHtml(s) {
  const d = parseDate(s.date);
  const date = `<div class="sess-date"><b>${d.getDate()}</b><span>${CZ_MONTHS_SHORT[d.getMonth()]}</span></div>`;
  if (s.type === "cardio") {
    const c = s.entries[0] || {};
    return `<div class="list-item sess-row" data-act="w-detail" data-id="${s.id}">
      ${date}
      <div class="grow">
        <div class="name row" style="gap:8px"><i class="p-dot" style="background:var(--p-cardio)"></i>${esc(cardioLabel(c))}</div>
        <div class="li-sub">${fmtNum(c.duration)} min${c.distance ? ` · ${fmtNum(c.distance, 2)} km` : ""}${c.pace ? ` · ${fmtNum(c.pace, 2)} min/km` : ""}</div>
      </div>
      <span class="chev">${ic("chevR", 18)}</span>
    </div>`;
  }
  const sets = sessionSets(s);
  const vol = fmtVolume(sessionVolume(s));
  const prs = sessionPRCount(s);
  return `<div class="list-item sess-row" data-act="w-detail" data-id="${s.id}">
    ${date}
    <div class="grow">
      <div class="name">${esc(sessionLabel(s))}</div>
      <div class="li-sub">${s.startedAt ? `${fmtTime(s.startedAt)} · ` : ""}${s.entries.length} cviků · ${sets} ${setWordTop(sets)}${sessionVolume(s) ? ` · ${vol.val} ${vol.unit}` : ""}</div>
      ${catPipsHtml(sessionCatSets(s), s.core === true)}
    </div>
    ${prs ? `<span class="badge yellow">${ic("trophy", 12, 2.2)} ${prs}</span>` : ""}
    <span class="chev">${ic("chevR", 18)}</span>
  </div>`;
}

/* Kolik sérií v tréninku přineslo rekord (libovolného druhu) */
function sessionPRCount(s) {
  return sessionRecordEvents(s).length;
}

/* ---- Kalendář měsíce: proužky partií, kardio, tečka = kalorie v cíli ----
   Stránka Historie (sdílí SV.calY/calM s měsícem na Dnes).
   Klepnutí na den → openDaySummary() se zápisem do toho dne. */
function monthCalendarCardHtml() {
  const cal = calendarHtml(SV.calY, SV.calM, ds => {
    const bars = dayCatColors(ds);
    const f = calorieGoalMet(ds);
    if (!bars.length && !f) return null;
    return { cls: bars.length ? "trained" : "", bars, corner: f };
  }, "sum-cal-day");
  return `
    <div class="card">${cal}
      <div class="cal-legend small" style="margin-top:14px">
        ${CAT_ORDER.map(c => `<span><i class="dot" style="background:${catColor(c)}"></i>${c}</span>`).join("")}
        <span><i class="dot" style="background:var(--p-cardio)"></i>kardio</span>
        <span><i class="dot" style="background:var(--mac1)"></i>kalorie v cíli</span>
      </div>
    </div>`;
}

/* ---- Historie: kalendář a tréninky měsíce ---- */
function renderHistory() {
  const y = SV.calY, m = SV.calM;
  const from = dateStr(new Date(y, m, 1)), to = dateStr(new Date(y, m + 1, 0));
  const list = S.sessions.filter(s => s.date >= from && s.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
  const w = list.filter(s => s.type === "weights");
  const vol = fmtVolume(w.reduce((v, s) => v + sessionVolume(s), 0));
  const sets = w.reduce((n, s) => n + sessionSets(s), 0);
  return `
    ${monthCalendarCardHtml()}
    ${sec(capFirst(CZ_MONTHS[m]), list.length ? `
      <div class="card">
        <div class="stats">
          ${statHtml(w.length, plural(w.length, "trénink", "tréninky", "tréninků"))}
          ${statHtml(fmtNum(sets), setWordTop(sets))}
          ${statHtml(`${vol.val}<small>${vol.unit}</small>`, "objem")}
        </div>
      </div>
      <div class="card rows">${list.map(sessionRowHtml).join("")}</div>`
      : `<div class="card"><div class="empty-note" style="padding:12px">V tomhle měsíci nic. Klepni na den v kalendáři a zapiš trénink zpětně.</div></div>`)}`;
}

/* ---- Zobrazení série podle druhu cviku ----
   weight: 10 × 45 kg · bw: 12 × vl. váha / 10 × +10 kg · time: 0:45 */
function setValHtml(exId, st) {
  const k = exKind(exId);
  if (k === "time") return fmtClock(st.reps);
  if (k === "bw") return `${fmtNum(st.reps)}<span>×</span>${st.weight ? "+" + fmtWeight(st.weight) : "vl. váha"}`;
  return `${fmtNum(st.reps)}<span>×</span>${fmtWeight(st.weight)}`;
}
function setShort(exId, st) {
  const k = exKind(exId);
  if (k === "time") return fmtClock(st.reps);
  if (k === "bw") return st.weight ? `${st.reps}×+${fmtNum(kgOut(st.weight), 1)}` : `${st.reps}`;
  return `${st.reps}×${fmtNum(kgOut(st.weight), 1)}`;
}
function setsSummary(exId, sets) {
  const txt = sets.map(st => setShort(exId, st)).join(" · ");
  const k = exKind(exId);
  return k === "weight" ? `${txt} ${weightUnit()}` : k === "bw" ? `${txt} opak.` : txt;
}
/* „3 × 8–12" (u výdrže v sekundách) */
function planText(t, exId) {
  if (!t || !t.sets) return "";
  const range = t.lo && t.hi ? (t.lo === t.hi ? `${t.lo}` : `${t.lo}–${t.hi}`) : "";
  return `${t.sets} × ${range}${range && exKind(exId) === "time" ? " s" : ""}`.trim().replace(/ ×$/, " série");
}
/* cíl cviku v probíhajícím tréninku: uložený při startu, jinak plán šablony */
function entryTarget(a, entry) {
  if (entry.target !== undefined) return entry.target;
  return tplPlan(getTemplate(a.templateUsed), entry.exerciseId);
}
/* pauza po sérii: z plánu cviku, jinak výchozí z Nastavení */
function entryRest(a, entry) {
  const t = a && entry ? entryTarget(a, entry) : null;
  return (t && t.rest) || Settings.get().restSeconds || 0;
}
function currentRestSeconds() {
  const a = S.activeSession;
  const i = a && a.type === "weights" && a.entries.length ? (ensureRows(a), liveCurrent(a)) : -1;
  const e = i >= 0 ? a.entries[i] : null;
  return e ? entryRest(a, e) : (Settings.get().restSeconds || 0);
}
function youtubeUrl(exId) {
  const e = getExercise(exId);
  const q = (e && (e.nameEn || e.name)) || exName(exId);
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q + " technique");
}

/* Připnutá poznámka ke cviku (nastavení stroje, úchop…) — patří cviku, ne
   tréninku, takže se ukáže pokaždé. Ukládá se do S.exercises (sync podle id). */
function openPinModal(exId) {
  const ex = getExercise(exId);
  if (!ex) return;
  openModal(`${modalTitle("Poznámka ke cviku")}
    <p class="modal-sub">${esc(ex.name)} — ukáže se v každém tréninku</p>
    <label class="field"><span>Poznámka</span>
      <input class="input" id="pinInput" placeholder="např. sedačka 4, opěrka 2" value="${esc(ex.pin || "")}"></label>
    <div class="btn-row">
      ${ex.pin ? `<button class="btn danger" data-act="pin-save" data-exid="${exId}" data-clear="1">Odepnout</button>` : ""}
      <button class="btn primary" data-act="pin-save" data-exid="${exId}">Uložit</button>
    </div>`);
  document.getElementById("pinInput").focus();
}

/* ---- Core ano/ne ----
   Core se často dělá bez zapisování sérií (plank na konci, podložka doma).
   Přepínač ho započte jako pokrytou partii. Když už jsou v tréninku zapsané
   série core, je zapnutý sám a přepnout nejde. */
function coreCardHtml(a) {
  const sets = sessionCatSets(a).Core || 0;
  const on = a.core === true || sets > 0;
  const sub = sets ? `${sets} ${setWordTop(sets)} zapsáno v cvicích`
    : on ? "Odškrtnuto — partie se počítá jako pokrytá"
    : a.editOf ? "Byl v tréninku core? I bez zapsaných sérií." : "Dal jsi dnes core? I bez zapsaných sérií.";
  return `
    <div class="card core-row">
      <i class="p-stripe" style="background:var(--p-core)"></i>
      <div class="grow">
        <div class="name">Core</div>
        <div class="small">${sub}</div>
      </div>
      <button class="switch${on ? " on" : ""}" data-act="w-core" role="switch"
        aria-checked="${on}" aria-label="Core odcvičen"${sets ? " disabled" : ""}></button>
    </div>`;
}

/* ---- Stepper pro sérii ----
   Se zpocenou rukou je klávesnice nepřítel: ± mění hodnotu jedním klepnutím,
   pole zůstává editovatelné, když chceš zadat číslo přesně. */
function stepperHtml(id, value, step, label, extra = "") {
  return `
    <div class="set-field">
      <span class="set-lbl">${esc(label)}${extra}</span>
      <div class="set-step">
        <button class="step-btn sm" data-act="w-step" data-id="${id}" data-d="${-step}" aria-label="Méně">${ic("minus", 20, 2.3)}</button>
        <input class="input step-in" id="${id}" type="text" inputmode="decimal" value="${value}">
        <button class="step-btn sm" data-act="w-step" data-id="${id}" data-d="${step}" aria-label="Více">${ic("plus", 20, 2.3)}</button>
      </div>
    </div>`;
}

/* ---- RIR (v4.0, volitelné v Nastavení) ----
   Kolik opakování zbylo v záloze: 0 = do selhání (zapne i „do selhání"),
   4+ = lehká série. Volba se vybírá před zápisem a čte se z DOM
   (readSetInputs), takže přepnutí nepřekresluje rozepsaná pole. */
function rirLabel(v) { return v >= 4 ? "4+" : String(v); }
function rirTag(st) {
  return st.rir != null ? ` <span class="small rir-tag">· RIR ${rirLabel(st.rir)}</span>` : "";
}

/* ---- Kalkulačka kotoučů (v4.0) ----
   Kolik kotoučů dát na každou stranu osy pro váhu v poli. Kotouče hladově
   od největšího (u těchto řad vychází nejméně kusů); co složit nejde, ukáže
   se zlatě. Osa se pamatuje u cviku jen v zařízení (Settings.plateBars).
   Nabízí se jen u cviků s osou nebo strojů na kotouče (podle názvu). */
const PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25], lb: [45, 35, 25, 10, 5, 2.5] };
const BARS = { kg: [20, 15, 10, 0], lb: [45, 35, 25, 0] };
const PLATE_RE = /velk\w* cink|barbell|\bosou\b|\bosa\b|bench|benc[hk]|squat|\bdrep|deadlift|mrtv\w* tah|rumunsk|multipress|smith|hip thrust|leg press|hack|t-bar|landmine|pendulum|beltsquat|\bez\b/;
const NO_PLATE_RE = /jednoruc|dumbbell|kettlebell|ktb|kladk|cable|goblet|sissy|\bdb\b/;
function usesPlates(exId) {
  if (exKind(exId) !== "weight") return false;
  const e = getExercise(exId);
  const txt = e ? norm(`${e.name} ${e.nameEn || ""}`) : "";
  return PLATE_RE.test(txt) && !NO_PLATE_RE.test(txt);
}
function plateBar(exId) {
  const bars = BARS[weightUnit()];
  const v = (Settings.get().plateBars || {})[exId];
  return bars.includes(v) ? v : bars[0];
}
function platesFor(total, bar, unit) {
  const per = (total - bar) / 2;
  if (!(per > 0)) return { per: Math.max(0, per), plates: [], rest: 0 };
  let left = Math.round(per * 100);
  const plates = [];
  for (const p of PLATES[unit]) {
    const c = Math.round(p * 100);
    while (left >= c) { plates.push(p); left -= c; }
  }
  return { per, plates, rest: left / 100 };
}

/* ---- Counter partií ----
   Drží se nad cviky po celou dobu tréninku, u šablony i u libovolného cviku.
   Ukazuje i nuly — právě ta nula je informace, kvůli které counter existuje.
   Pořadí je pevné podle těla, ať se buňky pod prstem nepřeskupují. */
function catCounterHtml(session) {
  const sets = sessionCatSets(session);
  const exs = sessionCatExercises(session);
  // core odškrtnutý přepínačem (bez zapsaných sérií) je pokrytý, ale s ✓ místo čísla
  const ticked = c => c === "Core" && !sets[c] && session.core === true;
  const hit = CAT_ORDER.filter(c => sets[c] > 0 || ticked(c)).length;

  /* Sbalený je pruh — v posilovně je nejcennější místo na obrazovce.
     Klepnutím se rozbalí na cviky · série u každé partie. */
  /* nulová buňka: písmeno partie (R H Z B T C N) a proužek v její barvě —
     prázdný obrys sám říká „zatím nic", písmeno řekne „čeho" bez pamatování pořadí */
  const bar = CAT_ORDER.map(c => `
    <i class="${sets[c] || ticked(c) ? "" : "zero"}" style="--c:${catColor(c)}" role="img"
      aria-label="${c}: ${ticked(c) ? "odškrtnuto" : `${sets[c] || 0} ${plural(sets[c] || 0, "série", "série", "sérií")}`}">
      <b aria-hidden="true">${ticked(c) ? ic("check", 13, 3) : sets[c] || c[0]}</b>
    </i>`).join("");

  if (!WV.counterOpen) {
    return `
      <div class="cat-bar-card" data-act="w-counter">
        <div class="cat-bar">${bar}</div>
        <div class="cat-bar-meta">
          <span>Partie${session.editOf ? "" : " dnes"} · <b>${hit}</b> ze ${CAT_ORDER.length}</span>
          <span>série · rozbal ${ic("chevD", 13, 2.4)}</span>
        </div>
      </div>`;
  }

  const cells = CAT_ORDER.map(c => `
    <div class="cat-cell${sets[c] || ticked(c) ? "" : " zero"}">
      <i style="background:${catColor(c)}"></i>
      <span class="cat-n">${c}</span>
      <span class="cat-v">${ticked(c) ? ic("check", 14, 3) : `<b>${exs[c]}</b><s>·</s>${sets[c]}`}</span>
    </div>`).join("");
  return `
    <div class="card cat-counter" data-act="w-counter">
      <div class="row between" style="margin-bottom:12px">
        <span class="h2" style="margin:0">Partie${session.editOf ? " v tréninku" : " dnes"}</span>
        <span class="cap"><b style="color:var(--text)">${hit}</b> ze ${CAT_ORDER.length} · cviky · série ${ic("chevU", 13, 2.4)}</span>
      </div>
      <div class="cat-grid">${cells}</div>
    </div>`;
}

/* ---- Akce: silový trénink ---- */
function beginWorkout(templateId) {
  const tpl = getTemplate(templateId);
  WV.openIdx = null; // start: všechny cviky sbalené
  S.activeSession = {
    id: uid(),
    date: WV.date,
    type: "weights",
    templateUsed: tpl ? tpl.id : "custom",
    templateName: tpl ? tpl.name : "Libovolný",
    // kdy se trénink zapnul (v2.2) — jen u dnešního, zpětný zápis skutečný čas nemá
    startedAt: WV.date === todayStr() ? Date.now() : null,
    // cíl (série × rozsah × pauza) a superset z plánu šablony
    entries: tpl ? tpl.exercises.filter(getExercise).map(exId => {
      // v silovém bloku cíl podle týdne (série navíc, deload, RIR, start váha)
      const t = blockTarget(tpl.id, exId, tplPlan(tpl, exId), WV.date);
      return Object.assign({ exerciseId: exId, sets: [], target: t || null }, t && t.link ? { link: true } : {});
    }) : []
  };
  save();
  render({ top: true });
  if (!tpl) openExercisePicker(null);
}

/* Zopakovat uložený trénink: stejné cviky a supersety, dnešní datum */
function repeatSession(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s || s.type !== "weights") return;
  closeModal();
  App.route = { tab: "workout", page: null };
  if (S.activeSession) { render({ top: true }); toast("Nejdřív dokonči nebo zruš probíhající trénink", "err"); return; }
  const tpl = getTemplate(s.templateUsed);
  WV.date = todayStr();
  WV.openIdx = null;
  WV.editSet = null;
  S.activeSession = {
    id: uid(), date: WV.date, type: "weights", startedAt: Date.now(),
    templateUsed: s.templateUsed || "custom", templateName: s.templateName || null,
    entries: s.entries.filter(e => getExercise(e.exerciseId)).map(e => {
      const t = blockTarget(s.templateUsed, e.exerciseId, tplPlan(tpl, e.exerciseId), WV.date)
        || ((e.sets || []).length ? { sets: e.sets.length, lo: null, hi: null, rest: null } : null);
      return Object.assign({ exerciseId: e.exerciseId, sets: [], target: t }, e.link ? { link: true } : {});
    })
  };
  save();
  render({ top: true });
  toast("Trénink zopakován s dnešním datem", "ok");
}

/* Po přepočtu (oprava/smazání série) znovu označí rekordy v cviku */
function refreshEntryRecords(a, entry) {
  const prior = [];
  for (const st of entry.sets) {
    const types = liveRecordTypes(entry.exerciseId, st, prior, a.id);
    if (types.length) { st.isPR = true; st.rec = types; } else { delete st.isPR; delete st.rec; }
    prior.push(st);
  }
  entry.prHit = entry.sets.some(st => st.isPR);
}

/* ---- Zpětná úprava uloženého tréninku ----
   Uložený trénink se otevře ve stejném editoru jako živý (stejné id, cviky
   sbalené jako hotové). Původní záznam zůstává v S.sessions nedotčený,
   dokud se neuloží — „Zahodit" ho nechá, jak byl. */
function beginEditSession(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s || s.type !== "weights") return;
  closeModal();
  if (S.activeSession) {
    App.route = { tab: "workout", page: null };
    render({ top: true });
    toast("Nejdřív dokonči nebo zruš probíhající trénink", "err");
    return;
  }
  S.activeSession = {
    id: s.id,
    editOf: s.id,
    date: s.date,
    type: "weights",
    templateUsed: s.templateUsed,
    templateName: s.templateName || null,
    core: s.core === true,
    entries: (s.entries || []).map(e => Object.assign(
      { exerciseId: e.exerciseId, sets: (e.sets || []).map(st => Object.assign(
        { reps: st.reps, weight: st.weight, note: st.note || null }, st.failure ? { failure: true } : {}, st.rir != null ? { rir: st.rir } : {})),
        warm: (e.warm || []).map(st => ({ reps: st.reps, weight: st.weight })), done: true, target: null },
      e.exerciseName ? { exerciseName: e.exerciseName } : {}, e.link ? { link: true } : {}))
  };
  WV.openIdx = null;
  WV.editSet = null;
  App.route = { tab: "workout", page: null };
  save();
  render({ top: true });
}

function finishWorkout() {
  const a = S.activeSession;
  const hasSets = e => !!(e && (e.sets || []).length);
  // superset se uloží jen tehdy, když se odcvičil i ten další cvik — jinak by se
  // po vynechání prázdných cviků spojil s jiným
  const entries = a.entries
    .map((e, i) => [e, e.link && hasSets(a.entries[i + 1])])
    .filter(([e]) => hasSets(e))
    .map(([e, link]) => Object.assign(
      { exerciseId: e.exerciseId, sets: e.sets.map(({ reps, weight, note, failure, rir }) =>
        Object.assign({ reps, weight, note }, failure ? { failure: true } : {}, rir != null ? { rir } : {})) },
      // zahřívací série zvlášť — do sérií, objemu ani rekordů se nepočítají
      (e.warm || []).length ? { warm: e.warm.map(({ reps, weight }) => ({ reps, weight })) } : {},
      e.exerciseName ? { exerciseName: e.exerciseName } : {}, link ? { link: true } : {}));
  if (!entries.length) {
    toast(a.editOf ? "Trénink nemá žádnou sérii — smazat ho jde v detailu" : "Trénink nemá žádnou zapsanou sérii", "err");
    return;
  }
  if (a.editOf) {
    /* uložení úpravy: přepíše původní záznam, hodnocení a poznámka zůstávají */
    const orig = S.sessions.find(x => x.id === a.editOf);
    // původní záznam mezitím smazaný (třeba na jiném zařízení) → uloží se jako
    // nový; staré id už leží v tombstonech a sync by ho zase zahodil
    const base = orig || { id: uid(), type: "weights" };
    Object.assign(base, { date: a.date, templateUsed: a.templateUsed, templateName: a.templateName || null,
      core: a.core === true, entries });
    if (!orig) S.sessions.push(base);
    S.activeSession = null;
    WV.openIdx = null;
    WV.editSet = null;
    WV.date = base.date;
    save();
    render({ top: true });
    toast("Trénink upraven ✓", "ok");
    openSessionDetail(base.id);
    return;
  }
  const sessionId = a.id;
  // jednorázová „váha na příště" (od trenéra nebo z návrhu) platí jen do odcvičení
  if (S.overrides) for (const e of entries) delete S.overrides[e.exerciseId];
  // pořadí, supersety a cíle z tréninku — pro „uložit změny do šablony" ve shrnutí
  WV.lastFinish = { sid: sessionId, order: a.entries.map(e => ({ id: e.exerciseId, link: !!e.link, target: e.target || null })) };
  S.sessions.push(Object.assign({ id: sessionId, date: a.date, type: "weights", templateUsed: a.templateUsed,
    templateName: a.templateName || null, core: a.core === true, entries }, a.startedAt ? { startedAt: a.startedAt } : {}));
  S.activeSession = null;
  WV.openIdx = null;
  WV.editSet = null;
  WV.sw = null;
  Rest.stop();
  save();
  render({ top: true });
  openWorkoutSummary(sessionId);
}

/* ---- Hodnocení tréninku (kvalita 1–10 + poznámka) ---- */
/* edit = otevřeno z detailu uloženého tréninku (předvyplní dosavadní hodnocení) */
function openRatingModal(sessionId, edit = false) {
  const s = S.sessions.find(x => x.id === sessionId) || {};
  WV.rateVal = edit ? (s.rating || null) : null;
  const chips = Array.from({ length: 10 }, (_, k) => k + 1).map(n =>
    `<button class="scale-chip ratechip${WV.rateVal === n ? " on" : ""}" data-act="w-rate-chip" data-val="${n}">${n}</button>`).join("");
  openModal(`${modalTitle(edit ? "Hodnocení tréninku" : "Jak ti trénink sedl?")}
    <p class="modal-sub">1 = nekvalitní, 10 = skvělý</p>
    <div class="scale-row" style="margin-bottom:18px">${chips}</div>
    <label class="field"><span>Poznámka</span>
      <input class="input" id="rateNote" placeholder="pocit, únava, co příště jinak…"
        value="${edit ? esc(s.note || "") : ""}"></label>
    <div class="btn-row">
      <button class="btn ghost" data-act="modal-close">${edit ? "Zavřít" : "Přeskočit"}</button>
      <button class="btn primary" data-act="w-rate-save" data-id="${sessionId}"${edit ? ` data-back="1"` : ""}>Uložit</button>
    </div>`);
}

/* ---- Výběr cviku (přidání / výměna v session) ----
   Při výměně se sheet otevře rovnou na partii měněného cviku — náhrada
   je skoro vždy ze stejné partie. Cviky, které v tréninku už jsou, jsou
   vidět, ale vybrat nejdou. */
function openExercisePicker(swapIndex) {
  WV.pickerIndex = swapIndex;
  const a = S.activeSession;
  const cur = swapIndex != null && a ? a.entries[swapIndex] : null;
  const inSession = new Set(a ? a.entries.map(e => e.exerciseId) : []);
  openExPicker({
    title: cur ? "Vyměnit cvik" : "Přidat cvik",
    act: "w-pick-ex",
    cat: cur ? exCategory(cur.exerciseId) : "all",
    used: id => cur && id === cur.exerciseId ? "měníš" : inSession.has(id) ? "v tréninku" : null
  });
}

/* ---- Kardio formulář ---- */
/* editId = zpětná úprava uloženého kardia (předvyplní hodnoty a datum) */
function openCardioModal(editId = null) {
  const s = editId ? S.sessions.find(x => x.id === editId && x.type === "cardio") : null;
  const c = s ? (s.entries[0] || {}) : {};
  WV.cardioEdit = s ? s.id : null;
  WV.sportChoice = s && c.sport ? c.sport : CARDIO_SPORTS[0];
  const sports = CARDIO_SPORTS.includes(WV.sportChoice) ? CARDIO_SPORTS : CARDIO_SPORTS.concat([WV.sportChoice]);
  const sportChips = sports.map(sp =>
    `<button class="chip sportchip${sp === WV.sportChoice ? " on" : ""}" data-act="w-sport-chip" data-sport="${esc(sp)}">${esc(sp)}</button>`).join("");
  const dateInfo = !s && WV.date !== todayStr() ? ` · ${fmtShort(WV.date)}` : "";
  const val = v => v != null ? String(v).replace(".", ",") : "";
  openModal(`${modalTitle((s ? "Upravit kardio" : "Kardio") + dateInfo)}
    <div class="chips">${sportChips}</div>
    ${s ? `<label class="field"><span>Datum</span>
      <input class="input" id="cDate" type="date" value="${s.date}"></label>` : ""}
    <label class="field"><span>Doba trvání (min)</span>
      <input class="input" id="cDur" type="text" inputmode="decimal" placeholder="např. 30" value="${val(c.duration)}"></label>
    <div class="input-row">
      <label class="field"><span>Vzdálenost (km)</span>
        <input class="input" id="cDist" type="text" inputmode="decimal" placeholder="volitelné" value="${val(c.distance)}"></label>
      <label class="field"><span>Kalorie (kcal)</span>
        <input class="input" id="cCal" type="text" inputmode="numeric" placeholder="volitelné" value="${val(c.calories)}"></label>
    </div>
    <div class="small" id="cPace" style="margin:-4px 2px 16px"></div>
    <button class="btn primary full" data-act="w-cardio-save">${s ? "Uložit změny" : "Uložit kardio"}</button>`);
  const upd = () => {
    const d = parseDec(document.getElementById("cDur").value);
    const k = parseDec(document.getElementById("cDist").value);
    document.getElementById("cPace").textContent =
      d && k ? `Tempo ${fmtNum(d / k, 2)} min/km` : "";
  };
  document.getElementById("cDur").addEventListener("input", upd);
  document.getElementById("cDist").addEventListener("input", upd);
  upd();
}

function saveCardio() {
  const duration = parseDec(document.getElementById("cDur").value);
  const distance = parseDec(document.getElementById("cDist").value) || null;
  const calories = parseDec(document.getElementById("cCal").value) || null;
  if (!duration || duration <= 0) { toast("Zadej dobu trvání", "err"); return; }
  const edited = WV.cardioEdit ? S.sessions.find(x => x.id === WV.cardioEdit) : null;
  if (edited) {
    const dateEl = document.getElementById("cDate");
    if (dateEl && dateEl.value) edited.date = dateEl.value;
    edited.entries = [{
      sport: WV.sportChoice, duration, distance,
      pace: distance ? Math.round(duration / distance * 100) / 100 : null, calories
    }];
    WV.cardioEdit = null;
    save();
    render();
    toast("Kardio upraveno ✓", "ok");
    openSessionDetail(edited.id);
    return;
  }
  S.sessions.push({
    id: uid(), date: WV.date, type: "cardio", templateUsed: null,
    entries: [{
      sport: WV.sportChoice, duration, distance,
      pace: distance ? Math.round(duration / distance * 100) / 100 : null, calories
    }]
  });
  save();
  closeModal();
  render();
  toast(WV.date === todayStr() ? "Kardio uloženo ✓" : `Kardio uloženo k ${fmtDate(WV.date)} ✓`, "ok");
}

function cardioLabel(entry) {
  return entry && entry.sport ? entry.sport : "Kardio";
}

/* ---- Rekordy (stránka) ----
   Čtyři druhy rekordů (data.js → exerciseRecords): odhad 1RM, nejtěžší váha,
   opakování při dané váze a nejlepší série. U cviků bez váhy nejvíc opakování
   a nejdelší výdrž. Řazeno podle posledního překonaného rekordu. */
function exerciseBestHtml(id) {
  const r = exerciseRecords(id);
  const kind = exKind(id);
  if (kind === "weight" && r.best.e1rm) return `${fmtWeight(r.best.e1rm.weight)} × ${r.best.e1rm.reps}`;
  if (r.best.reps) return `${setShort(id, r.best.reps)}${kind === "bw" ? " opak." : ""}`;
  return "—";
}

function renderPRList() {
  const ids = new Set();
  for (const s of S.sessions) if (s.type === "weights") for (const e of s.entries) if ((e.sets || []).length) ids.add(e.exerciseId);
  if (!ids.size) return `<div class="card"><div class="empty-note">Zatím žádné rekordy.<br>Zapiš první silový trénink!</div></div>`;
  const t = todayStr();
  const r30 = countRecordsInRange(addDays(t, -29), t);
  const r90 = countRecordsInRange(addDays(t, -89), t);
  const list = [...ids].map(id => {
    const ev = exerciseRecords(id).events;
    return { id, last: ev.length ? ev[ev.length - 1] : null, n: ev.length };
  }).sort((a, b) => ((b.last || {}).date || "").localeCompare((a.last || {}).date || "") || exName(a.id).localeCompare(exName(b.id), "cs"));
  const rows = list.map(({ id, last, n }) => `
    <div class="list-item" data-act="w-pr-history" data-exid="${id}">
      <i class="p-stripe" style="background:${exColor(id)}"></i>
      <div class="grow">
        <div class="name">${esc(exName(id))}</div>
        <div class="li-sub">${last ? `${relDay(last.date)} · ${REC_LABEL[last.types[0]]}` : "zatím bez překonaného rekordu"}${n > 1 ? ` · ${n}×` : ""}</div>
      </div>
      <div class="li-val" style="color:var(--yellow)">${exerciseBestHtml(id)}</div>
    </div>`).join("");
  return `
    <div class="card">
      <div class="stats two">
        ${statHtml(r30, "rekordů za 30 dní", "", r30 ? "pr" : "")}
        ${statHtml(r90, "za 90 dní")}
      </div>
      <div class="chart-cap" style="margin-top:14px">Rekord = odhad 1RM, nejtěžší váha, víc opakování při stejné nebo vyšší váze, nebo nejlepší série (váha × opakování). Počítá se jeden na cvik a trénink.</div>
    </div>
    <div class="card rows">${rows}</div>`;
}

/* Detail rekordů cviku: nejlepší hodnoty, opakování podle váhy a historie */
function openPRHistory(exerciseId) {
  const id = exerciseId;
  const r = exerciseRecords(id);
  const kind = exKind(id);
  const b = r.best;
  const tile = (val, lbl, sub) => `<div class="stat"><div class="val">${val}</div><div class="lbl">${lbl}${sub ? `<br><span style="color:var(--text3)">${sub}</span>` : ""}</div></div>`;
  const tiles = [];
  if (kind === "weight") {
    if (b.e1rm) tiles.push(tile(fmtWeight(est1RM(b.e1rm.weight, b.e1rm.reps)), "odhad 1RM", `${fmtWeight(b.e1rm.weight)} × ${b.e1rm.reps}`));
    if (b.weight) tiles.push(tile(fmtWeight(b.weight.weight), "nejtěžší váha", `× ${b.weight.reps} opak.`));
    if (b.volume) tiles.push(tile(`${fmtNum(kgOut(b.volume.weight * b.volume.reps))} ${weightUnit()}`, "nejlepší série", `${fmtWeight(b.volume.weight)} × ${b.volume.reps}`));
    if (b.reps) tiles.push(tile(`${b.reps.reps}`, "nejvíc opakování", b.reps.weight ? `při ${fmtWeight(b.reps.weight)}` : ""));
  } else {
    if (b.reps) tiles.push(tile(setShort(id, b.reps), kind === "time" ? "nejdelší výdrž" : "nejvíc opakování",
      b.reps.weight ? `+${fmtWeight(b.reps.weight)}` : ""));
    if (kind === "bw" && b.weight) tiles.push(tile(`+${fmtWeight(b.weight.weight)}`, "nejtěžší zátěž", `× ${b.weight.reps} opak.`));
  }
  const atRows = kind === "time" ? "" : r.state.at.filter(([w]) => kind === "weight" ? w > 0 : true)
    .sort((x, y) => y[0] - x[0]).slice(0, 8).map(([w, reps]) => `
      <div class="set-row"><span class="grow">${w ? fmtWeight(w) : "vlastní váha"}${kind === "bw" && w ? " zátěž" : ""}</span>
        <span class="set-val">${reps} <span>opak.</span></span></div>`).join("");
  const evRows = r.events.slice().reverse().slice(0, 15).map(ev => `
    <div class="list-item">
      <div class="grow">
        <div class="name">${setValHtml(id, ev)}</div>
        <div class="li-sub">${fmtDate(ev.date)}</div>
      </div>
      <span class="small" style="color:var(--yellow);text-align:right;max-width:150px">${ev.types.map(t => REC_LABEL[t]).join(", ")}</span>
    </div>`).join("");
  openModal(`${modalTitle(exName(id))}
    ${exNameEn(id) ? `<p class="modal-sub">${esc(exNameEn(id))}</p>` : ""}
    ${tiles.length ? `<div class="stat-grid">${tiles.join("")}</div>` : `<div class="empty-note">Zatím žádná data</div>`}
    ${atRows ? `<div class="h3" style="margin-top:22px">Opakování podle váhy</div><div class="sets" style="margin-top:4px">${atRows}</div>` : ""}
    <div class="h3" style="margin-top:22px">Překonané rekordy</div>
    ${evRows || `<div class="empty-note" style="padding:12px">Rekordy se počítají od druhého tréninku cviku.</div>`}
    <button class="btn ghost full mt2" data-act="pg-ex" data-exid="${id}">${ic("trend", 17)} Graf progresu</button>`);
}

/* ---- Šablona z uloženého tréninku ----
   Série = kolik jich v tréninku bylo, rozsah = nejméně–nejvíc opakování,
   supersety zůstanou. Pauza výchozí. */
function templateFromSession(s, name) {
  const plan = {};
  const ids = [];
  for (const e of s.entries || []) {
    if (!getExercise(e.exerciseId) || ids.includes(e.exerciseId)) continue;
    ids.push(e.exerciseId);
    const reps = (e.sets || []).map(st => st.reps).filter(Boolean);
    plan[e.exerciseId] = {
      sets: (e.sets || []).length || null,
      lo: reps.length ? Math.min(...reps) : null,
      hi: reps.length ? Math.max(...reps) : null,
      rest: null,
      link: !!e.link
    };
  }
  const t = { id: uid(), name, exercises: ids, plan };
  S.templates.push(t);
  return t;
}

function openSaveTemplateModal(sid) {
  const s = S.sessions.find(x => x.id === sid);
  if (!s) return;
  openModal(`${modalTitle("Uložit jako šablonu")}
    <p class="modal-sub">${s.entries.length} cviků z tréninku ${fmtShort(s.date)} — série a rozsah opakování podle toho, co jsi odcvičil</p>
    <label class="field"><span>Název šablony</span>
      <input class="input" id="newTplName" value="${esc(s.templateUsed === "custom" ? "Trénink " + fmtShort(s.date) : sessionLabel(s) + " (kopie)")}"></label>
    <button class="btn primary full" data-act="tpl-from-session" data-id="${sid}">Uložit šablonu</button>`);
  document.getElementById("newTplName").focus();
}

/* ---- Shrnutí po dokončení tréninku ----
   Čísla proti minulému tréninku stejné šablony, pokryté partie, padlé
   rekordy, nabídka uložit změny do šablony (nebo volný trénink jako šablonu)
   a hodnocení. Délka tréninku záměrně ne — časovač v appce není (v1.26). */
function openWorkoutSummary(sid) {
  const s = S.sessions.find(x => x.id === sid);
  if (!s) return;
  const custom = !getTemplate(s.templateUsed);
  const prev = custom ? null : S.sessions
    .filter(x => x.type === "weights" && x.id !== s.id && x.templateUsed === s.templateUsed
      && (x.date < s.date || (x.date === s.date && String(x.id) < String(s.id))))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)))[0] || null;
  const sets = sessionSets(s), vol = sessionVolume(s);
  const v = fmtVolume(vol);
  const counts = sessionCatSets(s);
  const zero = CAT_ORDER.filter(c => !counts[c] && !(c === "Core" && s.core === true));
  const recs = sessionRecordEvents(s);
  /* nejlepší rekord jde nahoru jako hlavní blok: nejdřív podle druhu (1RM,
     váha, opakování, série), pak podle odhadu 1RM; ostatní pod ním řádky */
  const rank = ev => Math.min(...ev.types.map(t => REC_ORDER.indexOf(t)));
  const ordered = recs.slice().sort((x, y) => rank(x) - rank(y) || est1RM(y.weight || 0, y.reps) - est1RM(x.weight || 0, x.reps));
  const top = ordered[0];
  const topE1 = top && exKind(top.exerciseId) === "weight" && top.weight ? est1RM(top.weight, top.reps) : 0;
  const recHero = top ? `
    <div class="card sum-rec">
      <span class="sum-rec-ic">${ic("trophy", 22, 2)}</span>
      <div class="grow">
        <div class="sum-rec-t">${esc(exName(top.exerciseId))}</div>
        <div class="sum-rec-v">${setValHtml(top.exerciseId, top)}</div>
        <div class="sum-rec-s">${esc(capFirst(top.types.map(t => REC_LABEL[t]).join(", ")))}${topE1 ? ` · odhad 1RM ${fmtWeight(topE1)}` : ""}</div>
      </div>
    </div>` : "";
  /* jako seznam rekordů v Pokroku: druh šedě, hodnota zlatě; „a 1 další"
     by zabralo stejně místa jako ten řádek, takže se ukáže rovnou */
  const cut = ordered.length > 8 ? 7 : ordered.length;
  const recRows = ordered.slice(1, cut).map(ev => `
    <div class="list-item">
      <i class="p-stripe" style="background:${exColor(ev.exerciseId)}"></i>
      <div class="grow">
        <div class="name">${esc(exName(ev.exerciseId))}</div>
        <div class="li-sub">${ev.types.map(t => REC_LABEL[t]).join(", ")}</div>
      </div>
      <span class="li-val" style="color:var(--yellow)">${setShort(ev.exerciseId, ev)}</span>
    </div>`).join("");
  const more = ordered.length - cut;

  /* změny proti šabloně: jiné cviky, pořadí nebo supersety → nabídka uložit */
  let tplCard = "";
  const lf = WV.lastFinish && WV.lastFinish.sid === sid ? WV.lastFinish : null;
  const tpl = getTemplate(s.templateUsed);
  if (tpl && lf) {
    const order = lf.order.filter(o => getExercise(o.id)).map(o => o.id);
    const added = order.filter(id => !tpl.exercises.includes(id));
    const removed = tpl.exercises.filter(id => getExercise(id) && !order.includes(id));
    const sameSet = !added.length && !removed.length;
    const reordered = sameSet && order.join("|") !== tpl.exercises.filter(getExercise).join("|");
    const linkChanged = lf.order.some(o => !!o.link !== !!(tplPlan(tpl, o.id) || {}).link);
    if (added.length || removed.length || reordered || linkChanged) {
      const bits = [];
      if (added.length) bits.push(`přidáno: ${added.map(exName).join(", ")}`);
      if (removed.length) bits.push(`vyřazeno: ${removed.map(exName).join(", ")}`);
      if (reordered) bits.push("jiné pořadí");
      if (linkChanged) bits.push("jiné supersety");
      tplCard = `
        <div class="card sum-tpl">
          <div class="name" style="font-weight:650">Trénink se lišil od šablony ${esc(tpl.name)}</div>
          <p class="small" style="margin:4px 0 14px">${esc(capFirst(bits.join(" · ")))}</p>
          <button class="btn full" data-act="w-tpl-update" data-tpl="${tpl.id}">Uložit změny do šablony</button>
        </div>`;
    }
  } else if (custom) {
    tplCard = `
      <div class="card sum-tpl">
        <div class="name" style="font-weight:650">Uložit jako šablonu?</div>
        <p class="small" style="margin:4px 0 12px">Příště ho spustíš jedním klepnutím.</p>
        <div class="row" style="gap:8px">
          <input class="input grow" id="newTplName" placeholder="Název šablony" value="Trénink ${fmtShort(s.date)}">
          <button class="btn fit" data-act="tpl-from-session" data-id="${sid}" data-inline="1">Uložit</button>
        </div>
      </div>`;
  }

  /* Příště: co z dnešních sérií vyplývá pro další trénink (jen cviky, kde se něco mění) */
  const tplS = getTemplate(s.templateUsed);
  const nextRows = s.entries.map(e => {
    const fin = WV.lastFinish && WV.lastFinish.sid === s.id ? (WV.lastFinish.order.find(o => o.id === e.exerciseId) || {}).target : null;
    const ns = nextSets(e.exerciseId, fin || tplPlan(tplS, e.exerciseId), null);
    return ["up", "easy", "down", "hold"].includes(ns.kind) ? `<div class="lv-hint k-${ns.kind}">${ic(LV_KIND_ICON[ns.kind] || "target", 15, 2.2)}
      <span><b>${esc(exName(e.exerciseId))}</b> — ${esc(ns.text)}</span></div>` : "";
  }).filter(Boolean);
  const nextHtml = nextRows.length ? `<div class="card sum-next"><div class="name" style="font-weight:650">Příště</div>${nextRows.slice(0, 6).join("")}</div>` : "";

  WV.rateVal = null;
  const chips = Array.from({ length: 10 }, (_, k) => k + 1).map(n =>
    `<button class="scale-chip ratechip" data-act="w-rate-chip" data-val="${n}">${n}</button>`).join("");
  openModal(`${modalTitle(`Hotovo · ${sessionLabel(s)}`)}
    <p class="modal-sub">${capFirst(relDay(s.date))}${s.startedAt ? ` · začátek ${fmtTime(s.startedAt)}` : ""}${recs.length ? ` · ${recs.length} ${plural(recs.length, "rekord", "rekordy", "rekordů")}` : ""}</p>
    ${recHero}
    ${recRows ? `<div class="card rows sum-rec-more">${recRows}</div>${more ? `<p class="small" style="margin:-4px 4px 12px">a ${more} ${plural(more, "další", "další", "dalších")}</p>` : ""}` : ""}
    <div class="card">
      <div class="stats">
        ${statHtml(s.entries.length, plural(s.entries.length, "cvik", "cviky", "cviků"), prev ? deltaHtml(s.entries.length, prev.entries.length) : "")}
        ${statHtml(sets, setWordTop(sets), prev ? deltaHtml(sets, sessionSets(prev), true) : "")}
        ${statHtml(`${v.val}<small>${v.unit}</small>`, "objem", prev ? deltaHtml(vol, sessionVolume(prev), true) : "")}
      </div>
      ${prev ? `<div class="chart-cap">Proti minulému tréninku ${esc(sessionLabel(prev))} · ${relDay(prev.date)}</div>` : ""}
    </div>
    ${nextHtml}
    <div class="card" style="margin-top:12px">
      <div class="row between" style="margin-bottom:9px">
        <span class="cap">Partie</span>
        <span class="cap"><b style="color:var(--text)">${CAT_ORDER.length - zero.length}</b> ze ${CAT_ORDER.length}</span>
      </div>
      ${catPipsHtml(counts, s.core === true)}
      ${zero.length ? `<div class="small warn-text" style="margin-top:9px">${ic("alert", 13)} Bez série: ${zero.join(", ")}</div>` : ""}
    </div>
    ${tplCard}
    <div class="h3" style="margin-top:20px">Jak ti trénink sedl?</div>
    <div class="scale-row" style="margin-bottom:14px">${chips}</div>
    <label class="field"><span>Poznámka</span>
      <input class="input" id="rateNote" placeholder="pocit, únava, co příště jinak…"></label>
    <div class="btn-row">
      <button class="btn ghost" data-act="modal-close">Přeskočit</button>
      <button class="btn primary" data-act="w-rate-save" data-id="${sid}">Uložit hodnocení</button>
    </div>`);
}

/* Uložit pořadí, cviky a supersety z dokončeného tréninku do šablony */
function updateTemplateFromFinish(tplId) {
  const t = getTemplate(tplId);
  const lf = WV.lastFinish;
  if (!t || !lf) return false;
  const order = [];
  for (const o of lf.order) if (getExercise(o.id) && !order.some(x => x.id === o.id)) order.push(o);
  const plan = Object.assign({}, t.plan || {});
  for (const o of order) {
    const own = plan[o.id];
    if (own) own.link = o.link;
    else if (o.link || o.target) plan[o.id] = Object.assign({ sets: null, lo: null, hi: null, rest: null }, o.target || exDefaultPlan(o.id) || {}, { link: o.link });
  }
  for (const id of Object.keys(plan)) if (!order.some(o => o.id === id)) delete plan[id];
  t.exercises = order.map(o => o.id);
  t.plan = plan;
  return true;
}

/* ---- Detail session (sdílený s kalendářem a detailem dne) ---- */
function sessionDetailHtml(s) {
  const delBtn = `<button class="iconbtn soft danger" data-act="w-del-session" data-id="${s.id}" aria-label="Smazat trénink">${ic("trash", 18)}</button>`;
  if (s.type === "cardio") {
    const c = s.entries[0] || {};
    return `<div>
      <div class="row" style="gap:8px;margin-bottom:14px"><i class="p-dot" style="background:var(--p-cardio)"></i><b style="font-size:17px">${esc(cardioLabel(c))}</b></div>
      <div class="card">
        <div class="stats">
          ${statHtml(`${fmtNum(c.duration)}<small>min</small>`, "čas")}
          ${statHtml(c.distance ? `${fmtNum(c.distance, 2)}<small>km</small>` : "—", "vzdálenost")}
          ${statHtml(c.pace ? fmtNum(c.pace, 2) : "—", "min/km")}
        </div>
        ${c.calories ? `<div class="small mt">${fmtNum(c.calories)} kcal</div>` : ""}
      </div>
      <div class="row" style="gap:8px">
        <button class="btn grow" data-act="w-cardio-edit" data-id="${s.id}">${ic("edit", 17)} Upravit</button>
        ${delBtn}
      </div></div>`;
  }
  const recSet = new Set(sessionRecordEvents(s).flatMap(ev => ev.sets.map(([k, j]) => `${k}|${j}`)));
  const blocks = s.entries.map((e, k) => {
    const linked = e.link || (k > 0 && s.entries[k - 1].link);
    const sets = (e.sets || []).map((st, j) =>
      `<div class="set-row"><span class="set-num">${j + 1}</span>
       <span class="grow"><span class="set-val">${setValHtml(e.exerciseId, st)}</span>${rirTag(st)}${st.note ? ` <span class="small">· ${esc(st.note)}</span>` : ""}</span>
       ${recSet.has(`${k}|${j}`) ? `<span class="badge yellow">PR</span>` : ""}
       ${st.failure ? `<span class="fail-chip on static"><i>${ic("check", 9, 3.6)}</i>selhání</span>` : ""}</div>`).join("");
    return `<div class="detail-ex">
      <div class="row" style="gap:10px;margin-bottom:4px"><i class="p-stripe" style="background:${exColor(e.exerciseId)}"></i>
        <b style="font-size:15.5px" class="grow">${esc(exName(e.exerciseId))}</b>${linked ? `<span class="ss-tag">superset</span>` : ""}</div>
      ${(e.warm || []).length ? `<div class="small" style="margin:0 0 4px 13px">Zahřátí: ${e.warm.map(st => setShort(e.exerciseId, st)).join(" · ")}</div>` : ""}${sets}</div>`;
  }).join("");
  /* core jde doplnit i zpětně — kdo zapomněl odškrtnout v tréninku */
  const coreSets = sessionCatSets(s).Core || 0;
  const coreRow = `
    <div class="row detail-core">
      <i class="p-dot" style="background:var(--p-core)"></i>
      <span class="grow" style="font-weight:600">Core</span>
      ${coreSets ? `<span class="small">${coreSets} ${setWordTop(coreSets)} v cvicích</span>`
        : `<button class="switch${s.core === true ? " on" : ""}" data-act="w-core-session" data-id="${s.id}"
            role="switch" aria-checked="${s.core === true}" aria-label="Core odcvičen"></button>`}
    </div>`;
  const sets = sessionSets(s);
  const vol = fmtVolume(sessionVolume(s));
  return `<div>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <b style="font-size:17px">${esc(sessionLabel(s))}</b>
      ${s.startedAt ? `<span class="badge neutral">${ic("timer", 12, 2.2)} ${fmtTime(s.startedAt)}</span>` : ""}
      ${s.rating ? `<span class="badge">${s.rating}/10</span>` : ""}
      ${recSet.size ? `<span class="badge yellow">${ic("trophy", 12, 2.2)} ${sessionPRCount(s)}</span>` : ""}
    </div>
    <div class="card">
      <div class="stats">
        ${statHtml(s.entries.length, "cviků")}
        ${statHtml(sets, setWordTop(sets))}
        ${statHtml(`${vol.val}<small>${vol.unit}</small>`, "objem")}
      </div>
      <div style="margin-top:14px">${catPipsHtml(sessionCatSets(s), s.core === true)}</div>
    </div>
    ${s.note ? `<p class="muted" style="margin:4px 2px 14px">„${esc(s.note)}"</p>` : ""}
    <div class="row" style="gap:8px">
      <button class="btn grow" data-act="w-edit-session" data-id="${s.id}">${ic("edit", 17)} Upravit</button>
      <button class="btn grow" data-act="w-rate-open" data-id="${s.id}">${ic("star", 17)} ${s.rating ? "Hodnocení" : "Ohodnotit"}</button>
      ${delBtn}
    </div>
    <div class="btn-row" style="margin-top:8px">
      <button class="btn sm ghost" data-act="w-repeat" data-id="${s.id}">${ic("history", 16)} Zopakovat</button>
      <button class="btn sm ghost" data-act="w-save-tpl" data-id="${s.id}">${ic("list", 16)} Nová šablona</button>
    </div>
    ${coreRow}${blocks}</div>`;
}

function openSessionDetail(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return;
  openModal(`${modalTitle(capFirst(`${CZ_DAYS_FULL[parseDate(s.date).getDay()]} ${fmtShort(s.date)}`))}${sessionDetailHtml(s)}`);
}

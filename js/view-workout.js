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
  return S.activeSession ? renderActiveSession() : renderWorkoutStart();
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

/* ---- Start: co je na řadě, ostatní šablony, kardio a poslední tréninky ---- */
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

  /* jedna nízká karta: šablona na řadě v jednom řádku s tlačítkem Začít,
     pod linkou ostatní volby jako malé kapsle (šablony, volný trénink, kardio) */
  const opt = (attrs, label, dot = "") =>
    `<button class="start-opt" ${attrs}>${dot}<span>${esc(label)}</span></button>`;
  const opts = S.templates.filter(t => !next || t.id !== next.id)
    .map(t => opt(`data-act="w-begin" data-template="${t.id}"`, t.name))
    .concat(opt(`data-act="w-begin" data-template="custom"`, "Volný"),
      opt(`data-act="w-cardio"`, "Kardio", `<i class="p-dot" style="background:var(--p-cardio)"></i>`)).join("");
  let hero = "";
  if (next) {
    const last = lastWeightsSession();
    const n = next.exercises.filter(getExercise).length;
    const g = lastSessionGaps();
    const gaps = g ? [...g.missed.map(m => m.cat), ...g.low.map(l => l.cat)] : [];
    hero = `
      <div class="next-row">
        <div class="grow">
          <div class="td-eyebrow">Na řadě${day !== today ? ` · ${fmtShort(day)}` : ""}</div>
          <div class="next-name">${esc(next.name)}</div>
          <div class="next-meta">${n} ${plural(n, "cvik", "cviky", "cviků")}${last ? ` · naposledy ${relDay(last.date)}` : ""}</div>
        </div>
        <button class="btn primary next-go" data-act="w-begin" data-template="${next.id}">${ic("play", 14)} Začít</button>
      </div>
      ${gaps.length ? `<div class="td-warn">${ic("alert", 14)}Minule uteklo: ${gaps.join(", ")}</div>` : ""}`;
  }
  out.push(`<div class="card next-card">${hero}<div class="start-opts${next ? "" : " solo"}">${opts}</div></div>`);

  /* poslední tréninky */
  const recent = S.sessions.filter(s => !(daySessions.includes(s)))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id))).slice(0, 3);
  if (recent.length) {
    out.push(sec("Naposledy", `<div class="card rows">${recent.map(sessionRowHtml).join("")}</div>`,
      { right: secLink("Historie", "menu", `data-page="history"`) }));
  }

  out.push(`<div class="quick-links">
      <button class="start-opt" data-act="menu" data-page="records">${ic("trophy", 15)}<span>Rekordy</span></button>
      <button class="start-opt" data-act="menu" data-page="templates">${ic("list", 15)}<span>Templates</span></button>
      <button class="start-opt" data-act="menu" data-page="exlib">${ic("book", 15)}<span>Library</span></button>
    </div>`);
  return out.join("");
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
  const e = a && WV.openIdx != null ? a.entries[WV.openIdx] : null;
  return e ? entryRest(a, e) : (Settings.get().restSeconds || 0);
}
function youtubeUrl(exId) {
  const e = getExercise(exId);
  const q = (e && (e.nameEn || e.name)) || exName(exId);
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q + " technique");
}

/* ---- Aktivní silová session ---- */
function renderActiveSession() {
  const a = S.activeSession;
  if (a.type === "cardio") return ""; // kardio se zapisuje přímo formulářem
  const n = a.entries.length;

  const blocks = a.entries.map((entry, i) => {
    const exId = entry.exerciseId;
    const ex = getExercise(exId);
    const kind = exKind(exId);
    const pcol = catColor(ex && ex.category);   // identita partie — jen proužek
    const last = lastExerciseSets(exId, a.id);
    const target = a.editOf ? null : entryTarget(a, entry);
    const setCount = (entry.sets || []).length;
    const isOpen = WV.openIdx === i;
    const failN = entry.sets.filter(st => st.failure).length;
    const failTxt = failN ? ` · do selhání ${failN}×` : "";
    /* superset = řada cviků propojených „s dalším"; svislá linka vlevo */
    const linkPrev = i > 0 && !!a.entries[i - 1].link;
    const linkNext = !!entry.link && i < n - 1;
    const ss = linkPrev || linkNext ? ` ss${linkPrev ? " ss-prev" : ""}${linkNext ? " ss-next" : ""}` : "";
    const progress = target && target.sets ? `${setCount}/${target.sets} ${setWordTop(target.sets)}` : `${setCount} ${setWordTop(setCount)}`;

    /* --- sbalený cvik: hotový, rozdělaný, nezačatý --- */
    if (!isOpen) {
      const sub = setCount
        ? `${progress} · ${setsSummary(exId, entry.sets)}${failTxt}`
        : (planText(target, exId) || "klepni pro zápis");
      return `
      <div class="ex-row${entry.done ? " ex-done" : setCount ? " ex-active" : ""}${ss}" id="exblock-${i}" data-act="w-ex-open" data-i="${i}">
        <div class="row">
          <i class="p-stripe" style="background:${pcol}"></i>
          <span class="ex-num${entry.done ? " done" : ""}">${entry.done ? ic("check", 15, 3) : i + 1}</span>
          <div class="grow">
            <div class="name">${esc(exName(exId))}</div>
            <div class="small">${ss ? `<span class="ss-tag">superset</span> · ` : ""}${esc(sub)}${entry.prHit ? ` · <span style="color:var(--yellow);font-weight:650">PR</span>` : ""}</div>
          </div>
          ${dragHandleHtml(i)}
        </div>
      </div>`;
    }

    // předvyplnění další série podle minulého tréninku (stejný index, jinak poslední)
    const pf = last ? (last.sets[setCount] || last.sets[last.sets.length - 1]) : null;
    // návrh progrese a „blízko rekordu" patří živému tréninku, ne opravě
    // uloženého (rekord by se navíc porovnával sám se sebou)
    const prog = a.editOf ? null : progressionSuggestion(target, last, kind);
    // při splněné progresi předvyplň vyšší váhu a spodek rozsahu
    let pfReps = prog ? prog.lo : (pf ? pf.reps : (target && target.lo) || "");
    let pfWeight = prog ? fmtNum(kgOut(prog.next), 1) : (pf ? fmtNum(kgOut(pf.weight), 1) : (kind === "bw" ? "0" : ""));
    let pfNote = "";
    const started = setCount > 0;
    /* oprava série: klepnutí na sérii ji načte do polí, tlačítko ji pak přepíše */
    const es = WV.editSet && WV.editSet.i === i && entry.sets[WV.editSet.j] ? WV.editSet.j : null;
    if (es != null) {
      const st = entry.sets[es];
      pfReps = st.reps;
      pfWeight = fmtNum(kgOut(st.weight), 1);
      pfNote = st.note || "";
    }

    const sets = (entry.sets || []).map((st, j) => `
      <div class="set-row${es === j ? " editing" : ""}" data-act="w-set-edit" data-i="${i}" data-j="${j}">
        <span class="set-num">${j + 1}</span>
        <span class="grow"><span class="set-val">${setValHtml(exId, st)}</span>${st.note ? ` <span class="small">· ${esc(st.note)}</span>` : ""}</span>
        ${st.isPR ? `<span class="badge yellow" title="${esc((st.rec || []).map(t => REC_LABEL[t]).join(", "))}">PR</span>` : ""}
        ${failChipHtml(st, i, j)}
        <button class="iconbtn sm muted" data-act="w-del-set" data-i="${i}" data-j="${j}" aria-label="Smazat sérii">${ic("x", 16, 2.1)}</button>
      </div>`).join("");
    /* naplánované série, které ještě nejsou zapsané — tlumené řádky s cílem */
    const ghosts = [];
    if (target && target.sets && es == null) {
      const unit = kind === "time" ? "s" : "opak.";
      const goal = target.lo ? `${target.lo}${target.hi && target.hi !== target.lo ? "–" + target.hi : ""} ${unit}` : "";
      for (let j = setCount; j < target.sets; j++) {
        const prev = last && last.sets[j];
        ghosts.push(`<div class="set-row ghost"><span class="set-num">${j + 1}</span>
          <span class="grow">${goal}${prev ? `${goal ? " · " : ""}minule ${setShort(exId, prev)}` : ""}</span></div>`);
      }
    }

    /* poznámka, rekord, minulý výkon, návrh progrese a „blízko rekordu" */
    const pr = kind === "weight" ? currentPR(exId) : null;
    const bestR = kind !== "weight" ? exerciseRecords(exId).best.reps : null;
    const near = a.editOf ? null : nearPRHint(entry, pr);
    const hints = [
      ex && ex.pin ? `<div class="hint pin" data-act="w-pin" data-i="${i}">${ic("pin", 15)}<span>${esc(ex.pin)}</span></div>` : "",
      pr ? `<div class="hint pr">${ic("trophy", 15)}<span>Rekord <b>${fmtWeight(pr.weight)} × ${pr.reps}</b> · e1RM ${fmtWeight(pr.e1rm)}</span></div>`
        : bestR ? `<div class="hint pr">${ic("trophy", 15)}<span>Rekord <b>${setShort(exId, bestR)}</b>${kind === "bw" ? " opak." : ""}</span></div>` : "",
      last ? `<div class="hint">${ic("history", 15)}<span>Minule ${relDay(last.date)}: <b>${setsSummary(exId, last.sets)}</b></span></div>` : "",
      prog ? `<div class="hint prog">${ic("trend", 15)}<span>Progrese — minule vše ≥ ${prog.topReps} opak., zkus <b>${fmtWeight(prog.next)}</b></span></div>` : "",
      near ? `<div class="hint near">${ic("target", 15)}<span>${near}</span></div>` : ""
    ].join("");

    const planBits = [planText(target, exId), target && target.rest ? `pauza ${fmtClock(target.rest)}` : "",
      linkNext ? "superset s dalším" : linkPrev ? "superset" : ""].filter(Boolean);
    const doneEnough = target && target.sets && setCount >= target.sets;
    const sw = WV.sw && WV.sw.i === i;
    const inputs = kind === "time" ? `
      <div class="set-input">
        ${stepperHtml("reps-" + i, pfReps, 5, "Výdrž · s")}
        <div class="set-field"><span class="set-lbl">Stopky</span>
          <button class="btn sw-btn${sw ? " on" : ""}" id="sw-${i}" data-act="w-sw" data-i="${i}">${sw
            ? `${ic("check", 16, 2.6)} ${fmtClock((Date.now() - WV.sw.start) / 1000)}` : `${ic("timer", 17)} Start`}</button></div>
      </div>` : `
      <div class="set-input">
        ${stepperHtml("reps-" + i, pfReps, 1, "Opakování")}
        ${stepperHtml("weight-" + i, pfWeight, 2.5, (kind === "bw" ? "Zátěž · " : "Váha · ") + weightUnit())}
      </div>`;

    return `
    <div class="ex-open${entry.prHit ? " pr-flash" : ""}${ss}" id="exblock-${i}" data-i="${i}">
      <div class="ex-head" data-act="w-ex-close">
        <div class="grow">
          <div class="ex-cat"><i class="p-dot" style="background:${pcol}"></i>${esc((ex && ex.category) || "—")} · ${i + 1}. cvik${target && target.sets ? ` · ${progress}` : ""}</div>
          <div class="ex-title">${esc(exName(exId))}</div>
          ${exNameEn(ex) ? `<div class="name-en">${esc(exNameEn(ex))}</div>` : ""}
          ${planBits.length ? `<div class="ex-plan">${planBits.join(" · ")}</div>` : ""}
        </div>
        <div class="ex-tools">
          <button class="iconbtn soft" data-act="w-swap-ex" data-i="${i}" aria-label="Vyměnit cvik">${ic("swap", 18)}</button>
          <button class="iconbtn soft" data-act="w-ex-menu" data-i="${i}" aria-label="Další možnosti">${ic("more", 18)}</button>
        </div>
      </div>
      <details class="ex-desc"><summary>Technika ${ic("chevD", 14, 2.2)}</summary>
        ${ex && ex.description ? `<p>${esc(ex.description)}</p>` : ""}
        <a class="video-link" href="${youtubeUrl(exId)}" target="_blank" rel="noopener">${ic("play", 12)} Video na YouTube</a>
      </details>
      ${hints ? `<div class="ex-hints">${hints}</div>` : ""}
      ${sets || ghosts.length ? `<div class="sets">${sets}${ghosts.join("")}</div>` : ""}
      ${inputs}
      <details class="note-toggle"${pfNote ? " open" : ""}>
        <summary>${ic("note", 15)} Poznámka k sérii</summary>
        <input class="input" id="note-${i}" type="text" placeholder="např. pomalé negativum" value="${esc(pfNote)}">
      </details>
      <div class="ex-actions">
        ${es != null ? `
        <button class="btn primary grow" data-act="w-set-save" data-i="${i}">${ic("check", 18, 2.6)} Uložit ${es + 1}. sérii</button>
        <button class="btn ghost" data-act="w-set-cancel">Zrušit</button>` : doneEnough ? `
        <button class="btn" data-act="w-add-set" data-i="${i}">${ic("plus", 18, 2.6)} Série navíc</button>
        <button class="btn primary grow" data-act="w-ex-done" data-i="${i}">${ic("check", 18, 2.6)} ${entry.done ? "Zavřít" : "Hotovo"}</button>` : `
        <button class="btn primary grow" data-act="w-add-set" data-i="${i}">${ic("plus", 18, 2.6)} Přidat sérii</button>
        ${started ? `<button class="btn" data-act="w-ex-done" data-i="${i}">${entry.done ? "Zavřít" : "Hotovo"}</button>` : ""}`}
      </div>
      ${started && es == null ? `<p class="set-hint">Klepnutím na sérii ji opravíš.</p>` : ""}
    </div>`;
  }).join("");

  /* úprava uloženého tréninku: jde změnit i datum; uložení přepíše původní
     záznam (stejné id), zahození ho nechá, jak byl */
  const editBanner = a.editOf ? `
    <div class="card edit-card">
      <label class="field" style="margin:0"><span>Datum tréninku</span>
        <input class="input" type="date" data-change="w-edit-date" value="${a.date}"></label>
    </div>` : "";
  return `
    ${editBanner}
    ${catCounterHtml(a)}
    <div class="ex-list" id="exList">${blocks}</div>
    <button class="btn ghost full" data-act="w-add-ex">${ic("plus", 18, 2.2)} Přidat cvik</button>
    <div class="mt2">${coreCardHtml(a)}</div>
    <button class="btn primary full mt" data-act="w-finish">${ic("check", 18, 2.6)} ${a.editOf ? "Uložit změny" : "Dokončit trénink"}</button>
    <button class="btn text danger full" data-act="w-cancel">${a.editOf ? "Zahodit úpravy" : "Zrušit trénink"}</button>`;
}

/* ---- Nabídka cviku (⋯): superset, poznámka, progres, video, odebrání ---- */
function openExerciseMenu(i) {
  const a = S.activeSession;
  const entry = a && a.entries[i];
  if (!entry) return;
  const ex = getExercise(entry.exerciseId);
  const isLast = i === a.entries.length - 1;
  const item = (icon, label, act, extra = "", cls = "") => `
    <button class="more-item${cls}" data-act="${act}" data-i="${i}" ${extra}>
      <span class="mi-ic">${ic(icon, 21)}</span>${label}</button>`;
  openModal(`${modalTitle(exName(entry.exerciseId))}
    <div class="more-list">
      ${isLast ? "" : item("link", entry.link ? "Zrušit superset s dalším cvikem" : "Superset s dalším cvikem", "w-link")}
      ${item("pin", ex && ex.pin ? "Upravit poznámku ke cviku" : "Připnout poznámku ke cviku", "w-pin")}
      ${item("trend", "Progres a rekordy cviku", "pg-ex", `data-exid="${entry.exerciseId}"`)}
      <a class="more-item" href="${youtubeUrl(entry.exerciseId)}" target="_blank" rel="noopener">
        <span class="mi-ic">${ic("play", 21)}</span>Video na YouTube</a>
      ${item("trash", "Odebrat z tréninku", "w-remove-ex", "", " danger")}
    </div>`);
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

/* ---- Stopky u výdrže: klepnutí spustí, druhé klepnutí zastaví a zapíše sekundy ---- */
let _swTimer = null;
function toggleStopwatch(i) {
  const el = () => document.getElementById("sw-" + i);
  if (WV.sw && WV.sw.i === i) {
    const sec = Math.round((Date.now() - WV.sw.start) / 1000);
    WV.sw = null;
    clearInterval(_swTimer);
    const inp = document.getElementById("reps-" + i);
    if (inp) inp.value = String(sec);
    if (el()) { el().classList.remove("on"); el().innerHTML = `${ic("timer", 17)} Start`; }
    return;
  }
  WV.sw = { i, start: Date.now() };
  clearInterval(_swTimer);
  _swTimer = setInterval(() => {
    if (!WV.sw) { clearInterval(_swTimer); return; }
    const b = el();
    if (b) b.innerHTML = `${ic("check", 16, 2.6)} ${fmtClock((Date.now() - WV.sw.start) / 1000)}`;
  }, 250);
  if (el()) { el().classList.add("on"); el().innerHTML = `${ic("check", 16, 2.6)} 0:00`; }
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

/* ---- Mini check „do selhání" u série ----
   Objeví se na každé zapsané sérii mezi váhou a křížkem: klepnutí přepne
   ano/ne. Vypnutý je jen tenký kroužek s drobným popiskem, zapnutý plný
   volt kroužek s fajfkou. Ukládá se k sérii (set.failure), jen když je zapnutý. */
function failChipHtml(st, i, j) {
  const on = st.failure === true;
  return `<button class="fail-chip${on ? " on" : ""}" data-act="w-set-fail" data-i="${i}" data-j="${j}"
    aria-pressed="${on}" aria-label="Série do selhání: ${on ? "ano" : "ne"}">
    <i>${on ? ic("check", 9, 3.6) : ""}</i>selhání</button>`;
}

/* ---- Přetahování cviků v aktivním tréninku ----
   Úchyt vpravo (iOS konvence pro přeřazování). Jen úchyt má touch-action:
   none, takže tah za něj stránku nescrolluje a zbytek řádku scrolluje
   i otevírá normálně. Otevřený cvik úchyt nemá — je vysoký a zapisuje se
   do něj; přesune se po sbalení. */
function dragHandleHtml(i) {
  return `<span class="drag-handle" data-drag="${i}" aria-label="Přesunout cvik">
    <i></i><i></i><i></i></span>`;
}

/* Přesun v poli entries. Otevřený cvik musí zůstat otevřený a rozepsaná
   série v něm nesmí přetažením jiného cviku zmizet. */
function moveExercise(from, to) {
  const a = S.activeSession;
  if (!a || from === to) return;
  const keep = WV.openIdx != null
    ? ["reps", "weight", "note"].map(f => {
        const el = document.getElementById(`${f}-${WV.openIdx}`);
        return el ? el.value : null;
      })
    : null;

  WV.editSet = null;   // indexy sérií v otevřeném cviku by přestaly sedět
  const [item] = a.entries.splice(from, 1);
  a.entries.splice(to, 0, item);

  const open = WV.openIdx;
  if (open != null) {
    if (open === from) WV.openIdx = to;
    else if (from < open && to >= open) WV.openIdx = open - 1;
    else if (from > open && to <= open) WV.openIdx = open + 1;
  }
  save();
  render();
  if (keep && WV.openIdx != null) {
    ["reps", "weight", "note"].forEach((f, k) => {
      const el = document.getElementById(`${f}-${WV.openIdx}`);
      if (el && keep[k] != null) el.value = keep[k];
    });
  }
}

/* Pointer events fungují s prstem i myší. Pozice se počítají v souřadnicích
   dokumentu, takže autoscroll u okraje obrazovky nerozhodí výpočet cíle.
   Cíl = kolik ostatních řádků má střed nad středem taženého — funguje
   i s různě vysokými řádky (otevřený cvik mezi sbalenými). */
const Drag = {
  st: null,
  justDropped: 0,   // čas puštění — klik, který po něm iOS pošle, se zahodí

  start(e, handle) {
    const list = document.getElementById("exList");
    if (!list || this.st) return;
    const rows = [...list.children].filter(r => r.dataset.i != null);
    const from = Number(handle.dataset.drag);
    const row = rows[from];
    if (!row) return;
    e.preventDefault();
    try { handle.setPointerCapture(e.pointerId); } catch (_) {}
    const rects = rows.map(r => r.getBoundingClientRect());
    this.st = {
      pid: e.pointerId, rows, row, from, to: from,
      startY: e.clientY, lastY: e.clientY, startScroll: window.scrollY,
      tops: rects.map(r => r.top + window.scrollY),
      heights: rects.map(r => r.height),
      gap: rows.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 8,
      raf: 0
    };
    row.classList.add("dragging");
    document.body.classList.add("is-dragging");
    this.loop();
  },

  move(e) {
    if (!this.st || e.pointerId !== this.st.pid) return;
    this.st.lastY = e.clientY;
    this.layout();
  },

  layout() {
    const st = this.st;
    const dy = st.lastY - st.startY + (window.scrollY - st.startScroll);
    st.row.style.transform = `translateY(${dy}px) scale(1.02)`;
    const center = st.tops[st.from] + st.heights[st.from] / 2 + dy;
    let to = 0;
    for (let k = 0; k < st.rows.length; k++) {
      if (k !== st.from && center > st.tops[k] + st.heights[k] / 2) to++;
    }
    st.to = to;
    const shift = st.heights[st.from] + st.gap;
    st.rows.forEach((r, k) => {
      if (k === st.from) return;
      let t = 0;
      if (st.from < to && k > st.from && k <= to) t = -shift;
      else if (st.from > to && k >= to && k < st.from) t = shift;
      r.style.transform = t ? `translateY(${t}px)` : "";
    });
  },

  /* autoscroll, když prst dojede k okraji — dole počítá s navigací
     a zamčeným timerem nad ní */
  loop() {
    const st = this.st;
    if (!st) return;
    const top = 110;
    const bottom = window.innerHeight - (document.body.classList.contains("has-dock") ? 210 : 150);
    let v = 0;
    if (st.lastY < top) v = -Math.ceil((top - st.lastY) / 5);
    else if (st.lastY > bottom) v = Math.ceil((st.lastY - bottom) / 5);
    if (v) { window.scrollBy(0, v); this.layout(); }
    st.raf = requestAnimationFrame(() => this.loop());
  },

  end(e) {
    const st = this.st;
    if (!st || (e && e.pointerId !== st.pid)) return;
    cancelAnimationFrame(st.raf);
    this.st = null;
    this.justDropped = Date.now();
    document.body.classList.remove("is-dragging");

    /* dosednutí: tažený řádek doklouže do svého slotu, pak se překreslí */
    const { from, to, row, tops, heights } = st;
    const target = to > from ? tops[to] + heights[to] - heights[from]
      : to < from ? tops[to] : tops[from];
    row.classList.remove("dragging");
    row.classList.add("settling");
    row.style.transform = `translateY(${target - tops[from]}px)`;
    setTimeout(() => {
      if (to !== from) moveExercise(from, to);
      else { st.rows.forEach(r => { r.style.transform = ""; }); row.classList.remove("settling"); }
    }, 170);
  }
};

/* ---- Stepper pro sérii ----
   Se zpocenou rukou je klávesnice nepřítel: ± mění hodnotu jedním klepnutím,
   pole zůstává editovatelné, když chceš zadat číslo přesně. */
function stepperHtml(id, value, step, label) {
  return `
    <div class="set-field">
      <span class="set-lbl">${esc(label)}</span>
      <div class="set-step">
        <button class="step-btn sm" data-act="w-step" data-id="${id}" data-d="${-step}" aria-label="Méně">${ic("minus", 20, 2.3)}</button>
        <input class="input step-in" id="${id}" type="text" inputmode="decimal" value="${value}">
        <button class="step-btn sm" data-act="w-step" data-id="${id}" data-d="${step}" aria-label="Více">${ic("plus", 20, 2.3)}</button>
      </div>
    </div>`;
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
  const bar = CAT_ORDER.map(c => `
    <i class="${sets[c] || ticked(c) ? "" : "zero"}" style="background:${catColor(c)}" title="${c}">
      <b>${ticked(c) ? "✓" : sets[c]}</b>
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
      <span class="cat-v">${ticked(c) ? "✓" : `<b>${exs[c]}</b><s>·</s>${sets[c]}`}</span>
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

/* Návrh progrese (double progression): minule všechny série na horní hranici
   rozsahu z plánu → zkus vyšší váhu. Rozsah je z plánu v šabloně, jinak
   z popisu cviku („3× 8–12 …"). U výdrže a cviků bez váhy se nenavrhuje. */
function progressionSuggestion(target, last, kind) {
  if (!target || !target.hi || !last || !last.sets.length || kind === "time") return null;
  if (!last.sets.every(st => st.reps >= target.hi)) return null;
  const maxW = Math.max(...last.sets.map(st => st.weight || 0));
  if (!maxW) return null;
  return { lo: target.lo || target.hi, topReps: target.hi, next: maxW + 2.5 };
}

/* „Blízko rekordu" — po zapsané sérii spočítá, co chybí k PR.
   Ukazuje se jen dokud rekord v této session nepadl. */
function nearPRHint(entry, pr) {
  const sets = entry.sets || [];
  if (!pr || !sets.length || sets.some(s => s.isPR)) return null;
  const last = sets[sets.length - 1];
  if (!last.weight || !last.reps) return null;
  for (let extra = 1; extra <= 3; extra++) {
    if (est1RM(last.weight, last.reps + extra) > pr.e1rm) {
      return `Blízko rekordu — ještě <b>${extra} ${plural(extra, "opakování", "opakování", "opakování")}</b> navíc při ${fmtWeight(last.weight)}`;
    }
  }
  for (const add of [1.25, 2.5, 5]) {
    if (est1RM(last.weight + add, last.reps) > pr.e1rm) {
      return `Blízko rekordu — přidej <b>${fmtWeight(add)}</b> při ${last.reps} opak.`;
    }
  }
  return null;
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
      const t = tplPlan(tpl, exId);
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
      const t = tplPlan(tpl, e.exerciseId) || ((e.sets || []).length ? { sets: e.sets.length, lo: null, hi: null, rest: null } : null);
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

/* Hodnoty série z polí podle druhu cviku; null = chyba (už ohlášená toastem) */
function readSetInputs(i, kind) {
  const reps = parseInt(document.getElementById(`reps-${i}`).value, 10);
  const wEl = document.getElementById(`weight-${i}`);
  const wRaw = wEl ? wEl.value.trim() : "";
  const weight = kind === "time" ? 0 : (wRaw === "" && kind === "bw" ? 0 : kgIn(wRaw));
  const note = document.getElementById(`note-${i}`).value.trim();
  if (!reps || reps <= 0) { toast(kind === "time" ? "Zadej délku výdrže" : "Zadej počet opakování", "err"); return null; }
  if (weight == null || weight < 0) { toast("Zadej váhu", "err"); return null; }
  return { reps, weight, note: note || null };
}

function addSet(i) {
  const a = S.activeSession;
  const entry = a.entries[i];
  const set = readSetInputs(i, exKind(entry.exerciseId));
  if (!set) return;
  if (WV.sw && WV.sw.i === i) { WV.sw = null; clearInterval(_swTimer); }

  const types = liveRecordTypes(entry.exerciseId, set, entry.sets, a.id);
  if (types.length) {
    set.isPR = true;
    set.rec = types;
    entry.prHit = true;
    toast(`Rekord — ${exName(entry.exerciseId)}: ${types.map(t => REC_LABEL[t]).join(", ")}`, "pr");
  }
  entry.sets.push(set);
  WV.editSet = null;
  /* superset: bez pauzy na další cvik řady; po posledním pauza a zpět na první */
  const n = a.entries.length;
  if (entry.link && i < n - 1) {
    WV.openIdx = i + 1;
  } else {
    // při zpětné úpravě se pauza nespouští — necvičí se, jen opravuje
    if (!a.editOf) Rest.start(entryRest(a, entry));
    if (i > 0 && a.entries[i - 1].link) {
      let s0 = i;
      while (s0 > 0 && a.entries[s0 - 1].link) s0--;
      WV.openIdx = s0;
    }
  }
  save();
  render();
  if (WV.openIdx !== i) {
    const el = document.getElementById("exblock-" + WV.openIdx);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

/* Oprava zapsané série — přepíše hodnoty na místě, rekord se přepočítá */
function saveSetEdit(i) {
  const a = S.activeSession;
  const entry = a && a.entries[i];
  const j = WV.editSet && WV.editSet.i === i ? WV.editSet.j : null;
  if (!entry || j == null || !entry.sets[j]) { WV.editSet = null; render(); return; }
  const set = readSetInputs(i, exKind(entry.exerciseId));
  if (!set) return;
  if (entry.sets[j].failure) set.failure = true;   // oprava čísel nemění „do selhání"
  entry.sets[j] = set;
  refreshEntryRecords(a, entry);
  WV.editSet = null;
  save();
  render();
  toast(`${j + 1}. série opravena ✓`, "ok");
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
        { reps: st.reps, weight: st.weight, note: st.note || null }, st.failure ? { failure: true } : {})), done: true, target: null },
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
      { exerciseId: e.exerciseId, sets: e.sets.map(({ reps, weight, note, failure }) =>
        Object.assign({ reps, weight, note }, failure ? { failure: true } : {})) },
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
  const recRows = recs.slice(0, 8).map(ev => `
    <div class="list-item">
      <i class="p-stripe" style="background:${exColor(ev.exerciseId)}"></i>
      <div class="grow">
        <div class="name">${esc(exName(ev.exerciseId))}</div>
        <div class="li-sub" style="color:var(--yellow)">${ev.types.map(t => REC_LABEL[t]).join(", ")}</div>
      </div>
      <span class="li-val">${setShort(ev.exerciseId, ev)}</span>
    </div>`).join("");

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

  WV.rateVal = null;
  const chips = Array.from({ length: 10 }, (_, k) => k + 1).map(n =>
    `<button class="scale-chip ratechip" data-act="w-rate-chip" data-val="${n}">${n}</button>`).join("");
  openModal(`${modalTitle("Trénink uložen")}
    <p class="modal-sub">${esc(sessionLabel(s))} · ${relDay(s.date)}${s.startedAt ? ` · začátek ${fmtTime(s.startedAt)}` : ""}</p>
    <div class="card">
      <div class="stats">
        ${statHtml(s.entries.length, plural(s.entries.length, "cvik", "cviky", "cviků"), prev ? deltaHtml(s.entries.length, prev.entries.length) : "")}
        ${statHtml(sets, setWordTop(sets), prev ? deltaHtml(sets, sessionSets(prev), true) : "")}
        ${statHtml(`${v.val}<small>${v.unit}</small>`, "objem", prev ? deltaHtml(vol, sessionVolume(prev), true) : "")}
      </div>
      ${prev ? `<div class="chart-cap">Proti minulému tréninku ${esc(sessionLabel(prev))} · ${relDay(prev.date)}</div>` : ""}
      <hr class="hair">
      <div class="row between" style="margin-bottom:9px">
        <span class="cap">Partie</span>
        <span class="cap"><b style="color:var(--text)">${CAT_ORDER.length - zero.length}</b> ze ${CAT_ORDER.length}</span>
      </div>
      ${catPipsHtml(counts, s.core === true)}
      ${zero.length ? `<div class="small warn-text" style="margin-top:9px">Bez série: ${zero.join(", ")}</div>` : ""}
    </div>
    ${recs.length ? `<div class="h3" style="margin-top:20px">${recs.length} ${plural(recs.length, "rekord", "rekordy", "rekordů")}</div>
      <div class="card rows">${recRows}</div>${recs.length > 8 ? `<p class="small" style="margin:-4px 4px 10px">a ${recs.length - 8} dalších</p>` : ""}` : ""}
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
       <span class="grow"><span class="set-val">${setValHtml(e.exerciseId, st)}</span>${st.note ? ` <span class="small">· ${esc(st.note)}</span>` : ""}</span>
       ${recSet.has(`${k}|${j}`) ? `<span class="badge yellow">PR</span>` : ""}
       ${st.failure ? `<span class="fail-chip on static"><i>${ic("check", 9, 3.6)}</i>selhání</span>` : ""}</div>`).join("");
    return `<div class="detail-ex">
      <div class="row" style="gap:10px;margin-bottom:4px"><i class="p-stripe" style="background:${exColor(e.exerciseId)}"></i>
        <b style="font-size:15.5px" class="grow">${esc(exName(e.exerciseId))}</b>${linked ? `<span class="ss-tag">superset</span>` : ""}</div>${sets}</div>`;
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
      ${recSet.size ? `<span class="badge yellow">${ic("trophy", 12, 2.2)} ${recSet.size}</span>` : ""}
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

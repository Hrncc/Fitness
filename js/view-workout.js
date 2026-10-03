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
  sportChoice: CARDIO_SPORTS[0]
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
    const dateInfo = a.date !== todayStr() ? `${fmtShort(a.date)} · ` : "";
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

  /* hrdina: šablona na řadě */
  if (next) {
    const last = lastWeightsSession();
    const exs = next.exercises.filter(getExercise);
    const preview = exs.slice(0, 5).map(id =>
      `<div><i class="p-dot" style="background:${exColor(id)}"></i>${esc(exName(id))}</div>`).join("")
      + (exs.length > 5 ? `<div class="more">+ ${exs.length - 5} ${plural(exs.length - 5, "další", "další", "dalších")}</div>` : "");
    const g = lastSessionGaps();
    const gaps = g ? [...g.missed.map(m => m.cat), ...g.low.map(l => l.cat)] : [];
    out.push(`
      <div class="card next-card">
        <div class="td-eyebrow">Na řadě${day !== today ? ` · ${fmtShort(day)}` : ""}</div>
        <div class="td-title">${esc(next.name)}</div>
        <div class="td-meta">${exs.length} ${plural(exs.length, "cvik", "cviky", "cviků")}${last ? ` · naposledy ${relDay(last.date)}` : ""}</div>
        <div class="next-list">${preview}</div>
        ${gaps.length ? `<div class="td-warn" style="margin:-4px 0 16px">${ic("alert", 15)}Minule uteklo: ${gaps.join(", ")}</div>` : ""}
        <button class="btn primary full" data-act="w-begin" data-template="${next.id}">${ic("play", 15)} Začít trénink</button>
      </div>`);
  }

  /* ostatní šablony + volný trénink + kardio */
  const others = S.templates.filter(t => !next || t.id !== next.id).map(t => {
    const n = t.exercises.length;
    const counts = {};
    for (const id of t.exercises) { const c = exCategory(id); if (c) counts[c] = (counts[c] || 0) + 1; }
    return `<div class="list-item tpl-row" data-act="w-begin" data-template="${t.id}">
      <div class="grow">
        <div class="name">${esc(t.name)}</div>
        <div class="li-sub">${n} ${plural(n, "cvik", "cviky", "cviků")}</div>
      </div>
      <span class="tpl-play">${ic("play", 13)}</span>
    </div>`;
  }).join("");
  out.push(sec(next ? "Jiný trénink" : "Trénink", `
    <div class="card rows">
      ${others}
      <div class="list-item tpl-row" data-act="w-begin" data-template="custom">
        <div class="grow"><div class="name">Volný trénink</div><div class="li-sub">cviky vybereš průběžně</div></div>
        <span class="tpl-play">${ic("plus", 16, 2.2)}</span>
      </div>
      <div class="list-item tpl-row" data-act="w-cardio">
        <div class="grow"><div class="name">Kardio</div><div class="li-sub">sport, čas, vzdálenost</div></div>
        <span class="tpl-play" style="color:var(--p-cardio)">${ic("flame", 16)}</span>
      </div>
    </div>`));

  /* poslední tréninky */
  const recent = S.sessions.filter(s => !(daySessions.includes(s)))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id))).slice(0, 5);
  if (recent.length) {
    out.push(sec("Poslední tréninky", `<div class="card rows">${recent.map(sessionRowHtml).join("")}</div>`,
      { right: secLink("Historie", "menu", `data-page="history"`) }));
  }

  out.push(sec("", `
    <div class="card rows">
      ${menuRow("trophy", "Rekordy", "records")}
      ${menuRow("list", "Workout Templates", "templates")}
      ${menuRow("book", "Exercise Library", "exlib")}
    </div>`));
  return out.join("");
}

function menuRow(icon, label, page) {
  return `<div class="list-item" data-act="menu" data-page="${page}">
    <span class="chev" style="color:var(--text2)">${ic(icon, 20)}</span>
    <div class="grow name">${label}</div><span class="chev">${ic("chevR", 18)}</span></div>`;
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
      <div class="li-sub">${s.entries.length} cviků · ${sets} ${setWordTop(sets)}${sessionVolume(s) ? ` · ${vol.val} ${vol.unit}` : ""}</div>
      ${catPipsHtml(sessionCatSets(s), s.core === true)}
    </div>
    ${prs ? `<span class="badge yellow">${ic("trophy", 12, 2.2)} ${prs}</span>` : ""}
    <span class="chev">${ic("chevR", 18)}</span>
  </div>`;
}

/* Kolik rekordů v tréninku padlo (události PR v den tréninku u jeho cviků) */
function sessionPRCount(s) {
  if (s.type !== "weights") return 0;
  let n = 0;
  for (const id of new Set(s.entries.map(e => e.exerciseId))) {
    n += prHistory(id).filter(h => h.date === s.date).length;
  }
  return n;
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
  const cal = calendarHtml(y, m, ds => {
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
    </div>
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

/* ---- Aktivní silová session ---- */
function renderActiveSession() {
  const a = S.activeSession;
  if (a.type === "cardio") return ""; // kardio se zapisuje přímo formulářem

  const blocks = a.entries.map((entry, i) => {
    const ex = getExercise(entry.exerciseId);
    const pcol = catColor(ex && ex.category);   // identita partie — jen proužek
    const pr = currentPR(entry.exerciseId);
    const last = lastExerciseSets(entry.exerciseId, a.id);
    const setCount = (entry.sets || []).length;
    const isOpen = WV.openIdx === i;
    const summary = entry.sets.map(st => `${st.reps}×${fmtNum(kgOut(st.weight), 1)}`).join(" · ");
    const failN = entry.sets.filter(st => st.failure).length;
    const failTxt = failN ? ` · do selhání ${failN}×` : "";

    /* --- sbalený cvik: hotový, rozdělaný, nezačatý --- */
    if (!isOpen) {
      const sub = setCount
        ? `${setCount} ${setWordTop(setCount)} · ${summary} ${weightUnit()}${failTxt}`
        : (planShort(ex) || "klepni pro zápis");
      return `
      <div class="ex-row${entry.done ? " ex-done" : setCount ? " ex-active" : ""}" id="exblock-${i}" data-act="w-ex-open" data-i="${i}">
        <div class="row">
          <i class="p-stripe" style="background:${pcol}"></i>
          <span class="ex-num${entry.done ? " done" : ""}">${entry.done ? ic("check", 15, 3) : i + 1}</span>
          <div class="grow">
            <div class="name">${esc(exName(entry.exerciseId))}</div>
            <div class="small">${esc(sub)}${entry.prHit ? ` · <span style="color:var(--yellow);font-weight:650">PR</span>` : ""}</div>
          </div>
          ${dragHandleHtml(i)}
        </div>
      </div>`;
    }

    // předvyplnění další série podle minulého tréninku (stejný index, jinak poslední)
    const pf = last ? (last.sets[setCount] || last.sets[last.sets.length - 1]) : null;
    // návrh progrese a „blízko rekordu" patří živému tréninku, ne opravě
    // uloženého (rekord by se navíc porovnával sám se sebou)
    const prog = a.editOf ? null : progressionSuggestion(ex, last);
    // při splněné progresi předvyplň vyšší váhu a spodek rep range
    let pfReps = prog ? prog.lo : (pf ? pf.reps : "");
    let pfWeight = prog ? fmtNum(kgOut(prog.next), 1) : (pf ? fmtNum(kgOut(pf.weight), 1) : "");
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
        <span class="grow"><span class="set-val">${fmtNum(st.reps)}<span>×</span>${fmtWeight(st.weight)}</span>${st.note ? ` <span class="small">· ${esc(st.note)}</span>` : ""}</span>
        ${st.isPR ? `<span class="badge yellow">PR</span>` : ""}
        ${failChipHtml(st, i, j)}
        <button class="iconbtn sm muted" data-act="w-del-set" data-i="${i}" data-j="${j}" aria-label="Smazat sérii">${ic("x", 16, 2.1)}</button>
      </div>`).join("");

    /* rekord, minulý výkon, návrh progrese a „blízko rekordu" */
    const near = a.editOf ? null : nearPRHint(entry, pr);
    const hints = [
      pr ? `<div class="hint pr">${ic("trophy", 15)}<span>Rekord <b>${fmtWeight(pr.weight)} × ${pr.reps}</b> · e1RM ${fmtWeight(pr.e1rm)}</span></div>` : "",
      last ? `<div class="hint">${ic("history", 15)}<span>Minule ${relDay(last.date)}: <b>${last.sets.map(st => `${st.reps}×${fmtNum(kgOut(st.weight), 1)}`).join(" · ")}</b> ${weightUnit()}</span></div>` : "",
      prog ? `<div class="hint prog">${ic("trend", 15)}<span>Progrese — minule vše ≥ ${prog.topReps} opak., zkus <b>${fmtWeight(prog.next)}</b></span></div>` : "",
      near ? `<div class="hint near">${ic("target", 15)}<span>${near}</span></div>` : ""
    ].join("");

    return `
    <div class="ex-open${entry.prHit ? " pr-flash" : ""}" id="exblock-${i}" data-i="${i}">
      <div class="ex-head" data-act="w-ex-close">
        <div class="grow">
          <div class="ex-cat"><i class="p-dot" style="background:${pcol}"></i>${esc((ex && ex.category) || "—")} · ${i + 1}. cvik</div>
          <div class="ex-title">${esc(exName(entry.exerciseId))}</div>
          ${exNameEn(ex) ? `<div class="name-en">${esc(exNameEn(ex))}</div>` : ""}
        </div>
        <div class="ex-tools">
          <button class="iconbtn soft" data-act="w-swap-ex" data-i="${i}" aria-label="Vyměnit cvik">${ic("swap", 18)}</button>
          <button class="iconbtn soft danger" data-act="w-remove-ex" data-i="${i}" aria-label="Odebrat cvik">${ic("trash", 18)}</button>
        </div>
      </div>
      ${ex && ex.description ? `<details class="ex-desc"><summary>Technika ${ic("chevD", 14, 2.2)}</summary><p>${esc(ex.description)}</p></details>` : ""}
      ${hints ? `<div class="ex-hints">${hints}</div>` : ""}
      ${sets ? `<div class="sets">${sets}</div>` : ""}
      <div class="set-input">
        ${stepperHtml("reps-" + i, pfReps, 1, "Opakování")}
        ${stepperHtml("weight-" + i, pfWeight, 2.5, "Váha · " + weightUnit())}
      </div>
      <details class="note-toggle"${pfNote ? " open" : ""}>
        <summary>${ic("note", 15)} Poznámka k sérii</summary>
        <input class="input" id="note-${i}" type="text" placeholder="např. pomalé negativum" value="${esc(pfNote)}">
      </details>
      <div class="ex-actions">
        ${es != null ? `
        <button class="btn primary grow" data-act="w-set-save" data-i="${i}">${ic("check", 18, 2.6)} Uložit ${es + 1}. sérii</button>
        <button class="btn ghost" data-act="w-set-cancel">Zrušit</button>` : `
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

/* Krátký plán z popisu cviku ("3× 8–15 — Kontrolované negativum…" → "3× 8–15") */
function planShort(ex) {
  if (!ex || !ex.description) return "";
  const head = ex.description.split("—")[0].trim();
  return head.length <= 24 ? head : "";
}

/* Návrh progrese (double progression): minule všechny série na horní hranici
   rep range z plánu → zkus vyšší váhu. Range se čte z popisu ("3× 8–12 …"). */
function progressionSuggestion(ex, last) {
  if (!ex || !ex.description || !last || !last.sets.length) return null;
  const m = /×\s*(\d+)\s*[–-]\s*(\d+)/.exec(ex.description);
  if (!m) return null;
  const lo = parseInt(m[1], 10), hi = parseInt(m[2], 10);
  if (!last.sets.every(st => st.reps >= hi)) return null;
  const maxW = Math.max(...last.sets.map(st => st.weight || 0));
  if (!maxW) return null;
  return { lo, topReps: hi, next: maxW + 2.5 };
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
    entries: tpl ? tpl.exercises.filter(getExercise).map(exId => ({ exerciseId: exId, sets: [] })) : []
  };
  save();
  render({ top: true });
  if (!tpl) openExercisePicker(null);
}

function addSet(i) {
  const a = S.activeSession;
  const reps = parseInt(document.getElementById(`reps-${i}`).value, 10);
  const weight = kgIn(document.getElementById(`weight-${i}`).value);
  const note = document.getElementById(`note-${i}`).value.trim();
  if (!reps || reps <= 0) { toast("Zadej počet opakování", "err"); return; }
  if (weight == null || weight < 0) { toast("Zadej váhu", "err"); return; }

  const entry = a.entries[i];
  const prevBest = currentPR(entry.exerciseId);
  const set = { reps, weight, note: note || null };
  if (est1RM(weight, reps) > (prevBest ? prevBest.e1rm : 0)) {
    set.isPR = true;
    entry.prHit = true;
    toast(`Nový osobní rekord — ${exName(entry.exerciseId)}!`, "pr");
  }
  entry.sets.push(set);
  save();
  // při zpětné úpravě se pauza nespouští — necvičí se, jen opravuje
  if (!a.editOf) Rest.start(Settings.get().restSeconds);
  render();
}

/* Oprava zapsané série — přepíše hodnoty na místě, rekord se přepočítá */
function saveSetEdit(i) {
  const a = S.activeSession;
  const entry = a && a.entries[i];
  const j = WV.editSet && WV.editSet.i === i ? WV.editSet.j : null;
  if (!entry || j == null || !entry.sets[j]) { WV.editSet = null; render(); return; }
  const reps = parseInt(document.getElementById(`reps-${i}`).value, 10);
  const weight = kgIn(document.getElementById(`weight-${i}`).value);
  const note = document.getElementById(`note-${i}`).value.trim();
  if (!reps || reps <= 0) { toast("Zadej počet opakování", "err"); return; }
  if (weight == null || weight < 0) { toast("Zadej váhu", "err"); return; }
  const prevBest = currentPR(entry.exerciseId);
  const set = { reps, weight, note: note || null };
  if (entry.sets[j].failure) set.failure = true;   // oprava čísel nemění „do selhání"
  if (est1RM(weight, reps) > (prevBest ? prevBest.e1rm : 0)) set.isPR = true;
  entry.sets[j] = set;
  entry.prHit = entry.sets.some(st => st.isPR);
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
        { reps: st.reps, weight: st.weight, note: st.note || null }, st.failure ? { failure: true } : {})), done: true },
      e.exerciseName ? { exerciseName: e.exerciseName } : {}))
  };
  WV.openIdx = null;
  WV.editSet = null;
  App.route = { tab: "workout", page: null };
  save();
  render({ top: true });
}

function finishWorkout() {
  const a = S.activeSession;
  const entries = a.entries
    .filter(e => (e.sets || []).length)
    .map(e => Object.assign(
      { exerciseId: e.exerciseId, sets: e.sets.map(({ reps, weight, note, failure }) =>
        Object.assign({ reps, weight, note }, failure ? { failure: true } : {})) },
      e.exerciseName ? { exerciseName: e.exerciseName } : {}));
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
  const prCount = a.entries.reduce((n, e) => n + (e.sets || []).filter(s => s.isPR).length, 0);
  const sessionId = a.id;
  S.sessions.push({ id: sessionId, date: a.date, type: "weights", templateUsed: a.templateUsed,
    templateName: a.templateName || null, core: a.core === true, entries });
  S.activeSession = null;
  WV.openIdx = null;
  WV.editSet = null;
  Rest.stop();
  save();
  render({ top: true });
  toast(prCount ? `Trénink uložen — ${prCount}× nový PR!` : "Trénink uložen ✓", prCount ? "pr" : "ok");
  openRatingModal(sessionId);
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

/* ---- Osobní rekordy (stránka) ---- */
function renderPRList() {
  const prs = allPRs();
  if (!prs.length) return `<div class="card"><div class="empty-note">Zatím žádné rekordy.<br>Zapiš první silový trénink!</div></div>`;
  const t = todayStr();
  const recent = countPRsInRange(addDays(t, -29), t);
  const rows = prs.map(({ exerciseId, pr }) => `
    <div class="list-item" data-act="w-pr-history" data-exid="${exerciseId}">
      <i class="p-stripe" style="background:${exColor(exerciseId)}"></i>
      <div class="grow">
        <div class="name">${esc(exName(exerciseId))}</div>
        <div class="li-sub">${relDay(pr.date)} · e1RM ${fmtWeight(pr.e1rm)}</div>
      </div>
      <div class="li-val" style="color:var(--yellow)">${fmtWeight(pr.weight)} × ${pr.reps}</div>
    </div>`).join("");
  return `
    <div class="card">
      <div class="stats two">
        ${statHtml(prs.length, plural(prs.length, "cvik s rekordem", "cviky s rekordem", "cviků s rekordem"))}
        ${statHtml(recent, "nových za 30 dní", "", recent ? "pr" : "")}
      </div>
    </div>
    <div class="card rows">${rows}</div>
    <p class="small" style="margin:4px 4px 0">e1RM = odhad maxima na 1 opakování (Epley). Klepni na cvik pro historii.</p>`;
}

function openPRHistory(exerciseId) {
  const hist = prHistory(exerciseId).slice().reverse();
  const rows = hist.map((h, idx) => `
    <div class="list-item">
      <div class="grow">
        <div class="name">${fmtWeight(h.weight)} × ${h.reps}</div>
        <div class="li-sub">${fmtDate(h.date)}</div>
      </div>
      ${idx === 0 ? `<span class="badge yellow">aktuální</span>` : ""}
      <span class="li-val small" style="min-width:90px">e1RM ${fmtWeight(h.e1rm)}</span>
    </div>`).join("");
  openModal(`${modalTitle(exName(exerciseId))}
    <p class="modal-sub">Historie rekordů</p>
    ${rows || `<div class="empty-note">Žádná historie</div>`}`);
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
  const blocks = s.entries.map(e => {
    const sets = (e.sets || []).map((st, j) =>
      `<div class="set-row"><span class="set-num">${j + 1}</span>
       <span class="grow"><span class="set-val">${fmtNum(st.reps)}<span>×</span>${fmtWeight(st.weight)}</span>${st.note ? ` <span class="small">· ${esc(st.note)}</span>` : ""}</span>
       ${st.failure ? `<span class="fail-chip on static"><i>${ic("check", 9, 3.6)}</i>selhání</span>` : ""}</div>`).join("");
    return `<div class="detail-ex">
      <div class="row" style="gap:10px;margin-bottom:4px"><i class="p-stripe" style="background:${exColor(e.exerciseId)}"></i>
        <b style="font-size:15.5px">${esc(exName(e.exerciseId))}</b></div>${sets}</div>`;
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
      ${s.rating ? `<span class="badge">${s.rating}/10</span>` : ""}
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
    ${coreRow}${blocks}</div>`;
}

function openSessionDetail(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return;
  openModal(`${modalTitle(capFirst(`${CZ_DAYS_FULL[parseDate(s.date).getDay()]} ${fmtShort(s.date)}`))}${sessionDetailHtml(s)}`);
}

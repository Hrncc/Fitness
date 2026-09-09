/* ===== Obrazovka: Trénink — log a osobní rekordy =====
   Barevná logika: volt = akce (tlačítka, chipy), zlatá = rekordy,
   žlutá = probíhá, neutrální štítky = typ tréninku/sport. */
"use strict";

const CARDIO_SPORTS = ["Běh", "Chůze", "Kolo", "Plavání", "Veslování", "Švihadlo", "Eliptický", "Turistika", "Jiné"];

const WV = {
  sub: "log",                 // log | pr
  date: todayStr(),           // den, do kterého se zapisuje (i zpětně/dopředně)
  openIdx: null,              // rozbalený cvik v aktivní session (akordeon)
  counterOpen: false,         // counter partií: pruh (false) | detail s cviky (true)
  pickerIndex: null,          // null = přidání cviku, číslo = výměna na indexu
  sportChoice: CARDIO_SPORTS[0]
};

function renderWorkout() {
  const tabs = `
    <div class="subtabs">
      <button class="subtab${WV.sub === "pr" ? "" : " on"}" data-act="w-sub" data-sub="log">Log</button>
      <button class="subtab${WV.sub === "pr" ? " on" : ""}" data-act="w-sub" data-sub="pr">Rekordy</button>
    </div>`;
  if (WV.sub === "pr") return tabs + renderPRList();
  return tabs + (S.activeSession ? renderActiveSession() : renderWorkoutStart());
}

/* ---- Navigace po dnech (zpětné i plánované tréninky) ---- */
function workoutDayNav() {
  const day = WV.date;
  const today = todayStr();
  const isToday = day === today;
  const hint = isToday ? "" : (day > today ? "budoucí den · plánování" : "klepni pro výběr data");
  return `
    <div class="card" style="padding:10px 14px">
      <div class="row between">
        <button class="btn sm ghost" data-act="w-day-nav" data-dir="-1">‹</button>
        <div class="center" style="position:relative;flex:1">
          <b>${isToday ? "Dnes" : fmtDate(day)}</b>
          ${hint ? `<div class="small">${hint}</div>` : ""}
          <input type="date" data-change="w-date" value="${day}"
            style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer">
        </div>
        <button class="btn sm ghost" data-act="w-day-nav" data-dir="1">›</button>
      </div>
      ${isToday ? "" : `<button class="btn sm full mt" style="border-color:var(--green);color:var(--green)" data-act="w-day-today">Zpět na dnešek</button>`}
    </div>`;
}

/* ---- Krok 1+2: volba typu tréninku ---- */
function renderWorkoutStart() {
  const day = WV.date;
  const isToday = day === todayStr();
  const next = nextTemplate();
  const tplBtns = S.templates.map(t => {
    const on = next && t.id === next.id;
    return `<button class="btn${on ? " primary" : ""}" style="flex:1 1 40%${on ? "" : ";border-color:var(--green);color:var(--green)"}"
      data-act="w-begin" data-template="${t.id}">${esc(t.name)}${on ? " ·&nbsp;na řadě" : ""}</button>`;
  }).join("");

  const daySessions = sessionsOn(day);
  const sessRows = daySessions.map(s => {
    if (s.type === "cardio") {
      const c = s.entries[0] || {};
      return `<div class="list-item">
        <span class="badge neutral">${esc(cardioLabel(c))}</span>
        <div class="grow name">${fmtNum(c.duration)} min${c.distance ? ` · ${fmtNum(c.distance, 2)} km` : ""}</div>
        <button class="btn sm ghost" data-act="w-detail" data-id="${s.id}">Detail</button>
      </div>`;
    }
    const sets = s.entries.reduce((n, e) => n + (e.sets || []).length, 0);
    return `<div class="list-item">
      <span class="badge neutral">${esc(sessionLabel(s))}</span>
      <div class="grow name">${s.entries.length} cviků · ${sets} sérií</div>
      <button class="btn sm ghost" data-act="w-detail" data-id="${s.id}">Detail</button>
    </div>`;
  }).join("");

  return workoutDayNav() + lastGapsHtml() + `
    <div class="card">
      <div class="h2">Silový trénink</div>
      <div class="row" style="flex-wrap:wrap;gap:8px">${tplBtns}</div>
      <button class="btn full mt" style="border-color:var(--green);color:var(--green)" data-act="w-begin" data-template="custom">Libovolný cvik (mimo šablonu)</button>
    </div>
    <div class="card">
      <div class="h2">Kardio</div>
      <p class="muted" style="margin:0 0 12px">Vyber sport a zapiš čas, vzdálenost, kalorie.</p>
      <button class="btn primary full" data-act="w-cardio">Zapsat kardio</button>
    </div>
    ${daySessions.length ? `<div class="card">
      <div class="h2">Zapsané tréninky · ${isToday ? "dnes" : fmtDate(day)}</div>${sessRows}
    </div>` : ""}`;
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
    const setWord = n => n === 1 ? "série" : n < 5 ? "série" : "sérií";

    /* --- sbalený hotový cvik --- */
    if (entry.done && !isOpen) {
      return `
      <div class="ex-row ex-done" id="exblock-${i}" data-act="w-ex-open" data-i="${i}">
        <div class="row">
          <i class="p-stripe" style="background:${pcol}"></i>
          <span class="done-check">✓</span>
          <div class="grow">
            <div class="name" style="font-weight:700">${esc(ex ? ex.name : "?")}</div>
            <div class="small">${setCount} ${setWord(setCount)} · ${summary} ${weightUnit()}${entry.prHit ? ` · <span style="color:var(--yellow);font-weight:700">PR!</span>` : ""}</div>
          </div>
          <span class="small">upravit</span>
        </div>
      </div>`;
    }

    /* --- sbalený cvik (nezačatý nebo rozdělaný) --- */
    if (!isOpen) {
      const sub = setCount
        ? `${setCount} ${setWord(setCount)} · ${summary} ${weightUnit()}`
        : (planShort(ex) || "klepni pro zápis");
      return `
      <div class="ex-row ex-collapsed${setCount ? " ex-active" : ""}" id="exblock-${i}" data-act="w-ex-open" data-i="${i}">
        <div class="row">
          <i class="p-stripe" style="background:${pcol}"></i>
          <span class="ex-num">${i + 1}</span>
          <div class="grow">
            <div class="name" style="font-weight:700">${esc(ex ? ex.name : "?")}</div>
            <div class="small">${esc(sub)}</div>
          </div>
          <span class="ex-chevron">›</span>
        </div>
      </div>`;
    }

    // předvyplnění další série podle minulého tréninku (stejný index, jinak poslední)
    const pf = last ? (last.sets[setCount] || last.sets[last.sets.length - 1]) : null;
    const prog = progressionSuggestion(ex, last);
    // při splněné progresi předvyplň vyšší váhu a spodek rep range
    const pfReps = prog ? prog.lo : (pf ? pf.reps : "");
    const pfWeight = prog ? fmtNum(kgOut(prog.next), 1) : (pf ? fmtNum(kgOut(pf.weight), 1) : "");
    const started = setCount > 0;

    const sets = (entry.sets || []).map((st, j) => `
      <div class="set-row">
        <span class="set-num">${j + 1}</span>
        <span class="grow">${fmtNum(st.reps)} × ${fmtWeight(st.weight)}${st.note ? ` <span class="small">· ${esc(st.note)}</span>` : ""}
          ${st.isPR ? ` <span class="badge yellow">PR!</span>` : ""}</span>
        <button class="iconbtn" style="width:32px;height:32px;color:var(--red)" data-act="w-del-set" data-i="${i}" data-j="${j}">✕</button>
      </div>`).join("");

    /* zvýrazněný rekord, minulý výkon, návrh progrese a „blízko rekordu" */
    const near = nearPRHint(entry, pr);
    const hints = `
      ${pr ? `<div class="mt"><span class="badge yellow">PR ${fmtWeight(pr.weight)} × ${pr.reps}</span>
        <span class="small" style="margin-left:6px">e1RM ${fmtWeight(pr.e1rm)}</span></div>` : ""}
      ${last ? `<div class="hint-last${pr ? "" : " mt"}">Minule ${fmtDate(last.date)}: &nbsp;<b>${last.sets.map(st => `${st.reps}×${fmtNum(kgOut(st.weight), 1)}`).join(" · ")} ${weightUnit()}</b></div>` : ""}
      ${prog ? `<div class="hint-last hint-prog">Progrese: minule vše ≥ ${prog.topReps} opak. → zkus <b>${fmtWeight(prog.next)}</b></div>` : ""}
      ${near ? `<div class="hint-last hint-near">${near}</div>` : ""}`;

    return `
    <div class="card ex-open${entry.prHit ? " pr-flash" : ""}" id="exblock-${i}">
      <div class="row between" data-act="w-ex-close">
        <span class="ex-num${entry.done ? " done" : ""}">${entry.done ? "✓" : i + 1}</span>
        <div class="grow">
          <div class="ex-cat" style="color:${pcol}">
            <i class="p-dot" style="background:${pcol}"></i>${esc((ex && ex.category) || "—")}
          </div>
          <div class="name" style="font-weight:700">${esc(ex ? ex.name : "?")}</div>
          ${ex && ex.description ? `<div class="small" style="color:var(--text2)">${esc(ex.description)}</div>` : ""}
        </div>
        <button class="btn sm ghost" data-act="w-swap-ex" data-i="${i}">⇄</button>
        <button class="btn sm ghost" style="color:var(--red)" data-act="w-remove-ex" data-i="${i}">✕</button>
      </div>
      ${hints}
      ${sets ? `<div class="mt">${sets}</div>` : ""}
      <div class="set-input mt">
        ${stepperHtml("reps-" + i, pfReps, 1, "Opakování", i, "reps")}
        ${stepperHtml("weight-" + i, pfWeight, 2.5, weightUnit(), i, "weight")}
      </div>
      <input class="input mt" id="note-${i}" type="text" placeholder="Poznámka (volitelné)">
      <div class="row mt" style="gap:8px">
        <button class="btn primary grow" data-act="w-add-set" data-i="${i}">+ Přidat sérii</button>
        ${started ? `<button class="btn sm success" data-act="w-ex-done" data-i="${i}">${entry.done ? "✓ Zavřít" : "✓ Hotový"}</button>` : ""}
      </div>
      ${restInlineHtml()}
    </div>`;
  }).join("");

  const totalSets = a.entries.reduce((n, e) => n + (e.sets || []).length, 0);
  const doneCount = a.entries.filter(e => e.done).length;
  const dateInfo = a.date !== todayStr() ? ` · ${fmtDate(a.date)}` : "";
  return `
    <div class="card">
      <div class="row between">
        <span class="badge neutral">Probíhá — ${esc(sessionLabel(a))}${dateInfo}</span>
        <span class="small">${doneCount}/${a.entries.length} cviků · ${totalSets} ${setWordTop(totalSets)}</span>
      </div>
    </div>
    ${catCounterHtml(a)}
    ${blocks}
    <button class="btn ghost full" style="border-style:dashed" data-act="w-add-ex">+ Přidat cvik</button>
    <div class="row mt" style="gap:8px">
      <button class="btn danger" data-act="w-cancel">Zrušit</button>
      <button class="btn success grow" data-act="w-finish">✓ Dokončit trénink</button>
    </div>`;
}

function setWordTop(n) { return n === 1 ? "série" : n >= 2 && n <= 4 ? "série" : "sérií"; }

/* ---- Stepper pro sérii ----
   Se zpocenou rukou je klávesnice nepřítel: ± mění hodnotu jedním klepnutím,
   pole zůstává editovatelné, když chceš zadat číslo přesně. */
function stepperHtml(id, value, step, label, i, field) {
  return `
    <div class="set-field">
      <span class="set-lbl">${esc(label)}</span>
      <div class="set-step">
        <button class="step-btn sm" data-act="w-step" data-id="${id}" data-d="${-step}">−</button>
        <input class="input step-in" id="${id}" type="text" inputmode="decimal" value="${value}">
        <button class="step-btn sm" data-act="w-step" data-id="${id}" data-d="${step}">+</button>
      </div>
    </div>`;
}

/* Pauza se ukazuje i pod cvikem — tam se stejně díváš. Plovoucí lišta
   zůstává pro moment, kdy jsi odscrolloval jinam. */
function restInlineHtml() {
  const until = Number(localStorage.getItem(Rest.KEY) || 0);
  if (!until || until <= Date.now()) return "";
  const left = Math.ceil((until - Date.now()) / 1000);
  const total = Settings.get().restSeconds || 90;
  const pct = clamp(left / total * 100, 0, 100);
  return `
    <div class="rest-inline mt">
      <span class="small">pauza</span>
      <div class="rest-bar"><i style="width:${pct.toFixed(0)}%"></i></div>
      <b id="restInlineTime">${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}</b>
      <button class="btn sm ghost" data-act="rest-stop">✕</button>
    </div>`;
}

/* ---- Co uteklo minule ----
   Ukazuje se nad volbou tréninku, aby šlo mezeru zacelit hned při plánování
   dnešní session — ne až v Souhrnu po týdnu. Plán je full body, takže
   partie bez série je skutečně vynechaná, ne záměr. */
function lastGapsHtml() {
  const g = lastSessionGaps();
  if (!g || (!g.missed.length && !g.low.length)) return "";
  const chip = (cat, label) => `
    <span class="gap-chip">
      <i class="p-dot" style="background:${catColor(cat)}"></i>
      <b>${cat}</b>${label ? `<span>${label}</span>` : ""}
    </span>`;
  const ago = daysBetween(g.date, todayStr());
  const when = ago === 0 ? "dnes" : ago === 1 ? "včera" : `před ${ago} dny`;
  return `
    <div class="card gap-card">
      <div class="row between" style="margin-bottom:10px">
        <span class="h2" style="margin:0">Minule ti uteklo</span>
        <span class="small">${esc(sessionLabel(g.session))} · ${when}</span>
      </div>
      ${g.missed.length ? `<div class="gap-row">
        <span class="gap-lbl">vynecháno</span>
        <div class="gap-chips">${g.missed.map(m => chip(m.cat, "")).join("")}</div>
      </div>` : ""}
      ${g.low.length ? `<div class="gap-row">
        <span class="gap-lbl">málo</span>
        <div class="gap-chips">${g.low.map(l => chip(l.cat,
          l.reason === "exercises" ? `${l.done}/${l.planned} cviků` : `${l.sets} série`)).join("")}</div>
      </div>` : ""}
    </div>`;
}

/* ---- Counter partií ----
   Drží se nad cviky po celou dobu tréninku, u šablony i u libovolného cviku.
   Ukazuje i nuly — právě ta nula je informace, kvůli které counter existuje.
   Pořadí je pevné podle těla, ať se buňky pod prstem nepřeskupují. */
function catCounterHtml(session) {
  const sets = sessionCatSets(session);
  const exs = sessionCatExercises(session);
  const hit = CAT_ORDER.filter(c => sets[c] > 0).length;

  /* Sbalený je pruh — v posilovně je nejcennější místo na obrazovce.
     Klepnutím se rozbalí na cviky · série u každé partie. */
  const bar = CAT_ORDER.map(c => `
    <i class="${sets[c] ? "" : "zero"}" style="background:${catColor(c)}">
      <b>${sets[c]}</b>
    </i>`).join("");

  if (!WV.counterOpen) {
    return `
      <div class="cat-bar-card" data-act="w-counter">
        <div class="cat-bar">${bar}</div>
        <div class="row between" style="margin-top:8px">
          <span class="small">Partie dnes · <b style="color:var(--text)">${hit}</b> ze ${CAT_ORDER.length}</span>
          <span class="small">série v pruhu · rozbal pro cviky ›</span>
        </div>
      </div>`;
  }

  const cells = CAT_ORDER.map(c => `
    <div class="cat-cell${sets[c] ? "" : " zero"}">
      <i style="background:${catColor(c)}"></i>
      <span class="cat-n">${c}</span>
      <span class="cat-v"><b>${exs[c]}</b><s>·</s>${sets[c]}</span>
    </div>`).join("");
  return `
    <div class="card cat-counter" data-act="w-counter">
      <div class="row between" style="margin-bottom:2px">
        <span class="h2" style="margin:0">Partie dnes</span>
        <span class="small"><b style="color:var(--text)">${hit}</b> ze ${CAT_ORDER.length} ⌃</span>
      </div>
      <div class="small" style="margin-bottom:10px">cviky · série</div>
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
      return `Blízko rekordu — ještě <b>${extra} opakování</b> navíc při ${fmtWeight(last.weight)} a máš PR`;
    }
  }
  for (const add of [1.25, 2.5, 5]) {
    if (est1RM(last.weight + add, last.reps) > pr.e1rm) {
      return `Blízko rekordu — přidej <b>${fmtWeight(add)}</b> při ${last.reps} opak. a máš PR`;
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
  render();
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
  // pauza se spouští před překreslením, jinak by se inline zobrazení
  // pod cvikem vykreslilo ještě do stavu „pauza neběží"
  Rest.start(Settings.get().restSeconds);
  render();
}

function finishWorkout() {
  const a = S.activeSession;
  const entries = a.entries
    .filter(e => (e.sets || []).length)
    .map(e => ({ exerciseId: e.exerciseId, sets: e.sets.map(({ reps, weight, note }) => ({ reps, weight, note })) }));
  if (!entries.length) { toast("Trénink nemá žádnou zapsanou sérii", "err"); return; }
  const prCount = a.entries.reduce((n, e) => n + (e.sets || []).filter(s => s.isPR).length, 0);
  const sessionId = a.id;
  S.sessions.push({ id: sessionId, date: a.date, type: "weights", templateUsed: a.templateUsed, templateName: a.templateName || null, entries });
  S.activeSession = null;
  WV.openIdx = null;
  Rest.stop();
  save();
  render();
  toast(prCount ? `Trénink uložen — ${prCount}× nový PR!` : "Trénink uložen ✓", prCount ? "pr" : "ok");
  openRatingModal(sessionId);
}

/* ---- Hodnocení tréninku (kvalita 1–10 + poznámka) ---- */
function openRatingModal(sessionId) {
  WV.rateVal = null;
  const chips = Array.from({ length: 10 }, (_, k) => k + 1).map(n =>
    `<button class="chip ratechip" data-act="w-rate-chip" data-val="${n}">${n}</button>`).join("");
  openModal(`${modalTitle("Jak ti trénink sedl?")}
    <label class="field" style="margin-bottom:4px"><span>Kvalita (1 = nekvalitní, 10 = skvělý)</span></label>
    <div class="chips">${chips}</div>
    <label class="field"><span>Poznámka</span>
      <input class="input" id="rateNote" placeholder="volitelné — pocit, únava, co příště jinak…"></label>
    <div class="row" style="gap:8px">
      <button class="btn ghost grow" data-act="modal-close">Přeskočit</button>
      <button class="btn primary grow" data-act="w-rate-save" data-id="${sessionId}">Uložit</button>
    </div>`);
}

/* ---- Výběr cviku (přidání / výměna v session) ---- */
function openExercisePicker(swapIndex) {
  WV.pickerIndex = swapIndex;
  openModal(`${modalTitle(swapIndex == null ? "Přidat cvik" : "Vyměnit cvik")}
    <input class="input" id="exPickSearch" placeholder="Hledat cvik…" style="margin-bottom:10px">
    <div id="exPickList">${exercisePickerList("")}</div>`);
  const inp = document.getElementById("exPickSearch");
  inp.addEventListener("input", () => {
    document.getElementById("exPickList").innerHTML = exercisePickerList(inp.value);
  });
}

function exercisePickerList(query) {
  const q = query.trim().toLowerCase();
  const groups = CAT_ORDER.map(cat => {
    const items = S.exercises
      .filter(e => e.category === cat && (!q || e.name.toLowerCase().includes(q)))
      .map(e => `<div class="list-item" data-act="w-pick-ex" data-exid="${e.id}" style="cursor:pointer">
        <i class="p-stripe" style="background:${catColor(cat)}"></i>
        <div class="grow name">${esc(e.name)}</div>
        ${e.isCustom ? `<span class="badge neutral">vlastní</span>` : ""}
      </div>`).join("");
    return items ? `<div class="h3 cat-head"><i class="p-dot" style="background:${catColor(cat)}"></i>${cat}</div>${items}` : "";
  }).join("");
  return groups || `<div class="empty-note">Nic nenalezeno</div>`;
}

/* ---- Kardio formulář ---- */
function openCardioModal() {
  WV.sportChoice = CARDIO_SPORTS[0];
  const sportChips = CARDIO_SPORTS.map(s =>
    `<button class="chip sportchip${s === WV.sportChoice ? " on" : ""}" data-act="w-sport-chip" data-sport="${s}">${s}</button>`).join("");
  const dateInfo = WV.date !== todayStr() ? ` · ${fmtDate(WV.date)}` : "";
  openModal(`${modalTitle("Zapsat kardio" + dateInfo)}
    <label class="field" style="margin-bottom:4px"><span>Sport</span></label>
    <div class="chips">${sportChips}</div>
    <label class="field"><span>Doba trvání (min) *</span>
      <input class="input" id="cDur" type="text" inputmode="decimal" placeholder="např. 30"></label>
    <label class="field"><span>Vzdálenost (km)</span>
      <input class="input" id="cDist" type="text" inputmode="decimal" placeholder="volitelné"></label>
    <label class="field"><span>Kalorie (kcal)</span>
      <input class="input" id="cCal" type="number" inputmode="numeric" placeholder="volitelné"></label>
    <div class="small" id="cPace" style="margin-bottom:14px"></div>
    <button class="btn primary full" data-act="w-cardio-save">Uložit kardio</button>`);
  const upd = () => {
    const d = parseDec(document.getElementById("cDur").value);
    const k = parseDec(document.getElementById("cDist").value);
    document.getElementById("cPace").textContent =
      d && k ? `Tempo: ${fmtNum(d / k, 2)} min/km` : "";
  };
  document.getElementById("cDur").addEventListener("input", upd);
  document.getElementById("cDist").addEventListener("input", upd);
}

function saveCardio() {
  const duration = parseDec(document.getElementById("cDur").value);
  const distance = parseDec(document.getElementById("cDist").value) || null;
  const calories = parseDec(document.getElementById("cCal").value) || null;
  if (!duration || duration <= 0) { toast("Zadej dobu trvání", "err"); return; }
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

/* ---- Osobní rekordy ---- */
function renderPRList() {
  const prs = allPRs();
  if (!prs.length) return `<div class="card"><div class="empty-note">Zatím žádné rekordy.<br>Zapiš první silový trénink!</div></div>`;
  const rows = prs.map(({ exerciseId, pr }) => `
    <div class="list-item" data-act="w-pr-history" data-exid="${exerciseId}" style="cursor:pointer">
      <div class="grow">
        <div class="name">${esc(exName(exerciseId))}</div>
        <div class="small">${fmtDate(pr.date)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700;color:var(--yellow)">${fmtWeight(pr.weight)} × ${pr.reps}</div>
        <div class="small">e1RM ${fmtWeight(pr.e1rm)}</div>
      </div>
    </div>`).join("");
  return `<div class="card"><div class="h2">Osobní rekordy</div>${rows}
    <p class="small mt">e1RM = odhad maxima na 1 opakování (Epley). Klikni na cvik pro historii.</p></div>`;
}

function openPRHistory(exerciseId) {
  const hist = prHistory(exerciseId).slice().reverse();
  const rows = hist.map((h, idx) => `
    <div class="list-item">
      <span class="badge yellow">${idx === 0 ? "aktuální" : "PR"}</span>
      <div class="grow name">${fmtWeight(h.weight)} × ${h.reps}</div>
      <div style="text-align:right">
        <div class="small">e1RM ${fmtWeight(h.e1rm)}</div>
        <div class="small">${fmtDate(h.date)}</div>
      </div>
    </div>`).join("");
  openModal(`${modalTitle("Historie PR — " + exName(exerciseId))}
    ${rows || `<div class="empty-note">Žádná historie</div>`}`);
}

/* ---- Detail session (sdílený s kalendářem v Souhrnu) ---- */
function sessionDetailHtml(s) {
  if (s.type === "cardio") {
    const c = s.entries[0] || {};
    return `<div>
      <div class="row between"><span class="badge neutral">${esc(cardioLabel(c))}</span>
        <button class="btn sm danger" data-act="w-del-session" data-id="${s.id}">Smazat</button></div>
      <div class="card2 mt">
        <div><b>${fmtNum(c.duration)} min</b>${c.distance ? ` · ${fmtNum(c.distance, 2)} km` : ""}</div>
        ${c.pace ? `<div class="muted">tempo ${fmtNum(c.pace, 2)} min/km</div>` : ""}
        ${c.calories ? `<div class="muted">${fmtNum(c.calories)} kcal</div>` : ""}
      </div></div>`;
  }
  const blocks = s.entries.map(e => {
    const sets = (e.sets || []).map((st, j) =>
      `<div class="set-row"><span class="set-num">${j + 1}</span>
       <span class="grow">${fmtNum(st.reps)} × ${fmtWeight(st.weight)}${st.note ? ` <span class="small">· ${esc(st.note)}</span>` : ""}</span></div>`).join("");
    return `<div class="card2 mt">
      <div class="row"><i class="p-stripe" style="background:${exColor(e.exerciseId)}"></i>
        <b style="font-size:14px">${esc(exName(e.exerciseId))}</b></div>${sets}</div>`;
  }).join("");
  return `<div>
    <div class="row between">
      <span class="badge neutral">${esc(sessionLabel(s))}</span>
      ${s.rating ? `<span class="badge green">${s.rating}/10</span>` : ""}
      <span class="small">objem ${fmtWeight(sessionVolume(s))}</span>
      <button class="btn sm danger" data-act="w-del-session" data-id="${s.id}">Smazat</button>
    </div>
    ${s.note ? `<div class="small mt">„${esc(s.note)}"</div>` : ""}${blocks}</div>`;
}

function openSessionDetail(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return;
  openModal(`${modalTitle("Trénink " + fmtDate(s.date))}${sessionDetailHtml(s)}`);
}

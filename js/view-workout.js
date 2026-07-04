/* ===== Obrazovka: Trénink — log a osobní rekordy =====
   Barevná logika: volt = akce (tlačítka, chipy), zlatá = rekordy,
   žlutá = probíhá, neutrální štítky = typ tréninku/sport. */
"use strict";

const CARDIO_SPORTS = ["Běh", "Chůze", "Kolo", "Plavání", "Veslování", "Švihadlo", "Eliptický", "Turistika", "Jiné"];

const WV = {
  sub: "log",                 // log | pr
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

/* ---- Krok 1+2: volba typu tréninku ---- */
function renderWorkoutStart() {
  return `
    <div class="card">
      <div class="h2">Silový trénink</div>
      <div class="row" style="gap:8px">
        <button class="btn grow" style="border-color:var(--green);color:var(--green)" data-act="w-begin" data-template="A">Trénink A</button>
        <button class="btn grow" style="border-color:var(--green);color:var(--green)" data-act="w-begin" data-template="B">Trénink B</button>
      </div>
      <button class="btn full mt" style="border-color:var(--green);color:var(--green)" data-act="w-begin" data-template="custom">Libovolný cvik (mimo šablonu)</button>
    </div>
    <div class="card">
      <div class="h2">Kardio</div>
      <p class="muted" style="margin:0 0 12px">Vyber sport a zapiš čas, vzdálenost, kalorie.</p>
      <button class="btn primary full" data-act="w-cardio">Zapsat kardio</button>
    </div>`;
}

/* ---- Aktivní silová session ---- */
function renderActiveSession() {
  const a = S.activeSession;
  if (a.type === "cardio") return ""; // kardio se zapisuje přímo formulářem

  const blocks = a.entries.map((entry, i) => {
    const ex = getExercise(entry.exerciseId);
    const pr = currentPR(entry.exerciseId);
    const sets = (entry.sets || []).map((st, j) => `
      <div class="set-row">
        <span class="set-num">${j + 1}</span>
        <span class="grow">${fmtNum(st.reps)} × ${fmtWeight(st.weight)}${st.note ? ` <span class="small">· ${esc(st.note)}</span>` : ""}
          ${st.isPR ? ` <span class="badge yellow">PR!</span>` : ""}</span>
        <button class="iconbtn" style="width:32px;height:32px;color:var(--red)" data-act="w-del-set" data-i="${i}" data-j="${j}">✕</button>
      </div>`).join("");

    return `
    <div class="card${entry.prHit ? " pr-flash" : ""}" id="exblock-${i}">
      <div class="row between">
        <div class="grow">
          <div class="name" style="font-weight:700">${esc(ex ? ex.name : "?")}</div>
          <div class="small">${pr ? `PR: ${fmtWeight(pr.weight)} × ${pr.reps} (e1RM ${fmtWeight(pr.e1rm)})` : "Zatím bez rekordu"}</div>
        </div>
        <button class="btn sm ghost" data-act="w-swap-ex" data-i="${i}">⇄</button>
        <button class="btn sm ghost" style="color:var(--red)" data-act="w-remove-ex" data-i="${i}">✕</button>
      </div>
      ${sets ? `<div class="mt">${sets}</div>` : ""}
      <div class="row mt" style="gap:6px">
        <input class="input" id="reps-${i}" type="number" inputmode="numeric" placeholder="Opak." style="flex:1">
        <input class="input" id="weight-${i}" type="number" inputmode="decimal" step="0.5" placeholder="${weightUnit()}" style="flex:1">
        <input class="input" id="note-${i}" type="text" placeholder="Poznámka" style="flex:1.4">
      </div>
      <button class="btn sm full mt" style="border-color:var(--green);color:var(--green)" data-act="w-add-set" data-i="${i}">+ Přidat sérii</button>
    </div>`;
  }).join("");

  const totalSets = a.entries.reduce((n, e) => n + (e.sets || []).length, 0);
  return `
    <div class="card" style="border-color:var(--yellow)">
      <div class="row between">
        <span class="badge yellow">Probíhá — ${esc(templateLabel(a.templateUsed))}</span>
        <span class="small">${totalSets} sérií</span>
      </div>
      <p class="small" style="margin:8px 0 0">Úpravy cviků platí jen pro tuto session, šablonu nemění.</p>
    </div>
    ${blocks}
    <button class="btn ghost full" style="border-style:dashed" data-act="w-add-ex">+ Přidat cvik</button>
    <div class="row mt" style="gap:8px">
      <button class="btn danger" data-act="w-cancel-ask">Zrušit</button>
      <button class="btn success grow" data-act="w-finish">✓ Dokončit trénink</button>
    </div>`;
}

/* ---- Akce: silový trénink ---- */
function beginWorkout(templateId) {
  const tpl = getTemplate(templateId);
  S.activeSession = {
    id: uid(),
    date: todayStr(),
    type: "weights",
    templateUsed: tpl ? tpl.id : "custom",
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
  render();
}

function finishWorkout() {
  const a = S.activeSession;
  const entries = a.entries
    .filter(e => (e.sets || []).length)
    .map(e => ({ exerciseId: e.exerciseId, sets: e.sets.map(({ reps, weight, note }) => ({ reps, weight, note })) }));
  if (!entries.length) { toast("Trénink nemá žádnou zapsanou sérii", "err"); return; }
  const prCount = a.entries.reduce((n, e) => n + (e.sets || []).filter(s => s.isPR).length, 0);
  S.sessions.push({ id: a.id, date: a.date, type: "weights", templateUsed: a.templateUsed, entries });
  S.activeSession = null;
  save();
  render();
  toast(prCount ? `Trénink uložen — ${prCount}× nový PR!` : "Trénink uložen ✓", prCount ? "pr" : "ok");
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
  const groups = EX_CATEGORIES.map(cat => {
    const items = S.exercises
      .filter(e => e.category === cat && (!q || e.name.toLowerCase().includes(q)))
      .map(e => `<div class="list-item" data-act="w-pick-ex" data-exid="${e.id}" style="cursor:pointer">
        <div class="grow name">${esc(e.name)}</div>
        ${e.isCustom ? `<span class="badge neutral">vlastní</span>` : ""}
      </div>`).join("");
    return items ? `<div class="h3" style="margin-top:10px">${cat}</div>${items}` : "";
  }).join("");
  return groups || `<div class="empty-note">Nic nenalezeno</div>`;
}

/* ---- Kardio formulář ---- */
function openCardioModal() {
  WV.sportChoice = CARDIO_SPORTS[0];
  const sportChips = CARDIO_SPORTS.map(s =>
    `<button class="chip sportchip${s === WV.sportChoice ? " on" : ""}" data-act="w-sport-chip" data-sport="${s}">${s}</button>`).join("");
  openModal(`${modalTitle("Zapsat kardio")}
    <label class="field" style="margin-bottom:4px"><span>Sport</span></label>
    <div class="chips">${sportChips}</div>
    <label class="field"><span>Doba trvání (min) *</span>
      <input class="input" id="cDur" type="number" inputmode="decimal" placeholder="např. 30"></label>
    <label class="field"><span>Vzdálenost (km)</span>
      <input class="input" id="cDist" type="number" inputmode="decimal" step="0.01" placeholder="volitelné"></label>
    <label class="field"><span>Kalorie (kcal)</span>
      <input class="input" id="cCal" type="number" inputmode="numeric" placeholder="volitelné"></label>
    <div class="small" id="cPace" style="margin-bottom:14px"></div>
    <button class="btn primary full" data-act="w-cardio-save">Uložit kardio</button>`);
  const upd = () => {
    const d = parseFloat(document.getElementById("cDur").value);
    const k = parseFloat(document.getElementById("cDist").value);
    document.getElementById("cPace").textContent =
      d && k ? `Tempo: ${fmtNum(d / k, 2)} min/km` : "";
  };
  document.getElementById("cDur").addEventListener("input", upd);
  document.getElementById("cDist").addEventListener("input", upd);
}

function saveCardio() {
  const duration = parseFloat(document.getElementById("cDur").value);
  const distance = parseFloat(document.getElementById("cDist").value) || null;
  const calories = parseFloat(document.getElementById("cCal").value) || null;
  if (!duration || duration <= 0) { toast("Zadej dobu trvání", "err"); return; }
  S.sessions.push({
    id: uid(), date: todayStr(), type: "cardio", templateUsed: null,
    entries: [{
      sport: WV.sportChoice, duration, distance,
      pace: distance ? Math.round(duration / distance * 100) / 100 : null, calories
    }]
  });
  save();
  closeModal();
  render();
  toast("Kardio uloženo ✓", "ok");
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
    return `<div class="card2 mt"><b style="font-size:14px">${esc(exName(e.exerciseId))}</b>${sets}</div>`;
  }).join("");
  return `<div>
    <div class="row between">
      <span class="badge neutral">${esc(templateLabel(s.templateUsed))}</span>
      <span class="small">objem ${fmtWeight(sessionVolume(s))}</span>
      <button class="btn sm danger" data-act="w-del-session" data-id="${s.id}">Smazat</button>
    </div>${blocks}</div>`;
}

function openSessionDetail(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return;
  openModal(`${modalTitle("Trénink " + fmtDate(s.date))}${sessionDetailHtml(s)}`);
}

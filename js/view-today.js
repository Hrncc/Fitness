/* ===== Obrazovka: Dnes — den, týden a pokrok na jednom místě =====
   Shora dolů od nejbližšího k nejširšímu: co dnes dlužíš (váha · trénink ·
   jídlo, rozbalená je vždy jen jedna položka), jak vypadá týden a jak se
   ti vede dlouhodobě. Podrobnosti jsou o klepnutí dál v Pokroku. */
"use strict";

const TV = {
  wDraft: null,  // rozepsaná váha ve stepperu, v zobrazené jednotce
  wDate: null,   // den, ke kterému se váha zapíše (null = dnes)
  open: null,    // rozbalená položka dne: null = první nedokončená, "none" = žádná
  weekOff: 0,    // procházení týdnů: 0 = tento, -1 = minulý…
  cal: "week"    // Týden (pás 7 dní) / Měsíc (stejné buňky přes celý měsíc, SV.calY/calM)
};

function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function todayHead() {
  const now = new Date();
  return { title: "Přehled", sub: capFirst(`${CZ_DAYS_FULL[now.getDay()]} ${now.getDate()}. ${CZ_MONTHS_GEN[now.getMonth()]}`) };
}

function renderToday() {
  return hubHtml() + hubPanelHtml() + healthCardHtml() + adaptCardHtml() + watchTodayHtml()
    + weekSectionHtml() + progressTeaserHtml();
}

/* ===== Rozcestník (v5.1) =====
   Čtyři dlaždice nahoře: Trénink · Jídlo · Váha · Tělo. Každá říká, jak na tom
   dnes jsi (hotovo = volt fajfka), a klepnutím otevře svůj panel hned pod sebou —
   všechno, co se dá dnes zapsat, je na jedno klepnutí od otevření appky.
   Vybraná dlaždice má bílý rámeček (výběr); TV.hub drží ruční volbu. */
function hubKey() {
  if (TV.hub) return TV.hub;
  return "workout";
}
function hubTiles() {
  const today = todayStr();
  const st = todayStatus();
  const a = S.activeSession;
  const next = nextTemplate();
  const nut = dayNutrition(today);
  const m = dayRating(today);
  const lastW = lastBodyWeight(today);
  const lastC = lastCheckin();
  return [
    { k: "workout", icon: "dumbbell", title: "Trénink", done: st.workout && !a, live: !!a,
      sub: a ? (a.editOf ? "Úprava tréninku" : `Probíhá · ${sessionSets(a)} ${plural(sessionSets(a), "série", "série", "sérií")}`)
        : st.workout ? "Dnes hotovo" : next ? `Na řadě ${esc(next.name)}` : "Začni první" },
    { k: "food", icon: "food", title: "Jídlo", done: st.food,
      sub: nut.count ? `${fmtNum(nut.calories)} z ${fmtNum(S.goal.dailyCalories)} kcal`
        : st.food ? `${(FOOD_RATINGS.find(r => r[0] === m.foodRating) || [])[1] || ""} · bílkoviny ${m.proteinOk ? "ano" : "ne"}` : "Jak to dnes dopadlo?" },
    { k: "weight", icon: "scale", title: "Váha", done: st.weight,
      sub: st.weight ? fmtWeight(bodyWeightOn(today)) : lastW ? `Naposledy ${fmtWeight(lastW.weightKg)}` : "Zapiš první vážení" },
    { k: "body", icon: "body", title: "Tělo", done: false, due: st.checkin,
      sub: st.checkin ? "Check-in je na řadě" : lastC ? `Check-in ${relDay(lastC.date)}` : "Check-in a fotky" }
  ];
}
function hubHtml() {
  const cur = hubKey();
  return `<div class="hub" role="tablist" aria-label="Co chceš zapsat">${hubTiles().map(t => `
    <button class="hub-t${t.k === cur ? " on" : ""}${t.done ? " done" : ""}" data-act="hub" data-k="${t.k}" role="tab" aria-selected="${t.k === cur}">
      <span class="hub-top"><span class="hub-ic">${ic(t.icon, 20)}</span>
        ${t.done ? `<span class="hub-ok" aria-label="hotovo">${ic("check", 13, 3)}</span>` : t.live ? `<i class="live-dot" aria-label="probíhá"></i>` : t.due ? `<span class="hub-due" aria-hidden="true"></span>` : ""}</span>
      <span class="hub-title">${t.title}</span>
      <span class="hub-sub">${t.sub}</span>
    </button>`).join("")}</div>`;
}
function hubPanelHtml() {
  const k = hubKey();
  const today = todayStr();
  if (k === "workout") {
    const done = sessionsOn(today);
    return (done.length && !S.activeSession ? `<div class="card rows" style="margin-bottom:12px">${done.map(sessionRowHtml).join("")}</div>` : "")
      + nextCardHtml({ preview: 4 })
      + (S.activeSession ? "" : `<div class="start-two">
          <button class="btn" data-act="t-begin-next" data-template="custom">${ic("plus", 16, 2.4)} Prázdný trénink</button>
          <button class="btn" data-act="w-cardio"><i class="p-dot" style="background:var(--p-cardio)"></i> Kardio</button></div>`);
  }
  if (k === "food") {
    const nut = dayNutrition(today), g = S.goal;
    if (nut.count) {
      const pct = Math.min(100, nut.calories / g.dailyCalories * 100);
      return `<div class="card hub-p">
          <div class="hub-fig"><b class="num">${fmtNum(nut.calories)}</b><span>z ${fmtNum(g.dailyCalories)} kcal</span></div>
          <div class="page-prog"><i style="width:${pct.toFixed(0)}%"></i></div>
          <div class="hub-mac"><span>Bílkoviny <b>${fmtNum(nut.protein)}</b> / ${fmtNum(g.proteinGrams)} g</span><span>Sacharidy <b>${fmtNum(nut.carbs)}</b> g</span><span>Tuky <b>${fmtNum(nut.fat)}</b> g</span></div>
          <button class="btn primary full" data-act="menu" data-page="food">${ic("plus", 16, 2.4)} Přidat jídlo</button>
        </div>`;
    }
    const m = dayRating(today);
    return `<div class="card hub-p">
        <div class="food-q"><span>Kalorie · cíl ${fmtNum(g.dailyCalories)} kcal</span>
          <div class="opts">${FOOD_RATINGS.map(([id, lbl]) =>
            `<button class="opt${m && m.foodRating === id ? " on" : ""}" data-act="t-food-rating" data-v="${id}">${lbl}</button>`).join("")}</div></div>
        <div class="food-q"><span>Bílkoviny ≈ ${fmtNum(g.proteinGrams)} g</span>
          <div class="opts">
            <button class="opt${m && m.proteinOk === false ? " on" : ""}" data-act="t-food-protein" data-v="0">ne</button>
            <button class="opt${m && m.proteinOk === true ? " on" : ""}" data-act="t-food-protein" data-v="1">ano</button>
          </div></div>
        <div class="btn-row">
          ${m ? `<button class="btn text danger" data-act="t-food-reset">Smazat zápis</button>` : ""}
          <button class="btn" data-act="menu" data-page="food">Zapsat podrobně</button>
        </div>
      </div>`;
  }
  if (k === "weight") {
    return `<div class="card today-card hub-p0">${todayStatus().weight ? weightRowHtml(true) : weightOpenHtml()}</div>`;
  }
  const last = lastCheckin();
  const since = last ? daysBetween(last.date, today) : null;
  return `<div class="card hub-p">
      <div class="hub-fig sm"><b>${last ? `Check-in ${relDay(last.date)}` : "Zatím žádný check-in"}</b>
        <span>${checkinDue() ? "Je na řadě — obvody, váha a fotka jednou týdně." : since != null ? `Další za ${Math.max(1, 7 - since)} ${plural(Math.max(1, 7 - since), "den", "dny", "dní")}.` : "Obvody, váha a fotka jednou týdně."}</span></div>
      <div class="btn-row">
        <button class="btn" data-act="go-progress" data-seg="body">Tělo a fotky</button>
        <button class="btn${checkinDue() ? " primary" : ""}" data-act="ci-new">Nový check-in</button>
      </div>
    </div>`;
}

/* ===== Trénink na řadě — společná karta Přehledu a startu Tréninku =====
   Ukáže rovnou cviky s dnešním cílem z adaptivního plánu: váha, u které má
   appka důvod přidat nebo ubrat, nese šipku. */
function planRowHtml(t, id, date) {
  const p = blockTarget(t.id, id, tplPlan(t, id), date);
  const ns = nextSets(id, p, null);
  const r0 = ns.rows[0];
  const w = r0 && r0.weight ? fmtWeight(r0.weight) : r0 && r0.reps && exKind(id) !== "weight" ? `${r0.reps}${exKind(id) === "time" ? " s" : "×"}` : "";
  const arrow = ns.kind === "up" || ns.kind === "easy" ? `<i class="pv-ar up" title="${esc(ns.text)}">${ic("arrowUp", 12, 3)}</i>`
    : ns.kind === "down" ? `<i class="pv-ar down" title="${esc(ns.text)}">${ic("arrowDown", 12, 3)}</i>` : "";
  return `<div class="pv-row" data-act="ex-detail" data-exid="${id}">${exThumb(id)}
      <div class="grow"><div class="pv-name">${esc(exName(id))}</div>
        <div class="pv-meta">${p ? esc(planText(p, id)) : exCategory(id) || ""}${p && p.rir != null ? ` · RIR ${esc(String(p.rir))}` : ""}</div></div>
      <div class="pv-w num">${arrow}${w}</div></div>`;
}
function planRowsHtml(t, date, max) {
  const ids = t.exercises.filter(getExercise);
  const more = max && ids.length > max ? ids.length - max : 0;
  return `<div class="pv-list">${ids.slice(0, more ? max : ids.length).map(id => planRowHtml(t, id, date)).join("")}</div>
    ${more ? `<button class="pv-more" data-act="rt-open" data-id="${t.id}">a ${more} ${plural(more, "další cvik", "další cviky", "dalších cviků")}</button>` : ""}`;
}
function nextCardHtml({ preview = 0, day = todayStr() } = {}) {
  const a = S.activeSession;
  const today = todayStr();
  if (a && a.type === "weights") {
    ensureRows(a);
    const rows = a.entries.reduce((n, e) => n + e.rows.filter(r => r.t === "n").length, 0);
    const done = sessionSets(a);
    return `<div class="card nx live">
        <div class="nx-top"><div class="grow">
          <div class="nx-name">${esc(sessionLabel(a))}</div>
          <div class="nx-meta"><i class="live-dot"></i>${a.editOf ? "Úprava tréninku" : `Probíhá${a.startedAt ? " " + startedLabel(a) : ""}`} · ${done} z ${Math.max(rows, done)} ${plural(Math.max(rows, done), "série", "sérií", "sérií")} · ${a.entries.filter(e => e.done).length}/${a.entries.length} cviků</div>
        </div></div>
        <div class="page-prog"><i style="width:${rows ? Math.min(100, done / rows * 100).toFixed(0) : 0}%"></i></div>
        <button class="btn primary full" data-act="nav" data-tab="workout">${a.editOf ? "Pokračovat v úpravě" : "Pokračovat v tréninku"}</button>
      </div>`;
  }
  const doneToday = day === today ? sessionsOn(today).filter(s => s.type === "weights") : [];
  const next = nextTemplate();
  if (!next) {
    return `<div class="card nx"><div class="nx-name">Začni první trénink</div>
        <div class="nx-meta">Vyber cviky a appka si z nich příště sama poskládá cíle.</div>
        <button class="btn primary full" data-act="t-begin-next" data-template="custom">${ic("play", 15)} Prázdný trénink</button></div>`;
  }
  const last = lastTemplateSession(next.id);
  const n = next.exercises.filter(getExercise).length;
  const g = lastSessionGaps();
  const gaps = g ? [...g.missed.map(m => m.cat), ...g.low.map(l => l.cat)] : [];
  const blk = blockOn(day) && blockDayKey(next.id);
  return `<div class="card nx">
      <div class="nx-top"><div class="grow">
        <div class="nx-name next-name">${esc(next.name)}</div>
        <div class="nx-meta next-meta">${doneToday.length ? "Dnes hotovo · příště" : `Na řadě${day !== today ? " " + fmtShort(day) : ""}`} · ${n} ${plural(n, "cvik", "cviky", "cviků")}${last ? ` · naposledy ${relDay(last.date)}` : ""}</div>
      </div></div>
      <button class="btn primary full next-go" data-act="t-begin-next" data-template="${next.id}" data-day="${day}">${ic("play", 15)} Začít trénink</button>
      ${blk ? `<button class="next-blk" data-act="menu" data-page="block">${ic("target", 15)}
        <span class="grow">Silový blok · ${blockWeekLine(day)}</span>${ic("chevR", 15, 2.2)}</button>` : ""}
      ${gaps.length ? `<div class="td-warn">${ic("alert", 14)}Minule uteklo: ${gaps.join(", ")}</div>` : ""}
      ${planRowsHtml(next, day, preview)}
    </div>`;
}

/* ===== Plán se přizpůsobuje — návrhy z výsledků (engine.js) ===== */
function adaptCardHtml() {
  const all = planProposals();
  if (!all.length) return "";
  const props = all.slice(0, 2);     // nejvýš dva naráz — další se ukážou, až tyhle vyřídíš
  return sec("Plán se přizpůsobuje", `<div class="card rows ad-card">${props.map(p => `
      <div class="ad-row">
        <div class="ad-title">${esc(p.title)}</div>
        <p class="ad-why">${esc(p.why)}</p>
        <div class="btn-row fit"><button class="btn sm ghost" data-act="ad-dismiss" data-key="${esc(p.key)}">Teď ne</button>
          <button class="btn sm" data-act="ad-apply" data-key="${esc(p.key)}">${ic("check", 14, 2.8)} Upravit plán</button></div>
      </div>`).join("")}</div>`, { sub: `Podle posledních tréninků · nic se nezmění bez tebe${all.length > 2 ? ` · ještě ${all.length - 2} ${plural(all.length - 2, "návrh", "návrhy", "návrhů")}` : ""}` });
}
function openPlanLog() {
  const log = (S.planLog || []).slice().reverse();
  openModal(`${modalTitle("Změny plánu")}
    <p class="modal-sub">Co se v plánu změnilo na návrh appky nebo trenéra</p>
    ${log.length ? `<div class="card rows">${log.map(l => `<div class="ad-row"><div class="ad-title">${esc(l.title)}</div>
      <p class="ad-why">${fmtShort(l.date)} · ${esc(l.source)}</p><ul class="cp-ops">${(l.lines || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>`
      : `<div class="empty-note">Zatím žádná změna. Váhy a opakování se posouvají samy podle minulého tréninku; tady se zapisují jen úpravy plánu, které potvrdíš.</div>`}`);
}
/* Šablona jako sheet: cviky s dnešním cílem a Začít */
function openRoutineSheet(id) {
  const t = getTemplate(id);
  if (!t) return;
  const day = App.route.tab === "workout" ? WV.date : todayStr();
  const last = lastTemplateSession(t.id);
  openModal(`${modalTitle(t.name)}
    <p class="modal-sub">${t.exercises.filter(getExercise).length} cviků${last ? ` · naposledy ${relDay(last.date)}` : ""}</p>
    ${planRowsHtml(t, day, 0)}
    <div class="btn-row">
      <button class="btn" data-act="menu" data-page="templates">Upravit</button>
      ${S.activeSession ? "" : `<button class="btn primary" data-act="t-begin-next" data-template="${t.id}" data-day="${day}">${ic("play", 15)} Začít</button>`}
    </div>`);
}
/* tréninky z hodinek dnes a včera (Apple Health) */
function watchTodayHtml() {
  const today = todayStr();
  const ws = healthWorkoutsOn(today).concat(healthWorkoutsOn(addDays(today, -1)));
  if (!ws.length) return "";
  return sec("Z hodinek", `<div class="card rows">${ws.map(w => `<div class="hw-row"><span class="hw-ic">${ic("watch", 18)}</span>
      <div class="grow"><div class="name">${esc(w.type)}</div><div class="small">${w.date === today ? "dnes" : "včera"}${healthWatchLine(w) ? " · " + healthWatchLine(w) : ""}</div></div></div>`).join("")}</div>`);
}

const HOME_ACTIONS = {
  "rt-open": d => openRoutineSheet(d.id),
  "ad-apply": d => {
    const p = planProposals().find(x => x.key === d.key);
    if (!p) return;
    withUndo("Plán upraven", () => {
      applyPlanOps(p.ops, p.title, "appka");
      S.adaptOff = Object.assign({}, S.adaptOff, { [p.key]: todayStr() });   // stejný návrh se hned nevrátí
    });
  },
  "ad-dismiss": d => {
    S.adaptOff = Object.assign({}, S.adaptOff, { [d.key]: todayStr() });
    save(); render();
    toast("Návrh schovaný na 3 týdny", "ok");
  },
  "ad-log": () => openPlanLog(),
  "hub": d => { TV.hub = d.k; render(); }
};

/* ---- Co dnes dlužíš ---- */
function checkinDue() {
  const since = daysSinceCheckin();
  const active = S.sessions.length > 0 || S.bodyLog.length > 0;
  return active && (since === null || since >= 7);
}

function todayStatus() {
  const today = todayStr();
  const f = dayRating(today);
  return {
    weight: bodyWeightOn(today) != null,
    workout: sessionsOn(today).length > 0,
    food: dayNutrition(today).count > 0 || !!(f && f.foodRating && f.proteinOk != null),
    checkin: checkinDue()
  };
}

/* Rozbalená položka: ruční volba, jinak probíhající trénink, jinak první
   nedokončená v pořadí dne (ráno váha → trénink → večer jídlo) */
function todayOpenKey() {
  if (TV.open === "none") return null;
  if (TV.open) return TV.open;
  const st = todayStatus();
  return !st.weight ? "weight" : !st.food ? "food" : null;
}


/* Sbalený řádek: stav vpravo — fajfka (hotovo), prázdný kroužek (čeká),
   šipka (otevře jinou obrazovku) */
function tdRow({ icon, title, sub = "", value = "", state = "todo", act, attrs = "" }) {
  const trail = state === "done" ? `<span class="td-ok">${ic("check", 13, 3)}</span>`
    : state === "todo" ? `<span class="td-todo"></span>` : `<span class="chev">${ic("chevR", 18)}</span>`;
  return `<div class="td-row" data-act="${act}" ${attrs}>
    <span class="td-ic">${ic(icon, 21)}</span>
    <div class="grow"><div class="td-t">${title}</div>${sub ? `<div class="td-s">${sub}</div>` : ""}</div>
    ${value ? `<span class="td-v">${value}</span>` : ""}${trail}
  </div>`;
}

/* Hlavička rozbalené položky — klepnutí na název ji sbalí */
function tdOpenHead(icon, title, key, right = "") {
  return `<div class="td-open-h">
    <div class="row grow" data-act="td-open" data-k="${key}" style="cursor:pointer">
      <span class="td-ic">${ic(icon, 21)}</span><span class="td-t">${title}</span></div>
    ${right}</div>`;
}

/* Výběr data u zápisu váhy — pilulka s neviditelným type=date přes celou
   plochu (klepnutí otevře systémový výběr). Budoucí dny nejdou. */
function weightDatePill(day, change) {
  const t = todayStr();
  const lbl = day === t ? "dnes" : day === addDays(t, -1) ? "včera" : fmtShort(day);
  return `<label class="date-pill">${ic("calendar", 14)}<span>${lbl}</span>
    <input type="date" data-change="${change}" value="${day}" max="${t}" aria-label="Datum zápisu váhy"></label>`;
}

/* Přesné datum vážení „po 5. 10. · 7:12" (čas jen když se zapsalo týž den) */
function weightStamp(e) {
  if (!e) return "";
  const t = timeOnDay(e.at, e.date);
  return `${fmtDayDate(e.date)}${t ? ` · ${t}` : ""}`;
}

/* ---- Váha: potvrzení čísla, ne formulář ----
   Ráno se hýbeš o desetiny, takže se předvyplní poslední hodnota a krokuje
   se po 0,1. Klávesnice se otevře jen když do čísla klepneš. */
function weightRowHtml(done) {
  const today = todayStr();
  if (done) {
    return tdRow({ icon: "scale", title: "Váha", value: fmtWeight(bodyWeightOn(today)), state: "done",
      sub: `zapsáno ${weightStamp(S.bodyLog.find(b => b.date === today))}`,
      act: "bw-open", attrs: `data-date="${today}"` });
  }
  const last = lastBodyWeight(today);
  return tdRow({ icon: "scale", title: "Váha",
    sub: last ? `naposledy ${fmtWeight(last.weightKg)} · ${weightStamp(last)}` : "zatím žádné vážení",
    act: "td-open", attrs: `data-k="weight"` });
}

function weightOpenHtml() {
  const today = todayStr();
  const day = TV.wDate && TV.wDate < today ? TV.wDate : today;
  const existing = day !== today ? bodyWeightOn(day) : null;
  const last = lastBodyWeight(today);
  if (TV.wDraft == null) TV.wDraft = last ? Math.round(kgOut(last.weightKg) * 10) / 10 : null;
  if (TV.wDraft == null) {
    return `<div class="td-open">
      ${tdOpenHead("scale", "Váha", "weight")}
      <p class="muted" style="margin:0 0 16px">Zatím žádný záznam — zapiš první vážení.</p>
      <button class="btn full" data-act="bw-open" data-date="${today}">Zapsat váhu</button>
    </div>`;
  }
  const avg = movingAvgAt(S.bodyLog, today);
  const weekAgo = movingAvgAt(S.bodyLog, addDays(today, -7));
  const trend = (avg != null && weekAgo != null) ? kgOut(avg) - kgOut(weekAgo) : null;
  const info = [];
  if (last) info.push(`naposledy <b>${fmtFixed(kgOut(last.weightKg), 1)}</b> · ${weightStamp(last)}`);
  if (avg != null) info.push(`Ø 7 dní <b>${fmtFixed(kgOut(avg), 1)}</b>${trend != null && Math.abs(trend) >= 0.05
    ? ` (${trend > 0 ? "+" : ""}${fmtNum(trend, 1)})` : ""}`);
  return `<div class="td-open">
    ${tdOpenHead("scale", "Váha", "weight", weightDatePill(day, "t-w-date"))}
    <div class="stepper">
      <button class="step-btn" data-act="t-w-step" data-d="-0.1" aria-label="Méně">${ic("minus", 24, 2.2)}</button>
      <button class="step-val" data-act="bw-open" data-date="${day}">${fmtFixed(TV.wDraft, 1)}<small>${weightUnit()}</small></button>
      <button class="step-btn" data-act="t-w-step" data-d="0.1" aria-label="Více">${ic("plus", 24, 2.2)}</button>
    </div>
    <div class="step-note">${info.join(" · ") || "první záznam"}${existing != null
      ? `<br><span class="warn-text">K ${fmtShort(day)} už je ${fmtWeight(existing)} — potvrzením ji přepíšeš.</span>` : ""}</div>
    <button class="btn full" data-act="t-w-save">Potvrdit ${fmtFixed(TV.wDraft, 1)} ${weightUnit()}${day !== today ? ` · ${relDay(day)}` : ""}</button>
  </div>`;
}

/* ---- Trénink: co je na řadě, co běží, co je hotové ---- */
/* ---- Jídlo: dvě klepnutí, nebo kalorie, když zapisuješ podrobně ---- */
const FOOD_RATINGS = [["under", "pod"], ["ok", "v cíli"], ["over", "nad"]];

function foodRowHtml(done) {
  const today = todayStr();
  const g = S.goal;
  const nut = dayNutrition(today);
  /* podrobný zápis má přednost — kdo váží porce, chce vidět čísla */
  if (nut.count) {
    const over = nut.calories > g.dailyCalories * 1.05;
    return tdRow({ icon: "food", title: "Jídlo",
      sub: `<span${over ? ` style="color:var(--red)"` : ""}>${fmtNum(nut.calories)}</span> z ${fmtNum(g.dailyCalories)} kcal · bílkoviny ${fmtNum(nut.protein)} g`,
      state: "nav", act: "menu", attrs: `data-page="food"` });
  }
  const m = dayRating(today);
  if (done) {
    const lbl = (FOOD_RATINGS.find(r => r[0] === m.foodRating) || [])[1] || "—";
    return tdRow({ icon: "food", title: "Jídlo", value: `${lbl} · B ${m.proteinOk ? ic("check", 13, 2.8) : ic("x", 13, 2.6)}`, state: "done",
      act: "td-open", attrs: `data-k="food"` });
  }
  return tdRow({ icon: "food", title: "Jídlo", sub: m ? "rozepsáno — doplň druhou odpověď" : "jak to dnes dopadlo?",
    act: "td-open", attrs: `data-k="food"` });
}

function foodOpenHtml() {
  const g = S.goal;
  const m = dayRating(todayStr());
  return `<div class="td-open">
    ${tdOpenHead("food", "Jídlo", "food", `<button class="sec-link" data-act="menu" data-page="food">Podrobně${ic("chevR", 16, 2.2)}</button>`)}
    <div class="food-q"><span>Kalorie · cíl ${fmtNum(g.dailyCalories)} kcal</span>
      <div class="opts">${FOOD_RATINGS.map(([id, lbl]) =>
        `<button class="opt${m && m.foodRating === id ? " on" : ""}" data-act="t-food-rating" data-v="${id}">${lbl}</button>`).join("")}</div></div>
    <div class="food-q"><span>Bílkoviny ≈ ${fmtNum(g.proteinGrams)} g</span>
      <div class="opts">
        <button class="opt${m && m.proteinOk === false ? " on" : ""}" data-act="t-food-protein" data-v="0">ne</button>
        <button class="opt${m && m.proteinOk === true ? " on" : ""}" data-act="t-food-protein" data-v="1">ano</button>
      </div></div>
    ${m ? `<button class="btn text danger full" data-act="t-food-reset">Smazat dnešní zápis</button>` : ""}
  </div>`;
}

/* ---- Týden: pás dní, čísla a pokrytí partií ----
   Šipkami jde listovat do minulých týdnů. Probíhající týden se srovnává se
   stejnou dobou minulého týdne (ve středu se středou), uzavřený s celým
   předchozím. */
function weekSummary(from, to) {
  const sess = S.sessions.filter(s => s.date >= from && s.date <= to);
  const w = sess.filter(s => s.type === "weights");
  const counts = {};
  for (const c of CAT_ORDER) counts[c] = 0;
  for (const s of w) {
    const cs = sessionCatSets(s);
    for (const c of CAT_ORDER) counts[c] += cs[c] || 0;
  }
  return {
    weights: w.length,
    cardio: sess.length - w.length,
    sets: w.reduce((n, s) => n + s.entries.reduce((k, e) => k + (e.sets || []).length, 0), 0),
    volume: w.reduce((v, s) => v + sessionVolume(s), 0),
    counts,
    core: w.some(s => s.core === true),
    prs: countRecordsInRange(from, to)
  };
}

/* Buňka dne — stejná v pásu týdne i v měsíci: volt kolečko = silový trénink,
   červený prstenec = kardio, dvě tečky = váha · jídlo. Klepnutí → detail dne. */
function dayCellHtml(ds, today, label = "") {
  const sess = sessionsOn(ds);
  const trained = sess.some(s => s.type === "weights");
  const cardio = sess.some(s => s.type === "cardio");
  const food = effectiveDayRating(ds);
  return `<div class="wk-d${trained ? " trained" : ""}${cardio ? " cardio" : ""}${ds === today ? " today" : ""}${ds > today ? " future" : ""}"
      data-act="sum-cal-day" data-date="${ds}">
    ${label ? `<span class="wk-l">${label}</span>` : ""}
    <span class="wk-n">${parseDate(ds).getDate()}</span>
    <span class="wk-dots"><i class="${bodyWeightOn(ds) != null ? "on" : ""}"></i><i class="${food ? (food.foodRating === "ok" ? "on" : "part") : ""}"></i></span>
  </div>`;
}

/* Legenda + přepínač Týden ⇄ Měsíc pod pásem/mřížkou */
function calFootHtml() {
  const month = TV.cal === "month";
  return `<div class="wk-foot">
    <div class="wk-legend">
      <span><i style="background:var(--green)"></i>trénink</span>
      <span><i style="background:var(--p-cardio)"></i>kardio</span>
      <span><i style="background:var(--text2)"></i>váha · jídlo</span>
    </div>
    <button class="wk-toggle" data-act="td-cal">${month ? "Týden" : "Měsíc"}${ic(month ? "chevU" : "chevD", 14, 2.4)}</button>
  </div>`;
}

/* Čísla období + pokrytí partií — společné pro týden i měsíc */
function periodBodyHtml(cur, prev, { goal = 0, cap = "" } = {}) {
  const vol = fmtVolume(cur.volume);
  const zero = CAT_ORDER.filter(c => !cur.counts[c] && !(c === "Core" && cur.core));
  const hit = CAT_ORDER.length - zero.length;
  return `
      <hr class="hair">
      <div class="stats period-stats">
        ${goal ? goalStatHtml(cur, prev, goal) : statHtml(cur.weights, plural(cur.weights, "trénink", "tréninky", "tréninků") + (cur.cardio ? ` + ${cur.cardio}× kardio` : ""), deltaHtml(cur.weights, prev.weights))}
        ${statHtml(fmtNum(cur.sets), plural(cur.sets, "série", "série", "sérií"), deltaHtml(cur.sets, prev.sets, true))}
        ${statHtml(`${vol.val}<small>${vol.unit}</small>`, "objem", deltaHtml(cur.volume, prev.volume, true))}
      </div>
      <div class="chart-cap">${cap}</div>
      <hr class="hair">
      <div class="row between" style="margin-bottom:9px">
        <span class="cap">Partie</span>
        <span class="cap"><b style="color:var(--text)">${hit}</b> ze ${CAT_ORDER.length}${cur.prs ? ` · <span style="color:var(--yellow)">${cur.prs}× rekord</span>` : ""}</span>
      </div>
      ${catPipsHtml(cur.counts, cur.core)}
      ${cur.weights ? (zero.length
        ? `<div class="small warn-text" style="margin-top:9px">${ic("alert", 13)} Bez série: ${zero.join(", ")}</div>`
        : `<div class="small" style="margin-top:9px">Všech ${CAT_ORDER.length} partií pokryto</div>`) : ""}`;
}

/* Týden a kalendář v jedné sekci: pás 7 dní se rozbalí do celého měsíce
   (stejné buňky), šipky pak listují měsíce a čísla platí pro měsíc.
   Kalendář s proužky partií a seznamem tréninků zůstává v Historii. */
function weekSectionHtml() {
  if (TV.cal === "month") return monthSectionHtml();
  const off = TV.weekOff;
  const today = todayStr();
  const mon = addDays(mondayOf(today), 7 * off);
  const sun = addDays(mon, 6);
  const end = off === 0 ? today : sun;
  const cur = weekSummary(mon, end);
  const prev = weekSummary(addDays(mon, -7), addDays(end, -7));
  const cells = CZ_DOW.map((lbl, i) => dayCellHtml(addDays(mon, i), today, lbl)).join("");
  const goal = Number(Settings.get().weeklyGoal) || 0;
  const title = off === 0 ? "Tento týden" : off === -1 ? "Minulý týden" : `Týden od ${fmtShort(mon)}`;
  const nav = `<div class="sec-tools">
    <button class="iconbtn sm soft" data-act="td-week" data-dir="-1" aria-label="Předchozí týden">${ic("chevL", 18)}</button>
    <button class="iconbtn sm soft" data-act="td-week" data-dir="1" aria-label="Další týden"${off === 0 ? " disabled" : ""}>${ic("chevR", 18)}</button>
  </div>`;
  return sec(title, `
    ${off === 0 ? weeklyRecapHtml() : ""}
    <div class="card">
      <div class="wk">${cells}</div>
      ${calFootHtml()}
      ${periodBodyHtml(cur, prev, { goal, cap: off === 0 ? "Změna proti stejné době minulý týden" : "Změna proti předchozímu týdnu" })}
    </div>`, { sub: `${fmtShort(mon)} – ${fmtShort(sun)}`, right: nav });
}

function monthSectionHtml() {
  const today = todayStr();
  const y = SV.calY, m = SV.calM;
  const first = dateStr(new Date(y, m, 1)), last = dateStr(new Date(y, m + 1, 0));
  const isCur = today >= first && today <= last;
  const end = isCur ? today : last;
  // probíhající měsíc proti stejné době minulého, uzavřený proti celému předchozímu
  const pFirst = dateStr(new Date(y, m - 1, 1)), pLast = dateStr(new Date(y, m, 0));
  const pEnd = isCur ? [addDays(pFirst, daysBetween(first, today)), pLast].sort()[0] : pLast;
  const cur = weekSummary(first, end);
  const prev = weekSummary(pFirst, pEnd);
  const shift = (new Date(y, m, 1).getDay() + 6) % 7;
  const head = CZ_DOW.map(l => `<span class="wk-l">${l}</span>`).join("");
  let cells = "<div></div>".repeat(shift);
  for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) cells += dayCellHtml(dateStr(new Date(y, m, d)), today);
  const nowM = new Date();
  const title = isCur ? "Tento měsíc" : `${capFirst(CZ_MONTHS[m])}${y !== nowM.getFullYear() ? ` ${y}` : ""}`;
  const nav = `<div class="sec-tools">
    <button class="iconbtn sm soft" data-act="td-month" data-dir="-1" aria-label="Předchozí měsíc">${ic("chevL", 18)}</button>
    <button class="iconbtn sm soft" data-act="td-month" data-dir="1" aria-label="Další měsíc"${isCur ? " disabled" : ""}>${ic("chevR", 18)}</button>
  </div>`;
  return sec(title, `
    <div class="card">
      <div class="wk wk-month">${head}${cells}</div>
      ${calFootHtml()}
      ${periodBodyHtml(cur, prev, { cap: isCur ? "Změna proti stejné době minulý měsíc" : "Změna proti předchozímu měsíci" })}
    </div>`, { sub: isCur ? `${CZ_MONTHS[m]} ${y}` : `${fmtShort(first)} – ${fmtShort(last)}`, right: nav });
}

/* Přepnutí Týden ⇄ Měsíc: měsíc se otevře na zobrazeném týdnu a naopak */
function toggleTodayCal() {
  const today = todayStr();
  if (TV.cal === "week") {
    const sun = addDays(mondayOf(today), 7 * TV.weekOff + 6);
    const d = parseDate(sun < today ? sun : today);
    SV.calY = d.getFullYear(); SV.calM = d.getMonth();
    TV.cal = "month";
  } else {
    const last = dateStr(new Date(SV.calY, SV.calM + 1, 0));
    const target = last < today ? last : today;
    TV.weekOff = Math.min(0, -Math.round(daysBetween(mondayOf(target), mondayOf(today)) / 7));
    TV.cal = "week";
  }
}
function shiftTodayMonth(dir) {
  const d = new Date(SV.calY, SV.calM + dir, 1);
  const now = new Date();
  if (d.getFullYear() * 12 + d.getMonth() > now.getFullYear() * 12 + now.getMonth()) return;
  SV.calY = d.getFullYear(); SV.calM = d.getMonth();
}

/* Týdenní cíl silových tréninků jako kroužek (Nastavení → weeklyGoal).
   Není to streak: počítá se jen tenhle týden, volné dny nic nestojí. */
function goalStatHtml(cur, prev, goal) {
  const n = cur.weights;
  const pct = clamp(n / goal, 0, 1);
  const r = 17, c = 2 * Math.PI * r;
  const met = n >= goal;
  return `<div class="stat goal-stat">
    <div class="goal-ring${met ? " met" : ""}">
      <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
        <circle cx="21" cy="21" r="${r}" fill="none" stroke="var(--s3)" stroke-width="4"/>
        ${n ? `<circle cx="21" cy="21" r="${r}" fill="none" stroke="var(--green-ink)" stroke-width="4" stroke-linecap="round"
          stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}" transform="rotate(-90 21 21)"/>` : ""}
      </svg>
      ${met ? `<span>${ic("check", 15, 3)}</span>` : ""}
    </div>
    <div>
      <div class="stat-v">${n}<small>/ ${goal}</small></div>
      <div class="stat-l">cíl týdne${cur.cardio ? ` · +${cur.cardio}× kardio` : ""}</div>
      ${deltaHtml(n, prev.weights)}
    </div>
  </div>`;
}

/* ---- Rekap minulého týdne — motivace z reálného pokroku, ne ze streaku ----
   Klepnutí ukáže minulý týden, křížek ho do dalšího pondělí schová. */
function weeklyRecapHtml() {
  const thisMon = mondayOf(todayStr());
  const lastMon = addDays(thisMon, -7);
  if (Settings.get().recapDismissed === lastMon) return "";
  const w = weekSummary(lastMon, addDays(thisMon, -1));
  if (!w.weights && !w.cardio) return "";
  const prev = weekSummary(addDays(lastMon, -7), addDays(lastMon, -1));
  const vol = fmtVolume(w.volume);
  const volPct = prev.volume > 0 ? Math.round((w.volume / prev.volume - 1) * 100) : null;
  const parts = [`<b>${w.weights}</b> ${plural(w.weights, "trénink", "tréninky", "tréninků")}`];
  if (w.volume) parts.push(`<b>${vol.val} ${vol.unit}</b>${volPct != null ? ` (${volPct > 0 ? "+" : volPct === 0 ? "±" : ""}${volPct} %)` : ""}`);
  if (w.prs) parts.push(`<b style="color:var(--yellow)">${w.prs}×</b> rekord`);
  return `<div class="note-row" data-act="td-week" data-dir="-1">
    <div class="grow">
      <div class="nr-t">Minulý týden</div>
      <div class="recap-line">${parts.map(p => `<span>${p}</span>`).join("")}</div>
    </div>
    <button class="iconbtn sm soft" data-act="recap-dismiss" data-week="${lastMon}" aria-label="Skrýt">${ic("x", 15, 2.2)}</button>
  </div>`;
}

/* ---- Pokrok v kostce: síla, rekordy, váha, pravidelnost ---- */
function progressTeaserHtml() {
  const hasW = S.sessions.some(s => s.type === "weights");
  if (!hasW && S.bodyLog.length < 2) return "";
  const t = todayStr();
  const idx = strengthIndex();
  const strength = idx ? `
    <div class="card">
      <div class="idx-head">
        <div>
          <div class="cap">Síla · posledních ${PG_STRENGTH_DAYS} dní</div>
          <div class="hero-fig" style="margin-top:6px">${fmtSigned(idx.change)}<small>%</small></div>
        </div>
        <div class="cap" style="text-align:right;padding-bottom:4px"><b style="color:var(--text)">${idx.improved}</b> z ${idx.total}<br>${plural(idx.total, "cviku", "cviků", "cviků")} roste</div>
      </div>
      ${lineChart(idx.series, { height: 96, axis: false, zero: true, fmt: v => fmtSigned(v) + " %" })}
    </div>` : hasW ? `
    <div class="card"><p class="muted" style="margin:0">Síla se ukáže, až nějaký cvik odcvičíš aspoň dvakrát.</p></div>` : "";

  const recs30 = recordEventsInRange(addDays(t, -29), t).sort((a, b) => b.date.localeCompare(a.date));
  const prs = recs30.length;
  const lastPr = recs30[0];
  const avg = movingAvgAt(S.bodyLog, t);
  const avgPrev = movingAvgAt(S.bodyLog, addDays(t, -7));
  const wTrend = avg != null && avgPrev != null ? kgOut(avg) - kgOut(avgPrev) : null;
  const weeks = weekBuckets(9).slice(0, -1).filter(w => !w.before);
  const perWeek = weeks.length ? weeks.reduce((n, w) => n + w.sessions.length, 0) / weeks.length : null;

  const tiles = `
    <div class="tiles">
      <button class="tile" data-act="menu" data-page="records">
        <div class="tile-l">Rekordy</div>
        <div class="tile-v">${prs}</div>
        <div class="tile-s">${lastPr ? esc(exName(lastPr.exerciseId)) : "za 30 dní"}</div>
      </button>
      <button class="tile" data-act="go-progress" data-seg="body">
        <div class="tile-l">Váha Ø</div>
        <div class="tile-v">${avg != null ? fmtNum(kgOut(avg), 1) : "—"}<small>${avg != null ? weightUnit() : ""}</small></div>
        <div class="tile-s${wTrend != null && wTrend > 0.04 ? " up" : ""}">${wTrend != null ? `${fmtSigned(wTrend, 1)} za týden` : "7denní průměr"}</div>
      </button>
      <button class="tile" data-act="go-progress" data-seg="training">
        <div class="tile-l">Týdně</div>
        <div class="tile-v">${perWeek != null ? fmtNum(perWeek, 1) : "—"}<small>${perWeek != null ? "×" : ""}</small></div>
        <div class="tile-s">Ø za ${weeks.length || 8} týdnů</div>
      </button>
    </div>`;

  return sec("Pokrok", strength + tiles, { right: secLink("Vše", "go-progress", `data-seg="training"`) });
}

/* +12 / −3,5 — se znaménkem, minus jako typografické minus */
function fmtSigned(v, dec = 0) {
  const r = Math.round(v * Math.pow(10, dec)) / Math.pow(10, dec);
  if (!r) return "±0";
  return (r > 0 ? "+" : "−") + fmtNum(Math.abs(r), dec);
}

/* ---- Modal zápisu váhy ---- */
/* date = null → dnešek; jinak zpětný zápis (kalendář, Dnes) */
function openBodyWeightModal(date) {
  const day = date || todayStr();
  // předvyplní se hodnota toho dne, jinak poslední známá váha k tomu dni
  const current = bodyWeightOn(day) ?? (lastBodyWeight(day) || {}).weightKg;
  openModal(`${modalTitle("Zapsat váhu")}
    <div class="input-row">
      <label class="field"><span>Tělesná váha (${weightUnit()})</span>
        <input class="input" id="bwInput" type="text" inputmode="decimal"
          value="${current != null ? fmtNum(kgOut(current), 1) : ""}" placeholder="např. 80,5"></label>
      <label class="field"><span>Datum</span>
        <input class="input" id="bwDate" type="date" value="${day}" max="${todayStr()}"></label>
    </div>
    <p class="small" id="bwNote" style="margin:-4px 0 16px"></p>
    <button class="btn primary full" data-act="bw-save" data-date="${day}">Uložit</button>`);
  /* po změně data se předvyplní váha toho dne a upozorní na přepsání */
  const dateEl = document.getElementById("bwDate");
  const note = () => {
    const d = dateEl.value || day;
    const w = bodyWeightOn(d);
    document.getElementById("bwNote").textContent =
      w != null ? `K ${fmtDate(d)} už je zapsáno ${fmtWeight(w)} — uložením ji přepíšeš.` : "";
    return w;
  };
  dateEl.addEventListener("change", () => {
    const w = note();
    if (w != null) document.getElementById("bwInput").value = fmtNum(kgOut(w), 1);
  });
  note();
  document.getElementById("bwInput").focus();
}

function saveBodyWeight(date) {
  const dateEl = document.getElementById("bwDate");
  const day = (dateEl && dateEl.value) || date || todayStr();
  if (day > todayStr()) { toast("Váhu nejde zapsat do budoucna", "err"); return; }
  const kg = kgIn(document.getElementById("bwInput").value);
  if (kg == null || kg <= 0) { toast("Zadej platnou váhu", "err"); return; }
  logBodyWeight(kg, day);
  TV.wDraft = null;
  save();
  closeModal();
  render();
  toast(day === todayStr() ? "Váha zapsána ✓" : `Váha zapsána k ${fmtDate(day)} ✓`, "ok");
}

function templateLabel(t) {
  return { A: "Váhy A", B: "Váhy B", custom: "Libovolný" }[t] || "Váhy";
}

/* Název tréninku — nové sessions nesou kopii jména šablony, staré mapuje templateLabel */
function sessionLabel(s) {
  return s.templateName || templateLabel(s.templateUsed);
}

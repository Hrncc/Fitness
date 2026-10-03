/* ===== Obrazovka: Dnes — den, týden a pokrok na jednom místě =====
   Shora dolů od nejbližšího k nejširšímu: co dnes dlužíš (váha · trénink ·
   jídlo, rozbalená je vždy jen jedna položka), jak vypadá týden a jak se
   ti vede dlouhodobě. Podrobnosti jsou o klepnutí dál v Pokroku. */
"use strict";

const TV = {
  wDraft: null,  // rozepsaná váha ve stepperu, v zobrazené jednotce
  wDate: null,   // den, ke kterému se váha zapíše (null = dnes)
  open: null,    // rozbalená položka dne: null = první nedokončená, "none" = žádná
  weekOff: 0     // procházení týdnů: 0 = tento, -1 = minulý…
};

function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function todayHead() {
  const now = new Date();
  return { eyebrow: capFirst(`${CZ_DAYS_FULL[now.getDay()]} ${now.getDate()}. ${CZ_MONTHS_GEN[now.getMonth()]}`), title: "Dnes" };
}

function renderToday() {
  return todayListHtml() + weekSectionHtml() + progressTeaserHtml();
}

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
  if (S.activeSession) return "workout";
  const st = todayStatus();
  return !st.weight ? "weight" : !st.workout ? "workout" : !st.food ? "food" : null;
}

function todayListHtml() {
  const open = todayOpenKey();
  const st = todayStatus();
  const nut = dayNutrition(todayStr());
  const rows = [
    open === "weight" && !st.weight ? weightOpenHtml() : weightRowHtml(st.weight),
    open === "workout" && (S.activeSession || !st.workout) ? workoutOpenHtml() : workoutRowHtml(),
    open === "food" && !nut.count ? foodOpenHtml() : foodRowHtml(st.food)
  ];
  if (st.checkin) {
    const last = lastCheckin();
    rows.push(tdRow({ icon: "clipboard", title: "Týdenní check-in",
      sub: last ? `na řadě · poslední ${relDay(last.date)}` : "obvody, váha a fotka — jednou týdně",
      state: "nav", act: "ci-new" }));
  }
  return `<div class="card today-card">${rows.join("")}</div>`;
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

/* ---- Váha: potvrzení čísla, ne formulář ----
   Ráno se hýbeš o desetiny, takže se předvyplní poslední hodnota a krokuje
   se po 0,1. Klávesnice se otevře jen když do čísla klepneš. */
function weightRowHtml(done) {
  const today = todayStr();
  if (done) {
    return tdRow({ icon: "scale", title: "Váha", value: fmtWeight(bodyWeightOn(today)), state: "done",
      act: "bw-open", attrs: `data-date="${today}"` });
  }
  const last = lastBodyWeight(today);
  return tdRow({ icon: "scale", title: "Váha",
    sub: last ? `naposledy ${fmtWeight(last.weightKg)} · ${relDay(last.date)}` : "zatím žádné vážení",
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
      <button class="btn primary full" data-act="bw-open" data-date="${today}">Zapsat váhu</button>
    </div>`;
  }
  const avg = movingAvgAt(S.bodyLog, today);
  const weekAgo = movingAvgAt(S.bodyLog, addDays(today, -7));
  const trend = (avg != null && weekAgo != null) ? kgOut(avg) - kgOut(weekAgo) : null;
  const info = [];
  if (last) info.push(`naposledy <b>${fmtFixed(kgOut(last.weightKg), 1)}</b> · ${relDay(last.date)}`);
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
    <button class="btn primary full" data-act="t-w-save">Potvrdit ${fmtFixed(TV.wDraft, 1)} ${weightUnit()}${day !== today ? ` · ${relDay(day)}` : ""}</button>
  </div>`;
}

/* ---- Trénink: co je na řadě, co běží, co je hotové ---- */
function workoutRowHtml() {
  const a = S.activeSession;
  if (a) {
    return tdRow({ icon: "dumbbell", title: "Trénink", sub: `${a.editOf ? "Úprava" : "Probíhá"} · ${esc(sessionLabel(a))}`,
      state: "nav", act: "nav", attrs: `data-tab="workout"` });
  }
  const sessions = sessionsOn(todayStr());
  if (sessions.length) {
    const labels = sessions.map(s => s.type === "cardio" ? cardioLabel(s.entries[0]) : sessionLabel(s));
    const sets = sessions.reduce((n, s) => n + (s.type === "weights" ? s.entries.reduce((k, e) => k + (e.sets || []).length, 0) : 0), 0);
    return tdRow({ icon: "dumbbell", title: esc(labels.join(" + ")),
      sub: sets ? `${sets} ${plural(sets, "série", "série", "sérií")} · hotovo` : "hotovo", state: "done",
      act: sessions.length === 1 ? "w-detail" : "sum-cal-day",
      attrs: sessions.length === 1 ? `data-id="${sessions[0].id}"` : `data-date="${todayStr()}"` });
  }
  const next = nextTemplate();
  return tdRow({ icon: "dumbbell", title: "Trénink", sub: next ? `na řadě ${esc(next.name)}` : "zatím nic",
    act: "td-open", attrs: `data-k="workout"` });
}

function workoutOpenHtml() {
  const a = S.activeSession;
  if (a) {
    const sets = a.type === "weights" ? a.entries.reduce((n, e) => n + (e.sets || []).length, 0) : 0;
    const counts = sessionCatSets(a);
    const core = a.core === true;
    const hit = CAT_ORDER.filter(c => counts[c] > 0 || (core && c === "Core")).length;
    const done = a.entries.filter(e => e.done).length;
    return `<div class="td-open">
      ${tdOpenHead("dumbbell", "Trénink", "workout", `<span class="badge${a.editOf ? "" : " green"}">${a.editOf ? "úprava" : "probíhá"}</span>`)}
      <div class="td-title">${esc(sessionLabel(a))}</div>
      <div class="td-meta">${done} z ${a.entries.length} cviků · ${sets} ${plural(sets, "série", "série", "sérií")} · ${hit} ze ${CAT_ORDER.length} partií</div>
      ${a.type === "weights" ? `<div class="mt">${catPipsHtml(counts, core)}</div>` : ""}
      <button class="btn primary full mt2" data-act="nav" data-tab="workout">${a.editOf ? "Pokračovat v úpravě" : "Pokračovat"}</button>
    </div>`;
  }
  const next = nextTemplate();
  if (!next) {
    return `<div class="td-open">
      ${tdOpenHead("dumbbell", "Trénink", "workout")}
      <p class="muted" style="margin:0 0 16px">Dnes ještě nemáš zapsaný žádný trénink.</p>
      <button class="btn primary full" data-act="nav" data-tab="workout">Otevřít trénink</button>
    </div>`;
  }
  const last = lastWeightsSession();
  const tplCounts = {};
  for (const id of next.exercises) { const c = exCategory(id); if (c) tplCounts[c] = (tplCounts[c] || 0) + 1; }
  const g = lastSessionGaps();
  const gaps = g ? [...g.missed.map(m => m.cat), ...g.low.map(l => l.cat)] : [];
  const n = next.exercises.length;
  return `<div class="td-open">
    ${tdOpenHead("dumbbell", "Trénink", "workout", `<span class="badge">na řadě</span>`)}
    <div class="td-title">${esc(next.name)}</div>
    <div class="td-meta">${n} ${plural(n, "cvik", "cviky", "cviků")}${last ? ` · naposledy ${relDay(last.date)}` : ""}</div>
    <div class="mt">${catPipsHtml(tplCounts)}</div>
    ${gaps.length ? `<div class="td-warn">${ic("alert", 15)}Minule uteklo: ${gaps.join(", ")}</div>` : ""}
    <button class="btn primary full mt2" data-act="t-begin-next" data-template="${next.id}">${ic("play", 15)} Začít trénink</button>
    <button class="btn text full" data-act="nav" data-tab="workout">Jiná šablona nebo kardio</button>
  </div>`;
}

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
    return tdRow({ icon: "food", title: "Jídlo", value: `${lbl} · B ${m.proteinOk ? "✓" : "✗"}`, state: "done",
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

function weekSectionHtml() {
  const off = TV.weekOff;
  const today = todayStr();
  const mon = addDays(mondayOf(today), 7 * off);
  const sun = addDays(mon, 6);
  const end = off === 0 ? today : sun;
  const cur = weekSummary(mon, end);
  const prev = weekSummary(addDays(mon, -7), addDays(end, -7));

  const cells = CZ_DOW.map((lbl, i) => {
    const ds = addDays(mon, i);
    const sess = sessionsOn(ds);
    const trained = sess.some(s => s.type === "weights");
    const cardio = sess.some(s => s.type === "cardio");
    const food = effectiveDayRating(ds);
    return `<div class="wk-d${trained ? " trained" : ""}${cardio ? " cardio" : ""}${ds === today ? " today" : ""}${ds > today ? " future" : ""}"
        data-act="sum-cal-day" data-date="${ds}">
      <span class="wk-l">${lbl}</span>
      <span class="wk-n">${parseDate(ds).getDate()}</span>
      <span class="wk-dots"><i class="${bodyWeightOn(ds) != null ? "on" : ""}"></i><i class="${food ? (food.foodRating === "ok" ? "on" : "part") : ""}"></i></span>
    </div>`;
  }).join("");

  const vol = fmtVolume(cur.volume);
  const zero = CAT_ORDER.filter(c => !cur.counts[c] && !(c === "Core" && cur.core));
  const hit = CAT_ORDER.length - zero.length;
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
      <div class="wk-legend">
        <span><i style="background:var(--green)"></i>trénink</span>
        <span><i style="background:var(--p-cardio)"></i>kardio</span>
        <span><i style="background:var(--text2)"></i>váha · jídlo</span>
      </div>
      <hr class="hair">
      <div class="stats">
        ${goal ? goalStatHtml(cur, prev, goal) : statHtml(cur.weights, plural(cur.weights, "trénink", "tréninky", "tréninků") + (cur.cardio ? ` + ${cur.cardio}× kardio` : ""), deltaHtml(cur.weights, prev.weights))}
        ${statHtml(fmtNum(cur.sets), plural(cur.sets, "série", "série", "sérií"), deltaHtml(cur.sets, prev.sets, true))}
        ${statHtml(`${vol.val}<small>${vol.unit}</small>`, "objem", deltaHtml(cur.volume, prev.volume, true))}
      </div>
      <div class="chart-cap">${off === 0 ? "Změna proti stejné době minulý týden" : "Změna proti předchozímu týdnu"}</div>
      <hr class="hair">
      <div class="row between" style="margin-bottom:9px">
        <span class="cap">Partie</span>
        <span class="cap"><b style="color:var(--text)">${hit}</b> ze ${CAT_ORDER.length}${cur.prs ? ` · <span style="color:var(--yellow)">${cur.prs}× rekord</span>` : ""}</span>
      </div>
      ${catPipsHtml(cur.counts, cur.core)}
      ${cur.weights ? (zero.length
        ? `<div class="small warn-text" style="margin-top:9px">Bez série: ${zero.join(", ")}</div>`
        : `<div class="small" style="margin-top:9px">Všech ${CAT_ORDER.length} partií pokryto</div>`) : ""}
    </div>`, { sub: `${fmtShort(mon)} – ${fmtShort(sun)}`, right: nav });
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
        ${n ? `<circle cx="21" cy="21" r="${r}" fill="none" stroke="var(--green)" stroke-width="4" stroke-linecap="round"
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
  if (w.volume) parts.push(`<b>${vol.val} ${vol.unit}</b>${volPct != null ? ` (${volPct >= 0 ? "+" : ""}${volPct} %)` : ""}`);
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

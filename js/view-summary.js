/* ===== Obrazovka: Souhrn — kalendář, statistiky, grafy =====
   Barevná logika: data = bílá/šedá (čísla, křivky), volt = cíle a interakce,
   zlatá = rekordy, makra = škála mac1 (bílkoviny) → mac3 (tuky). */
"use strict";

const SV = {
  catRange: "all",    // rozsah karty partií: week | month | all (celá historie)
  exerciseId: null,   // vybraný cvik pro graf progresu
  calY: new Date().getFullYear(),
  calM: new Date().getMonth()
};

function renderSummary() {
  /* Statistické karty jedou na pevném měsíčním okně; rozsah se přepíná
     jen tam, kde na něm záleží — v kartě Partie. */
  const days = 30;
  const from = addDays(todayStr(), -(days - 1));

  const inRange = s => s.date >= from;
  const sessions = S.sessions.filter(inRange);
  const weights = sessions.filter(s => s.type === "weights");
  const cardio = sessions.filter(s => s.type === "cardio");
  const totalVolume = weights.reduce((v, s) => v + sessionVolume(s), 0);
  const cardioMin = cardio.reduce((v, s) => v + ((s.entries[0] || {}).duration || 0), 0);

  /* -- sjednocený kalendář: trénink + kalorický cíl -- */
  const calendarCard = `
    <div class="card">
      <div class="h2">Kalendář</div>
      ${calendarHtml(SV.calY, SV.calM, ds => {
        const sess = sessionsOn(ds);
        const hasW = sess.some(s => s.type === "weights");
        const hasC = sess.some(s => s.type === "cardio");
        const f = calorieGoalMet(ds);
        if (!hasW && !hasC && !f) return null;
        return {
          cls: hasW && hasC ? "d-both" : hasW ? "d-weights" : hasC ? "d-cardio" : "",
          mark: f ? `<i style="background:var(--mac1)"></i>` : ""
        };
      }, "sum-cal-day")}
      <div class="cal-legend small mt">
        <span><i style="background:var(--cal-w);box-shadow:inset 0 0 0 1.5px rgba(90,169,245,.55)"></i> silový</span>
        <span><i style="background:var(--cal-c);box-shadow:inset 0 0 0 1.5px rgba(255,77,94,.55)"></i> kardio</span>
        <span><i style="background:linear-gradient(135deg,var(--cal-w) 0 50%,var(--cal-c) 50% 100%);box-shadow:inset 0 0 0 1.5px rgba(90,169,245,.45)"></i> obojí</span>
        <span><i class="dot" style="background:var(--mac1)"></i> splněný kalorický cíl (±10 %)</span>
      </div>
      <div class="small" style="margin-top:6px">Klepni na den — ukáže detail a nabídne zápis tréninku i jídla.</div>
    </div>`;

  /* -- trénink: statistiky -- */
  const workoutStats = `
    <div class="card">
      <div class="h2">Trénink <span class="small">(posledních ${days} dní)</span></div>
      <div class="stat-grid">
        <div class="stat"><div class="val">${weights.length}</div><div class="lbl">silových tréninků</div></div>
        <div class="stat"><div class="val">${cardio.length}</div><div class="lbl">kardio (${fmtNum(cardioMin)} min)</div></div>
        <div class="stat"><div class="val">${fmtWeight(totalVolume, false)}</div><div class="lbl">celkový objem (${weightUnit()})</div></div>
        <div class="stat"><div class="val" style="color:var(--yellow)">${prCountInRange(from)}</div><div class="lbl">nových PR</div></div>
      </div>
      ${(() => {
        const rated = sessions.filter(s => s.rating);
        if (!rated.length) return "";
        const avg = rated.reduce((a, s) => a + s.rating, 0) / rated.length;
        return `<p class="small mt" style="margin-bottom:0">Ø kvalita tréninků: <b style="color:var(--text)">${fmtNum(avg, 1)}/10</b> (${rated.length} hodnocení)</p>`;
      })()}
    </div>`;

  /* -- partie: co se dělá málo --
     Sloupec je počet sérií, ne kila — u core a cviků s vlastní vahou je objem
     nulový, takže by taková partie vypadala jako netrénovaná. „Naposledy"
     se počítá vždy z celé historie, ať přepnutý rozsah nelže. */
  const catStats = {};
  for (const c of EX_CATEGORIES) catStats[c] = { sets: 0, volume: 0, last: null };
  const catOf = e => (getExercise(e.exerciseId) || {}).category || "Ostatní";
  const catFrom = { week: addDays(todayStr(), -6), month: addDays(todayStr(), -29), all: "" }[SV.catRange];
  for (const s of S.sessions) {
    if (s.type !== "weights") continue;
    for (const e of s.entries) {
      const cat = catOf(e);
      if (!catStats[cat]) catStats[cat] = { sets: 0, volume: 0, last: null };
      const st = catStats[cat];
      if (!(e.sets || []).length) continue;
      if (!st.last || s.date > st.last) st.last = s.date;
      if (s.date < catFrom) continue;
      for (const set of e.sets) {
        st.sets++;
        st.volume += (set.reps || 0) * (set.weight || 0);
      }
    }
  }
  const catRows = Object.entries(catStats)
    .sort((a, b) => b[1].sets - a[1].sets || b[1].volume - a[1].volume);
  const catMaxSets = Math.max(...catRows.map(([, v]) => v.sets), 1);
  const setWord = n => n === 1 || (n >= 2 && n <= 4) ? "série" : "sérií";
  const catRangeLabel = { week: "posledních 7 dní", month: "posledních 30 dní", all: "celá historie" }[SV.catRange];
  const catChips = [["week", "Týden"], ["month", "Měsíc"], ["all", "Vše"]].map(([k, lbl]) =>
    `<button class="chip${SV.catRange === k ? " on" : ""}" data-act="s-cat-range" data-range="${k}">${lbl}</button>`).join("");

  const categoryCard = `
    <div class="card">
      <div class="h2">Partie <span class="small">(${catRangeLabel})</span></div>
      <div class="chips">${catChips}</div>
      ${catRows.map(([cat, v]) => {
        const gap = v.last == null ? null : daysBetween(v.last, todayStr());
        const stale = gap == null || gap > 14;
        const lastTxt = v.last == null ? "netrénováno"
          : gap === 0 ? "dnes" : gap === 1 ? "včera" : `před ${gap} dny`;
        return `
        <div class="mt">
          <div class="row between" style="margin-bottom:4px">
            <span class="small" style="font-weight:700;color:var(--${v.sets ? "text" : "text3"})">${esc(cat)}</span>
            <span class="small">${v.sets} ${setWord(v.sets)}${v.volume ? ` · ${fmtNum(kgOut(v.volume))} ${weightUnit()}` : ""}
              · <span style="${stale ? "color:var(--yellow);font-weight:700" : ""}">${lastTxt}</span></span>
          </div>
          <div class="bar mini"><div style="width:${(v.sets / catMaxSets * 100).toFixed(1)}%;background:var(--chart)"></div></div>
        </div>`;
      }).join("")}
      <p class="small mt" style="margin-bottom:0">Sloupec = počet sérií (porovnává partie líp než kila).
        Zlatě partie, kterou jsi netrénoval přes 14 dní — „naposledy" je vždy z celé historie.</p>
    </div>`;

  /* -- progres cviku -- */
  const trained = [...new Set(S.sessions.filter(s => s.type === "weights")
    .flatMap(s => s.entries.map(e => e.exerciseId)))].filter(getExercise);
  let exerciseChart = "";
  if (trained.length) {
    if (!SV.exerciseId || !trained.includes(SV.exerciseId)) SV.exerciseId = trained[0];
    const series = S.sessions
      .filter(s => s.type === "weights")
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => {
        let best = 0;
        for (const e of s.entries) if (e.exerciseId === SV.exerciseId)
          for (const st of e.sets || []) best = Math.max(best, est1RM(st.weight, st.reps));
        return best ? { date: s.date, value: Math.round(kgOut(best) * 10) / 10 } : null;
      }).filter(Boolean);
    const opts = trained.map(id =>
      `<option value="${id}"${id === SV.exerciseId ? " selected" : ""}>${esc(exName(id))}</option>`).join("");
    exerciseChart = `
      <div class="card">
        <div class="h2">Progres cviku <span class="small">(e1RM, ${weightUnit()})</span></div>
        <select class="input" data-change="s-exercise" style="margin-bottom:12px">${opts}</select>
        ${lineChart(series, { color: "chart" })}
      </div>`;
  }

  /* -- strava: statistiky -- */
  const nutDays = [];
  for (let i = days - 1; i >= 0; i--) {
    const ds = addDays(todayStr(), -i);
    const n = dayNutrition(ds);
    if (n.count) nutDays.push({ date: ds, ...n });
  }
  const avg = key => nutDays.length ? Math.round(nutDays.reduce((v, d) => v + d[key], 0) / nutDays.length) : 0;
  const goalMetCount = nutDays.filter(d => calorieGoalMet(d.date)).length;

  const foodStats = `
    <div class="card">
      <div class="h2">Strava <span class="small">(posledních ${days} dní)</span></div>
      <div class="stat-grid">
        <div class="stat"><div class="val">${fmtNum(avg("calories"))}</div><div class="lbl">Ø kcal / den</div></div>
        <div class="stat"><div class="val">${goalMetCount}<span class="small"> / ${nutDays.length}</span></div><div class="lbl">dní v cíli (±10 %)</div></div>
      </div>
      <div class="stat-grid three mt">
        <div class="stat"><div class="val" style="color:var(--mac1)">${fmtNum(avg("protein"))} g</div><div class="lbl">Ø bílkoviny</div></div>
        <div class="stat"><div class="val" style="color:var(--mac2)">${fmtNum(avg("carbs"))} g</div><div class="lbl">Ø sacharidy</div></div>
        <div class="stat"><div class="val" style="color:var(--mac3)">${fmtNum(avg("fat"))} g</div><div class="lbl">Ø tuky</div></div>
      </div>
    </div>`;

  const kcalSeries = nutDays.map(d => ({ date: d.date, value: d.calories }));
  const foodChart = `
    <div class="card">
      <div class="h2">Kalorie vs cíl</div>
      ${lineChart(kcalSeries, { color: "chart", goal: S.goal.dailyCalories })}
    </div>`;

  /* -- tělesná váha: denní hodnoty (tečky) + 7denní klouzavý průměr (křivka) -- */
  const inRangeW = S.bodyLog.filter(b => b.date >= from);
  const wl = inRangeW.length >= 2 ? inRangeW : S.bodyLog;
  const maSeries = wl.map(b => {
    const v = movingAvgAt(S.bodyLog, b.date);
    return { date: b.date, value: v == null ? null : Math.round(kgOut(v) * 10) / 10 };
  });
  const rawSeries = wl.map(b => ({ date: b.date, value: Math.round(kgOut(b.weightKg) * 10) / 10 }));
  const latest = lastBodyWeight();
  let weightDelta = "";
  if (inRangeW.length >= 2) {
    const d1 = movingAvgAt(S.bodyLog, inRangeW[0].date);
    const d2 = movingAvgAt(S.bodyLog, inRangeW[inRangeW.length - 1].date);
    const diff = kgOut(d2) - kgOut(d1);
    weightDelta = `<div class="stat"><div class="val">${diff > 0 ? "+" : ""}${fmtNum(diff, 1)} ${weightUnit()}</div><div class="lbl">trend za ${days} dní</div></div>`;
  }
  const weightCard = `
    <div class="card">
      <div class="h2">Tělesná váha <span class="small">(křivka = 7denní průměr, tečky = denní)</span></div>
      <div class="stat-grid">
        <div class="stat"><div class="val">${latest ? fmtWeight(latest.weightKg, false) : "—"} ${weightUnit()}</div><div class="lbl">aktuální (${latest ? fmtDate(latest.date) : "bez záznamu"})</div></div>
        ${weightDelta || `<div class="stat"><div class="val">${S.bodyLog.length}</div><div class="lbl">záznamů celkem</div></div>`}
      </div>
      <div class="mt">${lineChart(maSeries, { color: "chart", raw: rawSeries })}</div>
    </div>`;

  /* -- bilance po týdnech: Ø příjem vs změna vážního trendu -- */
  const weekRows = [];
  const mon0 = mondayOf(todayStr());
  for (let i = 3; i >= 0; i--) {
    const start = addDays(mon0, -7 * i);
    const end = addDays(start, 6);
    const kcals = [];
    for (let dd = start; dd <= end && dd <= todayStr(); dd = addDays(dd, 1)) {
      const n = dayNutrition(dd);
      if (n.count) kcals.push(n.calories);
    }
    const avgKcal = kcals.length ? Math.round(kcals.reduce((a, b) => a + b, 0) / kcals.length) : null;
    const m1 = movingAvgAt(S.bodyLog, start);
    const m2 = movingAvgAt(S.bodyLog, end);
    const dW = (m1 != null && m2 != null) ? kgOut(m2) - kgOut(m1) : null;
    if (avgKcal == null && dW == null) continue;
    const s = parseDate(start), e = parseDate(end);
    weekRows.push(`
      <div class="list-item">
        <div class="grow name">${s.getDate()}.${s.getMonth() + 1}.–${e.getDate()}.${e.getMonth() + 1}.</div>
        <span class="small" style="font-weight:700">${avgKcal != null ? `Ø ${fmtNum(avgKcal)} kcal` : "—"}</span>
        <span style="font-weight:700;min-width:80px;text-align:right">${dW != null ? `${dW > 0 ? "+" : ""}${fmtNum(dW, 1)} ${weightUnit()}` : "—"}</span>
      </div>`);
  }
  const balanceCard = weekRows.length ? `
    <div class="card">
      <div class="h2">Bilance po týdnech <span class="small">(Ø příjem · změna váhy)</span></div>
      ${weekRows.join("")}
      <p class="small mt">Změna váhy je počítaná ze 7denního průměru, ne z denních výkyvů.</p>
    </div>` : "";

  return calendarCard + categoryCard + workoutStats + exerciseChart + weightCard + balanceCard + foodStats + foodChart;
}

/* 7denní klouzavý průměr váhy k danému datu (kg); null bez záznamů v okně */
function movingAvgAt(list, date) {
  const from = addDays(date, -6);
  const win = list.filter(x => x.date >= from && x.date <= date);
  if (!win.length) return null;
  return win.reduce((s, x) => s + x.weightKg, 0) / win.length;
}

/* Detail dne: tréninky + strava v jednom modalu */
function openDaySummary(ds) {
  const sess = sessionsOn(ds);
  const workoutHtml = sess.length
    ? sess.map(sessionDetailHtml).join(`<hr style="border-color:var(--line);margin:14px 0">`)
    : `<div class="empty-note" style="padding:14px">Žádný trénink</div>`;
  openModal(`${modalTitle(fmtDate(ds))}
    <div class="h3">Trénink</div>${workoutHtml}
    <div class="h3" style="margin-top:18px">Strava</div>${foodDayHtml(ds)}
    <div class="h3" style="margin-top:18px">Přidat do tohoto dne</div>
    ${dayAddButtons(ds)}`);
}

/* Zápis tréninku i jídla přímo ze dne v kalendáři — šablony spouští session
   rovnou s datem daného dne (WV.date), kardio otevře svůj formulář. */
function dayAddButtons(ds) {
  const tplBtns = S.templates.map(t =>
    `<button class="btn sm" style="flex:1 1 40%;border-color:var(--green);color:var(--green)"
      data-act="sum-add-workout" data-tpl="${t.id}" data-date="${ds}">${esc(t.name)}</button>`).join("");
  return `
    <div class="row" style="flex-wrap:wrap;gap:8px">${tplBtns}
      <button class="btn sm" style="flex:1 1 40%;border-color:var(--green);color:var(--green)"
        data-act="sum-add-workout" data-tpl="custom" data-date="${ds}">Libovolný cvik</button>
    </div>
    <div class="row mt" style="gap:8px">
      <button class="btn sm grow" style="border-color:var(--green);color:var(--green)"
        data-act="sum-add-cardio" data-date="${ds}">+ Kardio</button>
      <button class="btn sm primary grow" data-act="sum-add-food" data-date="${ds}">+ Jídlo</button>
    </div>`;
}

function prCountInRange(from) {
  let n = 0;
  const ids = new Set(S.sessions.filter(s => s.type === "weights").flatMap(s => s.entries.map(e => e.exerciseId)));
  for (const id of ids) n += prHistory(id).filter(h => h.date >= from).length;
  return n;
}

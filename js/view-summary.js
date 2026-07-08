/* ===== Obrazovka: Souhrn — kalendář, statistiky, grafy =====
   Barevná logika: data = bílá/šedá (čísla, křivky), volt = cíle a interakce,
   zlatá = rekordy, makra = škála mac1 (bílkoviny) → mac3 (tuky). */
"use strict";

const SV = {
  range: "week",      // week (7 dní) | month (30 dní)
  exerciseId: null,   // vybraný cvik pro graf progresu
  calY: new Date().getFullYear(),
  calM: new Date().getMonth()
};

function renderSummary() {
  const days = SV.range === "week" ? 7 : 30;
  const from = addDays(todayStr(), -(days - 1));

  const inRange = s => s.date >= from;
  const sessions = S.sessions.filter(inRange);
  const weights = sessions.filter(s => s.type === "weights");
  const cardio = sessions.filter(s => s.type === "cardio");
  const totalVolume = weights.reduce((v, s) => v + sessionVolume(s), 0);
  const cardioMin = cardio.reduce((v, s) => v + ((s.entries[0] || {}).duration || 0), 0);

  const rangeTabs = `
    <div class="subtabs">
      <button class="subtab${SV.range === "week" ? " on" : ""}" data-act="s-range" data-range="week">Týden</button>
      <button class="subtab${SV.range === "month" ? " on" : ""}" data-act="s-range" data-range="month">Měsíc</button>
    </div>`;

  /* -- sjednocený kalendář: trénink + kalorický cíl -- */
  const calendarCard = `
    <div class="card">
      <div class="h2">Kalendář</div>
      ${calendarHtml(SV.calY, SV.calM, ds => {
        const w = sessionsOn(ds).length > 0;
        const f = calorieGoalMet(ds);
        if (!w && !f) return null;
        return {
          cls: "", mark:
            (w ? `<i style="background:var(--text)"></i>` : "") +
            (f ? `<i style="background:var(--green)"></i>` : "")
        };
      }, "sum-cal-day")}
      <div class="small mt"><span style="color:var(--text)">●</span> trénink&nbsp;&nbsp;
        <span style="color:var(--green)">●</span> splněný kalorický cíl (±10 %) — klikni na den pro detail</div>
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
    </div>`;

  /* -- objem po týdnech (posledních 8 týdnů) -- */
  const weeksData = [];
  let mon = mondayOf(todayStr());
  for (let i = 7; i >= 0; i--) {
    const start = addDays(mon, -7 * i);
    const end = addDays(start, 6);
    const vol = S.sessions
      .filter(s => s.type === "weights" && s.date >= start && s.date <= end)
      .reduce((v, s) => v + sessionVolume(s), 0);
    const d = parseDate(start);
    weeksData.push({ label: `${d.getDate()}.${d.getMonth() + 1}.`, value: Math.round(kgOut(vol)) });
  }
  const volumeChart = `
    <div class="card">
      <div class="h2">Objem po týdnech <span class="small">(${weightUnit()})</span></div>
      ${barChart(weeksData, { color: "chart" })}
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

  /* -- přehled PR -- */
  const prs = allPRs().slice(0, 5);
  const prCard = prs.length ? `
    <div class="card">
      <div class="h2">Poslední rekordy</div>
      ${prs.map(({ exerciseId, pr }) => `
        <div class="list-item">
          <div class="grow"><div class="name">${esc(exName(exerciseId))}</div>
            <div class="small">${fmtDate(pr.date)}</div></div>
          <span style="font-weight:700;color:var(--yellow)">${fmtWeight(pr.weight)} × ${pr.reps}</span>
        </div>`).join("")}
    </div>` : "";

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

  return rangeTabs + calendarCard + workoutStats + volumeChart + exerciseChart + prCard + weightCard + balanceCard + foodStats + foodChart;
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
    <button class="btn primary full mt" data-act="sum-add-food" data-date="${ds}">+ Přidat jídlo do tohoto dne</button>`);
}

function prCountInRange(from) {
  let n = 0;
  const ids = new Set(S.sessions.filter(s => s.type === "weights").flatMap(s => s.entries.map(e => e.exerciseId)));
  for (const id of ids) n += prHistory(id).filter(h => h.date >= from).length;
  return n;
}

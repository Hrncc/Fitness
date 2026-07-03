/* ===== Obrazovka: Souhrn — statistiky a grafy ===== */
"use strict";

const SV = {
  range: "week",      // week (7 dní) | month (30 dní)
  exerciseId: null    // vybraný cvik pro graf progresu
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

  /* -- trénink: statistiky -- */
  const workoutStats = `
    <div class="card">
      <div class="h2">Trénink <span class="small">(posledních ${days} dní)</span></div>
      <div class="stat-grid">
        <div class="stat"><div class="val" style="color:var(--green)">${weights.length}</div><div class="lbl">silových tréninků</div></div>
        <div class="stat"><div class="val" style="color:var(--orange)">${cardio.length}</div><div class="lbl">kardio (${fmtNum(cardioMin)} min)</div></div>
        <div class="stat"><div class="val">${fmtWeight(totalVolume, false)}</div><div class="lbl">celkový objem (${weightUnit()})</div></div>
        <div class="stat"><div class="val" style="color:var(--pink)">${prCountInRange(from)}</div><div class="lbl">nových PR</div></div>
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
      ${barChart(weeksData, { color: "orange" })}
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
        ${lineChart(series, { color: "pink" })}
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
          <span style="font-weight:700;color:var(--pink)">${fmtWeight(pr.weight)} × ${pr.reps}</span>
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
        <div class="stat"><div class="val" style="color:var(--green)">${fmtNum(avg("calories"))}</div><div class="lbl">Ø kcal / den</div></div>
        <div class="stat"><div class="val">${goalMetCount}<span class="small"> / ${nutDays.length}</span></div><div class="lbl">dní v cíli (±10 %)</div></div>
        <div class="stat"><div class="val" style="color:var(--pink)">${fmtNum(avg("protein"))} g</div><div class="lbl">Ø bílkoviny</div></div>
        <div class="stat"><div class="val"><span style="color:var(--cyan)">${fmtNum(avg("carbs"))}</span> / <span style="color:var(--purple)">${fmtNum(avg("fat"))}</span> g</div><div class="lbl">Ø sacharidy / tuky</div></div>
      </div>
    </div>`;

  const kcalSeries = nutDays.map(d => ({ date: d.date, value: d.calories }));
  const foodChart = `
    <div class="card">
      <div class="h2">Kalorie vs cíl</div>
      ${lineChart(kcalSeries, { color: "cyan", goal: S.goal.dailyCalories })}
    </div>`;

  return rangeTabs + workoutStats + volumeChart + exerciseChart + prCard + foodStats + foodChart;
}

function prCountInRange(from) {
  let n = 0;
  const ids = new Set(S.sessions.filter(s => s.type === "weights").flatMap(s => s.entries.map(e => e.exerciseId)));
  for (const id of ids) n += prHistory(id).filter(h => h.date >= from).length;
  return n;
}

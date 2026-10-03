/* ===== Pokrok → Strava, detail dne a sdílené pomocníky =====
   Strava odpovídá na „trefuju jídlo?": tento týden (dodržování z rychlého
   i podrobného zápisu), posledních 30 dní, kalorie proti cíli a bilance
   po týdnech (příjem vs změna vážního trendu).
   Barevná logika: data = bílá/šedá, volt = cíle, makra = škála mac1 → mac3. */
"use strict";

const SV = {
  catRange: "all",    // rozsah souhrnu partií: week | month | all | custom
  catFrom: addDays(todayStr(), -13),   // vlastní rozsah partií (od–do včetně)
  catTo: todayStr(),
  calY: new Date().getFullYear(),      // měsíc v kalendáři (Historie)
  calM: new Date().getMonth()
};

function weekBounds() {
  const mon = mondayOf(todayStr());
  return { from: mon, to: addDays(mon, 6), today: todayStr() };
}

function foodProgressHtml() {
  const hasFood = S.foodLog.length || (S.dayLog || []).length;
  if (!hasFood) {
    return `<div class="card">
      <p class="muted" style="margin:0 0 16px">Strava se tu ukáže, až začneš zapisovat. Stačí dvě klepnutí na Dnes —
        jestli jsi byl v kalorickém cíli a jestli jsi dal bílkoviny.</p>
      <button class="btn full" data-act="menu" data-page="food">Otevřít jídelníček</button>
    </div>`;
  }
  return foodWeekHtml() + food30Html() + balanceHtml() + `
    <button class="btn full mt2" data-act="menu" data-page="food">${ic("food", 18)} Otevřít jídelníček</button>`;
}

/* ---- Tento týden: dodržování a váha ---- */
function foodWeekHtml() {
  const { from, to, today } = weekBounds();
  const end = to < today ? to : today;
  const a = adherence(from, end);
  const avg = movingAvgAt(S.bodyLog, end);
  const prev = movingAvgAt(S.bodyLog, addDays(end, -7));
  const trend = (avg != null && prev != null) ? kgOut(avg) - kgOut(prev) : null;
  const ringCenter = `<b>${a.pct != null ? a.pct + "%" : "—"}</b><span>v cíli</span>`;
  const missing = daysBetween(from, end) + 1 - a.logged;
  return sec("Tento týden", `
    <div class="card">
      <div class="hero-main">
        ${ringHtml(a.ok, a.logged || 1, 112, ringCenter, 9)}
        <div class="wk-kv">
          <div><span>dní v cíli</span><b>${a.ok} ze ${a.logged}</b></div>
          <div><span>bílkoviny</span><b>${a.protein} ze ${a.logged}</b></div>
          <div><span>váha Ø</span><b>${avg != null ? fmtNum(kgOut(avg), 1) : "—"}</b></div>
          <div><span>za týden</span><b style="color:var(--${trend != null && trend > 0.04 ? "green" : "text"})">${
            trend != null ? fmtSigned(trend, 1) : "—"}</b></div>
        </div>
      </div>
      ${missing > 0 ? `<div class="chart-cap" style="margin-top:16px">Bez záznamu ${missing} ${plural(missing, "den", "dny", "dní")}
        — nezapsaný den se do dodržování nepočítá.</div>` : ""}
    </div>`, { sub: `${fmtShort(from)} – ${fmtShort(to)}` });
}

/* ---- Posledních 30 dní: průměry a kalorie proti cíli ---- */
function food30Html() {
  const days = 30;
  const nutDays = [];
  for (let i = days - 1; i >= 0; i--) {
    const ds = addDays(todayStr(), -i);
    const n = dayNutrition(ds);
    if (n.count) nutDays.push({ date: ds, ...n });
  }
  if (!nutDays.length) return "";
  const avg = key => Math.round(nutDays.reduce((v, d) => v + d[key], 0) / nutDays.length);
  const goalMet = nutDays.filter(d => calorieGoalMet(d.date)).length;
  const macro = (lbl, key, col) => `<div class="stat"><div class="stat-v" style="font-size:22px">${fmtNum(avg(key))}<small>g</small></div>
    <div class="stat-l row" style="gap:6px"><i class="p-dot" style="background:var(--${col})"></i>${lbl}</div></div>`;
  return sec("Posledních 30 dní", `
    <div class="card">
      <div class="stats two">
        ${statHtml(`${fmtNum(avg("calories"))}<small>kcal</small>`, "Ø za zapsaný den")}
        ${statHtml(`${goalMet}<small>/ ${nutDays.length}</small>`, "dní v cíli ±10 %")}
      </div>
      <hr class="hair">
      <div class="stats">${macro("bílkoviny", "protein", "mac1")}${macro("sacharidy", "carbs", "mac2")}${macro("tuky", "fat", "mac3")}</div>
      <hr class="hair">
      ${lineChart(nutDays.map(d => ({ date: d.date, value: d.calories })), { goal: S.goal.dailyCalories, dec: 0, unit: " kcal" })}
      <div class="chart-cap">Kalorie zapsaných dní · přerušovaná čára = cíl</div>
    </div>`, { sub: `${nutDays.length} ${plural(nutDays.length, "zapsaný den", "zapsané dny", "zapsaných dní")}` });
}

/* ---- Bilance po týdnech: Ø příjem vs změna vážního trendu ---- */
function balanceHtml() {
  const rows = [];
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
    rows.push(`
      <div class="list-item">
        <div class="grow name">${fmtShort(start)} – ${fmtShort(end)}</div>
        <span class="li-val" style="color:var(--text2)">${avgKcal != null ? `Ø ${fmtNum(avgKcal)} kcal` : "—"}</span>
        <span class="li-val" style="min-width:74px">${dW != null ? `${fmtSigned(dW, 1)} ${weightUnit()}` : "—"}</span>
      </div>`);
  }
  if (!rows.length) return "";
  return sec("Bilance po týdnech", `<div class="card rows">${rows.join("")}</div>
    <p class="small" style="margin:4px 4px 0">Změna váhy je ze 7denního průměru, ne z denních výkyvů.</p>`,
    { sub: "Ø příjem · změna váhy" });
}

/* 7denní klouzavý průměr váhy k danému datu (kg); null bez záznamů v okně */
function movingAvgAt(list, date) {
  const from = addDays(date, -6);
  const win = list.filter(x => x.date >= from && x.date <= date);
  if (!win.length) return null;
  return win.reduce((s, x) => s + x.weightKg, 0) / win.length;
}

/* Detail dne: tréninky, strava a váha v jednom sheetu + zápis do toho dne */
function openDaySummary(ds) {
  const sess = sessionsOn(ds);
  const workoutHtml = sess.length
    ? sess.map(sessionDetailHtml).join(`<hr class="hair" style="margin:22px 0">`)
    : `<div class="empty-note" style="padding:12px">Žádný trénink</div>`;
  const bw = bodyWeightOn(ds);
  const d = parseDate(ds);
  openModal(`${modalTitle(capFirst(`${CZ_DAYS_FULL[d.getDay()]} ${fmtDate(ds)}`))}
    <div class="h3">Trénink</div>${workoutHtml}
    <div class="h3" style="margin-top:26px">Strava</div>${foodDayHtml(ds)}
    <div class="h3" style="margin-top:26px">Váha</div>
    <div class="card2">${bw != null ? `<b>${fmtWeight(bw)}</b>` : `<span class="muted">Bez záznamu</span>`}</div>
    <div class="h3" style="margin-top:26px">Přidat do tohoto dne</div>
    ${dayAddButtons(ds)}`);
}

/* Zápis tréninku i jídla přímo ze dne v kalendáři — šablony spouští session
   rovnou s datem daného dne (WV.date), kardio otevře svůj formulář. */
function dayAddButtons(ds) {
  const tplBtns = S.templates.map(t =>
    `<button class="chip" data-act="sum-add-workout" data-tpl="${t.id}" data-date="${ds}">${esc(t.name)}</button>`).join("");
  return `
    <div class="chips">${tplBtns}
      <button class="chip" data-act="sum-add-workout" data-tpl="custom" data-date="${ds}">Volný trénink</button>
      <button class="chip" data-act="sum-add-cardio" data-date="${ds}">${ic("plus", 14, 2.4)} Kardio</button>
    </div>
    <div class="btn-row">
      <button class="btn sm" data-act="bw-open" data-date="${ds}">${bodyWeightOn(ds) != null ? "Upravit váhu" : "+ Váha"}</button>
      <button class="btn sm" data-act="sum-add-food" data-date="${ds}">+ Jídlo</button>
    </div>`;
}

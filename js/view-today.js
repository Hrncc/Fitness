/* ===== Obrazovka: Dnes — landing ===== */
"use strict";

const CZ_DAYS_FULL = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];
const CZ_MONTHS_GEN = ["ledna", "února", "března", "dubna", "května", "června",
  "července", "srpna", "září", "října", "listopadu", "prosince"];

const TV = {
  wDraft: null   // rozepsaná váha ve stepperu, v zobrazené jednotce
};

function renderToday() {
  const today = todayStr();

  /* -- připomínka check-inu (jen když už appku aktivně používáš) -- */
  const since = daysSinceCheckin();
  const active = S.sessions.length > 0 || S.bodyLog.length > 0;
  const checkinCard = (active && (since === null || since >= 7)) ? `
    <div class="card">
      <div class="row">
        <span class="card-ic">${ic("clipboard", 18)}</span>
        <div class="grow">
          <div class="h2" style="margin:0">Týdenní check-in</div>
          <div class="small" style="margin-top:2px">${since === null
            ? "Zatím žádný — obvody a pocity"
            : `Poslední před ${since} dny`}</div>
        </div>
        <button class="btn sm tonal" data-act="menu" data-page="body">Vyplnit</button>
      </div>
    </div>` : "";

  /* Rámeček nese jen první nedokončená položka — ostatní jsou klidné karty.
     Jinak by o pozornost soupeřily tři „hrdinové" naráz. */
  const doneW = bodyWeightOn(today) != null;
  const doneT = !!S.activeSession || sessionsOn(today).length > 0;
  const f = dayRating(today);
  const doneF = dayNutrition(today).count > 0 || !!(f && f.foodRating && f.proteinOk != null);
  const hero = !doneW ? "weight" : !doneT ? "workout" : !doneF ? "food" : null;

  return weekStripHtml() + weeklyRecapCard()
    + todayWeightItem(today, hero === "weight")
    + todayWorkoutItem(today, hero === "workout")
    + todayFoodItem(today, hero === "food") + checkinCard;
}

/* ---- Týdenní pás ----
   Sedm dní tohoto týdne, u každého tři tečky: váha · jídlo · trénink.
   Je to stejná trojice, kterou v neděli chce trenér, takže co tady chybí,
   bude chybět i v check-inu. */
function weekStripHtml() {
  const today = todayStr();
  const mon = mondayOf(today);
  const cells = CZ_DOW.map((lbl, i) => {
    const ds = addDays(mon, i);
    const future = ds > today;
    const hasW = bodyWeightOn(ds) != null;
    const food = effectiveDayRating(ds);
    const sess = sessionsOn(ds);
    const dot = (on, cls) => `<i class="${on ? cls : ""}"></i>`;
    return `
      <div class="wd${ds === today ? " today" : ""}${future ? " future" : ""}"
        data-act="sum-cal-day" data-date="${ds}">
        <b>${lbl}</b>
        <span class="wd-n">${parseDate(ds).getDate()}</span>
        <div class="dots">
          ${dot(hasW, "on")}
          ${dot(!!food, food && food.foodRating === "ok" ? "on" : "part")}
          ${dot(sess.length > 0, "on")}
        </div>
      </div>`;
  }).join("");
  return `
    <div class="card week-card">
      <div class="week-strip">${cells}</div>
      <div class="small week-legend">váha · jídlo · trénink — klepni na den pro detail</div>
    </div>`;
}

/* Hotová položka dne se sbalí na jeden řádek — seznam se má vyprazdňovat. */
function dayItemDone(label, value, act, attrs = "") {
  return `
    <div class="day-done" ${act ? `data-act="${act}" ${attrs}` : ""}>
      <span class="day-k">${label}</span>
      <span class="day-v">${value}</span>
      <span class="day-ok">${ic("check", 14, 3)}</span>
    </div>`;
}

/* ---- Váha: potvrzení čísla, ne formulář ----
   Ráno se hýbeš o desetiny, takže se předvyplní poslední hodnota a krokuje
   se po 0,1. Klávesnice se otevře jen když do čísla klepneš. */
function todayWeightItem(today, hero) {
  const w = bodyWeightOn(today);
  if (w != null) {
    return dayItemDone(`${ic("scale", 17)}Váha`, `<span class="num">${fmtWeight(w)}</span>`, "bw-open", `data-date="${today}"`);
  }
  const last = lastBodyWeight(today);
  if (TV.wDraft == null) TV.wDraft = last ? Math.round(kgOut(last.weightKg) * 10) / 10 : null;
  const avg = movingAvgAt(S.bodyLog, today);
  const weekAgo = movingAvgAt(S.bodyLog, addDays(today, -7));
  const trend = (avg != null && weekAgo != null) ? kgOut(avg) - kgOut(weekAgo) : null;

  if (TV.wDraft == null) {
    return `
      <div class="card${hero ? " item-hero" : ""}">
        ${cardHead("scale", "Váha", `<span class="small">ráno</span>`)}
        <p class="muted" style="margin:0 0 14px">Zatím žádný záznam — zapiš první vážení.</p>
        <button class="btn primary full" data-act="bw-open" data-date="${today}">Zapsat váhu</button>
      </div>`;
  }
  return `
    <div class="card${hero ? " item-hero" : ""}">
      ${cardHead("scale", "Váha · ráno", last ? `<span class="badge neutral">naposledy ${fmtNum(kgOut(last.weightKg), 1)}</span>` : "")}
      <div class="stepper">
        <button class="step-btn" data-act="t-w-step" data-d="-0.1" aria-label="Méně">${ic("minus", 24, 2.4)}</button>
        <button class="step-val" data-act="bw-open" data-date="${today}">
          ${fmtNum(TV.wDraft, 1)}<small>${weightUnit()}</small>
        </button>
        <button class="step-btn" data-act="t-w-step" data-d="0.1" aria-label="Více">${ic("plus", 24, 2.4)}</button>
      </div>
      <div class="small center" style="margin:10px 0 14px">
        ${avg != null ? `7denní průměr <b style="color:var(--text)">${fmtNum(kgOut(avg), 1)}</b>` : "první záznam v průměru"}
        ${trend != null && Math.abs(trend) >= 0.05
          ? ` · za týden <b style="color:var(--green)">${trend > 0 ? "+" : ""}${fmtNum(trend, 1)}</b>` : ""}
      </div>
      <button class="btn primary full" data-act="t-w-save">Potvrdit ${fmtNum(TV.wDraft, 1)} ${weightUnit()}</button>
    </div>`;
}

/* ---- Trénink: co je na řadě, nebo co běží ---- */
function todayWorkoutItem(today, hero) {
  const a = S.activeSession;
  if (a) {
    hero = true;
    const setCount = a.type === "weights" ? a.entries.reduce((n, e) => n + (e.sets || []).length, 0) : 0;
    const counts = sessionCatSets(a);
    const core = a.core === true;
    const hit = CAT_ORDER.filter(c => counts[c] > 0 || (core && c === "Core")).length;
    return `
      <div class="card${hero ? " item-hero" : ""}">
        ${cardHead("dumbbell", "Trénink", `<span class="badge neutral">${a.editOf ? "Úprava" : "Probíhá"}</span>`)}
        <div class="hero-title">${esc(sessionLabel(a))}</div>
        <div class="muted" style="margin-bottom:12px">${setCount} sérií · ${hit} ze ${CAT_ORDER.length} partií</div>
        ${a.type === "weights" ? catPipsHtml(counts, core) : ""}
        <button class="btn primary full mt" data-act="nav" data-tab="workout">${a.editOf ? "Pokračovat v úpravě" : "Pokračovat"} ${ic("arrowR", 18, 2.4)}</button>
      </div>`;
  }

  const sessions = sessionsOn(today);
  if (sessions.length) {
    const items = sessions.map(s => {
      if (s.type === "cardio") {
        const c = s.entries[0] || {};
        return dayItemDone(
          `<i class="p-dot" style="background:var(--p-cardio)"></i>Kardio`,
          `${esc(cardioLabel(c))} · ${fmtNum(c.duration)} min`, "w-detail", `data-id="${s.id}"`);
      }
      const sets = s.entries.reduce((n, e) => n + (e.sets || []).length, 0);
      const counts = sessionCatSets(s);
      return `
        <div class="day-done col" data-act="w-detail" data-id="${s.id}">
          <div class="row between" style="width:100%">
            <span class="day-k">${ic("dumbbell", 17)}${esc(sessionLabel(s))}</span>
            <span class="day-v">${s.entries.length} cviků · ${sets} sérií</span>
            <span class="day-ok">${ic("check", 14, 3)}</span>
          </div>
          <div style="width:100%;margin-top:10px">${catPipsHtml(counts, s.core === true)}</div>
        </div>`;
    }).join("");
    return items + `<button class="btn dashed full" style="margin-bottom:12px"
      data-act="nav" data-tab="workout">${ic("plus", 18, 2.4)} Další trénink</button>`;
  }

  const next = nextTemplate();
  const g = lastSessionGaps();
  const gapNote = g && (g.missed.length || g.low.length)
    ? `<div class="small" style="margin-bottom:14px;color:var(--yellow);display:flex;gap:6px;align-items:center">${ic("alert", 14)}Minule uteklo: ${
        [...g.missed.map(m => m.cat), ...g.low.map(l => l.cat)].join(", ")}</div>`
    : "";
  return `
    <div class="card${hero ? " item-hero" : ""}">
      ${cardHead("dumbbell", "Trénink", next ? `<span class="badge green">na řadě</span>` : "")}
      <div class="hero-title">${next ? esc(next.name) : "Zatím nic"}</div>
      <div class="muted" style="margin-bottom:12px">${next
        ? `${next.exercises.length} cviků${(() => {
            const last = lastWeightsSession();
            return last ? ` · naposledy ${fmtDate(last.date)}` : "";
          })()}`
        : "Dnes ještě nemáš zapsaný žádný trénink."}</div>
      ${gapNote}
      <button class="btn primary full" data-act="${next ? "t-begin-next" : "nav"}"
        ${next ? `data-template="${next.id}"` : `data-tab="workout"`}>${ic("play", 16)} Zahájit</button>
      <button class="btn ghost full mt" data-act="nav" data-tab="workout">Jiná šablona nebo kardio</button>
    </div>`;
}

/* ---- Jídlo: dvě klepnutí, nebo prstenec když zapisuješ podrobně ---- */
function todayFoodItem(today, hero) {
  const g = S.goal;
  const nut = dayNutrition(today);

  /* podrobný zápis má přednost — kdo váží porce, chce vidět čísla */
  if (nut.count) {
    const remaining = Math.max(0, g.dailyCalories - nut.calories);
    const over = nut.calories > g.dailyCalories * 1.05;
    const ring = ringHtml(nut.calories, g.dailyCalories, 148, `
      <b${over ? ` style="color:var(--red)"` : ""}>${fmtNum(nut.calories)}</b>
      <span>${over ? `+${fmtNum(nut.calories - g.dailyCalories)} nad cíl` : `zbývá ${fmtNum(remaining)}`}</span>`);
    return `
      <div class="card">
        ${cardHead("food", "Jídlo", `<span class="small">cíl ${fmtNum(g.dailyCalories)} kcal</span>`)}
        <div class="hero-main">
          ${ring}
          <div class="hero-macros">
            ${macroBar("Bílkoviny", nut.protein, g.proteinGrams, "mac1")}
            ${macroBar("Sacharidy", nut.carbs, g.carbsGrams, "mac2")}
            ${macroBar("Tuky", nut.fat, g.fatGrams, "mac3")}
          </div>
        </div>
        <button class="btn primary full mt" data-act="nav" data-tab="food">${ic("plus", 18, 2.4)} Přidat jídlo</button>
      </div>`;
  }

  const m = dayRating(today);
  const RATINGS = [["under", "pod"], ["ok", "v cíli"], ["over", "nad"]];
  if (m && m.foodRating && m.proteinOk != null) {
    const lbl = (RATINGS.find(r => r[0] === m.foodRating) || [])[1] || "—";
    return dayItemDone(`${ic("food", 17)}Jídlo`, `${lbl} · bílkoviny ${m.proteinOk ? "✓" : "✗"}`, "t-food-reset");
  }

  return `
    <div class="card${hero ? " item-hero" : ""}">
      ${cardHead("food", "Jídlo", `<span class="badge neutral">${fmtNum(g.dailyCalories)} kcal</span>`)}
      <div class="muted" style="margin:0 0 8px">Jak to dnes dopadlo?</div>
      <div class="seg">${RATINGS.map(([id, lbl]) =>
        `<button class="seg-btn${m && m.foodRating === id ? " on" : ""}" data-act="t-food-rating" data-v="${id}">${lbl}</button>`).join("")}</div>
      <div class="muted" style="margin:14px 0 8px">Bílkoviny ≈ ${fmtNum(g.proteinGrams)} g?</div>
      <div class="seg two">
        <button class="seg-btn${m && m.proteinOk === false ? " on" : ""}" data-act="t-food-protein" data-v="0">ne</button>
        <button class="seg-btn${m && m.proteinOk === true ? " on" : ""}" data-act="t-food-protein" data-v="1">ano</button>
      </div>
      <button class="btn ghost full mt" data-act="nav" data-tab="food">Zapsat podrobně ${ic("arrowR", 18, 2.2)}</button>
    </div>`;
}

/* ---- Souhrn statistik za týden (pondělí–neděle) ---- */
function weekStats(from, to) {
  const sess = S.sessions.filter(s => s.date >= from && s.date <= to);
  const weights = sess.filter(s => s.type === "weights");
  const ids = new Set(S.sessions.filter(s => s.type === "weights").flatMap(s => s.entries.map(e => e.exerciseId)));
  let prs = 0;
  for (const id of ids) prs += prHistory(id).filter(h => h.date >= from && h.date <= to).length;
  const kcals = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const n = dayNutrition(d);
    if (n.count) kcals.push(n.calories);
  }
  return {
    sessions: sess.length,
    weights: weights.length,
    cardio: sess.length - weights.length,
    volume: weights.reduce((v, s) => v + sessionVolume(s), 0),
    prs,
    loggedDays: kcals.length,
    avgKcal: kcals.length ? Math.round(kcals.reduce((a, b) => a + b, 0) / kcals.length) : null
  };
}

/* ---- Rekap minulého týdne — motivace z reálného pokroku, ne ze streaku ----
   Zavře se na křížek a do dalšího pondělí se neukáže. */
function weeklyRecapCard() {
  const thisMon = mondayOf(todayStr());
  const lastMon = addDays(thisMon, -7);
  const lastSun = addDays(thisMon, -1);
  if (Settings.get().recapDismissed === lastMon) return "";

  const w = weekStats(lastMon, lastSun);
  if (!w.sessions && !w.loggedDays) return ""; // prázdný týden nemá co shrnovat

  const prev = weekStats(addDays(lastMon, -7), addDays(lastMon, -1));
  const volPct = prev.volume > 0 ? Math.round((w.volume / prev.volume - 1) * 100) : null;
  const ma1 = movingAvgAt(S.bodyLog, lastMon), ma2 = movingAvgAt(S.bodyLog, lastSun);
  const dW = (ma1 != null && ma2 != null) ? kgOut(ma2) - kgOut(ma1) : null;

  const s = parseDate(lastMon), e = parseDate(lastSun);
  const rows = [];
  if (w.sessions) {
    rows.push(`<b>${w.sessions}</b> ${w.sessions === 1 ? "trénink" : w.sessions < 5 ? "tréninky" : "tréninků"}${w.cardio ? ` <span class="small">(z toho ${w.cardio}× kardio)</span>` : ""}`);
  }
  if (w.volume) {
    rows.push(`objem <b>${fmtNum(kgOut(w.volume))} ${weightUnit()}</b>${volPct != null
      ? ` <span style="color:var(--${volPct >= 0 ? "green" : "text2"})">${volPct >= 0 ? "+" : ""}${volPct} %</span>` : ""}`);
  }
  if (w.prs) rows.push(`<b style="color:var(--yellow)">${w.prs}×</b> nový rekord`);
  if (w.avgKcal != null) rows.push(`Ø <b>${fmtNum(w.avgKcal)} kcal</b> <span class="small">(${w.loggedDays} ${w.loggedDays === 1 ? "den" : w.loggedDays < 5 ? "dny" : "dní"})</span>`);
  if (dW != null && Math.abs(dW) >= 0.05) rows.push(`váha <b>${dW > 0 ? "+" : ""}${fmtNum(dW, 1)} ${weightUnit()}</b>`);

  return `
    <div class="card recap-card">
      ${cardHead("calendar", `Minulý týden <span class="small">· ${s.getDate()}.${s.getMonth() + 1}.–${e.getDate()}.${e.getMonth() + 1}.</span>`,
        `<button class="iconbtn sm soft" data-act="recap-dismiss" data-week="${lastMon}" aria-label="Skrýt">${ic("x", 16)}</button>`)}
      <div class="recap-rows">${rows.map(r => `<div>${r}</div>`).join("")}</div>
    </div>`;
}

/* ---- Modal zápisu váhy ---- */
/* date = null → dnešek; jinak zpětný zápis (kalendář v Souhrnu) */
function openBodyWeightModal(date) {
  const day = date || todayStr();
  const isToday = day === todayStr();
  // předvyplní se hodnota toho dne, jinak poslední známá váha k tomu dni
  const current = bodyWeightOn(day) ?? (lastBodyWeight(day) || {}).weightKg;
  openModal(`${modalTitle("Zapsat váhu" + (isToday ? "" : " · " + fmtDate(day)))}
    <label class="field"><span>Tělesná váha (${weightUnit()})</span>
      <input class="input" id="bwInput" type="text" inputmode="decimal"
        value="${current != null ? fmtNum(kgOut(current), 1) : ""}" placeholder="např. 80,5"></label>
    ${bodyWeightOn(day) != null ? `<p class="small" style="margin:-6px 0 14px">K tomuto dni už váha zapsaná je — uložením ji přepíšeš.</p>` : ""}
    <button class="btn primary full" data-act="bw-save" data-date="${day}">Uložit</button>`);
  document.getElementById("bwInput").focus();
}

function saveBodyWeight(date) {
  const day = date || todayStr();
  const kg = kgIn(document.getElementById("bwInput").value);
  if (kg == null || kg <= 0) { toast("Zadej platnou váhu", "err"); return; }
  logBodyWeight(kg, day);
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

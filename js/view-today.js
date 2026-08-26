/* ===== Obrazovka: Dnes — landing ===== */
"use strict";

const CZ_DAYS_FULL = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];
const CZ_MONTHS_GEN = ["ledna", "února", "března", "dubna", "května", "června",
  "července", "srpna", "září", "října", "listopadu", "prosince"];

function renderToday() {
  const today = todayStr();
  const now = new Date();
  const sessions = sessionsOn(today);
  const nut = dayNutrition(today);
  const g = S.goal;

  /* -- datum -- */
  const hero_date = `<div class="hero-date">${CZ_DAYS_FULL[now.getDay()]} · ${now.getDate()}. ${CZ_MONTHS_GEN[now.getMonth()]}</div>`;

  /* -- hero: kalorický prstenec + makra -- */
  const remaining = Math.max(0, g.dailyCalories - nut.calories);
  const over = nut.calories > g.dailyCalories * 1.05;
  const ring = ringHtml(nut.calories, g.dailyCalories, 148, `
    <b${over ? ` style="color:var(--red)"` : ""}>${fmtNum(nut.calories)}</b>
    <span>${over ? `+${fmtNum(nut.calories - g.dailyCalories)} nad cíl` : `zbývá ${fmtNum(remaining)}`}</span>`);
  const heroCard = `
    <div class="card hero-card">
      <div class="h2">Energie · cíl ${fmtNum(g.dailyCalories)} kcal</div>
      <div class="hero-main">
        ${ring}
        <div class="hero-macros">
          ${macroBar("Bílkoviny", nut.protein, g.proteinGrams, "mac1")}
          ${macroBar("Sacharidy", nut.carbs, g.carbsGrams, "mac2")}
          ${macroBar("Tuky", nut.fat, g.fatGrams, "mac3")}
        </div>
      </div>
      <button class="btn primary full mt" data-act="nav" data-tab="food">+ Přidat jídlo</button>
    </div>`;

  /* -- tělesná váha -- */
  const todayW = bodyWeightOn(today);
  const last = lastBodyWeight(todayW ? addDays(today, -1) : today);
  let deltaBadge = "";
  if (todayW != null && last) {
    const diff = kgOut(todayW) - kgOut(last.weightKg);
    if (Math.abs(diff) >= 0.05) {
      deltaBadge = `<span class="badge neutral">${diff > 0 ? "▲" : "▼"} ${fmtNum(Math.abs(diff), 1)} ${weightUnit()}</span>`;
    }
  }
  const shown = todayW != null ? todayW : (last ? last.weightKg : null);
  const weightCard = `
    <div class="card">
      <div class="row between">
        <span class="h2" style="margin:0">Tělesná váha</span>
        ${deltaBadge}
      </div>
      <div class="row between mt">
        <div>
          <span class="big-num" style="font-size:28px">${shown != null ? fmtWeight(shown) : "—"}</span>
          ${todayW == null ? `<div class="small">${last ? `naposledy ${fmtDate(last.date)}` : "zatím žádný záznam"}</div>` : ""}
        </div>
        <button class="btn sm primary" data-act="bw-open">${todayW != null ? "Upravit" : "Zapsat"}</button>
      </div>
    </div>`;

  /* -- trénink -- */
  let workoutCard;
  if (S.activeSession) {
    const a = S.activeSession;
    const setCount = a.type === "weights" ? a.entries.reduce((n, e) => n + (e.sets || []).length, 0) : 0;
    workoutCard = `
      <div class="card">
        <div class="row between">
          <span class="h2" style="margin:0">Trénink</span>
          <span class="badge yellow">Probíhá</span>
        </div>
        <div class="big-num" style="font-size:24px;margin:12px 0 4px">${esc(sessionLabel(a))}</div>
        <div class="muted" style="margin-bottom:14px">${setCount} sérií zapsáno</div>
        <button class="btn primary full" data-act="nav" data-tab="workout">Pokračovat →</button>
      </div>`;
  } else if (sessions.length) {
    const items = sessions.map(s => {
      if (s.type === "cardio") {
        const c = s.entries[0] || {};
        return `<div class="list-item">
          <span class="badge neutral">${esc(cardioLabel(c))}</span>
          <div class="grow name">${fmtNum(c.duration)} min${c.distance ? ` · ${fmtNum(c.distance, 2)} km` : ""}</div>
          ${c.calories ? `<span class="small">${fmtNum(c.calories)} kcal</span>` : ""}
        </div>`;
      }
      const sets = s.entries.reduce((n, e) => n + (e.sets || []).length, 0);
      return `<div class="list-item">
        <span class="badge neutral">${esc(sessionLabel(s))}</span>
        <div class="grow name">${s.entries.length} cviků · ${sets} sérií</div>
        <button class="btn sm ghost" data-act="w-detail" data-id="${s.id}">Detail</button>
      </div>`;
    }).join("");
    workoutCard = `
      <div class="card">
        <div class="row between">
          <span class="h2" style="margin:0">Trénink</span>
          <span class="badge green">✓ Hotovo</span>
        </div>
        <div class="mt">${items}</div>
        <button class="btn ghost full mt" data-act="nav" data-tab="workout">+ Další trénink</button>
      </div>`;
  } else {
    workoutCard = `
      <div class="card">
        <div class="h2">Trénink</div>
        <div class="big-num" style="font-size:22px;margin-bottom:4px">Zatím nic</div>
        <div class="muted" style="margin-bottom:14px">Dnes ještě nemáš zapsaný žádný trénink.</div>
        <button class="btn primary full" data-act="nav" data-tab="workout">Zahájit trénink →</button>
      </div>`;
  }

  /* -- připomínka check-inu (jen když už appku aktivně používáš) -- */
  const since = daysSinceCheckin();
  const active = S.sessions.length > 0 || S.bodyLog.length > 0;
  const checkinCard = (active && (since === null || since >= 7)) ? `
    <div class="card">
      <div class="row between">
        <div class="grow">
          <div class="h2" style="margin:0">Týdenní check-in</div>
          <div class="muted" style="margin-top:4px">${since === null
            ? "Zatím žádný — obvody a pocity pro trenéra"
            : `Poslední před ${since} dny`}</div>
        </div>
        <button class="btn sm primary" data-act="menu" data-page="checkin">Vyplnit</button>
      </div>
    </div>` : "";

  return hero_date + weeklyRecapCard() + heroCard + workoutCard + weightCard + checkinCard;
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
      <div class="row between">
        <span class="h2" style="margin:0">Minulý týden · ${s.getDate()}.${s.getMonth() + 1}.–${e.getDate()}.${e.getMonth() + 1}.</span>
        <button class="iconbtn" style="width:30px;height:30px" data-act="recap-dismiss" data-week="${lastMon}">✕</button>
      </div>
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

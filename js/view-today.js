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
          ${macroBar("Bílkoviny", nut.protein, g.proteinGrams, "pink")}
          ${macroBar("Sacharidy", nut.carbs, g.carbsGrams, "cyan")}
          ${macroBar("Tuky", nut.fat, g.fatGrams, "purple")}
        </div>
      </div>
      <button class="btn primary full mt" data-act="nav" data-tab="food">+ Přidat jídlo</button>
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
        <div class="big-num" style="font-size:24px;margin:12px 0 4px">${esc(templateLabel(a.templateUsed))}</div>
        <div class="muted" style="margin-bottom:14px">${setCount} sérií zapsáno</div>
        <button class="btn primary full" data-act="nav" data-tab="workout">Pokračovat →</button>
      </div>`;
  } else if (sessions.length) {
    const items = sessions.map(s => {
      if (s.type === "cardio") {
        const c = s.entries[0] || {};
        return `<div class="list-item">
          <span class="badge orange">${esc(cardioLabel(c))}</span>
          <div class="grow name">${fmtNum(c.duration)} min${c.distance ? ` · ${fmtNum(c.distance, 2)} km` : ""}</div>
          ${c.calories ? `<span class="small">${fmtNum(c.calories)} kcal</span>` : ""}
        </div>`;
      }
      const sets = s.entries.reduce((n, e) => n + (e.sets || []).length, 0);
      return `<div class="list-item">
        <span class="badge green">${esc(templateLabel(s.templateUsed))}</span>
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

  /* -- týdenní strip Po–Ne -- */
  const monday = mondayOf(today);
  let strip = "";
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    const hasW = sessionsOn(d).length > 0;
    const hasF = calorieGoalMet(d);
    strip += `<div class="week-day${d === today ? " today" : ""}">
      ${CZ_DOW[i]}
      <div class="dots">
        <i style="background:${hasW ? "var(--green)" : "var(--bg3)"}"></i>
        <i style="background:${hasF ? "var(--cyan)" : "var(--bg3)"}"></i>
      </div>
    </div>`;
  }
  const weekCard = `
    <div class="card">
      <div class="h2">Týden</div>
      <div class="week-strip">${strip}</div>
      <div class="small mt"><span style="color:var(--green)">●</span> trénink&nbsp;&nbsp;
        <span style="color:var(--cyan)">●</span> kalorický cíl</div>
    </div>`;

  return hero_date + heroCard + workoutCard + weekCard;
}

function templateLabel(t) {
  return { A: "Váhy A", B: "Váhy B", custom: "Libovolný" }[t] || "Váhy";
}

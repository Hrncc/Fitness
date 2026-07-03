/* ===== Obrazovka: Dnes ===== */
"use strict";

function renderToday() {
  const today = todayStr();
  const sessions = sessionsOn(today);
  const nut = dayNutrition(today);
  const g = S.goal;

  /* -- karta Trénink dnes -- */
  let workoutCard;
  if (S.activeSession) {
    const a = S.activeSession;
    const setCount = a.type === "weights" ? a.entries.reduce((n, e) => n + (e.sets || []).length, 0) : 0;
    workoutCard = `
      <div class="card" style="border-color:var(--yellow)">
        <div class="row between"><span class="h2" style="margin:0">Trénink dnes</span>
          <span class="badge yellow">Probíhá</span></div>
        <p class="muted" style="margin:8px 0 12px">${a.type === "weights"
          ? `Rozpracovaný silový trénink (${esc(templateLabel(a.templateUsed))}) — ${setCount} sérií zapsáno`
          : "Rozpracované kardio"}</p>
        <button class="btn primary full" data-act="nav" data-tab="workout">Pokračovat v tréninku</button>
      </div>`;
  } else if (sessions.length) {
    const items = sessions.map(s => {
      if (s.type === "cardio") {
        const c = s.entries[0] || {};
        return `<div class="list-item">
          <span class="badge orange">Kardio</span>
          <div class="grow"><div class="name">${fmtNum(c.duration)} min${c.distance ? ` · ${fmtNum(c.distance, 2)} km` : ""}</div>
          ${c.calories ? `<div class="small">${fmtNum(c.calories)} kcal</div>` : ""}</div>
        </div>`;
      }
      const sets = s.entries.reduce((n, e) => n + (e.sets || []).length, 0);
      return `<div class="list-item">
        <span class="badge ${s.templateUsed === "B" ? "cyan" : "green"}">${esc(templateLabel(s.templateUsed))}</span>
        <div class="grow"><div class="name">${s.entries.length} cviků · ${sets} sérií</div>
        <div class="small">objem ${fmtWeight(sessionVolume(s))}</div></div>
        <button class="btn sm ghost" data-act="w-detail" data-id="${s.id}">Detail</button>
      </div>`;
    }).join("");
    workoutCard = `
      <div class="card" style="border-color:var(--green)">
        <div class="row between"><span class="h2" style="margin:0">Trénink dnes</span>
          <span class="badge green">✓ Hotovo</span></div>
        ${items}
        <button class="btn ghost full mt" data-act="nav" data-tab="workout">Přidat další trénink</button>
      </div>`;
  } else {
    workoutCard = `
      <div class="card">
        <div class="h2">Trénink dnes</div>
        <p class="muted" style="margin:0 0 12px">Dnes ještě nemáš zapsaný žádný trénink.</p>
        <button class="btn primary full" data-act="nav" data-tab="workout">Zahájit trénink</button>
      </div>`;
  }

  /* -- karta Strava dnes -- */
  const kcalPct = g.dailyCalories ? Math.round(nut.calories / g.dailyCalories * 100) : 0;
  const macro = (label, val, target, color) => `
    <div class="grow">
      <div class="small" style="margin-bottom:3px">${label}</div>
      ${barHtml(val, target, color, true)}
      <div class="small" style="margin-top:3px">${fmtNum(val)} / ${fmtNum(target)} g</div>
    </div>`;
  const foodCard = `
    <div class="card">
      <div class="row between"><span class="h2" style="margin:0">Strava dnes</span>
        ${nut.count ? `<span class="badge ${nut.calories > g.dailyCalories * 1.05 ? "red" : "green"}">${kcalPct} %</span>` : ""}</div>
      <div class="row between" style="margin:10px 0 4px">
        <b style="font-size:19px">${fmtNum(nut.calories)} kcal</b>
        <span class="muted">cíl ${fmtNum(g.dailyCalories)} kcal</span>
      </div>
      ${barHtml(nut.calories, g.dailyCalories, "green")}
      <div class="row mt" style="gap:12px">
        ${macro("Bílkoviny", nut.protein, g.proteinGrams, "pink")}
        ${macro("Sacharidy", nut.carbs, g.carbsGrams, "cyan")}
        ${macro("Tuky", nut.fat, g.fatGrams, "purple")}
      </div>
      <button class="btn primary full mt" data-act="nav" data-tab="food">Přidat jídlo</button>
    </div>`;

  /* -- týdenní mini přehled Po–Ne -- */
  const monday = mondayOf(today);
  let strip = "";
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    const hasW = sessionsOn(d).length > 0;
    const hasF = calorieGoalMet(d);
    strip += `<div class="week-day${d === today ? " today" : ""}">
      ${CZ_DOW[i]}
      <div class="dots">
        <i style="background:${hasW ? "var(--orange)" : "var(--bg3)"}"></i>
        <i style="background:${hasF ? "var(--green)" : "var(--bg3)"}"></i>
      </div>
    </div>`;
  }
  const weekCard = `
    <div class="card">
      <div class="h3">Tento týden</div>
      <div class="week-strip">${strip}</div>
      <div class="small mt"><span style="color:var(--orange)">●</span> trénink&nbsp;&nbsp;
        <span style="color:var(--green)">●</span> splněný kalorický cíl</div>
    </div>`;

  return workoutCard + foodCard + weekCard;
}

function templateLabel(t) {
  return { A: "Váhy A", B: "Váhy B", custom: "Libovolný" }[t] || "Váhy";
}

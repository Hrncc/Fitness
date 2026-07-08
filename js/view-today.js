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

  return hero_date + heroCard + workoutCard + weightCard;
}

/* ---- Modal zápisu váhy ---- */
function openBodyWeightModal() {
  const today = todayStr();
  const current = bodyWeightOn(today) ?? (lastBodyWeight(today) || {}).weightKg;
  openModal(`${modalTitle("Zapsat váhu")}
    <label class="field"><span>Tělesná váha (${weightUnit()})</span>
      <input class="input" id="bwInput" type="number" inputmode="decimal" step="0.1"
        value="${current != null ? fmtNum(kgOut(current), 1).replace(",", ".") : ""}" placeholder="např. 80.5"></label>
    <button class="btn primary full" data-act="bw-save">Uložit</button>`);
  document.getElementById("bwInput").focus();
}

function saveBodyWeight() {
  const kg = kgIn(document.getElementById("bwInput").value);
  if (kg == null || kg <= 0) { toast("Zadej platnou váhu", "err"); return; }
  logBodyWeight(kg);
  save();
  closeModal();
  render();
  toast("Váha zapsána ✓", "ok");
}

function templateLabel(t) {
  return { A: "Váhy A", B: "Váhy B", custom: "Libovolný" }[t] || "Váhy";
}

/* Název tréninku — nové sessions nesou kopii jména šablony, staré mapuje templateLabel */
function sessionLabel(s) {
  return s.templateName || templateLabel(s.templateUsed);
}

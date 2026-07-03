/* ===== Obrazovka: Jídlo — log, denní cíle, kalendář ===== */
"use strict";

const FV = {
  sub: "log",                // log | cal
  calY: new Date().getFullYear(),
  calM: new Date().getMonth(),
  results: [],               // poslední výsledky vyhledávání
  pending: null,             // vybraná potravina čekající na množství
  editId: null               // id upravovaného záznamu
};

function renderFood() {
  const tabs = `
    <div class="subtabs">
      <button class="subtab${FV.sub === "log" ? " on" : ""}" data-act="f-sub" data-sub="log">Dnes</button>
      <button class="subtab${FV.sub === "cal" ? " on" : ""}" data-act="f-sub" data-sub="cal">Kalendář</button>
    </div>`;
  return tabs + (FV.sub === "cal" ? renderFoodCal() : renderFoodLog());
}

/* ---- Denní log ---- */
function renderFoodLog() {
  const today = todayStr();
  const nut = dayNutrition(today);
  const g = S.goal;

  const goalRow = (label, val, target, color) => {
    const state = !target ? "" : val > target * 1.05
      ? `<span class="badge red">překročeno</span>`
      : (Math.abs(val - target) / target <= 0.10 && val > 0 ? `<span class="badge green">v cíli</span>` : "");
    return `<div class="mt">
      <div class="row between" style="margin-bottom:4px">
        <span class="muted">${label} ${state}</span>
        <span class="small">${fmtNum(val)} / ${fmtNum(target)}</span>
      </div>
      ${barHtml(val, target, color)}
    </div>`;
  };

  const goals = `
    <div class="card">
      <div class="h2">Denní cíle</div>
      ${goalRow("Kalorie (kcal)", nut.calories, g.dailyCalories, "green")}
      ${goalRow("Bílkoviny (g)", nut.protein, g.proteinGrams, "pink")}
      ${goalRow("Sacharidy (g)", nut.carbs, g.carbsGrams, "cyan")}
      ${goalRow("Tuky (g)", nut.fat, g.fatGrams, "purple")}
    </div>`;

  const entries = foodLogOn(today);
  let logList;
  if (!entries.length) {
    logList = `<div class="empty-note">Dnes ještě nic zapsáno</div>`;
  } else {
    const byMeal = [...MEAL_TYPES, { id: null, name: "Nezařazeno" }];
    logList = byMeal.map(m => {
      const items = entries.filter(e => (e.mealType || null) === m.id);
      if (!items.length) return "";
      const rows = items.map(e => `
        <div class="list-item">
          <div class="grow">
            <div class="name">${esc(foodEntryName(e))}</div>
            <div class="small">${fmtNum(e.amountGrams)} g · B ${fmtNum(e.protein)} · S ${fmtNum(e.carbs)} · T ${fmtNum(e.fat)}</div>
          </div>
          <b style="white-space:nowrap">${fmtNum(e.calories)} kcal</b>
          <button class="btn sm ghost" data-act="f-entry-edit" data-id="${e.id}">✎</button>
          <button class="iconbtn" style="width:32px;height:32px;color:var(--red)" data-act="f-entry-del" data-id="${e.id}">✕</button>
        </div>`).join("");
      return `<div class="h3" style="margin-top:12px">${m.name}</div>${rows}`;
    }).join("");
  }

  return `
    <button class="btn primary full" style="margin-bottom:14px" data-act="f-add">+ Přidat jídlo</button>
    ${goals}
    <div class="card"><div class="h2">Snědeno dnes</div>${logList}</div>`;
}

function foodEntryName(e) {
  if (e.foodItemId) { const f = getFood(e.foodItemId); if (f) return f.name; }
  return e.name || "(položka)";
}

/* ---- Modal: přidání jídla ---- */
function openAddFood(tab = "search") {
  FV.pending = null; FV.editId = null;
  openModal(`${modalTitle("Přidat jídlo")}
    <div class="subtabs" style="margin-bottom:12px">
      <button class="subtab${tab === "search" ? " on" : ""}" data-act="f-modal-tab" data-tab="search">Hledat</button>
      <button class="subtab${tab === "fav" ? " on" : ""}" data-act="f-modal-tab" data-tab="fav">Oblíbené</button>
      <button class="subtab${tab === "manual" ? " on" : ""}" data-act="f-modal-tab" data-tab="manual">Ručně</button>
    </div>
    <div id="foodModalBody">${tab === "search" ? foodSearchHtml() : tab === "fav" ? foodFavHtml() : foodManualHtml()}</div>`);
  if (tab === "search") wireFoodSearch();
}

function foodSearchHtml() {
  return `
    <input class="input" id="foodSearch" placeholder="Hledat potravinu (min. 3 znaky)…">
    <div class="small" style="margin:6px 2px 8px">Zdroje: Open Food Facts (balené produkty) + USDA (základní potraviny)</div>
    <div id="foodResults"></div>`;
}

function wireFoodSearch() {
  const inp = document.getElementById("foodSearch");
  const out = document.getElementById("foodResults");
  const run = debounce(async (q) => {
    out.innerHTML = `<div class="spin" style="margin:20px auto"></div>`;
    const { results, errors } = await FoodAPI.search(q);
    FV.results = results;
    let html = results.map((r, i) => `
      <div class="list-item" data-act="f-pick" data-i="${i}" style="cursor:pointer">
        <div class="grow">
          <div class="name">${esc(r.name)}</div>
          <div class="small">${fmtNum(r.caloriesPer100g)} kcal · B ${fmtNum(r.proteinPer100g, 1)} · S ${fmtNum(r.carbsPer100g, 1)} · T ${fmtNum(r.fatPer100g, 1)} /100 g</div>
        </div>
        ${sourceBadge(r.source)}
      </div>`).join("");
    if (!results.length) html = `<div class="empty-note">Nic nenalezeno — zkus jiný výraz nebo zadej ručně</div>`;
    if (errors.length) html += `<div class="small" style="color:var(--yellow);margin-top:8px">⚠ ${errors.map(esc).join("<br>⚠ ")}</div>`;
    out.innerHTML = html;
  }, 450);
  inp.addEventListener("input", () => {
    const q = inp.value.trim();
    if (q.length < 3) { out.innerHTML = ""; return; }
    run(q);
  });
  inp.focus();
}

function foodFavHtml() {
  const favs = S.foods.filter(f => f.isFavorite);
  if (!favs.length) return `<div class="empty-note">Zatím žádné oblíbené.<br>Přidávej hvězdičkou ve Food Library.</div>`;
  return favs.map(f => `
    <div class="list-item" data-act="f-pick-fav" data-id="${f.id}" style="cursor:pointer">
      <div class="grow">
        <div class="name">⭐ ${esc(f.name)}</div>
        <div class="small">${fmtNum(f.caloriesPer100g)} kcal /100 g</div>
      </div>
      ${sourceBadge(f.source)}
    </div>`).join("");
}

function foodManualHtml() {
  return `
    <label class="field"><span>Název *</span><input class="input" id="mName" placeholder="např. Domácí guláš"></label>
    <div class="input-row">
      <label class="field"><span>kcal /100 g *</span><input class="input" id="mKcal" type="number" inputmode="decimal"></label>
      <label class="field"><span>Bílkoviny /100 g</span><input class="input" id="mProt" type="number" inputmode="decimal"></label>
    </div>
    <div class="input-row">
      <label class="field"><span>Sacharidy /100 g</span><input class="input" id="mCarb" type="number" inputmode="decimal"></label>
      <label class="field"><span>Tuky /100 g</span><input class="input" id="mFat" type="number" inputmode="decimal"></label>
    </div>
    <button class="btn primary full" data-act="f-manual-next">Pokračovat →</button>`;
}

/* ---- Krok množství (společný pro všechny cesty) ---- */
function openAmountStep(item, existing) {
  FV.pending = item;
  const mealOpts = [`<option value="">Nezařazeno</option>`]
    .concat(MEAL_TYPES.map(m => `<option value="${m.id}"${existing && existing.mealType === m.id ? " selected" : ""}>${m.name}</option>`))
    .join("");
  openModal(`${modalTitle(existing ? "Upravit záznam" : item.name)}
    <div class="card2" style="margin-bottom:12px">
      <div class="row between"><span class="muted">Na 100 g</span>${sourceBadge(item.source)}</div>
      <div class="mt" style="font-size:14px"><b>${fmtNum(item.caloriesPer100g)} kcal</b> ·
        B ${fmtNum(item.proteinPer100g, 1)} g · S ${fmtNum(item.carbsPer100g, 1)} g · T ${fmtNum(item.fatPer100g, 1)} g</div>
      ${item.servingSize ? `<div class="small mt">Porce dle výrobce: ${esc(item.servingSize)}</div>` : ""}
    </div>
    <div class="input-row">
      <label class="field"><span>Množství (g) *</span>
        <input class="input" id="amtG" type="number" inputmode="decimal" value="${existing ? existing.amountGrams : 100}"></label>
      <label class="field"><span>Jídlo</span>
        <select class="input" id="amtMeal">${mealOpts}</select></label>
    </div>
    <div class="card2" id="amtPreview" style="margin-bottom:14px"></div>
    <button class="btn primary full" data-act="f-amount-save">${existing ? "Uložit změny" : "Přidat do dne"}</button>`);
  const upd = () => {
    const g = parseFloat(document.getElementById("amtG").value) || 0;
    const k = g / 100;
    document.getElementById("amtPreview").innerHTML =
      `<b>${fmtNum(item.caloriesPer100g * k)} kcal</b> · B ${fmtNum(item.proteinPer100g * k, 1)} g · S ${fmtNum(item.carbsPer100g * k, 1)} g · T ${fmtNum(item.fatPer100g * k, 1)} g`;
  };
  document.getElementById("amtG").addEventListener("input", upd);
  upd();
}

function saveAmount() {
  const item = FV.pending;
  const grams = parseFloat(document.getElementById("amtG").value);
  const meal = document.getElementById("amtMeal").value || null;
  if (!grams || grams <= 0) { toast("Zadej množství v gramech", "err"); return; }
  const k = grams / 100;
  const r1 = v => Math.round((v || 0) * k * 10) / 10;

  if (FV.editId) {
    const e = S.foodLog.find(x => x.id === FV.editId);
    if (e) {
      e.amountGrams = grams; e.mealType = meal;
      e.calories = Math.round((item.caloriesPer100g || 0) * k);
      e.protein = r1(item.proteinPer100g); e.carbs = r1(item.carbsPer100g); e.fat = r1(item.fatPer100g);
    }
  } else {
    const foodItemId = item.id || upsertFood(item);
    S.foodLog.push({
      id: uid(), date: todayStr(), mealType: meal,
      foodItemId, amountGrams: grams,
      calories: Math.round((item.caloriesPer100g || 0) * k),
      protein: r1(item.proteinPer100g), carbs: r1(item.carbsPer100g), fat: r1(item.fatPer100g)
    });
  }
  FV.pending = null; FV.editId = null;
  save();
  closeModal();
  render();
  toast("Zapsáno ✓", "ok");
}

function manualFoodNext() {
  const name = document.getElementById("mName").value.trim();
  const kcal = parseFloat(document.getElementById("mKcal").value);
  if (!name || !kcal) { toast("Vyplň název a kalorie", "err"); return; }
  openAmountStep({
    source: "custom", name,
    caloriesPer100g: kcal,
    proteinPer100g: parseFloat(document.getElementById("mProt").value) || 0,
    carbsPer100g: parseFloat(document.getElementById("mCarb").value) || 0,
    fatPer100g: parseFloat(document.getElementById("mFat").value) || 0
  });
}

function editFoodEntry(id) {
  const e = S.foodLog.find(x => x.id === id);
  if (!e) return;
  const f = e.foodItemId ? getFood(e.foodItemId) : null;
  const item = f || {
    source: "custom", name: foodEntryName(e),
    caloriesPer100g: e.amountGrams ? e.calories / e.amountGrams * 100 : 0,
    proteinPer100g: e.amountGrams ? e.protein / e.amountGrams * 100 : 0,
    carbsPer100g: e.amountGrams ? e.carbs / e.amountGrams * 100 : 0,
    fatPer100g: e.amountGrams ? e.fat / e.amountGrams * 100 : 0
  };
  FV.editId = id;
  openAmountStep(item, e);
}

/* ---- Kalendář stravy ---- */
function renderFoodCal() {
  return `<div class="card">${calendarHtml(FV.calY, FV.calM, ds => {
    const n = dayNutrition(ds);
    if (!n.count) return null;
    return calorieGoalMet(ds) ? { cls: "hit", mark: "✓" } : { cls: "", mark: "•" };
  }, "f-cal-day")}
  <div class="small mt"><span style="color:var(--green)">✓</span> splněný kalorický cíl (±10 %) ·
    <b>•</b> den se záznamem</div></div>`;
}

function openDayFood(ds) {
  const entries = foodLogOn(ds);
  if (!entries.length) { toast("V tento den není žádný záznam"); return; }
  const n = dayNutrition(ds);
  const rows = entries.map(e => `
    <div class="list-item">
      <div class="grow">
        <div class="name">${esc(foodEntryName(e))}</div>
        <div class="small">${mealName(e.mealType)} · ${fmtNum(e.amountGrams)} g</div>
      </div>
      <b>${fmtNum(e.calories)} kcal</b>
    </div>`).join("");
  openModal(`${modalTitle("Strava " + fmtDate(ds))}
    <div class="card2" style="margin-bottom:10px">
      <b>${fmtNum(n.calories)} kcal</b> · B ${fmtNum(n.protein)} g · S ${fmtNum(n.carbs)} g · T ${fmtNum(n.fat)} g
      ${calorieGoalMet(ds) ? ` <span class="badge green">cíl splněn</span>` : ""}
    </div>${rows}`);
}

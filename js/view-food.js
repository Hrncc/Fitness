/* ===== Obrazovka: Jídlo — log, denní cíle, kalendář ===== */
"use strict";

const FV = {
  date: todayStr(),          // zobrazený/zapisovaný den (jen dnešek a zpětně)
  results: [],               // poslední výsledky vyhledávání
  pending: null,             // vybraná potravina čekající na množství
  editId: null,              // id upravovaného záznamu
  mealChoice: null           // volba jídla dne v kroku množství
};

function renderFood() {
  return renderFoodLog();
}

/* ---- Denní log — sekce podle jídel dne, s navigací po dnech zpětně ---- */
function renderFoodLog() {
  const day = FV.date;
  const today = todayStr();
  const isToday = day === today;
  const nut = dayNutrition(day);
  const g = S.goal;
  const over = nut.calories > g.dailyCalories * 1.05;

  const hint = isToday ? "" : (day > today ? "budoucí den · plánování" : "klepni pro výběr data");
  const dayNav = `
    <div class="card" style="padding:10px 14px">
      <div class="row between">
        <button class="btn sm ghost" data-act="f-day-nav" data-dir="-1">‹</button>
        <div class="center" style="position:relative;flex:1">
          <b>${isToday ? "Dnes" : fmtDate(day)}</b>
          ${hint ? `<div class="small">${hint}</div>` : ""}
          <input type="date" data-change="f-date" value="${day}"
            style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer">
        </div>
        <button class="btn sm ghost" data-act="f-day-nav" data-dir="1">›</button>
      </div>
      ${isToday ? "" : `<button class="btn sm full mt" style="border-color:var(--green);color:var(--green)" data-act="f-day-today">Zpět na dnešek</button>`}
    </div>`;

  const summary = `
    <div class="card">
      <div class="h2">${isToday ? "Dnešní příjem" : `Příjem · ${fmtDate(day)}`}</div>
      <div class="row between" style="align-items:baseline;margin-bottom:8px">
        <span class="big-num"${over ? ` style="color:var(--red)"` : ""}>${fmtNum(nut.calories)}</span>
        <span class="muted">z ${fmtNum(g.dailyCalories)} kcal</span>
      </div>
      ${barHtml(nut.calories, g.dailyCalories, "green")}
      <div class="row mt" style="gap:12px;align-items:flex-start">
        ${macroBar("Bílk.", nut.protein, g.proteinGrams, "mac1", true)}
        ${macroBar("Sach.", nut.carbs, g.carbsGrams, "mac2", true)}
        ${macroBar("Tuky", nut.fat, g.fatGrams, "mac3", true)}
      </div>
    </div>`;

  const entries = foodLogOn(day);
  const entryRow = e => `
    <div class="list-item">
      <div class="grow">
        <div class="name">${esc(foodEntryName(e))}</div>
        <div class="small">${fmtNum(e.amountGrams)} g · B ${fmtNum(e.protein)} · S ${fmtNum(e.carbs)} · T ${fmtNum(e.fat)}</div>
      </div>
      <b style="white-space:nowrap">${fmtNum(e.calories)}</b>
      <button class="btn sm ghost" data-act="f-entry-edit" data-id="${e.id}">✎</button>
      <button class="iconbtn" style="width:32px;height:32px;color:var(--red)" data-act="f-entry-del" data-id="${e.id}">✕</button>
    </div>`;

  const mealCards = MEAL_TYPES.map(m => {
    const items = entries.filter(e => e.mealType === m.id);
    const kcal = items.reduce((s, e) => s + e.calories, 0);
    return `
      <div class="card">
        <div class="row between">
          <span class="h2" style="margin:0">${m.name}</span>
          ${items.length ? `<b>${fmtNum(kcal)} kcal</b>` : `<span class="small">—</span>`}
        </div>
        ${items.length ? `<div class="mt">${items.map(entryRow).join("")}</div>` : ""}
      </div>`;
  }).join("");

  const unassigned = entries.filter(e => !e.mealType);
  const unassignedCard = unassigned.length ? `
    <div class="card">
      <div class="h2">Nezařazeno</div>
      ${unassigned.map(entryRow).join("")}
    </div>` : "";

  return dayNav
    + `<button class="btn primary full" style="margin-bottom:14px" data-act="f-add">+ Přidat jídlo${isToday ? "" : ` · ${fmtDate(day)}`}</button>`
    + summary + mealCards + unassignedCard;
}

function foodEntryName(e) {
  if (e.foodItemId) { const f = getFood(e.foodItemId); if (f) return f.name; }
  return e.name || "(položka)";
}

/* ---- Modal: přidání jídla ---- */
function openAddFood(tab = "search") {
  FV.pending = null; FV.editId = null; FV.scanFile = null;
  const body = { search: foodSearchHtml, photo: foodPhotoHtml, fav: foodFavHtml, manual: foodManualHtml }[tab]();
  openModal(`${modalTitle("Přidat jídlo")}
    <div class="subtabs" style="margin-bottom:12px">
      <button class="subtab${tab === "search" ? " on" : ""}" data-act="f-modal-tab" data-tab="search">Hledat</button>
      <button class="subtab${tab === "photo" ? " on" : ""}" data-act="f-modal-tab" data-tab="photo">Foto</button>
      <button class="subtab${tab === "fav" ? " on" : ""}" data-act="f-modal-tab" data-tab="fav">Oblíbené</button>
      <button class="subtab${tab === "manual" ? " on" : ""}" data-act="f-modal-tab" data-tab="manual">Ručně</button>
    </div>
    <div id="foodModalBody">${body}</div>`);
  if (tab === "search") wireFoodSearch();
  if (tab === "photo") wirePhotoInput();
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
        <div class="name">${esc(f.name)}</div>
        <div class="small">${fmtNum(f.caloriesPer100g)} kcal /100 g</div>
      </div>
      ${sourceBadge(f.source)}
    </div>`).join("");
}

function foodManualHtml(pre = null) {
  const v = (key, dec) => pre && pre[key] != null ? String(dec ? Math.round(pre[key] * 10) / 10 : pre[key]) : "";
  return `
    <label class="field"><span>Název *</span><input class="input" id="mName" placeholder="např. Domácí guláš" value="${esc(v("name"))}"></label>
    <div class="input-row">
      <label class="field"><span>kcal /100 g *</span><input class="input" id="mKcal" type="number" inputmode="decimal" value="${v("caloriesPer100g", 1)}"></label>
      <label class="field"><span>Bílkoviny /100 g</span><input class="input" id="mProt" type="number" inputmode="decimal" value="${v("proteinPer100g", 1)}"></label>
    </div>
    <div class="input-row">
      <label class="field"><span>Sacharidy /100 g</span><input class="input" id="mCarb" type="number" inputmode="decimal" value="${v("carbsPer100g", 1)}"></label>
      <label class="field"><span>Tuky /100 g</span><input class="input" id="mFat" type="number" inputmode="decimal" value="${v("fatPer100g", 1)}"></label>
    </div>
    <button class="btn primary full" data-act="f-manual-next">Pokračovat →</button>`;
}

/* ---- Foto etikety → Claude přečte hodnoty ---- */
function foodPhotoHtml() {
  return `
    <input type="file" id="photoInput" accept="image/*" capture="environment" style="display:none">
    <button class="btn ghost full" data-act="f-photo-pick" style="border-style:dashed;min-height:56px">Vyfotit / vybrat etiketu</button>
    <div id="photoPreviewWrap" class="mt" style="display:none">
      <img id="photoPreview" alt="Náhled etikety"
        style="width:100%;max-height:260px;object-fit:contain;border-radius:16px;background:var(--bg2)">
      <button class="btn primary full mt" data-act="f-scan">Přečíst etiketu</button>
    </div>
    <div id="photoStatus"></div>
    <p class="small mt">Fotku nutriční tabulky přečte Claude a předvyplní hodnoty na 100 g —
    před uložením je zkontroluješ. Vyžaduje Claude API klíč (Nastavení).</p>`;
}

function wirePhotoInput() {
  const inp = document.getElementById("photoInput");
  inp.addEventListener("change", () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    FV.scanFile = file;
    const img = document.getElementById("photoPreview");
    img.src = URL.createObjectURL(file);
    document.getElementById("photoPreviewWrap").style.display = "";
    document.getElementById("photoStatus").innerHTML = "";
  });
}

async function runLabelScan() {
  if (!FV.scanFile) { toast("Nejdřív vyfoť nebo vyber etiketu", "err"); return; }
  const status = document.getElementById("photoStatus");
  status.innerHTML = `<div class="spin" style="margin:16px auto 6px"></div>
    <div class="small center">Claude čte etiketu…</div>`;
  try {
    const r = await FoodAPI.scanLabel(FV.scanFile);
    // přepnutí na ruční formulář s předvyplněnými hodnotami ke kontrole
    document.getElementById("foodModalBody").innerHTML = `
      <div class="card2" style="margin-bottom:12px">
        <span class="badge green">Přečteno z fotky</span>
        ${r.note ? `<div class="small mt">${esc(r.note)}</div>` : ""}
        <div class="small mt">Zkontroluj hodnoty, případně je uprav, a pokračuj.</div>
      </div>
      ${foodManualHtml(r)}`;
  } catch (e) {
    status.innerHTML = `<div class="small mt" style="color:var(--red)">${esc(e.message)}</div>`;
  }
}

/* ---- Krok množství (společný pro všechny cesty) ---- */
function openAmountStep(item, existing) {
  FV.pending = item;
  FV.mealChoice = existing ? (existing.mealType || null) : null;
  const mealChips = [{ id: null, name: "Bez zařazení" }, ...MEAL_TYPES].map(m =>
    `<button class="chip mealchip${FV.mealChoice === m.id ? " on" : ""}"
      data-act="f-meal-chip" data-meal="${m.id || ""}">${m.name}</button>`).join("");
  openModal(`${modalTitle(existing ? "Upravit záznam" : item.name)}
    <div class="card2" style="margin-bottom:12px">
      <div class="row between"><span class="muted">Na 100 g</span>${sourceBadge(item.source)}</div>
      <div class="mt" style="font-size:14px"><b>${fmtNum(item.caloriesPer100g)} kcal</b> ·
        B ${fmtNum(item.proteinPer100g, 1)} g · S ${fmtNum(item.carbsPer100g, 1)} g · T ${fmtNum(item.fatPer100g, 1)} g</div>
      ${item.servingSize ? `<div class="small mt">Porce dle výrobce: ${esc(item.servingSize)}</div>` : ""}
    </div>
    <label class="field"><span>Množství (g) *</span>
      <input class="input" id="amtG" type="number" inputmode="decimal" value="${existing ? existing.amountGrams : 100}"></label>
    <label class="field" style="margin-bottom:4px"><span>Jídlo dne</span></label>
    <div class="chips">${mealChips}</div>
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
  const meal = FV.mealChoice || null;
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
      id: uid(), date: FV.date, mealType: meal,
      foodItemId, amountGrams: grams,
      calories: Math.round((item.caloriesPer100g || 0) * k),
      protein: r1(item.proteinPer100g), carbs: r1(item.carbsPer100g), fat: r1(item.fatPer100g)
    });
  }
  FV.pending = null; FV.editId = null;
  save();
  closeModal();
  render();
  toast(FV.date === todayStr() ? "Zapsáno ✓" : `Zapsáno k ${fmtDate(FV.date)} ✓`, "ok");
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

/* ---- Denní přehled stravy (pro sjednocený kalendář v Souhrnu) ---- */
function foodDayHtml(ds) {
  const entries = foodLogOn(ds);
  if (!entries.length) return `<div class="empty-note" style="padding:14px">Žádný záznam stravy</div>`;
  const n = dayNutrition(ds);
  const rows = entries.map(e => `
    <div class="list-item">
      <div class="grow">
        <div class="name">${esc(foodEntryName(e))}</div>
        <div class="small">${mealName(e.mealType)} · ${fmtNum(e.amountGrams)} g</div>
      </div>
      <b>${fmtNum(e.calories)} kcal</b>
    </div>`).join("");
  return `
    <div class="card2" style="margin-bottom:10px">
      <b>${fmtNum(n.calories)} kcal</b> ·
      <span style="color:var(--mac1)">B ${fmtNum(n.protein)} g</span> ·
      <span style="color:var(--mac2)">S ${fmtNum(n.carbs)} g</span> ·
      <span style="color:var(--mac3)">T ${fmtNum(n.fat)} g</span>
      ${calorieGoalMet(ds) ? ` <span class="badge green">cíl splněn</span>` : ""}
    </div>${rows}`;
}

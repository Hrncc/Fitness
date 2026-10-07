/* ===== Více: sheet s nabídkou a stránky z něj ===== */
"use strict";

const APP_VERSION = "2.2";

const MV = {
  exCat: "all",     // filtr kategorie v Exercise Library
  exQuery: "",
  tplTarget: null,  // šablona, do které se přidává cvik
  tplOpen: null,    // rozbalená šablona v přehledu (akordeon, max jedna)
  reportRange: "month",
  repFrom: addDays(todayStr(), -6),  // vlastní rozsah reportu (od–do včetně)
  repTo: todayStr(),
  plan: null,       // upravovaný plán cviku v šabloně {tpl, exId, rest, link}
  rc: null,         // rozpracovaný recept (builder)
  rcPickId: null    // vybraná potravina při přidávání do receptu
};

/* ================= Více — sheet se seznamem ================= */
function openMoreSheet() {
  const items = [
    ["food", "Jídlo", "menu", "page", "food"],
    ["calendar", "Kalendář a historie", "menu", "page", "history"],
    ["body", "Postava a check-in", "go-progress", "seg", "body"],
    ["book", "Exercise Library", "menu", "page", "exlib"],
    ["list", "Workout Templates", "menu", "page", "templates"],
    ["star", "Food Library", "menu", "page", "foodlib"],
    ["share", "Export & Backup", "menu", "page", "export"],
    ["sliders", "Nastavení", "menu", "page", "settings"],
    ["info", "O aplikaci", "menu", "page", "about"]
  ].map(([icon, label, act, key, val]) => `
    <button class="more-item" data-act="${act}" data-${key}="${val}">
      <span class="mi-ic">${ic(icon, 21)}</span>${esc(label)}<span class="mi-chev">${ic("chevR", 18)}</span></button>`).join("");
  openModal(`${modalTitle("Více")}
    <div class="more-list">${items}</div>
    <div class="small more-foot">Fitness Log ${APP_VERSION}</div>`);
}

/* ================= Exercise Library ================= */
/* Hledání a filtr partií drží lepkavý panel pod top barem — zůstávají
   po ruce, i když odscrolluješ hluboko do knihovny (140+ cviků). */
function renderExLib() {
  const chips = [`<button class="chip${MV.exCat === "all" ? " on" : ""}" data-act="el-cat" data-cat="all">Vše</button>`]
    .concat(CAT_ORDER.map(c =>
      `<button class="chip cat-chip${MV.exCat === c ? " on" : ""}" data-act="el-cat" data-cat="${c}">
        <i class="p-dot" style="background:${catColor(c)}"></i>${c}</button>`))
    .join("");
  return `
    <div class="sticky-bar">
      <label class="search">${ic("search", 19)}
        <input class="input" id="elSearch" type="search" placeholder="Hledat cvik…" value="${esc(MV.exQuery)}"
          autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search"></label>
      <div class="chips scroll">${chips}</div>
    </div>
    <div class="card rows" id="elList">${elListHtml()}</div>
    <button class="btn ghost full mt" data-act="el-add">${ic("plus", 18, 2.2)} Přidat vlastní cvik</button>`;
}

function elListHtml() {
  const q = norm(MV.exQuery.trim());
  const list = S.exercises
    .filter(e => (MV.exCat === "all" || e.category === MV.exCat) && exMatches(e, q))
    .sort((a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category)
      || a.name.localeCompare(b.name, "cs"))
    .map(e => `
      <div class="list-item" data-act="el-detail" data-id="${e.id}">
        <i class="p-stripe" style="background:${catColor(e.category)}"></i>
        <div class="grow">
          <div class="name">${esc(e.name)}</div>
          ${exNameEn(e)
            ? `<div class="name-en">${esc(exNameEn(e))}</div>`
            : `<div class="li-sub">${esc(e.category)}</div>`}
        </div>
        ${e.isCustom ? `<span class="badge">vlastní</span>` : ""}
      </div>`).join("");
  return list || `<div class="empty-note">Nic nenalezeno</div>`;
}

function openExerciseDetail(id) {
  const e = getExercise(id);
  if (!e) return;
  const pr = currentPR(id);
  const en = exNameEn(e);
  openModal(`${modalTitle(e.name)}
    ${en ? `<p class="modal-sub">${esc(en)}</p>` : ""}
    <div class="row" style="margin-bottom:14px;gap:8px;flex-wrap:wrap">
      <span class="badge cat-badge"><i class="p-dot" style="background:${catColor(e.category)}"></i>${esc(e.category)}</span>
      ${e.isCustom ? `<span class="badge">vlastní</span>` : ""}
      ${pr ? `<span class="badge yellow">${ic("trophy", 12, 2.2)} ${fmtWeight(pr.weight)} × ${pr.reps}</span>` : ""}
    </div>
    <p class="muted" style="margin:0 0 ${e.pin ? 12 : 20}px;line-height:1.55">${esc(e.description || "Bez popisu")}</p>
    ${e.pin ? `<div class="hint pin" style="margin-bottom:20px">${ic("pin", 15)}<span>${esc(e.pin)}</span></div>` : ""}
    <div class="small" style="margin:-8px 2px 16px">${esc((EX_KINDS.find(k => k[0] === exKind(id)) || [])[1] || "")}</div>
    ${pr || exerciseRecords(id).best.reps ? `<div class="btn-row" style="margin-bottom:8px">
      <button class="btn ghost" data-act="pg-ex" data-exid="${id}">${ic("trend", 17)} Progres</button>
      <button class="btn ghost" data-act="w-pr-history" data-exid="${id}">${ic("trophy", 17)} Rekordy</button>
    </div>` : ""}
    <a class="btn ghost full" style="margin-bottom:8px" href="${youtubeUrl(id)}" target="_blank" rel="noopener">${ic("play", 15)} Video na YouTube</a>
    <div class="btn-row">
      <button class="btn" data-act="el-edit" data-id="${id}">${ic("edit", 17)} Upravit</button>
      <button class="btn danger" data-act="el-del" data-id="${id}">${ic("trash", 17)} Smazat</button>
    </div>`);
}

function openExerciseForm(id) {
  const e = id ? getExercise(id) : null;
  const catOpts = CAT_ORDER.map(c =>
    `<option value="${c}"${e && e.category === c ? " selected" : ""}>${c}</option>`).join("");
  openModal(`${modalTitle(e ? "Upravit cvik" : "Nový cvik")}
    <label class="field"><span>Název *</span><input class="input" id="exfName" value="${esc(e ? e.name : "")}"></label>
    <label class="field"><span>Partie</span><select class="input" id="exfCat">${catOpts}</select></label>
    <label class="field"><span>Druh</span><select class="input" id="exfKind">${EX_KINDS.map(([k, l]) =>
      `<option value="${k}"${(e ? e.kind || "weight" : "weight") === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="field"><span>Popis / technika</span>
      <textarea class="input" id="exfDesc" rows="3">${esc(e ? e.description : "")}</textarea></label>
    <label class="field"><span>Připnutá poznámka (ukáže se v tréninku)</span>
      <input class="input" id="exfPin" placeholder="např. sedačka 4, opěrka 2" value="${esc(e && e.pin || "")}"></label>
    <button class="btn primary full" data-act="el-save" data-id="${id || ""}">Uložit</button>`);
}

function saveExercise(id) {
  const name = document.getElementById("exfName").value.trim();
  if (!name) { toast("Zadej název cviku", "err"); return; }
  const category = document.getElementById("exfCat").value;
  const description = document.getElementById("exfDesc").value.trim();
  const kind = document.getElementById("exfKind").value;
  const pin = document.getElementById("exfPin").value.trim();
  let e = id ? getExercise(id) : null;
  if (e) Object.assign(e, { name, category, description, kind });
  else S.exercises.push(e = { id: uid(), name, category, description, kind, isCustom: true });
  if (pin) e.pin = pin; else delete e.pin;
  save(); closeModal(); render();
  toast("Cvik uložen ✓", "ok");
}

/* ================= Workout Templates ================= */
function renderTemplates() {
  const cards = S.templates.map(t => {
    const count = t.exercises.length;
    const counts = {};
    for (const id of t.exercises) { const c = exCategory(id); if (c) counts[c] = (counts[c] || 0) + 1; }

    /* --- sbalená šablona: název, počet cviků, pokrytí partií --- */
    if (MV.tplOpen !== t.id) {
      return `
      <div class="card" data-act="tpl-open" data-tpl="${t.id}" style="cursor:pointer">
        <div class="row">
          <div class="grow">
            <div class="name" style="font-weight:700;font-size:17px;letter-spacing:-.02em">${esc(t.name)}</div>
            <div class="li-sub">${count ? `${count} ${plural(count, "cvik", "cviky", "cviků")}` : "prázdná šablona"}</div>
          </div>
          <span class="chev">${ic("chevR", 20)}</span>
        </div>
        ${count ? `<div style="margin-top:12px">${catPipsHtml(counts)}</div>` : ""}
      </div>`;
    }

    /* --- rozbalená šablona: celý seznam cviků a úpravy --- */
    const rows = t.exercises.map((exId, i) => {
      const pl = tplPlan(t, exId);
      const own = !!(t.plan && t.plan[exId]);
      const bits = [planText(pl, exId), pl && pl.rest ? `pauza ${fmtClock(pl.rest)}` : "", pl && pl.link && i < count - 1 ? "superset s dalším" : ""].filter(Boolean);
      return `
      <div class="list-item${pl && pl.link && i < count - 1 ? " tpl-ss" : ""}">
        <i class="p-stripe" style="background:${exColor(exId)}"></i>
        <div class="grow" data-act="tpl-plan" data-tpl="${t.id}" data-exid="${exId}" style="cursor:pointer">
          <div class="name">${esc(exName(exId))}</div>
          <div class="li-sub"><span class="plan-edit">${ic("edit", 13)}</span>${bits.length ? esc(bits.join(" · ")) : "bez plánu"}${own ? "" : bits.length ? " · z popisu" : ""}</div>
        </div>
        <button class="iconbtn sm soft" data-act="tpl-move" data-tpl="${t.id}" data-i="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Nahoru">${ic("chevU", 16, 2.3)}</button>
        <button class="iconbtn sm soft" data-act="tpl-move" data-tpl="${t.id}" data-i="${i}" data-dir="1" ${i === count - 1 ? "disabled" : ""} aria-label="Dolů">${ic("chevD", 16, 2.3)}</button>
        <button class="iconbtn sm muted" data-act="tpl-rm" data-tpl="${t.id}" data-i="${i}" aria-label="Odebrat">${ic("x", 16, 2.1)}</button>
      </div>`;
    }).join("");
    return `
      <div class="card" id="tplblock-${t.id}">
        <div class="row between" style="margin-bottom:6px">
          <div class="grow" data-act="tpl-open" data-tpl="${t.id}" style="cursor:pointer">
            <div class="name" style="font-weight:700;font-size:17px;letter-spacing:-.02em">${esc(t.name)}</div>
            <div class="li-sub">${count} ${plural(count, "cvik", "cviky", "cviků")} · klepni pro sbalení</div>
          </div>
          <button class="iconbtn sm soft" data-act="tpl-rename" data-tpl="${t.id}" aria-label="Přejmenovat">${ic("edit", 16)}</button>
          <button class="iconbtn sm soft danger" data-act="tpl-del" data-tpl="${t.id}" aria-label="Smazat šablonu">${ic("trash", 16)}</button>
        </div>
        ${rows || `<div class="empty-note">Šablona je prázdná</div>`}
        <button class="btn ghost full mt" data-act="tpl-add" data-tpl="${t.id}">${ic("plus", 18, 2.2)} Přidat cvik</button>
      </div>`;
  }).join("");
  return `<p class="muted" style="margin:-6px 2px 18px">Klepni na cvik a nastav plán — série, rozsah opakování, pauzu a superset. Jednorázové změny dělej přímo v tréninku.</p>`
    + cards
    + `<button class="btn ghost full mt" data-act="tpl-new">${ic("plus", 18, 2.2)} Nová šablona</button>`;
}

/* ---- Plán cviku v šabloně: série × rozsah opakování, pauza, superset ---- */
const PLAN_RESTS = [60, 90, 120, 150, 180, 240];
function openPlanModal(tplId, exId) {
  const t = getTemplate(tplId);
  if (!t) return;
  // bez plánu: rozsah prázdný (jen nápověda v placeholderu) — samotný superset
  // nebo pauza nesmí potichu založit rozsah, který by spustil návrhy progrese
  const pl = tplPlan(t, exId) || { sets: 3, lo: null, hi: null, rest: null, link: false };
  const idx = t.exercises.indexOf(exId);
  const time = exKind(exId) === "time";
  MV.plan = { tpl: tplId, exId, rest: pl.rest || null, link: !!pl.link };
  const def = Settings.get().restSeconds || 0;
  const chips = [[null, `výchozí ${fmtClock(def)}`]].concat(PLAN_RESTS.map(r => [r, fmtClock(r)])).map(([r, l]) =>
    `<button class="chip planrest${(MV.plan.rest || null) === r ? " on" : ""}" data-act="plan-rest" data-r="${r == null ? "" : r}">${l}</button>`).join("");
  openModal(`${modalTitle(exName(exId))}
    <p class="modal-sub">Plán v šabloně ${esc(t.name)}</p>
    <div class="set-input" style="margin-top:0">
      ${stepperHtml("planSets", pl.sets || 3, 1, "Série")}
      <div class="set-field"><span class="set-lbl">${time ? "Výdrž (s)" : "Opakování"} od – do</span>
        <div class="row" style="gap:6px">
          <input class="input" id="planLo" type="text" inputmode="numeric" value="${pl.lo || ""}" placeholder="8" style="text-align:center">
          <span class="small">–</span>
          <input class="input" id="planHi" type="text" inputmode="numeric" value="${pl.hi || ""}" placeholder="12" style="text-align:center">
        </div></div>
    </div>
    <div class="set-lbl" style="margin-top:18px">Pauza po sérii</div>
    <div class="chips">${chips}</div>
    ${idx < t.exercises.length - 1 ? `<div class="row detail-core" style="margin-top:4px">
      <span class="grow"><b style="font-weight:600">Superset s dalším cvikem</b><br><span class="small">${esc(exName(t.exercises[idx + 1]))} — pauza až po obou</span></span>
      <button class="switch${MV.plan.link ? " on" : ""}" data-act="plan-link" role="switch" aria-checked="${MV.plan.link}" aria-label="Superset s dalším"></button>
    </div>` : ""}
    <p class="small" style="margin:14px 2px 16px">Když minule dáš ve všech sériích horní hranici rozsahu, trénink navrhne přidat váhu.</p>
    <button class="btn primary full" data-act="plan-save">Uložit plán</button>
    ${t.plan && t.plan[exId] ? `<button class="btn text full" data-act="plan-clear">Bez vlastního plánu</button>` : ""}`);
}

function savePlan(clear = false) {
  const p = MV.plan;
  const t = p && getTemplate(p.tpl);
  if (!t) return;
  t.plan = t.plan || {};
  if (clear) {
    delete t.plan[p.exId];
  } else {
    const sets = parseInt(document.getElementById("planSets").value, 10);
    let lo = parseInt(document.getElementById("planLo").value, 10);
    let hi = parseInt(document.getElementById("planHi").value, 10);
    if (!(sets > 0)) { toast("Zadej počet sérií", "err"); return; }
    if (lo > 0 && !(hi > 0)) hi = lo;
    if (hi > 0 && !(lo > 0)) lo = hi;
    if (lo > hi) [lo, hi] = [hi, lo];
    t.plan[p.exId] = { sets, lo: lo > 0 ? lo : null, hi: hi > 0 ? hi : null, rest: p.rest || null, link: !!p.link };
  }
  MV.plan = null;
  save(); closeModal(); render();
  toast(clear ? "Plán odebrán" : "Plán uložen ✓", "ok");
}

function openTemplateNameModal(id) {
  const t = id ? getTemplate(id) : null;
  openModal(`${modalTitle(t ? "Přejmenovat šablonu" : "Nová šablona")}
    <label class="field"><span>Název</span>
      <input class="input" id="tplName" placeholder="např. Trénink C, Nohy…" value="${esc(t ? t.name : "")}"></label>
    <button class="btn primary full" data-act="tpl-name-save" data-tpl="${id || ""}">Uložit</button>`);
  document.getElementById("tplName").focus();
}

function openTplPicker(tplId) {
  MV.tplTarget = tplId;
  const t = getTemplate(tplId);
  openExPicker({
    title: "Přidat do " + (t ? t.name : "šablony"),
    act: "tpl-pick",
    used: id => t && t.exercises.includes(id) ? "v šabloně" : null
  });
}

/* ================= Food Library ================= */
function renderFoodLib() {
  const recipeRows = S.recipes.map(r => {
    const t = recipeTotals(r);
    const perPortion = r.portions > 0 ? t.kcal / r.portions : t.kcal;
    return `
    <div class="list-item">
      <div class="grow">
        <div class="name">${esc(r.name)}</div>
        <div class="small">${r.items.length} položek · ${fmtNum(perPortion)} kcal / porce (${r.portions || 1} porcí)</div>
      </div>
      <button class="iconbtn sm soft" data-act="rl-edit" data-id="${r.id}" aria-label="Upravit">${ic("edit", 16)}</button>
      <button class="iconbtn sm muted" data-act="rl-del" data-id="${r.id}" aria-label="Smazat">${ic("x", 16, 2.1)}</button>
    </div>`;
  }).join("");
  const recipesCard = sec("Recepty", recipeRows ? `<div class="card rows">${recipeRows}</div>`
      : `<div class="card"><p class="muted" style="margin:0">Složená jídla z více potravin — jednou vytvoříš, pak zapisuješ po porcích.</p></div>`,
    { right: `<button class="btn sm" data-act="rl-new">${ic("plus", 16, 2.4)} Nový</button>` });

  const foods = [...S.foods].sort((a, b) =>
    (b.isFavorite - a.isFavorite) || a.name.localeCompare(b.name, "cs"));
  if (!foods.length) return recipesCard + sec("Potraviny", `<div class="card"><div class="empty-note">Knihovna je prázdná.<br>Položky se ukládají automaticky při zápisu jídla.</div></div>`);
  const rows = foods.map(f => `
    <div class="list-item">
      <button class="iconbtn sm" style="color:${f.isFavorite ? "var(--text)" : "var(--text3)"}" data-act="fl-star" data-id="${f.id}" aria-label="Oblíbené">${ic(f.isFavorite ? "starFill" : "star", 19)}</button>
      <div class="grow">
        <div class="name">${esc(f.name)}</div>
        <div class="small">${fmtNum(f.caloriesPer100g)} kcal · B ${fmtNum(f.proteinPer100g, 1)} · S ${fmtNum(f.carbsPer100g, 1)} · T ${fmtNum(f.fatPer100g, 1)} /100 g</div>
      </div>
      ${sourceBadge(f.source)}
      <button class="iconbtn sm soft" data-act="fl-edit" data-id="${f.id}" aria-label="Upravit">${ic("edit", 16)}</button>
      <button class="iconbtn sm muted" data-act="fl-del" data-id="${f.id}" aria-label="Smazat">${ic("x", 16, 2.1)}</button>
    </div>`).join("");
  return recipesCard + sec("Potraviny", `<div class="card rows">${rows}</div>`, { sub: "hvězdička = oblíbené pro rychlý zápis" });
}

/* ---- Builder receptu (kroky: formulář → výběr potraviny → gramy) ---- */
function openRecipeForm(id) {
  MV.rc = id
    ? JSON.parse(JSON.stringify(getRecipe(id)))
    : { id: null, name: "", portions: 1, items: [] };
  renderRecipeModal();
}

function captureRecipeForm() {
  const n = document.getElementById("rcName");
  const p = document.getElementById("rcPortions");
  if (n) MV.rc.name = n.value.trim();
  if (p) MV.rc.portions = Math.max(1, parseInt(p.value, 10) || 1);
}

function renderRecipeModal() {
  const r = MV.rc;
  const rows = r.items.map((it, i) => {
    const f = getFood(it.foodItemId);
    return `<div class="list-item">
      <div class="grow">
        <div class="name">${esc(f ? f.name : "(smazaná potravina)")}</div>
        <div class="small">${fmtNum(it.grams)} g</div>
      </div>
      <button class="iconbtn sm muted" data-act="rc-item-rm" data-i="${i}" aria-label="Odebrat">${ic("x", 16, 2.1)}</button>
    </div>`;
  }).join("");
  const t = recipeTotals(r);
  openModal(`${modalTitle(r.id ? "Upravit recept" : "Nový recept")}
    <label class="field"><span>Název *</span>
      <input class="input" id="rcName" placeholder="např. Proteinová kaše" value="${esc(r.name)}"></label>
    <label class="field"><span>Počet porcí</span>
      <input class="input" id="rcPortions" type="number" inputmode="numeric" min="1" value="${r.portions || 1}"></label>
    <div class="h3" style="margin-top:4px">Položky</div>
    ${rows || `<div class="empty-note" style="padding:12px">Zatím žádné položky</div>`}
    <button class="btn ghost full mt" data-act="rc-add-item">${ic("plus", 18, 2.2)} Přidat položku</button>
    ${t.grams ? `<div class="card2 mt"><b>Celkem:</b> ${fmtNum(t.grams)} g · ${fmtNum(t.kcal)} kcal ·
      B ${fmtNum(t.protein, 1)} · S ${fmtNum(t.carbs, 1)} · T ${fmtNum(t.fat, 1)} g
      ${r.portions > 1 ? `<div class="small mt">1 porce ≈ ${fmtNum(t.grams / r.portions)} g · ${fmtNum(t.kcal / r.portions)} kcal</div>` : ""}</div>` : ""}
    <button class="btn primary full mt" data-act="rc-save">Uložit recept</button>`);
}

function renderRecipePicker(query = "") {
  const q = query.trim().toLowerCase();
  const list = S.foods
    .filter(f => !q || f.name.toLowerCase().includes(q))
    .sort((a, b) => (b.isFavorite - a.isFavorite) || a.name.localeCompare(b.name, "cs"))
    .map(f => `<div class="list-item" data-act="rc-pick" data-id="${f.id}">
      <div class="grow">
        <div class="name">${esc(f.name)}</div>
        <div class="small">${fmtNum(f.caloriesPer100g)} kcal /100 g</div>
      </div>${sourceBadge(f.source)}
    </div>`).join("");
  openModal(`${modalTitle("Přidat položku receptu")}
    <input class="input" id="rcPickSearch" placeholder="Hledat v knihovně…" style="margin-bottom:10px">
    <div id="rcPickList">${list || `<div class="empty-note">Knihovna je prázdná — potraviny se do ní ukládají při zápisu jídla</div>`}</div>
    <button class="btn ghost full mt" data-act="rc-back">← Zpět na recept</button>`);
  const inp = document.getElementById("rcPickSearch");
  inp.addEventListener("input", () => {
    // překreslí jen seznam
    const qq = inp.value.trim().toLowerCase();
    document.getElementById("rcPickList").innerHTML = S.foods
      .filter(f => !qq || f.name.toLowerCase().includes(qq))
      .map(f => `<div class="list-item" data-act="rc-pick" data-id="${f.id}">
        <div class="grow"><div class="name">${esc(f.name)}</div>
        <div class="small">${fmtNum(f.caloriesPer100g)} kcal /100 g</div></div>${sourceBadge(f.source)}
      </div>`).join("") || `<div class="empty-note">Nic nenalezeno</div>`;
  });
  inp.focus();
}

function renderRecipeGrams() {
  const f = getFood(MV.rcPickId);
  if (!f) return;
  openModal(`${modalTitle(f.name)}
    <label class="field"><span>Množství v receptu (g) *</span>
      <input class="input" id="rcGrams" type="text" inputmode="decimal" value="${f.servingGrams || 100}"></label>
    <button class="btn primary full" data-act="rc-item-add">Přidat do receptu</button>
    <button class="btn ghost full mt" data-act="rc-back">← Zpět</button>`);
  document.getElementById("rcGrams").focus();
}

function saveRecipe() {
  captureRecipeForm();
  const r = MV.rc;
  if (!r.name) { toast("Zadej název receptu", "err"); return; }
  if (!r.items.length) { toast("Přidej alespoň jednu položku", "err"); return; }
  if (r.id) {
    const i = S.recipes.findIndex(x => x.id === r.id);
    if (i >= 0) S.recipes[i] = r;
  } else {
    r.id = uid();
    S.recipes.push(r);
  }
  MV.rc = null;
  save(); closeModal(); render();
  toast("Recept uložen ✓", "ok");
}

function openFoodEdit(id) {
  const f = getFood(id);
  if (!f) return;
  const editable = f.source === "custom";
  openModal(`${modalTitle("Upravit potravinu")}
    <label class="field"><span>Název</span><input class="input" id="flName" value="${esc(f.name)}"></label>
    ${editable ? `
    <div class="input-row">
      <label class="field"><span>kcal /100 g</span><input class="input" id="flKcal" type="text" inputmode="decimal" value="${f.caloriesPer100g}"></label>
      <label class="field"><span>Bílkoviny</span><input class="input" id="flProt" type="text" inputmode="decimal" value="${f.proteinPer100g}"></label>
    </div>
    <div class="input-row">
      <label class="field"><span>Sacharidy</span><input class="input" id="flCarb" type="text" inputmode="decimal" value="${f.carbsPer100g}"></label>
      <label class="field"><span>Tuky</span><input class="input" id="flFat" type="text" inputmode="decimal" value="${f.fatPer100g}"></label>
    </div>` : `<p class="small" style="margin:0 0 12px">Nutriční hodnoty z ${f.source === "usda" ? "USDA" : "Open Food Facts"} nelze upravovat — jen přejmenovat.</p>`}
    <div class="input-row">
      <label class="field"><span>Porce (g)</span>
        <input class="input" id="flSrvG" type="text" inputmode="decimal" placeholder="např. 30" value="${f.servingGrams || ""}"></label>
      <label class="field"><span>Název porce</span>
        <input class="input" id="flSrvN" placeholder="ks / plátek / porce" value="${esc(f.servingName || "")}"></label>
    </div>
    <p class="small" style="margin:0 0 12px">S vyplněnou porcí jde při zápisu zadávat počet kusů místo gramů.</p>
    <button class="btn primary full" data-act="fl-save" data-id="${id}">Uložit</button>`);
}

function saveFoodEdit(id) {
  const f = getFood(id);
  if (!f) return;
  const name = document.getElementById("flName").value.trim();
  if (name) f.name = name;
  if (f.source === "custom") {
    f.caloriesPer100g = parseDec(document.getElementById("flKcal").value) || f.caloriesPer100g;
    f.proteinPer100g = parseDec(document.getElementById("flProt").value) || 0;
    f.carbsPer100g = parseDec(document.getElementById("flCarb").value) || 0;
    f.fatPer100g = parseDec(document.getElementById("flFat").value) || 0;
  }
  f.servingGrams = parseDec(document.getElementById("flSrvG").value) || null;
  f.servingName = document.getElementById("flSrvN").value.trim() || null;
  save(); closeModal(); render();
  toast("Uloženo ✓", "ok");
}

/* ================= Export & Backup ================= */
/* Stav syncu jako štítek — překresluje se samostatně (syncstatus v app.js),
   aby překreslení stránky nesmazalo rozepsanou URL */
function syncBadgeHtml() {
  return {
    off: `<span class="badge">nenastaveno</span>`,
    ok: `<span class="badge green">${ic("check", 12, 3)} synchronizováno</span>`,
    pending: `<span class="badge">probíhá…</span>`,
    error: `<span class="badge red">chyba${Sync.lastError ? ": " + esc(Sync.lastError) : ""}</span>`
  }[Sync.status];
}

function renderExport() {
  const st = Settings.get();
  const chips = REPORT_RANGES.concat([{ id: "custom", label: "Vlastní" }]).map(r =>
    `<button class="chip rngchip${MV.reportRange === r.id ? " on" : ""}" data-act="rep-range" data-range="${r.id}">${r.label}</button>`).join("");
  return sec("Cloud sync", `
    <div class="card">
      <p class="muted" style="margin:0 0 16px">Automatická záloha do Google Sheetu po každé změně a slévání mezi zařízeními.
        Apps Script navíc drží 7 denních záloh.</p>
      <label class="field"><span>Apps Script Web App URL</span>
        <input class="input" id="setGas" data-change="set-gas" placeholder="https://script.google.com/macros/s/…/exec"
          value="${esc(st.gasWebAppUrl)}" autocomplete="off" autocorrect="off" spellcheck="false"></label>
      <p class="small" style="margin:-6px 2px 16px">URL funguje jako přístupový klíč — ukládá se jen v tomto zařízení. Návod je v README.</p>
      <div class="btn-row">
        <button class="btn" data-act="set-sync-now">${ic("upload", 17)} Uložit</button>
        <button class="btn" data-act="set-sync-load">${ic("download", 17)} Načíst</button>
      </div>
    </div>`, { right: `<span id="syncBadge">${syncBadgeHtml()}</span>` })
  + sec("Záloha do souboru", `
    <div class="card">
      <p class="muted" style="margin:0 0 16px">JSON je kompletní záloha pro pozdější import, Markdown čitelný souhrn.
        Fotky součástí nejsou — stahují se jednotlivě v Postavě.</p>
      <button class="btn primary full" data-act="exp-share">${ic("share", 18, 2.2)} Export &amp; Share</button>
      <div class="btn-row mt">
        <button class="btn" data-act="exp-json">JSON</button>
        <button class="btn" data-act="exp-md">Markdown</button>
        <button class="btn" data-act="exp-csv">CSV</button>
      </div>
      <p class="small" style="margin:12px 2px 0">CSV = jedna série na řádek (do Google Sheets nebo Excelu). Markdown i report níž jdou omezit na rozsah zvolený v reportu.</p>
    </div>`)
  + sec("Report pro Clauda", `
    <div class="card">
      <p class="muted" style="margin:0 0 14px">Čitelný přehled tréninků, progrese, váhy a stravy — zkopíruj a vlož do chatu.
        Neobsahuje sync URL ani API klíče.</p>
      <div class="chips">${chips}</div>
      ${MV.reportRange === "custom" ? dateRangeRow("rep", MV.repFrom, MV.repTo) : ""}
      <div class="btn-row">
        <button class="btn primary" data-act="rep-copy">${ic("copy", 17, 2.2)} Zkopírovat</button>
        <button class="btn" data-act="rep-share">Sdílet</button>
      </div>
      <button class="btn text full" data-act="rep-preview">Zobrazit náhled</button>
    </div>`)
  + sec("Import zálohy", `
    <div class="card">
      <p class="muted" style="margin:0 0 14px">Nahraje JSON zálohu a <b style="color:var(--text)">přepíše aktuální data</b>.</p>
      <input type="file" id="impFile" accept=".json,application/json" class="input">
      <button class="btn danger full mt" data-act="exp-import">Importovat</button>
    </div>`);
}

/* Vybraný rozsah pro report i markdown export */
function reportRangeArg() {
  return MV.reportRange === "custom" ? { from: MV.repFrom, to: MV.repTo } : MV.reportRange;
}

/* ---- Report: kopírování, sdílení, náhled ---- */

/* Starší, ale spolehlivá cesta — funguje i tam, kde Clipboard API nemá
   oprávnění. Musí proběhnout synchronně v rámci klepnutí. */
function legacyCopy(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length); // iOS Safari
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

function copyReport() {
  const text = buildCoachReport(reportRangeArg());
  const kb = Math.round(text.length / 1024 * 10) / 10;
  if (legacyCopy(text)) { toast(`Report zkopírován (${kb} kB) ✓`, "ok"); return; }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => toast(`Report zkopírován (${kb} kB) ✓`, "ok"))
      .catch(() => showReportModal(text, "Zkopírování selhalo — označ text a zkopíruj ručně."));
    return;
  }
  showReportModal(text, "Prohlížeč neumí kopírovat do schránky — označ text a zkopíruj ručně.");
}

async function shareReport() {
  const text = buildCoachReport(reportRangeArg());
  if (!navigator.share) { copyReport(); return; }
  try {
    await navigator.share({ title: "Fitness Log — report", text });
  } catch (e) {
    if (e.name !== "AbortError") copyReport();
  }
}

function showReportModal(text, note) {
  openModal(`${modalTitle("Report")}
    ${note ? `<p class="small" style="margin:0 0 10px;color:var(--red)">${esc(note)}</p>` : ""}
    <textarea class="input" rows="14" style="font-size:12px;line-height:1.5"
      onclick="this.select()">${esc(text)}</textarea>
    <button class="btn primary full mt" data-act="rep-copy">Zkopírovat</button>`);
}

function buildMarkdown(rangeId) {
  const { from, to, label } = resolveReportRange(rangeId);
  const lines = [`# Fitness Log — export ${fmtDate(todayStr())}`, `Rozsah: ${label}`, ""];
  lines.push(`## Denní cíl`, `- ${S.goal.dailyCalories} kcal · B ${S.goal.proteinGrams} g · S ${S.goal.carbsGrams} g · T ${S.goal.fatGrams} g`, "");
  const prs = allPRs();
  if (prs.length) {
    lines.push(`## Osobní rekordy`);
    for (const { exerciseId, pr } of prs)
      lines.push(`- **${exName(exerciseId)}**: ${fmtWeight(pr.weight)} × ${pr.reps} (${fmtDate(pr.date)})`);
    lines.push("");
  }
  const sess = S.sessions.filter(s => s.date >= from && s.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date));
  lines.push(`## Tréninky (${sess.length})`);
  for (const s of sess) {
    if (s.type === "cardio") {
      const c = s.entries[0] || {};
      lines.push(`### ${fmtDate(s.date)} — Kardio`, `- ${c.duration} min${c.distance ? `, ${c.distance} km` : ""}${c.calories ? `, ${c.calories} kcal` : ""}`);
    } else {
      lines.push(`### ${fmtDate(s.date)} — ${templateLabel(s.templateUsed)}`);
      for (const e of s.entries) {
        const sets = (e.sets || []).map(st => `${st.reps}×${fmtWeight(st.weight, false)}${st.failure ? " (do selhání)" : ""}`).join(", ");
        lines.push(`- ${exName(e.exerciseId)}: ${sets} ${weightUnit()}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

/* Série jako CSV — jedna série na řádek, středník a desetinná čárka (česká
   tabulka je otevře rovnou do sloupců), BOM kvůli diakritice v Excelu. */
function buildSetsCsv() {
  const cell = v => {
    const t = v == null ? "" : String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const num = v => v == null ? "" : String(Math.round(v * 100) / 100).replace(".", ",");
  const rows = [["datum", "zacatek", "trenink", "cvik", "partie", "druh", "serie", "opakovani_nebo_s", `vaha_${weightUnit()}`, "do_selhani", "superset", "poznamka"]];
  const sess = S.sessions.filter(s => s.type === "weights").sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sess) for (const e of s.entries) (e.sets || []).forEach((st, j) => rows.push([
    s.date, s.startedAt ? fmtTime(s.startedAt) : "", sessionLabel(s), exName(e.exerciseId), exCategory(e.exerciseId) || "", exKind(e.exerciseId),
    j + 1, st.reps, num(kgOut(st.weight || 0)), st.failure ? "ano" : "", e.link ? "s dalším" : "", st.note || ""
  ]));
  return "\ufeff" + rows.map(r => r.map(cell).join(";")).join("\r\n");
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function exportShare() {
  const json = JSON.stringify(S, null, 2);
  const md = buildMarkdown();
  const stamp = todayStr();
  if (navigator.share) {
    try {
      const files = [
        new File([json], `fitness-log-${stamp}.json`, { type: "application/json" }),
        new File([md], `fitness-log-${stamp}.md`, { type: "text/markdown" })
      ];
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({ files, title: "Fitness Log export" });
        return;
      }
      await navigator.share({ title: "Fitness Log export", text: md });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  downloadFile(`fitness-log-${stamp}.json`, json, "application/json");
  downloadFile(`fitness-log-${stamp}.md`, md, "text/markdown");
  toast("Sdílení není dostupné — soubory staženy");
}

function importBackup() {
  const inp = document.getElementById("impFile");
  const file = inp.files && inp.files[0];
  if (!file) { toast("Vyber soubor JSON", "err"); return; }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.sessions)) throw new Error("neplatný formát");
      replaceState(data);
      save();
      render();
      toast("Záloha importována ✓", "ok");
    } catch (e) {
      toast("Import selhal: " + e.message, "err");
    }
  };
  reader.readAsText(file);
}

/* ================= Nastavení ================= */
function renderSettings() {
  const st = Settings.get();
  const g = S.goal;
  return sec("Denní nutriční cíl", `
    <div class="card">
      <div class="input-row">
        <label class="field"><span>Kalorie (kcal)</span><input class="input" id="setKcal" type="number" inputmode="numeric" value="${g.dailyCalories}"></label>
        <label class="field"><span>Bílkoviny (g)</span><input class="input" id="setProt" type="number" inputmode="numeric" value="${g.proteinGrams}"></label>
      </div>
      <div class="input-row">
        <label class="field" style="margin:0"><span>Sacharidy (g)</span><input class="input" id="setCarb" type="number" inputmode="numeric" value="${g.carbsGrams}"></label>
        <label class="field" style="margin:0"><span>Tuky (g)</span><input class="input" id="setFat" type="number" inputmode="numeric" value="${g.fatGrams}"></label>
      </div>
    </div>`)
  + sec("Trénink a jednotky", `
    <div class="card">
      <div class="input-row">
        <label class="field"><span>Výchozí pauza (s, 0 = vypnuto)</span>
          <input class="input" id="setRest" type="number" inputmode="numeric" value="${st.restSeconds ?? 120}"></label>
        <label class="field"><span>Týdenní cíl tréninků (0 = bez cíle)</span>
          <input class="input" id="setGoal" type="number" inputmode="numeric" value="${st.weeklyGoal ?? 3}"></label>
      </div>
      <div class="row detail-core" style="margin:0 0 14px">
        <span class="grow"><b style="font-weight:600">Nezhasínat obrazovku při tréninku</b><br>
          <span class="small">Funguje na novějším iOS a v Chrome</span></span>
        <button class="switch${st.keepAwake !== false ? " on" : ""}" data-act="set-awake" role="switch" aria-checked="${st.keepAwake !== false}" aria-label="Nezhasínat obrazovku"></button>
      </div>
      <label class="field" style="margin:0"><span>Jednotka váhy</span>
        <select class="input" id="setUnit">
          <option value="kg"${st.weightUnit === "kg" ? " selected" : ""}>kilogramy (kg)</option>
          <option value="lb"${st.weightUnit === "lb" ? " selected" : ""}>libry (lb)</option>
        </select></label>
    </div>`)
  + sec("API klíče", `
    <div class="card">
      <label class="field"><span>USDA FoodData Central</span>
        <input class="input" id="setUsda" placeholder="prázdné = DEMO_KEY (30 dotazů/hod)" value="${esc(st.usdaApiKey)}"></label>
      <p class="small" style="margin:-6px 2px 14px">Klíč zdarma: fdc.nal.usda.gov/api-key-signup.html</p>
      <label class="field"><span>Claude API (čtení etiket z fotky)</span>
        <input class="input" id="setAnthropic" type="password" placeholder="sk-ant-…" value="${esc(st.anthropicApiKey)}"></label>
      <p class="small" style="margin:-6px 2px 0">Klíč z console.anthropic.com. Ukládá se jen v tomto zařízení a posílá se pouze na api.anthropic.com.</p>
    </div>`)
  + sec("Přenos na jiné zařízení", `
    <div class="card">
      <p class="muted" style="margin:0 0 14px">QR kód přenese sync URL, API klíče a jednotky — na novém zařízení je nemusíš opisovat.</p>
      <div class="btn-row">
        <button class="btn" data-act="set-qr-show">Zobrazit QR</button>
        <button class="btn" data-act="set-qr-scan">Načíst z QR</button>
      </div>
      <input type="file" id="qrScanInput" accept="image/*" capture="environment" style="display:none">
    </div>`)
  + `<button class="btn primary full mt2" data-act="set-save">Uložit nastavení</button>`;
}

function saveSettings() {
  Settings.set({
    usdaApiKey: document.getElementById("setUsda").value.trim(),
    anthropicApiKey: document.getElementById("setAnthropic").value.trim(),
    weightUnit: document.getElementById("setUnit").value,
    restSeconds: Math.max(0, parseInt(document.getElementById("setRest").value, 10) || 0),
    weeklyGoal: clamp(parseInt(document.getElementById("setGoal").value, 10) || 0, 0, 14)
  });
  S.goal = {
    dailyCalories: parseInt(document.getElementById("setKcal").value, 10) || 0,
    proteinGrams: parseInt(document.getElementById("setProt").value, 10) || 0,
    carbsGrams: parseInt(document.getElementById("setCarb").value, 10) || 0,
    fatGrams: parseInt(document.getElementById("setFat").value, 10) || 0
  };
  save();
  render();
  toast("Nastavení uloženo ✓", "ok");
}

/* ================= Fotky postupu ================= */
/* Stav fotek pro stránku Postava (renderBody ve view-checkin.js) */
const PV = { items: null, loading: false, urls: [], modalUrl: null, cmpA: null, cmpB: null, pendingFile: null };

function photoUrl(rec) {
  const u = URL.createObjectURL(rec.blob);
  PV.urls.push(u);
  return u;
}

/* výběr souboru → potvrzovací modal s datem a poznámkou */
function openPhotoSaveModal(file) {
  PV.pendingFile = file;
  if (PV.modalUrl) URL.revokeObjectURL(PV.modalUrl);
  PV.modalUrl = URL.createObjectURL(file);
  openModal(`${modalTitle("Přidat fotku")}
    <img src="${PV.modalUrl}" alt="Náhled" style="width:100%;max-height:300px;object-fit:contain;border-radius:18px;background:var(--s2)">
    <label class="field mt"><span>Datum</span>
      <input class="input" id="phDate" type="date" value="${todayStr()}"></label>
    <label class="field"><span>Poznámka</span>
      <input class="input" id="phNote" placeholder="volitelné — např. ráno nalačno"></label>
    <button class="btn primary full" data-act="ph-save">Uložit fotku</button>`);
}

async function savePhoto() {
  if (!PV.pendingFile) return;
  const date = document.getElementById("phDate").value || todayStr();
  const note = document.getElementById("phNote").value.trim();
  try {
    await Photos.add(PV.pendingFile, date, note);
    PV.pendingFile = null;
    PV.items = null; // vynutí načtení
    closeModal();
    render();
    toast("Fotka uložena ✓", "ok");
  } catch (e) {
    toast("Uložení selhalo: " + e.message, "err");
  }
}

function openPhotoDetail(id) {
  const p = (PV.items || []).find(x => x.id === id);
  if (!p) return;
  if (PV.modalUrl) URL.revokeObjectURL(PV.modalUrl);
  PV.modalUrl = URL.createObjectURL(p.blob);
  openModal(`${modalTitle(fmtDate(p.date))}
    <img src="${PV.modalUrl}" alt="Fotka ${fmtDate(p.date)}" style="width:100%;max-height:60vh;object-fit:contain;border-radius:18px;background:var(--s2)">
    ${p.note ? `<p class="muted mt">${esc(p.note)}</p>` : ""}
    <div class="btn-row mt">
      <button class="btn" data-act="ph-download" data-id="${id}">${ic("download", 17)} Stáhnout</button>
      <button class="btn danger" data-act="ph-del" data-id="${id}">Smazat</button>
    </div>`);
}

async function deletePhoto(id) {
  try {
    await Photos.remove(id);
    PV.items = null;
    closeModal();
    render();
    toast("Fotka smazána");
  } catch (e) {
    toast("Smazání selhalo: " + e.message, "err");
  }
}

function downloadPhoto(id) {
  const p = (PV.items || []).find(x => x.id === id);
  if (!p) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(p.blob);
  a.download = `fotka-${p.date}.jpg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ================= Přenos nastavení přes QR ================= */
const QR_PREFIX = "FITAPP1:";

function openQrExport() {
  const st = Settings.get();
  const payload = QR_PREFIX + JSON.stringify({
    g: st.gasWebAppUrl, u: st.usdaApiKey, a: st.anthropicApiKey,
    w: st.weightUnit, r: st.restSeconds
  });
  openModal(`${modalTitle("Nastavení jako QR")}
    <div class="center" style="background:#fff;border-radius:18px;padding:10px">
      <canvas id="qrCanvas" style="max-width:100%;height:auto;display:block;margin:0 auto"></canvas>
    </div>
    <p class="small mt">Kód obsahuje sync URL a API klíče — nikomu ho neukazuj a neposílej.
    Na druhém zařízení: Nastavení → Načíst z QR (vyfoť tuhle obrazovku).</p>`);
  if (!qrToCanvas(payload, document.getElementById("qrCanvas"), 6)) {
    document.getElementById("qrCanvas").outerHTML =
      `<div class="small" style="color:var(--red);padding:12px">Nastavení je pro QR moc dlouhé.</div>`;
  }
}

async function importQrFile(file) {
  try {
    if (!("BarcodeDetector" in window)) throw new Error("Tenhle prohlížeč neumí číst QR z fotky");
    const bmp = await createImageBitmap(file);
    const det = new BarcodeDetector({ formats: ["qr_code"] });
    const codes = await det.detect(bmp);
    const hit = codes.map(c => c.rawValue).find(v => v && v.startsWith(QR_PREFIX));
    if (!hit) throw new Error("Na fotce není QR kód s nastavením appky");
    const p = JSON.parse(hit.slice(QR_PREFIX.length));
    Settings.set({
      gasWebAppUrl: p.g || "",
      usdaApiKey: p.u || "",
      anthropicApiKey: p.a || "",
      weightUnit: p.w === "lb" ? "lb" : "kg",
      restSeconds: Number.isFinite(p.r) ? p.r : 120
    });
    render();
    toast("Nastavení načteno ✓ — Uložit do cloudu / Načíst z cloudu podle potřeby", "ok");
    Sync.init();
  } catch (e) {
    toast(e.message, "err");
  }
}

/* ================= O aplikaci ================= */
function renderAbout() {
  return `
    <div class="card">
      <div class="about-logo">Fitness<span style="color:var(--green)">Log</span></div>
      <p class="muted" style="margin:0 0 16px">Verze ${APP_VERSION}</p>
      <p class="muted" style="margin:0 0 12px;line-height:1.55">
        Osobní deník silových a kardio tréninků, postavy a stravy.
        Data se ukládají lokálně v prohlížeči a volitelně synchronizují do Google Sheets.
      </p>
      <p class="small" style="margin:0;line-height:1.55">
        Databáze potravin: Open Food Facts (ODbL) a USDA FoodData Central (public domain).
        Odhad 1RM: Epleyho vzorec. Aplikace funguje offline (PWA).
      </p>
    </div>`;
}

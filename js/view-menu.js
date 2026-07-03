/* ===== Obrazovky z hamburger menu ===== */
"use strict";

const APP_VERSION = "1.0.0";

const MV = {
  exCat: "all",     // filtr kategorie v Exercise Library
  exQuery: "",
  tplTarget: null   // šablona, do které se přidává cvik
};

/* ================= Exercise Library ================= */
function renderExLib() {
  const chips = [`<button class="chip${MV.exCat === "all" ? " on" : ""}" data-act="el-cat" data-cat="all">Vše</button>`]
    .concat(EX_CATEGORIES.map(c =>
      `<button class="chip${MV.exCat === c ? " on" : ""}" data-act="el-cat" data-cat="${c}">${c}</button>`))
    .join("");
  return `
    <button class="btn primary full" style="margin-bottom:14px" data-act="el-add">+ Přidat vlastní cvik</button>
    <input class="input" id="elSearch" placeholder="Hledat cvik…" value="${esc(MV.exQuery)}" style="margin-bottom:12px">
    <div class="chips">${chips}</div>
    <div class="card" id="elList">${elListHtml()}</div>`;
}

function elListHtml() {
  const q = MV.exQuery.toLowerCase();
  const list = S.exercises
    .filter(e => (MV.exCat === "all" || e.category === MV.exCat) && (!q || e.name.toLowerCase().includes(q)))
    .sort((a, b) => a.category.localeCompare(b.category, "cs") || a.name.localeCompare(b.name, "cs"))
    .map(e => `
      <div class="list-item" data-act="el-detail" data-id="${e.id}" style="cursor:pointer">
        <div class="grow">
          <div class="name">${esc(e.name)}</div>
          <div class="small">${esc(e.category)}</div>
        </div>
        ${e.isCustom ? `<span class="badge purple">vlastní</span>` : ""}
      </div>`).join("");
  return list || `<div class="empty-note">Nic nenalezeno</div>`;
}

function openExerciseDetail(id) {
  const e = getExercise(id);
  if (!e) return;
  const pr = currentPR(id);
  openModal(`${modalTitle(e.name)}
    <div class="row" style="margin-bottom:10px">
      <span class="badge purple">${esc(e.category)}</span>
      ${e.isCustom ? `<span class="badge purple">vlastní</span>` : ""}
      ${pr ? `<span class="badge green">PR ${fmtWeight(pr.weight)} × ${pr.reps}</span>` : ""}
    </div>
    <p class="muted" style="margin:0 0 16px">${esc(e.description || "Bez popisu")}</p>
    ${pr ? `<button class="btn ghost full" style="margin-bottom:8px" data-act="w-pr-history" data-exid="${id}">Historie rekordů</button>` : ""}
    ${e.isCustom ? `
      <div class="row" style="gap:8px">
        <button class="btn grow" data-act="el-edit" data-id="${id}">Upravit</button>
        <button class="btn danger grow" data-act="el-del-ask" data-id="${id}">Smazat</button>
      </div>` : ""}`);
}

function openExerciseForm(id) {
  const e = id ? getExercise(id) : null;
  const catOpts = EX_CATEGORIES.map(c =>
    `<option value="${c}"${e && e.category === c ? " selected" : ""}>${c}</option>`).join("");
  openModal(`${modalTitle(e ? "Upravit cvik" : "Nový cvik")}
    <label class="field"><span>Název *</span><input class="input" id="exfName" value="${esc(e ? e.name : "")}"></label>
    <label class="field"><span>Partie</span><select class="input" id="exfCat">${catOpts}</select></label>
    <label class="field"><span>Popis / technika</span>
      <textarea class="input" id="exfDesc" rows="3">${esc(e ? e.description : "")}</textarea></label>
    <button class="btn primary full" data-act="el-save" data-id="${id || ""}">Uložit</button>`);
}

function saveExercise(id) {
  const name = document.getElementById("exfName").value.trim();
  if (!name) { toast("Zadej název cviku", "err"); return; }
  const category = document.getElementById("exfCat").value;
  const description = document.getElementById("exfDesc").value.trim();
  if (id) {
    const e = getExercise(id);
    if (e) Object.assign(e, { name, category, description });
  } else {
    S.exercises.push({ id: uid(), name, category, description, isCustom: true });
  }
  save(); closeModal(); render();
  toast("Cvik uložen ✓", "ok");
}

function deleteExercise(id) {
  S.exercises = S.exercises.filter(e => e.id !== id);
  for (const t of S.templates) t.exercises = t.exercises.filter(x => x !== id);
  save(); closeModal(); render();
  toast("Cvik smazán");
}

/* ================= Workout Templates ================= */
function renderTemplates() {
  const cards = S.templates.map(t => {
    const rows = t.exercises.map((exId, i) => `
      <div class="list-item">
        <div class="grow name">${esc(exName(exId))}</div>
        <button class="btn sm ghost" data-act="tpl-move" data-tpl="${t.id}" data-i="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="btn sm ghost" data-act="tpl-move" data-tpl="${t.id}" data-i="${i}" data-dir="1" ${i === t.exercises.length - 1 ? "disabled" : ""}>↓</button>
        <button class="iconbtn" style="width:32px;height:32px;color:var(--red)" data-act="tpl-rm" data-tpl="${t.id}" data-i="${i}">✕</button>
      </div>`).join("");
    return `
      <div class="card" style="border-color:var(--${t.id === "B" ? "cyan" : "green"})">
        <div class="h2" style="color:var(--${t.id === "B" ? "cyan" : "green"})">${esc(t.name)}</div>
        ${rows || `<div class="empty-note">Šablona je prázdná</div>`}
        <button class="btn ghost full mt" style="border-style:dashed" data-act="tpl-add" data-tpl="${t.id}">+ Přidat cvik</button>
      </div>`;
  }).join("");
  return `<p class="muted" style="margin:0 0 12px">Trvalá úprava šablon A/B. Jednorázové změny dělej přímo v tréninku.</p>` + cards;
}

function openTplPicker(tplId) {
  MV.tplTarget = tplId;
  openModal(`${modalTitle("Přidat cvik do šablony " + tplId)}
    <input class="input" id="exPickSearch" placeholder="Hledat cvik…" style="margin-bottom:10px">
    <div id="exPickList">${tplPickerList("")}</div>`);
  const inp = document.getElementById("exPickSearch");
  inp.addEventListener("input", () => {
    document.getElementById("exPickList").innerHTML = tplPickerList(inp.value);
  });
}

function tplPickerList(query) {
  const t = getTemplate(MV.tplTarget);
  const q = query.trim().toLowerCase();
  return EX_CATEGORIES.map(cat => {
    const items = S.exercises
      .filter(e => e.category === cat && !t.exercises.includes(e.id) && (!q || e.name.toLowerCase().includes(q)))
      .map(e => `<div class="list-item" data-act="tpl-pick" data-exid="${e.id}" style="cursor:pointer">
        <div class="grow name">${esc(e.name)}</div></div>`).join("");
    return items ? `<div class="h3" style="margin-top:10px">${cat}</div>${items}` : "";
  }).join("") || `<div class="empty-note">Nic nenalezeno</div>`;
}

/* ================= Food Library ================= */
function renderFoodLib() {
  const foods = [...S.foods].sort((a, b) =>
    (b.isFavorite - a.isFavorite) || a.name.localeCompare(b.name, "cs"));
  if (!foods.length) return `<div class="card"><div class="empty-note">Knihovna je prázdná.<br>Položky se ukládají automaticky při zápisu jídla.</div></div>`;
  const rows = foods.map(f => `
    <div class="list-item">
      <button class="iconbtn" style="width:34px;height:34px;font-size:18px" data-act="fl-star" data-id="${f.id}">${f.isFavorite ? "⭐" : "☆"}</button>
      <div class="grow">
        <div class="name">${esc(f.name)}</div>
        <div class="small">${fmtNum(f.caloriesPer100g)} kcal · B ${fmtNum(f.proteinPer100g, 1)} · S ${fmtNum(f.carbsPer100g, 1)} · T ${fmtNum(f.fatPer100g, 1)} /100 g</div>
      </div>
      ${sourceBadge(f.source)}
      <button class="btn sm ghost" data-act="fl-edit" data-id="${f.id}">✎</button>
      <button class="iconbtn" style="width:32px;height:32px;color:var(--red)" data-act="fl-del-ask" data-id="${f.id}">✕</button>
    </div>`).join("");
  return `<div class="card"><div class="h2">Knihovna potravin</div>${rows}
    <p class="small mt">⭐ = oblíbené (rychlý výběr při zápisu jídla)</p></div>`;
}

function openFoodEdit(id) {
  const f = getFood(id);
  if (!f) return;
  const editable = f.source === "custom";
  openModal(`${modalTitle("Upravit potravinu")}
    <label class="field"><span>Název</span><input class="input" id="flName" value="${esc(f.name)}"></label>
    ${editable ? `
    <div class="input-row">
      <label class="field"><span>kcal /100 g</span><input class="input" id="flKcal" type="number" value="${f.caloriesPer100g}"></label>
      <label class="field"><span>Bílkoviny</span><input class="input" id="flProt" type="number" value="${f.proteinPer100g}"></label>
    </div>
    <div class="input-row">
      <label class="field"><span>Sacharidy</span><input class="input" id="flCarb" type="number" value="${f.carbsPer100g}"></label>
      <label class="field"><span>Tuky</span><input class="input" id="flFat" type="number" value="${f.fatPer100g}"></label>
    </div>` : `<p class="small" style="margin:0 0 12px">Nutriční hodnoty z ${f.source === "usda" ? "USDA" : "Open Food Facts"} nelze upravovat — jen přejmenovat.</p>`}
    <button class="btn primary full" data-act="fl-save" data-id="${id}">Uložit</button>`);
}

function saveFoodEdit(id) {
  const f = getFood(id);
  if (!f) return;
  const name = document.getElementById("flName").value.trim();
  if (name) f.name = name;
  if (f.source === "custom") {
    f.caloriesPer100g = parseFloat(document.getElementById("flKcal").value) || f.caloriesPer100g;
    f.proteinPer100g = parseFloat(document.getElementById("flProt").value) || 0;
    f.carbsPer100g = parseFloat(document.getElementById("flCarb").value) || 0;
    f.fatPer100g = parseFloat(document.getElementById("flFat").value) || 0;
  }
  save(); closeModal(); render();
  toast("Uloženo ✓", "ok");
}

/* ================= Export & Backup ================= */
function renderExport() {
  return `
    <div class="card">
      <div class="h2">Export &amp; Backup</div>
      <p class="muted" style="margin:0 0 14px">Záloha nad rámec automatického cloud syncu. JSON lze později importovat, Markdown je čitelný souhrn.</p>
      <button class="btn primary full" data-act="exp-share">📤 Export &amp; Share</button>
      <div class="row mt" style="gap:8px">
        <button class="btn grow" data-act="exp-json">Stáhnout JSON</button>
        <button class="btn grow" data-act="exp-md">Stáhnout Markdown</button>
      </div>
    </div>
    <div class="card">
      <div class="h2">Import zálohy</div>
      <p class="muted" style="margin:0 0 12px">Nahraje JSON zálohu a <b>přepíše aktuální data</b>.</p>
      <input type="file" id="impFile" accept=".json,application/json" class="input">
      <button class="btn danger full mt" data-act="exp-import">Importovat</button>
    </div>`;
}

function buildMarkdown() {
  const lines = [`# Fitness Log — export ${fmtDate(todayStr())}`, ""];
  lines.push(`## Denní cíl`, `- ${S.goal.dailyCalories} kcal · B ${S.goal.proteinGrams} g · S ${S.goal.carbsGrams} g · T ${S.goal.fatGrams} g`, "");
  const prs = allPRs();
  if (prs.length) {
    lines.push(`## Osobní rekordy`);
    for (const { exerciseId, pr } of prs)
      lines.push(`- **${exName(exerciseId)}**: ${fmtWeight(pr.weight)} × ${pr.reps} (${fmtDate(pr.date)})`);
    lines.push("");
  }
  lines.push(`## Tréninky (posledních 30)`);
  for (const s of [...S.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)) {
    if (s.type === "cardio") {
      const c = s.entries[0] || {};
      lines.push(`### ${fmtDate(s.date)} — Kardio`, `- ${c.duration} min${c.distance ? `, ${c.distance} km` : ""}${c.calories ? `, ${c.calories} kcal` : ""}`);
    } else {
      lines.push(`### ${fmtDate(s.date)} — ${templateLabel(s.templateUsed)}`);
      for (const e of s.entries) {
        const sets = (e.sets || []).map(st => `${st.reps}×${fmtWeight(st.weight, false)}`).join(", ");
        lines.push(`- ${exName(e.exerciseId)}: ${sets} ${weightUnit()}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
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
  const syncState = {
    off: `<span class="badge">nenastaveno</span>`,
    ok: `<span class="badge green">synchronizováno</span>`,
    pending: `<span class="badge yellow">probíhá…</span>`,
    error: `<span class="badge red">chyba${Sync.lastError ? ": " + esc(Sync.lastError) : ""}</span>`
  }[Sync.status];
  return `
    <div class="card">
      <div class="h2">Cloud sync (Google Sheets)</div>
      <div class="row between" style="margin-bottom:10px"><span class="muted">Stav</span>${syncState}</div>
      <label class="field"><span>Apps Script Web App URL</span>
        <input class="input" id="setGas" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(st.gasWebAppUrl)}"></label>
      <p class="small" style="margin:0 0 10px">URL funguje jako přístupový klíč — ukládá se jen v tomto zařízení, nikam se nesdílí. Návod na nasazení skriptu je v souboru README.</p>
      <div class="row" style="gap:8px">
        <button class="btn grow" data-act="set-sync-now">↑ Uložit do cloudu</button>
        <button class="btn grow" data-act="set-sync-load">↓ Načíst z cloudu</button>
      </div>
    </div>
    <div class="card">
      <div class="h2">Denní nutriční cíl</div>
      <div class="input-row">
        <label class="field"><span>Kalorie (kcal)</span><input class="input" id="setKcal" type="number" value="${g.dailyCalories}"></label>
        <label class="field"><span>Bílkoviny (g)</span><input class="input" id="setProt" type="number" value="${g.proteinGrams}"></label>
      </div>
      <div class="input-row">
        <label class="field"><span>Sacharidy (g)</span><input class="input" id="setCarb" type="number" value="${g.carbsGrams}"></label>
        <label class="field"><span>Tuky (g)</span><input class="input" id="setFat" type="number" value="${g.fatGrams}"></label>
      </div>
    </div>
    <div class="card">
      <div class="h2">Ostatní</div>
      <label class="field"><span>Jednotka váhy</span>
        <select class="input" id="setUnit">
          <option value="kg"${st.weightUnit === "kg" ? " selected" : ""}>kilogramy (kg)</option>
          <option value="lb"${st.weightUnit === "lb" ? " selected" : ""}>libry (lb)</option>
        </select></label>
      <label class="field"><span>USDA FoodData Central API klíč</span>
        <input class="input" id="setUsda" placeholder="prázdné = DEMO_KEY (30 dotazů/hod)" value="${esc(st.usdaApiKey)}"></label>
      <p class="small" style="margin:0">Klíč zdarma: fdc.nal.usda.gov/api-key-signup.html</p>
    </div>
    <button class="btn primary full" data-act="set-save">Uložit nastavení</button>`;
}

function saveSettings() {
  Settings.set({
    gasWebAppUrl: document.getElementById("setGas").value.trim(),
    usdaApiKey: document.getElementById("setUsda").value.trim(),
    weightUnit: document.getElementById("setUnit").value
  });
  S.goal = {
    dailyCalories: parseInt(document.getElementById("setKcal").value, 10) || 0,
    proteinGrams: parseInt(document.getElementById("setProt").value, 10) || 0,
    carbsGrams: parseInt(document.getElementById("setCarb").value, 10) || 0,
    fatGrams: parseInt(document.getElementById("setFat").value, 10) || 0
  };
  save();
  if (!Sync.url()) Sync.setStatus("off");
  render();
  toast("Nastavení uloženo ✓", "ok");
}

/* ================= O aplikaci ================= */
function renderAbout() {
  return `
    <div class="card center">
      <div style="font-size:44px">💪</div>
      <div class="h2" style="margin-top:8px">Fitness Log</div>
      <p class="muted">Verze ${APP_VERSION}</p>
      <p class="muted" style="text-align:left">
        Osobní deník silových a kardio tréninků a stravy.
        Data se ukládají lokálně v prohlížeči a volitelně synchronizují do Google Sheets.
      </p>
      <p class="small" style="text-align:left">
        Databáze potravin: Open Food Facts (ODbL) a USDA FoodData Central (public domain).
        Odhad 1RM: Epleyho vzorec. Aplikace funguje offline (PWA).
      </p>
    </div>`;
}

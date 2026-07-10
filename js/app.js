/* ===== Router, delegace akcí, inicializace ===== */
"use strict";

const App = {
  route: { tab: "today", page: null }
};

const TITLES = {
  today: "Dnes", workout: "Trénink", food: "Jídlo", summary: "Souhrn",
  exlib: "Exercise Library", templates: "Workout Templates", foodlib: "Food Library",
  export: "Export & Backup", settings: "Nastavení", about: "O aplikaci"
};

function render() {
  const { tab, page } = App.route;
  const key = page || tab;
  document.getElementById("topbarTitle").textContent = TITLES[key] || "Fitness Log";

  const view = document.getElementById("view");
  view.innerHTML = page ? {
    exlib: renderExLib, templates: renderTemplates, foodlib: renderFoodLib,
    export: renderExport, settings: renderSettings, about: renderAbout
  }[page]() : {
    today: renderToday, workout: renderWorkout, food: renderFood, summary: renderSummary
  }[tab]();

  document.querySelectorAll(".navbtn").forEach(b =>
    b.classList.toggle("on", !page && b.dataset.tab === tab));

  wireViewInputs();
  window.scrollTo(0, 0);
}

/* Inputy, které potřebují živé wiring po překreslení */
function wireViewInputs() {
  const el = document.getElementById("elSearch");
  if (el) {
    el.addEventListener("input", () => {
      MV.exQuery = el.value;
      const list = document.getElementById("elList");
      if (list) list.innerHTML = elListHtml();
    });
  }
}

function openDrawer(open) {
  document.getElementById("drawer").classList.toggle("open", open);
  document.getElementById("drawerBackdrop").classList.toggle("open", open);
}

/* ===== Undo — mazání bez potvrzovacích dialogů =====
   Před destruktivní operací se uloží snapshot stavu; toast nabídne Vrátit. */
let UNDO_SNAP = null;
function withUndo(msg, fn) {
  const snap = JSON.stringify(S);
  fn();
  save();
  render();
  UNDO_SNAP = snap;
  toast(msg, "", { label: "Vrátit", act: "app-undo" });
}

/* ===== Akce (event delegation přes data-act) ===== */
const ACTIONS = {
  /* navigace */
  "nav": d => { App.route = { tab: d.tab, page: null }; closeModal(); render(); },
  "menu": d => { App.route.page = d.page; openDrawer(false); render(); },
  "drawer-open": () => openDrawer(true),
  "drawer-close": () => openDrawer(false),
  "modal-close": () => closeModal(),
  "app-undo": () => {
    if (!UNDO_SNAP) return;
    replaceState(JSON.parse(UNDO_SNAP));
    UNDO_SNAP = null;
    save();
    render();
    toast("Obnoveno ✓", "ok");
  },
  "app-reload": () => location.reload(),

  /* sjednocený kalendář (Souhrn) */
  "cal-nav": d => {
    let m = SV.calM + Number(d.dir), y = SV.calY;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    SV.calM = m; SV.calY = y;
    render();
  },
  "sum-cal-day": d => openDaySummary(d.date),
  "sum-add-food": d => {
    FV.date = d.date;
    App.route = { tab: "food", page: null };
    closeModal();
    render();
    openAddFood("search");
  },

  /* tělesná váha */
  "bw-open": () => openBodyWeightModal(),
  "bw-save": () => saveBodyWeight(),

  /* ---- Trénink ---- */
  "w-sub": d => { WV.sub = d.sub; render(); },
  "w-day-nav": d => { WV.date = addDays(WV.date, Number(d.dir)); render(); },
  "w-day-today": () => { WV.date = todayStr(); render(); },
  "w-begin": d => beginWorkout(d.template === "custom" ? null : d.template),
  "w-cardio": () => openCardioModal(),
  "w-cardio-save": () => saveCardio(),
  "w-sport-chip": d => {
    WV.sportChoice = d.sport;
    document.querySelectorAll(".sportchip").forEach(c =>
      c.classList.toggle("on", c.dataset.sport === d.sport));
  },
  "w-add-set": d => addSet(Number(d.i)),
  "w-del-set": d => {
    S.activeSession.entries[Number(d.i)].sets.splice(Number(d.j), 1);
    save(); render();
  },
  "w-remove-ex": d => {
    S.activeSession.entries.splice(Number(d.i), 1);
    save(); render();
  },
  "w-swap-ex": d => openExercisePicker(Number(d.i)),
  "w-add-ex": () => openExercisePicker(null),
  "w-pick-ex": d => {
    const a = S.activeSession;
    if (!a) { closeModal(); return; }
    if (a.entries.some(e => e.exerciseId === d.exid)) { toast("Cvik už v tréninku je", "err"); return; }
    if (WV.pickerIndex == null) {
      a.entries.push({ exerciseId: d.exid, sets: [] });
    } else {
      a.entries[WV.pickerIndex] = { exerciseId: d.exid, sets: [] };
    }
    save(); closeModal(); render();
  },
  "w-finish": () => finishWorkout(),
  "w-cancel": () => withUndo("Trénink zrušen", () => { S.activeSession = null; }),
  "w-pr-history": d => openPRHistory(d.exid),
  "w-detail": d => openSessionDetail(d.id),
  "w-del-session": d => withUndo("Trénink smazán", () => {
    S.sessions = S.sessions.filter(s => s.id !== d.id);
    markDeleted(d.id);
    closeModal();
  }),

  /* ---- Jídlo ---- */
  "f-day-nav": d => {
    FV.date = addDays(FV.date, Number(d.dir));
    render();
  },
  "f-day-today": () => { FV.date = todayStr(); render(); },
  "f-add": () => openAddFood("search"),
  "f-modal-tab": d => openAddFood(d.tab),
  "f-photo-pick": () => document.getElementById("photoInput").click(),
  "f-scan": () => runLabelScan(false),
  "f-scan-meal": () => runLabelScan(true),
  "f-barcode": () => document.getElementById("barcodeInput").click(),
  "f-pick-recipe": d => pickRecipe(d.id),
  "f-copy-open": () => openCopyModal(),
  "f-copy-chip": d => {
    FV.copyMeal = d.meal;
    document.querySelectorAll(".copychip").forEach(c =>
      c.classList.toggle("on", c.dataset.meal === d.meal));
  },
  "f-copy-do": () => doCopyDay(),
  "f-meal-chip": d => {
    FV.mealChoice = d.meal || null;
    document.querySelectorAll(".mealchip").forEach(c =>
      c.classList.toggle("on", (c.dataset.meal || "") === (d.meal || "")));
  },
  "f-pick": d => openAmountStep(FV.results[Number(d.i)]),
  "f-pick-fav": d => { const f = getFood(d.id); if (f) openAmountStep(f); },
  "f-manual-next": () => manualFoodNext(),
  "f-amount-save": () => saveAmount(),
  "f-entry-edit": d => editFoodEntry(d.id),
  "f-entry-del": d => withUndo("Záznam smazán", () => {
    S.foodLog = S.foodLog.filter(e => e.id !== d.id);
    markDeleted(d.id);
  }),

  /* ---- Souhrn ---- */
  "s-range": d => { SV.range = d.range; render(); },

  /* ---- Exercise Library ---- */
  "el-cat": d => { MV.exCat = d.cat; render(); },
  "el-detail": d => openExerciseDetail(d.id),
  "el-add": () => openExerciseForm(null),
  "el-edit": d => openExerciseForm(d.id),
  "el-save": d => saveExercise(d.id || null),
  "el-del": d => withUndo("Cvik smazán", () => {
    // zapeč jméno do historie, ať se v detailech tréninků dál zobrazuje
    const name = exName(d.id);
    for (const s of S.sessions) {
      for (const en of s.entries || []) {
        if (en.exerciseId === d.id) en.exerciseName = name;
      }
    }
    S.exercises = S.exercises.filter(e => e.id !== d.id);
    for (const t of S.templates) t.exercises = t.exercises.filter(x => x !== d.id);
    markDeleted(d.id);
    closeModal();
  }),

  /* ---- Workout Templates ---- */
  "tpl-new": () => openTemplateNameModal(null),
  "tpl-rename": d => openTemplateNameModal(d.tpl),
  "tpl-name-save": d => {
    const name = document.getElementById("tplName").value.trim();
    if (!name) { toast("Zadej název šablony", "err"); return; }
    if (d.tpl) {
      const t = getTemplate(d.tpl);
      if (t) t.name = name;
    } else {
      S.templates.push({ id: uid(), name, exercises: [] });
    }
    save(); closeModal(); render();
    toast("Šablona uložena ✓", "ok");
  },
  "tpl-del": d => withUndo("Šablona smazána", () => {
    S.templates = S.templates.filter(t => t.id !== d.tpl);
    markDeleted(d.tpl);
  }),
  "tpl-add": d => openTplPicker(d.tpl),
  "tpl-pick": d => {
    const t = getTemplate(MV.tplTarget);
    if (t && !t.exercises.includes(d.exid)) t.exercises.push(d.exid);
    save(); closeModal(); render();
  },
  "tpl-move": d => {
    const t = getTemplate(d.tpl);
    const i = Number(d.i), j = i + Number(d.dir);
    if (!t || j < 0 || j >= t.exercises.length) return;
    [t.exercises[i], t.exercises[j]] = [t.exercises[j], t.exercises[i]];
    save(); render();
  },
  "tpl-rm": d => {
    const t = getTemplate(d.tpl);
    if (t) t.exercises.splice(Number(d.i), 1);
    save(); render();
  },

  /* ---- Food Library ---- */
  "fl-star": d => {
    const f = getFood(d.id);
    if (f) f.isFavorite = !f.isFavorite;
    save(); render();
  },
  "fl-edit": d => openFoodEdit(d.id),
  "fl-save": d => saveFoodEdit(d.id),
  "fl-del": d => withUndo("Potravina odebrána", () => {
    S.foods = S.foods.filter(f => f.id !== d.id);
    markDeleted(d.id);
  }),

  /* ---- Recepty ---- */
  "rl-new": () => openRecipeForm(null),
  "rl-edit": d => openRecipeForm(d.id),
  "rl-del": d => withUndo("Recept smazán", () => {
    S.recipes = S.recipes.filter(r => r.id !== d.id);
    markDeleted(d.id);
  }),
  "rc-add-item": () => { captureRecipeForm(); renderRecipePicker(); },
  "rc-pick": d => { MV.rcPickId = d.id; renderRecipeGrams(); },
  "rc-item-add": () => {
    const grams = parseDec(document.getElementById("rcGrams").value);
    if (!grams || grams <= 0) { toast("Zadej gramy", "err"); return; }
    MV.rc.items.push({ foodItemId: MV.rcPickId, grams });
    renderRecipeModal();
  },
  "rc-item-rm": d => { captureRecipeForm(); MV.rc.items.splice(Number(d.i), 1); renderRecipeModal(); },
  "rc-back": () => renderRecipeModal(),
  "rc-save": () => saveRecipe(),

  /* ---- Export / Nastavení ---- */
  "exp-share": () => exportShare(),
  "exp-json": () => downloadFile(`fitness-log-${todayStr()}.json`, JSON.stringify(S, null, 2), "application/json"),
  "exp-md": () => downloadFile(`fitness-log-${todayStr()}.md`, buildMarkdown(), "text/markdown"),
  "exp-import": () => importBackup(),
  "set-save": () => saveSettings(),
  "set-sync-now": async () => {
    const inp = document.getElementById("setGas");
    if (inp) Settings.set({ gasWebAppUrl: inp.value.trim() });
    if (!Sync.url()) { toast("Nejdřív vyplň sync URL", "err"); return; }
    const ok = await Sync.cloudSave();
    toast(ok ? "Uloženo do cloudu ✓" : "Sync selhal: " + (Sync.lastError || ""), ok ? "ok" : "err");
    render();
  },
  "set-sync-load": async () => {
    const inp = document.getElementById("setGas");
    if (inp) Settings.set({ gasWebAppUrl: inp.value.trim() });
    if (!Sync.url()) { toast("Nejdřív vyplň sync URL", "err"); return; }
    const ok = await Sync.cloudLoad();
    toast(ok ? "Načteno z cloudu ✓" : "Sync selhal: " + (Sync.lastError || ""), ok ? "ok" : "err");
    render();
  }
};

document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]");
  if (!t) return;
  const fn = ACTIONS[t.dataset.act];
  if (fn) fn(t.dataset, t, e);
});

document.addEventListener("change", e => {
  const t = e.target.closest("[data-change]");
  if (!t) return;
  if (t.dataset.change === "s-exercise") { SV.exerciseId = t.value; render(); }
  if (t.dataset.change === "f-date") {
    if (t.value) { FV.date = t.value; render(); }
  }
  if (t.dataset.change === "w-date") {
    if (t.value) { WV.date = t.value; render(); }
  }
  if (t.dataset.change === "f-unit") {
    // přepnutí jednotek znovu otevře krok množství se zachovanou volbou jídla dne
    const meal = FV.mealChoice;
    openAmountStep(FV.pending, FV.pendingExisting, t.value);
    FV.mealChoice = meal;
    document.querySelectorAll(".mealchip").forEach(c =>
      c.classList.toggle("on", (c.dataset.meal || "") === (meal || "")));
  }
});

document.getElementById("modalBackdrop").addEventListener("click", closeModal);
document.addEventListener("staterefresh", render);
document.addEventListener("syncstatus", () => {
  if (App.route.page === "settings") render();
});

/* ===== Start ===== */
render();
Sync.init();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("sw.js").then(reg => {
    // upozornění na novou verzi appky (soubory se stáhly, projeví se po obnovení)
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) {
          toast("K dispozici je nová verze appky", "", { label: "Obnovit", act: "app-reload" });
        }
      });
    });
  }).catch(e => console.warn("SW:", e));
}

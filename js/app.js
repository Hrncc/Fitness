/* ===== Router, delegace akcí, inicializace ===== */
"use strict";

const App = {
  route: { tab: "today", page: null }
};

const TITLES = {
  today: "Dnes", workout: "Trénink", food: "Jídlo", summary: "Týden",
  exlib: "Exercise Library", templates: "Workout Templates", foodlib: "Food Library",
  photos: "Fotky postupu", checkin: "Týdenní check-in", coach: "Zeptej se",
  export: "Export & Backup", settings: "Nastavení", about: "O aplikaci"
};

function render() {
  const { tab, page } = App.route;
  const key = page || tab;
  document.getElementById("topbarTitle").textContent = TITLES[key] || "Fitness Log";

  const view = document.getElementById("view");
  view.innerHTML = page ? {
    exlib: renderExLib, templates: renderTemplates, foodlib: renderFoodLib,
    photos: renderPhotos, checkin: renderCheckin, coach: renderCoach,
    export: renderExport, settings: renderSettings, about: renderAbout
  }[page]() : {
    today: renderToday, workout: renderWorkout, food: renderFood, summary: renderSummary
  }[tab]();

  document.querySelectorAll(".navbtn").forEach(b =>
    b.classList.toggle("on", !page && !!b.dataset.tab && b.dataset.tab === tab));

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
  const qrIn = document.getElementById("qrScanInput");
  if (qrIn) {
    qrIn.addEventListener("change", () => {
      if (qrIn.files && qrIn.files[0]) importQrFile(qrIn.files[0]);
    });
  }
  const coIn = document.getElementById("coInput");
  if (coIn) coIn.addEventListener("input", () => { CO.draft = coIn.value; });
  const phIn = document.getElementById("photoAddInput");
  if (phIn) {
    phIn.addEventListener("change", () => {
      if (phIn.files && phIn.files[0]) openPhotoSaveModal(phIn.files[0]);
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
  "nav": d => { App.route = { tab: d.tab, page: null }; closeModal(); openDrawer(false); render(); },
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
  /* zápis tréninku přímo ze dne v kalendáři */
  "sum-add-workout": d => {
    WV.date = d.date;
    WV.sub = "log";
    App.route = { tab: "workout", page: null };
    closeModal();
    if (S.activeSession) {
      render();
      toast("Nejdřív dokonči nebo zruš probíhající trénink", "err");
      return;
    }
    beginWorkout(d.tpl === "custom" ? null : d.tpl);
  },
  "sum-add-cardio": d => {
    WV.date = d.date;
    WV.sub = "log";
    App.route = { tab: "workout", page: null };
    closeModal();
    render();
    openCardioModal();
  },

  /* tělesná váha */
  "bw-open": d => openBodyWeightModal(d.date || null),
  "bw-save": d => saveBodyWeight(d.date || null),

  /* ---- Dnes: denní seznam ---- */
  "t-w-step": d => {
    TV.wDraft = Math.round((TV.wDraft + Number(d.d)) * 10) / 10;
    if (TV.wDraft < 20) TV.wDraft = 20;
    render();
  },
  "t-w-save": () => {
    const kg = kgIn(String(TV.wDraft));
    if (kg == null || kg <= 0) { toast("Zadej platnou váhu", "err"); return; }
    logBodyWeight(kg, todayStr());
    TV.wDraft = null;
    save(); render();
    toast("Váha zapsána ✓", "ok");
  },
  "t-food-rating": d => {
    logDayRating(todayStr(), d.v, undefined);
    save(); render();
  },
  "t-food-protein": d => {
    logDayRating(todayStr(), undefined, d.v === "1");
    save(); render();
  },
  "t-food-reset": () => {
    S.dayLog = (S.dayLog || []).filter(x => x.date !== todayStr());
    save(); render();
    toast("Zápis jídla smazán", "");
  },
  "t-begin-next": d => {
    WV.date = todayStr();
    WV.sub = "log";
    App.route = { tab: "workout", page: null };
    if (S.activeSession) { render(); toast("Nejdřív dokonči nebo zruš probíhající trénink", "err"); return; }
    beginWorkout(d.template);
  },

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
  "w-counter": () => { WV.counterOpen = !WV.counterOpen; render(); },
  "w-step": d => {
    const el = document.getElementById(d.id);
    if (!el) return;
    const step = Number(d.d);
    const cur = parseDec(el.value);
    let v = (cur == null ? 0 : cur) + step;
    if (v < 0) v = 0;
    // celá čísla u opakování, desetina u váhy
    el.value = Number.isInteger(step) ? String(Math.round(v)) : fmtNum(Math.round(v * 10) / 10, 1);
  },
  "w-add-set": d => addSet(Number(d.i)),
  "w-del-set": d => {
    S.activeSession.entries[Number(d.i)].sets.splice(Number(d.j), 1);
    save(); render();
  },
  "w-remove-ex": d => {
    S.activeSession.entries.splice(Number(d.i), 1);
    WV.openIdx = null; // indexy se posunuly
    save(); render();
  },
  "w-swap-ex": d => openExercisePicker(Number(d.i)),
  /* akordeon: rozbalený je vždy nejvýš jeden cvik */
  "w-ex-open": d => {
    const i = Number(d.i);
    WV.openIdx = WV.openIdx === i ? null : i;
    render();
    const el = document.getElementById("exblock-" + i);
    if (el && WV.openIdx === i) el.scrollIntoView({ block: "center", behavior: "smooth" });
  },
  "w-ex-close": () => { WV.openIdx = null; render(); },
  "w-ex-done": d => {
    S.activeSession.entries[Number(d.i)].done = true;
    WV.openIdx = null;   // po dokončení se cvik sbalí
    save(); render();
  },
  "w-add-ex": () => openExercisePicker(null),
  "w-pick-ex": d => {
    const a = S.activeSession;
    if (!a) { closeModal(); return; }
    if (a.entries.some(e => e.exerciseId === d.exid)) { toast("Cvik už v tréninku je", "err"); return; }
    if (WV.pickerIndex == null) {
      a.entries.push({ exerciseId: d.exid, sets: [] });
      WV.openIdx = a.entries.length - 1;   // nový cvik rovnou rozbal
    } else {
      a.entries[WV.pickerIndex] = { exerciseId: d.exid, sets: [] };
      WV.openIdx = WV.pickerIndex;
    }
    save(); closeModal(); render();
  },
  "w-finish": () => finishWorkout(),
  "w-rate-chip": d => {
    WV.rateVal = Number(d.val);
    document.querySelectorAll(".ratechip").forEach(c =>
      c.classList.toggle("on", Number(c.dataset.val) === WV.rateVal));
  },
  "w-rate-save": d => {
    const s = S.sessions.find(x => x.id === d.id);
    if (s) {
      s.rating = WV.rateVal || null;
      s.note = document.getElementById("rateNote").value.trim() || null;
      save();
    }
    closeModal();
    toast("Hodnocení uloženo ✓", "ok");
  },

  /* ---- Rest timer ---- */
  "rest-plus": () => Rest.adjust(30),
  "rest-minus": () => Rest.adjust(-30),
  "rest-stop": () => Rest.stop(),
  "w-cancel": () => withUndo("Trénink zrušen", () => { S.activeSession = null; WV.openIdx = null; }),
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
  "s-sub": d => { SV.sub = d.sub; render(); },
  "s-cat-range": d => { SV.catRange = d.range; render(); },

  /* ---- Zeptej se (AI nad daty) ---- */
  "co-send": () => {
    const el = document.getElementById("coInput");
    askCoach(el ? el.value : "");
  },
  "co-preset": d => askCoach(d.q),
  "co-clear": () => { CO.messages = []; CO.error = null; CO.draft = ""; render(); },

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
  /* akordeon: rozbalená je vždy nejvýš jedna šablona */
  "tpl-open": d => { MV.tplOpen = MV.tplOpen === d.tpl ? null : d.tpl; render(); },
  "tpl-new": () => openTemplateNameModal(null),
  "tpl-rename": d => openTemplateNameModal(d.tpl),
  "tpl-name-save": d => {
    const name = document.getElementById("tplName").value.trim();
    if (!name) { toast("Zadej název šablony", "err"); return; }
    if (d.tpl) {
      const t = getTemplate(d.tpl);
      if (t) t.name = name;
    } else {
      const id = uid();
      S.templates.push({ id, name, exercises: [] });
      MV.tplOpen = id;
    }
    save(); closeModal(); render();
    toast("Šablona uložena ✓", "ok");
  },
  "tpl-del": d => withUndo("Šablona smazána", () => {
    S.templates = S.templates.filter(t => t.id !== d.tpl);
    markDeleted(d.tpl);
    if (MV.tplOpen === d.tpl) MV.tplOpen = null;
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
  /* ---- Fotky postupu ---- */
  "ph-add": () => document.getElementById("photoAddInput").click(),
  "ph-save": () => savePhoto(),
  "ph-detail": d => openPhotoDetail(d.id),
  "ph-del": d => deletePhoto(d.id),
  "ph-download": d => downloadPhoto(d.id),

  /* ---- Týdenní check-in ---- */
  "ci-new": () => openCheckinForm(null),
  "ci-edit": d => openCheckinForm(d.id),
  "ci-cancel": () => { CV.form = null; CV.editId = null; render(); },
  "ci-scale": d => {
    captureCheckinForm();
    const key = d.key, val = Number(d.val);
    CV.form.scales[key] = CV.form.scales[key] === val ? undefined : val;
    if (CV.form.scales[key] === undefined) delete CV.form.scales[key];
    render();
  },
  "ci-save": () => saveCheckin(),
  "ci-copy": d => copyCheckin(d.id),
  "ci-del": d => withUndo("Check-in smazán", () => {
    S.checkins = S.checkins.filter(c => c.id !== d.id);
    markDeleted(d.id);
    CV.form = null; CV.editId = null;
  }),

  /* ---- Týdenní rekap ---- */
  "recap-dismiss": d => { Settings.set({ recapDismissed: d.week }); render(); },

  "set-qr-show": () => openQrExport(),
  "set-qr-scan": () => document.getElementById("qrScanInput").click(),
  /* ---- Report pro Clauda ---- */
  "rep-range": d => { MV.reportRange = d.range; render(); },
  "rep-copy": () => copyReport(),
  "rep-share": () => shareReport(),
  "rep-preview": () => showReportModal(buildCoachReport(MV.reportRange)),

  "exp-share": () => exportShare(),
  "exp-json": () => downloadFile(`fitness-log-${todayStr()}.json`, JSON.stringify(S, null, 2), "application/json"),
  "exp-md": () => downloadFile(`fitness-log-${todayStr()}.md`, buildMarkdown(reportRangeArg()), "text/markdown"),
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
  /* vlastní rozsahy „od–do": konec se posune, aby nešel před začátek */
  if (t.dataset.change === "rep-from" && t.value) {
    MV.repFrom = t.value;
    if (MV.repTo < MV.repFrom) MV.repTo = MV.repFrom;
    render();
  }
  if (t.dataset.change === "rep-to" && t.value) {
    MV.repTo = t.value;
    if (MV.repFrom > MV.repTo) MV.repFrom = MV.repTo;
    render();
  }
  if (t.dataset.change === "cat-from" && t.value) {
    SV.catFrom = t.value;
    if (SV.catTo < SV.catFrom) SV.catTo = SV.catFrom;
    render();
  }
  if (t.dataset.change === "cat-to" && t.value) {
    SV.catTo = t.value;
    if (SV.catFrom > SV.catTo) SV.catFrom = SV.catTo;
    render();
  }
  if (t.dataset.change === "ph-cmp-a") { PV.cmpA = t.value; render(); }
  if (t.dataset.change === "ph-cmp-b") { PV.cmpB = t.value; render(); }
  if (t.dataset.change === "ci-trend") { CV.trendKey = t.value; render(); }
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
Rest.init();

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

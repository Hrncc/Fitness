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

/* ===== Akce (event delegation přes data-act) ===== */
const ACTIONS = {
  /* navigace */
  "nav": d => { App.route = { tab: d.tab, page: null }; closeModal(); render(); },
  "menu": d => { App.route.page = d.page; openDrawer(false); render(); },
  "drawer-open": () => openDrawer(true),
  "drawer-close": () => openDrawer(false),
  "modal-close": () => closeModal(),

  /* kalendáře (trénink i jídlo) */
  "cal-nav": d => {
    const st = App.route.tab === "food" ? FV : WV;
    let m = st.calM + Number(d.dir), y = st.calY;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    st.calM = m; st.calY = y;
    render();
  },

  /* ---- Trénink ---- */
  "w-sub": d => { WV.sub = d.sub; render(); },
  "w-begin": d => beginWorkout(d.template === "custom" ? null : d.template),
  "w-cardio": () => openCardioModal(),
  "w-cardio-save": () => saveCardio(),
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
  "w-cancel-ask": () => confirmModal("Zrušit rozpracovaný trénink? Zapsané série se zahodí.", "w-cancel-yes", "", "Zahodit"),
  "w-cancel-yes": () => {
    S.activeSession = null;
    save(); closeModal(); render();
    toast("Trénink zrušen");
  },
  "w-pr-history": d => openPRHistory(d.exid),
  "w-cal-day": d => openDayWorkouts(d.date),
  "w-detail": d => openSessionDetail(d.id),
  "w-del-session": d => confirmModal("Smazat tento trénink? Ovlivní to i historii rekordů.", "w-del-session-yes", `data-id="${d.id}"`),
  "w-del-session-yes": d => {
    S.sessions = S.sessions.filter(s => s.id !== d.id);
    save(); closeModal(); render();
    toast("Trénink smazán");
  },

  /* ---- Jídlo ---- */
  "f-sub": d => { FV.sub = d.sub; render(); },
  "f-add": () => { FV.mealPreset = null; openAddFood("search"); },
  "f-add-meal": d => { FV.mealPreset = d.meal; openAddFood("search"); },
  "f-modal-tab": d => openAddFood(d.tab),
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
  "f-entry-del": d => {
    S.foodLog = S.foodLog.filter(e => e.id !== d.id);
    save(); render();
    toast("Záznam smazán");
  },
  "f-cal-day": d => openDayFood(d.date),

  /* ---- Souhrn ---- */
  "s-range": d => { SV.range = d.range; render(); },

  /* ---- Exercise Library ---- */
  "el-cat": d => { MV.exCat = d.cat; render(); },
  "el-detail": d => openExerciseDetail(d.id),
  "el-add": () => openExerciseForm(null),
  "el-edit": d => openExerciseForm(d.id),
  "el-save": d => saveExercise(d.id || null),
  "el-del-ask": d => confirmModal("Smazat vlastní cvik? Odebere se i ze šablon.", "el-del-yes", `data-id="${d.id}"`),
  "el-del-yes": d => deleteExercise(d.id),

  /* ---- Workout Templates ---- */
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
  "fl-del-ask": d => confirmModal("Odebrat potravinu z knihovny? Zapsaná jídla zůstanou.", "fl-del-yes", `data-id="${d.id}"`),
  "fl-del-yes": d => {
    S.foods = S.foods.filter(f => f.id !== d.id);
    save(); closeModal(); render();
    toast("Potravina odebrána");
  },

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
  navigator.serviceWorker.register("sw.js").catch(e => console.warn("SW:", e));
}

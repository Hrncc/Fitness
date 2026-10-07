/* ===== Router, delegace akcí, inicializace ===== */
"use strict";

/* Navigace v2: čtyři karty dole (Dnes · Trénink · Pokrok · Více) a stránky,
   které se otevírají „nad" aktuální kartou se šipkou zpět (page). */
const App = {
  route: { tab: "today", page: null }
};

const TITLES = {
  today: "Dnes", workout: "Trénink", progress: "Pokrok",
  food: "Jídlo", history: "Historie", records: "Rekordy", checkin: "Check-in",
  exlib: "Exercise Library", templates: "Workout Templates", foodlib: "Food Library",
  export: "Export & Backup", settings: "Nastavení", about: "O aplikaci"
};

/* Velký titulek stránky (iOS large title) — nad obsahem každé obrazovky.
   Malá verze v top baru se objeví, až velký odjede nahoru. Obrazovka může
   dodat nadtitulek, podtitulek (HTML), tlačítka vpravo a obsah pod. */
function pageHead(key) {
  if (key === "today") return todayHead();
  if (key === "workout") return workoutHead();
  if (key === "progress") return progressHead();
  if (key === "checkin") return { title: CV.editId ? "Upravit check-in" : "Nový check-in" };
  if (key === "records") return { title: "Rekordy", sub: "Osobní maxima podle odhadu 1RM" };
  if (key === "history") return { title: "Historie", sub: "Tréninky po měsících" };
  return { title: TITLES[key] || "Fitness Log" };
}

function pageHeadHtml(h) {
  return `
    <header class="page-head">
      <div class="grow">
        ${h.eyebrow ? `<div class="eyebrow">${h.eyebrow}</div>` : ""}
        <h1>${esc(h.title)}</h1>
        ${h.sub ? `<p class="sub">${h.sub}</p>` : ""}
        ${h.below || ""}
      </div>
      ${h.right ? `<div class="head-right">${h.right}</div>` : ""}
    </header>`;
}

const PAGES = {
  food: () => renderFood(), history: () => renderHistory(), records: () => renderPRList(),
  checkin: () => renderCheckinForm(),
  exlib: () => renderExLib(), templates: () => renderTemplates(), foodlib: () => renderFoodLib(),
  export: () => renderExport(), settings: () => renderSettings(), about: () => renderAbout()
};
const TABS = {
  today: () => renderToday(), workout: () => renderWorkout(), progress: () => renderProgress()
};

/* Nahoru se skočí jen při přechodu na jinou obrazovku (nebo s {top: true}).
   Dřív se scrollovalo po každém překreslení — přidání série v tréninku
   pak vyhodilo obrazovku na začátek. */
let _lastRouteKey = null;

function render(opts = {}) {
  const { tab, page } = App.route;
  const key = page || tab;
  const head = pageHead(key);
  document.getElementById("topbarTitle").textContent = head.title;
  document.getElementById("topbar").classList.toggle("has-back", !!page);

  const view = document.getElementById("view");
  view.innerHTML = pageHeadHtml(head) + (page ? PAGES[page]() : TABS[tab]());

  document.querySelectorAll(".navbtn").forEach(b =>
    b.classList.toggle("on", !!b.dataset.tab && b.dataset.tab === tab));

  wireViewInputs();
  Dock.sync();
  const changed = key !== _lastRouteKey;
  if (opts.top || changed) window.scrollTo(0, 0);
  if (changed) {   // jemný nájezd nové obrazovky
    view.classList.remove("enter");
    void view.offsetWidth;
    view.classList.add("enter");
  }
  _lastRouteKey = key;
  updateTopbar();
}

/* Přechody */
function goTab(tab, opts = {}) {
  App.route = { tab, page: null };
  closeModal();
  render({ top: true, ...opts });
}
function goPage(page) {
  App.route = { tab: App.route.tab, page };
  closeModal();
  render({ top: true });
}

/* Top bar zesklovatí a ukáže malý titulek, jakmile velký odjede.
   Lepkavý panel s hledáním (Exercise Library) dostane sklo, až se přilepí. */
function updateTopbar() {
  const bar = document.getElementById("topbar");
  bar.classList.toggle("scrolled", window.scrollY > 38);
  const sticky = document.querySelector(".sticky-bar");
  if (sticky) sticky.classList.toggle("stuck", sticky.getBoundingClientRect().top <= bar.offsetHeight + 1);
}
window.addEventListener("scroll", updateTopbar, { passive: true });

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
  const ciPh = document.getElementById("ciPhotoInput");
  if (ciPh) {
    ciPh.addEventListener("change", () => {
      if (!ciPh.files || !ciPh.files[0]) return;
      captureCheckinForm();
      setCheckinPhoto(ciPh.files[0]);
      render();
    });
  }
  const phIn = document.getElementById("photoAddInput");
  if (phIn) {
    phIn.addEventListener("change", () => {
      if (phIn.files && phIn.files[0]) openPhotoSaveModal(phIn.files[0]);
    });
  }
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

/* Trénink k jinému dni (kalendář, detail dne) — šablona se spustí rovnou
   s datem daného dne */
function startWorkoutOn(date, tpl) {
  WV.date = date;
  App.route = { tab: "workout", page: null };
  closeModal();
  if (S.activeSession) {
    render({ top: true });
    toast("Nejdřív dokonči nebo zruš probíhající trénink", "err");
    return;
  }
  beginWorkout(tpl === "custom" ? null : tpl);
  render({ top: true });
}

/* ===== Akce (event delegation přes data-act) ===== */
const ACTIONS = {
  /* navigace */
  "nav": d => goTab(d.tab),
  "menu": d => goPage(d.page),
  "page-back": () => {
    if (App.route.page === "checkin") { CV.form = null; CV.editId = null; clearCheckinPhoto(); }
    App.route.page = null;
    render({ top: true });
  },
  "more-open": () => openMoreSheet(),
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
  /* Pokrok s vybraným segmentem (z Dnes) */
  "go-progress": d => { if (d.seg) PG.seg = d.seg; goTab("progress"); },

  /* kalendář (Historie) */
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
    goPage("food");
    openAddFood("search");
  },
  /* zápis tréninku přímo ze dne v kalendáři */
  "sum-add-workout": d => startWorkoutOn(d.date, d.tpl),
  "sum-add-cardio": d => {
    WV.date = d.date;
    goTab("workout");
    openCardioModal();
  },

  /* tělesná váha */
  "bw-open": d => openBodyWeightModal(d.date || null),
  "bw-save": d => saveBodyWeight(d.date || null),

  /* ---- Dnes ---- */
  "td-open": d => { TV.open = todayOpenKey() === d.k ? "none" : d.k; render(); },
  "td-week": d => { TV.weekOff = Math.min(0, TV.weekOff + Number(d.dir)); render(); },
  "td-cal": () => { toggleTodayCal(); render(); },
  "td-month": d => { shiftTodayMonth(Number(d.dir)); render(); },
  "t-w-step": d => {
    TV.wDraft = Math.round((TV.wDraft + Number(d.d)) * 10) / 10;
    if (TV.wDraft < 20) TV.wDraft = 20;
    render();
  },
  "t-w-save": () => {
    const kg = kgIn(String(TV.wDraft));
    if (kg == null || kg <= 0) { toast("Zadej platnou váhu", "err"); return; }
    const day = TV.wDate && TV.wDate < todayStr() ? TV.wDate : todayStr();
    logBodyWeight(kg, day);
    TV.wDraft = null;
    TV.wDate = null;
    if (TV.open === "weight") TV.open = null;
    save(); render();
    toast(day === todayStr() ? "Váha zapsána ✓" : `Váha zapsána k ${fmtDate(day)} ✓`, "ok");
  },
  "t-w-date-reset": () => { TV.wDate = null; TV.wDraft = null; render(); },
  "t-food-rating": d => {
    logDayRating(todayStr(), d.v, undefined);
    save(); render();
  },
  "t-food-protein": d => {
    logDayRating(todayStr(), undefined, d.v === "1");
    // po obou odpovědích se položka sbalí
    const r = dayRating(todayStr());
    if (r && r.foodRating && r.proteinOk != null && TV.open === "food") TV.open = null;
    save(); render();
  },
  "t-food-reset": () => withUndo("Zápis jídla smazán", () => {
    S.dayLog = (S.dayLog || []).filter(x => x.date !== todayStr());
    TV.open = "food";
  }),
  "t-begin-next": d => {
    WV.date = todayStr();
    App.route = { tab: "workout", page: null };
    if (S.activeSession) { render({ top: true }); toast("Nejdřív dokonči nebo zruš probíhající trénink", "err"); return; }
    beginWorkout(d.template);
    render({ top: true });
  },
  "recap-dismiss": d => { Settings.set({ recapDismissed: d.week }); render(); },

  /* ---- Trénink ---- */
  "w-date-today": () => { WV.date = todayStr(); render(); },
  "w-begin": d => beginWorkout(d.template === "custom" ? null : d.template),
  "w-cardio": () => openCardioModal(),
  "w-cardio-edit": d => openCardioModal(d.id),
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
    // prázdné pole (cvik bez historie) dává z parseDec NaN, ne null
    const cur = parseDec(el.value);
    let v = (Number.isFinite(cur) ? cur : 0) + step;
    if (v < 0) v = 0;
    // celá čísla u opakování, desetina u váhy
    el.value = Number.isInteger(step) ? String(Math.round(v)) : fmtNum(Math.round(v * 10) / 10, 1);
  },
  "w-add-set": d => addSet(Number(d.i)),
  "w-del-set": d => withUndo("Série smazána", () => {
    const e = S.activeSession.entries[Number(d.i)];
    e.sets.splice(Number(d.j), 1);
    refreshEntryRecords(S.activeSession, e);
    WV.editSet = null;
  }),
  /* oprava zapsané série — klepnutí na sérii ji načte do polí */
  "w-set-edit": d => {
    const i = Number(d.i), j = Number(d.j);
    WV.editSet = WV.editSet && WV.editSet.i === i && WV.editSet.j === j ? null : { i, j };
    render();
  },
  "w-set-save": d => saveSetEdit(Number(d.i)),
  /* mini check „do selhání" u série */
  "w-set-fail": d => {
    const e = S.activeSession && S.activeSession.entries[Number(d.i)];
    const st = e && e.sets[Number(d.j)];
    if (!st) return;
    // rozepsaná série v polích nesmí překreslením zmizet
    const keep = ["reps", "weight", "note"].map(f => (document.getElementById(`${f}-${d.i}`) || {}).value);
    if (st.failure) delete st.failure; else st.failure = true;
    save(); render();
    ["reps", "weight", "note"].forEach((f, k) => {
      const el = document.getElementById(`${f}-${d.i}`);
      if (el && keep[k] != null) el.value = keep[k];
    });
  },
  "w-set-cancel": () => { WV.editSet = null; render(); },
  /* zpětná úprava uloženého tréninku (detail tréninku) */
  "w-edit-session": d => beginEditSession(d.id),
  "w-rate-open": d => openRatingModal(d.id, true),
  /* core ano/ne — v probíhajícím tréninku i zpětně v detailu */
  "w-core": () => {
    const a = S.activeSession;
    if (!a) return;
    a.core = !a.core;
    save(); render();
  },
  "w-core-session": (d, t) => {
    const s = S.sessions.find(x => x.id === d.id);
    if (!s) return;
    s.core = !(s.core === true);
    t.classList.toggle("on", s.core);
    t.setAttribute("aria-checked", String(s.core));
    save(); render();
  },
  "w-remove-ex": d => withUndo("Cvik odebrán", () => {
    S.activeSession.entries.splice(Number(d.i), 1);
    WV.openIdx = null; // indexy se posunuly
    WV.editSet = null;
    WV.sw = null;
    closeModal();
  }),
  /* nabídka cviku (⋯), superset, připnutá poznámka, stopky */
  "w-ex-menu": d => openExerciseMenu(Number(d.i)),
  "w-link": d => {
    const e = S.activeSession && S.activeSession.entries[Number(d.i)];
    if (!e) return;
    if (e.link) delete e.link; else e.link = true;
    closeModal();
    save(); render();
    toast(e.link ? "Superset s dalším cvikem — pauza až po kole" : "Superset zrušen", "ok");
  },
  "w-pin": d => {
    const e = S.activeSession && S.activeSession.entries[Number(d.i)];
    if (e) openPinModal(e.exerciseId);
  },
  "pin-save": d => {
    const ex = getExercise(d.exid);
    if (!ex) return;
    const v = d.clear ? "" : document.getElementById("pinInput").value.trim();
    if (v) ex.pin = v; else delete ex.pin;
    save(); closeModal(); render();
    toast(v ? "Poznámka připnuta ✓" : "Poznámka odepnuta", "ok");
  },
  "w-sw": d => toggleStopwatch(Number(d.i)),
  /* detail tréninku: zopakovat, uložit jako šablonu */
  "w-repeat": d => repeatSession(d.id),
  "w-save-tpl": d => openSaveTemplateModal(d.id),
  "tpl-from-session": (d, t) => {
    const s = S.sessions.find(x => x.id === d.id);
    const inp = document.getElementById("newTplName");
    const name = inp ? inp.value.trim() : "";
    if (!s) return;
    if (!name) { toast("Zadej název šablony", "err"); return; }
    const tpl = templateFromSession(s, name);
    save();
    toast(`Šablona ${tpl.name} uložena ✓`, "ok");
    if (d.inline) {
      render();
      const card = t.closest(".sum-tpl");
      if (card) card.innerHTML = `<div class="name" style="font-weight:650">${ic("check", 15, 2.6)} Uloženo jako šablona ${esc(tpl.name)}</div>`;
    } else { closeModal(); render(); }
  },
  /* shrnutí: uložit změny z tréninku do šablony */
  "w-tpl-update": (d, t) => {
    if (!updateTemplateFromFinish(d.tpl)) return;
    save(); render();
    const card = t.closest(".sum-tpl");
    if (card) card.innerHTML = `<div class="name" style="font-weight:650">${ic("check", 15, 2.6)} Šablona aktualizována</div>`;
    toast("Šablona aktualizována ✓", "ok");
  },
  "w-swap-ex": d => openExercisePicker(Number(d.i)),
  /* akordeon: rozbalený je vždy nejvýš jeden cvik */
  "w-ex-open": d => {
    const i = Number(d.i);
    WV.openIdx = WV.openIdx === i ? null : i;
    WV.editSet = null;
    render();
    const el = document.getElementById("exblock-" + i);
    if (el && WV.openIdx === i) el.scrollIntoView({ block: "center", behavior: "smooth" });
  },
  "w-ex-close": () => { WV.openIdx = null; WV.editSet = null; render(); },
  /* Hotovo: cvik se sbalí a otevře se další neodcvičený (nejdřív za ním,
     pak od začátku) — v posilovně o klepnutí méně u každého cviku */
  "w-ex-done": d => {
    const i = Number(d.i);
    const list = S.activeSession.entries;
    WV.editSet = null;
    list[i].done = true;
    const order = list.map((_, k) => k).filter(k => k > i).concat(list.map((_, k) => k).filter(k => k < i));
    const next = order.find(k => !list[k].done);
    WV.openIdx = next == null ? null : next;
    save(); render();
    const el = next == null ? null : document.getElementById("exblock-" + next);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  },
  "w-add-ex": () => openExercisePicker(null),
  /* filtr partie ve výběru cviku */
  "pk-cat": d => {
    PK.cat = d.cat;
    refreshPicker(true);
    document.getElementById("modal").scrollTop = 0;
  },
  "w-pick-ex": d => {
    const a = S.activeSession;
    if (!a) { closeModal(); return; }
    if (a.entries.some(e => e.exerciseId === d.exid)) { toast("Cvik už v tréninku je", "err"); return; }
    WV.editSet = null;
    WV.sw = null;
    if (WV.pickerIndex == null) {
      // cíl z plánu šablony (nebo z popisu cviku), při úpravě uloženého bez cíle
      const t = a.editOf ? null : tplPlan(getTemplate(a.templateUsed), d.exid);
      a.entries.push({ exerciseId: d.exid, sets: [], target: t || null });
      WV.openIdx = a.entries.length - 1;   // nový cvik rovnou rozbal
    } else {
      // výměna: náhrada drží místo v plánu (série, rozsah, pauza) i superset
      const old = a.entries[WV.pickerIndex] || {};
      a.entries[WV.pickerIndex] = Object.assign({ exerciseId: d.exid, sets: [] },
        old.target !== undefined ? { target: old.target } : {}, old.link ? { link: true } : {});
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
    render();
    toast("Hodnocení uloženo ✓", "ok");
    if (d.back && s) openSessionDetail(s.id);   // z detailu zpět do detailu
  },

  /* ---- Rest timer (zamčený dock) ---- */
  "rest-start": () => Rest.start(currentRestSeconds() || 120),
  "dock-open": () => {
    closeModal();
    if (App.route.tab === "workout" && !App.route.page) { render(); return; }
    goTab("workout");
  },
  "rest-plus": () => Rest.adjust(30),
  "rest-minus": () => Rest.adjust(-30),
  "rest-stop": () => Rest.stop(),
  "w-cancel": () => withUndo(S.activeSession && S.activeSession.editOf ? "Úpravy zahozeny" : "Trénink zrušen",
    () => { S.activeSession = null; WV.openIdx = null; WV.editSet = null; }),
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

  /* ---- Pokrok ---- */
  "pg-seg": d => { PG.seg = d.seg; render(); },
  "pg-ex": d => openExerciseProgress(d.exid),
  "pg-all": () => { PG.allEx = !PG.allEx; render(); },
  "pg-metric": d => { PG.metric = d.m; render(); },
  "pg-parts": d => { PG.parts = d.v; render(); },
  "pg-wrange": d => { PG.wRange = d.r; render(); },
  "s-cat-range": d => { SV.catRange = d.range; render(); },

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
    toast(`Přidáno: ${exName(d.exid)}`, "ok");
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
    if (t) {
      const [exId] = t.exercises.splice(Number(d.i), 1);
      if (t.plan && exId && !t.exercises.includes(exId)) delete t.plan[exId];
    }
    save(); render();
  },
  /* plán cviku v šabloně: série × rozsah × pauza, superset s dalším */
  "tpl-plan": d => openPlanModal(d.tpl, d.exid),
  "plan-rest": (d, t) => {
    if (!MV.plan) return;
    MV.plan.rest = d.r ? Number(d.r) : null;
    document.querySelectorAll(".planrest").forEach(c => c.classList.toggle("on", c === t));
  },
  "plan-link": (d, t) => {
    if (!MV.plan) return;
    MV.plan.link = !MV.plan.link;
    t.classList.toggle("on", MV.plan.link);
    t.setAttribute("aria-checked", MV.plan.link);
  },
  "plan-save": () => savePlan(),
  "plan-clear": () => savePlan(true),

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

  /* ---- Fotky postupu ---- */
  "ph-add": () => document.getElementById("photoAddInput").click(),
  "ph-save": () => savePhoto(),
  "ph-detail": d => openPhotoDetail(d.id),
  "ph-del": d => deletePhoto(d.id),
  "ph-download": d => downloadPhoto(d.id),

  /* ---- Týdenní check-in ---- */
  "ci-new": () => openCheckinForm(null),
  "ci-edit": d => openCheckinForm(d.id),
  "ci-cancel": () => {
    CV.form = null; CV.editId = null; clearCheckinPhoto();
    if (App.route.page === "checkin") App.route.page = null;
    render({ top: true });
  },
  "ci-photo": () => document.getElementById("ciPhotoInput").click(),
  "ci-trend": d => { CV.trendKey = d.key; render(); },
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
    if (App.route.page === "checkin") App.route.page = null;
  }),

  /* ---- Export / Nastavení ---- */
  "set-qr-show": () => openQrExport(),
  "set-qr-scan": () => document.getElementById("qrScanInput").click(),
  /* ---- Report pro Clauda ---- */
  "rep-range": d => { MV.reportRange = d.range; render(); },
  "rep-copy": () => copyReport(),
  "rep-share": () => shareReport(),
  "rep-preview": () => showReportModal(buildCoachReport(reportRangeArg())),

  "exp-share": () => exportShare(),
  "exp-json": () => downloadFile(`fitness-log-${todayStr()}.json`, JSON.stringify(S, null, 2), "application/json"),
  "exp-md": () => downloadFile(`fitness-log-${todayStr()}.md`, buildMarkdown(reportRangeArg()), "text/markdown"),
  "exp-csv": () => downloadFile(`fitness-log-serie-${todayStr()}.csv`, buildSetsCsv(), "text/csv"),
  "exp-import": () => importBackup(),
  "set-save": () => saveSettings(),
  "set-awake": (d, t) => {
    const on = Settings.get().keepAwake === false;
    Settings.set({ keepAwake: on });
    t.classList.toggle("on", on);
    t.setAttribute("aria-checked", on);
    Dock.sync();
  },
  "set-sync-now": async () => {
    const inp = document.getElementById("setGas");
    if (inp) Settings.set({ gasWebAppUrl: inp.value.trim() });
    if (!Sync.url()) { toast("Nejdřív vyplň sync URL", "err"); return; }
    const ok = await Sync.cloudSave();
    toast(ok ? "Uloženo do cloudu ✓" : "Sync selhal: " + (Sync.lastError || ""), ok ? "ok" : "err");
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
  // úchyt přetahování klik nemá; klik těsně po puštění pošle iOS navíc
  if (e.target.closest(".drag-handle") || Date.now() - Drag.justDropped < 350) return;
  const t = e.target.closest("[data-act]");
  if (!t) return;
  const fn = ACTIONS[t.dataset.act];
  if (fn) fn(t.dataset, t, e);
});

/* Přetahování cviků v tréninku (Drag ve view-workout.js) */
document.addEventListener("pointerdown", e => {
  const h = e.target.closest(".drag-handle");
  if (h) Drag.start(e, h);
});
document.addEventListener("pointermove", e => Drag.move(e));
document.addEventListener("pointerup", e => Drag.end(e));
document.addEventListener("pointercancel", e => Drag.end(e));

document.addEventListener("change", e => {
  const t = e.target.closest("[data-change]");
  if (!t) return;
  if (t.dataset.change === "f-date") {
    if (t.value) { FV.date = t.value; render(); }
  }
  /* datum zápisu váhy na Dnes; u dne, který už váhu má, se předvyplní */
  if (t.dataset.change === "t-w-date" && t.value) {
    TV.wDate = t.value < todayStr() ? t.value : null;
    const w = TV.wDate ? bodyWeightOn(TV.wDate) : null;
    if (w != null) TV.wDraft = Math.round(kgOut(w) * 10) / 10;
    TV.open = "weight";
    render();
  }
  /* datum upravovaného uloženého tréninku */
  if (t.dataset.change === "w-edit-date" && t.value && S.activeSession) {
    S.activeSession.date = t.value;
    save(); render();
  }
  /* den, do kterého se zapisuje trénink (Trénink → pilulka s datem) */
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
  /* sync URL (Export & Backup) se ukládá hned po změně pole */
  if (t.dataset.change === "set-gas") {
    Settings.set({ gasWebAppUrl: t.value.trim() });
    if (!Sync.url()) Sync.setStatus("off");
    toast(Sync.url() ? "Sync URL uložena ✓" : "Sync vypnutý", "ok");
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

/* iOS ignoruje user-scalable=no v některých režimech — pinch se tedy
   zastaví i tady. */
document.addEventListener("gesturestart", e => e.preventDefault());

/* Shake to Undo (iOS): zatřesení telefonem nabídne „Odvolat psaní" a klepnutí
   na Odvolat vrátí text rozepsaný v poli. V posilovně se telefonem třese
   pořád, tak se vracení textu v polích zablokuje úplně. Uložená data tím
   ohrožená nejsou — série a tréninky v systémovém undo vůbec nejsou.
   Samotný systémový dialog web zablokovat neumí; vypíná ho jen nastavení iOS.
   Vedlejší efekt: nefunguje ani undo z klávesnice (swipe třemi prsty). */
document.addEventListener("beforeinput", e => {
  if (e.inputType === "historyUndo" || e.inputType === "historyRedo") e.preventDefault();
}, true);
document.addEventListener("staterefresh", render);
/* stav syncu se překreslí jen ve štítku — celé překreslení by smazalo
   rozepsanou URL v poli */
document.addEventListener("syncstatus", () => {
  const b = document.getElementById("syncBadge");
  if (b) b.innerHTML = syncBadgeHtml();
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

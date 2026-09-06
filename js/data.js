/* ===== Datová vrstva: stav aplikace, perzistence, odvozená data ===== */
"use strict";

const STORE_KEY = "fitapp_state_v1";
const SETTINGS_KEY = "fitapp_settings_v1";

/* ---- Nastavení (jen lokální, nesynchronizuje se do cloudu — obsahuje sync URL a API klíč) ---- */
const Settings = {
  _cache: null,
  get() {
    if (!this._cache) {
      try { this._cache = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
      catch (e) { this._cache = {}; }
      this._cache = Object.assign({ gasWebAppUrl: "", usdaApiKey: "", anthropicApiKey: "", weightUnit: "kg", restSeconds: 120 }, this._cache);
    }
    return this._cache;
  },
  set(patch) {
    this._cache = Object.assign(this.get(), patch);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this._cache));
  }
};

/* ---- Výchozí knihovna cviků ---- */
function seedExercises() {
  const mk = (id, name, category, description) => ({ id, name, category, description, isCustom: false });
  return [
    mk("ex-bench", "Bench press", "Hrudník", "Lopatky stažené k sobě, chodidla pevně na zemi. Činku spouštěj kontrolovaně na spodní část hrudníku."),
    mk("ex-incdb", "Tlaky s jednoručkami na šikmé lavici", "Hrudník", "Lavice 30–45°. Jednoručky spouštěj do úrovně hrudníku, lokty pod ~75°."),
    mk("ex-fly", "Rozpažky na kladce", "Hrudník", "Mírně pokrčené lokty po celou dobu pohybu, soustřeď se na protažení a stažení prsou."),
    mk("ex-pushup", "Kliky", "Hrudník", "Tělo zpevněné v jedné linii, hrudník až téměř k zemi."),
    mk("ex-deadlift", "Mrtvý tah", "Záda", "Rovná záda, činka co nejblíž holením. Tah zahajuj nohama, dotažení boky."),
    mk("ex-row", "Přítahy velké činky v předklonu", "Záda", "Předklon ~45°, přítah k podbřišku, lokty podél těla, bez cheatování trupem."),
    mk("ex-latpull", "Stahování horní kladky", "Záda", "Hrudník vypnutý, stahuj ke klíčním kostem, lokty dolů a k tělu."),
    mk("ex-cablerow", "Přítahy spodní kladky", "Záda", "Vzpřímený sed, přítah k břichu, ramena dozadu a dolů."),
    mk("ex-pullup", "Shyby", "Záda", "Plný rozsah — z visu bradou nad hrazdu. Bez švihu."),
    mk("ex-squat", "Dřep", "Nohy", "Kolena ve směru špiček, hloubka alespoň do paralelu, zpevněný střed těla."),
    mk("ex-legpress", "Leg press", "Nohy", "Chodidla na šíři ramen, kolena nepropínej do zámku, plný rozsah."),
    mk("ex-rdl", "Rumunský mrtvý tah", "Nohy", "Mírně pokrčená kolena, boky dozadu, protažení hamstringů, rovná záda."),
    mk("ex-lunge", "Výpady", "Nohy", "Dlouhý krok, koleno zadní nohy téměř k zemi, trup vzpřímený."),
    mk("ex-calf", "Výpony ve stoje", "Nohy", "Plný rozsah — hluboké protažení dole, výdrž nahoře."),
    mk("ex-ohp", "Tlaky nad hlavu", "Ramena", "Ve stoje, zpevněný core, činku tlač svisle podél obličeje, dotažení nad hlavou."),
    mk("ex-latraise", "Upažování s jednoručkami", "Ramena", "Mírně pokrčené lokty, zvedej do úrovně ramen, bez švihu."),
    mk("ex-facepull", "Face pull", "Ramena", "Lano k obličeji, lokty vysoko, rotace ramen ven — zadní delty."),
    mk("ex-curl", "Bicepsový zdvih s velkou činkou", "Biceps", "Lokty u těla, bez švihu trupem, kontrolovaná negativní fáze."),
    mk("ex-hammer", "Hammer curls", "Biceps", "Neutrální úchop (dlaně k sobě), zapojuje i předloktí."),
    mk("ex-pushdown", "Stahování kladky na triceps", "Triceps", "Lokty fixované u těla, propnutí v lokti, kontrolovaný návrat."),
    mk("ex-skull", "Francouzský tlak", "Triceps", "Vleže, lokty směřují vzhůru, spouštěj k čelu, hýbe se jen předloktí."),
    mk("ex-dips", "Dipy na bradlech", "Triceps", "Mírný předklon, lokty podél těla, spouštěj do 90° v lokti."),
    mk("ex-plank", "Plank", "Core", "Tělo v jedné linii, zpevněné břicho i hýždě. Zapisuj délku výdrže v s jako opakování."),
    mk("ex-legraise", "Zvedání nohou ve visu", "Core", "Bez švihu, pánev se na konci podsazuje, kontrolované spouštění."),
    mk("ex-crunch", "Zkracovačky", "Core", "Bedra na podložce, zvedej lopatky, pohyb vede břicho, ne krk.")
  ];
}

const EX_CATEGORIES = ["Hrudník", "Záda", "Nohy", "Ramena", "Biceps", "Triceps", "Core"];

/* ===== Barvy svalových partií =====
   Identita partie — vykresluje se vždy jako proužek nebo tečka, nikdy jako
   výplň tlačítka (ta patří stavové vrstvě: volt = akce, zlatá = rekord,
   červená = chyba). Hodnoty jsou v css/styles.css, tady jen mapa. */
const CAT_COLOR = {
  "Ramena": "var(--p-ramena)",
  "Hrudník": "var(--p-hrudnik)",
  "Záda": "var(--p-zada)",
  "Biceps": "var(--p-biceps)",
  "Triceps": "var(--p-triceps)",
  "Core": "var(--p-core)",
  "Nohy": "var(--p-nohy)"
};

/* Pořadí podle polohy na těle shora dolů — používá counter i legendy.
   Liší se od EX_CATEGORIES, které drží pořadí knihovny cviků. */
const CAT_ORDER = ["Ramena", "Hrudník", "Záda", "Biceps", "Triceps", "Core", "Nohy"];

function catColor(cat) { return CAT_COLOR[cat] || "var(--text3)"; }
function exCategory(exerciseId) { return (getExercise(exerciseId) || {}).category || null; }
function exColor(exerciseId) { return catColor(exCategory(exerciseId)); }

/* Počet sérií na partii v jedné session (i rozdělané) — jádro counteru. */
function sessionCatSets(session) {
  const counts = {};
  for (const c of CAT_ORDER) counts[c] = 0;
  for (const e of (session && session.entries) || []) {
    const cat = exCategory(e.exerciseId);
    if (!cat) continue;
    counts[cat] = (counts[cat] || 0) + (e.sets || []).length;
  }
  return counts;
}

/* Partie odcvičené v daný den — pro proužky v kalendáři. Vrací pole barev
   v pořadí podle těla; kardio se přidává jako neutrální proužek na konec. */
function dayCatColors(date) {
  const sess = sessionsOn(date);
  const hit = new Set();
  let cardio = false;
  for (const s of sess) {
    if (s.type === "cardio") { cardio = true; continue; }
    for (const e of s.entries || []) {
      if (!(e.sets || []).length) continue;
      const cat = exCategory(e.exerciseId);
      if (cat) hit.add(cat);
    }
  }
  const out = CAT_ORDER.filter(c => hit.has(c)).map(catColor);
  if (cardio) out.push("var(--p-cardio)");
  return out;
}

function defaultState() {
  return {
    version: 1,
    updatedAt: 0,
    exercises: seedExercises(),
    templates: [
      { id: "A", name: "Trénink A", exercises: ["ex-bench", "ex-ohp", "ex-latpull", "ex-curl", "ex-pushdown", "ex-plank"] },
      { id: "B", name: "Trénink B", exercises: ["ex-squat", "ex-deadlift", "ex-row", "ex-legpress", "ex-latraise", "ex-legraise"] }
    ],
    sessions: [],      // WorkoutSession
    foods: [],         // FoodItem (knihovna: oblíbené, vlastní, použité z API)
    foodLog: [],       // FoodLogEntry
    bodyLog: [],       // { date, weightKg } — denní tělesná váha, max 1 záznam na den
    recipes: [],       // { id, name, portions, items: [{ foodItemId, grams }] }
    checkins: [],      // týdenní check-in (obvody, škály 1–10, dodržování, poznámka)
    milestones: [],    // { id, date } — jednorázově dosažené milníky
    deletedIds: [],    // tombstony smazaných záznamů (pro slévání při syncu)
    goal: { dailyCalories: 2500, proteinGrams: 150, carbsGrams: 280, fatGrams: 80 },
    activeSession: null
  };
}

/* ===== Tréninkový plán od trenéra (ONLINE COACHING — OBECNÁ TABULKA) =====
   Jednorázová migrace: založí cviky Full Body A/B/C s poznámkami trenéra
   a nastaví šablony. Stabilní id (cp-*) zabraňují duplikaci přes sync. */
const COACH_PLAN = {
  flag: "coachPlanV1",
  A: {
    name: "Full Body A",
    items: [
      ["cp-a1", "Mrtvý brouk + výdrž v planku", "Core", "3× 10 / 20–30 s — Mrtvý brouk s vytaženýma lopatkama do stropu (flexe břicha). V planku podsazená pánev, mačkám břicho co nejvíc po co nejkratší dobu."],
      ["cp-a2", "Dřep / Výpad / Kachnička", "Nohy", "2× 12/10/8."],
      ["cp-a3", "Leg press", "Nohy", "3× 8–15 — Kontrolované negativum, maximální rozsah."],
      ["cp-a4", "Zakopávání vleže", "Nohy", "3× 12–20 — Kontrolované negativum, nepropínám kolena."],
      ["cp-a5", "Stahování horní kladky", "Záda", "3× 8–12 — Středně široký neutrální adaptér."],
      ["cp-a6", "Tlak na multipressu na hrudník", "Hrudník", "3× 8–12."],
      ["cp-a7", "Rear delt pec flys", "Ramena", "2× 8–15."],
      ["cp-a8", "Biceps s jednoručkama", "Biceps", "2–3× 8–12 — Nejedu kladiva, vytahuju malíček co nejvíc nahoru."],
      ["cp-a9", "Kliky na bradlech na klečícím stroji", "Triceps", "2–3× 8–15."]
    ]
  },
  B: {
    name: "Full Body B",
    items: [
      ["cp-b1", "Leg raises", "Core", "3× 12–15 — Snažím se co nejvíc podsadit pánev, odlepit zadek od podložky."],
      ["cp-b2", "Předkopávání", "Nohy", "3× 10–15 — Jediný cvik, kde můžu jít bezpečně do propnutí kolene — vymáčknu z něj maximum."],
      ["cp-b3", "Pendulum", "Nohy", "3× 8–12 — Plný rozsah pohybu, zadek až k patám, nepropínám kolena. Tlačím přes pánev, ne ramena."],
      ["cp-b4", "Hip thrusty na stroji (s pásem)", "Nohy", "3× 8–15 — Dolů kontrolovaná brzda, nahoře zmáčknout půlky k sobě."],
      ["cp-b5", "Pec deck v záklonu", "Hrudník", "3× 8–12 — Mačkám tužku mezi prsy, neobjímám strom."],
      ["cp-b6", "Přitahování v sedě", "Záda", "3× 8–12 — Stroj s cihličkami, palce dělají stříšku, zadek vzadu, stahuju lopatky k sobě."],
      ["cp-b7", "Francouzské tlaky s EZ osou na šikmé lavici", "Triceps", "3× 8–12 — Lavice na 3. stupínek, temeno hlavy na rohu lavičky, lokty za tělo, maximální pokrčení."],
      ["cp-b8", "3 cesty", "Ramena", "3× 10–12."],
      ["cp-b9", "Bicepsové zdvihy na skotovce", "Biceps", "3× 10–12 — Skotovka s cihličkami, úzký úchop, plný rozsah pohybu."]
    ]
  },
  C: {
    name: "Full Body C",
    items: [
      ["cp-c1", "Břicho s medicinbálem + přenosy KTB v kliku", "Core", "3× 10–12."],
      ["cp-c2", "Bulharské dřepy s jednoručkou", "Nohy", "3× 8–12 — Zadní noha na lavičce, přední na bedně bez klínků. Činka v ruce na straně nohy, která NECVIČÍ."],
      ["cp-c3", "Rumunské mrtvé tahy na beltsquatu", "Nohy", "3× 10–15 — Tlačím zadek dozadu, protahuju zadní stehna, zvedám protlačením pánve dopředu."],
      ["cp-c4", "Tlaky na ramena s jednoručkama", "Ramena", "3× 8–12."],
      ["cp-c5", "Přítahy na klečícím stroji", "Záda", "3× 10–12 — Brada nahoru, protlačuju hrudník do stropu, lokty do těla."],
      ["cp-c6", "Tlaky na prsa na stroji", "Hrudník", "3× 8–12."],
      ["cp-c7", "Lyžař na kladce + tricepsové stahování", "Triceps", "3× 12–15 / AMRAP — Předklon, rovné tělo, při stahování tlačím ramena dozadu. Triceps: lokty zapíchnuté do těla, maximální pokrčení lokte."],
      ["cp-c8", "Bicepsové kladiva na kladce", "Biceps", "3× 12–15 — Protažený loket, zápěstí nerotuju a tlačím ho k rameni."],
      ["cp-c9", "Rozpažky s jednoručkama", "Ramena", "3× 12–15 — Nahoře zastavím, dolů brzdím. Ruce OD těla, lehce před sebe."]
    ]
  }
};

function applyCoachPlan() {
  if (S[COACH_PLAN.flag]) return;
  const ensureExercise = ([id, name, category, description]) => {
    // shoda jménem se stávajícím cvikem → jen doplní plán do popisu
    const existing = S.exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.description = description;
      return existing.id;
    }
    if (!getExercise(id)) {
      S.exercises.push({ id, name, category, description, isCustom: true });
    }
    return id;
  };
  for (const key of ["A", "B", "C"]) {
    const plan = COACH_PLAN[key];
    const ids = plan.items.map(ensureExercise);
    const tpl = getTemplate(key);
    if (tpl) {
      tpl.name = plan.name;
      tpl.exercises = ids;
    } else {
      S.templates.push({ id: key, name: plan.name, exercises: ids });
    }
  }
  S[COACH_PLAN.flag] = true;
  S.updatedAt = Date.now();
  persist();
}

let S = loadState();
applyCoachPlan();
/* backfill milníků je až na konci souboru — MILESTONES je const níž */

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const st = JSON.parse(raw);
      // doplnění polí při upgradu struktury
      return Object.assign(defaultState(), st);
    }
  } catch (e) { console.warn("loadState:", e); }
  return defaultState();
}

function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify(S));
}

/* Každá mutace stavu jde přes save() → uloží lokálně a naplánuje cloud sync */
function save() {
  S.updatedAt = Date.now();
  persist();
  checkMilestones();
  Sync.scheduleSave();
}

/* Nahrazení celého stavu (po načtení z cloudu / importu) */
function replaceState(newState) {
  S = Object.assign(defaultState(), newState);
  persist();
  checkMilestones(true); // cizí data: milníky jen doplnit, bez oslav
}

/* ===== Pomocné selektory ===== */
function getExercise(id) { return S.exercises.find(e => e.id === id); }
function exName(id) {
  const e = getExercise(id);
  if (e) return e.name;
  // smazaný cvik: jméno se při mazání zapéká do záznamů v historii
  for (const s of S.sessions) {
    for (const en of s.entries || []) {
      if (en.exerciseId === id && en.exerciseName) return en.exerciseName;
    }
  }
  return "(smazaný cvik)";
}
function getTemplate(id) { return S.templates.find(t => t.id === id); }
function getFood(id) { return S.foods.find(f => f.id === id); }
function getRecipe(id) { return S.recipes.find(r => r.id === id); }

/* Tombston pro sync — aby se smazaný záznam nevrátil z druhého zařízení */
function markDeleted(id) {
  if (!id) return;
  S.deletedIds.push(id);
  if (S.deletedIds.length > 500) S.deletedIds = S.deletedIds.slice(-500);
}

/* Poslední zapsané série daného cviku (mimo aktivní session) — pro hint „minule" */
function lastExerciseSets(exerciseId, excludeSessionId) {
  let best = null;
  for (const s of S.sessions) {
    if (s.type !== "weights" || s.id === excludeSessionId) continue;
    for (const e of s.entries) {
      if (e.exerciseId === exerciseId && (e.sets || []).length) {
        if (!best || s.date > best.date) best = { date: s.date, sets: e.sets };
      }
    }
  }
  return best;
}

/* Součty receptu (gramy + makra) přes položky z knihovny */
function recipeTotals(r) {
  const t = { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const it of r.items || []) {
    const f = getFood(it.foodItemId);
    if (!f || !it.grams) continue;
    const k = it.grams / 100;
    t.grams += it.grams;
    t.kcal += (f.caloriesPer100g || 0) * k;
    t.protein += (f.proteinPer100g || 0) * k;
    t.carbs += (f.carbsPer100g || 0) * k;
    t.fat += (f.fatPer100g || 0) * k;
  }
  return t;
}

function sessionsOn(date) { return S.sessions.filter(s => s.date === date); }
function foodLogOn(date) { return S.foodLog.filter(f => f.date === date); }

/* Souhrn nutrice za den */
function dayNutrition(date) {
  const r = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
  for (const e of foodLogOn(date)) {
    r.calories += e.calories; r.protein += e.protein;
    r.carbs += e.carbs; r.fat += e.fat; r.count++;
  }
  return r;
}

/* Splněný kalorický cíl = zapsáno alespoň něco a v rozmezí ±10 % cíle */
function calorieGoalMet(date) {
  const n = dayNutrition(date);
  const g = S.goal.dailyCalories;
  if (!n.count || !g) return false;
  return Math.abs(n.calories - g) / g <= 0.10;
}

/* ===== Osobní rekordy =====
   PR = set s nejvyšším odhadovaným 1RM. Historie = sety, které v čase překonaly předchozí maximum. */
function prHistory(exerciseId) {
  const events = [];
  let best = 0;
  const sorted = [...S.sessions]
    .filter(s => s.type === "weights")
    .sort((a, b) => a.date.localeCompare(b.date) || (a.id > b.id ? 1 : -1));
  for (const sess of sorted) {
    for (const entry of sess.entries) {
      if (entry.exerciseId !== exerciseId) continue;
      for (const set of entry.sets || []) {
        const e1 = est1RM(set.weight, set.reps);
        if (e1 > best && e1 > 0) {
          best = e1;
          events.push({ date: sess.date, weight: set.weight, reps: set.reps, e1rm: e1 });
        }
      }
    }
  }
  return events;
}

function currentPR(exerciseId) {
  const h = prHistory(exerciseId);
  return h.length ? h[h.length - 1] : null;
}

/* Mapa všech PR — pro přehledy */
function allPRs() {
  const ids = new Set();
  for (const s of S.sessions) {
    if (s.type !== "weights") continue;
    for (const e of s.entries) if (e.exerciseId) ids.add(e.exerciseId);
  }
  return [...ids]
    .map(id => ({ exerciseId: id, pr: currentPR(id) }))
    .filter(x => x.pr)
    .sort((a, b) => b.pr.date.localeCompare(a.pr.date));
}

/* Objem session (Σ opakování × váha v kg) */
function sessionVolume(sess) {
  if (sess.type !== "weights") return 0;
  let v = 0;
  for (const e of sess.entries) for (const st of e.sets || []) v += (st.reps || 0) * (st.weight || 0);
  return v;
}

/* ===== Tělesná váha ===== */
function bodyWeightOn(date) {
  const e = S.bodyLog.find(b => b.date === date);
  return e ? e.weightKg : null;
}

/* Poslední záznam k datu (včetně) — vrací {date, weightKg} nebo null */
function lastBodyWeight(beforeDate) {
  let best = null;
  for (const b of S.bodyLog) {
    if (beforeDate && b.date > beforeDate) continue;
    if (!best || b.date > best.date) best = b;
  }
  return best;
}

/* Zapíše/přepíše váhu pro daný den (výchozí dnešek) */
function logBodyWeight(kg, date) {
  const d = date || todayStr();
  const e = S.bodyLog.find(b => b.date === d);
  if (e) e.weightKg = kg;
  else S.bodyLog.push({ date: d, weightKg: kg });
  S.bodyLog.sort((a, b) => a.date.localeCompare(b.date));
}

/* ===== Týdenní check-in ===== */
const MEASURES = [
  { key: "chest", label: "Prsa" }, { key: "waist", label: "Pas" },
  { key: "hips", label: "Boky" }, { key: "glutes", label: "Hýždě" },
  { key: "arm", label: "Paže" }, { key: "thigh", label: "Stehno" },
  { key: "calf", label: "Lýtko" }
];
const SCALES = [
  { key: "energy", label: "Energie" }, { key: "hunger", label: "Hlad" },
  { key: "sleep", label: "Spánek" }, { key: "stress", label: "Stres" },
  { key: "quality", label: "Kvalita tréninků" }
];

/* nejnovější první */
function checkinsSorted() {
  return [...S.checkins].sort((a, b) => b.date.localeCompare(a.date));
}
function lastCheckin() { return checkinsSorted()[0] || null; }

/* Kolik dní od posledního check-inu; null = ještě žádný nebyl */
function daysSinceCheckin() {
  const last = lastCheckin();
  if (!last) return null;
  return Math.round((parseDate(todayStr()) - parseDate(last.date)) / 86400000);
}

/* Návrhy hodnot z dat, která appka už má (posledních 7 dní) */
function checkinSuggestions() {
  const from = addDays(todayStr(), -6);
  const rated = S.sessions.filter(s => s.date >= from && s.rating);
  const quality = rated.length
    ? Math.round(rated.reduce((a, s) => a + s.rating, 0) / rated.length) : null;
  let logged = 0, met = 0;
  for (let d = from; d <= todayStr(); d = addDays(d, 1)) {
    if (dayNutrition(d).count) { logged++; if (calorieGoalMet(d)) met++; }
  }
  const latest = lastBodyWeight();
  return {
    quality,
    adherence: logged ? Math.round(met / logged * 100) : null,
    adherenceNote: logged ? `${met}/${logged} zapsaných dní v kalorickém cíli` : null,
    weightKg: latest ? latest.weightKg : null,
    weightAvg: movingAvgAt(S.bodyLog, todayStr())
  };
}

/* ===== Milníky =====
   Jednorázové, nedají se „ztratit" (na rozdíl od streaku). Kontrolují se
   při každém save(); při importu/syncu se dosažené jen tiše doplní. */
const MILESTONES = [
  { id: "w1", title: () => "První trénink", test: st => st.workouts >= 1 },
  { id: "w10", title: () => "10 tréninků", test: st => st.workouts >= 10 },
  { id: "w25", title: () => "25 tréninků", test: st => st.workouts >= 25 },
  { id: "w50", title: () => "50 tréninků", test: st => st.workouts >= 50 },
  { id: "w100", title: () => "100 tréninků", test: st => st.workouts >= 100 },
  { id: "w200", title: () => "200 tréninků", test: st => st.workouts >= 200 },
  { id: "vol10", title: () => "10 tun nazvedáno", test: st => st.volume >= 10000 },
  { id: "vol50", title: () => "50 tun nazvedáno", test: st => st.volume >= 50000 },
  { id: "vol100", title: () => "100 tun nazvedáno", test: st => st.volume >= 100000 },
  { id: "vol250", title: () => "250 tun nazvedáno", test: st => st.volume >= 250000 },
  { id: "kg60", title: () => `${fmtWeight(60)} v jedné sérii`, test: st => st.maxSetWeight >= 60 },
  { id: "kg100", title: () => `${fmtWeight(100)} v jedné sérii`, test: st => st.maxSetWeight >= 100 },
  { id: "kg140", title: () => `${fmtWeight(140)} v jedné sérii`, test: st => st.maxSetWeight >= 140 },
  { id: "pr10", title: () => "Rekord v 10 cvicích", test: st => st.prs >= 10 },
  { id: "cardio10", title: () => "10 kardio tréninků", test: st => st.cardio >= 10 },
  { id: "weigh30", title: () => "30 vážení", test: st => st.weighIns >= 30 },
  { id: "food30", title: () => "30 dní zapsané stravy", test: st => st.foodDays >= 30 },
  { id: "food100", title: () => "100 dní zapsané stravy", test: st => st.foodDays >= 100 }
];

function milestoneStats() {
  let volume = 0, maxSetWeight = 0;
  for (const s of S.sessions) {
    if (s.type !== "weights") continue;
    volume += sessionVolume(s);
    for (const e of s.entries) {
      for (const st of e.sets || []) if ((st.weight || 0) > maxSetWeight) maxSetWeight = st.weight;
    }
  }
  return {
    workouts: S.sessions.length,
    cardio: S.sessions.filter(s => s.type === "cardio").length,
    volume, maxSetWeight,
    prs: allPRs().length,
    weighIns: S.bodyLog.length,
    foodDays: new Set(S.foodLog.map(f => f.date)).size
  };
}

/* Doplní nově dosažené milníky. silent = jen zaznamenat (start appky, import). */
function checkMilestones(silent) {
  if (!Array.isArray(S.milestones)) S.milestones = [];
  const have = new Set(S.milestones.map(m => m.id));
  const st = milestoneStats();
  const fresh = MILESTONES.filter(m => !have.has(m.id) && m.test(st));
  if (!fresh.length) return [];
  for (const m of fresh) S.milestones.push({ id: m.id, date: todayStr() });
  persist();
  if (!silent) {
    const first = fresh[0];
    const msg = fresh.length > 1
      ? `Milník: ${first.title()} (+${fresh.length - 1} další)`
      : `Milník: ${first.title()}`;
    // se zpožděním, ať nepřebije toast akce, která milník spustila
    setTimeout(() => toast(msg, "pr"), 2800);
  }
  return fresh;
}

function achievedMilestones() {
  return (S.milestones || [])
    .map(m => ({ ...m, def: MILESTONES.find(d => d.id === m.id) }))
    .filter(m => m.def)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* ===== Knihovna potravin ===== */
/* Uloží položku z API do knihovny (bez duplicit), vrátí id */
function upsertFood(item) {
  const found = S.foods.find(f =>
    f.source === item.source &&
    (item.sourceId ? f.sourceId === item.sourceId : f.name === item.name));
  if (found) return found.id;
  const f = {
    id: uid(),
    name: item.name,
    source: item.source,
    sourceId: item.sourceId || null,
    caloriesPer100g: item.caloriesPer100g,
    proteinPer100g: item.proteinPer100g,
    carbsPer100g: item.carbsPer100g,
    fatPer100g: item.fatPer100g,
    servingGrams: item.servingGrams || null,   // velikost porce v g (pro zadávání po kusech)
    servingName: item.servingName || null,
    isFavorite: false
  };
  S.foods.push(f);
  return f.id;
}

/* Stávající data: už dosažené milníky doplnit tiše (bez oslavných toastů) */
checkMilestones(true);

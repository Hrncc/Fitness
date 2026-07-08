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
      this._cache = Object.assign({ gasWebAppUrl: "", usdaApiKey: "", anthropicApiKey: "", weightUnit: "kg" }, this._cache);
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
    deletedIds: [],    // tombstony smazaných záznamů (pro slévání při syncu)
    goal: { dailyCalories: 2500, proteinGrams: 150, carbsGrams: 280, fatGrams: 80 },
    activeSession: null
  };
}

let S = loadState();

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
  Sync.scheduleSave();
}

/* Nahrazení celého stavu (po načtení z cloudu / importu) */
function replaceState(newState) {
  S = Object.assign(defaultState(), newState);
  persist();
}

/* ===== Pomocné selektory ===== */
function getExercise(id) { return S.exercises.find(e => e.id === id); }
function exName(id) { const e = getExercise(id); return e ? e.name : "(smazaný cvik)"; }
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

/* Zapíše/přepíše váhu pro dnešek */
function logBodyWeight(kg) {
  const t = todayStr();
  const e = S.bodyLog.find(b => b.date === t);
  if (e) e.weightKg = kg;
  else S.bodyLog.push({ date: t, weightKg: kg });
  S.bodyLog.sort((a, b) => a.date.localeCompare(b.date));
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

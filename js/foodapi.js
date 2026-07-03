/* ===== Vyhledávání potravin: Open Food Facts + USDA FoodData Central =====
   Oba zdroje se dotazují paralelně a výsledky se slučují do jednoho seznamu.
   Hodnoty se normalizují na 100 g. */
"use strict";

const FoodAPI = {
  APP_UA: "FitnessLogPWA/1.0 (martas.hrncir@icloud.com)",

  /* --- Open Food Facts — full-text search (legacy v1) --- */
  async searchOFF(query) {
    // Vlastní User-Agent hlavičku nelze z prohlížeče poslat (vyvolala by CORS
    // preflight, který search.pl neobslouží) — posílá se UA prohlížeče a appka
    // se identifikuje parametrem app_name dle doporučení OFF pro webové appky.
    const url = "https://world.openfoodfacts.org/cgi/search.pl"
      + "?search_terms=" + encodeURIComponent(query)
      + "&json=1&page_size=10&action=process"
      + "&fields=code,product_name,brands,nutriments,serving_size"
      + "&app_name=" + encodeURIComponent(this.APP_UA);
    const res = await fetch(url);
    if (!res.ok) throw new Error("OFF HTTP " + res.status);
    const data = await res.json();
    return (data.products || []).map(p => {
      const n = p.nutriments || {};
      let kcal = num(n["energy-kcal_100g"]);
      if (kcal == null && n["energy_100g"] != null) kcal = num(n["energy_100g"]) / 4.184; // kJ → kcal
      return {
        source: "openfoodfacts",
        sourceId: p.code || null,
        name: [p.product_name, p.brands].filter(Boolean).join(" — ") || "(bez názvu)",
        caloriesPer100g: round1(kcal),
        proteinPer100g: round1(num(n["proteins_100g"])),
        carbsPer100g: round1(num(n["carbohydrates_100g"])),
        fatPer100g: round1(num(n["fat_100g"])),
        servingSize: p.serving_size || null
      };
    }).filter(f => f.caloriesPer100g != null);
  },

  /* --- USDA FoodData Central — Foundation + SR Legacy --- */
  async searchUSDA(query) {
    const key = (Settings.get().usdaApiKey || "").trim() || "DEMO_KEY";
    const url = "https://api.nal.usda.gov/fdc/v1/foods/search"
      + "?api_key=" + encodeURIComponent(key)
      + "&query=" + encodeURIComponent(query)
      + "&dataType=Foundation,SR%20Legacy&pageSize=10";
    const res = await fetch(url);
    if (!res.ok) throw new Error("USDA HTTP " + res.status);
    const data = await res.json();
    return (data.foods || []).map(f => {
      const get = (...names) => {
        for (const fn of f.foodNutrients || []) {
          const nm = fn.nutrientName || (fn.nutrient && fn.nutrient.name) || "";
          const unit = (fn.unitName || (fn.nutrient && fn.nutrient.unitName) || "").toLowerCase();
          for (const want of names) {
            if (nm === want.name && (!want.unit || unit === want.unit)) {
              return fn.value != null ? fn.value : (fn.amount != null ? fn.amount : null);
            }
          }
        }
        return null;
      };
      return {
        source: "usda",
        sourceId: String(f.fdcId),
        name: f.description || "(bez názvu)",
        caloriesPer100g: round1(get({ name: "Energy", unit: "kcal" })),
        proteinPer100g: round1(get({ name: "Protein" })),
        carbsPer100g: round1(get({ name: "Carbohydrate, by difference" })),
        fatPer100g: round1(get({ name: "Total lipid (fat)" })),
        servingSize: null
      };
    }).filter(f => f.caloriesPer100g != null);
  },

  /* --- Kombinované vyhledávání — chyba jednoho zdroje neshodí druhý --- */
  async search(query) {
    const [off, usda] = await Promise.allSettled([this.searchOFF(query), this.searchUSDA(query)]);
    const results = [];
    const errors = [];
    if (off.status === "fulfilled") results.push(...off.value);
    else errors.push("Open Food Facts: " + off.reason.message);
    if (usda.status === "fulfilled") results.push(...usda.value);
    else errors.push("USDA: " + usda.reason.message);
    return { results, errors };
  }
};

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function round1(v) { return v == null ? null : Math.round(v * 10) / 10; }

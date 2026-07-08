/* ===== Vyhledávání potravin: Open Food Facts + USDA FoodData Central =====
   Oba zdroje se dotazují paralelně a výsledky se slučují do jednoho seznamu.
   Hodnoty se normalizují na 100 g. */
"use strict";

const FoodAPI = {
  APP_UA: "FitnessLogPWA/1.0 (martas.hrncir@icloud.com)",

  /* --- Open Food Facts — full-text search (legacy v1) ---
     Nejdřív česká databáze (cz.), při málo výsledcích doplní světová. */
  async searchOFF(query) {
    let list = await this._offQuery("https://cz.openfoodfacts.org", query);
    if (list.length < 3) {
      const world = await this._offQuery("https://world.openfoodfacts.org", query);
      const seen = new Set(list.map(x => x.sourceId));
      list = list.concat(world.filter(x => !seen.has(x.sourceId)));
    }
    return list.slice(0, 12);
  },

  async _offQuery(base, query) {
    // Vlastní User-Agent hlavičku nelze z prohlížeče poslat (vyvolala by CORS
    // preflight, který search.pl neobslouží) — posílá se UA prohlížeče a appka
    // se identifikuje parametrem app_name dle doporučení OFF pro webové appky.
    const url = base + "/cgi/search.pl"
      + "?search_terms=" + encodeURIComponent(query)
      + "&json=1&page_size=10&action=process&lc=cs"
      + "&fields=code,product_name,brands,nutriments,serving_size"
      + "&app_name=" + encodeURIComponent(this.APP_UA);
    const res = await fetch(url);
    if (!res.ok) throw new Error("OFF HTTP " + res.status);
    const data = await res.json();
    return (data.products || []).map(p => this._mapOFF(p)).filter(f => f && f.caloriesPer100g != null);
  },

  _mapOFF(p) {
    const n = p.nutriments || {};
    let kcal = num(n["energy-kcal_100g"]);
    if (kcal == null && n["energy_100g"] != null) kcal = num(n["energy_100g"]) / 4.184; // kJ → kcal
    // "30 g" / "250ml" → velikost porce v gramech (ml ≈ g)
    const m = /([\d]+[.,]?\d*)\s*(g|ml)/i.exec(p.serving_size || "");
    return {
      source: "openfoodfacts",
      sourceId: p.code || null,
      name: [p.product_name, p.brands].filter(Boolean).join(" — ") || "(bez názvu)",
      caloriesPer100g: round1(kcal),
      proteinPer100g: round1(num(n["proteins_100g"])),
      carbsPer100g: round1(num(n["carbohydrates_100g"])),
      fatPer100g: round1(num(n["fat_100g"])),
      servingSize: p.serving_size || null,
      servingGrams: m ? round1(parseFloat(m[1].replace(",", "."))) : null,
      servingName: p.serving_size || null
    };
  },

  /* --- Detail produktu podle čárového kódu (OFF v2) --- */
  async lookupBarcode(code) {
    const url = "https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(code)
      + ".json?fields=code,product_name,brands,nutriments,serving_size";
    const res = await fetch(url);
    if (!res.ok && res.status !== 404) throw new Error("OFF HTTP " + res.status);
    const data = await res.json().catch(() => ({}));
    if (data.status !== 1 || !data.product) throw new Error("Produkt s tímto kódem není v databázi");
    const item = this._mapOFF(data.product);
    if (item.caloriesPer100g == null) throw new Error("Produkt nemá vyplněné nutriční hodnoty");
    return item;
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

  /* --- Claude API — přečtení nutriční tabulky z fotky ---
     Přímé volání z prohlížeče (hlavička anthropic-dangerous-direct-browser-access);
     klíč je jen v localStorage tohoto zařízení. Structured output garantuje JSON. */
  LABEL_SCHEMA: {
    type: "object",
    properties: {
      found: { type: "boolean" },
      name: { type: "string" },
      caloriesPer100g: { type: "number" },
      proteinPer100g: { type: "number" },
      carbsPer100g: { type: "number" },
      fatPer100g: { type: "number" },
      note: { type: "string" }
    },
    required: ["found", "name", "caloriesPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g", "note"],
    additionalProperties: false
  },

  LABEL_PROMPT: `Na fotce je etiketa potraviny. Najdi nutriční tabulku a vyčti hodnoty NA 100 g:
- energie v kcal (pokud je uvedena jen v kJ, přepočítej: kJ / 4.184)
- bílkoviny, sacharidy a tuky v gramech
Pokud tabulka uvádí hodnoty jen na porci, přepočítej je na 100 g podle uvedené velikosti porce a zmiň to v "note".
"name" = název produktu z etikety (prázdný řetězec, pokud není vidět).
"found" = false, pokud na fotce žádná nutriční tabulka není.
"note" = krátké upozornění česky (např. přepočteno z porce, hůř čitelné hodnoty) — jinak prázdný řetězec.`,

  MEAL_SCHEMA: {
    type: "object",
    properties: {
      found: { type: "boolean" },
      name: { type: "string" },
      estimatedGrams: { type: "number" },
      caloriesPer100g: { type: "number" },
      proteinPer100g: { type: "number" },
      carbsPer100g: { type: "number" },
      fatPer100g: { type: "number" },
      note: { type: "string" }
    },
    required: ["found", "name", "estimatedGrams", "caloriesPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g", "note"],
    additionalProperties: false
  },

  MEAL_PROMPT: `Na fotce je jídlo (talíř, miska, svačina…). Odhadni jeho nutriční složení:
- "name": krátký český název jídla (např. "Kuřecí s rýží a zeleninou")
- "estimatedGrams": odhad celkové hmotnosti porce na fotce v gramech
- hodnoty NA 100 g: kcal, bílkoviny, sacharidy, tuky (v gramech)
- "note": krátce česky, z čeho odhad vychází a jak je nejistý
"found" = false, pokud na fotce žádné jídlo není.`,

  async _claudeVision(file, prompt, schema) {
    const key = (Settings.get().anthropicApiKey || "").trim();
    if (!key) throw new Error("Chybí Claude API klíč — vlož ho v Nastavení");
    const base64 = await imageToJpegBase64(file);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        output_config: { format: { type: "json_schema", schema } },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: prompt }
          ]
        }]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data.error && data.error.message) || "HTTP " + res.status);
    if (data.stop_reason === "refusal") throw new Error("Model fotku odmítl zpracovat");
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    return JSON.parse(text);
  },

  async scanLabel(file) {
    const out = await this._claudeVision(file, this.LABEL_PROMPT, this.LABEL_SCHEMA);
    if (!out.found || !out.caloriesPer100g) {
      throw new Error(out.note || "Na fotce se nepodařilo najít nutriční tabulku");
    }
    return out;
  },

  async scanMeal(file) {
    const out = await this._claudeVision(file, this.MEAL_PROMPT, this.MEAL_SCHEMA);
    if (!out.found || !out.caloriesPer100g) {
      throw new Error(out.note || "Na fotce se nepodařilo rozpoznat jídlo");
    }
    return out;
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

/* Zmenší fotku na max 1568 px (delší strana) a překóduje na JPEG base64 —
   víc rozlišení API stejně zahodí a menší request je rychlejší i levnější. */
function imageToJpegBase64(file, maxDim = 1568, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Obrázek se nepodařilo načíst"));
    };
    img.src = url;
  });
}

/* ===== Trenér (v5.0) — Claude přímo v appce =====
   Chat s Claudem, který vidí tréninky, plán, váhu, stravu a data z hodinek.
   Radí a navrhuje úpravy plánu; nic se nezmění, dokud návrh nepotvrdíš
   klepnutím (jde vrátit). Běží na tvém API klíči z Nastavení — každá zpráva
   jde z tvého kreditu a data k ní odcházejí na api.anthropic.com.

   Volá se přímo Messages API (appka nemá build ani SDK): streamování po SSE,
   nástroje nad lokálními daty (čtení) a propose_plan_change (návrh ke
   schválení). Bloky odpovědi včetně přemýšlení se vrací zpět beze změny.
   Konverzace je jen v tomhle zařízení (localStorage), do syncu nejde. */
"use strict";

const COACH_KEY = "fitapp_coach_v1";
const COACH_MODELS = [["claude-opus-5-5", "Opus 5.5 — nejchytřejší"], ["claude-sonnet-5-5", "Sonnet 5.5 — rychlejší, levnější"], ["claude-haiku-5-5", "Haiku 5.5 — nejlevnější"]];
const COACH_MAX_TURNS = 8;        // kol nástrojů na jednu zprávu
const COACH_KEEP = 10;            // tolik posledních otázek zůstává v kontextu

const CO = { items: [], api: [], busy: false, err: null, abort: null, loaded: false, draft: "", grok: undefined };

function coachLoad() {
  if (CO.loaded) return;
  CO.loaded = true;
  try {
    const d = JSON.parse(localStorage.getItem(COACH_KEY)) || {};
    CO.items = Array.isArray(d.items) ? d.items : [];
    CO.api = Array.isArray(d.api) ? d.api : [];
  } catch (e) { CO.items = []; CO.api = []; }
}
function coachSave() {
  /* v kontextu jen posledních pár otázek; řez vždy na zprávě uživatele s textem,
     aby výsledky nástrojů nezůstaly bez svého volání */
  const starts = CO.api.map((m, i) => m.role === "user" && typeof m.content === "string" ? i : -1).filter(i => i >= 0);
  if (starts.length > COACH_KEEP) CO.api = CO.api.slice(starts[starts.length - COACH_KEEP]);
  if (CO.items.length > 80) CO.items = CO.items.slice(-80);
  try { localStorage.setItem(COACH_KEY, JSON.stringify({ items: CO.items, api: CO.api })); } catch (e) { /* plné úložiště — konverzace zůstane jen v paměti */ }
}
function coachModel() {
  const m = Settings.get().coachModel;
  return COACH_MODELS.some(x => x[0] === m) ? m : COACH_MODELS[0][0];
}
function coachKey() { return (Settings.get().anthropicApiKey || "").trim(); }

/* Most /api/grok je stejný původ jako appka. Klíč na Groka v prohlížeči není. */
function coachProbeGrok() {
  if (CO._probe) return CO._probe;
  CO._probe = fetch("/api/grok").then(r => r.ok ? r.json() : null).then(j => {
    CO.grok = !!(j && j.ok);
    return CO.grok;
  }).catch(() => { CO.grok = false; return false; });
  return CO._probe;
}
function grokTools() {
  return COACH_TOOLS.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
}
function grokMessages(api) {
  const out = [{ role: "system", content: coachSystem() }];
  for (const m of api) {
    if (m.role === "user" && typeof m.content === "string") out.push({ role: "user", content: m.content });
    else if (m.role === "user" && Array.isArray(m.content)) {
      for (const b of m.content) if (b.type === "tool_result") out.push({ role: "tool", tool_call_id: b.tool_use_id, content: String(b.content || "") });
    } else if (m.role === "assistant" && Array.isArray(m.content)) {
      const text = m.content.filter(b => b.type === "text").map(b => b.text || "").join("");
      const calls = m.content.filter(b => b.type === "tool_use").map(b => ({
        id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input || {}) }
      }));
      const msg = { role: "assistant", content: text || "" };
      if (calls.length) msg.tool_calls = calls;
      out.push(msg);
    }
  }
  return out;
}
async function grokRequest(messages, onText, signal) {
  const res = await fetch("/api/grok", {
    method: "POST", signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: grokMessages(messages), tools: grokTools() })
  });
  if (!res.ok) {
    let msg = "HTTP " + res.status;
    try { const j = await res.json(); if (j && j.error) msg = typeof j.error === "string" ? j.error : (j.error.message || msg); } catch (e) { /* tělo není JSON */ }
    throw new Error(res.status === 503 ? "Grok teď není připojený." : res.status === 429 ? "Limit Groka — zkus to za chvíli." : msg);
  }
  const blocks = [];
  const calls = [];
  let stop = "end_turn";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const take = line => {
    const data = line.replace(/^data:\s*/, "").trim();
    if (!data || data === "[DONE]") return;
    const ev = JSON.parse(data);
    const ch = ev.choices && ev.choices[0];
    if (!ch) return;
    const d = ch.delta || {};
    if (d.content) {
      let b = blocks.find(x => x.type === "text");
      if (!b) { b = { type: "text", text: "" }; blocks.push(b); }
      b.text += d.content;
      onText(d.content);
    }
    for (const tc of d.tool_calls || []) {
      const i = tc.index || 0;
      if (!calls[i]) calls[i] = { id: "", name: "", args: "" };
      if (tc.id) calls[i].id = tc.id;
      if (tc.function && tc.function.name) calls[i].name += tc.function.name;
      if (tc.function && tc.function.arguments) calls[i].args += tc.function.arguments;
    }
    if (ch.finish_reason === "tool_calls") stop = "tool_use";
    else if (ch.finish_reason === "length") stop = "max_tokens";
    else if (ch.finish_reason === "stop") stop = "end_turn";
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let at;
    while ((at = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, at).trim();
      buf = buf.slice(at + 1);
      if (line.startsWith("data:")) { try { take(line); } catch (e) { /* rozsekaný kus */ } }
    }
  }
  for (const c of calls) {
    if (!c || !c.name) continue;
    let input = {}, bad;
    try { input = c.args ? JSON.parse(c.args) : {}; }
    catch (e) { bad = c.args; }
    const b = { type: "tool_use", id: c.id || ("call_" + Math.random().toString(36).slice(2, 10)), name: c.name, input };
    if (bad !== undefined) b._bad = bad;
    blocks.push(b);
  }
  if (calls.some(c => c && c.name) && stop === "end_turn") stop = "tool_use";
  return { content: blocks, stop };
}

/* ---- nástroje ---- */
const COACH_TOOLS = [
  { name: "get_overview",
    description: "Přehled sportovce: cíle, aktuální tréninkový plán (šablony s cviky, sériemi a rozsahy), silový blok a jeho týden, tréninky za posledních 14 dní, váha, připravenost z hodinek a návrhy, které appka sama spočítala. Zavolej jako první, než začneš radit.",
    input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_workouts",
    description: "Podrobné tréninky se všemi sériemi (váha v kg × opakování, RIR, poznámky) za zvolený počet dní.",
    input_schema: { type: "object", properties: { days: { type: "integer", description: "Kolik dní zpět (1–120), výchozí 21" } }, additionalProperties: false } },
  { name: "get_exercise_history",
    description: "Historie jednoho cviku: posledních 8 tréninků se sériemi, rekordy, a co appka navrhuje na příště. Cvik zadej id nebo názvem.",
    input_schema: { type: "object", properties: { exercise: { type: "string", description: "id cviku nebo jeho název" } }, required: ["exercise"], additionalProperties: false } },
  { name: "get_health",
    description: "Data z Apple Watch / Apple Health po dnech: spánek, HRV, klidový tep, kroky, aktivní energie, váha a tréninky z hodinek.",
    input_schema: { type: "object", properties: { days: { type: "integer", description: "Kolik dní zpět (1–60), výchozí 14" } }, additionalProperties: false } },
  { name: "get_report",
    description: "Textový report za období: tréninky, objem a série po partiích, rekordy, strava (kalorie, bílkoviny, dodržování), váha a check-iny.",
    input_schema: { type: "object", properties: { range: { type: "string", enum: ["week", "month"], description: "week = posledních 7 dní, month = 30 dní" } }, required: ["range"], additionalProperties: false } },
  { name: "search_exercises",
    description: "Najde cviky v knihovně podle názvu nebo partie a vrátí jejich id — potřebuješ je pro výměnu nebo přidání cviku v návrhu.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "část názvu česky nebo anglicky; prázdné = všechny z partie" },
      category: { type: "string", enum: ["Hrudník", "Záda", "Nohy", "Ramena", "Biceps", "Triceps", "Core"] } }, additionalProperties: false } },
  { name: "propose_plan_change",
    description: "Navrhne úpravu plánu. Uživatel návrh uvidí jako kartu a potvrdí nebo zamítne klepnutím — sám nic neměníš a návrh neber jako provedený. Operace: set_plan (série / rozsah opakování lo–hi / pauza rest v sekundách u cviku v šabloně), swap (výměna cviku ex za to), add (přidat cvik na konec šablony), remove (odebrat), next_weight (váha kg pro příští trénink cviku, jednorázově). Id šablon a cviků ber z get_overview a search_exercises.",
    input_schema: { type: "object", properties: {
      title: { type: "string", description: "Krátký název návrhu, do 60 znaků" },
      why: { type: "string", description: "Jedna až dvě věty, proč — s konkrétními čísly z dat" },
      ops: { type: "array", minItems: 1, maxItems: 8, items: { type: "object", properties: {
        op: { type: "string", enum: ["set_plan", "swap", "add", "remove", "next_weight"] },
        tpl: { type: "string", description: "id šablony (ne u next_weight)" }, ex: { type: "string", description: "id cviku" },
        to: { type: "string", description: "id nového cviku (swap)" }, sets: { type: "integer" }, lo: { type: "integer" }, hi: { type: "integer" },
        rest: { type: "integer" }, kg: { type: "number" }, note: { type: "string" } }, required: ["op", "ex"], additionalProperties: false } } },
      required: ["title", "why", "ops"], additionalProperties: false } }
].map(t => Object.assign(t, { eager_input_streaming: true }));

function coachFindExercise(q) {
  const s = String(q || "").trim();
  if (getExercise(s)) return getExercise(s);
  const n = norm(s);
  return S.exercises.find(e => norm(e.name) === n || norm(e.nameEn || "") === n)
    || S.exercises.find(e => norm(e.name).includes(n) || norm(e.nameEn || "").includes(n)) || null;
}
function coachSetsText(exId, sets) {
  return sets.map(st => `${st.weight ? fmtNum(st.weight, 2) + " kg × " : ""}${st.reps}${exKind(exId) === "time" ? " s" : ""}${st.rir != null ? " (RIR " + rirLabel(st.rir) + ")" : ""}${st.failure ? " (selhání)" : ""}${st.note ? " [" + st.note + "]" : ""}`).join(", ");
}
function coachPlanText() {
  const tpls = livePlanTemplates();
  const all = tpls.length ? tpls : S.templates;
  return all.map(t => `Šablona „${t.name}" (id ${t.id}):\n` + t.exercises.filter(getExercise).map(id => {
    const p = blockTarget(t.id, id, tplPlan(t, id), todayStr()) || tplPlan(t, id);
    const ns = nextSets(id, p, null);
    return `  - ${exName(id)} (id ${id}, ${exCategory(id)})${p ? `: ${planText(p, id)}${p.rir != null ? ", RIR " + p.rir : ""}${p.rest ? ", pauza " + p.rest + " s" : ""}` : ""}${ns.text ? " | appka na příště: " + ns.text : ""}`;
  }).join("\n")).join("\n");
}
function coachOverview() {
  const today = todayStr();
  const out = [`Dnes je ${today}.`];
  const g = S.goal || {};
  out.push(`Cíl stravy: ${g.dailyCalories} kcal, bílkoviny ${g.proteinGrams} g, sacharidy ${g.carbsGrams} g, tuky ${g.fatGrams} g. Týdenní cíl tréninků: ${Settings.get().weeklyGoal || "není"}.`);
  if (blockOn()) out.push(`Běží silový blok: ${blockWeekLine(today)} (do ${blockEnd()}). Série a RIR jsou dané týdnem bloku — objem během bloku neměň, pokud o to uživatel nestojí.`);
  const nx = nextTemplate();
  if (nx) out.push(`Na řadě je šablona „${nx.name}" (id ${nx.id}).`);
  out.push("\nPLÁN:\n" + coachPlanText());
  const from = addDays(today, -14);
  const sess = S.sessions.filter(s => s.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  out.push(`\nTRÉNINKY ZA 14 DNÍ (${sess.length}):\n` + (sess.map(s => s.type === "cardio"
    ? `${s.date}: kardio ${cardioLabel(s.entries && s.entries[0] || {})}`
    : `${s.date}: ${sessionLabel(s)} — ${sessionSets(s)} sérií, objem ${fmtNum(sessionVolume(s))} kg${s.rating ? ", hodnocení " + s.rating + "/10" : ""}${s.note ? ", poznámka: " + s.note : ""}`).join("\n") || "žádné"));
  const bw = S.bodyLog.slice(-10).map(b => `${b.date}: ${fmtNum(b.weightKg, 1)} kg`).join("; ");
  out.push(`\nVÁHA (posledních 10 zápisů): ${bw || "žádný zápis"}`);
  out.push("\nHODINKY: " + healthSummaryText(3));
  const props = planProposals();
  if (props.length) out.push("\nNÁVRHY APPKY (uživatel je ještě nepotvrdil):\n" + props.map(p => `- ${p.title}: ${p.why}`).join("\n"));
  if (S.planLog && S.planLog.length) out.push("\nPOSLEDNÍ ZMĚNY PLÁNU:\n" + S.planLog.slice(-5).map(l => `- ${l.date} (${l.source}): ${l.title}`).join("\n"));
  return out.join("\n");
}
/* Spustí nástroj; vrací {text, error?, proposal?} */
function coachRunTool(name, input) {
  const int = (v, def, min, max) => Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def;
  try {
    if (name === "get_overview") return { text: coachOverview() };
    if (name === "get_workouts") {
      const from = addDays(todayStr(), -int(input.days, 21, 1, 120));
      const sess = S.sessions.filter(s => s.date >= from && s.type === "weights").sort((a, b) => a.date.localeCompare(b.date));
      return { text: sess.map(s => `${s.date} ${sessionLabel(s)}${s.rating ? " (hodnocení " + s.rating + "/10)" : ""}${s.note ? " — " + s.note : ""}\n` +
        s.entries.map(e => `  ${exName(e.exerciseId)}: ${coachSetsText(e.exerciseId, e.sets || [])}`).join("\n")).join("\n").slice(0, 24000) || "V tom období není žádný silový trénink." };
    }
    if (name === "get_exercise_history") {
      const ex = coachFindExercise(input.exercise);
      if (!ex) return { text: `Cvik „${input.exercise}" v knihovně není. Zkus search_exercises.`, error: true };
      const hist = exerciseHistory(ex.id, null, 8);
      const rec = exerciseRecords(ex.id).best || {};
      const ns = nextSets(ex.id, null, null);
      return { text: `${ex.name} (id ${ex.id}, ${ex.category})\n` + (hist.map(h => `${h.date}: ${coachSetsText(ex.id, h.sets)}`).join("\n") || "bez zápisu") +
        (rec.e1rm ? `\nNejlepší odhad 1RM: ${fmtNum(est1RM(rec.e1rm.weight, rec.e1rm.reps), 1)} kg (${rec.e1rm.weight} × ${rec.e1rm.reps}, ${rec.e1rm.date})` : "") +
        (ns.stall ? `\nStojí ${ns.stall} tréninky po sobě.` : "") + (ns.text ? `\nAppka na příště: ${ns.text}` : "") };
    }
    if (name === "get_health") return { text: healthSummaryText(int(input.days, 14, 1, 60)) };
    if (name === "get_report") return { text: String(buildCoachReport(input.range === "month" ? "month" : "week")).slice(0, 24000) };
    if (name === "search_exercises") {
      const q = norm(input.query || "");
      const list = S.exercises.filter(e => (!input.category || e.category === input.category) && (!q || norm(e.name).includes(q) || norm(e.nameEn || "").includes(q))).slice(0, 40);
      return { text: list.map(e => `${e.id} — ${e.name}${e.nameEn ? " / " + e.nameEn : ""} (${e.category})`).join("\n") || "Nic nenalezeno." };
    }
    if (name === "propose_plan_change") {
      const ops = Array.isArray(input.ops) ? input.ops : [];
      if (typeof input.title !== "string" || typeof input.why !== "string" || !ops.length) return { text: "Chybí title, why nebo ops.", error: true };
      const bad = ops.map((op, i) => [i, planOpError(op)]).filter(x => x[1]);
      if (bad.length) return { text: "Návrh nejde zobrazit, oprav operace: " + bad.map(([i, e]) => `#${i + 1}: ${e}`).join("; "), error: true };
      const proposal = { id: uid(), title: input.title.slice(0, 80), why: input.why.slice(0, 400), ops, state: "pending" };
      return { text: "Návrh je zobrazený uživateli jako karta a čeká na jeho klepnutí (Potvrdit / Zamítnout). Zatím se nic nezměnilo.", proposal };
    }
    return { text: "Neznámý nástroj.", error: true };
  } catch (e) {
    return { text: "Nástroj selhal: " + e.message, error: true };
  }
}
const COACH_TOOL_LABEL = { get_overview: "přehled a plán", get_workouts: "tréninky", get_exercise_history: "historie cviku", get_health: "data z hodinek",
  get_report: "report", search_exercises: "knihovna cviků", propose_plan_change: "návrh úpravy" };

function coachSystem() {
  return `Jsi osobní silový trenér uvnitř mobilní appky Fitness Log. Mluvíš s jejím jediným uživatelem: trénuje sám v posilovně, cílem je nabírání svalové hmoty a tvarování postavy.

Jak pracuješ:
- Než začneš radit, podívej se do dat nástroji (get_overview jako první, pak podle potřeby podrobnosti). Opírej se o konkrétní čísla z dat a nic si nedomýšlej; když data chybí, řekni to.
- Odpovídej česky, tykej, stručně — čte se to na telefonu mezi sériemi. Nejdřív závěr, pak nejvýš pár bodů proč. Žádné dlouhé úvody.
- Váhy jsou v kilogramech. RIR = opakování v záloze.
- Plán měníš jen nástrojem propose_plan_change: uživatel návrh uvidí jako kartu a sám ho potvrdí. Nikdy netvrď, že je změna provedená. Navrhuj malé, zdůvodněné kroky (jedna až tři operace), ne přestavbu celého plánu, pokud o ni výslovně nestojí.
- Appka sama počítá dvojitou progresi (všechny série na horní hranici rozsahu → přidat nejmenší krok váhy; dvakrát pod spodní hranicí → ubrat 10 %). S tím počítej a doplňuj to, co pravidla nevidí: souvislosti se spánkem a regenerací, výběr cviků, objem na partii, techniku, stravu.
- Nejsi lékař. U bolesti, která nepřechází, nebo zdravotních potíží doporuč odborníka a neraď přes bolest.`;
}

/* ---- volání API (SSE) ---- */
async function coachRequest(messages, onText, signal) {
  if (CO.grok) return grokRequest(messages, onText, signal);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", signal,
    headers: { "content-type": "application/json", "x-api-key": coachKey(), "anthropic-version": "2026-10-21",
      "anthropic-beta": "server-side-fallback-2026-07-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: coachModel(), max_tokens: 16000, stream: true, fallbacks: "default",
      system: [{ type: "text", text: coachSystem(), cache_control: { type: "ephemeral" } }],
      tools: COACH_TOOLS, messages })
  });
  if (!res.ok) {
    let msg = "HTTP " + res.status;
    try { const j = await res.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch (e) { /* tělo není JSON */ }
    const err = new Error(res.status === 401 ? "API klíč nesedí — zkontroluj ho v Nastavení." : res.status === 429 ? "Limit požadavků nebo kreditu — zkus to za chvíli." : res.status === 529 ? "Claude je teď přetížený — zkus to za chvíli." : msg);
    err.status = res.status;
    throw err;
  }
  const blocks = [], partial = {};
  let stop = null, usage = null;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const handle = ev => {
    if (ev.type === "content_block_start") {
      blocks[ev.index] = ev.content_block;
      if (ev.content_block.type === "tool_use") partial[ev.index] = "";
    } else if (ev.type === "content_block_delta") {
      const b = blocks[ev.index], d = ev.delta || {};
      if (!b) return;
      if (d.type === "text_delta") { b.text = (b.text || "") + d.text; onText(d.text); }
      else if (d.type === "thinking_delta") b.thinking = (b.thinking || "") + d.thinking;
      else if (d.type === "signature_delta") b.signature = (b.signature || "") + d.signature;
      else if (d.type === "input_json_delta") partial[ev.index] += d.partial_json;
    } else if (ev.type === "content_block_stop") {
      const b = blocks[ev.index];
      if (b && b.type === "tool_use") {
        /* vstup nástroje se skládá z kousků — parsuje se přísně; rozbitý JSON se nespustí */
        try { b.input = partial[ev.index] ? JSON.parse(partial[ev.index]) : {}; }
        catch (e) { b.input = {}; b._bad = partial[ev.index]; }
      }
    } else if (ev.type === "message_delta") {
      if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
      if (ev.usage) usage = ev.usage;
    } else if (ev.type === "error") {
      throw new Error((ev.error && ev.error.message) || "Chyba ve streamu");
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let at;
    while ((at = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, at);
      buf = buf.slice(at + 2);
      const data = chunk.split("\n").filter(l => l.startsWith("data:")).map(l => l.slice(5).trim()).join("");
      if (data) handle(JSON.parse(data));
    }
  }
  return { content: blocks.filter(Boolean), stop, usage };
}

async function coachSend(text) {
  text = String(text || "").trim();
  if (!text || CO.busy) return;
  if (!CO.grok && !coachKey()) { toast("Nejdřív vlož API klíč", "err"); return; }
  if (!navigator.onLine) { toast("Trenér potřebuje připojení k internetu", "err"); return; }
  coachLoad();
  CO.err = null; CO.busy = true; CO.draft = "";
  CO.items.push({ role: "user", text });
  const item = { role: "assistant", text: "", tools: [] };
  CO.items.push(item);
  const apiStart = CO.api.length;
  CO.api.push({ role: "user", content: text });
  CO.abort = new AbortController();
  coachPaint();
  try {
    for (let turn = 0; turn < COACH_MAX_TURNS; turn++) {
      if (item.text && !item.text.endsWith("\n\n")) item.text += "\n\n";
      const r = await coachRequest(CO.api, t => { item.text += t; coachPaintLast(item); }, CO.abort.signal);
      if (r.stop === "refusal") {
        /* odmítnutí: částečný výstup se zahazuje a kolo se do historie nedává */
        CO.api.length = apiStart;
        item.text = "Na tohle Claude odpovědět odmítl. Zkus se zeptat jinak.";
        item.tools = [];
        break;
      }
      const uses = r.content.filter(b => b.type === "tool_use");
      CO.api.push({ role: "assistant", content: r.content.map(b => { if (b._bad === undefined) return b; const c = Object.assign({}, b); delete c._bad; return c; }) });
      if (r.stop !== "tool_use" || !uses.length) {
        if (r.stop === "max_tokens") item.text += "\n\n_(odpověď se nevešla celá)_";
        break;
      }
      const results = [];
      for (const u of uses) {
        const out = u._bad !== undefined ? { text: "INVALID_JSON: vstup nástroje nešel přečíst: " + String(u._bad).slice(0, 300), error: true } : coachRunTool(u.name, u.input || {});
        if (!item.tools.includes(u.name)) item.tools.push(u.name);
        if (out.proposal) item.proposals = (item.proposals || []).concat(out.proposal);
        results.push(Object.assign({ type: "tool_result", tool_use_id: u.id, content: out.text }, out.error ? { is_error: true } : {}));
      }
      CO.api.push({ role: "user", content: results });
      coachPaint();
      if (turn === COACH_MAX_TURNS - 1) item.text += "\n\n_(přerušeno — příliš mnoho kroků)_";
    }
    if (!item.text.trim() && !(item.proposals || []).length) item.text = "Nepřišla žádná odpověď. Zkus to znovu.";
  } catch (e) {
    /* nedokončené kolo se z historie pro API vrátí, ať další zpráva nenaváže na rozbitý stav */
    CO.api.length = apiStart;
    if (e.name === "AbortError") { item.text = (item.text.trim() ? item.text + "\n\n" : "") + "_(zastaveno)_"; }
    else { CO.err = e.message || "Spojení selhalo"; if (!item.text.trim()) CO.items.pop(); }
  }
  CO.busy = false; CO.abort = null;
  item.text = item.text.trim();
  coachSave();
  coachPaint();
}

/* ---- vykreslení ---- */
/* malý Markdown: tučné, kurzíva, kód, odrážky, nadpisy jako tučný řádek */
function coachMd(src) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])_(.+?)_(?=[\s).,!?]|$)/g, "$1<i>$2</i>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const out = [];
  let list = null;
  const flush = () => { if (list) { out.push(`<${list.t}>${list.items.map(i => `<li>${i}</li>`).join("")}</${list.t}>`); list = null; } };
  for (const raw of String(src || "").split("\n")) {
    const line = raw.trimEnd();
    let m;
    if ((m = /^\s*[-*•]\s+(.*)$/.exec(line))) { if (!list || list.t !== "ul") { flush(); list = { t: "ul", items: [] }; } list.items.push(inline(m[1])); }
    else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) { if (!list || list.t !== "ol") { flush(); list = { t: "ol", items: [] }; } list.items.push(inline(m[1])); }
    else { flush(); if ((m = /^#{1,4}\s+(.*)$/.exec(line))) out.push(`<p><b>${inline(m[1])}</b></p>`); else if (line.trim()) out.push(`<p>${inline(line)}</p>`); }
  }
  flush();
  return out.join("");
}
function coachProposalHtml(p) {
  const done = p.state === "applied" ? `<div class="cp-state ok">${ic("check", 15, 2.8)} Potvrzeno — plán je upravený</div>`
    : p.state === "rejected" ? `<div class="cp-state">Zamítnuto</div>`
    : `<div class="btn-row"><button class="btn" data-act="co-reject" data-id="${p.id}">Zamítnout</button>
        <button class="btn primary" data-act="co-apply" data-id="${p.id}">${ic("check", 16, 2.6)} Potvrdit</button></div>`;
  return `<div class="card cp" id="cp-${p.id}">
      <div class="cp-title">${esc(p.title)}</div>
      <div class="cp-sub">${ic("spark", 13)} Návrh úpravy plánu${p.state === "pending" ? " · čeká na tebe" : ""}</div>
      <p class="cp-why">${esc(p.why)}</p>
      <ul class="cp-ops">${p.ops.map(op => `<li>${esc(describeOp(op))}</li>`).join("")}</ul>
      ${done}</div>`;
}
function coachItemHtml(it, last) {
  if (it.role === "user") return `<div class="co-msg me"><div class="co-bub">${esc(it.text).replace(/\n/g, "<br>")}</div></div>`;
  const tools = (it.tools || []).length ? `<div class="co-tools">${ic("search", 12)} ${it.tools.map(t => COACH_TOOL_LABEL[t] || t).join(" · ")}</div>` : "";
  const wait = last && CO.busy && !it.text ? `<div class="co-wait" aria-label="Trenér přemýšlí"><i></i><i></i><i></i></div>` : "";
  return `<div class="co-msg">${tools}${it.text ? `<div class="co-bub md">${coachMd(it.text)}</div>` : ""}${wait}${(it.proposals || []).map(coachProposalHtml).join("")}</div>`;
}
const COACH_PROMPTS = ["Zhodnoť můj poslední týden", "Co mám dnes trénovat a s jakými váhami?", "Kde stagnuju a co s tím?", "Uprav mi plán podle výsledků"];

function coachHead() {
  coachLoad();
  const who = CO.grok ? "Grok" : "Claude";
  return { title: "Trenér", sub: (CO.grok || coachKey()) ? `${who} · vidí tréninky, plán a data z hodinek` : "Osobní trenér přímo v appce",
    right: CO.items.length ? `<button class="iconbtn" data-act="co-clear" aria-label="Nová konverzace">${ic("edit", 20)}</button>` : "" };
}
function renderCoach() {
  coachLoad();
  if (CO.grok === undefined) {
    coachProbeGrok().then(() => { if (coachVisible()) render(); });
    return `<div class="co-empty"><p>Připojuju trenéra…</p></div>`;
  }
  if (!CO.grok && !coachKey()) {
    return `<div class="card co-setup">
        <div class="co-setup-ic">${ic("spark", 26)}</div>
        <h2>Připoj Clauda jako trenéra</h2>
        <p>Trenér vidí tvoje tréninky, plán, váhu, stravu a data z hodinek. Poradí, co dnes, proč cvik stojí, a navrhne úpravu plánu — tu vždy potvrzuješ ty.</p>
        <label class="field"><span>Claude API klíč</span>
          <input class="input" id="coKey" type="password" autocomplete="off" placeholder="sk-ant-…" data-change="co-key"></label>
        <button class="btn primary full" data-act="co-key-save">Připojit</button>
        <p class="cap">Klíč si vytvoříš na console.anthropic.com → API keys. Zůstává jen v tomhle telefonu a platíš jím každou zprávu ze svého kreditu (stejný klíč čte i etikety jídel). Dotazy s tvými daty odcházejí na api.anthropic.com.</p>
      </div>`;
  }
  const list = CO.items.map((it, i) => coachItemHtml(it, i === CO.items.length - 1)).join("");
  const empty = !CO.items.length ? `<div class="co-empty">
      <p>Zeptej se na cokoli k tréninku. Trenér si nejdřív sám načte tvoje data.</p>
      <div class="co-chips">${COACH_PROMPTS.map(p => `<button class="chip" data-act="co-prompt" data-q="${esc(p)}">${esc(p)}</button>`).join("")}</div>
    </div>` : "";
  return `
    <div class="co-list" id="coList" aria-live="polite">${empty}${list}</div>
    ${CO.err ? `<div class="co-err" role="alert">${ic("alert", 15)} ${esc(CO.err)}</div>` : ""}
    <form class="co-compose" id="coForm" data-act-submit="co-send">
      <textarea class="input" id="coInput" rows="1" placeholder="Napiš trenérovi…" aria-label="Zpráva trenérovi" data-change="co-draft">${esc(CO.draft)}</textarea>
      ${CO.busy ? `<button type="button" class="co-send stop" data-act="co-stop" aria-label="Zastavit">${ic("x", 18, 2.6)}</button>`
        : `<button type="button" class="co-send" data-act="co-send" aria-label="Odeslat">${ic("send", 19, 2.4)}</button>`}
    </form>`;
}
function coachVisible() { return App.route.tab === "coach" && !App.route.page; }
function coachPaint() {
  if (!coachVisible()) return;
  render();
  window.scrollTo(0, document.documentElement.scrollHeight);
}
/* během streamu se přepisuje jen poslední bublina — celá obrazovka by blikala */
let _coRaf = 0;
function coachPaintLast(item) {
  if (!coachVisible() || _coRaf) return;
  _coRaf = requestAnimationFrame(() => {
    _coRaf = 0;
    const list = document.getElementById("coList");
    const el = list && list.lastElementChild;
    if (!el) return;
    const near = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 140;
    el.outerHTML = coachItemHtml(item, true);
    if (near) window.scrollTo(0, document.documentElement.scrollHeight);
  });
}
function coachFindProposal(id) {
  for (const it of CO.items) for (const p of it.proposals || []) if (p.id === id) return p;
  return null;
}

const COACH_ACTIONS = {
  "co-key-save": () => {
    const v = (document.getElementById("coKey").value || "").trim();
    if (!/^sk-ant-/.test(v)) { toast("Klíč má začínat sk-ant-…", "err"); return; }
    Settings.set({ anthropicApiKey: v });
    render();
    toast("Trenér připojen ✓", "ok");
  },
  "co-send": () => { const el = document.getElementById("coInput"); if (el) coachSend(el.value); },
  "co-prompt": d => coachSend(d.q),
  "co-stop": () => { if (CO.abort) CO.abort.abort(); },
  "co-clear": () => {
    if (CO.busy) return;
    CO.items = []; CO.api = []; CO.err = null;
    coachSave(); render({ top: true });
  },
  "co-apply": d => {
    const p = coachFindProposal(d.id);
    if (!p || p.state !== "pending") return;
    const bad = p.ops.map(planOpError).filter(Boolean);
    if (bad.length === p.ops.length) { toast("Návrh už na plán nesedí: " + bad[0], "err"); return; }
    withUndo("Plán upraven podle trenéra", () => { applyPlanOps(p.ops, p.title, "trenér"); });
    p.state = "applied";
    coachSave(); render();
  },
  "co-reject": d => {
    const p = coachFindProposal(d.id);
    if (!p || p.state !== "pending") return;
    p.state = "rejected";
    coachSave(); render();
  }
};
function coachChange(t) {
  if (t.dataset.change === "co-draft") { CO.draft = t.value; return true; }
  if (t.dataset.change === "co-key") return true;
  if (t.dataset.change === "set-coach-model") { Settings.set({ coachModel: t.value }); toast("Model trenéra uložen ✓", "ok"); return true; }
  return false;
}
/* Enter odešle, Shift+Enter nový řádek; pole roste s textem */
document.addEventListener("keydown", e => {
  if (e.target && e.target.id === "coInput" && e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); coachSend(e.target.value); }
});
document.addEventListener("input", e => {
  if (e.target && e.target.id === "coInput") { const t = e.target; CO.draft = t.value; t.style.height = "auto"; t.style.height = Math.min(140, t.scrollHeight) + "px"; }
});

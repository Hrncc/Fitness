/* ===== Apple Health (v5.0) =====
   Webová appka na iPhonu k Apple Health sama nesmí (HealthKit je jen pro
   nativní appky). Data z hodinek proto nosí Zkratka na iPhonu: jednou denně
   přečte ze Zdraví klidový tep, HRV, spánek, kroky, aktivní energii, váhu
   a tréninky z hodinek a pošle je na stejnou adresu jako sync (Apps Script,
   list HEALTH). Appka je dostane s každým načtením syncu.

   Ve stavu: S.health = { days: { "2026-11-11": {rhr, hrv, sleep, steps, kcal,
   weight, at} }, workouts: [{id, date, type, start, min, kcal, hr}] }.
   Slévá se podle dne / id (mergeHealth), drží se posledních 180 dní.
   Živý tep během tréninku touhle cestou nejde — jen souhrny po dnech. */
"use strict";

const HEALTH_KEEP_DAYS = 180;
const HEALTH_FIELDS = ["rhr", "hrv", "sleep", "steps", "kcal", "weight"];

function healthNum(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  const hm = /^(\d+):(\d{1,2})$/.exec(s);                 // „7:24" → hodiny
  if (hm) return Number(hm[1]) + Number(hm[2]) / 60;
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
/* jeden den ze Zkratky / serveru → čistý záznam (null = nepoužitelné) */
function healthCleanDay(raw) {
  if (!raw || typeof raw !== "object") return null;
  const d = {};
  for (const k of HEALTH_FIELDS) { const n = healthNum(raw[k]); if (n != null && n >= 0) d[k] = n; }
  if (d.sleep != null && d.sleep > 24) d.sleep = d.sleep / 60;          // minuty → hodiny
  if (d.sleep != null) d.sleep = Math.round(d.sleep * 100) / 100;
  if (d.rhr != null && (d.rhr < 25 || d.rhr > 140)) delete d.rhr;
  if (d.hrv != null && d.hrv > 300) delete d.hrv;
  if (d.weight != null && (d.weight < 30 || d.weight > 250)) delete d.weight;
  for (const k of ["steps", "kcal", "rhr", "hrv"]) if (d[k] != null) d[k] = Math.round(d[k]);
  if (!Object.keys(d).length) return null;
  d.at = healthNum(raw.at) || Date.now();
  return d;
}
/* tréninky z hodinek: pole objektů, nebo text „typ|začátek|minuty|kcal|tep" po řádcích */
function healthCleanWorkouts(raw) {
  const list = typeof raw === "string"
    ? raw.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => { const p = l.split("|"); return { type: p[0], start: p[1], min: p[2], kcal: p[3], hr: p[4] }; })
    : Array.isArray(raw) ? raw : [];
  const out = [];
  for (const w of list) {
    if (!w) continue;
    const start = String(w.start || w.date || "").trim();
    const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(start);
    if (!m) continue;
    const type = String(w.type || "Trénink").trim().slice(0, 40) || "Trénink";
    const o = { id: w.id ? String(w.id).slice(0, 80) : `${m[0]}|${type}`, date: m[1], type };
    if (m[2]) o.start = `${m[2].padStart(2, "0")}:${m[3]}`;
    for (const [k, max] of [["min", 1440], ["kcal", 20000], ["hr", 240]]) { const n = healthNum(w[k]); if (n != null && n > 0 && n <= max) o[k] = Math.round(n); }
    out.push(o);
  }
  return out;
}
function mergeHealth(a, b) {
  if (!a && !b) return undefined;
  const days = {};
  for (const src of [a, b]) for (const [date, d] of Object.entries((src && src.days) || {})) {
    if (!days[date] || (d.at || 0) >= (days[date].at || 0)) days[date] = Object.assign({}, days[date], d);
  }
  const map = new Map();
  for (const src of [a, b]) for (const w of (src && src.workouts) || []) map.set(w.id, w);
  const min = addDays(todayStr(), -HEALTH_KEEP_DAYS);
  for (const k of Object.keys(days)) if (k < min) delete days[k];
  return { days, workouts: [...map.values()].filter(w => w.date >= min).sort((x, y) => (x.date + (x.start || "")).localeCompare(y.date + (y.start || ""))) };
}
/* Přijme data (ze serveru, ze schránky): {days: {...}, workouts: [...]} nebo
   jeden den {date, rhr, …, workouts}. Vrací počet nových / změněných dnů a tréninků. */
function healthIngest(payload) {
  if (!payload || typeof payload !== "object") return 0;
  const inc = { days: {}, workouts: [] };
  if (payload.days && typeof payload.days === "object") {
    for (const [date, raw] of Object.entries(payload.days)) { const d = /^\d{4}-\d{2}-\d{2}$/.test(date) && healthCleanDay(raw); if (d) inc.days[date] = d; }
  }
  if (payload.date || HEALTH_FIELDS.some(k => payload[k] != null)) {
    const date = /^\d{4}-\d{2}-\d{2}/.test(String(payload.date || "")) ? String(payload.date).slice(0, 10) : todayStr();
    const d = healthCleanDay(payload);
    if (d) inc.days[date] = d;
  }
  inc.workouts = healthCleanWorkouts(payload.workouts);
  const before = JSON.stringify(S.health || null);
  const merged = mergeHealth(S.health, inc);
  let n = 0;
  const old = S.health || { days: {}, workouts: [] };
  for (const [date, d] of Object.entries(inc.days)) {
    const o = old.days[date];
    if (!o || HEALTH_FIELDS.some(k => d[k] != null && d[k] !== o[k])) n++;
  }
  const ids = new Set(old.workouts.map(w => w.id));
  n += inc.workouts.filter(w => !ids.has(w.id)).length;
  if (JSON.stringify(merged) === before) return 0;
  S.health = merged;
  /* váha ze Zdraví doplní dny, kdy v appce žádná není — ruční zápis nepřepisuje */
  for (const [date, d] of Object.entries(inc.days)) {
    if (d.weight != null && !S.bodyLog.some(b => b.date === date)) S.bodyLog.push({ date, weightKg: Math.round(d.weight * 10) / 10, at: d.at, src: "health" });
  }
  S.bodyLog.sort((x, y) => x.date.localeCompare(y.date));
  return n || 1;
}

function healthDay(date) { return (S.health && S.health.days && S.health.days[date]) || null; }
function healthHas() { return !!(S.health && (Object.keys(S.health.days || {}).length || (S.health.workouts || []).length)); }
function healthLastDate() { return S.health ? Object.keys(S.health.days || {}).sort().pop() || null : null; }
function healthWorkoutsOn(date) { return ((S.health && S.health.workouts) || []).filter(w => w.date === date); }
/* průměr pole za n dní před datem (bez něj); null, když je dní málo */
function healthBaseline(field, date, n = 14, min = 5) {
  const vals = [];
  for (let k = 1; k <= n; k++) { const d = healthDay(addDays(date, -k)); if (d && d[field] != null) vals.push(d[field]); }
  return vals.length >= min ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
/* Připravenost: tři jednoduché signály proti vlastnímu 14dennímu průměru.
   Žádné skóre na desetiny — jen „dobře / běžný den / unavené tělo" a proč. */
function healthReadiness(date = todayStr()) {
  const d = healthDay(date);
  if (!d) return null;
  const lines = [];
  let score = 0, used = 0;
  const bh = healthBaseline("hrv", date), br = healthBaseline("rhr", date);
  if (d.hrv != null) {
    let tone = "";
    if (bh != null) { used++; if (d.hrv >= bh * 0.95) { score++; tone = "up"; } else if (d.hrv <= bh * 0.85) { score--; tone = "down"; } }
    lines.push({ key: "hrv", label: "HRV", value: `${d.hrv} ms`, sub: bh != null ? `Ø ${Math.round(bh)}` : "", tone });
  }
  if (d.rhr != null) {
    let tone = "";
    if (br != null) { used++; if (d.rhr <= br + 2) { score++; tone = "up"; } else if (d.rhr >= br + 6) { score--; tone = "down"; } }
    lines.push({ key: "rhr", label: "Klidový tep", value: `${d.rhr}`, sub: br != null ? `Ø ${Math.round(br)}` : "", tone });
  }
  if (d.sleep != null) {
    used++;
    const tone = d.sleep >= 7 ? "up" : d.sleep < 6 ? "down" : "";
    score += tone === "up" ? 1 : tone === "down" ? -1 : 0;
    const h = Math.floor(d.sleep), m = Math.round((d.sleep - h) * 60);
    lines.push({ key: "sleep", label: "Spánek", value: `${h} h ${m ? m + " min" : ""}`.trim(), sub: "", tone });
  }
  if (!lines.length) return null;
  const level = used < 2 ? "na" : score >= 2 ? "good" : score <= -1 ? "low" : "ok";
  const title = { good: "Dobře zregenerováno", ok: "Běžný den", low: "Tělo je unavené", na: "Málo dat na úsudek" }[level];
  const tip = { good: "Dnes můžeš jít do plánu naplno.", ok: "Jeď podle plánu.",
    low: "Drž váhy z minula a klidně uber sérii — progres počká.", na: "Po pár dnech dat ukáže srovnání s tvým průměrem." }[level];
  return { level, title, tip, lines, day: d };
}
/* textový souhrn pro trenéra a report */
function healthSummaryText(days = 14) {
  if (!healthHas()) return "Data z Apple Health nejsou připojená.";
  const out = [];
  for (let k = 0; k < days; k++) {
    const date = addDays(todayStr(), -k), d = healthDay(date), ws = healthWorkoutsOn(date);
    if (!d && !ws.length) continue;
    const bits = [];
    if (d) for (const [k2, lbl, unit] of [["sleep", "spánek", "h"], ["hrv", "HRV", "ms"], ["rhr", "klid. tep", ""], ["steps", "kroky", ""], ["kcal", "aktivní", "kcal"], ["weight", "váha", "kg"]]) {
      if (d[k2] != null) bits.push(`${lbl} ${k2 === "sleep" ? d.sleep.toFixed(1) : d[k2]}${unit ? " " + unit : ""}`);
    }
    for (const w of ws) bits.push(`hodinky: ${w.type}${w.min ? " " + w.min + " min" : ""}${w.kcal ? " " + w.kcal + " kcal" : ""}${w.hr ? " Ø tep " + w.hr : ""}`);
    out.push(`${date}: ${bits.join(", ")}`);
  }
  const r = healthReadiness();
  return (r ? `Dnešní připravenost: ${r.title}. ` : "") + (out.length ? "\n" + out.join("\n") : "Za poslední dny nepřišla žádná data.");
}
function healthWatchLine(w) {
  return [w.start ? "od " + w.start : "", w.min ? `${w.min} min` : "", w.kcal ? `${fmtNum(w.kcal)} kcal` : "", w.hr ? `Ø ${w.hr} tepů` : ""].filter(Boolean).join(" · ");
}

/* ---- karta na Přehledu ---- */
function healthCardHtml() {
  const today = todayStr();
  const r = healthReadiness(today) || healthReadiness(addDays(today, -1));
  if (!r) return "";
  const isToday = !!healthDay(today);
  const d = r.day;
  const extra = [d.steps != null ? `${ic("steps", 14)} ${fmtNum(d.steps)} kroků` : "", d.kcal != null ? `${ic("flame", 14)} ${fmtNum(d.kcal)} kcal` : ""].filter(Boolean).join("");
  return `
    <button class="card ready lv-${r.level}" data-act="menu" data-page="health">
      <div class="ready-top">
        <span class="ready-ic">${ic("heart", 18)}</span>
        <div class="grow">
          <div class="ready-title">${r.title}</div>
          <div class="ready-sub">${isToday ? "" : "Včera · "}${r.tip}</div>
        </div>
        ${ic("chevR", 16, 2.2)}
      </div>
      <div class="ready-stats">${r.lines.map(l => `
        <div class="ready-stat"><span>${l.label}</span><b class="num">${l.value}</b>
          <small class="${l.tone}">${l.tone === "up" ? ic("check", 11, 3) : l.tone === "down" ? ic("alert", 11, 2.4) : ""}${l.sub}</small></div>`).join("")}</div>
      ${extra ? `<div class="ready-extra">${extra}</div>` : ""}
    </button>`;
}

/* ---- stránka Apple Health ---- */
const HV = { paste: false };
function renderHealth() {
  const has = healthHas();
  const last = healthLastDate();
  const url = Sync.url();
  const out = [];
  if (has) {
    const days = Object.keys(S.health.days).sort().reverse().slice(0, 14);
    out.push(healthCardHtml());
    out.push(sec("Posledních 14 dní", `<div class="card hl-table">
        <div class="hl-row hl-th"><span>Den</span><span>Spánek</span><span>HRV</span><span>Tep</span><span>Kroky</span></div>
        ${days.map(date => { const d = S.health.days[date]; return `<div class="hl-row"><span>${fmtShort(date)}</span>
          <b class="num">${d.sleep != null ? fmtNum(d.sleep, 1) + " h" : "–"}</b><b class="num">${d.hrv != null ? d.hrv : "–"}</b>
          <b class="num">${d.rhr != null ? d.rhr : "–"}</b><b class="num">${d.steps != null ? fmtNum(d.steps) : "–"}</b></div>`; }).join("")}
      </div>`, { sub: `Naposledy ${last ? relDay(last) : "–"} · ${Object.keys(S.health.days).length} dní celkem` }));
    const ws = (S.health.workouts || []).slice(-8).reverse();
    if (ws.length) out.push(sec("Tréninky z hodinek", `<div class="card rows">${ws.map(w => `
        <div class="hw-row"><span class="hw-ic">${ic("watch", 18)}</span><div class="grow"><div class="name">${esc(w.type)}</div>
        <div class="small">${fmtShort(w.date)}${healthWatchLine(w) ? " · " + healthWatchLine(w) : ""}</div></div></div>`).join("")}</div>`));
  } else {
    out.push(`<div class="card"><div class="empty-note">Zatím žádná data z hodinek.<br>Nastav Zkratku podle návodu níž — pak tu uvidíš spánek, HRV, klidový tep, kroky a tréninky z Apple Watch.</div></div>`);
  }
  out.push(sec("Jak to připojit", `<div class="card hl-guide">
      <p>Webová appka na iPhonu se k Apple Health sama nedostane — to Apple dovoluje jen appkám z App Storu. Data proto jednou denně pošle <b>Zkratka</b>.</p>
      <ol>
        <li><b>Sync musí být zapnutý</b> (Profil → Záloha a export). ${url ? "Máš ho nastavený." : `<span class="warn-text">${ic("alert", 13)} Zatím nastavený není.</span>`}</li>
        <li>V Google Sheetu se syncem otevři <b>Rozšíření → Apps Script</b>, vlož novou verzi <code>Code.gs</code> z repa a dej <b>Nasadit → Spravovat nasazení → upravit → Nová verze</b>. Adresa zůstane stejná.</li>
        <li>V appce <b>Zkratky</b> vytvoř zkratku: akce <b>Najít zdravotní vzorky</b> (klidový tep, variabilita tepu, spánek, kroky, aktivní energie, hmotnost) a <b>Najít tréninky</b>, na konci <b>Získat obsah URL</b> — metoda POST, tělo JSON s poli níž.</li>
        <li>V záložce <b>Automatizace</b> ji nech spouštět každé ráno. Appka si data vezme při dalším otevření.</li>
      </ol>
      <div class="hl-code" aria-label="Pole, která Zkratka posílá">kind: health · date: 2026-11-11 · rhr · hrv · sleep (hodiny) · steps · kcal · weight · workouts („Běh|2026-11-10T17:05|32|310|148" po řádcích)</div>
      <div class="btn-row">
        ${url ? `<button class="btn" data-act="hl-copy-url">${ic("copy", 15)} Zkopírovat adresu pro Zkratku</button>` : `<button class="btn" data-act="menu" data-page="export">Nastavit sync</button>`}
        ${url ? `<button class="btn" data-act="hl-refresh">${ic("cloud", 15)} Načíst teď</button>` : ""}
      </div>
      <p class="cap">Podrobný postup krok za krokem je v souboru SETUP_HEALTH.md v repu. Zkratka zatím nebyla vyzkoušená na skutečném telefonu — kdyby některý krok neseděl, uprav ho podle toho, co Zkratky nabízejí.</p>
    </div>`));
  out.push(sec("Ručně", `<div class="card">
      <p class="cap" style="margin:0 0 10px">Bez syncu jde data vložit i ručně — Zkratka je zkopíruje do schránky jako JSON a tady je vložíš.</p>
      <textarea class="input" id="hlPaste" rows="3" placeholder='{"date":"2026-11-11","rhr":52,"hrv":64,"sleep":7.4,"steps":8400}'></textarea>
      <div class="btn-row"><button class="btn" data-act="hl-paste">Vložit data</button>
      ${has ? `<button class="btn text danger" data-act="hl-clear">Smazat data z hodinek</button>` : ""}</div>
    </div>`));
  return out.join("");
}

const HEALTH_ACTIONS = {
  "hl-copy-url": () => {
    const url = Sync.url();
    if (!url) return;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
      () => toast("Adresa zkopírována — vlož ji do akce Získat obsah URL ✓", "ok"),
      () => toast("Zkopírovat se nepovedlo — adresa je v Záloze a exportu", "err"));
  },
  "hl-refresh": async () => {
    const ok = await Sync.cloudLoad();
    render();
    toast(ok ? (healthHas() ? "Data z hodinek načtena ✓" : "Sync běží, ale data z hodinek na serveru zatím nejsou") : "Načtení selhalo: " + (Sync.lastError || ""), ok ? "ok" : "err");
  },
  "hl-paste": () => {
    const el = document.getElementById("hlPaste");
    let data = null;
    try { data = JSON.parse(el.value); } catch (e) { toast("Tohle není platný JSON", "err"); return; }
    const n = healthIngest(data);
    if (!n) { toast("V datech nebylo nic nového", "err"); return; }
    save(); render();
    toast("Data z hodinek vložena ✓", "ok");
  },
  "hl-clear": () => withUndo("Data z hodinek smazána", () => { delete S.health; })
};
function healthChange() { return false; }

/* ===== Silový blok — mezocyklus (v4.2) =====
   Plán A „Full body 3×" na 2. 11. – 20. 12. 2026 z rozboru „Silový blok
   listopad–prosinec". Vrstva nad šablonami: migrace jednou založí šablony
   Blok A/B/C s plánem (série, rozsah, pauza) a cviky napojí na ty, které už
   v knihovně jsou — historie, rekordy a návrhy progrese navazují. Týden bloku
   pak při startu tréninku upraví cíl cviku (série navíc v T3/T5, deload v T7,
   cílové RIR, start váha, krok váhy). Mimo blok (před startem, po deloadu,
   po „Ukončit blok") appka jede jako dřív. */
"use strict";

/* blkEx(název, [známá id], partie, série, od, do, RIR druh, pauza s, {ramp, w, pair, src, alt, inc, aka, id})
   RIR druh: c = vícekloubový (2 → 1), i = izolace (1 → 0), t = technika (3 → 2,
   rumunské mrťáky a pendulum drží celý blok RIR 2 a víc). ramp = od kterého
   týdne +1 série. w = start váha v kg (pair = jednoručky, váha na ruku).
   inc = nejmenší krok váhy, když jsou všechny série na horní hranici. */
const blkEx = (n, ids, cat, sets, lo, hi, rir, rest, o = {}) => Object.assign({ n, ids, cat, sets, lo, hi, rir, rest, inc: 2.5 }, o);

const BLOCK = {
  id: "blk-2026-11",
  title: "Silový blok",
  plan: "Full body 3×",
  start: "2026-11-02",
  sessionsGoal: 18,            // 6 tréninkových týdnů × 3, deload se nepočítá
  weeks: [
    { rir: "RIR 3", note: "Zavedení: najdi váhy u nových cviků, nohy zlehka." },
    { rir: "RIR 2 / 1", note: "Plný plán, dvojitá progrese." },
    { rir: "RIR 2 / 1", note: "+1 série: leg press a rumunské mrtvé tahy." },
    { rir: "RIR 1 / 0–1", note: "Vyšší úsilí, stejný objem." },
    { rir: "RIR 1 / 0–1", note: "+1 série: předkopávání a pendulum." },
    { rir: "RIR 1 / 0", note: "Nejtěžší týden, izolace klidně do selhání." },
    { rir: "RIR 3–4", note: "Deload: o ~40 % méně sérií, stejné váhy, běh lehce.", deload: true }
  ],
  rir: {
    c: ["3", "2", "2", "1", "1", "1", "3–4"],
    i: ["3", "1", "1", "0–1", "0–1", "0", "3–4"],
    t: ["3", "3", "3", "2", "2", "2", "3–4"]
  },
  week: [["Po", "A"], ["Út", null, "běh lehce"], ["St", "B"], ["Čt", null, "volno"],
    ["Pá", "C"], ["So", null, "volno"], ["Ne", null, "běh dlouhý"]],
  days: {
    A: { focus: "nohy: kvadricepsy", min: "77–82 min", ex: [
      blkEx("Leg press", ["cp-a3"], "Nohy", 3, 8, 12, "c", 150, { ramp: 3, w: 110, src: "log 22. 10.: 120×10, 120×10", alt: "Hack dřep · Dřep na multipressu", inc: 10 }),
      blkEx("Dumbbell bench press", [], "Hrudník", 3, 8, 12, "c", 150, { w: 22.5, pair: true, src: "log 25. 10.: 22,5×12/10/10", alt: "Tlaky na prsa na stroji · Tlak na multipressu" }),
      blkEx("Přitahování v sedě", ["cp-b6"], "Záda", 3, 8, 12, "c", 120, { w: 57.5, src: "log 26. 10.: 60×10/10/9, 2× do selhání", alt: "Přítahy na stroji s opěrou hrudníku · Jednoruční přitahování" }),
      blkEx("Předkopávání", ["cp-b2"], "Nohy", 2, 10, 15, "i", 90, { ramp: 5, w: 40, src: "log 26. 10.: 40×12/12/12", alt: "Předkopávání jednonož" }),
      blkEx("Zakopávání v sedě", ["xd-leg-curl-seated"], "Nohy", 2, 10, 15, "i", 90, { src: "v logu chybí", alt: "Zakopávání v leže" }),
      blkEx("Rozpažky s jednoručkama", ["cp-c9"], "Ramena", 3, 12, 20, "i", 75, { w: 8, pair: true, src: "log (starší): 10×10", alt: "Rozpažky na kladce · Stroj na upažování" }),
      blkEx("Tricepsové stahování", [], "Triceps", 2, 10, 15, "i", 90, { w: 50, src: "log 26. 10.: 52,5×12/10/10", alt: "Stahování kladky s lanem" }),
      blkEx("Bicepsové kladiva na kladce", ["cp-c8"], "Biceps", 2, 10, 15, "i", 90, { w: 45, src: "log 26. 10.: 45×10, 52,5×8/8", alt: "Kladiva s jednoručkami" }),
      blkEx("Výpony ve stoje", [], "Nohy", 3, 10, 15, "i", 75, { id: "bk-calf-standing", src: "v logu chybí", alt: "Výpony na leg pressu · Výpony v sedě" })
    ] },
    B: { focus: "nohy: zadní řetězec", min: "68–71 min", ex: [
      blkEx("Rumunské mrtvé tahy na beltsquatu", ["cp-c3"], "Nohy", 2, 8, 10, "t", 150, { ramp: 3, w: 60, src: "log (5 tréninků, starší): 70×10", alt: "RDL s jednoručkami · Hyperextenze 45° se zátěží", inc: 10 }),
      blkEx("Stahování horní kladky", ["cp-a5"], "Záda", 3, 8, 12, "c", 120, { w: 57.5, src: "log: 60×10 beze změny od 10. 10.", alt: "Shyby s dopomocí · Stahování jednoruč na kladce" }),
      blkEx("Tlak na multipressu na hrudník", ["cp-a6"], "Hrudník", 3, 8, 12, "c", 150, { w: 22.5, src: "log 13. 10.: 25×8/8, 20×10", alt: "Šikmý tlak na multipressu · Tlaky na prsa na stroji", inc: 5 }),
      blkEx("Zakopávání v leže", [], "Nohy", 3, 10, 15, "i", 90, { aka: ["Zakopávání vleže"], w: 35, src: "log 21. 10.: 35×12, 40×12/10", alt: "Zakopávání v sedě" }),
      blkEx("Tlaky na ramena s jednoručkama", ["cp-c4"], "Ramena", 2, 8, 12, "c", 120, { w: 17.5, pair: true, src: "log 22. 10.: 17,5×8/8/8", alt: "Tlaky na ramena na stroji" }),
      blkEx("Rear delt pec flys", ["cp-a7"], "Ramena", 2, 12, 20, "i", 75, { w: 35, src: "log: 40 kg, max 12 opak. od 12. 10.", alt: "Face pull na kladce · Zadní rozpažky v předklonu" }),
      blkEx("Bicepsové zdvihy na skotovce", ["cp-b9"], "Biceps", 2, 8, 12, "i", 90, { w: 40, src: "log 26. 10.: 40×10/10, 50×8", alt: "Bicepsový zdvih na kladce" }),
      blkEx("Dumbbell overhead extension", [], "Triceps", 2, 10, 15, "i", 90, { w: 14, src: "log 25. 10.: 15×10/10/9", alt: "Francouzský tlak na kladce nad hlavou" })
    ] },
    C: { focus: "nohy: hýždě, lehčí", min: "82–85 min", ex: [
      blkEx("Hip thrust", ["cp-b4"], "Nohy", 3, 8, 12, "c", 120, { src: "v logu chybí", alt: "Hip thrust na multipressu · Glute bridge na stroji", inc: 10 }),
      blkEx("Pendulum dřep", ["cp-b3"], "Nohy", 2, 8, 12, "t", 150, { ramp: 5, aka: ["Pendulum"], src: "v logu jen 3×, max 12× +10 kg", alt: "Hack dřep · Leg press" }),
      blkEx("Tlaky na prsa na stroji", ["cp-c6"], "Hrudník", 3, 8, 12, "c", 120, { w: 50, src: "log 12. 10.: 50×12/8/8", alt: "Dumbbell bench press · Tlak na multipressu" }),
      blkEx("Jednoruční přitahování jednoručky", ["xd-db-row-one"], "Záda", 3, 8, 12, "c", 90, { src: "v logu chybí", alt: "Přitahování v sedě · Přítahy na stroji s opěrou" }),
      blkEx("Lyžař na kladce", ["cp-c7"], "Záda", 2, 12, 15, "i", 90, { w: 40, src: "log (starší): 45×10", alt: "Pullover na stroji" }),
      blkEx("Pec deck v záklonu", ["cp-b5"], "Hrudník", 2, 10, 15, "i", 90, { w: 55, src: "log 26. 10.: 60×10/8/6", alt: "Rozpažky na kladce křížem" }),
      blkEx("Rozpažky na kladce jednoruč", ["xd-lat-raise-cable"], "Ramena", 2, 12, 20, "i", 75, { src: "v logu chybí", alt: "Rozpažky s jednoručkama" }),
      blkEx("Bicepsový zdvih na kladce", ["xd-curl-cable"], "Biceps", 2, 10, 15, "i", 90, { w: 40, src: "log 25. 10.: 45×10/10/8", alt: "Biceps s jednoručkama" }),
      blkEx("Stahování kladky s lanem", ["xd-pushdown-rope"], "Triceps", 2, 10, 15, "i", 90, { w: 30, src: "log 18. 10.: 30×10/10/10", alt: "Tricepsové stahování" }),
      blkEx("Výpony ve stoje", [], "Nohy", 3, 10, 15, "i", 75, { id: "bk-calf-standing", src: "v logu chybí", alt: "Výpony na leg pressu · Výpony v sedě" })
    ] }
  }
};
const BLOCK_KEYS = ["A", "B", "C"];

function blockEnd() { return addDays(BLOCK.start, BLOCK.weeks.length * 7 - 1); }
/* týden bloku 1–7 pro datum; 0 = mimo blok */
function blockWeek(date = todayStr()) {
  const b = S.block;
  if (!b || b.id !== BLOCK.id || date < b.start || date > blockEnd()) return 0;
  return Math.floor(daysBetween(b.start, date) / 7) + 1;
}
/* běží blok (v jeho datech a neukončený)? */
function blockOn(date = todayStr()) { return !!(S.block && !S.block.ended && blockWeek(date)); }
function blockDayKey(tplId) { return S.block && /^blk-[ABC]$/.test(String(tplId)) ? String(tplId).slice(4) : null; }
function blockTemplates() { return BLOCK_KEYS.map(k => getTemplate("blk-" + k)).filter(Boolean); }
function blockSessions() {
  if (!S.block) return [];
  return S.sessions.filter(s => s.type === "weights" && blockDayKey(s.templateUsed)
    && s.date >= S.block.start && s.date <= blockEnd());
}
/* definice cviku v bloku podle šablony a id cviku (null = cvik do bloku nepatří) */
function blockExDef(tplId, exId) {
  const k = blockDayKey(tplId);
  if (!k || !S.block.days || !S.block.days[k]) return null;
  const i = S.block.days[k].indexOf(exId);
  return i < 0 ? null : BLOCK.days[k].ex[i];
}

/* „Na řadě" během bloku: A → B → C podle posledního tréninku bloku,
   vynechaný den rotaci neposouvá (přijde ten, který je na řadě) */
function blockNextTemplate() {
  if (!blockOn()) return null;
  const tpls = blockTemplates();
  if (!tpls.length) return null;
  const last = blockSessions().filter(s => s.date <= todayStr())
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)))[0];
  if (!last) return tpls[0];
  const i = tpls.findIndex(t => t.id === last.templateUsed);
  return tpls[(i + 1) % tpls.length];
}

/* Cíl cviku pro týden bloku: k plánu šablony přidá sérii navíc (ramp),
   deload (−40 % sérií), cílové RIR, start váhu a krok váhy. Plán šablony
   (i ručně upravený) zůstává základem. */
function blockTarget(tplId, exId, t, date) {
  const d = blockExDef(tplId, exId);
  const w = blockWeek(date);
  if (!d || !t || !w || S.block.ended) return t;
  const wk = BLOCK.weeks[w - 1];
  let sets = t.sets || d.sets;
  if (d.ramp && w >= d.ramp) sets += 1;
  if (wk.deload) sets = Math.max(1, Math.round(sets * 0.6));
  return Object.assign({}, t, {
    sets, rir: BLOCK.rir[d.rir][w - 1], inc: d.inc, week: w, deload: !!wk.deload,
    startW: d.w ?? null, pair: !!d.pair, src: d.src || "", alt: d.alt || ""
  });
}
/* první trénink cviku v bloku → předvyplní se start váha z plánu */
function blockFirstUse(exId, sid) {
  if (!S.block) return false;
  return !S.sessions.some(s => s.id !== sid && s.type === "weights" && s.date >= S.block.start
    && (s.entries || []).some(e => e.exerciseId === exId && (e.sets || []).length));
}
function blockStartLabel(t) {
  return t.startW == null ? "" : `${t.pair ? "2× " : ""}${fmtWeight(t.startW)}`;
}

/* ---- Migrace: založí blok jednou (flag blockV1) ----
   Cvik se hledá podle známého id, pak podle názvu (při shodě vyhraje ten
   s nejvíc zápisy) a teprve pak se založí nový — historie navazuje. */
function blockNorm(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}
function blockResolveEx(d) {
  for (const id of d.ids) if (getExercise(id)) return id;
  if (d.id && getExercise(d.id)) return d.id;
  const names = [d.n, ...(d.aka || [])].map(blockNorm);
  const uses = id => S.sessions.reduce((n, s) => n + (s.entries || []).filter(e => e.exerciseId === id).length, 0);
  const hits = S.exercises.filter(e => names.includes(blockNorm(e.name)));
  if (hits.length) return hits.sort((a, b) => uses(b.id) - uses(a.id))[0].id;
  const id = d.id || "bk-" + blockNorm(d.n).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  S.exercises.push({ id, name: d.n, category: d.cat, description: "", kind: "weight", isCustom: true });
  return id;
}
function applyBlockV1() {
  if (S.blockV1) return;
  S.blockV1 = true;
  if (todayStr() <= blockEnd()) {
    const days = {};
    for (const k of BLOCK_KEYS) {
      const def = BLOCK.days[k];
      days[k] = def.ex.map(blockResolveEx);
      const tid = "blk-" + k;
      if (!getTemplate(tid)) {
        const plan = {};
        def.ex.forEach((d, i) => { plan[days[k][i]] = plan[days[k][i]] || { sets: d.sets, lo: d.lo, hi: d.hi, rest: d.rest, link: false }; });
        S.templates.push({ id: tid, name: "Blok " + k, exercises: [...new Set(days[k])], plan });
      }
    }
    S.block = { id: BLOCK.id, start: BLOCK.start, days, ended: null };
    // plán stojí na cílovém RIR — zápis RIR u série se s blokem zapne (jde vypnout v Nastavení)
    Settings.set({ rirMode: true });
  }
  S.updatedAt = Date.now();
  persist();
}
applyBlockV1();

/* ---- Stránka Silový blok: kde jsem, plán do konce roku, pravidla ---- */
function blockHead() {
  return { title: BLOCK.title, sub: `${fmtShort(BLOCK.start)} – ${fmtShort(blockEnd())} · ${BLOCK.plan}` };
}
function blockWeekLine(date = todayStr()) {
  const w = blockWeek(date);
  return w ? `týden ${w} ze ${BLOCK.weeks.length} · ${BLOCK.weeks[w - 1].rir}` : "";
}

function renderBlock() {
  if (!S.block) return `<div class="card"><div class="empty-note">Žádný silový blok</div></div>`;
  const today = todayStr();
  const w = blockWeek(today), on = blockOn(today);
  const done = blockSessions();
  const trainN = done.filter(s => blockWeek(s.date) < BLOCK.weeks.length).length;
  const out = [];

  /* --- teď --- */
  if (on) {
    const wk = BLOCK.weeks[w - 1];
    const next = blockNextTemplate();
    out.push(`<div class="card blk-now">
      <div class="blk-now-top">
        <div class="hero-fig">${w}<small>ze ${BLOCK.weeks.length}</small></div>
        <div class="grow"><div class="blk-now-rir">${wk.rir}</div><p class="small">${esc(wk.note)}</p></div>
      </div>
      <div class="blk-now-meta">Tréninky v bloku <b>${trainN}</b> z ${BLOCK.sessionsGoal}${next ? ` · na řadě <b>${esc(next.name)}</b>` : ""}</div>
      ${next && !S.activeSession ? `<button class="btn primary full mt" data-act="t-begin-next" data-template="${next.id}">${ic("play", 15)} Začít ${esc(next.name)}</button>` : ""}
    </div>`);
  } else {
    const msg = S.block.ended ? `Blok je ukončený od ${fmtShort(S.block.ended)}.` : today < S.block.start ? `Blok začne ${fmtShort(S.block.start)}.` : "Blok skončil.";
    out.push(`<div class="card"><p class="muted" style="margin:0">${msg} Tréninky v bloku: <b style="color:var(--text)">${trainN}</b> z ${BLOCK.sessionsGoal}.</p>
      ${S.block.ended && today <= blockEnd() ? `<button class="btn full mt" data-act="blk-resume">Pokračovat v bloku</button>` : ""}</div>`);
  }

  /* --- plán do konce roku --- */
  const rows = BLOCK.weeks.map((wk, k) => {
    const from = addDays(S.block.start, k * 7), to = addDays(from, 6);
    const n = done.filter(s => s.date >= from && s.date <= to).length;
    const state = to < today ? "past" : from <= today ? "cur" : "";
    const full = n >= 3;
    return `<div class="list-item blk-wk${state ? " " + state : ""}">
      <span class="blk-wk-n${state === "past" && full ? " ok" : ""}">${state === "past" && full ? ic("check", 14, 3) : k + 1}</span>
      <div class="grow">
        <div class="name">${fmtShort(from)}–${fmtShort(to)} · ${wk.rir}</div>
        <div class="li-sub">${esc(wk.note)}</div>
      </div>
      ${state ? `<span class="li-val">${n}/3</span>` : ""}
    </div>`;
  }).join("");
  out.push(sec("Plán do konce roku", `<div class="card rows">${rows}
      <div class="list-item blk-wk next"><span class="blk-wk-n">${ic("arrowR", 14, 2.4)}</span>
        <div class="grow"><div class="name">Od ${fmtShort(addDays(blockEnd(), 1))} · další blok</div>
        <div class="li-sub">Začni s vahami z týdne 6 a nohy posuň na 10–12 sérií. Na Upper/Lower 4× až po všech ${BLOCK.sessionsGoal} trénincích.</div></div></div>
    </div>`, { sub: "7 týdnů: 6 tréninkových a deload před Vánoci" }));

  /* --- týden --- */
  const dow = (parseDate(today).getDay() + 6) % 7;
  const cells = BLOCK.week.map(([d, key, txt], i) => `
    <div class="blk-day-c${i === dow ? " today" : ""}${key ? " tr" : ""}"><span>${d}</span><b>${key || "–"}</b>${txt ? `<small>${txt}</small>` : ""}</div>`).join("");
  out.push(sec("Týden", `<div class="card blk-sched">${cells}</div>`,
    { sub: "běh v lehkém tempu — rychlé „lehké“ běhy unaví nohy" }));

  /* --- tréninky tohoto týdne (cíle podle týdne) --- */
  const wNow = w || 1;
  const days = BLOCK_KEYS.map(k => {
    const def = BLOCK.days[k], tpl = getTemplate("blk-" + k);
    if (!tpl) return "";
    const items = def.ex.map((d, i) => {
      const id = (S.block.days[k] || [])[i];
      const t = blockTarget(tpl.id, id, tplPlan(tpl, id) || { sets: d.sets, lo: d.lo, hi: d.hi, rest: d.rest }, addDays(S.block.start, (wNow - 1) * 7));
      const start = t && t.startW != null ? `start ${blockStartLabel(t)}` : "start: najdi v 1. týdnu";
      return `<div class="list-item">
        <div class="grow"><div class="name">${esc(exName(id))}</div>
          <div class="li-sub">${t.sets} × ${t.lo}–${t.hi} · RIR ${t.rir} · pauza ${fmtClock(t.rest || d.rest)}</div>
          <div class="li-sub">${start} · jinak ${esc(d.alt)}</div></div>
      </div>`;
    }).join("");
    return `<details class="card blk-tr">
      <summary><div class="grow"><div class="name">${esc(tpl.name)}</div>
        <div class="li-sub">${esc(def.focus)} · ${def.ex.length} cviků · ${def.min}</div></div>${ic("chevD", 16, 2.2)}</summary>
      <div class="rows">${items}</div>
    </details>`;
  }).join("");
  out.push(sec("Tréninky", days, { sub: on ? `cíle pro týden ${w}` : "cíle prvního týdne" }));

  /* --- pravidla --- */
  out.push(sec("Pravidla", `<div class="card blk-rules">
      <ol>
        <li><b>Rozsah.</b> Pracuj v daném rozsahu (např. 8–12) s cílovým RIR týdne.</li>
        <li><b>Strop.</b> Všechny série na horní hranici při cílovém RIR → příště nejmenší krok váhy.</li>
        <li><b>Reset.</b> Po přidání váhy začni u spodní hranice a opakování stav znovu.</li>
        <li><b>Pojistka.</b> Pod spodní hranicí → váhu vrať. 3 tréninky beze změny → zkontroluj spánek a jídlo, v dalším bloku vyměň cvik za alternativu.</li>
      </ol>
      <p class="small">Krok váhy: +2,5 kg jednoručky (na ruku), kladky a stroje · +5 kg multipress · +10 kg leg press, hip thrust, belt squat. Trénink ho navrhne sám.</p>
      <p class="small">RIR „2 / 1“ = vícekloubové / izolace. Série končí 0–3 opakování před selháním, do selhání jen izolace v týdnu 5–6. Rumunské mrtvé tahy a pendulum celý blok na RIR 2 a víc.</p>
      <p class="small">Pauzy 2–3 min u vícekloubových, 60–90 s u izolací — nastavené v plánu cviku. Cviky zůstávají stejné celý blok, jinak se progres nedá sledovat.</p>
    </div>`));

  /* --- pozor --- */
  out.push(sec("Pozor", `<div class="card blk-rules"><ul>
      <li>Blok C trvá ~85 minut. Když nestíháš, vynech lyžaře a rozpažky na kladce.</li>
      <li>Nohy na RIR 2–3 v prvních dvou týdnech se můžou potkat s během. Neděli drž lehce, první týden klidně kratší.</li>
      <li>Váha v logu klesala asi o 0,4 kg týdně a strava se skoro nezapisuje. V deficitu porostou svaly pomalu s jakýmkoli plánem.</li>
    </ul></div>`));

  if (on) out.push(`<button class="btn text danger full" data-act="blk-end">Ukončit blok</button>`);
  return out.join("");
}

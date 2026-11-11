/* ===== Adaptivní plán (v5.0) =====
   Co si lidé nejvíc přejí u Hevy a Strong a co Liftosaur umí jen přes vlastní
   skriptovací jazyk: plán se sám posouvá podle toho, jak dopadl minulý trénink.
   Tady bez skriptů — pevná, srozumitelná pravidla a ke každému návrhu věta proč.

   1. nextSets()       — cíl dnešních sérií cviku (váha × opakování) z historie
   2. planProposals()  — návrhy úprav plánu (stagnace, objem na partii)
   3. applyPlanOps()   — jediné místo, kudy se plán mění (návrhy appky i trenéra)

   Nic se neukládá navíc: cíle se počítají z historie při každém vykreslení,
   takže sync mezi zařízeními nemá co rozbít. Ve stavu jsou jen ruční zásahy
   (S.overrides — váha na příště od trenéra) a odmítnuté návrhy (S.adaptOff). */
"use strict";

/* poslední tréninky cviku, nejnovější první: [{date, sid, sets}] */
function exerciseHistory(exId, excludeSid, n = 4) {
  const out = [];
  for (const s of S.sessions) {
    if (s.type !== "weights" || s.id === excludeSid) continue;
    for (const e of s.entries || []) {
      if (e.exerciseId === exId && (e.sets || []).length) out.push({ date: s.date, sid: s.id, sets: e.sets });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || String(b.sid).localeCompare(String(a.sid))).slice(0, n);
}

/* „0–1" → 0, „3–4" → 3; bez cíle null */
function rirNum(v) {
  const m = /\d+/.exec(String(v == null ? "" : v));
  return m ? Number(m[0]) : null;
}
function roundStep(w, step) { return Math.max(0, Math.round(w / step) * step); }
function bestE1(sets) { return Math.max(0, ...sets.map(st => est1RM(st.weight || 0, st.reps || 0))); }
function sumReps(sets) { return sets.reduce((n, st) => n + (st.reps || 0), 0); }
function topWeight(sets) { return Math.max(0, ...sets.map(st => st.weight || 0)); }

/* Kolik tréninků po sobě cvik stojí: stejná nebo nižší nejvyšší váha a žádné
   opakování navíc. 0 = hýbe se. Počítá se od 3 tréninků. */
function stallCount(hist) {
  let n = 0;
  for (let k = 0; k + 1 < hist.length; k++) {
    const a = hist[k].sets, b = hist[k + 1].sets;
    if (topWeight(a) <= topWeight(b) && sumReps(a) <= sumReps(b) && bestE1(a) <= bestE1(b) * 1.001) n++;
    else break;
  }
  return n >= 2 ? n + 1 : 0;
}

/* Cíl dnešních sérií cviku.
   target = plán (sets, lo, hi, inc, rir, deload, startW…) nebo null
   Vrací { rows: [{weight, reps}], kind, text, last, stall }
   kind: new | start | coach | deload | repeat | up | easy | reps | hold | down */
function nextSets(exId, target, excludeSid) {
  const kind = exKind(exId);
  const hist = exerciseHistory(exId, excludeSid, 4);
  const last = hist[0] || null;
  const t = target || {};
  const n = t.sets || (last ? last.sets.length : 3);
  const step = t.inc || 2.5;
  const at = j => last ? (last.sets[j] || last.sets[last.sets.length - 1]) : null;
  const rows = (w, r) => Array.from({ length: n }, (_, j) => ({
    weight: typeof w === "function" ? w(j) : w, reps: typeof r === "function" ? r(j) : r }));
  const out = (k, text, rw) => ({ rows: rw, kind: k, text, last, stall: stallCount(hist) });
  const W = kg => fmtWeight(kg);

  /* váha na příště od trenéra (jednorázově, smaže se po odcvičení) */
  const ov = S.overrides && S.overrides[exId];
  if (ov && kind !== "time") {
    return out("coach", `Trenér: ${W(ov.kg)}${ov.note ? " — " + ov.note : ""}`,
      rows(ov.kg, j => t.lo || (at(j) ? at(j).reps : null)));
  }
  /* první trénink cviku v silovém bloku jede od start váhy z plánu */
  if (t.week && t.startW != null && typeof blockFirstUse === "function" && blockFirstUse(exId, excludeSid)) {
    return out("start", `Start bloku ${t.pair ? "2× " : ""}${W(t.startW)}${t.src ? " · " + t.src : ""}`,
      rows(t.startW, j => clamp(at(j) ? at(j).reps : t.lo, t.lo || 1, t.hi || 99)));
  }
  if (!last) {
    return out("new", t.week ? `Najdi váhu na RIR ${t.rir}` : "", rows(kind === "bw" ? 0 : null, t.lo || null));
  }
  if (t.deload) return out("deload", "Deload — stejné váhy, méně sérií", rows(j => at(j).weight, j => at(j).reps));
  /* výdrž a cviky bez rozsahu: zopakuj minulé */
  if (kind === "time" || !t.hi) return out("repeat", "", rows(j => at(j).weight, j => at(j).reps));

  const lo = t.lo || t.hi, hi = t.hi;
  const sets = last.sets.slice(0, n);
  const top = topWeight(sets);
  const tRir = rirNum(t.rir);
  const rirs = sets.filter(st => st.rir != null).map(st => st.rir);
  const avgRir = rirs.length === sets.length && rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;

  /* bez váhy (vlastní váha): jen opakování */
  if (!top) {
    if (sets.every(st => st.reps >= hi)) return out("repeat", `Vše na ${hi} opak. — zkus přidat zátěž`, rows(0, hi));
    return out("reps", `Přidej opakování (cíl ${n} × ${hi})`, rows(0, j => Math.min(hi, at(j).reps + 1)));
  }
  /* strop: všechny série na horní hranici → nejmenší krok váhy, zpět na spodek */
  if (sets.every(st => st.reps >= hi)) {
    return out("up", `Minule vše na ${hi} opak. → ${W(top + step)} (+${fmtNum(kgOut(step), 2)})`, rows(top + step, lo));
  }
  /* zapsaná rezerva o 2 a víc nad cílem a série v rozsahu → váha je lehká */
  if (tRir != null && avgRir != null && avgRir >= tRir + 2 && sets.every(st => st.reps >= lo)) {
    return out("easy", `Minule rezerva ~${Math.round(avgRir)} opak. při cíli RIR ${t.rir} → ${W(top + step)}`, rows(top + step, lo));
  }
  /* pod spodní hranicí: jednou drž váhu, podruhé uber */
  if (sets.some(st => st.reps < lo)) {
    const prev = hist[1];
    const again = prev && topWeight(prev.sets) >= top && prev.sets.slice(0, n).some(st => st.reps < lo);
    if (again) {
      const w = roundStep(top * 0.9, step === 10 ? 5 : 2.5);
      return out("down", `Dvakrát pod ${lo} opak. → uber na ${W(w)} a stav znovu`, rows(w, Math.round((lo + hi) / 2)));
    }
    return out("hold", `Minule pod ${lo} opak. — drž ${W(top)} a dostaň se do rozsahu`, rows(j => at(j).weight, lo));
  }
  /* v rozsahu: stejná váha, o opakování víc, dokud nejsou všechny série nahoře */
  return out("reps", `Stejná váha, přidej opakování (cíl ${n} × ${hi})`,
    rows(j => at(j).weight, j => Math.min(hi, at(j).reps + 1)));
}

/* ===== Úpravy plánu =====
   Operace (ops) jsou jednoduché objekty — skládá je appka (planProposals)
   i Claude trenér (nástroj propose_plan_change):
     {op:"set_plan", tpl, ex, sets?, lo?, hi?, rest?}   série / rozsah / pauza
     {op:"swap", tpl, ex, to}                           výměna cviku
     {op:"add", tpl, ex, sets?, lo?, hi?, rest?}        cvik na konec šablony
     {op:"remove", tpl, ex}                             odebrat ze šablony
     {op:"next_weight", ex, kg, note?}                  váha na příští trénink */
function planOpError(op) {
  if (!op || typeof op !== "object") return "neplatná operace";
  if (op.op === "next_weight") {
    if (!getExercise(op.ex)) return "neznámý cvik";
    return Number.isFinite(op.kg) && op.kg >= 0 && op.kg < 1000 ? null : "neplatná váha";
  }
  const t = getTemplate(op.tpl);
  if (!t) return "neznámá šablona";
  if (!getExercise(op.ex)) return "neznámý cvik";
  if (op.op === "add") return t.exercises.includes(op.ex) ? "cvik v šabloně už je" : null;
  if (!t.exercises.includes(op.ex)) return "cvik v šabloně není";
  if (op.op === "swap") {
    if (!getExercise(op.to)) return "neznámý nový cvik";
    return t.exercises.includes(op.to) ? "nový cvik v šabloně už je" : null;
  }
  if (op.op === "set_plan") {
    for (const k of ["sets", "lo", "hi", "rest"]) {
      if (op[k] != null && !(Number.isFinite(op[k]) && op[k] >= 0 && op[k] <= 600)) return "neplatná hodnota " + k;
    }
    if (op.sets != null && (op.sets < 1 || op.sets > 10)) return "série mimo 1–10";
    return null;
  }
  return op.op === "remove" ? null : "neznámá operace";
}
function describeOp(op) {
  const tn = id => (getTemplate(id) || {}).name || id;
  if (op.op === "next_weight") return `${exName(op.ex)}: příště ${fmtWeight(op.kg)}${op.note ? " — " + op.note : ""}`;
  if (op.op === "swap") return `${tn(op.tpl)}: ${exName(op.ex)} → ${exName(op.to)}`;
  if (op.op === "remove") return `${tn(op.tpl)}: odebrat ${exName(op.ex)}`;
  const bits = [];
  if (op.sets != null) bits.push(`${op.sets} ${plural(op.sets, "série", "série", "sérií")}`);
  if (op.lo != null || op.hi != null) bits.push(`${op.lo ?? "?"}–${op.hi ?? "?"} opak.`);
  if (op.rest != null) bits.push(`pauza ${fmtClock(op.rest)}`);
  return `${tn(op.tpl)}: ${op.op === "add" ? "přidat " : ""}${exName(op.ex)}${bits.length ? " · " + bits.join(" · ") : ""}`;
}
/* Provede operace (neplatné přeskočí) a zapíše je do deníku změn. Volající
   obalí withUndo(). Vrací počet provedených. */
function applyPlanOps(ops, title, source) {
  let done = 0;
  for (const op of ops || []) {
    if (planOpError(op)) continue;
    if (op.op === "next_weight") {
      S.overrides = S.overrides || {};
      S.overrides[op.ex] = Object.assign({ kg: op.kg }, op.note ? { note: String(op.note).slice(0, 80) } : {});
      done++;
      continue;
    }
    const t = getTemplate(op.tpl);
    t.plan = t.plan || {};
    const base = () => Object.assign({ sets: 3, lo: null, hi: null, rest: null, link: false }, tplPlan(t, op.ex) || {});
    const patch = p => { for (const k of ["sets", "lo", "hi", "rest"]) if (op[k] != null) p[k] = op[k]; return p; };
    if (op.op === "set_plan") t.plan[op.ex] = patch(base());
    if (op.op === "add") { t.exercises.push(op.ex); if (["sets", "lo", "hi", "rest"].some(k => op[k] != null)) t.plan[op.ex] = patch(base()); }
    if (op.op === "remove") { t.exercises = t.exercises.filter(x => x !== op.ex); delete t.plan[op.ex]; }
    if (op.op === "swap") {
      const i = t.exercises.indexOf(op.ex);
      t.exercises[i] = op.to;
      if (t.plan[op.ex]) { t.plan[op.to] = t.plan[op.ex]; delete t.plan[op.ex]; }
      // silový blok drží pořadí cviků dne podle id — výměna se musí propsat i tam
      const bk = typeof blockDayKey === "function" ? blockDayKey(t.id) : null;
      if (bk && S.block.days && S.block.days[bk]) S.block.days[bk] = S.block.days[bk].map(x => x === op.ex ? op.to : x);
    }
    done++;
  }
  if (done) {
    S.planLog = (S.planLog || []).concat({ date: todayStr(), title: String(title || "Úprava plánu").slice(0, 120),
      source: source || "app", lines: ops.filter(o => !planOpError(o) || o.op === "next_weight").map(describeOp).slice(0, 12) }).slice(-30);
  }
  return done;
}

/* Šablony, které se právě jedou: silový blok, jinak použité za 6 týdnů */
function livePlanTemplates() {
  if (typeof blockOn === "function" && blockOn()) return blockTemplates();
  return activeTemplates();
}

/* Návrhy úprav plánu z výsledků — karta „Plán se přizpůsobuje".
   Každý návrh: { key, title, why, ops }. Odmítnutý se 21 dní nevrací. */
const ADAPT_BAND = [10, 20];        // série na partii týdně (stejné pásmo jako v Pokroku)
function planProposals() {
  const today = todayStr();
  const off = S.adaptOff || {};
  const live = k => !off[k] || daysBetween(off[k], today) > 21;
  const tpls = livePlanTemplates();
  const out = [];

  /* stagnace: cvik z plánu stojí 3 a víc tréninků → uber 10 % a stav znovu */
  const seen = new Set();
  for (const t of tpls) for (const id of t.exercises) {
    if (seen.has(id) || exKind(id) !== "weight") continue;
    seen.add(id);
    const hist = exerciseHistory(id, null, 4).filter(h => daysBetween(h.date, today) <= 42);
    const n = stallCount(hist);
    const key = "stall:" + id;
    if (n < 3 || !live(key) || (S.overrides && S.overrides[id])) continue;
    const top = topWeight(hist[0].sets);
    const kg = roundStep(top * 0.9, 2.5);
    if (!kg || kg >= top) continue;
    out.push({ key, title: `${exName(id)} stojí ${n} tréninky`,
      why: `Pořád ${fmtWeight(top)} a žádné opakování navíc. Uber na ${fmtWeight(kg)}, posbírej opakování s rezervou a vrať se výš.`,
      ops: [{ op: "next_weight", ex: id, kg, note: "reset po stagnaci" }] });
  }

  /* objem: průměr sérií na partii za poslední 2 uzavřené týdny proti pásmu.
     Během silového bloku se objem neřeší — má vlastní naplánovaný nárůst. */
  if (!(typeof blockOn === "function" && blockOn()) && tpls.length) {
    const mon = mondayOf(today), from = addDays(mon, -14), to = addDays(mon, -1);
    const sess = S.sessions.filter(s => s.type === "weights" && s.date >= from && s.date <= to);
    if (sess.length >= 3) {
      const tot = {};
      for (const s of sess) { const c = sessionCatSets(s); for (const k in c) tot[k] = (tot[k] || 0) + c[k]; }
      for (const cat of CAT_ORDER) {
        if (cat === "Core") continue;
        const avg = (tot[cat] || 0) / 2;
        const dir = avg < ADAPT_BAND[0] ? 1 : avg > ADAPT_BAND[1] + 2 ? -1 : 0;
        const key = `vol:${cat}:${dir}`;
        if (!dir || !live(key)) continue;
        /* cvik té partie s nejméně (při přidání) / nejvíc (při ubrání) sériemi v plánu */
        let pick = null;
        for (const t of tpls) for (const id of t.exercises) {
          if (exCategory(id) !== cat) continue;
          const p = tplPlan(t, id);
          const sets = (p && p.sets) || 3;
          if ((dir > 0 && sets >= 5) || (dir < 0 && sets <= 2)) continue;
          if (!pick || (dir > 0 ? sets < pick.sets : sets > pick.sets)) pick = { t, id, sets };
        }
        if (!pick) continue;
        out.push({ key, title: `${cat}: Ø ${fmtNum(avg, 1)} sérií týdně`,
          why: dir > 0 ? `Pod pásmem ${ADAPT_BAND[0]}–${ADAPT_BAND[1]} sérií. Přidej sérii: ${exName(pick.id)} (${pick.t.name}).`
            : `Nad pásmem ${ADAPT_BAND[0]}–${ADAPT_BAND[1]} sérií. Uber sérii: ${exName(pick.id)} (${pick.t.name}).`,
          ops: [{ op: "set_plan", tpl: pick.t.id, ex: pick.id, sets: pick.sets + dir }] });
      }
    }
  }
  return out.slice(0, 4);
}

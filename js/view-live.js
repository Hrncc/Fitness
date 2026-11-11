/* ===== Živý trénink (v5.0) — tabulka sérií =====
   Jeden řádek = jedna série: číslo · minule · kg · opakování · ✓.
   Řádky jsou připravené předem z plánu a předvyplněné cílem z adaptivního
   plánu (engine.js) — v posilovně stačí odškrtnout, nebo číslo přepsat.

   Živý trénink drží řádky v entry.rows = [{t: "n" | "w", reps, weight, rir,
   failure, note, done}]. entry.sets (odškrtnuté pracovní série) a entry.warm
   (odškrtnuté zahřívací) se z nich po každé změně přepočítají (syncEntry),
   takže všechno ostatní v appce — counter partií, rekordy, dock, uložení —
   čte dál entry.sets jako dřív. Zahřívací série se nepočítají do objemu,
   sérií ani rekordů. */
"use strict";

const LV = {
  rirAsk: null,     // {i, j} — po odškrtnutí nabídne řádek RIR
  sw: null,         // běžící stopky {i, j, start}
  plates: null      // {exId, w} — kalkulačka kotoučů
};
let _lvSwTimer = null;

/* ---- řádky ---- */
function liveSuggest(a, entry) {
  if (a.editOf) return { rows: [], text: "", kind: "edit", last: null };
  return nextSets(entry.exerciseId, entry.target || null, a.id);
}
function ensureRows(a) {
  for (const e of a.entries) {
    if (Array.isArray(e.rows)) continue;
    const done = (e.sets || []).map(st => ({ t: "n", reps: st.reps, weight: st.weight, rir: st.rir == null ? null : st.rir,
      failure: !!st.failure, note: st.note || null, done: true }));
    const warm = (e.warm || []).map(st => ({ t: "w", reps: st.reps, weight: st.weight, done: true }));
    const want = a.editOf ? 0 : (e.target && e.target.sets) || liveSuggest(a, e).rows.length || 3;
    const blank = Array.from({ length: Math.max(0, want - done.length) }, () => ({ t: "n", reps: null, weight: null, done: false }));
    e.rows = warm.concat(done, blank);
  }
}
/* z řádků znovu složí entry.sets / entry.warm a přepočítá rekordy */
function syncEntry(a, e) {
  e.sets = e.rows.filter(r => r.done && r.t === "n").map(r => Object.assign(
    { reps: r.reps, weight: r.weight, note: r.note || null }, r.failure ? { failure: true } : {}, r.rir != null ? { rir: r.rir } : {}));
  e.warm = e.rows.filter(r => r.done && r.t === "w").map(r => ({ reps: r.reps, weight: r.weight }));
  refreshEntryRecords(a, e);
  e.done = e.rows.length > 0 && e.rows.every(r => r.done);
}
/* cvik, na kterém se právě pracuje: první s neodškrtnutým řádkem */
function liveCurrent(a) {
  return a.entries.findIndex(e => !e.rows || !e.rows.length || e.rows.some(r => !r.done));
}

/* cíl řádku: návrh z plánu posunutý o to, o kolik se dnes šlo jinak */
function rowHints(a, entry) {
  const sug = liveSuggest(a, entry);
  const hints = [];
  let k = 0, delta = 0;
  for (const r of entry.rows) {
    if (r.t !== "n") { hints.push(null); continue; }
    const sr = sug.rows.length ? sug.rows[Math.min(k, sug.rows.length - 1)] : null;
    const prev = sug.last ? sug.last.sets[k] || null : null;
    const w = sr && sr.weight != null ? Math.max(0, sr.weight + delta) : null;
    hints.push({ weight: w, reps: sr ? sr.reps : null, prev });
    if (r.done && sr && sr.weight != null && r.weight != null) delta = r.weight - sr.weight;
    k++;
  }
  return { sug, hints };
}
function lvNum(v, dec = 2) { return v == null ? "" : fmtNum(Math.round(v * 100) / 100, dec).replace(/ /g, ""); }

/* ---- vykreslení ---- */
function renderLive() {
  const a = S.activeSession;
  if (a.type === "cardio") return "";
  ensureRows(a);
  const cur = liveCurrent(a);
  const editBanner = a.editOf ? `
    <div class="card edit-card">
      <label class="field" style="margin:0"><span>Datum tréninku</span>
        <input class="input" type="date" data-change="w-edit-date" value="${a.date}"></label>
    </div>` : "";
  return `
    ${editBanner}
    ${catCounterHtml(a)}
    <div class="lv-list" id="exList">${a.entries.map((e, i) => lvExerciseHtml(a, e, i, i === cur)).join("")}</div>
    <button class="btn ghost full" data-act="w-add-ex">${ic("plus", 18, 2.2)} Přidat cvik</button>
    <div class="mt2">${coreCardHtml(a)}</div>
    <button class="btn primary full mt" data-act="w-finish">${ic("check", 18, 2.6)} ${a.editOf ? "Uložit změny" : "Dokončit trénink"}</button>
    <button class="btn text danger full w-cancel-btn" data-act="w-cancel">${a.editOf ? "Zahodit úpravy" : "Zrušit trénink"}</button>`;
}

const LV_KIND_ICON = { up: "arrowUp", easy: "arrowUp", down: "arrowDown", coach: "spark", start: "target", deload: "moon" };
function lvExerciseHtml(a, entry, i, isCur) {
  const exId = entry.exerciseId;
  const ex = getExercise(exId);
  const kind = exKind(exId);
  const t = a.editOf ? null : entry.target || null;
  const n = a.entries.length;
  const doneN = entry.sets.length;
  const allDone = entry.rows.length > 0 && entry.rows.every(r => r.done);
  const linkPrev = i > 0 && !!a.entries[i - 1].link;
  const linkNext = !!entry.link && i < n - 1;
  const ss = linkPrev || linkNext ? ` ss${linkPrev ? " ss-prev" : ""}${linkNext ? " ss-next" : ""}` : "";
  const name = entry.exerciseName || exName(exId);

  /* hotový cvik se sbalí na jeden řádek; klepnutí ho zase otevře */
  /* …ale ne dřív, než u poslední série zmizí dotaz na RIR */
  if (allDone && WV.openIdx !== i && !(LV.rirAsk && LV.rirAsk.i === i)) {
    return `
      <div class="lv-done${ss}" id="exblock-${i}" data-act="lv-open" data-i="${i}">
        <span class="lv-tick">${ic("check", 15, 3)}</span>
        <div class="grow">
          <div class="lv-done-name">${esc(name)}${entry.prHit ? ` <span class="pr-tag">${ic("trophy", 12)} rekord</span>` : ""}</div>
          <div class="lv-done-sets num">${setsSummary(exId, entry.sets)}${entry.warm && entry.warm.length ? ` · ${entry.warm.length}× zahřátí` : ""}</div>
        </div>
        ${ic("chevD", 16, 2.2)}
      </div>`;
  }

  const { sug, hints } = rowHints(a, entry);
  const rir = Settings.get().rirMode && kind !== "time";
  const meta = [ex ? `<i class="p-dot" style="background:${catColor(ex.category)}"></i>${esc(ex.category)}` : "",
    t ? esc(planText(t, exId)) : "", t && t.rir != null ? `RIR ${esc(String(t.rir))}` : "",
    !a.editOf ? `pauza ${fmtClock(entryRest(a, entry))}` : ""].filter(Boolean).join(" · ");
  const hint = sug.text ? `<div class="lv-hint k-${sug.kind}">${ic(LV_KIND_ICON[sug.kind] || "target", 15, 2.2)}<span>${esc(sug.text)}</span></div>` : "";
  const pin = ex && ex.pin ? `<button class="lv-hint pin" data-act="w-pin" data-i="${i}">${ic("pin", 15)}<span>${esc(ex.pin)}</span></button>` : "";

  let work = 0, k = -1;
  const rows = entry.rows.map((r, j) => {
    const isW = r.t === "w";
    if (!isW) { work++; }
    const h = hints[j];
    if (!isW && r.done) k++;
    const st = !isW && r.done ? entry.sets[k] : null;
    const prev = h && h.prev ? setShort(exId, h.prev) : "–";
    const phW = isW ? "" : h && h.weight != null ? lvNum(kgOut(h.weight)) : kind === "bw" ? "0" : "";
    const phR = isW ? "" : h && h.reps != null ? String(h.reps) : "";
    const wCell = kind === "time"
      ? `<button class="lv-sw${LV.sw && LV.sw.i === i && LV.sw.j === j ? " on" : ""}" id="lsw-${i}-${j}" data-act="lv-sw" data-i="${i}" data-j="${j}" aria-label="Stopky">${ic("timer", 16)}</button>`
      : `<input class="lv-in num" id="lw-${i}-${j}" type="text" inputmode="decimal" autocomplete="off" data-change="lv-w" data-i="${i}" data-j="${j}"
          value="${r.weight != null ? lvNum(kgOut(r.weight)) : ""}" placeholder="${phW}" aria-label="${work}. série — ${kind === "bw" ? "zátěž" : "váha"} v ${weightUnit()}">`;
    const ask = rir && LV.rirAsk && LV.rirAsk.i === i && LV.rirAsk.j === j && r.done && !isW;
    return `
      <div class="lv-row${r.done ? " done" : ""}${isW ? " warm" : ""}${st && st.isPR ? " pr" : ""}">
        <button class="lv-no" data-act="lv-set" data-i="${i}" data-j="${j}" aria-label="${isW ? "Zahřívací série" : work + ". série"} — možnosti">${isW ? "Z" : work}${r.failure ? `<i class="lv-fail" aria-hidden="true"></i>` : ""}</button>
        <span class="lv-prev num">${isW ? "" : prev}</span>
        ${wCell}
        <input class="lv-in num" id="lr-${i}-${j}" type="text" inputmode="numeric" autocomplete="off" data-change="lv-r" data-i="${i}" data-j="${j}"
          value="${r.reps != null ? r.reps : ""}" placeholder="${phR}" aria-label="${isW ? "Zahřívací" : work + "."} série — ${kind === "time" ? "sekundy" : "opakování"}">
        ${rir ? `<button class="lv-rir num${r.rir != null ? " set" : ""}" data-act="lv-rir-ask" data-i="${i}" data-j="${j}"${isW ? " disabled" : ""}
          aria-label="RIR — opakování v záloze">${isW ? "" : r.rir != null ? rirLabel(r.rir) : t && t.rir != null ? `<s>${esc(String(t.rir))}</s>` : "–"}</button>` : ""}
        <button class="lv-chk${r.done ? " on" : ""}" data-act="lv-check" data-i="${i}" data-j="${j}" aria-pressed="${r.done}"
          aria-label="${r.done ? "Zrušit odškrtnutí" : "Odškrtnout sérii"}">${ic(st && st.isPR ? "trophy" : "check", 17, 2.8)}</button>
      </div>
      ${st && st.isPR ? `<div class="lv-prline">${ic("trophy", 13)} Rekord — ${(st.rec || []).map(x => REC_LABEL[x]).join(", ")}</div>` : ""}
      ${r.note ? `<div class="lv-note">${ic("note", 13)} ${esc(r.note)}</div>` : ""}
      ${ask ? `<div class="lv-ask"><span>Kolik by ještě šlo?</span>${[0, 1, 2, 3, 4].map(v =>
        `<button class="rir-opt${r.rir === v ? " on" : ""}" data-act="lv-rir" data-i="${i}" data-j="${j}" data-v="${v}">${rirLabel(v)}</button>`).join("")}</div>` : ""}`;
  }).join("");

  return `
    <section class="card lv-ex${ss}${isCur ? " cur" : ""}" id="exblock-${i}">
      <header class="lv-head">
        <button class="lv-thumb" data-act="ex-detail" data-exid="${exId}" aria-label="Ukázka a technika cviku ${esc(name)}">${exThumb(exId, { anim: isCur })}</button>
        <div class="grow" data-act="ex-detail" data-exid="${exId}">
          <h2 class="lv-name">${esc(name)}</h2>
          <div class="lv-meta">${meta}</div>
        </div>
        <button class="iconbtn sm" data-act="lv-menu" data-i="${i}" aria-label="Možnosti cviku ${esc(name)}">${ic("more", 20)}</button>
      </header>
      ${pin}${hint}
      ${linkNext ? `<div class="lv-hint ss-line">${ic("link", 15)}<span>Superset s dalším cvikem — pauza až po kole</span></div>` : ""}
      <div class="lv-table${rir ? " has-rir" : ""}${kind === "time" ? " is-time" : ""}">
        <div class="lv-row lv-th" aria-hidden="true">
          <span>Série</span><span>Minule</span><span>${kind === "time" ? "" : kind === "bw" ? "+" + weightUnit() : weightUnit()}</span>
          <span>${kind === "time" ? "s" : "Opak."}</span>${rir ? "<span>RIR</span>" : ""}<span></span>
        </div>
        ${rows}
      </div>
      <div class="lv-foot">
        <button class="btn sm" data-act="lv-add" data-i="${i}">${ic("plus", 15, 2.4)} Série</button>
        ${allDone ? `<button class="btn sm" data-act="lv-close" data-i="${i}">${ic("chevU", 15, 2.4)} Sbalit</button>` : ""}
        <span class="lv-count num">${doneN}${t && t.sets ? "/" + t.sets : ""} ${setWordTop(t && t.sets ? t.sets : doneN)}</span>
      </div>
    </section>`;
}

/* ---- zápis ---- */
function lvRow(d) {
  const a = S.activeSession;
  const e = a && a.entries[Number(d.i)];
  const r = e && e.rows && e.rows[Number(d.j)];
  return r ? { a, e, r, i: Number(d.i), j: Number(d.j) } : null;
}
function lvFlag(el) {
  if (!el) return;
  el.classList.add("err");
  el.setAttribute("aria-invalid", "true");
  const clear = () => { el.classList.remove("err"); el.removeAttribute("aria-invalid"); };
  el.addEventListener("input", clear, { once: true });
  setTimeout(clear, 4000);
}
/* změna pole: hodnota se hned uloží do řádku, obrazovka se nepřekresluje */
function liveChange(t) {
  const c = t.dataset.change;
  if (c !== "lv-w" && c !== "lv-r") return false;
  const x = lvRow(t.dataset);
  if (!x) return true;
  if (c === "lv-w") { const v = kgIn(t.value); x.r.weight = v == null || v < 0 ? null : v; }
  else { const v = parseInt(t.value, 10); x.r.reps = v > 0 ? v : null; }
  if (x.r.done) {
    if (x.r.reps == null || (x.r.weight == null && exKind(x.e.exerciseId) === "weight")) x.r.done = false;
    syncEntry(x.a, x.e);
    save(); render();
  } else save();
  return true;
}
function lvCheck(d) {
  const x = lvRow(d);
  if (!x) return;
  const { a, e, r, i, j } = x;
  const kind = exKind(e.exerciseId);
  if (r.done) {                                 // druhé klepnutí odškrtnutí vrátí
    r.done = false;
    if (LV.rirAsk && LV.rirAsk.i === i && LV.rirAsk.j === j) LV.rirAsk = null;
    syncEntry(a, e); save(); render();
    return;
  }
  const wEl = document.getElementById(`lw-${i}-${j}`), rEl = document.getElementById(`lr-${i}-${j}`);
  const reps = parseInt(rEl && (rEl.value || rEl.placeholder), 10);
  const wRaw = wEl ? (wEl.value.trim() || wEl.placeholder) : "";
  const weight = kind === "time" ? 0 : wRaw === "" && kind === "bw" ? 0 : kgIn(wRaw);
  if (!(reps > 0)) { lvFlag(rEl); toast(kind === "time" ? "Zadej délku výdrže" : "Zadej počet opakování", "err"); return; }
  if (weight == null || weight < 0) { lvFlag(wEl); toast("Zadej váhu", "err"); return; }
  if (LV.sw && LV.sw.i === i && LV.sw.j === j) { LV.sw = null; clearInterval(_lvSwTimer); }
  r.reps = reps; r.weight = weight; r.done = true;
  if (r.t === "n") {
    const types = liveRecordTypes(e.exerciseId, { reps, weight }, e.sets, a.id);
    if (types.length) toast(`Rekord — ${exName(e.exerciseId)}: ${types.map(t => REC_LABEL[t]).join(", ")}`, "pr");
  }
  syncEntry(a, e);
  LV.rirAsk = Settings.get().rirMode && r.t === "n" && kind !== "time" && r.rir == null ? { i, j } : null;
  /* pauza: ne při úpravě, ne po zahřívací a ne uvnitř supersetu (až po kole) */
  const inSuper = e.link && i < a.entries.length - 1;
  if (!a.editOf && r.t === "n" && !inSuper) Rest.start(entryRest(a, e));
  if (WV.openIdx === i && !e.done) WV.openIdx = null;
  save(); render();
  if (inSuper) { const el = document.getElementById("exblock-" + (i + 1)); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }
}

/* zahřívací série z cílové váhy první pracovní série: 50 % × 8, 70 % × 5, 85 % × 2 */
function warmupPlan(kg) {
  if (!(kg > 0)) return [];
  const u = weightUnit() === "lb" ? 5 * KG_PER_LB : 2.5;
  const rd = p => Math.max(u, Math.round(kg * p / u) * u);
  const steps = kg < 30 ? [[0.6, 8]] : kg < 60 ? [[0.5, 8], [0.75, 4]] : [[0.5, 8], [0.7, 5], [0.85, 2]];
  const out = [];
  for (const [p, reps] of steps) { const w = rd(p); if (w < kg && !out.some(o => o.weight === w)) out.push({ weight: w, reps }); }
  return out;
}
function lvAddWarm(i) {
  const a = S.activeSession, e = a && a.entries[i];
  if (!e) return;
  const { hints } = rowHints(a, e);
  const fi = e.rows.findIndex(r => r.t === "n");
  const first = fi >= 0 ? e.rows[fi] : null;
  const kg = first && first.weight != null ? first.weight : fi >= 0 && hints[fi] ? hints[fi].weight : null;
  const plan = exKind(e.exerciseId) === "weight" ? warmupPlan(kg) : [];
  const add = plan.length ? plan.map(p => ({ t: "w", reps: p.reps, weight: p.weight, done: false })) : [{ t: "w", reps: null, weight: null, done: false }];
  const at = e.rows.findIndex(r => r.t === "n");
  e.rows.splice(at < 0 ? e.rows.length : at, 0, ...add);
  WV.openIdx = i;
  closeModal(); save(); render();
  toast(plan.length ? `Zahřátí: ${plan.map(p => `${lvNum(kgOut(p.weight))} × ${p.reps}`).join(" · ")} — nepočítá se do sérií` : "Zahřívací série přidána — nepočítá se do sérií", "ok");
}
function lvMove(i, dir) {
  const a = S.activeSession, to = i + dir;
  if (!a || to < 0 || to >= a.entries.length) return;
  const [m] = a.entries.splice(i, 1);
  a.entries.splice(to, 0, m);
  WV.openIdx = null; LV.rirAsk = null;
  closeModal(); save(); render();
  const el = document.getElementById("exblock-" + to);
  if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
}
/* stopky u výdrže: klepnutí spustí, druhé zastaví a zapíše sekundy do řádku */
function lvStopwatch(d) {
  const x = lvRow(d);
  if (!x) return;
  const el = () => document.getElementById(`lsw-${x.i}-${x.j}`);
  if (LV.sw && LV.sw.i === x.i && LV.sw.j === x.j) {
    x.r.reps = Math.max(1, Math.round((Date.now() - LV.sw.start) / 1000));
    LV.sw = null; clearInterval(_lvSwTimer);
    save(); render();
    return;
  }
  LV.sw = { i: x.i, j: x.j, start: Date.now() };
  clearInterval(_lvSwTimer);
  _lvSwTimer = setInterval(() => {
    if (!LV.sw) { clearInterval(_lvSwTimer); return; }
    const b = el();
    if (b) b.textContent = fmtClock((Date.now() - LV.sw.start) / 1000);
  }, 250);
  if (el()) { el().classList.add("on"); el().textContent = "0:00"; }
}

/* ---- sheet série (klepnutí na číslo) ---- */
function openSetSheet(i, j) {
  const x = lvRow({ i, j });
  if (!x) return;
  const { e, r } = x;
  const kind = exKind(e.exerciseId);
  const rir = Settings.get().rirMode && kind !== "time" && r.t === "n";
  openModal(`${modalTitle(r.t === "w" ? "Zahřívací série" : "Série")}
    <p class="modal-sub">${esc(exName(e.exerciseId))}${r.reps != null ? ` · ${setShort(e.exerciseId, { reps: r.reps, weight: r.weight || 0 })}` : ""}</p>
    <div class="seg" role="tablist" aria-label="Druh série">
      <button class="seg-btn${r.t === "n" ? " on" : ""}" data-act="lv-type" data-i="${i}" data-j="${j}" data-t="n" role="tab" aria-selected="${r.t === "n"}">Pracovní</button>
      <button class="seg-btn${r.t === "w" ? " on" : ""}" data-act="lv-type" data-i="${i}" data-j="${j}" data-t="w" role="tab" aria-selected="${r.t === "w"}">Zahřívací</button>
    </div>
    <p class="cap" style="margin:8px 2px 0">Zahřívací série se nepočítá do sérií, objemu ani rekordů.</p>
    ${rir ? `<div class="lg-head" style="margin-top:18px">Opakování v záloze (RIR)</div>
      <div class="rir-opts">${[0, 1, 2, 3, 4].map(v => `<button class="rir-opt${r.rir === v ? " on" : ""}" data-act="lv-rir" data-i="${i}" data-j="${j}" data-v="${v}" data-sheet="1">${rirLabel(v)}</button>`).join("")}</div>` : ""}
    ${r.t === "n" ? `<div class="lg" style="margin-top:14px"><div class="lg-row"><span class="lg-l">Do selhání</span>
      <button class="switch${r.failure ? " on" : ""}" data-act="lv-fail" data-i="${i}" data-j="${j}" role="switch" aria-checked="${!!r.failure}" aria-label="Do selhání"></button></div></div>` : ""}
    <label class="field" style="margin-top:14px"><span>Poznámka k sérii</span>
      <input class="input" id="lvNote" value="${esc(r.note || "")}" placeholder="např. bolelo rameno" data-change="lv-note" data-i="${i}" data-j="${j}"></label>
    <div class="btn-row">
      <button class="btn danger" data-act="lv-del" data-i="${i}" data-j="${j}">${ic("trash", 16)} Smazat sérii</button>
      <button class="btn primary" data-act="modal-close">Hotovo</button>
    </div>`);
}

/* ---- nabídka cviku (⋯) ---- */
function openExerciseMenu(i) {
  const a = S.activeSession;
  const entry = a && a.entries[i];
  if (!entry) return;
  const ex = getExercise(entry.exerciseId);
  const last = i === a.entries.length - 1;
  const item = (icon, label, act, extra = "", cls = "") => `
    <button class="more-item${cls}" data-act="${act}" data-i="${i}" ${extra}>
      <span class="mi-ic">${ic(icon, 21)}</span>${label}</button>`;
  openModal(`${modalTitle(exName(entry.exerciseId))}
    <div class="more-list">
      ${item("info", "Ukázka, technika a historie", "ex-detail", `data-exid="${entry.exerciseId}"`)}
      ${a.editOf ? "" : item("flame", "Přidat zahřívací série", "lv-warm")}
      ${usesPlates(entry.exerciseId) ? item("dumbbell", "Kotouče na osu", "lv-plates") : ""}
      ${item("swap", "Vyměnit cvik", "w-swap-ex")}
      ${last ? "" : item("link", entry.link ? "Zrušit superset s dalším cvikem" : "Superset s dalším cvikem", "w-link")}
      ${item("pin", ex && ex.pin ? "Upravit poznámku ke cviku" : "Připnout poznámku ke cviku", "w-pin")}
      ${i > 0 ? item("chevU", "Posunout výš", "lv-move", `data-d="-1"`) : ""}
      ${last ? "" : item("chevD", "Posunout níž", "lv-move", `data-d="1"`)}
      ${item("trash", "Odebrat z tréninku", "w-remove-ex", "", " danger")}
    </div>`);
}

/* ---- kotouče: vlastní váha v sheetu, pole v tréninku nemění ---- */
function openPlatesModal(i) {
  const a = S.activeSession;
  const e = a && a.entries[i];
  if (!e) return;
  const { hints } = rowHints(a, e);
  const j = e.rows.findIndex(r => r.t === "n" && !r.done);
  const jj = j < 0 ? e.rows.length - 1 : j;
  const r = e.rows[jj];
  const kg = r && r.weight != null ? r.weight : hints[jj] && hints[jj].weight != null ? hints[jj].weight : 0;
  LV.plates = { exId: e.exerciseId, w: Math.round(kgOut(kg) * 100) / 100 };
  openModal(`${modalTitle("Kotouče")}
    <p class="modal-sub">${esc(exName(e.exerciseId))} · na každou stranu osy</p>
    <div id="plBody">${platesBodyHtml()}</div>`);
}
function platesBodyHtml() {
  const { exId, w } = LV.plates;
  const u = weightUnit();
  const bar = plateBar(exId);
  const r = platesFor(w, bar, u);
  const maxP = PLATES[u][0];
  const vis = r.plates.map(p => `<span class="pl" style="height:${(30 + 66 * p / maxP).toFixed(0)}px;width:${(10 + 8 * p / maxP).toFixed(0)}px"></span>`).join("");
  const step = u === "lb" ? 5 : 2.5;
  const txt = !w ? "Nastav váhu tlačítky"
    : w < bar ? `Méně než samotná osa (${fmtNum(bar)} ${u})`
    : !r.plates.length ? (bar ? "Jen osa, bez kotoučů" : "Bez kotoučů")
    : `Na každou stranu <b>${r.plates.map(p => fmtNum(p, 2)).join(" + ")}</b> ${u}`;
  return `
    <div class="pl-top">
      <button class="step-btn" data-act="pl-step" data-d="${-step}" aria-label="Méně">${ic("minus", 22, 2.2)}</button>
      <div class="pl-w"><b class="num">${fmtNum(w, 2)}</b><small>${u}</small></div>
      <button class="step-btn" data-act="pl-step" data-d="${step}" aria-label="Více">${ic("plus", 22, 2.2)}</button>
    </div>
    <div class="pl-vis" aria-hidden="true"><i class="pl-collar"></i>${vis}<i class="pl-sleeve"></i></div>
    <p class="pl-txt">${txt}</p>
    ${r.rest ? `<p class="pl-warn">${ic("alert", 15)} Zbývá ${fmtNum(r.rest, 2)} ${u} na stranu — z kotoučů ${fmtNum(PLATES[u][PLATES[u].length - 1], 2)}+ nejde složit</p>` : ""}
    <div class="lg-head pl-bar-h">Osa</div>
    <div class="seg sm" role="tablist">${BARS[u].map(b => `<button class="seg-btn${b === bar ? " on" : ""}" data-act="pl-bar" data-v="${b}"
      role="tab" aria-selected="${b === bar}">${b ? `${fmtNum(b)} ${u}` : "Bez osy"}</button>`).join("")}</div>`;
}
function refreshPlates() {
  const el = document.getElementById("plBody");
  if (el && LV.plates) el.innerHTML = platesBodyHtml();
}

/* ---- detail cviku: animace, technika, naposledy, rekordy ---- */
function openExDetail(exId) {
  const ex = getExercise(exId);
  if (!ex) return;
  const en = exNameEn(ex);
  const hist = exerciseHistory(exId, null, 5);
  const rec = exerciseRecords(exId);
  const best = rec && rec.best ? REC_ORDER.filter(k => rec.best[k]).map(k => {
    const b = rec.best[k];
    const v = k === "e1rm" ? fmtWeight(est1RM(b.weight, b.reps)) : k === "weight" ? `${fmtWeight(b.weight)} × ${b.reps}` : `${b.reps} × ${fmtWeight(b.weight)}`;
    return `<div class="exd-rec"><span>${REC_LABEL[k]}</span><b class="num">${v}</b></div>`;
  }).join("") : "";
  const a = S.activeSession;
  const entry = a && a.entries.find(e => e.exerciseId === exId);
  const sug = entry && !a.editOf ? liveSuggest(a, entry) : nextSets(exId, null, null);
  openModal(`${modalTitle(ex.name)}
    ${en ? `<p class="modal-sub">${esc(en)}</p>` : ""}
    ${exAnim(exId)}
    <div class="exd-meta"><i class="p-dot" style="background:${catColor(ex.category)}"></i>${esc(ex.category)}${ex.kind === "time" ? " · výdrž" : ex.kind === "bw" ? " · vlastní váha" : ""}</div>
    ${ex.pin ? `<div class="lv-hint pin">${ic("pin", 15)}<span>${esc(ex.pin)}</span></div>` : ""}
    ${sug && sug.text ? `<div class="lv-hint k-${sug.kind}">${ic(LV_KIND_ICON[sug.kind] || "target", 15, 2.2)}<span>${esc(sug.text)}</span></div>` : ""}
    ${ex.description ? `<div class="lg-head">Technika</div><p class="exd-desc">${esc(ex.description)}</p>` : ""}
    ${hist.length ? `<div class="lg-head">Naposledy</div>
      <div class="exd-hist">${hist.map(h => `<div class="exd-h"><span>${fmtShort(h.date)}</span><b class="num">${setsSummary(exId, h.sets)}</b></div>`).join("")}</div>` : `<p class="cap" style="margin-top:14px">Tenhle cvik ještě nemá žádný zápis.</p>`}
    ${best ? `<div class="lg-head">Rekordy</div><div class="exd-recs">${best}</div>` : ""}
    <div class="btn-row">
      <a class="btn" href="${youtubeUrl(exId)}" target="_blank" rel="noopener">${ic("play", 15)} Video</a>
      ${hist.length ? `<button class="btn" data-act="pg-ex" data-exid="${exId}">${ic("trend", 15)} Graf progresu</button>` : ""}
    </div>`);
}

const LIVE_ACTIONS = {
  "lv-check": d => lvCheck(d),
  "lv-open": d => { WV.openIdx = Number(d.i); render(); },
  "lv-close": () => { WV.openIdx = null; render(); },
  "lv-add": d => {
    const e = S.activeSession && S.activeSession.entries[Number(d.i)];
    if (!e) return;
    e.rows.push({ t: "n", reps: null, weight: null, done: false });
    WV.openIdx = null;
    syncEntry(S.activeSession, e); save(); render();
  },
  "lv-set": d => openSetSheet(Number(d.i), Number(d.j)),
  "lv-type": d => {
    const x = lvRow(d);
    if (!x) return;
    x.r.t = d.t === "w" ? "w" : "n";
    if (x.r.t === "w") { x.r.rir = null; x.r.failure = false; }
    syncEntry(x.a, x.e); save(); render();
    openSetSheet(x.i, x.j);
  },
  "lv-fail": (d, t) => {
    const x = lvRow(d);
    if (!x) return;
    x.r.failure = !x.r.failure;
    if (x.r.failure && Settings.get().rirMode) x.r.rir = 0;
    t.classList.toggle("on", x.r.failure);
    t.setAttribute("aria-checked", String(x.r.failure));
    syncEntry(x.a, x.e); save(); render();
  },
  "lv-rir-ask": d => {
    const x = lvRow(d);
    if (!x || x.r.t !== "n") return;
    if (!x.r.done) { openSetSheet(x.i, x.j); return; }
    LV.rirAsk = LV.rirAsk && LV.rirAsk.i === x.i && LV.rirAsk.j === x.j ? null : { i: x.i, j: x.j };
    render();
  },
  "lv-rir": d => {
    const x = lvRow(d);
    if (!x) return;
    const v = Number(d.v);
    x.r.rir = x.r.rir === v ? null : v;
    if (x.r.rir === 0) x.r.failure = true;
    LV.rirAsk = null;
    syncEntry(x.a, x.e); save(); render();
    if (d.sheet) openSetSheet(x.i, x.j);
  },
  "lv-del": d => withUndo("Série smazána", () => {
    const x = lvRow(d);
    if (!x) return;
    x.e.rows.splice(x.j, 1);
    LV.rirAsk = null;
    syncEntry(x.a, x.e);
    closeModal();
  }),
  "lv-sw": d => lvStopwatch(d),
  "lv-menu": d => openExerciseMenu(Number(d.i)),
  "lv-warm": d => lvAddWarm(Number(d.i)),
  "lv-move": d => lvMove(Number(d.i), Number(d.d)),
  "lv-plates": d => openPlatesModal(Number(d.i)),
  "lv-min": () => goTab("today"),
  "pl-step": d => { if (LV.plates) { LV.plates.w = Math.max(0, Math.round((LV.plates.w + Number(d.d)) * 100) / 100); refreshPlates(); } },
  "pl-bar": d => {
    if (!LV.plates) return;
    Settings.set({ plateBars: Object.assign({}, Settings.get().plateBars, { [LV.plates.exId]: Number(d.v) }) });
    refreshPlates();
  },
  "ex-detail": d => openExDetail(d.exid)
};

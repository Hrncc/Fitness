/* ===== Týden → Pokrok: jak se ti vede v tréninku =====
   Tréninková analytika na jednom místě — od nejdůležitější odpovědi dolů:
   srovnání posledních 30 dní, síla po cvicích, série po týdnech,
   pravidelnost a partie po týdnech. Pod tím karta Partie s rozsahem.
   Barvy: data = --chart (bílá/šedá), volt = zlepšení a odcvičený den,
   zlatá = rekordy, partie jen jako tečka, proužek nebo vlastní malá řada
   (small multiples — sedm partií v jednom skládaném sloupci by od sebe
   barvou nešlo spolehlivě rozeznat). */
"use strict";

const PG = {
  allEx: false          // rozbalený seznam cviků v kartě Síla
};
const PG_WEEKS = 12;    // série po týdnech a partie po týdnech
const PG_HEAT_WEEKS = 16;
const PG_STRENGTH_DAYS = 90;
const CZ_MONTHS_SHORT = ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"];

function renderProgress() {
  if (!S.sessions.some(s => s.type === "weights")) {
    return `<div class="card"><div class="empty-note">Zatím žádný silový trénink.<br>
      Po prvních trénincích tu uvidíš, jak se ti daří.</div></div>`;
  }
  return progressKpiHtml() + strengthHtml() + weeklySetsHtml() + consistencyHtml() + catWeeksHtml();
}

/* ---- Souhrn období ---- */
function periodStats(from, to) {
  const sess = S.sessions.filter(s => s.date >= from && s.date <= to);
  const w = sess.filter(s => s.type === "weights");
  const c = sess.filter(s => s.type === "cardio");
  const rated = w.filter(s => s.rating);
  return {
    weights: w.length,
    cardio: c.length,
    cardioMin: c.reduce((m, s) => m + ((s.entries[0] || {}).duration || 0), 0),
    sets: w.reduce((n, s) => n + s.entries.reduce((k, e) => k + (e.sets || []).length, 0), 0),
    volume: w.reduce((v, s) => v + sessionVolume(s), 0),
    prs: countPRsInRange(from, to),
    rating: rated.length ? rated.reduce((a, s) => a + s.rating, 0) / rated.length : null
  };
}

/* Změna proti minulému období — šipka + číslo, nikdy jen barva.
   Volt = víc (u tréninku je víc lepší), pokles je neutrální šedý,
   červená patří chybám. */
function deltaHtml(cur, prev, pct = false) {
  if (pct) {
    if (!prev) return cur ? `<span class="delta up">${ic("trend", 13, 2.4)} nové</span>` : `<span class="delta">—</span>`;
    const p = Math.round((cur / prev - 1) * 100);
    if (!p) return `<span class="delta">±0 %</span>`;
    return `<span class="delta ${p > 0 ? "up" : "down"}">${p > 0 ? "↑" : "↓"} ${Math.abs(p)} %</span>`;
  }
  const d = cur - prev;
  if (!d) return `<span class="delta">±0</span>`;
  return `<span class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "↑" : "↓"} ${Math.abs(d)}</span>`;
}

/* Objem v zobrazené jednotce; nad 100 000 v tisících (t / k lb) */
function fmtVolume(kg) {
  const v = kgOut(kg);
  const lb = weightUnit() === "lb";
  return v >= 100000 ? { val: fmtNum(v / 1000, 1), unit: lb ? "k lb" : "t" } : { val: fmtNum(v), unit: weightUnit() };
}

function progressKpiHtml() {
  const t = todayStr();
  const cur = periodStats(addDays(t, -29), t);
  const prev = periodStats(addDays(t, -59), addDays(t, -30));
  const vol = fmtVolume(cur.volume);
  const tile = (val, lbl, delta, cls = "") => `
    <div class="stat kpi">
      <div class="val${cls}">${val}</div>
      <div class="lbl">${lbl}</div>
      ${delta}
    </div>`;
  const extra = [`kardio ${cur.cardio}× · ${fmtNum(cur.cardioMin)} min`];
  if (cur.rating != null) extra.push(`Ø hodnocení ${fmtNum(cur.rating, 1)}/10`);
  return `
    <div class="card">
      ${cardHead("chart", "Posledních 30 dní", `<span class="small">vs předchozích 30</span>`)}
      <div class="stat-grid">
        ${tile(cur.weights, "silových tréninků", deltaHtml(cur.weights, prev.weights))}
        ${tile(fmtNum(cur.sets), "sérií", deltaHtml(cur.sets, prev.sets, true))}
        ${tile(vol.val, `objem (${vol.unit})`, deltaHtml(cur.volume, prev.volume, true))}
        ${tile(cur.prs, "nových rekordů", deltaHtml(cur.prs, prev.prs), " pr")}
      </div>
      <p class="small mt" style="margin-bottom:0">${extra.join(" · ")}</p>
    </div>`;
}

/* ---- Síla po cvicích ----
   Nejlepší výkon cviku v každém tréninku: e1RM, u cviků bez váhy (plank,
   kliky, část core) nejvíc opakování. Metrika se volí podle toho, jestli
   cvik někdy měl váhu. */
function exerciseSeries(exId) {
  const sess = S.sessions
    .filter(s => s.type === "weights")
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
  const sets = [];
  for (const s of sess) for (const e of s.entries) {
    if (e.exerciseId === exId) for (const st of e.sets || []) sets.push({ date: s.date, sid: s.id, st });
  }
  const metric = sets.some(x => (x.st.weight || 0) > 0) ? "e1rm" : "reps";
  const bySession = new Map();
  for (const { date, sid, st } of sets) {
    const v = metric === "e1rm" ? est1RM(st.weight, st.reps) : (st.reps || 0);
    if (!v) continue;
    const cur = bySession.get(sid);
    if (!cur || v > cur.value) bySession.set(sid, { date, value: v, set: st });
  }
  return { metric, points: [...bySession.values()] };
}

function fmtMetric(metric, v) {
  return metric === "e1rm" ? fmtWeight(v) : `${fmtNum(v)} opak.`;
}

function strengthRows() {
  const since = addDays(todayStr(), -(PG_STRENGTH_DAYS - 1));
  const ids = new Set();
  for (const s of S.sessions) {
    if (s.type !== "weights" || s.date < since) continue;
    for (const e of s.entries) if ((e.sets || []).length) ids.add(e.exerciseId);
  }
  const prSince = addDays(todayStr(), -29);
  return [...ids].map(id => {
    const { metric, points } = exerciseSeries(id);
    const win = points.filter(p => p.date >= since);
    const first = win[0], last = win[win.length - 1];
    return {
      id, metric, win, first, last,
      change: first && first.value ? (last.value / first.value - 1) * 100 : 0,
      recentPR: prHistory(id).some(h => h.date >= prSince && h.date !== (points[0] || {}).date)
    };
  })
    .filter(r => r.win.length >= 2)
    .sort((a, b) => b.win.length - a.win.length || b.last.date.localeCompare(a.last.date));
}

function strengthHtml() {
  const rows = strengthRows();
  if (!rows.length) {
    return `<div class="card">
      ${cardHead("trend", "Síla")}
      <p class="muted" style="margin:0">Progres se ukáže, až cvik odcvičíš aspoň dvakrát za poslední 3 měsíce.</p>
    </div>`;
  }
  const better = rows.filter(r => r.last.value > r.first.value).length;
  const shown = PG.allEx ? rows : rows.slice(0, 6);
  const list = shown.map(r => {
    const ch = Math.round(r.change);
    const delta = !ch ? `<span class="delta">±0 %</span>`
      : `<span class="delta ${ch > 0 ? "up" : "down"}">${ch > 0 ? "↑" : "↓"} ${Math.abs(ch)} %</span>`;
    return `
      <div class="list-item str-row" data-act="pg-ex" data-exid="${r.id}">
        <i class="p-stripe" style="background:${exColor(r.id)}"></i>
        <div class="grow">
          <div class="name">${esc(exName(r.id))}</div>
          <div class="small">${r.win.length}× · ${r.metric === "e1rm" ? "e1RM" : "opakování"}${r.recentPR
            ? ` · <span style="color:var(--yellow);font-weight:700">rekord</span>` : ""}</div>
        </div>
        ${sparklineHtml(r.win.map(p => p.value))}
        <div class="str-val"><b>${fmtMetric(r.metric, r.last.value)}</b>${delta}</div>
      </div>`;
  }).join("");
  return `
    <div class="card">
      ${cardHead("trend", "Síla", `<span class="badge ${better * 2 >= rows.length ? "green" : "neutral"}">${ic("trend", 13, 2.4)} ${better} z ${rows.length}</span>`)}
      <p class="small" style="margin:-6px 0 4px">Zlepšení za 3 měsíce: první vs poslední trénink cviku. Klepni na cvik pro graf.</p>
      ${list}
      ${rows.length > 6 ? `<button class="btn sm ghost full mt" data-act="pg-all">${PG.allEx
        ? "Méně" : `Zobrazit všech ${rows.length}`}</button>` : ""}
    </div>`;
}

function openExerciseProgress(id) {
  const { metric, points } = exerciseSeries(id);
  if (!points.length) return;
  const first = points[0], last = points[points.length - 1];
  const best = points.reduce((a, b) => b.value > a.value ? b : a);
  const ch = first.value ? Math.round((last.value / first.value - 1) * 100) : 0;
  const out = v => metric === "e1rm" ? Math.round(kgOut(v) * 10) / 10 : v;
  const u = metric === "e1rm" ? ` · ${weightUnit()}` : " · opak.";
  const en = exNameEn(id);
  const rows = points.slice().reverse().slice(0, 12).map(p => `
    <div class="set-row">
      <span class="grow small" style="color:var(--text2)">${fmtDate(p.date)}</span>
      <span class="set-val">${metric === "e1rm"
        ? `${fmtNum(p.set.reps)}<span>×</span>${fmtWeight(p.set.weight)}` : `${fmtNum(p.set.reps)} opak.`}</span>
      <span class="small" style="min-width:72px;text-align:right">${metric === "e1rm" ? fmtWeight(p.value) : ""}</span>
    </div>`).join("");
  openModal(`${modalTitle(exName(id))}
    ${en ? `<div class="name-en" style="margin:-10px 0 14px">${esc(en)}</div>` : ""}
    <div class="stat-grid three">
      <div class="stat"><div class="val">${fmtNum(out(last.value), 1)}</div><div class="lbl">teď${u}</div></div>
      <div class="stat"><div class="val">${fmtNum(out(best.value), 1)}</div><div class="lbl">nejlépe${u}</div></div>
      <div class="stat"><div class="val" style="color:var(--${ch > 0 ? "green" : "text"})">${ch > 0 ? "+" : ""}${ch} %</div><div class="lbl">od začátku</div></div>
    </div>
    <div class="small mt">${metric === "e1rm" ? `e1RM v ${weightUnit()} — odhad maxima na 1 opakování z nejlepší série tréninku`
      : "Nejvíc opakování v tréninku"} · tah prstem po grafu ukáže hodnotu</div>
    <div class="mt">${points.length >= 2
      ? lineChart(points.map(p => ({ date: p.date, value: out(p.value) })), { unit: metric === "e1rm" ? " " + weightUnit() : " opak.", dec: metric === "e1rm" ? 1 : 0 })
      : `<div class="empty-note">Zatím jen jeden trénink</div>`}</div>
    <div class="h3" style="margin-top:16px">Nejlepší série v trénincích</div>
    <div class="sets" style="margin-top:6px">${rows}</div>
    ${currentPR(id) ? `<button class="btn ghost full mt" data-act="w-pr-history" data-exid="${id}">${ic("trophy", 17)} Historie rekordů</button>` : ""}`);
}

/* ---- Série po týdnech ---- */
function weekBuckets(n) {
  const mon0 = mondayOf(todayStr());
  const firstW = S.sessions.filter(s => s.type === "weights").map(s => s.date).sort()[0];
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const from = addDays(mon0, -7 * i), to = addDays(from, 6);
    const ws = S.sessions.filter(s => s.type === "weights" && s.date >= from && s.date <= to);
    out.push({
      from, to, sessions: ws,
      before: !firstW || to < firstW,        // týden před prvním tréninkem vůbec
      sets: ws.reduce((k, s) => k + s.entries.reduce((m, e) => m + (e.sets || []).length, 0), 0)
    });
  }
  return out;
}

function weeklySetsHtml() {
  const weeks = weekBuckets(PG_WEEKS).filter(w => !w.before);
  const done = weeks.slice(0, -1);           // poslední týden ještě běží
  const avg = done.length ? done.reduce((a, w) => a + w.sets, 0) / done.length : null;
  const data = weeks.map(w => {
    const d = parseDate(w.from);
    return {
      label: `${d.getDate()}.${d.getMonth() + 1}.`,
      value: w.sets,
      tip: `týden od ${d.getDate()}. ${d.getMonth() + 1}. · ${w.sessions.length} ${w.sessions.length === 1 ? "trénink" : w.sessions.length >= 2 && w.sessions.length <= 4 ? "tréninky" : "tréninků"}`
    };
  });
  return `
    <div class="card">
      ${cardHead("chart", "Série za týden", avg != null ? `<span class="small">Ø <b style="color:var(--text)">${fmtNum(avg, 0)}</b> / týden</span>` : "")}
      ${columnChart(data, { unit: " sérií" })}
      <p class="small" style="margin:8px 0 0">Světlý sloupec je tento týden (ještě běží). Tah prstem po grafu ukáže týden.</p>
    </div>`;
}

/* ---- Pravidelnost: 16 týdnů jako mřížka dní ----
   Sytost volt = kolik sérií ten den (vůči nejsilnějšímu dni v okně),
   červená tečka = kardio. Klepnutí na den otevře jeho detail. */
function consistencyHtml() {
  const today = todayStr();
  const mon0 = mondayOf(today);
  const start = addDays(mon0, -7 * (PG_HEAT_WEEKS - 1));
  const days = [];
  let maxSets = 0;
  for (let i = 0; i < PG_HEAT_WEEKS * 7; i++) {
    const ds = addDays(start, i);
    const sess = sessionsOn(ds);
    const sets = sess.filter(s => s.type === "weights")
      .reduce((k, s) => k + s.entries.reduce((m, e) => m + (e.sets || []).length, 0), 0);
    const weights = sess.some(s => s.type === "weights");
    maxSets = Math.max(maxSets, sets);
    days.push({ ds, sets, weights, cardio: sess.some(s => s.type === "cardio"), future: ds > today });
  }
  const level = d => !d.weights ? 0 : !maxSets || d.sets <= maxSets / 3 ? 1 : d.sets <= maxSets * 2 / 3 ? 2 : 3;

  /* zkratka měsíce nad týdnem, ve kterém měsíc začíná (podle pondělí) */
  const months = [];
  for (let w = 0; w < PG_HEAT_WEEKS; w++) {
    const m = parseDate(addDays(start, w * 7)).getMonth();
    const prev = w ? parseDate(addDays(start, (w - 1) * 7)).getMonth() : -1;
    months.push(`<span>${m !== prev ? CZ_MONTHS_SHORT[m] : ""}</span>`);
  }
  const cells = days.map(d => {
    const lv = level(d);
    return `<i class="hm-c${d.future ? " fut" : ""}${lv ? " l" + lv : ""}${d.ds === today ? " now" : ""}"
      ${d.future ? "" : `data-act="sum-cal-day" data-date="${d.ds}"`}
      title="${fmtDate(d.ds)}${d.weights ? ` · ${d.sets} sérií` : ""}${d.cardio ? " · kardio" : ""}">${d.cardio ? "<b></b>" : ""}</i>`;
  }).join("");

  /* čísla pod mřížkou — tréninky, průměr na týden, nejdelší pauza v okně */
  const firstW = S.sessions.filter(s => s.type === "weights").map(s => s.date).sort()[0];
  const from = firstW && firstW > start ? mondayOf(firstW) : start;
  const trainDates = [...new Set(S.sessions.filter(s => s.date >= from && s.date <= today).map(s => s.date))].sort();
  const weeksActive = Math.max(1, Math.round(daysBetween(from, today) / 7 * 10) / 10);
  const wCount = S.sessions.filter(s => s.type === "weights" && s.date >= from && s.date <= today).length;
  let gap = 0;
  for (let i = 1; i < trainDates.length; i++) gap = Math.max(gap, daysBetween(trainDates[i - 1], trainDates[i]) - 1);
  if (trainDates.length) gap = Math.max(gap, daysBetween(trainDates[trainDates.length - 1], today));

  return `
    <div class="card">
      ${cardHead("calendar", "Pravidelnost", `<span class="small">${PG_HEAT_WEEKS} týdnů</span>`)}
      <div class="hm">
        <div class="hm-months">${months.join("")}</div>
        <div class="hm-body">
          <div class="hm-dow"><span>Po</span><span></span><span>St</span><span></span><span>Pá</span><span></span><span>Ne</span></div>
          <div class="hm-grid">${cells}</div>
        </div>
      </div>
      <div class="hm-legend small">
        <span>méně</span><i class="hm-c"></i><i class="hm-c l1"></i><i class="hm-c l2"></i><i class="hm-c l3"></i><span>více sérií</span>
        <span class="hm-sep"></span><i class="hm-c"><b></b></i><span>kardio</span>
      </div>
      <div class="wk-kv mt" style="grid-template-columns:1fr 1fr 1fr">
        <div><span>silové tréninky</span><b>${wCount}</b></div>
        <div><span>Ø za týden</span><b>${fmtNum(wCount / weeksActive, 1)}</b></div>
        <div><span>nejdelší pauza</span><b>${gap} ${gap === 1 ? "den" : gap >= 2 && gap <= 4 ? "dny" : "dní"}</b></div>
      </div>
    </div>`;
}

/* ---- Partie po týdnech (small multiples) ----
   Každá partie má vlastní řádek se sloupečky za týden; měřítko je společné,
   takže nižší řádek = partie, na kterou se dostává méně. Core odškrtnutý
   přepínačem bez sérií je tečka na základně. */
function catWeeksHtml() {
  const weeks = weekBuckets(PG_WEEKS).filter(w => !w.before);
  const per = weeks.map(w => {
    const c = {};
    for (const cat of CAT_ORDER) c[cat] = 0;
    for (const s of w.sessions) {
      const cs = sessionCatSets(s);
      for (const cat of CAT_ORDER) c[cat] += cs[cat] || 0;
    }
    return { c, core: w.sessions.some(s => s.core === true) };
  });
  const max = Math.max(1, ...per.flatMap(p => CAT_ORDER.map(c => p.c[c])));
  const done = per.slice(0, -1);
  const rows = CAT_ORDER.map(cat => {
    const avg = done.length ? done.reduce((a, p) => a + p.c[cat], 0) / done.length : per[0].c[cat];
    const bars = per.map((p, i) => {
      const v = p.c[cat];
      const d = parseDate(weeks[i].from);
      const lbl = `${cat} · týden od ${d.getDate()}. ${d.getMonth() + 1}.`;
      if (!v && cat === "Core" && p.core) return `<i class="tick" title="${lbl} · core ✓"></i>`;
      return v ? `<i style="height:${Math.max(10, v / max * 100).toFixed(0)}%;background:${catColor(cat)}" title="${lbl} · ${v} sérií"></i>`
        : `<i class="z" title="${lbl} · 0"></i>`;
    }).join("");
    const tips = per.map((p, i) => {
      const d = parseDate(weeks[i].from);
      const v = p.c[cat];
      return [+((i + 0.5) / per.length).toFixed(4), 0, `${cat} · týden od ${d.getDate()}. ${d.getMonth() + 1}.`,
        !v && cat === "Core" && p.core ? "core ✓" : `${v} sérií`];
    });
    return `
      <div class="cw-row">
        <span class="cw-name"><i class="p-dot" style="background:${catColor(cat)}"></i>${cat}</span>
        <div class="cw-bars chart-wrap"${tipAttr(tips)}>${bars}</div>
        <span class="cw-avg${avg < 1 ? " low" : ""}">${fmtNum(avg, 1)}</span>
      </div>`;
  }).join("");
  return `
    <div class="card">
      ${cardHead("target", "Partie po týdnech", `<span class="small">série · Ø/týd</span>`)}
      ${rows}
      <p class="small" style="margin:10px 0 0">Stejné měřítko ve všech řádcích — nižší sloupečky = partie, na kterou se dostává méně.
        Tečka u Core = odškrtnutý bez sérií.</p>
    </div>`;
}

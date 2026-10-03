/* ===== Pokrok — jak se ti vede (Trénink · Tělo · Strava) =====
   Trénink odpovídá od nejdůležitějšího dolů: roste síla? (index síly a cviky),
   kolik toho dělám (30 dní vs předchozích 30, týdny), jak pravidelně,
   které partie zaostávají a jaké padly rekordy.
   Tělo je ve view-checkin.js, Strava ve view-summary.js.
   Barvy: data = --chart (bílá/šedá), volt = zlepšení a odcvičený den,
   zlatá = rekordy, partie jen jako tečka, proužek nebo vlastní malá řada
   (small multiples — sedm partií v jednom skládaném sloupci by od sebe
   barvou nešlo spolehlivě rozeznat). */
"use strict";

const PG = {
  seg: "training",      // training | body | food
  allEx: false,         // rozbalený seznam cviků v sekci Síla
  metric: "sets",       // týdenní graf: sets | volume
  parts: "weeks",       // partie: weeks (po týdnech) | sum (souhrn s rozsahem)
  wRange: "90"          // graf váhy: 30 | 90 | all
};
const PG_WEEKS = 12;    // série po týdnech a partie po týdnech
const PG_HEAT_WEEKS = 16;
const PG_STRENGTH_DAYS = 90;

function progressHead() {
  return {
    title: "Pokrok",
    below: `<div style="margin-top:16px">${segHtml([["training", "Trénink"], ["body", "Tělo"], ["food", "Strava"]], PG.seg, "pg-seg", "seg")}</div>`
  };
}

function renderProgress() {
  if (PG.seg === "body") return renderBody();
  if (PG.seg === "food") return foodProgressHtml();
  if (!S.sessions.some(s => s.type === "weights")) {
    return `<div class="card"><div class="empty-note">Zatím žádný silový trénink.<br>
      Po prvních trénincích tu uvidíš, jak se ti daří.</div></div>`;
  }
  return strengthHtml() + progressKpiHtml() + weeklyHtml() + consistencyHtml() + partsHtml() + recordsTeaserHtml();
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
    prs: countRecordsInRange(from, to),
    rating: rated.length ? rated.reduce((a, s) => a + s.rating, 0) / rated.length : null
  };
}

/* Změna proti minulému období — šipka + číslo, nikdy jen barva.
   Volt = víc (u tréninku je víc lepší), pokles je neutrální šedý,
   červená patří chybám. */
function deltaHtml(cur, prev, pct = false) {
  if (pct) {
    if (!prev) return cur ? `<span class="delta up">${ic("arrowUp", 12, 2.6)} nové</span>` : `<span class="delta">—</span>`;
    const p = Math.round((cur / prev - 1) * 100);
    if (!p) return `<span class="delta">±0 %</span>`;
    return `<span class="delta ${p > 0 ? "up" : "down"}">${p > 0 ? "↑" : "↓"} ${Math.abs(p)} %</span>`;
  }
  const d = cur - prev;
  if (!d) return `<span class="delta">±0</span>`;
  return `<span class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "↑" : "↓"} ${Math.abs(d)}</span>`;
}

function progressKpiHtml() {
  const t = todayStr();
  const cur = periodStats(addDays(t, -29), t);
  const prev = periodStats(addDays(t, -59), addDays(t, -30));
  const vol = fmtVolume(cur.volume);
  const extra = [`kardio ${cur.cardio}× · ${fmtNum(cur.cardioMin)} min`];
  if (cur.rating != null) extra.push(`Ø hodnocení ${fmtNum(cur.rating, 1)}/10`);
  return sec("Posledních 30 dní", `
    <div class="card">
      <div class="stats four">
        ${statHtml(cur.weights, plural(cur.weights, "silový trénink", "silové tréninky", "silových tréninků"), deltaHtml(cur.weights, prev.weights))}
        ${statHtml(fmtNum(cur.sets), setWordTop(cur.sets), deltaHtml(cur.sets, prev.sets, true))}
        ${statHtml(`${vol.val}<small>${vol.unit}</small>`, "objem", deltaHtml(cur.volume, prev.volume, true))}
        ${statHtml(cur.prs, plural(cur.prs, "nový rekord", "nové rekordy", "nových rekordů"), deltaHtml(cur.prs, prev.prs), cur.prs ? "pr" : "")}
      </div>
      <div class="chart-cap" style="margin-top:16px">${extra.join(" · ")}</div>
    </div>`, { sub: "proti předchozím 30 dnům" });
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

function strengthRows(days = PG_STRENGTH_DAYS) {
  const since = addDays(todayStr(), -(days - 1));
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
      recentPR: exerciseRecords(id).events.some(ev => ev.date >= prSince)
    };
  })
    .filter(r => r.win.length >= 2)
    .sort((a, b) => b.win.length - a.win.length || b.last.date.localeCompare(a.last.date));
}

function median(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* ---- Index síly ----
   Jedno číslo za všechny cviky: každý cvik se vztáhne ke svému prvnímu
   tréninku v okně (= 100 %) a bere se medián — jeden cvik s lehkým
   rozjezdem tak celek nepřebije. Týdenní body ukazují, jak medián rostl. */
function strengthIndex(days = PG_STRENGTH_DAYS) {
  const rows = strengthRows(days);
  if (!rows.length) return null;
  const t = todayStr();
  const series = [];
  for (let wk = mondayOf(addDays(t, -(days - 1))); wk <= t; wk = addDays(wk, 7)) {
    const end = addDays(wk, 6) < t ? addDays(wk, 6) : t;
    const ratios = [];
    for (const r of rows) {
      const pts = r.win.filter(p => p.date <= end);
      if (pts.length) ratios.push(pts[pts.length - 1].value / r.win[0].value);
    }
    if (ratios.length) series.push({ date: end, value: Math.round((median(ratios) - 1) * 1000) / 10 });
  }
  return {
    series,
    change: (median(rows.map(r => r.last.value / r.first.value)) - 1) * 100,
    improved: rows.filter(r => r.last.value > r.first.value).length,
    total: rows.length,
    rows
  };
}

function strengthHtml() {
  const idx = strengthIndex();
  if (!idx) {
    return sec("Síla", `<div class="card"><p class="muted" style="margin:0">Progres se ukáže, až cvik odcvičíš aspoň dvakrát za poslední 3 měsíce.</p></div>`);
  }
  const rows = idx.rows;
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
          <div class="li-sub">${r.win.length}× · ${r.metric === "e1rm" ? "e1RM" : "opakování"}${r.recentPR
            ? ` · <span style="color:var(--yellow);font-weight:650">rekord</span>` : ""}</div>
        </div>
        ${sparklineHtml(r.win.map(p => p.value), 56, 26)}
        <div class="str-val"><b>${fmtMetric(r.metric, r.last.value)}</b>${delta}</div>
      </div>`;
  }).join("");
  return sec("Síla", `
    <div class="card">
      <div class="idx-head">
        <div>
          <div class="cap">Index síly · medián všech cviků</div>
          <div class="hero-fig" style="margin-top:6px">${fmtSigned(idx.change)}<small>%</small></div>
        </div>
        <span class="badge${idx.improved * 2 >= idx.total ? " green" : ""}">${ic("arrowUp", 12, 2.6)} ${idx.improved} z ${idx.total}</span>
      </div>
      ${lineChart(idx.series, { height: 140, zero: true, fmt: v => fmtSigned(v) + " %" })}
      <hr class="hair">
      ${list}
      ${rows.length > 6 ? `<button class="btn sm ghost full mt" data-act="pg-all">${PG.allEx
        ? "Méně" : `Všech ${rows.length} cviků`}</button>` : ""}
    </div>`, { sub: `posledních ${PG_STRENGTH_DAYS} dní · první vs poslední trénink` });
}

function openExerciseProgress(id) {
  const { metric, points } = exerciseSeries(id);
  if (!points.length) return;
  const first = points[0], last = points[points.length - 1];
  const best = points.reduce((a, b) => b.value > a.value ? b : a);
  const ch = first.value ? Math.round((last.value / first.value - 1) * 100) : 0;
  const out = v => metric === "e1rm" ? Math.round(kgOut(v) * 10) / 10 : v;
  const u = metric === "e1rm" ? weightUnit() : "opak.";
  const en = exNameEn(id);
  const rows = points.slice().reverse().slice(0, 12).map(p => `
    <div class="set-row">
      <span class="grow small" style="color:var(--text2)">${fmtDate(p.date)}</span>
      <span class="set-val">${metric === "e1rm"
        ? `${fmtNum(p.set.reps)}<span>×</span>${fmtWeight(p.set.weight)}` : `${fmtNum(p.set.reps)} opak.`}</span>
      <span class="small" style="min-width:76px;text-align:right">${metric === "e1rm" ? fmtWeight(p.value) : ""}</span>
    </div>`).join("");
  openModal(`${modalTitle(exName(id))}
    ${en ? `<p class="modal-sub">${esc(en)}</p>` : ""}
    <div class="card">
      <div class="stats">
        ${statHtml(`${fmtNum(out(last.value), 1)}<small>${u}</small>`, "teď")}
        ${statHtml(`${fmtNum(out(best.value), 1)}<small>${u}</small>`, "nejlépe")}
        ${statHtml(`${fmtSigned(ch)}<small>%</small>`, "od začátku")}
      </div>
    </div>
    ${points.length >= 2
      ? lineChart(points.map(p => ({ date: p.date, value: out(p.value) })), { unit: " " + u, dec: metric === "e1rm" ? 1 : 0 })
      : `<div class="empty-note">Zatím jen jeden trénink</div>`}
    <div class="chart-cap">${metric === "e1rm" ? "e1RM — odhad maxima na 1 opakování z nejlepší série tréninku"
      : "Nejvíc opakování v tréninku"}</div>
    <div class="h3" style="margin-top:22px">Nejlepší série v trénincích</div>
    <div class="sets" style="margin-top:4px">${rows}</div>
    ${currentPR(id) ? `<button class="btn ghost full mt2" data-act="w-pr-history" data-exid="${id}">${ic("trophy", 17)} Historie rekordů</button>` : ""}`);
}

/* ---- Týdny ---- */
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
      sets: ws.reduce((k, s) => k + s.entries.reduce((m, e) => m + (e.sets || []).length, 0), 0),
      volume: ws.reduce((v, s) => v + sessionVolume(s), 0)
    });
  }
  return out;
}

function weeklyHtml() {
  const weeks = weekBuckets(PG_WEEKS).filter(w => !w.before);
  const done = weeks.slice(0, -1);           // poslední týden ještě běží
  const vol = PG.metric === "volume";
  const val = w => vol ? Math.round(kgOut(w.volume)) : w.sets;
  const avg = done.length ? done.reduce((a, w) => a + val(w), 0) / done.length : null;
  const big = vol && Math.max(...weeks.map(val)) >= 10000;
  const fmt = v => big ? fmtNum(v / 1000, v >= 100000 ? 0 : 1) : fmtNum(v);
  const unit = vol ? (big ? (weightUnit() === "lb" ? " k lb" : " t") : " " + weightUnit()) : " sérií";
  const data = weeks.map(w => {
    const d = parseDate(w.from);
    const n = w.sessions.length;
    return {
      label: `${d.getDate()}.${d.getMonth() + 1}.`,
      value: val(w),
      tip: `týden od ${d.getDate()}. ${d.getMonth() + 1}. · ${n} ${plural(n, "trénink", "tréninky", "tréninků")}`
    };
  });
  return sec("Týden po týdnu", `
    <div class="card">
      ${segHtml([["sets", "Série"], ["volume", "Objem"]], PG.metric, "pg-metric", "m", "sm")}
      <div class="mt2">${columnChart(data, { unit, fmt })}</div>
      <div class="chart-cap">${avg != null ? `Ø ${fmt(avg)}${unit} za uzavřený týden · ` : ""}světlý sloupec je tento týden</div>
    </div>`, { sub: `posledních ${PG_WEEKS} týdnů` });
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

  return sec("Pravidelnost", `
    <div class="card">
      <div class="hm">
        <div class="hm-months">${months.join("")}</div>
        <div class="hm-body">
          <div class="hm-dow"><span>Po</span><span></span><span>St</span><span></span><span>Pá</span><span></span><span>Ne</span></div>
          <div class="hm-grid">${cells}</div>
        </div>
      </div>
      <div class="hm-legend">
        <span>méně</span><i class="hm-c"></i><i class="hm-c l1"></i><i class="hm-c l2"></i><i class="hm-c l3"></i><span>více sérií</span>
        <span class="hm-sep"></span><i class="hm-c"><b></b></i><span>kardio</span>
      </div>
      <hr class="hair">
      <div class="stats">
        ${statHtml(wCount, plural(wCount, "silový trénink", "silové tréninky", "silových tréninků"))}
        ${statHtml(fmtNum(wCount / weeksActive, 1), "Ø za týden")}
        ${statHtml(`${gap}<small>${plural(gap, "den", "dny", "dní")}</small>`, "nejdelší pauza")}
      </div>
    </div>`, { sub: `${PG_HEAT_WEEKS} týdnů` });
}

/* ---- Partie ----
   Po týdnech (small multiples): každá partie má vlastní řádek se sloupečky
   za týden; měřítko je společné, takže nižší řádek = partie, na kterou se
   dostává méně. Core odškrtnutý bez sérií je tečka na základně.
   „Naposledy" je vždy z celé historie, zlatě přes 14 dní.
   Souhrn: série a objem za zvolený rozsah. */
function partLastTrained() {
  const last = {};
  for (const s of S.sessions) {
    if (s.type !== "weights") continue;
    const hit = new Set();
    if (s.core === true) hit.add("Core");
    for (const e of s.entries) if ((e.sets || []).length) { const c = exCategory(e.exerciseId); if (c) hit.add(c); }
    for (const c of hit) if (!last[c] || s.date > last[c]) last[c] = s.date;
  }
  return last;
}

function partsHtml() {
  const body = PG.parts === "sum" ? partsSummaryHtml() : partsWeeksHtml();
  return sec("Partie", `
    <div class="card">
      ${segHtml([["weeks", "Po týdnech"], ["sum", "Souhrn"]], PG.parts, "pg-parts", "v", "sm")}
      <div class="mt2">${body}</div>
    </div>`, { sub: "které partie dostávají málo" });
}

function partsWeeksHtml() {
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
  // měřítko aspoň do 22 sérií, ať je vidět pásmo 10–20 sérií týdně
  const max = Math.max(22, ...per.flatMap(p => CAT_ORDER.map(c => p.c[c])));
  const band = `<span class="cw-band" style="bottom:${(10 / max * 100).toFixed(1)}%;height:${(10 / max * 100).toFixed(1)}%"></span>`;
  const done = per.slice(0, -1);
  const last = partLastTrained();
  const rows = CAT_ORDER.map(cat => {
    const avg = done.length ? done.reduce((a, p) => a + p.c[cat], 0) / done.length : per[0].c[cat];
    const bars = per.map((p, i) => {
      const v = p.c[cat];
      if (!v && cat === "Core" && p.core) return `<i class="tick"></i>`;
      return v ? `<i style="height:${Math.max(10, v / max * 100).toFixed(0)}%;background:${catColor(cat)}"></i>` : `<i class="z"></i>`;
    }).join("");
    const tips = per.map((p, i) => {
      const d = parseDate(weeks[i].from);
      const v = p.c[cat];
      return [+((i + 0.5) / per.length).toFixed(4), 0, `${cat} · týden od ${d.getDate()}. ${d.getMonth() + 1}.`,
        !v && cat === "Core" && p.core ? "core ✓" : `${v} ${plural(v, "série", "série", "sérií")}`];
    });
    const lt = last[cat];
    const gap = lt ? daysBetween(lt, todayStr()) : null;
    return `
      <div class="cw-row">
        <span class="cw-name"><i class="p-dot" style="background:${catColor(cat)}"></i>${cat}</span>
        <div class="cw-bars chart-wrap"${tipAttr(tips)}>${band}${bars}</div>
        <span class="cw-avg${avg >= 10 ? " in" : avg < 1 ? " warn-text" : ""}">${fmtNum(avg, 1)}</span>
        <span class="cw-last${gap == null || gap > 14 ? " stale" : ""}">${lt ? relDay(lt) : "nikdy"}</span>
      </div>`;
  }).join("");
  return `<div class="cw-head"><span>partie</span><span>série po týdnech</span><span>Ø</span><span>naposledy</span></div>${rows}
    <div class="chart-cap"><i class="cw-band-key"></i> 10–20 sérií týdně na partii — běžné doporučení pro růst svalů. Ø v pásmu volt.</div>`;
}

/* Sloupec je počet sérií, ne kila — u core a cviků s vlastní vahou je objem
   nulový, takže by taková partie vypadala jako netrénovaná. */
function partsSummaryHtml() {
  const catStats = {};
  for (const c of CAT_ORDER) catStats[c] = { sets: 0, volume: 0 };
  const custom = SV.catRange === "custom";
  const from = custom ? SV.catFrom
    : { week: addDays(todayStr(), -6), month: addDays(todayStr(), -29), all: "" }[SV.catRange];
  const to = custom ? SV.catTo : todayStr();
  for (const s of S.sessions) {
    if (s.type !== "weights" || s.date < from || s.date > to) continue;
    for (const e of s.entries) {
      const cat = exCategory(e.exerciseId) || "Ostatní";
      if (!catStats[cat]) catStats[cat] = { sets: 0, volume: 0 };
      for (const set of e.sets || []) {
        catStats[cat].sets++;
        catStats[cat].volume += (set.reps || 0) * (set.weight || 0);
      }
    }
  }
  const rows = Object.entries(catStats).sort((a, b) => b[1].sets - a[1].sets || b[1].volume - a[1].volume);
  const maxSets = Math.max(...rows.map(([, v]) => v.sets), 1);
  const chips = [["week", "Týden"], ["month", "Měsíc"], ["all", "Vše"], ["custom", "Vlastní"]].map(([k, lbl]) =>
    `<button class="chip${SV.catRange === k ? " on" : ""}" data-act="s-cat-range" data-range="${k}">${lbl}</button>`).join("");
  return `
    <div class="chips">${chips}</div>
    ${custom ? dateRangeRow("cat", from, to) : ""}
    ${rows.map(([cat, v]) => `
      <div style="margin-top:12px">
        <div class="row between" style="margin-bottom:6px">
          <span class="cw-name" style="color:var(--${v.sets ? "text" : "text3"})"><i class="p-dot" style="background:${catColor(cat)}${v.sets ? "" : ";opacity:.4"}"></i>${esc(cat)}</span>
          <span class="small">${v.sets} ${setWordTop(v.sets)}${v.volume ? ` · ${fmtNum(kgOut(v.volume))} ${weightUnit()}` : ""}</span>
        </div>
        <div class="bar mini"><div style="width:${(v.sets / maxSets * 100).toFixed(1)}%;background:${catColor(cat)}"></div></div>
      </div>`).join("")}`;
}

/* ---- Rekordy: naposledy překonané (každý cvik jednou, nejnovější) ---- */
function recordsTeaserHtml() {
  const all = recordEventsInRange("0000-01-01", todayStr())
    .sort((a, b) => b.date.localeCompare(a.date) || b.j - a.j);
  const seen = new Set();
  const latest = all.filter(ev => !seen.has(ev.exerciseId) && seen.add(ev.exerciseId)).slice(0, 5);
  if (!latest.length) return "";
  const rows = latest.map(ev => `
    <div class="list-item" data-act="w-pr-history" data-exid="${ev.exerciseId}">
      <i class="p-stripe" style="background:${exColor(ev.exerciseId)}"></i>
      <div class="grow">
        <div class="name">${esc(exName(ev.exerciseId))}</div>
        <div class="li-sub">${relDay(ev.date)} · ${ev.types.map(t => REC_LABEL[t]).join(", ")}</div>
      </div>
      <div class="li-val" style="color:var(--yellow)">${setShort(ev.exerciseId, ev)}</div>
    </div>`).join("");
  return sec("Rekordy", `<div class="card rows">${rows}</div>`,
    { sub: "naposledy překonané", right: secLink("Vše", "menu", `data-page="records"`) });
}

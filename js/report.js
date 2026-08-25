/* ===== Report pro Clauda / trenéra =====
   Kompaktní čitelný přehled dat z appky, který se vejde do jedné zprávy
   v chatu. Záměrně neobsahuje sync URL ani API klíče. */
"use strict";

const REPORT_RANGES = [
  { id: "week", label: "Týden", days: 7 },
  { id: "month", label: "Měsíc", days: 30 },
  { id: "all", label: "Vše", days: null }
];

/* Rozsah reportu: id z REPORT_RANGES, nebo vlastní { from, to } (obojí včetně).
   Vrací { from, to, days, label }; days je null u celé historie. */
function resolveReportRange(rangeId = "month") {
  const today = todayStr();
  if (rangeId && typeof rangeId === "object") {
    let { from, to } = rangeId;
    if (from > to) [from, to] = [to, from];
    const days = daysBetween(from, to) + 1;
    return { from, to, days, label: from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)} (${days} dní)` };
  }
  const range = REPORT_RANGES.find(r => r.id === rangeId) || REPORT_RANGES[1];
  const from = range.days ? addDays(today, -(range.days - 1)) : "0000-01-01";
  return {
    from, to: today, days: range.days,
    label: range.days ? `posledních ${range.days} dní (${fmtDate(from)} – ${fmtDate(today)})` : "celá historie"
  };
}

/* rangeId je buď id z REPORT_RANGES, nebo vlastní rozsah { from, to } */
function buildCoachReport(rangeId = "month") {
  const today = todayStr();
  const { from, to, days, label: rangeLabel } = resolveReportRange(rangeId);
  const inRange = d => d >= from && d <= to;

  const L = [];
  const u = weightUnit();
  const w = kg => `${fmtNum(kgOut(kg), 1)} ${u}`;

  /* --- hlavička --- */
  L.push(`# Fitness Log — report`);
  L.push(`Vygenerováno: ${fmtDate(today)} · rozsah: ${rangeLabel}`);
  L.push("");

  /* --- cíl a nastavení --- */
  const g = S.goal;
  L.push(`## Cíl a nastavení`);
  L.push(`- Denní cíl: **${fmtNum(g.dailyCalories)} kcal** · bílkoviny ${fmtNum(g.proteinGrams)} g · sacharidy ${fmtNum(g.carbsGrams)} g · tuky ${fmtNum(g.fatGrams)} g`);
  L.push(`- Tréninkové šablony: ${S.templates.map(t => `${t.name} (${t.exercises.length} cviků)`).join(", ") || "žádné"}`);
  L.push("");

  /* --- souhrn období --- */
  const sess = S.sessions.filter(s => inRange(s.date));
  const weights = sess.filter(s => s.type === "weights");
  const cardio = sess.filter(s => s.type === "cardio");
  const volume = weights.reduce((v, s) => v + sessionVolume(s), 0);
  const rated = sess.filter(s => s.rating);
  const prCount = countPRsInRange(from, to);
  const foodDays = [...new Set(S.foodLog.filter(f => inRange(f.date)).map(f => f.date))];
  const kcals = foodDays.map(d => dayNutrition(d).calories);
  const avgKcal = kcals.length ? Math.round(kcals.reduce((a, b) => a + b, 0) / kcals.length) : null;
  const goalDays = foodDays.filter(d => calorieGoalMet(d)).length;
  const totalDays = days || (S.sessions.length
    ? daysBetween([...S.sessions].sort((a, b) => a.date.localeCompare(b.date))[0].date, to) + 1
    : 0);

  L.push(`## Souhrn období`);
  L.push(`- Silové tréninky: **${weights.length}** · kardio: **${cardio.length}**`);
  if (weights.length) L.push(`- Objem: **${fmtNum(kgOut(volume))} ${u}** (Ø ${fmtNum(kgOut(volume / weights.length))} ${u} na trénink)`);
  L.push(`- Nové osobní rekordy: **${prCount}**`);
  if (rated.length) {
    const avgR = rated.reduce((a, s) => a + s.rating, 0) / rated.length;
    L.push(`- Ø hodnocení tréninku: **${fmtNum(avgR, 1)}/10** (${rated.length} ${rated.length === 1 ? "hodnocení" : "hodnocení"})`);
  }
  L.push(`- Strava zapsána: **${foodDays.length} z ${totalDays} dní**` +
    (avgKcal != null ? ` · Ø ${fmtNum(avgKcal)} kcal ze zapsaných dní · v cíli ${goalDays}` : ""));
  const lw = lastBodyWeight();
  L.push(`- Váha: ${lw ? `**${w(lw.weightKg)}** (${fmtDate(lw.date)})` : "**bez záznamu**"}`);
  L.push("");

  /* --- frekvence a pauzy --- */
  const allDates = [...S.sessions].map(s => s.date).filter(d => d <= to).sort();
  if (allDates.length) {
    L.push(`## Frekvence`);
    const last = allDates[allDates.length - 1];
    const ago = daysBetween(last, to);
    L.push(`- Poslední trénink: ${fmtDate(last)}${ago > 0 ? ` (před ${ago} ${ago === 1 ? "dnem" : ago < 5 ? "dny" : "dny"})` : " (dnes)"}`);
    let maxGap = 0, gapFrom = "", gapTo = "";
    for (let i = 1; i < allDates.length; i++) {
      const gp = Math.round((parseDate(allDates[i]) - parseDate(allDates[i - 1])) / 86400000);
      if (gp > maxGap) { maxGap = gp; gapFrom = allDates[i - 1]; gapTo = allDates[i]; }
    }
    if (maxGap >= 5) L.push(`- Nejdelší pauza v historii: **${maxGap} dní** (${fmtDate(gapFrom)} → ${fmtDate(gapTo)})`);
    L.push("");
  }

  /* --- objem po týdnech (posledních 8) --- */
  const weeks = [];
  let mon = mondayOf(to);
  for (let i = 7; i >= 0; i--) {
    const start = addDays(mon, -7 * i), end = addDays(start, 6);
    const ws = S.sessions.filter(s => s.date >= start && s.date <= end && s.date <= to);
    const wv = ws.filter(s => s.type === "weights");
    if (!ws.length) continue;
    weeks.push({ start, weights: wv.length, cardio: ws.length - wv.length, vol: wv.reduce((v, s) => v + sessionVolume(s), 0) });
  }
  if (weeks.length) {
    L.push(`## Objem po týdnech`);
    L.push(`| Týden od | Silové | Kardio | Objem (${u}) |`);
    L.push(`|---|---|---|---|`);
    for (const wk of weeks) {
      const d = parseDate(wk.start);
      L.push(`| ${d.getDate()}. ${d.getMonth() + 1}. | ${wk.weights} | ${wk.cardio} | ${fmtNum(kgOut(wk.vol))} |`);
    }
    L.push("");
  }

  /* --- progrese cviků (z celé historie) --- */
  const hist = {};
  for (const s of [...S.sessions].filter(s => s.type === "weights" && s.date <= to).sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of s.entries) {
      const sets = e.sets || [];
      if (!sets.length) continue;
      const best = sets.reduce((a, b) => est1RM(b.weight, b.reps) > est1RM(a.weight, a.reps) ? b : a);
      (hist[e.exerciseId] = hist[e.exerciseId] || []).push({ date: s.date, reps: best.reps, weight: best.weight });
    }
  }
  const prog = Object.entries(hist)
    .filter(([, h]) => h.length >= 3)
    .map(([id, h]) => {
      const a = est1RM(h[0].weight, h[0].reps), b = est1RM(h[h.length - 1].weight, h[h.length - 1].reps);
      return { name: exName(id), n: h.length, first: h[0], last: h[h.length - 1], pct: a ? (b / a - 1) * 100 : 0 };
    })
    .sort((x, y) => y.pct - x.pct);
  if (prog.length) {
    L.push(`## Progrese cviků (celá historie, ≥3 tréninky)`);
    L.push(`| Cvik | Tréninků | První | Poslední | Změna e1RM |`);
    L.push(`|---|---|---|---|---|`);
    for (const p of prog) {
      L.push(`| ${p.name} | ${p.n} | ${p.first.reps}×${fmtNum(kgOut(p.first.weight), 1)} | ${p.last.reps}×${fmtNum(kgOut(p.last.weight), 1)} | ${p.pct >= 0 ? "+" : ""}${fmtNum(p.pct, 0)} % |`);
    }
    L.push("");
  }

  /* --- poslední tréninky s detailem --- */
  const detail = weights.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  if (detail.length) {
    L.push(`## Poslední silové tréninky`);
    for (const s of detail) {
      const sets = s.entries.reduce((n, e) => n + (e.sets || []).length, 0);
      L.push(`### ${fmtDate(s.date)} — ${sessionLabel(s)} · ${s.entries.length} cviků / ${sets} sérií / ${fmtNum(kgOut(sessionVolume(s)))} ${u}` +
        (s.rating ? ` · hodnocení ${s.rating}/10` : ""));
      if (s.note) L.push(`_${s.note}_`);
      for (const e of s.entries) {
        const line = (e.sets || []).map(st => `${st.reps}×${fmtNum(kgOut(st.weight), 1)}${st.note ? ` (${st.note})` : ""}`).join(", ");
        L.push(`- ${exName(e.exerciseId)}: ${line || "—"}`);
      }
      L.push("");
    }
  }

  /* --- kardio --- */
  if (cardio.length) {
    L.push(`## Kardio`);
    L.push(`| Datum | Sport | Čas | Vzdálenost | Tempo |`);
    L.push(`|---|---|---|---|---|`);
    for (const s of cardio.slice().sort((a, b) => b.date.localeCompare(a.date))) {
      const c = s.entries[0] || {};
      L.push(`| ${fmtDate(s.date)} | ${cardioLabel(c)} | ${fmtNum(c.duration)} min | ${c.distance ? fmtNum(c.distance, 2) + " km" : "—"} | ${c.pace ? fmtNum(c.pace, 2) + " min/km" : "—"} |`);
    }
    L.push("");
  }

  /* --- rekordy --- */
  const prs = allPRs().slice(0, 12);
  if (prs.length) {
    L.push(`## Osobní rekordy`);
    for (const { exerciseId, pr } of prs) {
      L.push(`- ${exName(exerciseId)}: **${w(pr.weight)} × ${pr.reps}** (e1RM ${w(pr.e1rm)}, ${fmtDate(pr.date)})`);
    }
    L.push("");
  }

  /* --- váha --- */
  const bl = S.bodyLog.filter(b => b.date <= to);
  if (bl.length) {
    L.push(`## Tělesná váha`);
    const recent = bl.slice(-10);
    L.push(recent.map(b => `${fmtDate(b.date)}: ${w(b.weightKg)}`).join(" · "));
    const ma = movingAvgAt(S.bodyLog, to);
    if (ma != null && bl.length >= 3) {
      const maBefore = movingAvgAt(S.bodyLog, addDays(to, -(days || 30)));
      L.push(`- 7denní průměr: **${w(ma)}**` +
        (maBefore != null ? ` · změna za období: ${kgOut(ma) - kgOut(maBefore) >= 0 ? "+" : ""}${fmtNum(kgOut(ma) - kgOut(maBefore), 1)} ${u}` : ""));
    }
    L.push("");
  }

  /* --- strava --- */
  if (foodDays.length) {
    L.push(`## Strava (zapsané dny)`);
    L.push(`| Datum | kcal | B | S | T | v cíli |`);
    L.push(`|---|---|---|---|---|---|`);
    for (const d of foodDays.sort().slice(-14)) {
      const n = dayNutrition(d);
      L.push(`| ${fmtDate(d)} | ${fmtNum(n.calories)} | ${fmtNum(n.protein)} | ${fmtNum(n.carbs)} | ${fmtNum(n.fat)} | ${calorieGoalMet(d) ? "ano" : "ne"} |`);
    }
    L.push("");
  }

  /* --- check-iny --- */
  const cis = checkinsSorted().filter(c => c.date <= to).slice(0, 3);
  if (cis.length) {
    L.push(`## Týdenní check-iny`);
    for (const c of cis) {
      const m = MEASURES.filter(x => c.measures && c.measures[x.key] != null)
        .map(x => `${x.label.toLowerCase()} ${fmtNum(c.measures[x.key], 1)}`).join(", ");
      const sc = SCALES.filter(x => c.scales && c.scales[x.key] != null)
        .map(x => `${x.label.toLowerCase()} ${c.scales[x.key]}/10`).join(", ");
      L.push(`- **${fmtDate(c.date)}**` +
        (c.weightKg != null ? ` · ${w(c.weightKg)}` : "") +
        (c.adherence != null ? ` · dodržování ${c.adherence} %` : "") +
        (m ? ` · obvody: ${m}` : "") +
        (sc ? ` · ${sc}` : "") +
        (c.note ? ` · „${c.note}"` : ""));
    }
    L.push("");
  }

  /* --- upozornění na chybějící data --- */
  const missing = [];
  if (!foodDays.length) missing.push("strava nebyla v tomto období zapsána");
  else if (days && foodDays.length < days * 0.5) missing.push(`strava zapsána jen ${foodDays.length} z ${days} dní`);
  if (!bl.length) missing.push("váha nebyla zapsána");
  else if (lw && daysBetween(lw.date, to) > 14) missing.push(`poslední vážení je staré ${daysBetween(lw.date, to)} dní`);
  if (!cis.length) missing.push("žádný týdenní check-in");
  L.push(`---`);
  L.push(missing.length
    ? `**Pozor na chybějící data:** ${missing.join("; ")}. Chybějící hodnoty znamenají „nezapsáno", ne nulu.`
    : `Data jsou kompletní.`);

  return L.join("\n");
}

/* Počet nových PR v období (napříč všemi cviky) */
function countPRsInRange(from, to) {
  const ids = new Set(S.sessions.filter(s => s.type === "weights").flatMap(s => s.entries.map(e => e.exerciseId)));
  let n = 0;
  for (const id of ids) n += prHistory(id).filter(h => h.date >= from && h.date <= to).length;
  return n;
}

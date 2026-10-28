/* ===== Animované ukázky cviků (v3.1) =====
   Vlastní piktogramy — postava z čar ve dvou polohách a plynulý přechod tam
   a zpět. Žádná cizí média: animace z opengymu (Gym visual) ani fotky
   z free-exercise-db se kvůli licencím použít nedají.

   Pohyb z boku (`side`, postava kouká doprava) se zadává úhly kloubů ve
   stupních: 0 = doprava, 90 = dolů, −90 = nahoru, 180 = doleva. Každý úhel je
   směr článku od kloubu blíž trupu (kyčel→koleno, rameno→loket…), trup je
   kyčel→krk. `anchor` určuje bod, který zůstává na místě (chodidlo na zemi,
   ruka na hrazdě, kyčel na lavici) — zbytek postavy se dopočítá. `*L` zkracuje
   článek, když míří do hloubky (např. paže u benche).
   Pohyb zepředu (`front`) se zadává body pravé strany vůči rameni/kyčli;
   levá se zrcadlí. */
"use strict";

const MV_LEN = { t: 42, neck: 10, head: 8.5, ua: 25, fa: 23, th: 32, sh: 32, ft: 11 };
const MV_FLOOR = 140;

/* ---- výbava, kterou pohyby kreslí (za postavou) ---- */
const MV_EQ = {
  plate: (p, at) => `<circle cx="${p[at][0]}" cy="${p[at][1]}" r="12" class="mv-eq"/>`,
  db: (p, at) => `<circle cx="${p[at][0]}" cy="${p[at][1]}" r="5" class="mv-eqf"/>`,
  pad: (p, at) => `<circle cx="${p[at][0]}" cy="${p[at][1]}" r="5" class="mv-eq"/>`,
  cable: (p, at, x, y) => `<line x1="${x}" y1="${y}" x2="${p[at][0]}" y2="${p[at][1]}" class="mv-cable"/><circle cx="${x}" cy="${y}" r="3.5" class="mv-eqf"/>`,
  line: (p, x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="mv-eq"/>`,
  bench: (p, x1, x2, y) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="mv-bench"/>
    <line x1="${x1 + 8}" y1="${y}" x2="${x1 + 8}" y2="${MV_FLOOR}" class="mv-eq"/><line x1="${x2 - 8}" y1="${y}" x2="${x2 - 8}" y2="${MV_FLOOR}" class="mv-eq"/>`,
  // osa s kotouči zepředu — vodorovná tyč skrz obě ruce
  bar: (p, extra = 22) => {
    const [l, r] = [p.handL, p.handR], y = (l[1] + r[1]) / 2;
    const x1 = l[0] - extra, x2 = r[0] + extra;
    return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="mv-eq"/>
      <line x1="${x1 + 3}" y1="${y - 9}" x2="${x1 + 3}" y2="${y + 9}" class="mv-plate"/><line x1="${x2 - 3}" y1="${y - 9}" x2="${x2 - 3}" y2="${y + 9}" class="mv-plate"/>`;
  },
  dbs: p => `<circle cx="${p.handL[0]}" cy="${p.handL[1]}" r="4.5" class="mv-eqf"/><circle cx="${p.handR[0]}" cy="${p.handR[1]}" r="4.5" class="mv-eqf"/>`
};

/* ---- knihovna pohybů: dvě polohy (a, b), výbava, délka cyklu ---- */
const STAND = { th: 90, sh: 90, ft: 0, t: -90 };
const MOVES = {
  squat: { label: "dřep", side: true,
    a: { anchor: "ankle", at: [104, 136], ...STAND, ua: 150, uaL: .7, fa: -30, faL: .7 },
    b: { anchor: "ankle", at: [104, 136], t: -48, th: 12, sh: 112, ft: 0, ua: 192, uaL: .7, fa: 12, faL: .7 },
    eq: p => MV_EQ.plate(p, "bar") },
  hinge: { label: "předklon s rovnými zády", side: true,
    a: { anchor: "ankle", at: [106, 136], ...STAND, ua: 92, fa: 90 },
    b: { anchor: "ankle", at: [106, 136], t: -14, th: 74, sh: 96, ft: 0, ua: 96, fa: 92 },
    eq: p => MV_EQ.plate(p, "hand"), db: p => MV_EQ.db(p, "hand") },
  legpress: { label: "leg press", side: true,
    a: { anchor: "hip", at: [66, 112], t: -142, th: -38, sh: -38, ft: -128, ua: 72, fa: 12 },
    b: { anchor: "hip", at: [66, 112], t: -142, th: -82, sh: -4, ft: -94, ua: 72, fa: 12 },
    eq: p => {
      const [x, y] = p.ankle, a = 52 * Math.PI / 180;
      const dx = Math.cos(a) * 17, dy = Math.sin(a) * 17;
      return `<line x1="${(x - dx).toFixed(1)}" y1="${(y - dy).toFixed(1)}" x2="${(x + dx).toFixed(1)}" y2="${(y + dy).toFixed(1)}" class="mv-bench"/>
        <line x1="44" y1="132" x2="12" y2="94" class="mv-bench"/><line x1="44" y1="132" x2="92" y2="132" class="mv-bench"/>`;
    } },
  lunge: { label: "výpad", side: true,
    a: { anchor: "ankle", at: [124, 136], t: -90, th: 70, sh: 100, ft: 0, th2: 112, sh2: 118, ft2: 0, ua: 92, fa: 90 },
    b: { anchor: "ankle", at: [124, 136], t: -90, th: 8, sh: 96, ft: 0, th2: 96, sh2: 176, ft2: 90, ua: 92, fa: 90 },
    eq: p => MV_EQ.db(p, "hand") },
  legcurl: { label: "zakopávání", side: true,
    a: { anchor: "hip", at: [104, 100], t: 180, th: 0, sh: 0, ft: 90, ua: 118, fa: 180 },
    b: { anchor: "hip", at: [104, 100], t: 180, th: 0, sh: -98, ft: -8, ua: 118, fa: 180 },
    eq: p => MV_EQ.bench(p, 40, 150, 107) + MV_EQ.pad(p, "ankle") },
  legext: { label: "předkopávání", side: true,
    a: { anchor: "hip", at: [84, 102], t: -100, th: 0, sh: 95, ft: 5, ua: 96, fa: 12 },
    b: { anchor: "hip", at: [84, 102], t: -100, th: 0, sh: 4, ft: -86, ua: 96, fa: 12 },
    eq: p => MV_EQ.line(p, 70, 110, 118, 110) + MV_EQ.line(p, 72, 110, 62, 58) + MV_EQ.pad(p, "ankle") },
  hipthrust: { label: "hip thrust", side: true,
    a: { anchor: "ankle", at: [150, 136], sh: 74, th: -44, t: 210, ft: 0, ua: 120, fa: 60 },
    b: { anchor: "ankle", at: [150, 136], sh: 92, th: 0, t: 182, ft: 0, ua: 120, fa: 60 },
    eq: p => MV_EQ.plate(p, "hip") + `<rect x="54" y="111" width="38" height="29" rx="4" class="mv-eq"/>` },
  calf: { label: "výpon", side: true,
    a: { anchor: "toe", at: [116, 136], ...STAND, ft: 0, ua: 92, fa: 90 },
    b: { anchor: "toe", at: [116, 136], ...STAND, ft: 48, ua: 92, fa: 90 },
    eq: p => MV_EQ.db(p, "hand") },
  bench: { label: "tlak vleže", side: true,
    a: { anchor: "hip", at: [116, 100], t: 180, th: 14, sh: 98, ft: 0, ua: -90, fa: -90 },
    b: { anchor: "hip", at: [116, 100], t: 180, th: 14, sh: 98, ft: 0, ua: 75, uaL: .55, fa: -85 },
    eq: p => MV_EQ.bench(p, 30, 128, 107) + MV_EQ.plate(p, "hand"), db: p => MV_EQ.bench(p, 30, 128, 107) + MV_EQ.db(p, "hand") },
  pushup: { label: "klik", side: true,
    a: { anchor: "hand", at: [62, 138], fa: 90, ua: 90, t: 203.4, th: 23.4, sh: 23.4, ft: 70 },
    b: { anchor: "hand", at: [62, 138], fa: 110, ua: -40, uaL: .9, t: 181.7, th: 1.7, sh: 1.7, ft: 70 } },
  dips: { label: "dipy", side: true,
    a: { anchor: "hand", at: [98, 72], fa: 96, ua: 96, t: -72, th: 104, sh: 168, ft: 70 },
    b: { anchor: "hand", at: [98, 72], fa: 60, ua: 160, uaL: .8, t: -60, th: 104, sh: 168, ft: 70 },
    eq: p => `<circle cx="98" cy="74" r="4" class="mv-eqf"/><line x1="98" y1="78" x2="98" y2="${MV_FLOOR}" class="mv-eq"/>` },
  frontraise: { label: "předpažování", side: true,
    a: { anchor: "ankle", at: [100, 136], ...STAND, ua: 86, fa: 86 },
    b: { anchor: "ankle", at: [100, 136], ...STAND, ua: -4, fa: -4 },
    eq: p => MV_EQ.db(p, "hand") },
  facepull: { label: "face pull", side: true,
    a: { anchor: "ankle", at: [86, 136], ...STAND, ua: -6, fa: -6 },
    b: { anchor: "ankle", at: [86, 136], ...STAND, ua: -6, uaL: .2, fa: -40, faL: .75 },
    eq: p => MV_EQ.cable(p, "hand", 192, 34) },
  row: { label: "přítah vsedě", side: true,
    a: { anchor: "hip", at: [70, 112], t: -84, th: -8, sh: 14, ft: -76, ua: 2, fa: 2 },
    b: { anchor: "hip", at: [70, 112], t: -94, th: -8, sh: 14, ft: -76, ua: 158, fa: -4 },
    eq: p => MV_EQ.cable(p, "hand", 192, 96) + MV_EQ.line(p, 48, 119, 96, 119) },
  bentrow: { label: "přítah v předklonu", side: true,
    a: { anchor: "ankle", at: [108, 136], t: -20, th: 76, sh: 96, ft: 0, ua: 90, fa: 90 },
    b: { anchor: "ankle", at: [108, 136], t: -20, th: 76, sh: 96, ft: 0, ua: 186, uaL: .9, fa: 88 },
    eq: p => MV_EQ.plate(p, "hand"), db: p => MV_EQ.db(p, "hand") },
  pullover: { label: "pullover", side: true,
    a: { anchor: "hip", at: [124, 100], t: 180, th: 14, sh: 98, ft: 0, ua: 166, fa: 166 },
    b: { anchor: "hip", at: [124, 100], t: 180, th: 14, sh: 98, ft: 0, ua: -86, fa: -86 },
    eq: p => MV_EQ.bench(p, 46, 134, 107) + MV_EQ.db(p, "hand") },
  curl: { label: "bicepsový zdvih", side: true,
    a: { anchor: "ankle", at: [100, 136], ...STAND, ua: 86, fa: 86 },
    b: { anchor: "ankle", at: [100, 136], ...STAND, ua: 82, fa: -62 },
    eq: p => MV_EQ.db(p, "hand") },
  preacher: { label: "zdvih na skotovce", side: true,
    a: { anchor: "hip", at: [78, 104], t: -76, th: 0, sh: 92, ft: 0, ua: 42, fa: 22 },
    b: { anchor: "hip", at: [78, 104], t: -76, th: 0, sh: 92, ft: 0, ua: 42, fa: -96 },
    eq: p => MV_EQ.db(p, "hand") + MV_EQ.line(p, 98, 74, 124, 98) },
  pushdown: { label: "stahování na triceps", side: true,
    a: { anchor: "ankle", at: [96, 136], ...STAND, t: -86, ua: 94, fa: -40 },
    b: { anchor: "ankle", at: [96, 136], ...STAND, t: -86, ua: 94, fa: 84 },
    eq: p => MV_EQ.cable(p, "hand", 128, 8) },
  kickback: { label: "kickback", side: true,
    a: { anchor: "ankle", at: [112, 136], t: -24, th: 76, sh: 96, ft: 0, ua: 176, fa: 92 },
    b: { anchor: "ankle", at: [112, 136], t: -24, th: 76, sh: 96, ft: 0, ua: 176, fa: 172 },
    eq: p => MV_EQ.db(p, "hand") },
  ohtri: { label: "tlak nad hlavu na triceps", side: true,
    a: { anchor: "ankle", at: [100, 136], ...STAND, t: -86, ua: -104, fa: 132 },
    b: { anchor: "ankle", at: [100, 136], ...STAND, t: -86, ua: -104, fa: -98 },
    eq: p => MV_EQ.db(p, "hand") },
  skull: { label: "francouzský tlak vleže", side: true,
    a: { anchor: "hip", at: [118, 100], t: 180, th: 14, sh: 98, ft: 0, ua: -104, fa: 170 },
    b: { anchor: "hip", at: [118, 100], t: 180, th: 14, sh: 98, ft: 0, ua: -104, fa: -100 },
    eq: p => MV_EQ.bench(p, 32, 130, 107) + MV_EQ.plate(p, "hand"), db: p => MV_EQ.bench(p, 32, 130, 107) + MV_EQ.db(p, "hand") },
  crunch: { label: "zkracovačka", side: true,
    a: { anchor: "hip", at: [114, 133], t: 182, th: -56, sh: 60, ft: 0, ua: -62, uaL: .6, fa: 40, faL: .6 },
    b: { anchor: "hip", at: [114, 133], t: 214, th: -56, sh: 60, ft: 0, ua: -30, uaL: .6, fa: 72, faL: .6 } },
  legraise: { label: "zvedání nohou", side: true,
    a: { anchor: "hip", at: [100, 133], t: 180, th: 2, sh: 2, ft: -88, ua: 4, fa: 4 },
    b: { anchor: "hip", at: [100, 133], t: 180, th: -84, sh: -84, ft: 6, ua: 4, fa: 4 } },
  hanging: { label: "zvedání nohou ve visu", side: true, scale: .82, noFloor: true,
    a: { anchor: "hand", at: [100, 8], fa: -90, ua: -90, t: -90, th: 90, sh: 90, ft: 0 },
    b: { anchor: "hand", at: [100, 8], fa: -90, ua: -90, t: -96, th: 0, sh: 0, ft: -90 },
    eq: () => `<line x1="70" y1="8" x2="130" y2="8" class="mv-bench"/>` },
  plank: { label: "plank", side: true, period: 3600,
    a: { anchor: "hand", at: [40, 136], fa: 180, ua: 90, t: 190, th: 8.5, sh: 8.5, ft: 80 },
    b: { anchor: "hand", at: [40, 136], fa: 180, ua: 90, t: 188.5, th: 7, sh: 7, ft: 80 } },
  abwheel: { label: "ab wheel", side: true,
    a: { anchor: "ankle", at: [156, 136], sh: 0, th: 68, t: -132, ft: 0, ua: 74, fa: 74 },
    b: { anchor: "ankle", at: [156, 136], sh: 0, th: 22, t: 184, ft: 0, ua: 172, fa: 172 },
    eq: p => `<circle cx="${p.hand[0]}" cy="${(p.hand[1]).toFixed(1)}" r="7" class="mv-eq"/>` },
  // ---- zepředu ----
  ohp: { label: "tlak nad hlavu", front: true,
    a: { hip: [100, 90], elbow: [9, 18], hand: [11, -2] },
    b: { hip: [100, 90], elbow: [8, -21], hand: [7, -45] },
    eq: p => MV_EQ.bar(p, 18), db: p => MV_EQ.dbs(p) },
  lateral: { label: "upažování", front: true,
    a: { hip: [100, 90], elbow: [5, 24], hand: [8, 46] },
    b: { hip: [100, 90], elbow: [24, 3], hand: [46, 5] },
    eq: p => MV_EQ.dbs(p) },
  fly: { label: "rozpažky", front: true,
    a: { hip: [100, 90], elbow: [25, 4], hand: [46, 0] },
    b: { hip: [100, 90], elbow: [9, 7], hand: [-12, 4] },
    eq: p => MV_EQ.dbs(p) },
  reversefly: { label: "rozpažování vzad", front: true,
    a: { hip: [100, 90], elbow: [9, 7], hand: [-12, 4] },
    b: { hip: [100, 90], elbow: [25, 4], hand: [46, 0] },
    eq: p => MV_EQ.dbs(p) },
  pulldown: { label: "stahování", front: true, seated: true,
    a: { hip: [100, 104], elbow: [11, -24], hand: [19, -46] },
    b: { hip: [100, 104], elbow: [22, 16], hand: [26, -6] },
    eq: p => MV_EQ.bar(p, 12) + `<line x1="100" y1="2" x2="100" y2="${((p.handL[1] + p.handR[1]) / 2).toFixed(1)}" class="mv-cable"/>` },
  pullup: { label: "shyb", front: true, hang: true,
    a: { hands: [100, 12], elbow: [11, -24], hand: [19, -46] },
    b: { hands: [100, 12], elbow: [22, 16], hand: [26, -6] },
    eq: p => `<line x1="40" y1="12" x2="160" y2="12" class="mv-bench"/>` },
  shrug: { label: "shrug", front: true, period: 2000,
    a: { hip: [100, 90], elbow: [3, 24], hand: [5, 47], lift: 0 },
    b: { hip: [100, 90], elbow: [3, 24], hand: [5, 47], lift: 7 },
    eq: p => MV_EQ.bar(p, 18), db: p => MV_EQ.dbs(p) },
  uprow: { label: "přítah k bradě", front: true,
    a: { hip: [100, 90], elbow: [4, 24], hand: [2, 46] },
    b: { hip: [100, 90], elbow: [24, -2], hand: [5, 6] },
    eq: p => MV_EQ.bar(p, 12), db: p => MV_EQ.dbs(p) },
  abduct: { label: "abdukce kyčle", front: true, seated: true,
    a: { hip: [100, 104], elbow: [6, 22], hand: [10, 40], knee: [9, 10], foot: [10, 34] },
    b: { hip: [100, 104], elbow: [6, 22], hand: [10, 40], knee: [26, 8], foot: [32, 32] } },
  adduct: { label: "addukce kyčle", front: true, seated: true,
    a: { hip: [100, 104], elbow: [6, 22], hand: [10, 40], knee: [26, 8], foot: [32, 32] },
    b: { hip: [100, 104], elbow: [6, 22], hand: [10, 40], knee: [9, 10], foot: [10, 34] } }
};

/* ---- přiřazení cviku k pohybu: podle názvu (česky i anglicky), jinak podle partie ---- */
const MOVE_RULES = [
  [/hanging|captain|ve visu/, "hanging"],
  [/ab wheel|rollout/, "abwheel"],
  [/plank|hollow|prkno/, "plank"],
  [/leg raise|zvedani nohou/, "legraise"],
  [/crunch|zkracovack|twist|rotace|v-up|bicycle|kolo$|brouk|dead bug|medicinbal|woodchop|drevorub|pallof/, "crunch"],
  [/abdukc|abduction/, "abduct"], [/addukc|adduction/, "adduct"],
  [/calf|vypon/, "calf"],
  [/leg press|legpress/, "legpress"],
  [/hip thrust|glute bridge|kickback.*glute|glute kickback|zanozov/, "hipthrust"],
  [/leg curl|zakopav|nordic/, "legcurl"],
  [/leg extension|predkopav/, "legext"],
  [/lunge|vypad|split squat|bulhar|step-up|vystup/, "lunge"],
  [/deadlift|mrtv|good morning|back extension|hyperext/, "hinge"],
  [/squat|drep|pendulum/, "squat"],
  [/pullover/, "pullover"],
  [/face pull/, "facepull"],
  [/reverse fly|reverse pec|rear delt|zadni delt|rozpazovani v predklonu|rear delt pec/, "reversefly"],
  [/upright row|k brade/, "uprow"],
  [/shrug/, "shrug"],
  [/pull-?up|chin-?up|shyb/, "pullup"],
  [/pulldown|stahovani horni/, "pulldown"],
  [/bent-over row|v predklonu|t-bar|one-arm dumbbell row/, "bentrow"],
  [/row|pritah/, "row"],
  [/skull|francouzsk.*(vleze|lavic)|incline ez/, "skull"],
  [/overhead.*triceps|triceps extension|nad hlavou|tlaky nad hlavu na kladce/, "ohtri"],
  [/kickback/, "kickback"],
  [/pushdown|stahovani kladky|triceps press|lyzar/, "pushdown"],
  [/dip|bradl|kliky na lavici/, "dips"],
  [/push-?up|klik/, "pushup"],
  [/lateral|upazov|3 cesty|three-way/, "lateral"],
  [/fly|rozpaz|pec deck|crossover|krizeni/, "fly"],
  [/front raise|predpazov/, "frontraise"],
  [/overhead press|shoulder press|arnold|landmine|tlaky? nad hlavu|tlaky na ramena|military/, "ohp"],
  [/preacher|skotovk|spider|concentration|koncentrovan/, "preacher"],
  [/curl|zdvih|biceps|hammer|kladiv/, "curl"],
  [/bench|press|tlak/, "bench"]
];
const MOVE_BY_CAT = { Ramena: "ohp", "Hrudník": "bench", "Záda": "row", Biceps: "curl", Triceps: "pushdown", Core: "crunch", Nohy: "squat" };

function moveKeyFor(exerciseId) {
  const e = getExercise(exerciseId);
  if (!e) return null;
  const txt = norm(`${e.name} ${e.nameEn || ""}`);
  for (const [re, key] of MOVE_RULES) if (re.test(txt)) return key;
  return MOVE_BY_CAT[e.category] || null;
}

/* ---- výpočet polohy ---- */
const MV_RAD = Math.PI / 180;
function mvVec(a, l) { return [Math.cos(a * MV_RAD) * l, Math.sin(a * MV_RAD) * l]; }
function mvAdd(p, v, s = 1) { return [p[0] + v[0] * s, p[1] + v[1] * s]; }

function sidePose(q) {
  const L = k => MV_LEN[k] * (q[k + "L"] || 1);
  const T = mvVec(q.t, L("t")), UA = mvVec(q.ua, L("ua")), FA = mvVec(q.fa, L("fa"));
  const TH = mvVec(q.th, L("th")), SH = mvVec(q.sh, L("sh")), FT = mvVec(q.ft, MV_LEN.ft);
  let hip;
  if (q.anchor === "hip") hip = q.at;
  else if (q.anchor === "ankle") hip = mvAdd(mvAdd(q.at, SH, -1), TH, -1);
  else if (q.anchor === "toe") hip = mvAdd(mvAdd(mvAdd(q.at, FT, -1), SH, -1), TH, -1);
  else if (q.anchor === "hand") hip = mvAdd(mvAdd(mvAdd(q.at, FA, -1), UA, -1), T, -1);
  const neck = mvAdd(hip, T), head = mvAdd(neck, mvVec(q.t, MV_LEN.neck));
  const elbow = mvAdd(neck, UA), hand = mvAdd(elbow, FA);
  const knee = mvAdd(hip, TH), ankle = mvAdd(knee, SH), toe = mvAdd(ankle, FT);
  // místo osy na horní části zad (dřep) — kousek pod krkem a za zády
  const bar = mvAdd(mvAdd(neck, mvVec(q.t, -5)), mvVec(q.t - 90, 8));
  const p = { hip, neck, head, elbow, hand, knee, ankle, toe, bar };
  if (q.th2 != null) {
    p.knee2 = mvAdd(hip, mvVec(q.th2, L("th")));
    p.ankle2 = mvAdd(p.knee2, mvVec(q.sh2, L("sh")));
    p.toe2 = mvAdd(p.ankle2, mvVec(q.ft2 || 0, MV_LEN.ft));
  }
  return p;
}

function frontPose(q, m) {
  const sw = 14, hw = 8;                      // půl šířky ramen a pánve
  let hip = q.hip;
  if (m.hang) hip = [q.hands[0], q.hands[1] - q.hand[1] + MV_LEN.t];  // ruce drží hrazdu
  const lift = q.lift || 0;
  const shY = hip[1] - MV_LEN.t - lift;
  const shR = [hip[0] + sw, shY], shL = [hip[0] - sw, shY];
  const mir = (o, v) => [o[0] - v[0], o[1] + v[1]];
  const knee = q.knee || (m.seated ? [hw + 2, 12] : m.hang ? [hw + 3, 30] : [hw, 32]);
  const foot = q.foot || (m.seated ? [hw + 4, 42] : m.hang ? [hw + 1, 52] : [hw + 2, 64]);
  const hipR = [hip[0] + hw, hip[1]], hipL = [hip[0] - hw, hip[1]];
  return {
    hip, neck: [hip[0], shY], head: [hip[0], shY - MV_LEN.neck - lift * .2],
    shR, shL,
    elbowR: mvAdd(shR, q.elbow), handR: mvAdd(shR, q.hand),
    elbowL: mir(shL, q.elbow), handL: mir(shL, q.hand),
    hipR, hipL,
    kneeR: mvAdd(hipR, [knee[0] - hw, knee[1]]), footR: mvAdd(hipR, [foot[0] - hw, foot[1]]),
    kneeL: mir(hipL, [knee[0] - hw, knee[1]]), footL: mir(hipL, [foot[0] - hw, foot[1]])
  };
}

const MV_ANG = new Set(["t", "ua", "fa", "th", "sh", "ft", "th2", "sh2", "ft2"]);
function mvLerp(a, b, k) {
  const out = {};
  for (const key of Object.keys(a)) {
    const x = a[key], y = b[key];
    if (Array.isArray(x)) out[key] = [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k];
    // úhly kratší cestou (166° → −86° jde přes 180°, ne přes 0°)
    else if (MV_ANG.has(key) && typeof y === "number") out[key] = x + ((((y - x) % 360) + 540) % 360 - 180) * k;
    else if (typeof x === "number" && typeof y === "number") out[key] = x + (y - x) * k;
    else out[key] = x;
  }
  for (const key of Object.keys(b)) if (!(key in out)) out[key] = b[key];
  return out;
}

const mvPath = pts => "M" + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L");

/* SVG obsah pohybu v čase k (0 = poloha a, 1 = poloha b) */
function drawMove(m, k, db = false) {
  const q = mvLerp(m.a, m.b, k);
  const eq = db && m.db ? m.db : m.eq;   // jednoručky místo osy, když to cvik říká názvem
  if (m.front) {
    const p = frontPose(q, m);
    const body = [
      `<path d="${mvPath([p.handL, p.elbowL, p.shL, p.shR, p.elbowR, p.handR])}" class="mv-limb"/>`,
      `<path d="${mvPath([p.neck, p.hip])}" class="mv-limb"/>`,
      `<path d="${mvPath([p.footL, p.kneeL, p.hipL, p.hipR, p.kneeR, p.footR])}" class="mv-limb"/>`,
      `<circle cx="${p.head[0].toFixed(1)}" cy="${p.head[1].toFixed(1)}" r="${MV_LEN.head}" class="mv-head"/>`
    ].join("");
    const floorY = Math.max(p.footL[1], p.footR[1]) + 3;
    const inner = (m.hang ? "" : `<line x1="20" y1="${floorY.toFixed(1)}" x2="180" y2="${floorY.toFixed(1)}" class="mv-floor"/>`) +
      (m.seated && !m.hang ? `<line x1="76" y1="${q.hip[1] + 7}" x2="124" y2="${q.hip[1] + 7}" class="mv-eq"/>` : "") +
      (eq ? eq(p) : "") + body;
    return `<g transform="translate(100 74) scale(.86) translate(-100 -74)">${inner}</g>`;
  }
  const p = sidePose(q);
  const far = p.knee2 ? `<path d="${mvPath([p.hip, p.knee2, p.ankle2, p.toe2])}" class="mv-far"/>` : "";
  const body = [
    far,
    `<path d="${mvPath([p.hip, p.knee, p.ankle, p.toe])}" class="mv-limb"/>`,
    `<path d="${mvPath([p.hip, p.neck])}" class="mv-limb"/>`,
    `<path d="${mvPath([p.neck, p.elbow, p.hand])}" class="mv-limb"/>`,
    `<circle cx="${p.head[0].toFixed(1)}" cy="${p.head[1].toFixed(1)}" r="${MV_LEN.head}" class="mv-head"/>`
  ].join("");
  const inner = `${m.noFloor ? "" : `<line x1="8" y1="${MV_FLOOR}" x2="192" y2="${MV_FLOOR}" class="mv-floor"/>`}${eq ? eq(p) : ""}${body}`;
  return m.scale ? `<g transform="translate(100 75) scale(${m.scale}) translate(-100 -75)">${inner}</g>` : inner;
}

/* Prvek s ukázkou — kreslí ho Moves.frame() (jen když je vidět) */
function moveUsesDumbbells(exerciseId) {
  const e = getExercise(exerciseId);
  return !!e && /jednoruc|dumbbell|\bdb\b|kettlebell|ktb/.test(norm(`${e.name} ${e.nameEn || ""}`));
}
function moveHtml(exerciseId, cls = "") {
  const key = moveKeyFor(exerciseId);
  if (!key) return "";
  const m = MOVES[key];
  const db = !!m.db && moveUsesDumbbells(exerciseId);
  return `<svg class="move${cls ? " " + cls : ""}" viewBox="0 0 200 150" data-move="${key}"${db ? ` data-eq="db"` : ""} role="img" aria-label="Ukázka pohybu: ${esc(m.label)}"><g>${drawMove(m, 0, db)}</g></svg>`;
}

/* Animace: jedna smyčka pro všechny viditelné ukázky, ~30 snímků/s.
   Při „omezit pohyb" se ukáže jen koncová poloha. */
const Moves = {
  raf: 0, last: 0,
  sync() {
    if (!this.raf && document.querySelector("svg[data-move]")) this.raf = requestAnimationFrame(t => this.frame(t));
  },
  frame(ts) {
    this.raf = 0;
    const els = document.querySelectorAll("svg[data-move]");
    if (!els.length) return;
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || ts - this.last > 32) {
      this.last = ts;
      els.forEach(el => {
        if (!el.getClientRects().length) return;
        const m = MOVES[el.dataset.move];
        if (!m) return;
        const per = m.period || 2800;
        // tam a zpět s krátkým zastavením v obou krajních polohách
        const ph = (ts % per) / per;
        const k = reduce ? 1 : Math.min(1, Math.max(0, .5 - .62 * Math.cos(ph * 2 * Math.PI)));
        el.firstElementChild.innerHTML = drawMove(m, k, el.dataset.eq === "db");
      });
    }
    if (!reduce) this.raf = requestAnimationFrame(t => this.frame(t));
  }
};

/* ===== Animace cviků (v5.0) =====
   Vlastní kreslená figurka — žádné cizí fotky ani videa, nic se nestahuje.
   Každý cvik má dvě krajní polohy (A → B), mezi kterými se figurka plynule
   pohybuje; klouby se dopočítávají (úhly nebo dosah ruky / nohy na pevný bod),
   takže končetiny drží délku a ruce zůstanou na hrazdě, chodidla na zemi.
   Zatěžovaná část těla nese barvu partie.

   figSvg(key, {anim})  — SVG jedné animace (anim: false = stojící snímek)
   exFigKey(exId)       — animace cviku: podle id, pak názvu, pak partie
   exThumb(exId, opts)  — dlaždice s figurkou (opts.anim = pohyb)
   exAnim(exId)         — velká ukázka do detailu cviku

   Úhly: 0 = dolů, 90 = dopředu (doprava), 180 = nahoru, −90 = dozadu.
   Poloha: h = kyčel [x, y], t = trup, a / af = bližší / vzdálenější paže,
   l / lf = nohy. Končetina je buď [úhel, úhel(, chodidlo)], nebo dosah
   {to: [x, y] | ["T" | "h" | "hd", dx, dy], b: ±1 strana ohybu, f: chodidlo}.
   Pohled "f" = zepředu (vzdálenější strana se zrcadlí). */
"use strict";

const FIG = { torso: 25, ua: 13, fa: 12.5, th: 19, sh: 18.5, ft: 6.5, neck: 9.5, shW: 8.5, hipW: 4.5 };
const FIG_STEPS = 9;          // mezisnímků mezi polohami
const FIG_DUR = 2.6;          // s na cyklus tam a zpět

const _st = (x = 50) => ({ to: [x, 91] });
const _bench = [["rect", 22, 66, 50, 5, 2], ["ln", 28, 71, 28, 94, 3], ["ln", 66, 71, 66, 94, 3]];
const _seat = [["ln", 32, 77, 48, 77, 5]];
const _lie = { h: [62, 62], t: 270, l: { to: [80, 91] } };

/* k: [A, B] — B dědí z A; hl: T trup, U nadloktí, F předloktí, Q stehna, C lýtka, S ramena */
const FIGS = {
  /* --- nohy --- */
  squat: { hl: "Q", eq: [["disc", "sh", -2.5, -2, 7]],
    k: [{ h: [50, 53.5], t: 180, a: { to: ["T", 1, -2] }, l: _st(52) }, { h: [41, 73], t: 150 }] },
  fsquat: { hl: "Q", eq: [["disc", "sh", 5, 1, 7]],
    k: [{ h: [50, 53.5], t: 180, a: [78, 208], l: _st(52) }, { h: [42, 73], t: 162 }] },
  goblet: { hl: "Q", eq: [["db", "haN", 90]],
    k: [{ h: [50, 53.5], t: 180, a: { to: ["T", 5, 8] }, l: _st(52) }, { h: [42, 73], t: 160 }] },
  bwsquat: { hl: "Q",
    k: [{ h: [50, 53.5], t: 180, a: [80, 86], l: _st(52) }, { h: [41, 73], t: 152 }] },
  sumo: { v: "f", hl: "Q", eq: [["db", "haN", 0]],
    k: [{ h: [50, 55], t: 180, a: [-19, -19], l: { to: [68, 91] } }, { h: [50, 70] }] },
  sumodl: { v: "f", hl: "QT", eq: [["bar", "haF", "haN", 15, 8]],
    k: [{ h: [50, 55], t: 180, a: [-6, -6], l: { to: [68, 91] } }, { h: [50, 68], a: [-4, -4], s: -3 }] },
  hack: { hl: "Q", bg: [["ln", 58, 95, 72, 86, 4]], eq: [["seg", "h", -5, 0, -13.5, -23.5, 5]],
    k: [{ h: [46, 56], t: 200, a: { to: ["T", 0, 3] }, l: { to: [62, 87], f: 60 } }, { h: [52.2, 72.9] }] },
  legpress: { hl: "Q", bg: [["ln", 28, 84, 10, 64, 5], ["ln", 28, 85, 38, 85, 5]], eq: [["seg", "anN", 9.2, 3.6, -3.6, -9.2, 4]],
    k: [{ h: [30, 80], t: 228, a: [20, 70], l: { to: [55, 55], f: 225 } }, { l: { to: [43, 67], f: 225 } }] },
  calfpress: { hl: "C", bg: [["ln", 28, 84, 10, 64, 5], ["ln", 28, 85, 38, 85, 5]], eq: [["seg", "toN", 3, 5, -6, -6, 4]],
    k: [{ h: [30, 80], t: 228, a: [20, 70], l: { to: [54, 56], f: 245 } }, { l: { to: [55.5, 54.5], f: 195 } }] },
  legext: { hl: "Q", bg: [["ln", 36, 62, 58, 62, 5], ["ln", 36, 62, 31, 34, 5], ["ln", 46, 64, 46, 94, 3]], eq: [["disc", "anN", 3.5, -1, 3]],
    k: [{ h: [40, 57], t: 192, a: [10, 60], l: [86, 5, 85] }, { l: [86, 82, 165] }] },
  legcurls: { hl: "Q", bg: [["ln", 36, 62, 58, 62, 5], ["ln", 36, 62, 31, 34, 5], ["ln", 46, 64, 46, 94, 3]], eq: [["disc", "anN", -3.5, 1, 3]],
    k: [{ h: [40, 57], t: 192, a: [10, 60], l: [86, 72, 160] }, { l: [86, -18, 70] }] },
  legcurll: { hl: "Q", bg: _bench, eq: [["disc", "anN", 0, -4, 3]],
    k: [{ h: [55, 62], t: 268, a: [-20, -62], l: [92, 88, 20] }, { l: [92, 188, 105] }] },
  legcurlst: { hl: "Q", bg: [["ln", 70, 94, 70, 36, 3]], eq: [["disc", "anN", -3.5, 0, 3]],
    k: [{ h: [50, 53.5], t: 172, a: [62, 84], l: [4, 0, 90], lf: _st(50) }, { l: [4, -98, -8] }] },
  lunge: { hl: "Q", eq: [["db", "haN", 0]],
    k: [{ h: [50, 57], t: 180, a: [0, 0], l: { to: [64, 91] }, lf: { to: [34, 90], f: 70 } }, { h: [50, 71] }] },
  bss: { hl: "Q", bg: [["rect", 12, 76, 22, 5, 2], ["ln", 16, 81, 16, 94, 3], ["ln", 30, 81, 30, 94, 3]], eq: [["db", "haN", 0]],
    k: [{ h: [48, 56], t: 176, a: [0, 0], l: { to: [60, 91] }, lf: { to: [27, 72], f: -90 } }, { h: [47, 70], t: 168 }] },
  stepup: { hl: "Q", bg: [["rect", 52, 75, 28, 19, 2]], eq: [["db", "haN", 0]],
    k: [{ h: [45, 54], t: 176, a: [0, 0], l: { to: [60, 72] }, lf: _st(44) }, { h: [59, 35], t: 180, lf: { to: [55, 72] } }] },
  rdl: { hl: "QT", eq: [["disc", "haN", 0, 0, 7]],
    k: [{ h: [50, 53.5], t: 180, a: [0, 0], l: _st(50) }, { h: [44, 56], t: 105, hd: 135 }] },
  rdldb: { hl: "QT", eq: [["db", "haN", 0]],
    k: [{ h: [50, 53.5], t: 180, a: [0, 0], l: _st(50) }, { h: [44, 56], t: 105, hd: 135 }] },
  deadlift: { hl: "QT", eq: [["disc", "haN", 0, 0, 9]],
    k: [{ h: [39, 72], t: 120, hd: 150, a: [0, 0], l: _st(52) }, { h: [50, 53.5], t: 180, hd: 180 }] },
  goodmorning: { hl: "QT", eq: [["disc", "sh", -2.5, -2, 7]],
    k: [{ h: [50, 53.5], t: 180, a: { to: ["T", 1, -2] }, l: _st(50) }, { h: [44, 56], t: 108, hd: 135 }] },
  hyper: { hl: "T", bg: [["ln", 41, 61, 53, 69, 6], ["ln", 47, 66, 47, 94, 3], ["ln", 22, 94, 34, 84, 3]],
    k: [{ h: [50, 60], t: 78, a: { to: ["T", 7, 5] }, l: [-35, -35, 60] }, { t: 145 }] },
  hipthrust: { hl: "Q", bg: [["rect", 10, 68, 21, 26, 2]], eq: [["disc", "h", 1, -5, 7]],
    k: [{ h: [48, 84], t: 224, hd: 224, a: { to: ["h", 3, -7] }, l: { to: [68, 91] } }, { h: [55.5, 67], t: 268, hd: 250 }] },
  calf: { hl: "C", bg: [["rect", 42, 94, 20, 3, 1]], eq: [["db", "haN", 0]],
    k: [{ h: [50, 53.5], t: 180, a: [0, 0], l: { to: [50, 91], f: 90 } }, { h: [50, 49.5], l: { to: [50, 87], f: 50 } }] },
  calfseat: { hl: "C", bg: _seat, eq: [["seg", "knN", -6, -4.5, 5, -4.5, 4]],
    k: [{ h: [40, 72], t: 180, a: [40, 82], l: { to: [60, 91], f: 90 } }, { l: { to: [60, 87.5], f: 52 } }] },
  abd: { v: "f", hl: "Q", bg: [["ln", 38, 67, 62, 67, 5]],
    k: [{ h: [50, 62], t: 180, a: [12, -4], l: { to: [57, 90] } }, { l: { to: [71, 88] } }] },
  gkick: { hl: "Q", bg: [["ln", 82, 94, 82, 30, 3]], eq: [["cab", 82, 91, "anN"]],
    k: [{ h: [46, 54], t: 152, a: [72, 84], l: [12, 6, 90], lf: _st(48) }, { l: [-48, -52, 30] }] },
  nordic: { hl: "Q", bg: [["ln", 23, 86, 36, 86, 4]],
    k: [{ h: [50, 71], t: 180, a: { to: ["T", 8, 6] }, l: [0, -87, -90] }, { h: [65.6, 79.1], t: 125, l: [-55, -87, -90] }] },
  sissy: { hl: "Q", bg: [["ln", 74, 94, 74, 40, 3]],
    k: [{ h: [50, 53.5], t: 180, a: [62, 96], l: { to: [50, 91], f: 90 } }, { h: [52, 61.5], t: 218, l: { to: [50, 88], f: 50 } }] },

  /* --- hrudník --- */
  bench: { hl: "T", bg: _bench, eq: [["disc", "haN", 0, 0, 8]],
    k: [Object.assign({ a: { to: [38, 37] } }, _lie), { a: { to: [40, 55] } }] },
  benchdb: { hl: "T", bg: _bench, eq: [["db", "haN", 0]],
    k: [Object.assign({ a: { to: [38, 37] } }, _lie), { a: { to: [41, 56] } }] },
  incbench: { hl: "T", bg: [["ln", 60, 78, 38, 52, 5], ["ln", 60, 78, 71, 78, 5], ["ln", 54, 80, 54, 94, 3]], eq: [["disc", "haN", 0, 0, 8]],
    k: [{ h: [58, 74], t: 220, a: { to: [43, 30] }, l: { to: [77, 91] } }, { a: { to: [46, 49] } }] },
  incdb: { hl: "T", bg: [["ln", 60, 78, 38, 52, 5], ["ln", 60, 78, 71, 78, 5], ["ln", 54, 80, 54, 94, 3]], eq: [["db", "haN", 0]],
    k: [{ h: [58, 74], t: 220, a: { to: [43, 30] }, l: { to: [77, 91] } }, { a: { to: [47, 50] } }] },
  fly: { v: "f", hl: "T", eq: [["db", "haN", 90], ["db", "haF", 90]],
    k: [{ h: [50, 55], t: 180, a: [92, 96], l: { to: [57, 91] } }, { a: [62, -58] }] },
  pecdeck: { v: "f", hl: "T", bg: [["ln", 38, 60, 62, 60, 5], ["ln", 50, 60, 50, 22, 9]], eq: [["seg", "elN", 3, -9, 3, 9, 4], ["seg", "elF", -3, -9, -3, 9, 4]],
    k: [{ h: [50, 55], t: 180, a: [96, 180], l: { to: [59, 90] } }, { a: [42, 196] }] },
  crosshi: { v: "f", hl: "T", bg: [["ln", 8, 96, 8, 6, 3], ["ln", 92, 96, 92, 6, 3]], eq: [["cab", 92, 10, "haN"], ["cab", 8, 10, "haF"]],
    k: [{ h: [50, 55], t: 180, a: [108, 122], l: { to: [57, 91] } }, { a: [28, -32] }] },
  crosslo: { v: "f", hl: "T", bg: [["ln", 8, 96, 8, 6, 3], ["ln", 92, 96, 92, 6, 3]], eq: [["cab", 92, 90, "haN"], ["cab", 8, 90, "haF"]],
    k: [{ h: [50, 55], t: 180, a: [38, 44], l: { to: [57, 91] } }, { a: [112, 196] }] },
  pushup: { hl: "TU",
    k: [{ h: [40.8, 74.7], t: 112, hd: 100, l: [-68, -68, 20], a: { to: [64, 91] } }, { h: [37.1, 85.6], t: 96, hd: 92, l: [-84, -84, 20] }] },
  pushupdec: { hl: "TU", bg: [["rect", -6, 74, 20, 20, 2]],
    k: [{ h: [39, 66.6], t: 92, hd: 95, l: [-88, -88, 20], a: { to: [64, 91] } }, { h: [37.8, 76.6], t: 75, hd: 85, l: [-105, -105, 10] }] },
  pullover: { hl: "T", bg: _bench, eq: [["db", "haN", 0]],
    k: [Object.assign({ a: [-100, -80] }, _lie), { a: [-178, -176] }] },
  dips: { hl: "U", bg: [["ln", 38, 56, 62, 56, 3], ["ln", 41, 56, 41, 94, 2.5], ["ln", 59, 56, 59, 94, 2.5]],
    k: [{ h: [45.7, 55.1], t: 170, a: { to: [50, 56] }, l: [10, -60, -20] }, { h: [44.5, 69.5], t: 160 }] },
  benchdip: { hl: "U", bg: [["rect", 16, 66, 20, 28, 2]],
    k: [{ h: [38.2, 65.9], t: 185, a: { to: [33, 66] }, l: { to: [67, 90], f: 150 } }, { h: [38.9, 81], t: 182 }] },
  mpress: { hl: "T", bg: [["ln", 33, 76, 33, 40, 5], ["ln", 33, 77, 48, 77, 5]], eq: [["seg", "haN", 0, -6, 0, 6, 3]],
    k: [{ h: [40, 72], t: 185, a: { to: [50, 53] }, l: _st(58) }, { a: { to: [62.5, 50] } }] },

  /* --- záda --- */
  pullup: { v: "f", hl: "T", bg: [["ln", 22, 10, 78, 10, 3]],
    k: [{ h: [50, 60.5], t: 180, a: { to: [63, 10], b: -1 }, l: [3, 3, 30] }, { h: [50, 43] }] },
  pullupw: { v: "f", hl: "T", bg: [["ln", 18, 10, 82, 10, 3]],
    k: [{ h: [50, 59], t: 180, a: { to: [70, 10], b: -1 }, l: [3, 3, 30] }, { h: [50, 43] }] },
  latpull: { hl: "T", bg: [["ln", 34, 77, 50, 77, 5], ["ln", 49, 63, 60, 63, 4]], eq: [["cab", 50, -4, "haN"], ["seg", "haN", -4, 0, 4, 0, 3]],
    k: [{ h: [42, 72], t: 180, a: { to: [50, 22] }, l: _st(58) }, { t: 195, a: { to: [47, 46] } }] },
  cablerow: { hl: "T", bg: [["ln", 26, 81, 48, 81, 5], ["ln", 75, 74, 75, 92, 4], ["ln", 94, 94, 94, 50, 3]], eq: [["cab", 94, 62, "haN"]],
    k: [{ h: [38, 76], t: 165, a: { to: [68, 58] }, l: { to: [71, 84], f: 150 } }, { t: 186, a: { to: [44, 62] } }] },
  bbrow: { hl: "T", eq: [["disc", "haN", 0, 0, 8]],
    k: [{ h: [42, 58], t: 112, hd: 135, a: { to: [65, 74] }, l: _st(50) }, { a: { to: [57, 61] } }] },
  dbrow: { hl: "T", bg: [["rect", 62, 71, 30, 5, 2], ["ln", 68, 76, 68, 94, 3], ["ln", 86, 76, 86, 94, 3]], eq: [["db", "haN", 0]],
    k: [{ h: [42, 58], t: 108, hd: 130, a: { to: [62, 76] }, af: { to: [74, 69] }, l: _st(50) }, { a: { to: [54, 60] } }] },
  mrow: { hl: "T", bg: [["ln", 32, 79, 48, 79, 5], ["ln", 51, 44, 51, 68, 5], ["ln", 51, 68, 51, 94, 3]], eq: [["seg", "haN", 0, -5, 0, 5, 3]],
    k: [{ h: [38, 74], t: 172, a: { to: [66, 52] }, l: _st(60) }, { a: { to: [47, 57] } }] },
  invrow: { hl: "T", bg: [["ln", 32, 48, 32, 94, 2.5]], eq: [["disc", "haN", 0, 0, 2.4]],
    k: [{ h: [54, 80.2], t: 253, l: [73, 73, 170], a: { to: [32, 48] } }, { h: [57.1, 73.7], t: 242, l: [62, 62, 160] }] },
  sapull: { hl: "T", bg: [["ln", 90, 94, 90, 2, 3]], eq: [["cab", 90, 4, "haN"]],
    k: [{ h: [44, 54], t: 165, a: [128, 126], l: _st(46) }, { a: [16, 12] }] },
  facepull: { hl: "S", bg: [["ln", 92, 94, 92, 10, 3]], eq: [["cab", 92, 26, "haN"]],
    k: [{ h: [46, 53.5], t: 180, a: [95, 96], l: _st(46) }, { t: 186, a: [-68, 150] }] },
  shrug: { v: "f", hl: "ST", eq: [["db", "haN", 90], ["db", "haF", 90]],
    k: [{ h: [50, 53.5], t: 180, a: [3, 3], l: { to: [56, 91] } }, { s: 4 }] },
  shrugbar: { v: "f", hl: "ST", eq: [["bar", "haF", "haN", 13, 7]],
    k: [{ h: [50, 53.5], t: 180, a: [3, 3], l: { to: [56, 91] } }, { s: 4 }] },

  /* --- ramena --- */
  ohp: { v: "f", hl: "S", eq: [["bar", "haF", "haN", 11, 7]],
    k: [{ h: [50, 55], t: 180, a: [76, 180], l: { to: [56, 91] } }, { a: [166, 178] }] },
  ohpdb: { v: "f", hl: "S", eq: [["db", "haN", 0], ["db", "haF", 0]],
    k: [{ h: [50, 55], t: 180, a: [76, 180], l: { to: [56, 91] } }, { a: [166, 178] }] },
  landmine: { hl: "S", eq: [["cab", 97, 93, "haN", 3], ["disc", "haN", 3, 2, 5]],
    k: [{ h: [50, 53.5], t: 176, a: { to: [57, 31] }, af: [0, 20], l: _st(58), lf: _st(42) }, { t: 170, a: { to: [66, 9] } }] },
  latraise: { v: "f", hl: "S", eq: [["db", "haN", 90], ["db", "haF", 90]],
    k: [{ h: [50, 55], t: 180, a: [6, 8], l: { to: [56, 91] } }, { a: [88, 92] }] },
  frontraise: { hl: "S", eq: [["db", "haN", 0]],
    k: [{ h: [50, 53.5], t: 180, a: [0, 3], l: _st(50) }, { a: [94, 97] }] },
  rfly: { v: "f", hl: "S", eq: [["db", "haN", 90], ["db", "haF", 90]],
    k: [{ h: [50, 55], t: 180, a: [62, -58], l: { to: [57, 91] } }, { a: [94, 92] }] },
  uprow: { v: "f", hl: "S", eq: [["bar", "haF", "haN", 12, 7]],
    k: [{ h: [50, 55], t: 180, a: [-9, -9], l: { to: [56, 91] } }, { a: [114, -38] }] },

  /* --- biceps --- */
  curl: { hl: "U", eq: [["disc", "haN", 0, 0, 6]],
    k: [{ h: [50, 53.5], t: 180, a: [0, 6], l: _st(50) }, { a: [6, 166] }] },
  curldb: { hl: "U", eq: [["db", "haN", 0]],
    k: [{ h: [50, 53.5], t: 180, a: [0, 6], l: _st(50) }, { a: [6, 166] }] },
  curlcable: { hl: "U", bg: [["ln", 84, 94, 84, 60, 3]], eq: [["cab", 84, 90, "haN"]],
    k: [{ h: [46, 53.5], t: 180, a: [4, 14], l: _st(46) }, { a: [8, 164] }] },
  bayesian: { hl: "U", bg: [["ln", 14, 94, 14, 60, 3]], eq: [["cab", 14, 90, "haN"]],
    k: [{ h: [54, 53.5], t: 174, a: [-26, -16], l: _st(58), lf: _st(46) }, { a: [-12, 150] }] },
  preacher: { hl: "U", bg: [["ln", 32, 77, 48, 77, 5], ["ln", 48, 53, 60, 64, 6], ["ln", 58, 64, 58, 94, 3]], eq: [["disc", "haN", 0, 0, 5.5]],
    k: [{ h: [40, 72], t: 165, a: [48, 56], l: _st(52) }, { a: [48, 200] }] },
  inccurl: { hl: "U", bg: [["ln", 54, 78, 36, 52, 5], ["ln", 54, 78, 66, 78, 5], ["ln", 50, 80, 50, 94, 3]], eq: [["db", "haN", 0]],
    k: [{ h: [52, 74], t: 215, a: [-4, 2], l: { to: [72, 91] } }, { a: [0, 166] }] },
  conc: { hl: "U", bg: _seat, eq: [["db", "haN", 0]],
    k: [{ h: [38, 72], t: 142, hd: 150, a: [-4, 12], af: { to: [51, 73] }, l: _st(58) }, { a: [-2, 152] }] },
  wrist: { hl: "F", bg: _seat, eq: [["disc", "haN", 1, 0, 4.5]],
    k: [{ h: [38, 72], t: 150, hd: 160, a: [14, 100], l: _st(58) }, { a: [14, 76] }] },

  /* --- triceps --- */
  pushdown: { hl: "U", bg: [["ln", 78, 94, 78, 0, 3], ["ln", 78, 0, 64, 0, 3]], eq: [["cab", 64, 0, "haN"]],
    k: [{ h: [46, 53.5], t: 172, a: [-4, 126], l: _st(46) }, { a: [-4, 8] }] },
  ohext: { hl: "U", eq: [["db", "haN", 90]],
    k: [{ h: [50, 53.5], t: 180, a: [172, -52], l: _st(50) }, { a: [176, -182] }] },
  ohcable: { hl: "U", bg: [["ln", 10, 94, 10, 30, 3]], eq: [["cab", 10, 60, "haN"]],
    k: [{ h: [54, 53.5], t: 168, a: [166, -58], l: _st(60), lf: _st(46) }, { a: [160, -200] }] },
  skull: { hl: "U", bg: _bench, eq: [["disc", "haN", 0, 0, 6]],
    k: [Object.assign({ a: [186, -78] }, _lie), { a: [183, -178] }] },
  kick: { hl: "U", bg: [["rect", 62, 71, 30, 5, 2], ["ln", 68, 76, 68, 94, 3], ["ln", 86, 76, 86, 94, 3]], eq: [["db", "haN", 0]],
    k: [{ h: [42, 58], t: 108, hd: 128, a: [-78, 2], af: { to: [74, 69] }, l: _st(50) }, { a: [-78, -84] }] },

  /* --- core --- */
  plank: { hl: "T",
    k: [{ h: [37.4, 82.7], t: 100, hd: 96, l: [-80, -80, 20], a: [0, 90] }, { h: [37.4, 81.4], t: 101 }] },
  plankreach: { hl: "T",
    k: [{ h: [37.4, 82.7], t: 100, hd: 96, l: [-80, -80, 20], a: [0, 90], af: [0, 90] }, { a: [62, 96] }] },
  sideplank: { hl: "T",
    k: [{ h: [52, 82], t: 238, l: { to: [86, 90], f: 170 }, a: { to: [29, 91] }, af: [186, 184] }, { h: [51, 75.2], t: 247 }] },
  crunch: { hl: "T",
    k: [{ h: [58, 88], t: 268, l: { to: [80, 91] }, a: { to: ["hd", -1, -3] } }, { t: 236 }] },
  cablecrunch: { hl: "T", bg: [["ln", 78, 94, 78, 0, 3], ["ln", 78, 0, 62, 0, 3]], eq: [["cab", 62, 0, "haN"]],
    k: [{ h: [48, 71.5], t: 166, l: [12, -87, -90], a: { to: ["hd", 4, 3] } }, { t: 106 }] },
  legraiseh: { hl: "T", eq: [["disc", "haN", 0, 0, 2.4]], bg: [["ln", 64, 0, 64, 94, 2.5], ["ln", 50, 0, 64, 0, 2.5]],
    k: [{ h: [50, 50.5], t: 180, a: { to: [50, 0] }, l: [4, 4, 60] }, { t: 186, l: [88, 86, 170] }] },
  kneeraise: { hl: "T", eq: [["disc", "haN", 0, 0, 2.4]], bg: [["ln", 64, 0, 64, 94, 2.5], ["ln", 50, 0, 64, 0, 2.5]],
    k: [{ h: [50, 50.5], t: 180, a: { to: [50, 0] }, l: [4, 4, 60] }, { t: 186, l: [104, 8, 90] }] },
  legraisel: { hl: "T",
    k: [{ h: [50, 88], t: 270, a: [88, 90], l: [88, 88, 180] }, { l: [176, 178, 268] }] },
  deadbug: { hl: "T",
    k: [{ h: [50, 88], t: 270, a: [180, 180], af: [180, 180], l: [172, 92, 180], lf: [172, 92, 180] }, { a: [256, 262], lf: [100, 94, 184] }] },
  twist: { hl: "T", eq: [["disc", "haN", 0, 0, 4.5]],
    k: [{ h: [48, 86], t: 215, l: [106, 72, 160], a: [78, 96] }, { t: 219, a: [30, 58] }] },
  vup: { hl: "T",
    k: [{ h: [50, 88], t: 268, a: [262, 266], l: [90, 90, 180] }, { t: 226, a: [150, 148], l: [138, 138, 228] }] },
  hollow: { hl: "T",
    k: [{ h: [50, 88], t: 252, a: [246, 250], l: [108, 108, 198] }, { t: 248, a: [242, 246], l: [112, 112, 202] }] },
  bicycle: { hl: "T",
    k: [{ h: [50, 88], t: 246, a: { to: ["hd", -1, -3] }, l: [150, 62, 150], lf: [102, 100, 190] }, { l: [102, 100, 190], lf: [150, 62, 150] }] },
  abwheel: { hl: "T", eq: [["disc", "haN", 0, 1, 5]],
    k: [{ h: [38, 72], t: 120, hd: 120, a: { to: [62, 86] }, l: [6, -87, -90] }, { h: [54.5, 78.3], t: 98, hd: 110, a: { to: [101, 88] }, l: [-50, -87, -90] }] },
  woodchop: { v: "f", hl: "T", bg: [["ln", 94, 96, 94, 4, 3]], eq: [["cab", 94, 8, "haN"]],
    k: [{ h: [50, 55], t: 180, a: { to: [59, 9], b: -1 }, af: { to: [58, 10], b: 1 }, l: { to: [62, 91] } },
      { a: { to: [45, 51], b: 1 }, af: { to: [46, 52], b: 1 } }] },
  pallof: { hl: "T", eq: [["seg", "haN", 0, -4, 0, 4, 3]],
    k: [{ h: [50, 53.5], t: 180, a: { to: [57, 39] }, l: _st(56), lf: _st(44) }, { a: { to: [74, 38] } }] }
};

/* id cviku → animace */
const EX_FIG = {
  "ex-bench": "bench", "ex-incdb": "incdb", "ex-fly": "crosshi", "ex-pushup": "pushup", "ex-deadlift": "deadlift", "ex-row": "bbrow",
  "ex-latpull": "latpull", "ex-cablerow": "cablerow", "ex-pullup": "pullup", "ex-squat": "squat", "ex-legpress": "legpress",
  "ex-rdl": "rdl", "ex-lunge": "lunge", "ex-calf": "calf", "ex-ohp": "ohp", "ex-latraise": "latraise", "ex-facepull": "facepull",
  "ex-curl": "curl", "ex-hammer": "curldb", "ex-pushdown": "pushdown", "ex-skull": "skull", "ex-dips": "dips", "ex-plank": "plank",
  "ex-legraise": "legraiseh", "ex-crunch": "crunch",
  "cp-a1": "deadbug", "cp-a2": "bwsquat", "cp-a3": "legpress", "cp-a4": "legcurll", "cp-a5": "latpull", "cp-a6": "bench",
  "cp-a7": "rfly", "cp-a8": "curldb", "cp-a9": "dips", "cp-b1": "legraisel", "cp-b2": "legext", "cp-b3": "hack", "cp-b4": "hipthrust",
  "cp-b5": "pecdeck", "cp-b6": "cablerow", "cp-b7": "skull", "cp-b8": "latraise", "cp-b9": "preacher", "cp-c1": "twist",
  "cp-c2": "bss", "cp-c3": "rdl", "cp-c4": "ohpdb", "cp-c5": "mrow", "cp-c6": "mpress", "cp-c7": "sapull", "cp-c8": "curlcable",
  "cp-c9": "latraise",
  "xd-bench-incline": "incbench", "xd-bench-decline": "bench", "xd-db-press-flat": "benchdb", "xd-db-fly-incline": "fly",
  "xd-pushup-feet-up": "pushupdec", "xd-pushup-diamond": "pushup", "xd-pullover-db": "pullover", "xd-crossover-high": "crosshi",
  "xd-crossover-low": "crosslo", "xd-pecdeck": "pecdeck", "xd-pullup-under": "pullup", "xd-pullup-wide": "pullupw",
  "xd-db-row-one": "dbrow", "xd-tbar-row": "bbrow", "xd-latpull-under": "latpull", "xd-latpull-one": "latpull",
  "xd-machine-row": "mrow", "xd-cable-pullover": "sapull", "xd-inverted-row": "invrow", "xd-deadlift-db": "rdldb",
  "xd-hyperext": "hyper", "xd-good-morning": "goodmorning", "xd-shrug-bar": "shrugbar", "xd-shrug-db": "shrug",
  "xd-cable-row-one": "cablerow", "xd-front-squat": "fsquat", "xd-goblet-squat": "goblet", "xd-hack-squat": "hack",
  "xd-sumo-squat": "sumo", "xd-legpress-one": "legpress", "xd-leg-curl-seated": "legcurls", "xd-leg-curl-standing": "legcurlst",
  "xd-leg-ext-one": "legext", "xd-lunge-back": "lunge", "xd-lunge-walk": "lunge", "xd-step-up": "stepup", "xd-nordic-curl": "nordic",
  "xd-calf-seated": "calfseat", "xd-calf-legpress": "calfpress", "xd-hip-abduction": "abd", "xd-hip-adduction": "abd",
  "xd-deadlift-sumo": "sumodl", "xd-sissy-squat": "sissy", "xd-glute-kickback": "gkick", "xd-arnold-press": "ohpdb",
  "xd-ohp-machine": "ohpdb", "xd-ohp-seated-bar": "ohp", "xd-lat-raise-cable": "latraise", "xd-lat-raise-machine": "latraise",
  "xd-front-raise-db": "frontraise", "xd-front-raise-plate": "frontraise", "xd-rear-fly-db": "rfly", "xd-reverse-pecdeck": "rfly",
  "xd-upright-row": "uprow", "xd-rear-delt-cable": "facepull", "xd-landmine-press": "landmine", "xd-curl-ez": "curl",
  "xd-curl-cable": "curlcable", "xd-curl-concentration": "conc", "xd-curl-bayesian": "bayesian", "xd-curl-incline": "inccurl",
  "xd-curl-spider": "preacher", "xd-curl-reverse": "curl", "xd-wrist-curl": "wrist", "xd-preacher-machine": "preacher",
  "xd-curl-hammer-rope": "curlcable", "xd-pushdown-rope": "pushdown", "xd-pushdown-reverse": "pushdown",
  "xd-overhead-cable": "ohcable", "xd-overhead-db": "ohext", "xd-kickback-db": "kick", "xd-kickback-cable": "kick",
  "xd-close-grip-bench": "bench", "xd-bench-dips": "benchdip", "xd-triceps-machine": "pushdown", "xd-skullcrusher": "skull",
  "xd-side-plank": "sideplank", "xd-plank-reach": "plankreach", "xd-cable-crunch": "cablecrunch", "xd-crunch-machine": "crunch",
  "xd-russian-twist": "twist", "xd-pallof-press": "pallof", "xd-hollow-hold": "hollow", "xd-leg-raise-floor": "legraisel",
  "xd-captains-chair": "kneeraise", "xd-bicycle-crunch": "bicycle", "xd-ab-wheel": "abwheel", "xd-woodchopper": "woodchop",
  "xd-hanging-knee-raise": "kneeraise", "xd-v-up": "vup", "bk-calf-standing": "calf"
};
/* vlastní cviky: podle názvu (česky i anglicky, bez diakritiky); první shoda vyhrává */
const FIG_WORDS = [
  [/overhead (triceps )?ext|nad hlavou|francouzsk\w* tlak s jednoruc/, "ohext"], [/skull|francouzsk/, "skull"],
  [/kickback|zanozov/, "kick"], [/pushdown|stahovani.*(triceps|lan)|tricepsov\w* stahov/, "pushdown"],
  [/bench dip|kliky na lavic/, "benchdip"], [/\bdip|bradl/, "dips"],
  [/preacher|skotov|spider/, "preacher"], [/hammer|kladiv/, "curldb"], [/curl|biceps|zdvih/, "curldb"],
  [/lateral|upazov|rozpazk\w* s jednoruc.*stoj/, "latraise"], [/front raise|predpazov/, "frontraise"],
  [/face pull|rear delt|zadni delt|reverse/, "rfly"], [/upright|k brade/, "uprow"], [/shrug/, "shrug"],
  [/shoulder press|overhead press|nad hlavu|na ramena|arnold/, "ohpdb"],
  [/incline.*(press|bench)|sikm\w* lavic/, "incdb"], [/dumbbell bench|tlak\w* s jednoruc/, "benchdb"],
  [/bench|multipress.*hrud/, "bench"], [/chest press|tlak\w* na prsa/, "mpress"], [/pec deck|butterfly/, "pecdeck"],
  [/crossover|krizeni|fly|rozpazk/, "fly"], [/push-?up|klik/, "pushup"], [/pullover/, "pullover"],
  [/pull-?up|chin-?up|shyb/, "pullup"], [/pulldown|stahovani/, "latpull"], [/hyperext|back extension/, "hyper"],
  [/good morning/, "goodmorning"], [/seated row|cable row|pritah\w* (spodni|v sede)|pritahovani/, "cablerow"],
  [/row|pritah/, "bbrow"], [/deadlift|mrtv\w* tah/, "deadlift"], [/rdl|rumunsk/, "rdl"],
  [/hip thrust|glute bridge|most/, "hipthrust"], [/leg press/, "legpress"], [/leg ext|predkop/, "legext"],
  [/leg curl|zakop/, "legcurll"], [/bulgar/, "bss"], [/lunge|vypad/, "lunge"], [/step-?up|vystup/, "stepup"],
  [/calf|vypon|lytk/, "calf"], [/abduk|adduk|abduct|adduct/, "abd"], [/hack|pendulum|belt ?squat/, "hack"],
  [/goblet/, "goblet"], [/squat|drep/, "squat"], [/side plank|bocni plank/, "sideplank"], [/plank/, "plank"],
  [/dead bug|mrtvy brouk/, "deadbug"], [/leg raise|zvedani nohou|kolena k/, "legraisel"], [/ab wheel|kolecko/, "abwheel"],
  [/twist|rotac/, "twist"], [/crunch|zkracov|sed-?leh|sit-?up/, "crunch"]
];
const FIG_BY_CAT = { "Hrudník": "bench", "Záda": "bbrow", "Nohy": "squat", "Ramena": "ohpdb", "Biceps": "curldb", "Triceps": "pushdown", "Core": "crunch" };

function figNorm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}
const _figKeyCache = new Map();
function exFigKey(exId) {
  if (EX_FIG[exId]) return EX_FIG[exId];
  const e = getExercise(exId);
  if (!e) return "squat";
  const ck = exId + "|" + e.name + "|" + e.category;
  if (_figKeyCache.has(ck)) return _figKeyCache.get(ck);
  const n = figNorm(e.name + " " + (e.nameEn || ""));
  const hit = FIG_WORDS.find(([re]) => re.test(n));
  const key = hit ? hit[1] : (FIG_BY_CAT[e.category] || "squat");
  _figKeyCache.set(ck, key);
  return key;
}

/* ---- geometrie ---- */
const _rad = d => d * Math.PI / 180;
const _dir = (deg, len) => [Math.sin(_rad(deg)) * len, Math.cos(_rad(deg)) * len];
const _add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const _mix = (a, b, s) => a + (b - a) * s;

/* dvoukloubový dosah: kloub mezi S a T pro délky a, b; bend = strana ohybu */
function figReach(S0, T, a, b, bend) {
  let dx = T[0] - S0[0], dy = T[1] - S0[1];
  let d = Math.hypot(dx, dy);
  if (d < 1e-6) { dx = 0; dy = 1; d = 1e-6; }
  const ux = dx / d, uy = dy / d;
  const dc = Math.min(a + b - 0.01, Math.max(Math.abs(a - b) + 0.01, d));
  const ca = (a * a + dc * dc - b * b) / (2 * a * dc);
  const sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const mid = [S0[0] + ux * a * ca + uy * bend * a * sa, S0[1] + uy * a * ca - ux * bend * a * sa];
  return [mid, [S0[0] + ux * dc, S0[1] + uy * dc]];
}
function figLerpLimb(A, B, s) {
  if (Array.isArray(A) && Array.isArray(B)) return A.map((v, i) => _mix(v, B[i] == null ? v : B[i], s));
  if (!Array.isArray(A) && !Array.isArray(B)) {
    const ta = A.to, tb = B.to;
    const to = typeof ta[0] === "string" ? [ta[0], _mix(ta[1], tb[1], s), _mix(ta[2], tb[2], s)] : [_mix(ta[0], tb[0], s), _mix(ta[1], tb[1], s)];
    return { to, b: s < 0.5 ? A.b : B.b, f: A.f == null && B.f == null ? null : _mix(A.f == null ? 90 : A.f, B.f == null ? 90 : B.f, s) };
  }
  return s < 0.5 ? A : B;
}
function figLerp(A, B, s) {
  const o = { h: [_mix(A.h[0], B.h[0], s), _mix(A.h[1], B.h[1], s)], t: _mix(A.t, B.t, s),
    hd: _mix(A.hd == null ? A.t : A.hd, B.hd == null ? B.t : B.hd, s), s: _mix(A.s || 0, B.s || 0, s) };
  for (const k of ["a", "af", "l", "lf"]) if (A[k] && B[k]) o[k] = figLerpLimb(A[k], B[k], s);
  return o;
}
/* klouby jedné polohy */
function figJoints(p, front) {
  const J = { h: p.h };
  const td = _dir(p.t, 1);
  J.sh = _add(_add(p.h, _dir(p.t, FIG.torso)), [td[0] * (p.s || 0), td[1] * (p.s || 0)]);
  J.hd = _add(J.sh, _dir(p.hd, FIG.neck));
  const perp = [-td[1], td[0]];                    // dopředu od trupu (u pohledu zepředu do strany)
  const w = front ? FIG.shW : 0, hw = front ? FIG.hipW : 0;
  J.shN = [J.sh[0] + perp[0] * w, J.sh[1] + perp[1] * w];
  J.shF = [J.sh[0] - perp[0] * w, J.sh[1] - perp[1] * w];
  J.hpN = [p.h[0] + hw, p.h[1]];
  J.hpF = [p.h[0] - hw, p.h[1]];
  const target = (to, mir) => {
    if (typeof to[0] !== "string") return mir ? [2 * p.h[0] - to[0], to[1]] : to;
    const dx = mir ? -to[1] : to[1];
    if (to[0] === "h") return [p.h[0] + dx, p.h[1] + to[2]];
    if (to[0] === "hd") return [J.hd[0] + dx, J.hd[1] + to[2]];
    /* "T": u = po trupu od ramen ke kyčli, v = dopředu */
    return [J.sh[0] - td[0] * to[1] + perp[0] * to[2] * (mir ? -1 : 1), J.sh[1] - td[1] * to[1] + perp[1] * to[2] * (mir ? -1 : 1)];
  };
  const limb = (spec, root, l1, l2, defBend, mir) => {
    const m = mir ? -1 : 1;
    if (Array.isArray(spec)) {
      const mid = _add(root, _dir(spec[0] * m, l1));
      return [mid, _add(mid, _dir(spec[1] * m, l2)), spec[2] == null ? null : spec[2] * m];
    }
    const r = figReach(root, target(spec.to, mir), l1, l2, (spec.b == null ? defBend : spec.b) * m);
    return [r[0], r[1], spec.f == null ? null : spec.f * m];
  };
  const armBend = front ? 1 : -1;
  const aN = limb(p.a, J.shN, FIG.ua, FIG.fa, armBend, false);
  const aF = p.af ? limb(p.af, J.shF, FIG.ua, FIG.fa, armBend, false) : limb(p.a, J.shF, FIG.ua, FIG.fa, armBend, front);
  const lN = limb(p.l, J.hpN, FIG.th, FIG.sh, 1, false);
  const lF = p.lf ? limb(p.lf, J.hpF, FIG.th, FIG.sh, 1, false) : limb(p.l, J.hpF, FIG.th, FIG.sh, 1, front);
  J.elN = aN[0]; J.haN = aN[1]; J.elF = aF[0]; J.haF = aF[1];
  J.knN = lN[0]; J.anN = lN[1]; J.knF = lF[0]; J.anF = lF[1];
  const ftLen = front ? 4 : FIG.ft;
  J.toN = _add(J.anN, _dir(lN[2] == null ? 90 : lN[2], ftLen));
  J.toF = _add(J.anF, _dir(lF[2] == null ? (front ? -90 : 90) : lF[2], ftLen));
  return J;
}

const _r1 = v => (Math.round(v * 10) / 10).toString();
const _ln = (p, q) => `M${_r1(p[0])} ${_r1(p[1])}L${_r1(q[0])} ${_r1(q[1])}`;
const _dot = p => `M${_r1(p[0])} ${_r1(p[1])}l0 .01`;

/* Sestaví prvky animace: [{c: třída, w: tloušťka, d: [snímky]}] + výřez */
const _figCache = new Map();
function figBuild(key) {
  if (_figCache.has(key)) return _figCache.get(key);
  const def = FIGS[key] || FIGS.squat;
  const front = def.v === "f";
  const A = def.k[0], B = Object.assign({}, A, def.k[1]);
  const frames = [];
  for (let i = 0; i <= FIG_STEPS; i++) {
    const s = 0.5 - 0.5 * Math.cos(Math.PI * i / FIG_STEPS);
    frames.push(figJoints(figLerp(A, B, s), front));
  }
  const hl = def.hl || "";
  const els = [];
  const bb = [1e9, 1e9, -1e9, -1e9];
  const grow = (p, r) => { bb[0] = Math.min(bb[0], p[0] - r); bb[1] = Math.min(bb[1], p[1] - r); bb[2] = Math.max(bb[2], p[0] + r); bb[3] = Math.max(bb[3], p[1] + r); };
  const seg = (c, w, a, b) => els.push({ c, w, d: frames.map(J => { grow(J[a], w / 2); grow(J[b], w / 2); return _ln(J[a], J[b]); }) });
  const dot = (c, w, fn) => els.push({ c, w, d: frames.map(J => { const p = fn(J); grow(p, w / 2); return _dot(p); }) });
  const gear = list => {
    for (const g of list || []) {
      const t = g[0];
      if (t === "rect") { els.push({ c: "eq", rect: g.slice(1) }); grow([g[1], g[2]], 0); grow([g[1] + g[3], g[2] + g[4]], 0); }
      else if (t === "ln") { const w = g[5] || 3; els.push({ c: "eq", w, d: [_ln([g[1], g[2]], [g[3], g[4]])] }); grow([g[1], g[2]], w / 2); grow([g[3], g[4]], w / 2); }
      else if (t === "disc") dot("pl", g[4] * 2, J => [J[g[1]][0] + g[2], J[g[1]][1] + g[3]]);
      else if (t === "db") {
        const v = _dir(g[2] || 0, 4.2);   // 0 = vodorovně k divákovi (krátká svislá čárka by zanikla), kreslí se napříč
        els.push({ c: "pl", w: 5, d: frames.map(J => { const p = J[g[1]]; const a = [p[0] - v[1], p[1] - v[0]], b = [p[0] + v[1], p[1] + v[0]]; grow(a, 3); grow(b, 3); return _ln(a, b); }) });
      }
      else if (t === "cab") { const w = g[4] || 1.3; els.push({ c: w > 2 ? "eq" : "cb", w, d: frames.map(J => { grow([g[1], g[2]], 1); return _ln([g[1], g[2]], J[g[3]]); }) }); }
      else if (t === "seg") { const w = g[6] || 3; els.push({ c: "eq", w, d: frames.map(J => { const p = J[g[1]]; const a = [p[0] + g[2], p[1] + g[3]], b = [p[0] + g[4], p[1] + g[5]]; grow(a, w / 2); grow(b, w / 2); return _ln(a, b); }) }); }
      else if (t === "bar") {
        const ext = g[3], pr = g[4];
        els.push({ c: "eq", w: 2.2, d: frames.map(J => { const a = J[g[1]], b = J[g[2]]; return _ln([a[0] - ext, a[1]], [b[0] + ext, b[1]]); }) });
        for (const side of [1, 2]) els.push({ c: "pl", w: 4, d: frames.map(J => { const p = J[g[side]]; const x = p[0] + (side === 1 ? -ext : ext); grow([x, p[1]], pr + 1); return _ln([x, p[1] - pr], [x, p[1] + pr]); }) });
      }
    }
  };
  const cls = (base, letter) => hl.includes(letter) ? "hl" : base;
  gear(def.bg);
  if (front) {
    for (const s of ["F", "N"]) { seg(cls("fg", "Q"), 6.6, "hp" + s, "kn" + s); seg(cls("fg", "C"), 6, "kn" + s, "an" + s); seg("fg", 5, "an" + s, "to" + s); }
    els.push({ c: cls("fg", "T"), w: 13, d: frames.map(J => { grow(J.h, 6.5); grow(J.sh, 6.5); return _ln([J.h[0], J.h[1] - 1], [J.sh[0], J.sh[1] + 3]); }) });
    seg("fg", 6.4, "shF", "shN");
    dot("fg", 11, J => J.hd);
    for (const s of ["F", "N"]) { seg(cls("fg", "U"), 6, "sh" + s, "el" + s); seg(cls("fg", "F"), 5.4, "el" + s, "ha" + s); }
    if (hl.includes("S")) for (const s of ["F", "N"]) dot("hl", 8.4, J => J["sh" + s]);
  } else {
    seg("ff", 6.6, "hpF", "knF"); seg("ff", 6, "knF", "anF"); seg("ff", 5, "anF", "toF");
    seg("ff", 6, "shF", "elF"); seg("ff", 5.4, "elF", "haF");
    seg(cls("fg", "T"), 10, "h", "sh");
    dot("fg", 11, J => J.hd);
    seg(cls("fg", "Q"), 6.6, "hpN", "knN"); seg(cls("fg", "C"), 6, "knN", "anN"); seg("fg", 5, "anN", "toN");
    seg(cls("fg", "U"), 6, "shN", "elN"); seg(cls("fg", "F"), 5.4, "elN", "haN");
    if (hl.includes("S")) dot("hl", 8.4, J => J.shN);
  }
  gear(def.eq);
  /* čtvercový výřez kolem všeho, co se kdy pohne; zem je vždy vidět */
  grow([50, 96], 0);
  const size = Math.max(bb[2] - bb[0], bb[3] - bb[1], 90) + 6;
  const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
  const vb = [cx - size / 2, Math.min(cy - size / 2, Math.max(98, bb[3] + 1) - size), size, size].map(_r1).join(" ");
  const out = { els, vb, x0: cx - size / 2, x1: cx + size / 2 };
  _figCache.set(key, out);
  return out;
}

function figReduced() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
/* SVG animace. anim: false → stojící snímek (poloha v 60 % pohybu, čte se nejlíp) */
function figSvg(key, opts = {}) {
  const f = figBuild(key);
  const anim = opts.anim !== false && !figReduced();
  /* fáze podle hodin: po překreslení obrazovky figurka neskočí na začátek */
  const begin = anim ? `-${(((typeof performance !== "undefined" ? performance.now() : 0) / 1000) % FIG_DUR).toFixed(2)}s` : "";
  const still = opts.at != null ? opts.at : Math.round(FIG_STEPS * 0.62);
  let h = `<svg class="fig" viewBox="${f.vb}" aria-hidden="true" focusable="false"><path class="fl" d="M${_r1(f.x0 + 4)} 95.5H${_r1(f.x1 - 4)}"/>`;
  for (const e of f.els) {
    if (e.rect) { const r = e.rect; h += `<rect class="eq-b" x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" rx="${r[4] || 0}"/>`; continue; }
    const moving = e.d.length > 1 && e.d.some(d => d !== e.d[0]);
    const d0 = e.d.length > 1 ? e.d[anim ? 0 : still] : e.d[0];
    h += `<path class="${e.c}" stroke-width="${e.w}" d="${d0}"`;
    if (anim && moving) {
      const seq = [e.d[0], ...e.d, e.d[e.d.length - 1], ...e.d.slice(1, -1).reverse()];
      h += `><animate attributeName="d" dur="${FIG_DUR}s" begin="${begin}" repeatCount="indefinite" values="${seq.join(";")}"/></path>`;
    } else h += "/>";
  }
  return h + "</svg>";
}

/* Dlaždice cviku: figurka v barvě partie. opts.anim = pohyb (jinak stojí) */
function exThumb(exId, opts = {}) {
  return `<span class="ex-th${opts.cls ? " " + opts.cls : ""}" style="--c:${exColor(exId)}">${figSvg(exFigKey(exId), { anim: !!opts.anim })}</span>`;
}
/* Velká ukázka v detailu cviku */
function exAnim(exId) {
  return `<div class="ex-anim" style="--c:${exColor(exId)}" role="img" aria-label="Animace cviku ${esc(exName(exId))}">${figSvg(exFigKey(exId), { anim: true })}</div>`;
}

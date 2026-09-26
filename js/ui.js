/* ===== UI komponenty: modal, toast, kalendář, progress bary, SVG grafy ===== */
"use strict";

/* ---- Ikony (inline SVG, bez knihoven) ----
   Tahy 24×24 v barvě textu. ic("x") místo znaků ✕ ✎ ⇄ — znaky se na každém
   systému vykreslí jinak, ikony drží jeden styl. */
const ICONS = {
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  edit: '<path d="M12 20h8"/><path d="M16.4 3.6a2 2 0 0 1 2.9 2.9L7.5 18.3 3.5 19.5l1.2-4Z"/>',
  swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>',
  trash: '<path d="M4 6.5h16"/><path d="M9 6.5V4.5h6v2"/><path d="M18.5 6.5 17.6 19a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5.5 6.5"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 2"/><path d="M9.5 2.5h5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5Z" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
  food: '<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10"/><path d="M17.5 21V3c-2.2 1.4-3.5 4.3-3.5 8h3.5"/>',
  book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/><path d="M9 7.5h6"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V2.8h6V4"/><path d="m9 13 2 2 4-4"/>',
  share: '<path d="M12 3v12"/><path d="m7.5 7.5 4.5-4.5 4.5 4.5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.8h.01" stroke-width="2.6"/>',
  star: '<path d="m12 3.2 2.7 5.5 6 .9-4.4 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.4-4.2 6-.9Z"/>',
  starFill: '<path d="m12 3.2 2.7 5.5 6 .9-4.4 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.4-4.2 6-.9Z" fill="currentColor"/>',
  scale: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M8 9.5a5.5 5.5 0 0 1 8 0"/><path d="m12 10 1.3-2.2"/>',
  flame: '<path d="M12 21c-3.9 0-7-2.6-7-6.4 0-3 2-5.1 3.6-6.6.3 1.8 1.2 3 2.4 3.5.3-3 1.4-5.6 3.8-7.5.5 3.3 5.2 5.4 5.2 10.6 0 3.8-3.1 6.4-8 6.4Z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h.01" stroke-width="3"/>',
  trophy: '<path d="M8 4h8v5.5a4 4 0 0 1-8 0Z"/><path d="M16 5.5h3V7a3.5 3.5 0 0 1-3.4 3.5M8 5.5H5V7a3.5 3.5 0 0 0 3.4 3.5"/><path d="M12 13.5V17M8.5 21h7M9.5 17h5v4h-5Z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4.5"/><path d="M12 17.3h.01" stroke-width="2.6"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  body: '<circle cx="12" cy="4.8" r="2.3"/><path d="M5 9h14"/><path d="M12 9v6.5M12 15.5 8.8 21M12 15.5l3.2 5.5"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.3 1.6A3.8 3.8 0 0 1 17.5 18.5Z"/>'
};
function ic(name, size = 20, sw = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

/* Hlavička karty: ikona v dlaždici + titulek + volitelný obsah vpravo */
function cardHead(icon, title, right = "") {
  return `<div class="card-head"><span class="card-ic">${ic(icon, 18)}</span>
    <span class="h2 grow">${title}</span>${right}</div>`;
}

/* Normalizace pro hledání: bez diakritiky a velikosti písmen („drep" najde „Dřep") */
function norm(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/* m:ss, od hodiny h:mm:ss */
function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  const p = n => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

/* ---- Toast (volitelně s akčním tlačítkem, např. Vrátit) ---- */
let _toastTimer;
function toast(msg, kind = "", action = null) {
  const t = document.getElementById("toast");
  t.innerHTML = esc(msg) + (action
    ? ` <button class="toast-btn" data-act="${action.act}">${esc(action.label)}</button>` : "");
  t.className = "toast show" + (kind ? " " + kind : "");
  t.style.pointerEvents = action ? "auto" : "none";
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), action ? 6000 : 2600);
}

/* ---- Rest timer — pauza mezi sériemi ----
   Cíl v čase se drží v localStorage, takže přežije i zamčení mobilu.
   Celková délka pauzy (TOTAL_KEY) je jen pro průběh v kroužku. */
const Rest = {
  KEY: "fitapp_rest_until",
  TOTAL_KEY: "fitapp_rest_total",
  until() { return Number(localStorage.getItem(this.KEY) || 0); },
  left() { return Math.max(0, Math.ceil((this.until() - Date.now()) / 1000)); },
  running() { return this.until() > Date.now(); },
  total() {
    return Number(localStorage.getItem(this.TOTAL_KEY) || 0) || Settings.get().restSeconds || 120;
  },
  start(seconds) {
    if (!seconds || seconds <= 0) return;
    localStorage.setItem(this.KEY, String(Date.now() + seconds * 1000));
    localStorage.setItem(this.TOTAL_KEY, String(seconds));
    Dock.overUntil = 0;
    Dock.sync();
  },
  adjust(deltaSec) {
    const until = this.until();
    if (!until) return;
    localStorage.setItem(this.KEY, String(Math.max(Date.now(), until) + deltaSec * 1000));
    localStorage.setItem(this.TOTAL_KEY, String(Math.max(this.total() + deltaSec, this.left(), 1)));
    Dock.sync();
  },
  stop() {
    localStorage.removeItem(this.KEY);
    localStorage.removeItem(this.TOTAL_KEY);
    Dock.overUntil = 0;
    Dock.sync();
  },
  init() {
    if (!this.running()) { // doběhlá pauza z minula
      localStorage.removeItem(this.KEY);
      localStorage.removeItem(this.TOTAL_KEY);
    }
    Dock.sync();
  }
};

/* ---- Zamčený timer (dock nad navigací) ----
   Viditelný na každé obrazovce, i mimo Trénink. Režimy:
     rest    — běží pauza: odpočet, kroužek průběhu, −30 / +30 / zrušit
     over    — pauza doběhla: 5 s volt výzva
     workout — probíhá trénink bez pauzy: počet sérií + ruční start pauzy
   Klepnutí na levou část vrátí na Trénink. Stav se odvozuje z Rest a
   S.activeSession, takže stačí volat sync() po změně (dělá to render()). */
const Dock = {
  timer: null,
  overUntil: 0,
  mode: null,
  RING_R: 17,

  sync() {
    const el = document.getElementById("dock");
    if (!el) return;
    const a = S.activeSession;
    const mode = Rest.running() ? "rest"
      : this.overUntil > Date.now() ? "over"
      : (a && a.type === "weights") ? "workout" : null;
    this.mode = mode;
    el.className = "dock" + (mode ? " show " + mode : "");
    document.body.classList.toggle("has-dock", !!mode);
    el.innerHTML = mode ? this.html(mode, a) : "";
    clearInterval(this.timer);
    this.timer = null;
    // tiká jen pauza — trénink sám časovač nemá, počet sérií se překreslí s render()
    if (mode === "rest" || mode === "over") {
      this.tick();
      this.timer = setInterval(() => this.tick(), 250);
    }
  },

  html(mode, a) {
    if (mode === "workout") {
      // při zpětné úpravě se necvičí — bez tlačítka pauzy
      const rs = a.editOf ? 0 : Settings.get().restSeconds;
      return `
        <button class="dock-main" data-act="dock-open">
          <span class="dock-ring${a.editOf ? "" : " live"}">${ic(a.editOf ? "edit" : "dumbbell", 19)}</span>
          <span class="dock-txt">
            <span class="dock-k">${a.editOf ? "Úprava · " : ""}${esc(sessionLabel(a))}</span>
            <b class="dock-time">${workoutSetsLabel(a)}</b>
          </span>
        </button>
        ${rs > 0 ? `<button class="dock-btn go" data-act="rest-start" aria-label="Spustit pauzu">
          ${ic("timer", 17)}${fmtClock(rs)}</button>` : ""}`;
    }
    const c = 2 * Math.PI * this.RING_R;
    // počáteční stav kroužku rovnou podle zbývajícího času — render() dock
    // přestaví často a kroužek nesmí pokaždé problikat z plného
    const off = c * (1 - clamp(Rest.left() / Rest.total(), 0, 1));
    return `
      <button class="dock-main" data-act="dock-open">
        <span class="dock-ring">
          <svg class="ring" width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="${this.RING_R}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="3"/>
            ${mode === "rest" ? `<circle id="dockRing" cx="20" cy="20" r="${this.RING_R}" fill="none" stroke="var(--green)"
              stroke-width="3" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
              style="transition:stroke-dashoffset .3s linear"/>` : ""}
          </svg>
          ${ic(mode === "over" ? "check" : "timer", 17)}
        </span>
        <span class="dock-txt">
          <span class="dock-k">${mode === "over" ? "Pauza skončila — jedeš" : "Pauza"}</span>
          <b class="dock-time" id="dockTime">${mode === "over" ? "0:00" : fmtClock(Rest.left())}</b>
        </span>
      </button>
      ${mode === "rest" ? `
        <button class="dock-btn" data-act="rest-minus">−30</button>
        <button class="dock-btn" data-act="rest-plus">+30</button>` : ""}
      <button class="dock-btn icon" data-act="rest-stop" aria-label="Zavřít pauzu">${ic("x", 18)}</button>`;
  },

  tick() {
    const t = document.getElementById("dockTime");
    if (this.mode === "rest") {
      const left = Rest.left();
      if (left <= 0) {
        localStorage.removeItem(Rest.KEY);
        localStorage.removeItem(Rest.TOTAL_KEY);
        this.overUntil = Date.now() + 5000;
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        this.sync();
        return;
      }
      if (t) t.textContent = fmtClock(left);
      const ring = document.getElementById("dockRing");
      if (ring) {
        const c = 2 * Math.PI * this.RING_R;
        ring.setAttribute("stroke-dashoffset", (c * (1 - clamp(left / Rest.total(), 0, 1))).toFixed(1));
      }
    } else if (this.mode === "over") {
      if (Date.now() > this.overUntil) { this.overUntil = 0; this.sync(); }
    }
  }
};

/* Počet zapsaných sérií v probíhajícím tréninku — ukazuje ho dock, když
   neběží pauza. Časovač celého tréninku v appce záměrně není (v1.26). */
function workoutSetsLabel(a) {
  if (!a) return "";
  const n = (a.entries || []).reduce((k, e) => k + (e.sets || []).length, 0);
  return `${n} ${n === 1 ? "série" : n >= 2 && n <= 4 ? "série" : "sérií"}`;
}

/* ---- Modal (bottom sheet) ---- */
function openModal(html) {
  const m = document.getElementById("modal");
  m.innerHTML = html;
  m.scrollTop = 0;
  m.classList.remove("scrolled");
  m.classList.add("open");
  document.getElementById("modalBackdrop").classList.add("open");
  document.body.classList.add("modal-open");
}
function closeModal() {
  document.getElementById("modal").classList.remove("open");
  document.getElementById("modalBackdrop").classList.remove("open");
  document.body.classList.remove("modal-open");
}
function modalTitle(text) {
  return `<div class="modal-title"><span>${esc(text)}</span>
    <button class="iconbtn" data-act="modal-close" aria-label="Zavřít">${ic("x", 18, 2.4)}</button></div>`;
}
/* stín pod lepkavou hlavičkou sheetu, jakmile se pod ní začne scrollovat */
document.getElementById("modal").addEventListener("scroll", e => {
  e.currentTarget.classList.toggle("scrolled", e.currentTarget.scrollTop > 4);
}, { passive: true });

/* ---- Výběr cviku (přidání / výměna v tréninku, přidání do šablony) ----
   Hledání a filtr partií sedí v lepkavé hlavičce sheetu, takže zůstávají
   po ruce i hluboko v seznamu. Hledá se v českém i anglickém názvu, bez
   ohledu na diakritiku. used(id) vrací štítek pro cvik, který vybrat
   nejde (už je v tréninku / šabloně), jinak null. */
const PK = { title: "", act: "", cat: "all", q: "", used: () => null };

function openExPicker({ title, act, cat = "all", used = () => null }) {
  Object.assign(PK, { title, act, cat: CAT_ORDER.includes(cat) ? cat : "all", q: "", used });
  openModal(`
    <div class="sheet-sticky">
      ${modalTitle(title)}
      <label class="search">${ic("search", 19)}
        <input class="input" id="exPickSearch" type="search" placeholder="Hledat cvik…"
          autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search"></label>
      <div class="chips scroll" id="exPickCats">${pickerCatChips()}</div>
    </div>
    <div id="exPickList">${pickerListHtml()}</div>`);
  const inp = document.getElementById("exPickSearch");
  inp.addEventListener("input", () => {
    PK.q = inp.value;
    refreshPicker();
    document.getElementById("modal").scrollTop = 0;
  });
  // vybraná partie (výměna cviku) musí být v řádku chipů vidět
  const on = document.querySelector("#exPickCats .chip.on");
  if (on && PK.cat !== "all") on.scrollIntoView({ inline: "center", block: "nearest" });
}

function pickerCatChips() {
  return [`<button class="chip${PK.cat === "all" ? " on" : ""}" data-act="pk-cat" data-cat="all">Vše</button>`]
    .concat(CAT_ORDER.map(c =>
      `<button class="chip cat-chip${PK.cat === c ? " on" : ""}" data-act="pk-cat" data-cat="${c}">
        <i class="p-dot" style="background:${catColor(c)}"></i>${c}</button>`)).join("");
}

function exMatches(e, q) {
  if (!q) return true;
  return norm(e.name).includes(q) || norm(e.nameEn).includes(q);
}

function pickerListHtml() {
  const q = norm(PK.q.trim());
  const cats = PK.cat === "all" ? CAT_ORDER : [PK.cat];
  const groups = cats.map(cat => {
    const items = S.exercises
      .filter(e => e.category === cat && exMatches(e, q))
      .map(e => {
        const used = PK.used(e.id);
        return `<div class="list-item${used ? " used" : ""}"${used ? "" : ` data-act="${PK.act}" data-exid="${e.id}"`}>
          <i class="p-stripe" style="background:${catColor(cat)}"></i>
          <div class="grow">
            <div class="name">${esc(e.name)}</div>
            ${exNameEn(e) ? `<div class="name-en">${esc(exNameEn(e))}</div>` : ""}
          </div>
          ${used ? `<span class="badge neutral">${esc(used)}</span>`
            : e.isCustom ? `<span class="badge neutral">vlastní</span>` : ""}
        </div>`;
      }).join("");
    if (!items) return "";
    return (cats.length > 1
      ? `<div class="h3 cat-head"><i class="p-dot" style="background:${catColor(cat)}"></i>${cat}</div>` : "") + items;
  }).join("");
  if (groups) return groups;
  // v jedné partii nic — nabídni hledání napříč všemi
  if (PK.cat !== "all" && q && S.exercises.some(e => exMatches(e, q))) {
    return `<div class="empty-note">V partii ${esc(PK.cat)} nic takového není.
      <br><button class="btn sm tonal" data-act="pk-cat" data-cat="all">Hledat ve všech partiích</button></div>`;
  }
  return `<div class="empty-note">Nic nenalezeno</div>`;
}

function refreshPicker(chips = false) {
  const list = document.getElementById("exPickList");
  if (list) list.innerHTML = pickerListHtml();
  if (chips) {
    const c = document.getElementById("exPickCats");
    if (c) c.innerHTML = pickerCatChips();
  }
}

/* ---- Navigace po dnech (Trénink, Jídlo) ----
   Uprostřed je neviditelné pole type=date přes celou plochu — klepnutí
   otevře systémový výběr data. */
function dayNavHtml(day, act, changeAct, todayAct) {
  const today = todayStr();
  const d = parseDate(day);
  const label = day === today ? "Dnes" : day === addDays(today, -1) ? "Včera"
    : day === addDays(today, 1) ? "Zítra" : `${CZ_DAYS_FULL[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`;
  const hint = day > today ? "plánování" : fmtDate(day);
  return `
    <div class="daynav">
      <button class="iconbtn soft" data-act="${act}" data-dir="-1" aria-label="Předchozí den">${ic("chevL")}</button>
      <div class="daynav-mid">
        <b>${label}</b><span>${hint}</span>
        <input type="date" data-change="${changeAct}" value="${day}" aria-label="Vybrat datum">
      </div>
      <button class="iconbtn soft" data-act="${act}" data-dir="1" aria-label="Další den">${ic("chevR")}</button>
    </div>
    ${day === today ? "" : `<button class="btn sm tonal full" data-act="${todayAct}">Zpět na dnešek</button>`}`;
}

/* Jednoduché potvrzení */
function confirmModal(text, actName, dataAttrs = "", label = "Smazat") {
  openModal(`${modalTitle("Potvrzení")}
    <p style="margin:0 0 18px">${esc(text)}</p>
    <div class="row">
      <button class="btn ghost grow" data-act="modal-close">Zrušit</button>
      <button class="btn danger grow" data-act="${actName}" ${dataAttrs}>${esc(label)}</button>
    </div>`);
}

/* ---- Progress bar ---- */
function barHtml(value, target, color, mini = false) {
  const pct = target > 0 ? clamp(value / target * 100, 0, 100) : 0;
  const over = target > 0 && value > target * 1.05;
  return `<div class="bar${mini ? " mini" : ""}">
    <div style="width:${pct.toFixed(1)}%;background:var(--${over ? "red" : color})"></div>
  </div>`;
}

/* ---- Kalendář ----
   decorate(dateStr) → { cls, mark, bars, corner } nebo null
     cls    — třída buňky ('hit' | 'miss' | 'trained' | '')
     mark   — drobný obsah pod číslem (tečky, ✓)
     bars   — pole barev: proužky identity (partie odcvičené ten den)
     corner — tečka v pravém horním rohu (splněný cíl) */
function calendarHtml(year, month, decorate, clickAct) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startShift = (first.getDay() + 6) % 7; // Po=0
  const today = todayStr();

  let cells = CZ_DOW.map(d => `<div class="cal-dow">${d}</div>`).join("");
  for (let i = 0; i < startShift; i++) cells += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = dateStr(new Date(year, month, d));
    const info = decorate(ds) || { cls: "", mark: "" };
    const bars = (info.bars || []).length
      ? `<div class="cal-bars">${info.bars.map(b => {
          const color = typeof b === "string" ? b : b.color;
          const cls = typeof b === "string" ? "" : (b.cls || "");
          return `<i class="${cls}" style="background:${color}"></i>`;
        }).join("")}</div>`
      : "";
    cells += `<div class="cal-day ${info.cls}${ds === today ? " today" : ""}"
      data-act="${clickAct}" data-date="${ds}">
      ${info.corner ? `<i class="cal-goal"></i>` : ""}
      <span>${d}</span>${info.mark ? `<span class="mark">${info.mark}</span>` : ""}${bars}
    </div>`;
  }
  return `
  <div class="cal-head">
    <button class="iconbtn soft" data-act="cal-nav" data-dir="-1" aria-label="Předchozí měsíc">${ic("chevL")}</button>
    <b>${CZ_MONTHS[month]} ${year}</b>
    <button class="iconbtn soft" data-act="cal-nav" data-dir="1" aria-label="Další měsíc">${ic("chevR")}</button>
  </div>
  <div class="cal-grid">${cells}</div>`;
}

/* ---- Pokrytí partií v jednom řádku ----
   Sedm segmentů v pořadí podle těla; nepokrytá partie je ztlumená.
   Kompaktní protějšek counteru z aktivního tréninku.
   core = core odškrtnutý ručně (bez zapsaných sérií) se počítá jako pokrytý. */
function catPipsHtml(counts, core = false) {
  return `<div class="cat-pips">${CAT_ORDER.map(c =>
    `<i style="background:${catColor(c)}${counts[c] || (core && c === "Core") ? "" : ";opacity:.2"}"></i>`).join("")}</div>`;
}

/* ---- Vlastní rozsah datumů „od–do" ----
   Změny chodí přes data-change="<prefix>-from" / "<prefix>-to".
   Stejné datum v obou polích = jeden den. */
function dateRangeRow(prefix, from, to) {
  return `
    <div class="row mt" style="gap:8px;margin-bottom:12px">
      <label class="field grow" style="margin:0"><span>Od</span>
        <input class="input" type="date" data-change="${prefix}-from" value="${from}"></label>
      <label class="field grow" style="margin:0"><span>Do</span>
        <input class="input" type="date" data-change="${prefix}-to" value="${to}"></label>
    </div>`;
}

/* ---- SVG grafy (bez knihoven) ----
   viewBox je široký jako karta na telefonu (~330 px), takže písmo 11 je
   opravdu 11 px a čáry 2 px. Mřížka = vlasové linky, data = --chart,
   hodnoty nesou texty v barvě textu, ne v barvě série. Každý graf nese
   v data-tip body pro dotykový readout (ChartTip) — tah prstem ukáže hodnotu. */
const CH_W = 330;

/* „Hezké" dělení osy: 0 / 10 / 20 … — nejvýš 4 linky */
function niceTicks(max, count = 3) {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(st => st >= raw) || 10 * mag;
  const out = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1000) / 1000);
  if (out[out.length - 1] < max) out.push(Math.round((out[out.length - 1] + step) * 1000) / 1000);
  return out;
}

function tipAttr(points) {
  return ` data-tip="${esc(JSON.stringify(points))}"`;
}

/* Sloupcový graf: data = [{label, value, tip?}]; hl = index zvýrazněného
   sloupce (ostatní ztlumené — „emphasis"). Popisky na ose X jen u každého
   n-tého sloupce, hodnota jen u zvýrazněného a u maxima. */
function columnChart(data, { height = 150, hl = data.length - 1, unit = "" } = {}) {
  if (!data.length || data.every(d => !d.value)) return `<div class="empty-note">Zatím žádná data</div>`;
  const W = CH_W, H = height, padL = 26, padR = 4, padT = 18, padB = 20;
  const max = Math.max(...data.map(d => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const band = plotW / data.length;
  const bw = Math.min(band * 0.6, 24);
  const y = v => padT + plotH * (1 - v / top);
  const every = data.length > 8 ? 3 : 1;
  const maxI = data.findIndex(d => d.value === max);
  let grid = "", bars = "", labels = "";
  for (const t of ticks) {
    grid += `<line x1="${padL}" x2="${W - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="var(--line2)" stroke-width="1"/>
      <text x="${padL - 6}" y="${(y(t) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--text3)">${fmtNum(t)}</text>`;
  }
  const tips = [];
  data.forEach((d, i) => {
    const cx = padL + band * (i + 0.5);
    const x = cx - bw / 2;
    const h = Math.max(0, y(0) - y(d.value));
    const r = Math.min(4, h);
    const yt = y(d.value);
    if (h > 0) {
      bars += `<path d="M${x.toFixed(1)},${y(0).toFixed(1)}V${(yt + r).toFixed(1)}Q${x.toFixed(1)},${yt.toFixed(1)} ${(x + r).toFixed(1)},${yt.toFixed(1)}H${(x + bw - r).toFixed(1)}Q${(x + bw).toFixed(1)},${yt.toFixed(1)} ${(x + bw).toFixed(1)},${(yt + r).toFixed(1)}V${y(0).toFixed(1)}Z"
        fill="var(--chart)" opacity="${i === hl ? 1 : 0.4}"/>`;
    }
    if (d.value && (i === hl || i === maxI)) {
      bars += `<text x="${cx.toFixed(1)}" y="${(yt - 5).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text${i === hl ? "" : "2"})">${fmtNum(d.value)}</text>`;
    }
    if ((data.length - 1 - i) % every === 0) {
      labels += `<text x="${cx.toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="10" fill="var(--text3)">${esc(d.label)}</text>`;
    }
    tips.push([+(cx / W).toFixed(4), +(yt / H).toFixed(4), d.tip || d.label, `${fmtNum(d.value)}${unit}`]);
  });
  return `<div class="chart-wrap"${tipAttr(tips)}><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${grid}${bars}${labels}</svg></div>`;
}

/* Spojnicový graf: series = [{date, value}], volitelná cílová linka.
   raw = druhá sada bodů (stejné indexy jako series) vykreslená jako tlumené tečky —
   používá se pro denní hodnoty váhy pod klouzavým průměrem.
   dec = počet desetinných míst v popiscích, unit = jednotka v readoutu. */
function lineChart(series, { color = "chart", height = 150, goal = null, raw = null, dec = 1, unit = "" } = {}) {
  const idx = series.map((p, i) => p.value != null ? i : -1).filter(i => i >= 0);
  const pts = idx.map(i => series[i]);
  if (pts.length < 2) return `<div class="empty-note">Potřebuji alespoň 2 záznamy pro graf</div>`;
  const W = CH_W, H = height, padL = 34, padR = 10, padT = 16, padB = 20;
  const vals = pts.map(p => p.value)
    .concat(goal ? [goal] : [])
    .concat(raw ? raw.filter(p => p && p.value != null).map(p => p.value) : []);
  let min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || Math.abs(max) * 0.1 || 1;
  min -= span * 0.15; max += span * 0.15;
  const n = series.length;
  const x = i => padL + (n > 1 ? i / (n - 1) : 0.5) * (W - padL - padR);
  const y = v => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  /* vlasové linky mřížky na „hezkých" hodnotách uvnitř rozsahu */
  const raw3 = (max - min) / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(raw3)));
  const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(st => st >= raw3) || 10 * mag;
  let grid = "";
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    grid += `<line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line2)" stroke-width="1"/>
      <text x="${padL - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--text3)">${fmtNum(v, step < 1 ? 1 : 0)}</text>`;
  }
  const path = idx.map((i, k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(series[i].value).toFixed(1)}`).join("");
  const area = `${path}L${x(idx[idx.length - 1]).toFixed(1)},${(H - padB).toFixed(1)}L${x(idx[0]).toFixed(1)},${(H - padB).toFixed(1)}Z`;
  let extra = "";
  if (goal) {
    extra += `<line x1="${padL}" y1="${y(goal).toFixed(1)}" x2="${W - padR}" y2="${y(goal).toFixed(1)}"
      stroke="var(--green)" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.8"/>
      <text x="${W - padR}" y="${(y(goal) - 5).toFixed(1)}" text-anchor="end" font-size="10.5" fill="var(--green)">cíl ${fmtNum(goal)}</text>`;
  }
  let rawDots = "";
  if (raw) {
    rawDots = raw.map((p, i) => !p || p.value == null ? "" :
      `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="2.2" fill="var(--text3)" opacity="0.8"/>`).join("");
  }
  const li = idx[idx.length - 1];
  const last = series[li];
  const lx = x(li), ly = y(last.value);
  const firstLbl = pts[0].date ? fmtDate(pts[0].date) : "";
  const lastLbl = last.date ? fmtDate(last.date) : "";
  const tips = idx.map(i => [+(x(i) / W).toFixed(4), +(y(series[i].value) / H).toFixed(4),
    series[i].date ? fmtDate(series[i].date) : "", `${fmtNum(series[i].value, dec)}${unit}`]);
  return `<div class="chart-wrap"${tipAttr(tips)}><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${grid}${extra}
    <path d="${area}" fill="var(--${color})" opacity="0.08"/>
    ${rawDots}
    <path d="${path}" fill="none" stroke="var(--${color})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4" fill="var(--${color})" stroke="var(--bg1)" stroke-width="2"/>
    <text x="${Math.min(lx, W - padR - 2).toFixed(1)}" y="${(ly - 9).toFixed(1)}" text-anchor="end" font-size="11" font-weight="700" fill="var(--text)">${fmtNum(last.value, dec)}</text>
    <text x="${padL}" y="${H - 5}" font-size="10" fill="var(--text3)">${firstLbl}</text>
    <text x="${W - padR}" y="${H - 5}" text-anchor="end" font-size="10" fill="var(--text3)">${lastLbl}</text>
  </svg></div>`;
}

/* Sparkline do řádku seznamu — jen tvar trendu, poslední bod zvýrazněný
   (volt, když je výš než první = zlepšení). */
function sparklineHtml(values, w = 64, h = 26) {
  if (values.length < 2) return `<span class="spark" style="width:${w}px"></span>`;
  const min = Math.min(...values), max = Math.max(...values);
  const x = i => 3 + i / (values.length - 1) * (w - 6);
  const y = v => max === min ? h / 2 : 4 + (1 - (v - min) / (max - min)) * (h - 8);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const up = values[values.length - 1] > values[0];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path d="${d}" fill="none" stroke="var(--chart)" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(values.length - 1).toFixed(1)}" cy="${y(values[values.length - 1]).toFixed(1)}" r="3.5"
      fill="var(--${up ? "green" : "text2"})"/>
  </svg>`;
}

/* ---- Dotykový readout grafů ----
   Graf nese v data-tip body [x 0–1, y 0–1, popisek, hodnota]. Klepnutí nebo
   vodorovný tah prstem ukáže svislou linku a hodnotu nejbližšího bodu;
   po puštění prstu readout po chvíli zmizí. Texty jdou přes textContent. */
const ChartTip = {
  timer: null,
  show(wrap, clientX) {
    let pts;
    try { pts = JSON.parse(wrap.dataset.tip); } catch (e) { return; }
    if (!pts.length) return;
    const r = wrap.getBoundingClientRect();
    const fx = (clientX - r.left) / r.width;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p[0] - fx) < Math.abs(pts[best][0] - fx)) best = i; });
    const p = pts[best];
    let tip = wrap.querySelector(".chart-tip");
    if (!tip) {
      wrap.insertAdjacentHTML("beforeend",
        `<i class="chart-x"></i><i class="chart-dot"></i><div class="chart-tip"><b></b><span></span></div>`);
      tip = wrap.querySelector(".chart-tip");
    }
    wrap.querySelector(".chart-x").style.left = (p[0] * 100) + "%";
    const dot = wrap.querySelector(".chart-dot");
    dot.style.left = (p[0] * 100) + "%";
    dot.style.top = (p[1] * 100) + "%";
    tip.querySelector("b").textContent = p[3];
    tip.querySelector("span").textContent = p[2];
    const tw = tip.offsetWidth;
    tip.style.left = clamp(p[0] * r.width - tw / 2, 0, Math.max(0, r.width - tw)) + "px";
    wrap.classList.add("tipping");
    clearTimeout(this.timer);
  },
  hideSoon(wrap, ms = 1600) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => wrap.classList.remove("tipping"), ms);
  }
};
document.addEventListener("pointerdown", e => {
  const w = e.target.closest(".chart-wrap[data-tip]");
  if (w) ChartTip.show(w, e.clientX);
});
document.addEventListener("pointermove", e => {
  const w = e.target.closest(".chart-wrap[data-tip]");
  if (w && (e.pointerType === "mouse" || e.buttons)) ChartTip.show(w, e.clientX);
});
document.addEventListener("pointerup", e => {
  const w = e.target.closest(".chart-wrap[data-tip]");
  if (w && e.pointerType !== "mouse") ChartTip.hideSoon(w);
});
document.addEventListener("pointerout", e => {
  const w = e.target.closest(".chart-wrap[data-tip]");
  if (w && e.pointerType === "mouse" && !w.contains(e.relatedTarget)) ChartTip.hideSoon(w, 0);
});

/* ---- Zdrojový badge potraviny ---- */
function sourceBadge(source) {
  return {
    openfoodfacts: `<span class="badge neutral">OFF</span>`,
    usda: `<span class="badge neutral">USDA</span>`,
    custom: `<span class="badge neutral">vlastní</span>`
  }[source] || "";
}

/* ---- Kalorický prstenec (SVG) ---- */
function ringHtml(value, target, size = 150, centerHtml = "") {
  const pct = target > 0 ? clamp(value / target, 0, 1) : 0;
  const over = target > 0 && value > target * 1.05;
  const sw = 12;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  return `
  <div class="ring-wrap" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--bg3)" stroke-width="${sw}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="var(--${over ? "red" : "green"})" stroke-width="${sw}" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"
        style="transition:stroke-dashoffset .5s"/>
    </svg>
    <div class="ring-center">${centerHtml}</div>
  </div>`;
}

/* ---- Makro mini bar s labelem a hodnotami ----
   stack=true: label / bar / hodnota pod sebou (úzké sloupce vedle sebe) */
function macroBar(label, val, target, color, stack = false) {
  if (stack) {
    return `
      <div class="grow">
        <div class="h3" style="margin-bottom:5px">${label}</div>
        ${barHtml(val, target, color, true)}
        <div class="small" style="font-weight:700;margin-top:5px;white-space:nowrap">${fmtNum(val)}<span style="color:var(--text3)">/${fmtNum(target)}g</span></div>
      </div>`;
  }
  return `
    <div class="grow">
      <div class="row between" style="margin-bottom:4px">
        <span class="h3" style="margin:0">${label}</span>
        <span class="small" style="font-weight:700;white-space:nowrap">${fmtNum(val)}<span style="color:var(--text3)">/${fmtNum(target)}g</span></span>
      </div>
      ${barHtml(val, target, color, true)}
    </div>`;
}

/* ---- Badge typu jídla ---- */
const MEAL_TYPES = [
  { id: "breakfast", name: "Snídaně" },
  { id: "snack", name: "Svačina" },
  { id: "lunch", name: "Oběd" },
  { id: "dinner", name: "Večeře" }
];
function mealName(id) {
  const m = MEAL_TYPES.find(m => m.id === id);
  return m ? m.name : "Nezařazeno";
}

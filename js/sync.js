/* ===== Cloud sync — Google Apps Script Web App =====
   Strategie: záznamové kolekce (tréninky, jídla, váha…) se slévají podle id,
   takže změny ze dvou zařízení se neztratí. Smazané záznamy hlídají tombstony
   (deletedIds). Skalární pole (cíl, aktivní session) bere novější stav.
   POST záměrně bez Content-Type application/json (text/plain nevyvolá CORS
   preflight, který GAS neumí obsloužit). */
"use strict";

const DIRTY_KEY = "fitapp_dirty";

/* Sloučení lokálního a cloudového stavu */
function mergeStates(local, cloud) {
  if (!cloud) return local;
  const localNewer = (local.updatedAt || 0) >= (cloud.updatedAt || 0);
  const newer = localNewer ? local : cloud;
  const older = localNewer ? cloud : local;
  const tomb = new Set([...(local.deletedIds || []), ...(cloud.deletedIds || [])]);

  // sjednocení podle klíče; při konfliktu stejného id vyhrává novější stav
  const byId = (key, idOf = x => x.id) => {
    const map = new Map();
    for (const x of (older[key] || [])) map.set(idOf(x), x);
    for (const x of (newer[key] || [])) map.set(idOf(x), x);
    return [...map.values()].filter(x => !tomb.has(idOf(x)));
  };

  const out = Object.assign({}, older, newer); // skaláry (goal, activeSession…) z novějšího
  out.exercises = byId("exercises");
  out.templates = byId("templates");
  out.sessions = byId("sessions").sort((a, b) => a.date.localeCompare(b.date));
  out.foods = byId("foods");
  out.foodLog = byId("foodLog");
  out.recipes = byId("recipes");
  out.milestones = byId("milestones");
  out.checkins = byId("checkins").sort((a, b) => a.date.localeCompare(b.date));
  out.bodyLog = byId("bodyLog", x => x.date).sort((a, b) => a.date.localeCompare(b.date));
  out.dayLog = byId("dayLog", x => x.date).sort((a, b) => a.date.localeCompare(b.date));
  /* data z hodinek po dnech; ruční zásahy do plánu jako mapy (novější klíč vyhrává) */
  const hl = mergeHealth(older.health, newer.health);
  if (hl) out.health = hl;
  for (const k of ["overrides", "adaptOff"]) {
    if (older[k] || newer[k]) out[k] = Object.assign({}, older[k], newer[k]);
  }
  out.deletedIds = [...tomb].slice(-500);
  out.updatedAt = Math.max(local.updatedAt || 0, cloud.updatedAt || 0);
  return out;
}

const Sync = {
  status: "off",       // off | ok | pending | error
  lastError: null,
  _timer: null,

  url() { return (Settings.get().gasWebAppUrl || "").trim(); },

  setStatus(s, err) {
    this.status = s;
    this.lastError = err || null;
    const dot = document.getElementById("syncDot");
    if (dot) {
      dot.className = "sync-dot" + (s === "off" ? "" : " " + s);
      dot.title = { off: "Sync není nastaven", ok: "Synchronizováno", pending: "Synchronizace…", error: "Chyba synchronizace: " + (err || "") }[s];
    }
    document.dispatchEvent(new CustomEvent("syncstatus"));
  },

  /* Debounced uložení — volá se z save() po každé změně */
  scheduleSave() {
    if (!this.url()) return;
    localStorage.setItem(DIRTY_KEY, "1");
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.cloudSave(), 1800);
  },

  async cloudSave() {
    const url = this.url();
    if (!url) { this.setStatus("off"); return false; }
    // nová instalace ještě nic nenačetla — server stav přepisuje celý, takže
    // místo nahrání prázdné appky nejdřív stáhni data z cloudu
    if (S.pristine) return this.cloudLoad();
    if (!navigator.onLine) { this.setStatus("error", "offline"); return false; }
    this.setStatus("pending");
    try {
      const res = await fetch(url, { method: "POST", body: JSON.stringify(S) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Server vrátil chybu");
      localStorage.removeItem(DIRTY_KEY);
      this.setStatus("ok");
      return true;
    } catch (e) {
      console.warn("cloudSave:", e);
      this.setStatus("error", e.message);
      return false;
    }
  },

  async cloudLoad() {
    const url = this.url();
    if (!url) { this.setStatus("off"); return false; }
    if (!navigator.onLine) { this.setStatus("error", "offline"); return false; }
    this.setStatus("pending");
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Server vrátil chybu");
      const cloud = data.state;
      if (cloud) {
        /* nová instalace bere cloud celý: migrace jí daly čerstvé updatedAt,
           takže by při slévání výchozí šablony, cíl a cviky přebily skutečná data */
        const fresh = !!S.pristine;
        replaceState(fresh ? cloud : mergeStates(S, cloud));
        if (fresh) runMigrations();
        // data ze Zkratky (list HEALTH) server přibaluje k načtení
        if (data.health && healthIngest(data.health)) save();
        const changedVsCloud = JSON.stringify(S) !== JSON.stringify(Object.assign(defaultState(), cloud));
        document.dispatchEvent(new CustomEvent("staterefresh"));
        if (changedVsCloud) this.scheduleSave(); // lokální novinky pošli zpět
      } else if ((S.updatedAt || 0) > 0) {
        if (data.health && !S.pristine && healthIngest(data.health)) persist();
        this.scheduleSave(); // v cloudu ještě nic není → nahraj lokální stav
      }
      if (!localStorage.getItem(DIRTY_KEY)) this.setStatus("ok");
      return true;
    } catch (e) {
      console.warn("cloudLoad:", e);
      this.setStatus("error", e.message);
      return false;
    }
  },

  init() {
    if (!this.url()) { this.setStatus("off"); return; }
    this.cloudLoad().then(() => {
      // po startu odešli případné neodeslané změny z offline režimu
      if (localStorage.getItem(DIRTY_KEY)) this.cloudSave();
    });
    window.addEventListener("online", () => {
      if (localStorage.getItem(DIRTY_KEY)) this.cloudSave();
    });
    window.addEventListener("offline", () => {
      if (this.url()) this.setStatus("error", "offline");
    });
  }
};

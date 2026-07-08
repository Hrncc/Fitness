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
  out.bodyLog = byId("bodyLog", x => x.date).sort((a, b) => a.date.localeCompare(b.date));
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
        const merged = mergeStates(S, cloud);
        const changedVsCloud = JSON.stringify(merged) !== JSON.stringify(Object.assign(defaultState(), cloud));
        replaceState(merged);
        document.dispatchEvent(new CustomEvent("staterefresh"));
        if (changedVsCloud) this.scheduleSave(); // lokální novinky pošli zpět
      } else if ((S.updatedAt || 0) > 0) {
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

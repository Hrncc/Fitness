/* ===== Cloud sync — Google Apps Script Web App =====
   Strategie: last-write-wins podle updatedAt. Celý stav se ukládá/čte najednou.
   POST záměrně bez Content-Type application/json (text/plain nevyvolá CORS preflight,
   který GAS neumí obsloužit). */
"use strict";

const DIRTY_KEY = "fitapp_dirty";

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
      if (cloud && (cloud.updatedAt || 0) > (S.updatedAt || 0)) {
        replaceState(cloud);
        document.dispatchEvent(new CustomEvent("staterefresh"));
      } else if ((S.updatedAt || 0) > ((cloud && cloud.updatedAt) || 0)) {
        // lokální data jsou novější → nahraj je
        this.scheduleSave();
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

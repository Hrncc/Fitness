/* ===== Fotky postupu — lokální úložiště (IndexedDB) =====
   Fotky se záměrně NEsynchronizují do Sheetu ani nejdou do JSON zálohy —
   JSON by narostl o desítky MB a sync by se rozbil. Stahují se jednotlivě
   z galerie (tlačítko Stáhnout v detailu fotky). */
"use strict";

const Photos = {
  DB: "fitapp_photos",
  STORE: "photos",
  _db: null,

  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          db.createObjectStore(this.STORE, { keyPath: "id" }).createIndex("date", "date");
        }
      };
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => reject(req.error || new Error("Úložiště fotek se nepodařilo otevřít"));
    });
  },

  async _req(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = fn(db.transaction(this.STORE, mode).objectStore(this.STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async add(file, date, note) {
    const blob = await imageToJpegBlob(file);
    const rec = { id: uid(), date, note: note || null, blob, createdAt: Date.now() };
    await this._req("readwrite", st => st.add(rec));
    return rec;
  },

  /* nejnovější první */
  async list() {
    const all = await this._req("readonly", st => st.getAll());
    return (all || []).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  },

  remove(id) { return this._req("readwrite", st => st.delete(id)); }
};

/* Zmenší fotku na max 1280 px (delší strana) a překóduje na JPEG blob —
   plné rozlišení z mobilu by zbytečně zabralo desítky MB. */
function imageToJpegBlob(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("Fotku se nepodařilo zpracovat")), "image/jpeg", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Obrázek se nepodařilo načíst"));
    };
    img.src = url;
  });
}

/* ===== Service worker — offline chod aplikačního shellu =====
   Cache-first pro vlastní soubory, síť pro externí API (OFF, USDA, GAS). */
"use strict";

const CACHE = "fitapp-v12";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/util.js",
  "./js/data.js",
  "./js/sync.js",
  "./js/foodapi.js",
  "./js/ui.js",
  "./js/view-today.js",
  "./js/view-workout.js",
  "./js/view-food.js",
  "./js/view-summary.js",
  "./js/view-menu.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // externí API vždy ze sítě (sync, vyhledávání potravin)
  if (url.origin !== location.origin) return;
  if (e.request.method !== "GET") return;

  // vlastní soubory: network-first (aktualizace se projeví hned),
  // při výpadku sítě se servíruje poslední verze z cache
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() =>
      caches.match(e.request).then(hit => hit || caches.match("./index.html"))
    )
  );
});

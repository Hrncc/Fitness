/* ===== Service worker — offline chod aplikačního shellu =====
   Cache-first pro vlastní soubory, síť pro externí API (OFF, USDA, GAS). */
"use strict";

const CACHE = "fitapp-v52";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/util.js",
  "./js/qr.js",
  "./js/photos.js",
  "./js/exercise-db.js",
  "./js/data.js",
  "./js/block.js",
  "./js/engine.js",
  "./js/health.js",
  "./js/anim.js",
  "./js/view-live.js",
  "./js/view-coach.js",
  "./js/sync.js",
  "./js/foodapi.js",
  "./js/ui.js",
  "./js/view-today.js",
  "./js/view-workout.js",
  "./js/view-food.js",
  "./js/view-summary.js",
  "./js/view-progress.js",
  "./js/view-checkin.js",
  "./js/report.js",
  "./js/view-menu.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./img/anim/squat-a.jpg", "./img/anim/squat-b.jpg",
  "./img/anim/bench-a.jpg", "./img/anim/bench-b.jpg",
  "./img/anim/deadlift-a.jpg", "./img/anim/deadlift-b.jpg",
  "./img/anim/curl-a.jpg", "./img/anim/curl-b.jpg",
  "./img/anim/lunge-a.jpg", "./img/anim/lunge-b.jpg",
  "./img/anim/rdl-a.jpg", "./img/anim/rdl-b.jpg",
  "./img/anim/row-a.jpg", "./img/anim/row-b.jpg",
  "./img/anim/pushup-a.jpg", "./img/anim/pushup-b.jpg",
  "./img/anim/crunch-a.jpg", "./img/anim/crunch-b.jpg",
  "./img/anim/legpress-a.jpg", "./img/anim/legpress-b.jpg",
  "./img/anim/pushdown-a.jpg", "./img/anim/pushdown-b.jpg",
  "./img/anim/pullup-a.jpg", "./img/anim/pullup-b.jpg",
  "./img/anim/ohp-a.jpg", "./img/anim/ohp-b.jpg",
  "./img/anim/latraise-a.jpg", "./img/anim/latraise-b.jpg",
  "./img/anim/dips-a.jpg", "./img/anim/dips-b.jpg",
  "./img/anim/squat.mp4", "./img/anim/bench.mp4", "./img/anim/deadlift.mp4",
  "./img/anim/curl.mp4", "./img/anim/lunge.mp4", "./img/anim/rdl.mp4",
  "./img/anim/row.mp4", "./img/anim/pushup.mp4", "./img/anim/crunch.mp4",
  "./img/anim/legpress.mp4", "./img/anim/pushdown.mp4", "./img/anim/pullup.mp4",
  "./img/anim/ohp.mp4", "./img/anim/latraise.mp4", "./img/anim/dips.mp4"
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

// ============================================================
// sw.js — Service Worker TERAS MBUN (PWA ringan)
// Cache-first buat aset statis; Supabase selalu network.
// Ingat: tiap ubah file yang di-precache, BUMP versi cache di bawah.
// ============================================================
const CACHE = "terasmbun-v48";
const PRECACHE = [
  "./",
  "index.html",
  "pesen.html",
  "pesenan-aku.html",
  "dapur.html",
  "admin.html",
  "css/style.css",
  "js/config.js",
  "js/db.js",
  "js/toast.js",
  "js/notice.js",
  "js/show-popup.js",
  "js/menu.js",
  "js/pesen.js",
  "js/pesenan-aku.js",
  "js/dapur.js",
  "js/admin.js",
  "manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // API Supabase & font eksternal: network first (data harus fresh)
  if (url.origin !== location.origin) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  // aset same-origin: cache dulu, update di belakang
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const jaring = fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || jaring;
    })
  );
});

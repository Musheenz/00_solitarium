// sw.js — offline cache. Cache-first; a new version takes over on the next
// launch and never interrupts a game. Run `node tools/release.mjs` before
// every deploy: it rewrites PRECACHE and bumps CACHE_VERSION.

const CACHE_VERSION = 'v6';
const CACHE = 'johns-solitaire-' + CACHE_VERSION;

// PRECACHE-START
const PRECACHE = [
  './',
  'assets/cards/10C.png',
  'assets/cards/10D.png',
  'assets/cards/10H.png',
  'assets/cards/10S.png',
  'assets/cards/2C.png',
  'assets/cards/2D.png',
  'assets/cards/2H.png',
  'assets/cards/2S.png',
  'assets/cards/3C.png',
  'assets/cards/3D.png',
  'assets/cards/3H.png',
  'assets/cards/3S.png',
  'assets/cards/4C.png',
  'assets/cards/4D.png',
  'assets/cards/4H.png',
  'assets/cards/4S.png',
  'assets/cards/5C.png',
  'assets/cards/5D.png',
  'assets/cards/5H.png',
  'assets/cards/5S.png',
  'assets/cards/6C.png',
  'assets/cards/6D.png',
  'assets/cards/6H.png',
  'assets/cards/6S.png',
  'assets/cards/7C.png',
  'assets/cards/7D.png',
  'assets/cards/7H.png',
  'assets/cards/7S.png',
  'assets/cards/8C.png',
  'assets/cards/8D.png',
  'assets/cards/8H.png',
  'assets/cards/8S.png',
  'assets/cards/9C.png',
  'assets/cards/9D.png',
  'assets/cards/9H.png',
  'assets/cards/9S.png',
  'assets/cards/AC.png',
  'assets/cards/AD.png',
  'assets/cards/AH.png',
  'assets/cards/AS.png',
  'assets/cards/JC.png',
  'assets/cards/JD.png',
  'assets/cards/JH.png',
  'assets/cards/JS.png',
  'assets/cards/KC.png',
  'assets/cards/KD.png',
  'assets/cards/KH.png',
  'assets/cards/KS.png',
  'assets/cards/QC.png',
  'assets/cards/QD.png',
  'assets/cards/QH.png',
  'assets/cards/QS.png',
  'assets/cards/back.png',
  'assets/font/font.json',
  'assets/font/font.png',
  'assets/ui/card_select.png',
  'assets/ui/foundation_C.png',
  'assets/ui/foundation_D.png',
  'assets/ui/foundation_H.png',
  'assets/ui/foundation_S.png',
  'assets/ui/logo.png',
  'assets/ui/loss_card.png',
  'assets/ui/slot_empty.png',
  'assets/ui/stock_recycle.png',
  'audio/audio.json',
  'audio/card_slot.wav',
  'audio/draw_card.wav',
  'audio/lose_game.wav',
  'audio/main_theme.ogg',
  'audio/mistake.wav',
  'audio/shuffling_cards.wav',
  'audio/win_game.wav',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'index.html',
  'js/anim.js',
  'js/audio.js',
  'js/config.js',
  'js/game.js',
  'js/input.js',
  'js/lines.js',
  'js/main.js',
  'js/render.js',
  'js/save.js',
  'js/ui.js',
  'manifest.webmanifest',
  'style.css',
];
// PRECACHE-END

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  // no skipWaiting(): the running game keeps its version until relaunch
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k.startsWith('johns-solitaire-') && k !== CACHE).map((k) => caches.delete(k)))));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      // audio files Billy adds later get cached the first time they load
      if (res.ok && new URL(req.url).pathname.includes('/audio/')) cache.put(req, res.clone());
      return res;
    }),
  );
});

// Service worker: rende l'app disponibile anche offline.
const VERSION = 'scacchi-v17';
const SHELL = ['./', './index.html', './style.css', './app.js', './board.js', './engine.js', './analysis.js', './puzzles.js', './puzzle-views.js', './puzzles.json', './chess.js', './extra-views.js', './study-views.js', './lessons-data.js', './path.js', './fx.js', './evalbar.js', './sounds/lisp/Capture.mp3', './sounds/lisp/Check.mp3', './sounds/lisp/Confirmation.mp3', './sounds/lisp/Defeat.mp3', './sounds/lisp/Error.mp3', './sounds/lisp/Move.mp3', './sounds/lisp/Victory.mp3', './sounds/pychess/Capture.mp3', './sounds/pychess/Check.mp3', './sounds/pychess/Confirmation.mp3', './sounds/pychess/Defeat.mp3', './sounds/pychess/Error.mp3', './sounds/pychess/Move.mp3', './sounds/pychess/Victory.mp3', './speech.js', './pgn-import.js', './tutor.js',
  './avatars.js', './avatars/arturo-neutral.png', './avatars/arturo-talk.png', './avatars/arturo-bad.png', './avatars/arturo-good.png', './avatars/livia-neutral.png', './avatars/marco-neutral.png', './avatars/giulia-neutral.png', './avatars/zork-neutral.png',
  './game-tutor.js', './daily.js', './coach.js', './openings.js', './openings.json', './repertoire-data.js', './opening-tutor.js', './sounds/piano/Capture.mp3', './sounds/piano/Check.mp3', './sounds/piano/Confirmation.mp3', './sounds/piano/Defeat.mp3', './sounds/piano/Error.mp3', './sounds/piano/Move.mp3', './sounds/piano/Victory.mp3', './sounds/sfx/Capture.mp3', './sounds/sfx/Check.mp3', './sounds/sfx/Confirmation.mp3', './sounds/sfx/Defeat.mp3', './sounds/sfx/Error.mp3', './sounds/sfx/Move.mp3', './sounds/sfx/Victory.mp3', './sounds/nes/Capture.mp3', './sounds/nes/Check.mp3', './sounds/nes/Confirmation.mp3', './sounds/nes/Defeat.mp3', './sounds/nes/Error.mp3', './sounds/nes/Move.mp3', './sounds/nes/Victory.mp3', './sounds/futuristic/Capture.mp3', './sounds/futuristic/Check.mp3', './sounds/futuristic/Confirmation.mp3', './sounds/futuristic/Defeat.mp3', './sounds/futuristic/Error.mp3', './sounds/futuristic/Move.mp3', './sounds/futuristic/Victory.mp3', './LICENZE.txt', './engine/stockfish-19-lite-single.js', './engine/stockfish-19-lite-single.wasm', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/logo-knight.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('scacchi-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Le chiamate a Claude e al CDN del motore passano sempre dalla rete.
  if (url.hostname === 'api.anthropic.com' || url.hostname.endsWith('jsdelivr.net') || url.hostname.endsWith('jsdelivr.com') || url.hostname === 'unpkg.com') return;
  // Pezzi, scacchiere e motore incluso: cache al primo uso.
  // App e font: prima la copia salvata, poi la rete (e si aggiorna la copia).
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});

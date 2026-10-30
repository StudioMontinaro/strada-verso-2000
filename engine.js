// Motore Stockfish (WebAssembly, versione "lite single-thread" adatta al telefono).
// Al primo avvio i file del motore vengono presi dalla cartella engine/ dell'app (o, in mancanza,
// da un CDN o da file caricati a mano) e salvati sul dispositivo: da quel momento gira offline.

const CACHE_NAME = 'sf-engine';
const META_KEY = 'sf-meta';
const FALLBACK = {
  version: '19.0.0',
  js: 'https://cdn.jsdelivr.net/npm/stockfish@19.0.0/bin/stockfish-19-lite-single.js',
  wasm: 'https://cdn.jsdelivr.net/npm/stockfish@19.0.0/bin/stockfish-19-lite-single.wasm',
};

export function engineMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch { return null; }
}

// Fonti del motore, in ordine: file inclusi nell'app (cartella engine/), poi i CDN.
// Nota: jsDelivr rifiuta il pacchetto npm "stockfish" perché supera il suo limite di 150 MB.
const LOCAL = { version: '19.0.0', js: 'engine/stockfish-19-lite-single.js', wasm: 'engine/stockfish-19-lite-single.wasm' };
async function candidates() {
  const list = [LOCAL];
  for (const name of ['stockfish-19-lite-single']) {
    list.push({ version: '19.0.0', js: `https://unpkg.com/stockfish@19.0.0/bin/${name}.js`, wasm: `https://unpkg.com/stockfish@19.0.0/bin/${name}.wasm` });
  }
  list.push(FALLBACK);
  return list;
}

async function fetchWithProgress(url, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} su ${url}`);
  const reader = res.body.getReader();
  const chunks = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); n += value.length; onBytes && onBytes(n);
  }
  return new Blob(chunks);
}

export async function downloadEngine(onProgress) {
  let src, js, wasm, lastErr;
  for (const c of await candidates()) {
    try {
      onProgress && onProgress(`Preparo Stockfish ${c.version}…`);
      js = await fetchWithProgress(c.js);
      const head = await js.slice(0, 200).text();
      if (/^\s*</.test(head)) throw new Error('file non trovato');
      wasm = await fetchWithProgress(c.wasm, n => onProgress && onProgress(`Preparo Stockfish ${c.version}… ${(n / 1048576).toFixed(1)} MB`));
      const magic = new Uint8Array(await wasm.slice(0, 4).arrayBuffer());
      if (magic[0] !== 0 || magic[1] !== 0x61) throw new Error('file wasm non valido');
      src = c; break;
    } catch (e) { lastErr = e; }
  }
  if (!src) throw new Error('Impossibile ottenere Stockfish (' + (lastErr?.message || 'errore') + '). Puoi caricarlo dai file in Impostazioni.');
  return storeEngine(js, wasm, src.version, src.js.split('/').pop());
}

// Caricamento manuale dai due file scaricati (stockfish-…-lite-single.js e .wasm).
export async function importEngineFiles(jsFile, wasmFile) {
  const magic = new Uint8Array(await wasmFile.slice(0, 4).arrayBuffer());
  if (magic[0] !== 0 || magic[1] !== 0x61) throw new Error('Il file .wasm non è valido');
  const v = (jsFile.name.match(/stockfish-([\d.]+)/) || [])[1] || '?';
  return storeEngine(jsFile, wasmFile, v, jsFile.name);
}

async function storeEngine(js, wasm, version, file) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put('/__engine/engine.js', new Response(js, { headers: { 'Content-Type': 'text/javascript' } }));
  await cache.put('/__engine/engine.wasm', new Response(wasm, { headers: { 'Content-Type': 'application/wasm' } }));
  const meta = { version, file, size: wasm.size, date: new Date().toISOString() };
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  return meta;
}

async function loadFromCache() {
  const cache = await caches.open(CACHE_NAME);
  const js = await cache.match('/__engine/engine.js');
  const wasm = await cache.match('/__engine/engine.wasm');
  if (!js || !wasm) return null;
  const jsUrl = URL.createObjectURL(new Blob([await js.text()], { type: 'text/javascript' }));
  const wasmUrl = URL.createObjectURL(new Blob([await wasm.arrayBuffer()], { type: 'application/wasm' }));
  // Stockfish.js legge il percorso del file .wasm dall'hash dell'URL del worker.
  return new Worker(jsUrl + '#' + encodeURIComponent(wasmUrl));
}

export class Engine {
  constructor(worker) {
    this.w = worker;
    this.listeners = [];
    this.q = Promise.resolve();
    worker.onmessage = e => {
      const text = typeof e.data === 'string' ? e.data : String(e.data);
      for (const line of text.split('\n')) for (const f of [...this.listeners]) f(line.trim());
    };
  }
  send(cmd) { this.w.postMessage(cmd); }
  off(f) { this.listeners = this.listeners.filter(x => x !== f); }
  waitFor(pred, timeout = 0) {
    return new Promise((res, rej) => {
      let t;
      const f = l => { if (pred(l)) { this.off(f); clearTimeout(t); res(l); } };
      this.listeners.push(f);
      if (timeout) t = setTimeout(() => { this.off(f); rej(new Error('Il motore non risponde')); }, timeout);
    });
  }
  // Esegue i comandi uno alla volta, in ordine.
  run(fn) {
    const p = this.q.then(fn);
    this.q = p.catch(() => {});
    return p;
  }
  async ready() { this.send('isready'); await this.waitFor(l => l === 'readyok', 60000); }
  async init() {
    this.send('uci');
    const id = [];
    const f = l => { if (l.startsWith('id name')) id.push(l.slice(8)); };
    this.listeners.push(f);
    await this.waitFor(l => l === 'uciok', 60000);
    this.off(f);
    this.name = id[0] || 'Stockfish';
    await this.ready();
  }
  configure(opts) {
    return this.run(async () => {
      for (const [k, v] of Object.entries(opts)) this.send(`setoption name ${k} value ${v}`);
      await this.ready();
    });
  }
  newGame() { return this.run(async () => { this.send('ucinewgame'); await this.ready(); }); }
  // Ritorna { bestmove, cp, mate, depth, pv } con il punteggio dal punto di vista di chi muove.
  // opts.onInfo riceve la valutazione man mano che la ricerca procede; opts.token.cancelled salta la ricerca.
  search(fen, go, opts = {}) {
    return this.run(async () => {
      if (opts.token && opts.token.cancelled) return null;
      const info = { cp: 0, mate: null, depth: 0, pv: [], real: null };
      let rd = -1, rsd = -1;
      const f = l => {
        if (!l.startsWith('info ') || !l.includes(' pv ') || l.includes('lowerbound') || l.includes('upperbound')) return;
        const t = l.split(' ');
        const mp = t.indexOf('multipv');
        if (mp >= 0 && t[mp + 1] !== '1') return;
        const d = t.indexOf('depth'); if (d >= 0) info.depth = +t[d + 1];
        const s = t.indexOf('score');
        if (s >= 0) {
          if (t[s + 1] === 'cp') { info.cp = +t[s + 2]; info.mate = null; }
          else if (t[s + 1] === 'mate') { info.mate = +t[s + 2]; info.cp = info.mate > 0 ? 100000 - info.mate : -100000 - info.mate; }
        }
        info.pv = t.slice(t.indexOf('pv') + 1);
        // Con forza limitata Stockfish chiude con una riga fittizia (la mossa scelta, punteggio 0):
        // come valutazione vera si tiene la riga più profonda.
        const sd = +t[t.indexOf('seldepth') + 1] || 0;
        if (info.depth > rd || (info.depth === rd && sd > rsd)) {
          rd = info.depth; rsd = sd; info.real = { cp: info.cp, mate: info.mate };
          if (opts.onInfo) try { opts.onInfo({ cp: info.cp, mate: info.mate, depth: info.depth, pv: info.pv }); } catch { /* */ }
        }
      };
      this.listeners.push(f);
      this.send('position fen ' + fen);
      this.send(go);
      const bm = await this.waitFor(l => l.startsWith('bestmove'));
      this.off(f);
      info.bestmove = bm.split(' ')[1];
      if (!info.real) info.real = { cp: info.cp, mate: info.mate };
      return info;
    });
  }
  // Più linee (con MultiPV impostato): [{pv, cp, mate}] dal punto di vista di chi muove.
  searchMulti(fen, go) {
    return this.run(async () => {
      const lines = {};
      const f = l => {
        if (!l.startsWith('info ') || !l.includes(' pv ') || l.includes('bound')) return;
        const t = l.split(' ');
        const mp = t.indexOf('multipv'); const n = mp >= 0 ? +t[mp + 1] : 1;
        const s = t.indexOf('score'); if (s < 0) return;
        const mate = t[s + 1] === 'mate' ? +t[s + 2] : null;
        const cp = mate === null ? +t[s + 2] : (mate > 0 ? 100000 - mate : -100000 - mate);
        lines[n] = { pv: t.slice(t.indexOf('pv') + 1), cp, mate };
      };
      this.listeners.push(f);
      this.send('position fen ' + fen); this.send(go);
      await this.waitFor(l => l.startsWith('bestmove'));
      this.off(f);
      return Object.keys(lines).sort((a, b) => a - b).map(k => lines[k]);
    });
  }
  stop() { this.send('stop'); }
}

let enginePromise = null;
export function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const w = await loadFromCache();
      if (!w) throw new Error('MOTORE_ASSENTE');
      const e = new Engine(w);
      w.onerror = () => { enginePromise = null; };
      await e.init();
      return e;
    })().catch(err => { enginePromise = null; throw err; });
  }
  return enginePromise;
}
export function resetEngine() { enginePromise = null; }

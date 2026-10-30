// Puzzle: archivio incorporato (Lichess, licenza CC0), puzzle dai propri errori e ripetizione spaziata.
import { Chess } from './chess.js';
import { markActive } from './path.js';

export const THEME_IT = {
  fork: 'Forchetta', pin: 'Inchiodatura', skewer: 'Infilata', discoveredAttack: 'Attacco di scoperta',
  doubleCheck: 'Scacco doppio', hangingPiece: 'Pezzo indifeso', trappedPiece: 'Pezzo intrappolato',
  deflection: 'Deviazione', attraction: 'Adescamento', sacrifice: 'Sacrificio', capturingDefender: 'Eliminazione del difensore',
  intermezzo: 'Mossa intermedia', interference: 'Interferenza', clearance: 'Sgombero', xRayAttack: 'Attacco ai raggi X',
  quietMove: 'Mossa tranquilla', defensiveMove: 'Mossa difensiva', mateIn1: 'Matto in 1', mateIn2: 'Matto in 2',
  mateIn3: 'Matto in 3', mateIn4: 'Matto in 4', mate: 'Matto', backRankMate: 'Matto sulla traversa', smotheredMate: 'Matto affogato',
  promotion: 'Promozione', advancedPawn: 'Pedone avanzato', exposedKing: 'Re esposto', kingsideAttack: 'Attacco sul lato di re',
  queensideAttack: 'Attacco sul lato di donna', rookEndgame: 'Finale di torri', pawnEndgame: 'Finale di pedoni',
  queenEndgame: 'Finale di donne', bishopEndgame: "Finale d'alfieri", knightEndgame: 'Finale di cavalli',
  zugzwang: 'Zugzwang', study: 'Lezione', opening: 'Apertura', middlegame: 'Mediogioco', endgame: 'Finale',
  crushing: 'Vantaggio decisivo', advantage: 'Vantaggio', equality: 'Pareggiare', short: 'Breve', long: 'Lungo',
  veryLong: 'Molto lungo', oneMove: 'Una mossa', master: 'Partita di maestri', personal: 'Tuo errore',
};
export const TRAIN_THEMES = ['fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'hangingPiece', 'trappedPiece',
  'deflection', 'attraction', 'sacrifice', 'capturingDefender', 'intermezzo', 'interference', 'clearance', 'xRayAttack',
  'quietMove', 'defensiveMove', 'mateIn1', 'mateIn2', 'mateIn3', 'backRankMate', 'smotheredMate', 'promotion',
  'advancedPawn', 'exposedKing', 'kingsideAttack', 'rookEndgame', 'pawnEndgame', 'queenEndgame', 'bishopEndgame',
  'knightEndgame', 'zugzwang', 'opening', 'middlegame', 'endgame'];

// Dai tipi di errore delle partite ai temi da allenare.
const ERROR_THEMES = {
  'Pezzo lasciato in presa': ['hangingPiece', 'defensiveMove', 'trappedPiece'],
  'Materiale perso per tattica': ['fork', 'pin', 'skewer', 'discoveredAttack', 'defensiveMove'],
  'Tattica mancata': ['fork', 'pin', 'skewer', 'discoveredAttack', 'deflection', 'attraction', 'hangingPiece', 'capturingDefender'],
  'Matto mancato': ['mateIn1', 'mateIn2', 'mateIn3', 'backRankMate'],
  'Matto concesso': ['defensiveMove', 'exposedKing', 'backRankMate', 'mateIn2'],
  'Errore nel finale': ['rookEndgame', 'pawnEndgame', 'endgame', 'promotion', 'zugzwang'],
  "Errore d'apertura": ['opening', 'trappedPiece', 'exposedKing'],
  'Errore posizionale': ['quietMove', 'defensiveMove', 'middlegame'],
};

const DAY = 86400000;
const INTERVALS = [1, 3, 7, 14, 30, 60]; // giorni

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let DB = null;
export async function loadDB() {
  if (!DB) {
    const r = await fetch('puzzles.json');
    DB = (await r.json()).map(([id, fen, moves, rating, themes]) => ({ id, fen, moves: moves.split(' '), rating, themes: themes.split(' ') }));
  }
  return DB;
}

export const pzState = () => load('pz-state', {});      // id -> { box, due, tries, ok, last }
export const pzRating = () => load('pz-rating', { r: 1400, hist: [] });
export const personal = () => load('pz-personal', []);  // puzzle dai propri errori
export const studyItems = () => load('pz-study', []);   // esercizi delle lezioni completate
export function addStudyItems(items) {
  const list = studyItems(); const have = new Set(list.map(x => x.id));
  for (const it of items) if (!have.has(it.id)) list.push(it);
  save('pz-study', list);
  // entrano subito nel ripasso: tornano domani
  const st = pzState();
  for (const it of items) if (!st[it.id]) st[it.id] = { box: 0, tries: 0, ok: 0, due: Date.now() + 20 * 3600000 };
  save('pz-state', st);
}

// Crea un puzzle per ogni errore o errore grave della partita analizzata.
export function addPersonalFromGame(g) {
  if (!g.analysis) return 0;
  const list = personal();
  const have = new Set(list.map(p => p.id));
  let n = 0;
  for (const m of g.analysis.moves) {
    if (m.mover !== g.color || !(m.cls === 'mistake' || m.cls === 'blunder') || !m.best) continue;
    const id = `g${g.id}-${m.i}`;
    if (have.has(id)) continue;
    list.push({
      id, fen: m.fenBefore, best: m.best, line: [m.best], cp: m.evalBefore.cp * (m.mover === 'w' ? 1 : -1),
      played: m.uci, san: m.san, type: m.type, phase: m.phase, gameId: g.id, ply: m.i,
      themes: ['personal', ...(ERROR_THEMES[m.type] || []).slice(0, 2)], rating: null, personal: true,
    });
    n++;
  }
  save('pz-personal', list);
  return n;
}

export function dueCount() {
  const st = pzState(), now = Date.now();
  return Object.values(st).filter(s => s.due <= now).length;
}

// Esito di un puzzle: aggiorna ripetizione spaziata e rating.
export function recordResult(p, solved, usedHint) {
  const st = pzState();
  const s = st[p.id] || { box: -1, tries: 0, ok: 0 };
  const firstTime = s.tries === 0;
  s.tries++; s.last = Date.now();
  markActive();
  if (solved && !usedHint) {
    s.ok++;
    // risolto subito al primo incontro: si dirada (30 giorni); altrimenti si sale di un gradino
    s.box = firstTime && !p.study && !p.personal ? 4 : Math.min(INTERVALS.length - 1, s.box + 1);
  } else {
    s.box = 0;
  }
  s.due = Date.now() + INTERVALS[Math.max(0, s.box)] * DAY - 3600000; // torna il giorno indicato
  st[p.id] = s;
  save('pz-state', st);
  let delta = 0;
  if (p.rating && firstTime) {
    const R = pzRating();
    const exp = 1 / (1 + 10 ** ((p.rating - R.r) / 400));
    const K = R.hist.length < 30 ? 40 : 20;
    delta = Math.round(K * ((solved && !usedHint ? 1 : 0) - exp));
    R.r += delta;
    R.hist.push([Date.now(), R.r]);
    if (R.hist.length > 1000) R.hist.shift();
    save('pz-rating', R);
  }
  const log = load('pz-log', []);
  log.push({ id: p.id, t: Date.now(), ok: solved && !usedHint, themes: p.themes });
  if (log.length > 5000) log.splice(0, log.length - 5000);
  save('pz-log', log);
  return { delta, next: s.due };
}

// Temi su cui insistere, ricavati dagli errori delle partite e dai puzzle sbagliati.
export function weakThemes(games) {
  const w = {};
  for (const g of games) if (g.analysis) for (const m of g.analysis.moves) {
    if (m.mover !== g.color || !(m.cls === 'mistake' || m.cls === 'blunder')) continue;
    for (const t of ERROR_THEMES[m.type] || []) w[t] = (w[t] || 0) + (m.cls === 'blunder' ? 2 : 1);
  }
  const log = load('pz-log', []).slice(-400);
  const tot = {}, bad = {};
  for (const e of log) for (const t of e.themes) { if (!TRAIN_THEMES.includes(t)) continue; tot[t] = (tot[t] || 0) + 1; if (!e.ok) bad[t] = (bad[t] || 0) + 1; }
  for (const t in tot) if (tot[t] >= 4) w[t] = (w[t] || 0) + 4 * bad[t] / tot[t];
  return Object.entries(w).sort((a, b) => b[1] - a[1]).map(e => e[0]);
}

export function themeStats() {
  const log = load('pz-log', []);
  const s = {};
  for (const e of log) for (const t of e.themes) {
    if (!TRAIN_THEMES.includes(t)) continue;
    s[t] = s[t] || { n: 0, ok: 0 };
    s[t].n++; if (e.ok) s[t].ok++;
  }
  return s;
}

// Sessione del giorno: ripassi in scadenza, poi i propri errori nuovi, poi puzzle nuovi sui punti deboli.
export async function buildSession(games, { theme = null, size = 40 } = {}) {
  const db = await loadDB();
  const st = pzState(), now = Date.now();
  const R = pzRating().r;
  const pers = personal();
  const byId = new Map(db.map(p => [p.id, p]));
  for (const p of pers) byId.set(p.id, p);
  for (const p of studyItems()) byId.set(p.id, p);
  const queue = [];
  const used = new Set();
  const push = p => { if (p && !used.has(p.id)) { used.add(p.id); queue.push(p); } };
  if (!theme) {
    Object.entries(st).filter(([, s]) => s.due <= now).sort((a, b) => a[1].due - b[1].due)
      .forEach(([id]) => push(byId.get(id)));
    pers.filter(p => !st[p.id]).slice(-6).forEach(push);
  }
  const fresh = p => !st[p.id] && Math.abs(p.rating - R) <= 175;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  if (theme) {
    let pool = db.filter(p => p.themes.includes(theme) && fresh(p));
    if (pool.length < 10) pool = db.filter(p => p.themes.includes(theme) && !st[p.id]);
    shuffle(pool).slice(0, size).forEach(push);
  } else {
    const weak = weakThemes(games).slice(0, 4);
    const pool = shuffle(db.filter(fresh));
    // metà sui temi deboli, metà varia
    for (const p of pool) {
      if (queue.length >= size) break;
      const isWeak = p.themes.some(t => weak.includes(t));
      if (isWeak || queue.filter(q => !q.personal).length % 2 === 1 || !weak.length) push(p);
    }
  }
  return queue.slice(0, size);
}

// Il puzzle si gioca a partire dalla posizione in cui tocca a chi risolve.
export function startPosition(p) {
  if (p.personal || p.study) return { fen: p.fen, solution: p.line, intro: null };
  const c = new Chess(p.fen);
  const u = p.moves[0];
  c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  return { fen: c.fen(), solution: p.moves.slice(1), intro: { from: u.slice(0, 2), to: u.slice(2, 4), fenBefore: p.fen } };
}

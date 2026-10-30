// Il professore: diagnosi delle fasi deboli e lezioni su misura sull'apertura di una partita.
import { Chess } from './chess.js';
import { itSan, winPct } from './analysis.js';
import { loadOpenings, identify, variations } from './openings.js';

export const PHASES = ['Apertura', 'Mediogioco', 'Finale'];

// Per ogni fase: mosse giocate, perdita media di probabilità di vittoria, errori.
export function phaseStats(g) {
  const out = {};
  for (const p of PHASES) out[p] = { n: 0, loss: 0, err: 0 };
  if (!g.analysis) return out;
  for (const m of g.analysis.moves) {
    if (m.mover !== g.color) continue;
    const o = out[m.phase]; if (!o) continue;
    o.n++; o.loss += m.loss;
    if (m.cls === 'mistake' || m.cls === 'blunder') o.err++;
  }
  for (const p of PHASES) out[p].avg = out[p].n ? out[p].loss / out[p].n : 0;
  return out;
}

// Fase più debole sulle ultime partite analizzate (almeno 3 mosse giocate in quella fase).
export function weakestPhase(games, k = 5) {
  const an = games.filter(g => g.analysis).slice(0, k);
  const tot = {}; for (const p of PHASES) tot[p] = { n: 0, loss: 0, err: 0 };
  for (const g of an) { const s = phaseStats(g); for (const p of PHASES) { tot[p].n += s[p].n; tot[p].loss += s[p].loss; tot[p].err += s[p].err; } }
  let best = null;
  for (const p of PHASES) {
    tot[p].avg = tot[p].n ? tot[p].loss / tot[p].n : 0;
    if (tot[p].n >= 3 && (!best || tot[p].avg > tot[best].avg)) best = p;
  }
  return { phase: best, table: tot, games: an.length };
}

export const PHASE_ADVICE = {
  Apertura: "Ripassa l'apertura giocata in questa partita: le mosse di teoria, le varianti principali e il punto in cui l'hai lasciata.",
  Mediogioco: 'Lavora sui motivi tattici e sui piani del mediogioco: è lì che hai perso più punti.',
  Finale: 'Allenati sui finali: tecnica di base e calcolo dei tempi.',
};

const uci = m => m.from + m.to + (m.promotion || '');

// Lezione su misura sull'apertura (o difesa) giocata in una partita.
// Le mosse e i nomi vengono dal database aperture; le valutazioni da Stockfish.
export async function buildOpeningLesson(g, getEngine, onStatus = () => {}) {
  await loadOpenings();
  const me = g.color;
  const id = identify(g.moves);
  const theoryPly = id ? id.ply : Math.min(6, g.moves.length);
  const title = id ? id.nameIt : 'Apertura della partita';
  const eng = await getEngine();
  await eng.configure({ 'UCI_LimitStrength': 'false', 'Skill Level': 20, 'MultiPV': 1 });
  const steps = [];
  const sideTxt = me === 'w' ? 'hai giocato con il Bianco' : 'hai difeso con il Nero';
  steps.push({ t: 'text', moves: '', text: id
    ? `In questa partita ${sideTxt} e l'apertura è stata la ${id.nameIt} (codice ECO ${id.eco}). Ripassiamo le mosse di teoria, il punto in cui la partita ne è uscita e le varianti principali.`
    : `In questa partita ${sideTxt}. L'apertura non corrisponde a una linea del database: guardiamo le prime mosse con Stockfish.` });

  // 1. Le mosse di teoria giocate in partita, con il nome della linea quando cambia.
  onStatus('Ricostruisco la teoria…');
  await loadOpenings();
  const notes = [];
  let lastName = '';
  for (let i = 0; i < theoryPly; i++) {
    const here = identify(g.moves.slice(0, i + 1));
    const nm = here && here.ply === i + 1 ? here.nameIt : '';
    notes.push(nm && nm !== lastName ? `Linea: ${nm}.` : (i === theoryPly - 1 ? 'Fine della teoria del database per questa partita.' : ''));
    if (nm) lastName = nm;
  }
  if (theoryPly > 0) steps.push({ t: 'line', moves: '', line: g.moves.slice(0, theoryPly).join(' '), notes, text: 'Le mosse di teoria giocate in partita.' });

  // 2. Il primo punto in cui hai perso terreno nelle prime mosse (fino a 6 semimosse dopo la teoria).
  onStatus('Cerco il punto in cui la partita ha lasciato la strada migliore…');
  const c = new Chess();
  const limit = Math.min(g.moves.length, theoryPly + 6, 24);
  let dev = null;
  for (let i = 0; i < limit; i++) {
    const fen = c.fen();
    const mover = c.turn();
    const m = c.move(g.moves[i]);
    if (mover !== me) continue;
    const a = await eng.search(fen, 'go depth 12 movetime 1200');
    const b = await eng.search(c.fen(), 'go depth 12 movetime 1200');
    const lossCp = a.cp - (-b.cp);
    if (lossCp >= 60 && winPct(a.cp) - winPct(-b.cp) >= 5) {
      dev = { i, fen, played: m, best: a.bestmove, bestCp: a.cp, playedCp: -b.cp, sans: g.moves.slice(0, i) };
      break;
    }
  }
  if (dev) {
    const bm = new Chess(dev.fen).move({ from: dev.best.slice(0, 2), to: dev.best.slice(2, 4), promotion: dev.best[4] });
    const n = Math.floor(dev.i / 2) + 1;
    steps.push({ t: 'text', moves: dev.sans.join(' '), arrows: [[dev.played.from, dev.played.to, 'r'], [bm.from, bm.to, 'g']],
      text: `Alla mossa ${n} hai giocato ${itSan(dev.played.san)}. Stockfish preferisce ${itSan(bm.san)} (freccia verde): con la tua mossa la valutazione per te scende da ${(dev.bestCp / 100).toFixed(1)} a ${(dev.playedCp / 100).toFixed(1)}.` });
    steps.push({ t: 'find', moves: dev.sans.join(' '), text: 'Ora trova tu la mossa migliore in questa posizione.', solution: bm.san, ok: `Esatto, ${itSan(bm.san)}.` });
  } else {
    steps.push({ t: 'text', moves: g.moves.slice(0, Math.min(theoryPly, g.moves.length)).join(' '), text: "Nelle prime mosse non hai perso terreno in modo significativo secondo Stockfish: l'apertura è stata giocata bene." });
  }

  // 3. Le varianti principali a partire da qualche mossa prima della fine della teoria.
  onStatus('Scelgo le varianti principali…');
  const base = Math.max(2, Math.min(theoryPly, 8) - 2);
  const vars = variations(g.moves.slice(0, base), 6, 10).filter(v => v.moves.join(' ') !== g.moves.slice(0, v.moves.length).join(' '));
  let added = 0;
  for (const v of vars) {
    if (added >= 3) break;
    const end = new Chess(); for (const s of v.moves) end.move(s);
    const r = await eng.search(end.fen(), 'go depth 12 movetime 1000');
    const forMe = (end.turn() === me ? 1 : -1) * r.cp;
    if (forMe < -120) continue;
    const rest = v.moves.slice(base);
    const nts = rest.map((_, j) => j === rest.length - 1 ? `${v.nameIt}. Valutazione di Stockfish per te: ${(forMe / 100).toFixed(1)}.` : '');
    steps.push({ t: 'line', moves: v.moves.slice(0, base).join(' '), line: rest.join(' '), notes: nts, text: `Variante: ${v.nameIt}.` });
    added++;
  }

  // 4. Le mosse candidate alla fine della teoria.
  onStatus('Calcolo le mosse candidate…');
  const tEnd = new Chess(); for (const s of g.moves.slice(0, theoryPly)) tEnd.move(s);
  if (!tEnd.isGameOver()) {
    await eng.configure({ 'MultiPV': 3 });
    const lines = await eng.searchMulti(tEnd.fen(), 'go depth 14 movetime 2500');
    await eng.configure({ 'MultiPV': 1 });
    const t = tEnd.turn();
    const mine = t === me;
    const cand = lines.slice(0, 3).map(l => { const x = new Chess(tEnd.fen()); const m = x.move({ from: l.pv[0].slice(0, 2), to: l.pv[0].slice(2, 4), promotion: l.pv[0][4] }); return { m, cp: (mine ? 1 : -1) * l.cp }; });
    steps.push({ t: 'text', moves: g.moves.slice(0, theoryPly).join(' '), arrows: cand.map((x, k) => [x.m.from, x.m.to, k === 0 ? 'g' : 'b']),
      text: `${mine ? 'Le tue mosse candidate' : "Le risposte migliori dell'avversario"} alla fine della teoria, secondo Stockfish: ${cand.map(x => `${itSan(x.m.san)} (${(x.cp / 100).toFixed(1)} per te)`).join(', ')}.` });
  }

  // 5. Ripetizione: le tue mosse di teoria, da trovare a memoria.
  const drill = new Chess();
  let finds = 0;
  const drillEnd = dev ? Math.min(theoryPly, dev.i) : theoryPly;
  for (let i = 0; i < drillEnd && finds < 4; i++) {
    const t = drill.turn();
    const before = g.moves.slice(0, i).join(' ');
    drill.move(g.moves[i]);
    if (t !== me || i < 2) continue;
    steps.push({ t: 'find', moves: before, text: 'Ripeti la teoria: quale mossa si gioca qui?', solution: g.moves[i], ok: 'Giusto, è la mossa di teoria.' });
    finds++;
  }

  return { id: `op-${g.id}`, stage: 1, cat: 'ap', side: me, title: `La tua apertura: ${title}`, goal: 'Lezione costruita sulla partita appena giocata.', steps, generated: true, opening: id };
}

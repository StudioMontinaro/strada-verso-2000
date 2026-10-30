// Logica di analisi: classificazione delle mosse e tipo di errore.
import { Chess } from './chess.js';

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function winPct(cp) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
export function moveAccuracy(loss) {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
}

// Notazione italiana: R re, D donna, T torre, A alfiere, C cavallo.
export function itSan(san) {
  return (san || '').replace(/[KQRBN]/g, c => ({ K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' }[c]));
}

export function material(fen, color) {
  let s = 0;
  for (const ch of fen.split(' ')[0]) {
    const p = ch.toLowerCase();
    if (!(p in VAL)) continue;
    const own = (ch === p ? 'b' : 'w') === color;
    s += own ? VAL[p] : -VAL[p];
  }
  return s;
}

function pieceCount(fen) {
  let n = 0;
  for (const ch of fen.split(' ')[0]) if ('nbrqNBRQ'.includes(ch)) n++;
  return n;
}

export function phaseOf(fen, ply) {
  if (pieceCount(fen) <= 6) return 'Finale';
  if (ply < 20) return 'Apertura';
  return 'Mediogioco';
}

function playLine(fen, uciList, plies) {
  const c = new Chess(fen);
  const played = [];
  for (const u of (uciList || []).slice(0, plies)) {
    try { played.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })); }
    catch { break; }
  }
  return { fen: c.fen(), moves: played };
}

export function pvToSan(fen, uciList, plies = 8) {
  return playLine(fen, uciList, plies).moves.map(m => m.san);
}

// Valutazione dal punto di vista del bianco.
export function whitePov(info, fen) {
  const turn = fen.split(' ')[1];
  const s = turn === 'w' ? 1 : -1;
  return {
    cp: s * info.cp,
    mate: info.mate === null || info.mate === undefined ? null : s * info.mate,
    best: info.bestmove,
    pv: info.pv || [],
    depth: info.depth,
  };
}

// Valutazione di una posizione finale (matto o patta) senza motore.
export function terminalEval(fen) {
  const c = new Chess(fen);
  if (c.isCheckmate()) {
    const whiteMated = c.turn() === 'w';
    return { cp: whiteMated ? -100000 : 100000, mate: 0, mated: c.turn(), best: null, pv: [], depth: 0 };
  }
  if (c.isDraw() || c.isStalemate()) return { cp: 0, mate: null, best: null, pv: [], depth: 0, draw: true };
  return null;
}

const CLS = [
  [15, 'blunder', 'Errore grave', '??'],
  [10, 'mistake', 'Errore', '?'],
  [5, 'inacc', 'Imprecisione', '?!'],
];

export function classifyGame(game, evals) {
  const fens = [new Chess().fen()];
  const c = new Chess();
  const ucis = [];
  for (const san of game.moves) {
    const m = c.move(san);
    ucis.push(m.from + m.to + (m.promotion || ''));
    fens.push(c.fen());
  }
  const out = [];
  for (let i = 0; i < game.moves.length; i++) {
    const mover = i % 2 === 0 ? 'w' : 'b';
    const sg = mover === 'w' ? 1 : -1;
    const E0 = evals[i], E1 = evals[i + 1];
    const wb = winPct(sg * E0.cp), wa = winPct(sg * E1.cp);
    const isBest = E0.best && E0.best === ucis[i];
    let loss = isBest ? 0 : Math.max(0, wb - wa);
    const mateFor = E => (E.mate === null || E.mate === undefined ? 0 : (E.mated ? (E.mated === mover ? -1 : 1) : Math.sign(E.mate) * sg));
    const hadMate = mateFor(E0) > 0 && E0.mate !== 0;
    const keepsMate = mateFor(E1) > 0;
    const allowsMate = mateFor(E1) < 0 && mateFor(E0) >= 0;
    const missedMate = hadMate && !keepsMate;
    if (missedMate && loss < 10) loss = Math.max(loss, 10);
    let cls = isBest ? 'best' : 'good', label = isBest ? 'Migliore' : 'Buona', sym = '';
    for (const [t, k, l, s] of CLS) if (loss >= t) { cls = k; label = l; sym = s; break; }
    const phase = phaseOf(fens[i], i);
    let type = null;
    if (cls === 'mistake' || cls === 'blunder' || missedMate) {
      if (allowsMate) type = 'Matto concesso';
      else if (missedMate) type = 'Matto mancato';
      else {
        const after = material(fens[i + 1], mover);
        const refut = playLine(fens[i + 1], E1.pv, 4);
        const refutMat = material(refut.fen, mover);
        const bestLine = playLine(fens[i], E0.pv, 5);
        const gain = material(bestLine.fen, mover) - material(fens[i], mover);
        const playedGain = after - material(fens[i], mover);
        if (refutMat <= after - 2) {
          const playedTo = ucis[i].slice(2, 4);
          const takesIt = refut.moves.slice(0, 3).some((m, k) => k % 2 === 0 && m.captured && m.to === playedTo);
          type = takesIt ? 'Pezzo lasciato in presa' : 'Materiale perso per tattica';
        } else if (gain - playedGain >= 2) type = 'Tattica mancata';
        else if (phase === 'Finale') type = 'Errore nel finale';
        else if (phase === 'Apertura') type = "Errore d'apertura";
        else type = 'Errore posizionale';
      }
    }
    const timeLeft = game.times ? game.times[i] : null;
    out.push({
      i, san: game.moves[i], uci: ucis[i], mover, loss: Math.round(loss * 10) / 10,
      cls, label, sym, type, phase,
      zeit: timeLeft !== null && timeLeft !== undefined && timeLeft < 15000 && (cls === 'mistake' || cls === 'blunder'),
      acc: moveAccuracy(loss),
      best: E0.best, bestSan: E0.best ? pvToSan(fens[i], [E0.best], 1)[0] : null,
      bestLine: pvToSan(fens[i], E0.pv, 8),
      refutation: pvToSan(fens[i + 1], E1.pv, 6),
      fenBefore: fens[i], fenAfter: fens[i + 1],
      evalBefore: E0, evalAfter: E1,
    });
  }
  return out;
}

export function gameAccuracy(moves, color) {
  const m = moves.filter(x => x.mover === color);
  if (!m.length) return null;
  return Math.round(m.reduce((s, x) => s + x.acc, 0) / m.length);
}

export function fmtEval(E) {
  if (!E) return '';
  if (E.mated) return E.mated === 'w' ? '0-1' : '1-0';
  if (E.mate !== null && E.mate !== undefined) return (E.mate > 0 ? '#' : '#-') + Math.abs(E.mate);
  const v = E.cp / 100;
  return (v > 0 ? '+' : '') + v.toFixed(1);
}

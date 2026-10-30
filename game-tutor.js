// Il tutor commenta una partita intera: apertura, momenti chiave, errori tuoi e dell'avversario, verdetto finale.
// Tutto deriva dall'analisi di Stockfish già fatta (g.analysis): nessun dato inventato.
import { Chess } from './chess.js';
import { itSan, gameAccuracy } from './analysis.js';
import { phaseStats, PHASES, PHASE_ADVICE } from './coach.js';
import { loadOpenings, identify } from './openings.js';
import { speakable } from './speech.js';
import { RULES } from './tutor.js';

const num = m => `${Math.floor(m.i / 2) + 1}${m.mover === 'w' ? '.' : '…'}`;
const BAD = m => m.cls === 'mistake' || m.cls === 'blunder';
const pct = x => Math.round(x);

export async function gameLesson(g, opp = "l'avversario") {
  await loadOpenings();
  const A = g.analysis, M = A.moves, me = g.color;
  const start = new Chess().fen();
  const S = [];
  const add = (fen, text, tag, mood, extra = {}) => S.push({ fen, text, speech: speakable(text), tag, mood, jump: true, ...extra });
  const col = me === 'w' ? 'Bianco' : 'Nero';
  const res = g.outcome === 'w' ? 'Hai vinto' : g.outcome === 'l' ? 'Hai perso' : 'È finita patta';
  add(start, `Partita contro ${opp}, con il ${col}. ${res}${g.why ? ` (${g.why.toLowerCase()})` : ''}. Ora la rivediamo insieme, dall'inizio alla fine.`, 'La partita', null);

  // apertura
  const op = identify(g.moves);
  if (op) {
    const c = new Chess(); for (const s of g.moves.slice(0, op.ply)) c.move(s);
    add(c.fen(), `Apertura: ${op.nameIt} (${op.eco}). La linea di teoria arriva fino alla mossa ${Math.ceil(op.ply / 2)}.`, 'Apertura', null);
  }

  // fase più debole
  const st = phaseStats(g);
  const valid = PHASES.filter(p => st[p].n >= 3);
  const worst = [...valid].sort((a, b) => st[b].avg - st[a].avg)[0];

  // momenti chiave in ordine di partita
  const mineBad = M.filter(m => m.mover === me && BAD(m)).sort((a, b) => b.loss - a.loss).slice(0, 3);
  const oppBad = M.filter(m => m.mover !== me && BAD(m));
  const punished = [], missed = [];
  for (const o of oppBad) {
    const r = M[o.i + 1];
    if (!r || r.mover !== me) continue;
    (r.cls === 'best' || r.cls === 'good' ? punished : missed).push({ o, r });
  }
  const moments = [
    ...mineBad.map(m => ({ i: m.i, kind: 'mine', m })),
    ...punished.sort((a, b) => b.o.loss - a.o.loss).slice(0, 2).map(x => ({ i: x.o.i, kind: 'punish', ...x })),
    ...missed.sort((a, b) => b.o.loss - a.o.loss).slice(0, 2).map(x => ({ i: x.o.i, kind: 'miss', ...x })),
  ].sort((a, b) => a.i - b.i);

  for (const k of moments) {
    if (k.kind === 'mine') {
      const m = k.m;
      add(m.fenBefore, `Mossa ${num(m)} ${itSan(m.san)}: ${m.label.toLowerCase()}. Qui perdi circa ${pct(m.loss)} punti di probabilità di vittoria${m.type ? ` (${m.type.toLowerCase()})` : ''}${m.zeit ? ', e l\'hai giocata con poco tempo' : ''}.`, 'Il tuo errore', 'bad', { arrows: [{ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), color: '#e2504c' }] });
      if (m.best && m.best !== m.uci) add(m.fenBefore, `Era meglio ${itSan(m.bestSan)}. ${RULES[m.type] || ''}`.trim(), 'La mossa giusta', 'good', { arrows: [{ from: m.best.slice(0, 2), to: m.best.slice(2, 4), color: '#4caf7d' }] });
    } else if (k.kind === 'punish') {
      const { o, r } = k;
      add(r.fenBefore, `Mossa ${num(o)} ${itSan(o.san)}: ${opp} sbaglia. E tu rispondi bene con ${itSan(r.san)}. Bravo: i regali dell'avversario vanno incassati.`, 'Bene', 'good', { arrows: [{ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), color: '#4caf7d' }] });
    } else {
      const { o, r } = k;
      add(r.fenBefore, `Mossa ${num(o)} ${itSan(o.san)}: ${opp} sbaglia, ma tu non ne approfitti: giochi ${itSan(r.san)}${r.bestSan && r.best !== r.uci ? `, mentre era forte ${itSan(r.bestSan)}` : ''}. Occasione sprecata.`, 'Occasione persa', 'bad', r.best ? { arrows: [{ from: r.best.slice(0, 2), to: r.best.slice(2, 4), color: '#4caf7d' }] } : {});
    }
  }
  if (!moments.length) add(M.at(-1)?.fenAfter || start, 'Nessun errore grave da nessuna delle due parti: una partita pulita.', 'Momenti chiave', 'good');

  // verdetto: chi vince e chi perde
  const last = M.at(-1)?.fenAfter || start;
  const aMe = gameAccuracy(M, me), aOp = gameAccuracy(M, me === 'w' ? 'b' : 'w');
  const nMe = M.filter(m => m.mover === me && BAD(m)).length, nOp = oppBad.length;
  let verdict;
  if (g.outcome === 'w') verdict = `Vittoria tua. Precisione ${aMe}% contro ${aOp}%. Errori gravi: ${nMe} tuoi, ${nOp} di ${opp}.`;
  else if (g.outcome === 'l') verdict = `Sconfitta. Precisione ${aMe}% contro ${aOp}%. Errori gravi: ${nMe} tuoi, ${nOp} di ${opp}.`;
  else verdict = `Patta. Precisione ${aMe}% contro ${aOp}%. Errori gravi: ${nMe} tuoi, ${nOp} di ${opp}.`;
  add(last, verdict, 'Chi vince e chi perde', g.outcome === 'w' ? 'good' : g.outcome === 'l' ? 'bad' : null, { keepLast: false });

  // cosa lavorare
  const types = {}; for (const m of M) if (m.mover === me && BAD(m) && m.type) types[m.type] = (types[m.type] || 0) + 1;
  const topType = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
  const zeit = M.filter(m => m.mover === me && m.zeit).length;
  const adv = [];
  if (worst && st[worst].err) adv.push(`La fase in cui hai perso più punti è: ${worst.toLowerCase()}. ${PHASE_ADVICE[worst]}`);
  if (topType) adv.push(`L'errore più frequente: ${topType[0].toLowerCase()} (${topType[1]} ${topType[1] === 1 ? 'volta' : 'volte'}). ${RULES[topType[0]] || ''}`);
  if (zeit >= 2) adv.push(`In ${zeit} mosse hai giocato con meno di 15 secondi: gestisci meglio il tempo.`);
  if (!adv.length) adv.push('Continua così: gioca, rivedi, e porta le tue partite nelle sessioni di studio.');
  add(start, adv.join(' '), 'Da lavorare', null);
  return S;
}

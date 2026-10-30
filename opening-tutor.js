// Il tutor spiega a voce una linea d'apertura prima che tu la impari a memoria.
// Niente è inventato: i nomi (apertura, variante, gambetto, codice ECO) vengono dal database aperture di Lichess,
// l'idea generale dal testo del modulo del repertorio, e il motivo di ogni mossa è calcolato dalla posizione
// (sviluppo, centro, catture, scacchi, inchiodature, pezzi attaccati o difesi, arrocco, linee aperte).
import { Chess } from './chess.js';
import { itSan } from './analysis.js';
import { namesAlong, identify } from './openings.js';
import { speakable, spokenSquare } from './speech.js';

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const ART = { p: 'il pedone', n: 'il cavallo', b: "l'alfiere", r: 'la torre', q: 'la donna', k: 're' };
const SIDE = { w: 'Bianco', b: 'Nero' };
const HOME = { w: { n: ['b1', 'g1'], b: ['c1', 'f1'], q: ['d1'] }, b: { n: ['b8', 'g8'], b: ['c8', 'f8'], q: ['d8'] } };
const CENTER = ['d4', 'e4', 'd5', 'e5'];
// Nomi generici che non aggiungono informazione mentre si scorre la linea.
const SKIP = new Set(["King's Pawn Game", "Queen's Pawn Game", "King's Knight Opening", "King's Knight Opening: Normal Variation", 'French Defense: Normal Variation']);

const ref = (t, sq) => `${ART[t]} in ${sq}`;
const listIt = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + (/^[eè]/i.test(a[a.length - 1]) ? ' ed ' : ' e ') + a[a.length - 1];
const pieceAt = (c, sq) => c.get(sq) || null;

// Pezzi che attaccano una casa (solo il loro elenco di case).
const att = (c, sq, color) => { try { return c.attackers(sq, color); } catch { return []; } };

// Mosse possibili di un pezzo come se toccasse al suo colore (per misurare le linee che si aprono).
function mobility(fen, sq, color) {
  const parts = fen.split(' '); parts[1] = color; parts[3] = '-';
  try { const c = new Chess(parts.join(' ')); return c.moves({ square: sq }).length; } catch { return null; }
}

// Inchiodatura: il pezzo appena mosso (alfiere, torre o donna) attacca un pezzo che copre il re o la donna.
function pinFrom(c, m) {
  const piece = m.promotion || m.piece;
  const dirs = { b: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
  const ds = piece === 'b' ? dirs.b : piece === 'r' ? dirs.r : piece === 'q' ? dirs.b.concat(dirs.r) : null;
  if (!ds) return null;
  const f0 = m.to.charCodeAt(0) - 97, r0 = +m.to[1] - 1;
  for (const [df, dr] of ds) {
    let f = f0 + df, r = r0 + dr, first = null;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const sq = String.fromCharCode(97 + f) + (r + 1);
      const p = pieceAt(c, sq);
      if (p) {
        if (!first) { if (p.color === m.color || p.type === 'p') break; first = { ...p, square: sq }; }
        else {
          if (p.color !== m.color && (p.type === 'k' || (p.type === 'q' && first.type !== 'q')) && VAL[first.type] < VAL[p.type]) return { pinned: first, behind: { ...p, square: sq } };
          break;
        }
      }
      f += df; r += dr;
    }
  }
  return null;
}

// Case controllate dal pezzo appena mosso (prima il centro, poi i pezzi avversari, poi le altre).
function controlled(c, m) {
  const me = m.color, res = [];
  for (const f of 'abcdefgh') for (let r = 1; r <= 8; r++) {
    const sq = f + r;
    if (sq === m.to) continue;
    const o = pieceAt(c, sq);
    if (o && o.color === me) continue;
    if (att(c, sq, me).includes(m.to)) res.push(sq);
  }
  const center = res.filter(x => CENTER.includes(x));
  const enemies = res.filter(x => !CENTER.includes(x) && pieceAt(c, x));
  const rest = res.filter(x => !center.includes(x) && !enemies.includes(x));
  return [...center, ...enemies, ...rest].slice(0, 4);
}

// Perché si gioca questa mossa: solo fatti verificabili sulla scacchiera.
function reasons(before, after, m, prev) {
  const out = [];
  const me = m.color, op = me === 'w' ? 'b' : 'w';
  const piece = m.promotion || m.piece;
  if (m.san.startsWith('O-O')) out.push('il re va al sicuro e la torre entra in gioco');
  if (m.captured) out.push(prev && prev.captured && prev.to === m.to ? `riprende ${ART[m.captured]} in ${m.to}${VAL[prev.captured] === VAL[m.captured] ? ', così il materiale torna pari' : ''}` : `prende ${ART[m.captured]} in ${m.to}`);
  // il pezzo mosso resta dove può essere preso (è l'offerta di un gambetto)
  if (m.piece !== 'k' && (!m.captured || VAL[m.captured] < VAL[piece])) {
    const a = att(after, m.to, op), d = att(after, m.to, me);
    if (a.length && (!d.length || a.some(sq => VAL[pieceAt(after, sq).type] < VAL[piece]))) out.push(`lascia ${ART[piece]} in ${m.to} dove può essere preso`);
  }
  // un proprio pezzo che prima era difeso resta senza difesa
  const left = [];
  for (const row of after.board()) for (const p of row) {
    if (!p || p.color !== me || p.type === 'k' || p.square === m.to) continue;
    if (att(after, p.square, op).length && att(after, p.square, me).length === 0 && att(before, p.square, me).length > 0) left.push(ref(p.type, p.square));
  }
  if (left.length) out.push(`lascia senza difesa ${listIt(left)}`);
  if (m.san.includes('+')) out.push('dà scacco');
  const pin = pinFrom(after, m);
  if (pin) out.push(`inchioda ${ref(pin.pinned.type, pin.pinned.square)} ${pin.behind.type === 'k' ? 'al re' : 'alla donna'}: se si muovesse, resterebbe ${pin.behind.type === 'k' ? 'scoperto il re' : 'scoperta la donna'}`);
  // pezzi avversari attaccati dal pezzo mosso: indifesi o di valore maggiore
  const targets = [];
  for (const row of after.board()) for (const p of row) {
    if (!p || p.color !== op || p.type === 'k') continue;
    if (pin && pin.pinned.square === p.square) continue;
    if (!att(after, p.square, me).includes(m.to)) continue;
    const defended = att(after, p.square, op).length > 0;
    if (!defended || VAL[p.type] > VAL[piece]) targets.push(ref(p.type, p.square) + (defended ? '' : ', che è indifeso'));
  }
  if (targets.length) out.push(`attacca ${listIt(targets)}`);
  // f7/f2: il punto debole difeso solo dal re
  const weak = op === 'b' ? 'f7' : 'f2';
  const wp = pieceAt(after, weak);
  if (['b', 'q'].includes(piece) && wp && wp.color === op && att(after, weak, me).includes(m.to)) {
    const defs = att(after, weak, op);
    if (defs.length === 1 && pieceAt(after, defs[0])?.type === 'k') out.push(`punta su ${weak}, una casa difesa soltanto dal re`);
  }
  // si sposta un pezzo che era sotto attacco
  if (!m.captured && m.piece !== 'p' && m.piece !== 'k') {
    const a = att(before, m.from, op), d = att(before, m.from, me);
    if (a.length && (!d.length || a.some(s => VAL[pieceAt(before, s).type] < VAL[m.piece]))) out.push(`toglie ${ART[m.piece]} dall'attacco`);
  }
  // difende un proprio pezzo attaccato che prima era senza difesa
  const saved = [];
  for (const row of after.board()) for (const p of row) {
    if (!p || p.color !== me || p.type === 'k' || p.square === m.to) continue;
    if (!att(after, p.square, op).length) continue;
    if (att(before, p.square, me).length === 0 && att(after, p.square, me).length > 0) saved.push(ref(p.type, p.square));
  }
  if (saved.length) out.push(`difende ${listIt(saved)}`);
  // sviluppo
  if (HOME[me][m.piece]?.includes(m.from)) out.push(m.piece === 'q' ? 'porta fuori la donna' : `sviluppa ${ART[m.piece]}`);
  // centro
  if (m.piece === 'p' && CENTER.includes(m.to)) out.push(`occupa il centro in ${m.to}`);
  const centerHit = CENTER.filter(sq => sq !== m.to && att(after, sq, me).includes(m.to) && !m.san.startsWith('O-O'));
  const ctrl = centerHit.filter(sq => !pieceAt(after, sq));
  const prop = centerHit.filter(sq => pieceAt(after, sq)?.color === me && !saved.includes(ref(pieceAt(after, sq).type, sq)));
  if (ctrl.length) out.push(`controlla ${ctrl.length === 1 ? 'la casa centrale' : 'le case centrali'} ${listIt(ctrl)}`);
  if (prop.length) out.push(`sostiene ${listIt(prop.map(sq => ref(pieceAt(after, sq).type, sq)))} al centro`);
  // mossa di pedone che toglie una casa ai pezzi avversari (come ...a6 contro Ab5 o h3 contro Ag4)
  if (m.piece === 'p' && !m.captured && 'ah'.includes(m.to[0])) {
    const denied = [];
    const f = m.to.charCodeAt(0), r = +m.to[1] + (me === 'w' ? 1 : -1);
    for (const df of [-1, 1]) {
      const sq = String.fromCharCode(f + df) + r;
      if (!/^[a-h][1-8]$/.test(sq) || pieceAt(after, sq)) continue;
      // prima della mossa un pezzo avversario poteva andarci senza essere preso da un pedone
      const b2 = before.fen().split(' '); b2[1] = op; b2[3] = '-';
      let could = false; try { could = new Chess(b2.join(' ')).moves({ verbose: true }).some(x => x.to === sq && ['n', 'b', 'q'].includes(x.piece)); } catch {}
      if (could && !CENTER.includes(sq)) denied.push(sq);
    }
    if (denied.length) out.push(`toglie ${denied.length === 1 ? 'la casa' : 'le case'} ${listIt(denied)} ai pezzi avversari`);
  }
  // linee che si aprono per alfieri e donna dopo una mossa di pedone
  if (m.piece === 'p') {
    const opened = [];
    for (const row of after.board()) for (const p of row) {
      if (!p || p.color !== me || !['b', 'q'].includes(p.type)) continue;
      const a = mobility(before.fen(), p.square, me), b = mobility(after.fen(), p.square, me);
      if (a !== null && b !== null && b - a >= 2) opened.push(p.type === 'q' ? 'alla donna' : `all'alfiere in ${p.square}`);
    }
    if (opened.length) out.push(`apre la strada ${listIt(opened)}`);
  }
  // prepara l'arrocco corto
  const kSq = me === 'w' ? 'e1' : 'e8', between = me === 'w' ? ['f1', 'g1'] : ['f8', 'g8'];
  const rights = after.fen().split(' ')[2];
  if (pieceAt(after, kSq)?.type === 'k' && rights.includes(me === 'w' ? 'K' : 'k') && between.includes(m.from) && between.every(s => !pieceAt(after, s))) out.push("libera la strada all'arrocco corto");
  // se non c'è altro da dire, si indica almeno che cosa controlla il pezzo dalla nuova casa
  if (out.length < 2 && !m.san.startsWith('O-O')) {
    const ctl = controlled(after, m);
    if (ctl.length) out.push(`${m.piece === 'p' ? 'il pedone controlla' : 'dalla nuova casa il pezzo controlla'} ${listIt(ctl)}`);
    else if (m.piece === 'p') out.push('guadagna spazio');
  }
  return out.slice(0, 5);
}

// "il cavallo da g1 a f3": quale pezzo, da quale casa a quale casa.
const ARTC = { p: 'il pedone', n: 'il cavallo', b: "l'alfiere", r: 'la torre', q: 'la donna', k: 'il re' };
function moveDesc(m, mine = false) {
  if (m.san.startsWith('O-O-O')) return (mine ? 'arrocchi lungo' : 'arrocca lungo') + ': il re va in ' + m.to + ' e la torre accanto';
  if (m.san.startsWith('O-O')) return (mine ? 'arrocchi corto' : 'arrocca corto') + ': il re va in ' + m.to + ' e la torre accanto';
  return `${m.captured ? (mine ? 'prendi con' : 'prende con') : (mine ? 'muovi' : 'muove')} ${ARTC[m.piece]} da ${m.from} a ${m.to}${m.promotion ? ' e promuove' : ''}`;
}

// Linea spiegata passo per passo, nel formato dei passi del Tutor.
// L: { moves, side, title, n, total, retry }, info: { idea, withIdea, prev: { moves, n } }
export function explainLine(L, info = {}) {
  const me = L.side;
  const names = namesAlong(L.moves);
  const final = identify(L.moves);
  const steps = [];
  const start = new Chess();
  const nameTxt = final ? `${final.nameIt} (codice ECO ${final.eco})` : L.title;
  const nameSp = final ? final.nameIt : L.title;
  // passo iniziale: quale linea è, esattamente
  let t0 = `Linea ${L.n} di ${L.total}. Giochi con il ${SIDE[me]}. Apertura: ${L.title}. Nome esatto di questa linea: ${nameTxt}.`;
  let s0 = `Linea ${L.n} di ${L.total}, giochi con il ${SIDE[me]}. Apertura: ${L.title}. Nome esatto di questa linea: ${nameSp}.`;
  steps.push({ fen: start.fen(), arrows: [], tag: `Linea ${L.n} di ${L.total} · ${SIDE[me]}`, text: t0, speech: speakable(s0), jump: true });
  if (info.withIdea && info.idea) steps.push({ fen: start.fen(), arrows: [], tag: "L'idea", text: `L'idea di fondo: ${info.idea}`, speech: speakable(`L'idea di fondo. ${info.idea}`), keepLast: true });
  // dove si separa dalla linea precedente dello stesso colore
  let split = -1;
  if (info.prev) { split = 0; while (split < L.moves.length && info.prev.moves[split] === L.moves[split]) split++; }
  const c = new Chess();
  const announced = [];
  let gambitSaid = '';
  let prev = null;
  for (let i = 0; i < L.moves.length; i++) {
    const before = new Chess(c.fen());
    const m = c.move(L.moves[i]);
    const mine = m.color === me;
    const num = `${Math.floor(i / 2) + 1}${i % 2 ? '...' : '.'}`;
    const san = itSan(m.san);
    let text = mine ? `${num}${san}. Tu, con il ${SIDE[me]}, ${moveDesc(m, true)}.` : `${num}${san}. ${i === 0 ? 'Prima mossa' : 'Risposta'} del ${SIDE[m.color]}: ${moveDesc(m)}.`;
    const why = reasons(before, c, m, prev);
    if (why.length) text += ` A che cosa serve: ${listIt(why)}.`;
    // nome dell'apertura che cambia con questa mossa
    const nm = names.find(x => x.ply === i + 1);
    let extra = '';
    if (nm && !SKIP.has(nm.name) && !announced.some(a => a.startsWith(nm.name))) {
      announced.push(nm.name);
      extra += ` Da questa mossa la linea si chiama: ${nm.nameIt}.`;
      const prevName = announced.length > 1 ? announced[announced.length - 2] : '';
      if (/Gambit Accepted/.test(nm.name) && gambitSaid !== 'acc') { gambitSaid = 'acc'; extra += ' Il gambetto è accettato: si prende il materiale offerto.'; }
      else if (/Declined/.test(nm.name) && /Gambit/.test(nm.name) && gambitSaid !== 'dec') { gambitSaid = 'dec'; extra += ' Il gambetto è rifiutato: il materiale offerto non si prende.'; }
      else if (/Gambit/.test(nm.name) && !/Gambit/.test(prevName) && !gambitSaid) { gambitSaid = 'off'; extra += ' È un gambetto: chi lo gioca offre materiale in cambio di tempo e iniziativa.'; }
    }
    if (split > 0 && i === split && info.prev && info.prev.moves[i]) {
      const alt = new Chess(before.fen()).move(info.prev.moves[i]);
      extra += ` Attenzione: fin qui le mosse erano uguali alla linea ${info.prev.n}. Qui la strada si divide: nella linea ${info.prev.n} si giocava ${itSan(alt.san)}, in questa si gioca ${san}.`;
    }
    const arrows = [{ from: m.from, to: m.to, color: mine ? '#4caf7d' : '#e2504c' }];
    steps.push({ fen: c.fen(), last: { from: m.from, to: m.to }, arrows, tag: mine ? 'La tua mossa' : "Mossa dell'avversario", text: text + extra, speech: speakable(text + extra) });
    prev = m;
  }
  const mineList = [];
  const t = new Chess();
  L.moves.forEach((s, i) => { const m = t.move(s); if (m.color === me) mineList.push(`${Math.floor(i / 2) + 1}${i % 2 ? '...' : '.'}${itSan(m.san)}`); });
  steps.push({ fen: c.fen(), arrows: [], keepLast: true, tag: 'Ora tocca a te', text: `Fine della linea: ${nameTxt}. Le tue mosse da ricordare sono ${mineList.join(', ')}. ${info.theory ? 'Dopo la teoria la impari a memoria e la esercitiamo.' : "Ora giocala tu a memoria: le mosse dell'avversario arrivano da sole."}`, speech: speakable(info.theory ? 'Fine della linea.' : `Fine della linea. Ora giocala tu a memoria: le mosse dell'avversario arrivano da sole.`) });
  return steps;
}

// Frase breve detta all'inizio di ogni linea già spiegata: dice esattamente quale linea è.
export function lineIntro(L) {
  const final = identify(L.moves);
  const what = final ? final.nameIt : L.title;
  return {
    text: `${L.retry ? 'Ripetizione della linea' : 'Linea'} ${L.n}${L.retry ? '' : ` di ${L.total}`}, con il ${SIDE[L.side]}: ${what}${final ? ` (ECO ${final.eco})` : ''}.`,
    speech: speakable(`${L.retry ? 'Ripetizione della linea' : 'Linea'} ${L.n}, con il ${SIDE[L.side]}. ${what}. Giocala a memoria.`),
  };
}

// Passi iniziali della teoria: che cosa stai per imparare, da dove nasce, che carattere ha, quali piani, chi la gioca.
// I testi di storia, carattere e giocatori sono in repertoire-data.js e vengono da fonti verificate.
export function theoryOverview(side, title, idea, n, profile, line) {
  const sd = side === 'w' ? 'Bianco' : 'Nero';
  const start = new Chess().fen();
  // posizione tipica: le prime mosse della prima linea
  const c = new Chess();
  (line || []).slice(0, 8).forEach(m => { try { c.move(m); } catch { /* */ } });
  const mid = c.fen();
  const mk = (tag, text, fen, jump) => ({ fen, arrows: [], tag: `${sd} · ${tag}`, text, speech: speakable(text), jump, keepLast: !jump });
  const steps = [mk('Teoria', `Teoria prima della pratica. Con il ${sd} questa settimana impari: ${title}. Prima ti racconto da dove nasce, che carattere ha e quali piani persegue. Poi ti spiego ${n} ${n === 1 ? 'linea' : 'linee'}, mossa per mossa: quale pezzo si muove, da quale casa a quale casa e a che cosa serve. Solo dopo la impari a memoria e ti eserciti.`, start, true)];
  if (profile?.storia) steps.push(mk('Da dove nasce', profile.storia, start, false));
  if (profile?.carattere) steps.push(mk('Che tipo di apertura è', profile.carattere, mid, true));
  if (idea) steps.push(mk('Il piano', `Il piano per te. ${idea}`, mid, false));
  if (profile?.giocatori) steps.push(mk('Chi la gioca', profile.giocatori, mid, false));
  return steps;
}

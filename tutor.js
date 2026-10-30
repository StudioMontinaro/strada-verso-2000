// Il tutor: un pezzo che spiega gli errori mossa per mossa, sulla scacchiera e a voce.
// Tutto ciò che dice è ricavato dalle linee di Stockfish e dalla posizione: niente è inventato.
import { Chess } from './chess.js';
import { itSan } from './analysis.js';
import { pieceHtml } from './board.js';
import { avatarHtml, avatarId, getAvatar } from './avatars.js';
import { speak, stopSpeech, spokenMove, spokenSquare, PIECE_IT } from './speech.js';

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const ART = { p: ['un pedone', 'pedoni'], n: ['un cavallo', 'cavalli'], b: ['un alfiere', 'alfieri'], r: ['una torre', 'torri'], q: ['la donna', 'donne'], k: ['il re', 're'] };
const NUMW = ['', '', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto'];
const COLOR = { w: 'il Bianco', b: 'il Nero' };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function counts(fen) {
  const n = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const ch of fen.split(' ')[0]) {
    const t = ch.toLowerCase();
    if (!(t in n.w)) continue;
    n[ch === t ? 'b' : 'w'][t]++;
  }
  return n;
}
function listPieces(diff) {
  const parts = [];
  for (const t of ['q', 'r', 'b', 'n', 'p']) {
    const k = diff[t];
    if (k <= 0) continue;
    parts.push(k === 1 ? ART[t][0] : `${NUMW[k] || k} ${ART[t][1]}`);
  }
  if (!parts.length) return '';
  return parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1];
}
// Bilancio del materiale fra due posizioni dal punto di vista di "me".
export function materialSwing(fenA, fenB, me) {
  const a = counts(fenA), b = counts(fenB), op = me === 'w' ? 'b' : 'w';
  const lost = {}, won = {};
  let net = 0;
  for (const t of ['p', 'n', 'b', 'r', 'q']) {
    lost[t] = Math.max(0, a[me][t] - b[me][t]);
    won[t] = Math.max(0, a[op][t] - b[op][t]);
    // una promozione fa "comparire" un pezzo: la conto come guadagno
    if (b[me][t] > a[me][t] && t !== 'p') won[t] += b[me][t] - a[me][t];
    if (b[op][t] > a[op][t] && t !== 'p') lost[t] += b[op][t] - a[op][t];
    net += (won[t] - lost[t]) * VAL[t];
  }
  return { lost: listPieces(lost), won: listPieces(won), net };
}

// Pezzi avversari che il pezzo appena mosso attacca e che sono indifesi o valgono di più.
function threatsAfter(c, m) {
  const out = [];
  const enemy = m.color === 'w' ? 'b' : 'w';
  for (const row of c.board()) for (const p of row) {
    if (!p || p.color !== enemy) continue;
    const att = c.attackers(p.square, m.color);
    if (!att.includes(m.to)) continue;
    if (p.type === 'k') { out.push({ t: 'k', sq: p.square }); continue; }
    const defended = c.attackers(p.square, enemy).length > 0;
    const mover = (m.promotion || m.piece);
    if (!defended || VAL[p.type] > VAL[mover]) out.push({ t: p.type, sq: p.square, free: !defended });
  }
  return out;
}

function pieceRef(t, sq, mine) {
  const art = { p: 'il pedone', n: 'il cavallo', b: "l'alfiere", r: 'la torre', q: 'la donna', k: 'il re' }[t];
  const my = { p: 'il tuo pedone', n: 'il tuo cavallo', b: 'il tuo alfiere', r: 'la tua torre', q: 'la tua donna', k: 'il tuo re' }[t];
  return { text: `${mine ? my : art} in ${sq}`, speech: `${mine ? my : art} in ${spokenSquare(sq)}` };
}

const WITH = { p: 'il pedone', n: 'il cavallo', b: "l'alfiere", r: 'la torre', q: 'la donna', k: 'il re' };
// Valutazione a parole e in cifre, sempre dal punto di vista di chi studia.
export function evalFor(E, me) {
  if (!E) return { text: '', speech: '' };
  const sg = me === 'w' ? 1 : -1;
  if (E.mate !== null && E.mate !== undefined && E.mate !== 0) {
    const m = sg * E.mate;
    return m > 0 ? { text: `matto in ${Math.abs(m)} per te`, speech: `matto in ${Math.abs(m)} per te` } : { text: `matto in ${Math.abs(m)} per l'avversario`, speech: `matto in ${Math.abs(m)} per l'avversario` };
  }
  const v = sg * E.cp / 100;
  const t = (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
  const sp = (v > 0 ? 'più ' : v < 0 ? 'meno ' : '') + Math.abs(v).toFixed(1).replace('.', ' virgola ');
  return { text: t, speech: sp };
}

// Racconta una sequenza di mosse: per ogni semimossa un passo con posizione, frecce e testo.
export function narrateLine(startFen, ucis, me, { max = 6, color = '#e2504c', mineColor = '#4caf7d' } = {}) {
  const c = new Chess(startFen);
  const steps = [];
  let plies = Math.min(ucis.length, max);
  for (let i = 0; i < plies; i++) {
    const u = ucis[i];
    let m;
    try { m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; }
    const mine = m.color === me;
    const side = cap(COLOR[m.color]);
    const san = itSan(m.san);
    let text, sp;
    if (m.san.startsWith('O-O')) {
      const kind = m.san.startsWith('O-O-O') ? 'lungo' : 'corto';
      text = mine ? `Tu arrocchi ${kind} (${san})` : `${side} arrocca ${kind} (${san})`;
      sp = mine ? `Tu arrocchi ${kind}` : `${side} arrocca ${kind}`;
    } else if (m.captured) {
      const r = pieceRef(m.captured, m.to, !mine);
      text = mine ? `Prendi ${r.text} con ${WITH[m.piece]} (${san})` : `${side} cattura ${r.text} con ${WITH[m.piece]} (${san})`;
      sp = mine ? `Prendi ${r.speech} con ${WITH[m.piece]}` : `${side} cattura ${r.speech} con ${WITH[m.piece]}`;
    } else {
      text = mine ? `Tu giochi ${san}` : `${side} risponde ${san}`;
      sp = `${mine ? 'Tu giochi' : side + ' risponde'} ${PIECE_IT[m.piece]} ${spokenSquare(m.to)}`;
    }
    if (m.promotion) { text += `, e promuovi a ${PIECE_IT[m.promotion]}`.replace('promuovi', mine ? 'promuovi' : 'promuove'); sp += `, e ${mine ? 'promuovi' : 'promuove'} a ${PIECE_IT[m.promotion]}`; }
    const arrows = [{ from: m.from, to: m.to, color: mine ? mineColor : color }];
    if (c.isCheckmate()) { text += '. Scacco matto.'; sp += '. Scacco matto.'; }
    else {
      const targets = threatsAfter(c, m).filter(x => x.t !== 'k');
      const check = m.san.includes('+');
      const verbA = mine ? 'attacchi' : 'attacca', verbC = mine ? 'colpisci' : 'colpisce';
      if (targets.length >= 2 || (check && targets.length >= 1)) {
        const refs = targets.map(x => pieceRef(x.t, x.sq, !mine));
        const what = (check ? [{ text: mine ? 'il re' : 'il tuo re', speech: mine ? 'il re' : 'il tuo re' }] : []).concat(refs);
        text += `. Doppio attacco: ${verbC} ${what.map(r => r.text).join(' e ')}.`;
        sp += `. Doppio attacco: ${verbC} ${what.map(r => r.speech).join(' e ')}.`;
        targets.forEach(x => arrows.push({ from: m.to, to: x.sq, color: mine ? mineColor : color }));
      } else if (check) { text += '. Scacco.'; sp += '. Scacco.'; }
      else if (targets.length === 1) {
        const r = pieceRef(targets[0].t, targets[0].sq, !mine);
        const how = targets[0].free ? ', che è indifeso' : '';
        text += `, e ${verbA} ${r.text}${how}.`;
        sp += `, e ${verbA} ${r.speech}${how}.`;
        arrows.push({ from: m.to, to: targets[0].sq, color: mine ? mineColor : color });
      } else { text += '.'; sp += '.'; }
    }
    steps.push({ fen: c.fen(), last: { from: m.from, to: m.to }, arrows, text, speech: sp, capture: !!m.captured });
    if (c.isGameOver()) break;
    // se l'ultima mossa raccontata è una cattura, mostra anche la ripresa
    if (i === plies - 1 && m.captured && plies < Math.min(ucis.length, max + 2)) plies++;
  }
  return { steps, endFen: c.fen(), mate: c.isCheckmate() };
}

export const RULES = {
  'Pezzo lasciato in presa': "Regola da ricordare: prima di lasciare il pezzo, guarda la casa d'arrivo e chiediti chi la attacca e chi la difende.",
  'Materiale perso per tattica': "Regola da ricordare: dopo ogni mossa dell'avversario cerca i suoi scacchi, le sue catture e le sue minacce, soprattutto i doppi attacchi.",
  'Tattica mancata': 'Regola da ricordare: prima di una mossa tranquilla controlla se hai uno scacco, una cattura o una minaccia che vince materiale.',
  'Matto mancato': "Regola da ricordare: quando il re avversario è esposto, prova tutti gli scacchi. Uno di essi può essere matto.",
  'Matto concesso': 'Regola da ricordare: controlla le case di fuga del tuo re e tutti gli scacchi che l\'avversario può darti.',
  'Errore nel finale': 'Regola da ricordare: nel finale attiva il re e conta i tempi prima di spingere i pedoni.',
  "Errore d'apertura": "Regola da ricordare: in apertura sviluppa i pezzi, controlla il centro e arrocca. Non regalare tempi.",
  'Errore posizionale': 'Regola da ricordare: confronta due o tre mosse candidate e scegli quella che migliora il tuo pezzo peggiore.',
};

// Lezione completa su un errore: la mossa, la confutazione, il bilancio, la mossa giusta, la regola.
export function errorLesson({ fenBefore, played, best, refutation = [], bestLine = [], label = 'Errore', type = null, me, evalBefore = null, evalAfter = null }) {
  const pm = new Chess(fenBefore).move({ from: played.slice(0, 2), to: played.slice(2, 4), promotion: played[4] });
  const afterFen = (() => { const c = new Chess(fenBefore); c.move({ from: played.slice(0, 2), to: played.slice(2, 4), promotion: played[4] }); return c.fen(); })();
  const ref = narrateLine(afterFen, refutation, me, { max: 6 });
  const sw = materialSwing(fenBefore, ref.endFen, me);
  const eb = evalFor(evalBefore, me), ea = evalFor(evalAfter, me);
  let verdict, verdictSp;
  const pts = n => n === 1 ? 'un punto' : `${n} punti`;
  if (ref.mate) { verdict = verdictSp = 'Il risultato è uno scacco matto contro di te.'; }
  else if (sw.net <= -1) { verdict = verdictSp = `Bilancio: hai perso ${sw.lost}${sw.won ? ` e preso solo ${sw.won}` : ''}, cioè ${pts(-sw.net)} di materiale in meno.`; }
  else { verdict = 'Il materiale resta in equilibrio, ma la posizione peggiora.'; verdictSp = verdict; }
  if (evalBefore && evalAfter) { verdict += ` Per te la valutazione passa da ${eb.text} a ${ea.text}.`; verdictSp += ` Per te la valutazione passa da ${eb.speech} a ${ea.speech}.`; }
  const pmSan = itSan(pm.san);
  const intro = `Hai giocato ${pmSan}. ${label}. Ti faccio vedere perché, mossa per mossa.`;
  const steps = [
    { fen: fenBefore, arrows: [{ from: played.slice(0, 2), to: played.slice(2, 4), color: '#e2504c' }], text: intro, speech: `Hai giocato ${spokenMove(pm)}. ${label}. Ti faccio vedere perché, mossa per mossa.`, tag: 'Il problema' },
    { fen: afterFen, last: { from: pm.from, to: pm.to }, arrows: [], text: `Dopo ${pmSan}, tocca ${COLOR[me === 'w' ? 'b' : 'w']}. Guarda che cosa può fare.`, speech: `Dopo ${spokenMove(pm)}, tocca ${COLOR[me === 'w' ? 'b' : 'w']}. Guarda che cosa può fare.`, tag: 'Il problema' },
    ...ref.steps.map(s => ({ ...s, tag: 'Che cosa succede' })),
    { fen: ref.endFen, arrows: [], text: verdict, speech: verdictSp, tag: 'Il bilancio', keepLast: true },
  ];
  if (best && best !== played) {
    const bm = new Chess(fenBefore).move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] });
    const line = bestLine.length && bestLine[0] === best ? bestLine : [best];
    const good = narrateLine(fenBefore, line, me, { max: 5 });
    const gsw = materialSwing(fenBefore, good.endFen, me);
    let gv, gvs;
    if (good.mate) gv = gvs = 'Così avresti dato scacco matto.';
    else if (gsw.net >= 1) gv = gvs = `Così avresti guadagnato ${gsw.won}${gsw.lost ? `, dando solo ${gsw.lost}` : ''}.`;
    else { gv = 'Così avresti mantenuto la posizione'; gvs = gv; if (evalBefore) { gv += `, con valutazione ${eb.text} per te`; gvs += `, con valutazione ${eb.speech} per te`; } gv += '.'; gvs += '.'; }
    steps.push({ fen: fenBefore, arrows: [{ from: best.slice(0, 2), to: best.slice(2, 4), color: '#4caf7d' }], text: `Torniamo alla posizione. La mossa giusta era ${itSan(bm.san)}.`, speech: `Torniamo alla posizione. La mossa giusta era ${spokenMove(bm)}.`, tag: 'La mossa giusta', jump: true });
    good.steps.forEach(s => steps.push({ ...s, tag: 'La mossa giusta' }));
    steps.push({ fen: good.endFen, arrows: [], text: gv, speech: gvs, tag: 'La mossa giusta', keepLast: true });
  }
  const rule = RULES[type] || 'Regola da ricordare: prima di muovere cerca sempre due o tre mosse candidate e controlla le risposte dell\'avversario.';
  steps.push({ fen: fenBefore, arrows: [], text: rule, speech: rule, tag: 'Da ricordare', jump: true });
  return steps;
}

// Spiegazione breve di una mossa sbagliata in un esercizio: solo confutazione e bilancio.
export function refuteLesson({ fenBefore, played, refutation, me }) {
  const pm = new Chess(fenBefore).move({ from: played.slice(0, 2), to: played.slice(2, 4), promotion: played[4] });
  const c = new Chess(fenBefore); c.move(pm.san);
  const ref = narrateLine(c.fen(), refutation, me, { max: 6 });
  const sw = materialSwing(fenBefore, ref.endFen, me);
  let verdict = ref.mate ? 'E finisce con uno scacco matto contro di te.' : sw.net <= -1 ? `Risultato: perdi ${sw.lost}.` : sw.net >= 1 ? `Guadagni ${sw.won}, ma meno di quanto offre la mossa giusta.` : 'Il materiale resta pari, ma non è la mossa più forte: cercane una migliore.';
  return [
    { fen: c.fen(), last: { from: pm.from, to: pm.to }, arrows: [], text: `Se giochi ${itSan(pm.san)}, ecco che cosa succede.`, speech: `Se giochi ${spokenMove(pm)}, ecco che cosa succede.`, tag: 'Perché no', jump: true },
    ...ref.steps.map(s => ({ ...s, tag: 'Perché no' })),
    { fen: ref.endFen, arrows: [], text: verdict, speech: verdict, tag: 'Perché no', keepLast: true },
  ];
}

// Pannello del tutor: avatar a forma di pezzo, fumetto, comandi. Usa la scacchiera indicata.
const active = new Set();
// Chiude tutti i tutor aperti (cambio di schermata): niente più voce né mosse in sottofondo.
export function closeTutors() { for (const t of [...active]) t.close(true); }

export class Tutor {
  constructor(anchor, board) { this.anchor = anchor; this.board = board; this.el = null; }
  close(silent = false) {
    this.stopped = true; this.playing = false; this.tok = (this.tok || 0) + 1; stopSpeech();
    active.delete(this);
    const had = !!this.el;
    if (this.el) { this.el.remove(); this.el = null; }
    if (had && !silent && this.onClose) this.onClose();
  }
  async run(steps, { onClose = null, extra = null, onEnd = null } = {}) {
    this.close(true);
    this.onEnd = onEnd;
    active.add(this);
    this.steps = steps; this.i = -1; this.playing = true; this.stopped = false; this.onClose = onClose;
    const el = document.createElement('div');
    el.className = 'tutor';
    el.innerHTML = `
      <div class="tav">${avatarHtml(avatarId())}<div class="tname">${getAvatar(avatarId()).name}</div></div>
      <div class="tbody">
        <div class="ttag"></div>
        <div class="tbubble"><p class="ttext"></p></div>
        <div class="tctl">
          <button data-a="prev" aria-label="Indietro">◀</button>
          <button data-a="play" aria-label="Pausa">❚❚</button>
          <button data-a="next" aria-label="Avanti">▶</button>
          <button data-a="voice" aria-label="Voce">🔊</button>
          <span class="tcount"></span>
          <button data-a="close" aria-label="Chiudi" class="tx">✕</button>
        </div>
        <div class="textra"></div>
      </div>`;
    this.anchor.after(el);
    this.el = el;
    el.querySelector('.tctl').addEventListener('click', e => {
      const a = e.target.closest('button')?.dataset.a; if (!a) return;
      if (a === 'close') return this.close();
      if (a === 'prev') { this.playing = false; this.go(Math.max(0, this.i - 1)); }
      if (a === 'next') { this.playing = false; this.go(Math.min(this.steps.length - 1, this.i + 1)); }
      if (a === 'play') { this.playing = !this.playing; if (this.playing) { if (this.i >= this.steps.length - 1) this.go(0); else this.loop(); } else stopSpeech(); this.syncBtns(); }
      if (a === 'voice') {
        const s = JSON.parse(localStorage.getItem('settings') || '{}'); s.voice = s.voice === false; localStorage.setItem('settings', JSON.stringify(s));
        if (s.voice === false) stopSpeech(); this.syncBtns();
      }
    });
    if (extra) extra(el.querySelector('.textra'), this);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    this.go(0);
  }
  syncBtns() {
    if (!this.el) return;
    const v = JSON.parse(localStorage.getItem('settings') || '{}').voice !== false;
    this.el.querySelector('[data-a=voice]').textContent = v ? '🔊' : '🔇';
    this.el.querySelector('[data-a=play]').textContent = this.playing ? '❚❚' : '▶︎';
  }
  show(i) {
    const s = this.steps[i];
    const prev = this.steps[this.i];
    const c = new Chess(s.fen);
    let check = null;
    if (c.inCheck()) for (const r of c.board()) for (const p of r) if (p && p.type === 'k' && p.color === c.turn()) check = p.square;
    const opts = { fen: s.fen, last: s.last || (s.keepLast ? prev?.last : null), arrows: s.arrows || [], interactive: false, sel: null, dests: [], check, hintSq: null, markSq: null };
    // animazione solo andando avanti di un passo lungo la stessa linea
    if (i === this.i + 1 && !s.jump) this.board.set(opts); else this.board.jump(opts);
    this.i = i;
    this.el.querySelector('.ttext').textContent = s.text;
    this.el.querySelector('.ttag').textContent = s.tag || '';
    this.el.querySelector('.tcount').textContent = `${i + 1}/${this.steps.length}`;
    const b = this.el.querySelector('.tbubble'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    // reazione del tutor: errore = scossa, sudore e stelline; mossa giusta = cenno, pollice e scintille
    const mood = s.mood || ({ 'Il problema': 'bad', 'Perché no': 'bad', 'La mossa giusta': 'good', 'Bene': 'good', 'Errore': 'bad' })[s.tag] || null;
    const el = this.el;
    el.classList.remove('mood'); delete el.dataset.mood; clearTimeout(this.moodT);
    if (mood) { void el.offsetWidth; el.dataset.mood = mood; el.classList.add('mood'); this.moodT = setTimeout(() => { el.classList.remove('mood'); delete el.dataset.mood; }, 2600); }
    this.syncBtns();
    if (i === this.steps.length - 1 && this.onEnd) { const f = this.onEnd; this.onEnd = null; f(); }
  }
  async go(i) { stopSpeech(); this.show(i); if (this.playing) this.loop(true); }
  async loop(already = false) {
    const token = (this.tok = (this.tok || 0) + 1);
    if (!already) this.show(Math.min(this.i + 1, this.steps.length - 1));
    while (this.playing && !this.stopped && token === this.tok && this.el) {
      const s = this.steps[this.i];
      this.el.classList.add('talking');
      const t0 = performance.now();
      await speak(s.speech || s.text);
      this.el && this.el.classList.remove('talking');
      // con la voce spenta lascia il tempo di leggere
      const voiceOn = JSON.parse(localStorage.getItem('settings') || '{}').voice !== false && !!window.speechSynthesis;
      const minMs = voiceOn ? 0 : 900 + (s.text.length * 38);
      const spent = performance.now() - t0;
      if (spent < minMs) await new Promise(r => setTimeout(r, minMs - spent));
      else await new Promise(r => setTimeout(r, 350));
      if (!this.playing || this.stopped || token !== this.tok || !this.el) return;
      if (this.i >= this.steps.length - 1) { this.playing = false; this.syncBtns(); return; }
      this.show(this.i + 1);
    }
  }
}

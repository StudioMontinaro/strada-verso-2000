// Tutor in diretta durante le partite: valuta ogni tua mossa con Stockfish a forza piena,
// spiega gli errori muovendo i pezzi sulla scacchiera e dà suggerimenti a richiesta.
import { Chess } from './chess.js';
import { classifyGame, whitePov, terminalEval, itSan } from './analysis.js';
import { Tutor, errorLesson, narrateLine, evalFor } from './tutor.js';
import { avatarHtml, avatarId } from './avatars.js';
import { speak, speakable } from './speech.js';

const DUMMY = () => ({ cp: 0, mate: null, best: null, pv: [], depth: 0 });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createLiveTutor({ eng, board, color, elo, G, refresh, noteEl, anchorEl, pause, resume, cancelBg, restart, settings }) {
  const tutor = new Tutor(anchorEl, board);
  const strong = () => eng.configure({ 'UCI_LimitStrength': 'false', 'Skill Level': 20 });
  const weak = () => eng.configure({ 'UCI_LimitStrength': 'true', 'UCI_Elo': elo, 'Skill Level': 20 });
  const evalPos = async (fen, depth, ms) => terminalEval(fen) || whitePov(await eng.search(fen, `go depth ${depth} movetime ${ms}`), fen);

  // Piccola nota con il volto del tutor: sempre visibile sotto la scacchiera.
  function note(text, mood = null, thinking = false) {
    if (!noteEl) return;
    noteEl.innerHTML = `<div class="tutor mini livenote${mood ? ' mood' : ''}"${mood ? ` data-mood="${mood}"` : ''}><div class="tav">${avatarHtml(avatarId())}</div><div class="tbody"><div class="tbubble${thinking ? ' thinking' : ''}"><p class="ttext">${esc(text)}</p></div></div></div>`;
    const el = noteEl.firstElementChild;
    if (thinking) el.classList.add('talking');
    else if (settings().voice !== false) { el.classList.add('talking'); Promise.resolve(speak(speakable(text))).catch(() => {}).finally(() => el.classList.remove('talking')); }
    if (mood) setTimeout(() => { el.classList.remove('mood'); }, 2600);
  }
  function clear() { if (noteEl) noteEl.innerHTML = ''; }

  function classify(hist, E0, E1) {
    const n = hist.length;
    const evals = Array.from({ length: n + 1 }, DUMMY);
    evals[n - 1] = E0; evals[n] = E1;
    return classifyGame({ moves: hist, times: G.times }, evals)[n - 1];
  }

  // Lezione a schermo: i pezzi si muovono sulla scacchiera mentre il tutor parla. Restituisce 'cont' o 'undo'.
  function lesson(steps, { allowUndo = false } = {}) {
    return new Promise(res => {
      let done = false;
      const fin = v => { if (!done) { done = true; res(v); } };
      tutor.run(steps, {
        onClose: () => { refresh(); fin('cont'); },
        extra: el => {
          el.innerHTML = `<div class="row"><button class="btn primary" data-x="cont">Continua la partita ▶</button>${allowUndo ? '<button class="btn" data-x="undo">↩ Riprova la mossa</button>' : ''}</div>`;
          el.querySelector('[data-x=cont]').onclick = () => tutor.close();
          el.querySelector('[data-x=undo]')?.addEventListener('click', () => { fin('undo'); tutor.close(true); refresh(); });
        },
      });
    });
  }

  // Dopo la tua mossa. Restituisce 'cont' (il motore può rispondere) oppure 'undo' (mossa ritirata).
  async function review() {
    const hist = G.chess.history();
    const n = hist.length;
    const c = new Chess(); for (const s of hist.slice(0, n - 1)) c.move(s);
    const fenBefore = c.fen(), fenAfter = G.chess.fen();
    note('Il tutor valuta la tua mossa…', null, true);
    pause();
    let m = null;
    try {
      await strong();
      let E0 = await evalPos(fenBefore, 12, 1000), E1 = await evalPos(fenAfter, 12, 1000);
      m = classify(hist, E0, E1);
      if (m.cls === 'mistake' || m.cls === 'blunder') {
        // verifica più profonda prima di accusare: a bassa profondità un sacrificio vincente sembra un errore
        E0 = await evalPos(fenBefore, 16, 2500); E1 = await evalPos(fenAfter, 16, 2500);
        m = classify(hist, E0, E1);
      }
    } catch { m = null; }
    finally { try { await weak(); } catch { /* */ } }
    if (G.over || !m) { resume(); clear(); return 'cont'; }
    const ev = evalFor(m.evalAfter, color).text;
    if (m.cls === 'mistake' || m.cls === 'blunder') {
      clear();
      const steps = errorLesson({ fenBefore: m.fenBefore, played: m.uci, best: m.best, refutation: m.evalAfter.pv || [], bestLine: m.evalBefore.pv || [], label: m.label, type: m.type, me: color, evalBefore: m.evalBefore, evalAfter: m.evalAfter });
      const r = await lesson(steps, { allowUndo: true });
      if (r !== 'undo') resume();
      return r;
    }
    resume();
    if (m.cls === 'inacc') note(`Imprecisione. Qui era meglio ${itSan(m.bestSan)}: perdi circa ${Math.round(m.loss)} punti di probabilità di vittoria. Valutazione ${ev} per te.`, 'bad');
    else if (m.cls === 'best') note(`Ottima mossa, è la migliore secondo Stockfish. Valutazione ${ev} per te.`, 'good');
    else note(`Buona mossa. Valutazione ${ev} per te.`);
    return 'cont';
  }

  // Suggerimento: la mossa consigliata, la linea che segue e perché.
  async function hint() {
    if (G.over || G.chess.turn() !== color) return;
    cancelBg();
    pause();
    note('Il tutor sta pensando…', null, true);
    const fen = G.chess.fen();
    let E;
    try { await strong(); E = await evalPos(fen, 14, 2200); } catch { E = null; } finally { try { await weak(); } catch { /* */ } }
    clear();
    if (!E || !E.best || G.over) { resume(); restart(); return; }
    const best = E.best;
    const bm = new Chess(fen).move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] });
    const san = itSan(bm.san);
    const line = (E.pv && E.pv[0] === best) ? E.pv : [best];
    const nar = narrateLine(fen, line, color, { max: 4 });
    const ev = evalFor(E, color);
    const steps = [
      { fen, arrows: [{ from: best.slice(0, 2), to: best.slice(2, 4), color: '#4caf7d' }], text: `Ti consiglio ${san}. Ti faccio vedere come potrebbe continuare.`, speech: `Ti consiglio ${san}. Ti faccio vedere come potrebbe continuare.`, tag: 'Suggerimento', mood: 'good', jump: true },
      ...nar.steps.map(s => ({ ...s, tag: 'Suggerimento' })),
      { fen, arrows: [{ from: best.slice(0, 2), to: best.slice(2, 4), color: '#4caf7d' }], text: `Dopo questa sequenza la valutazione è ${ev.text} per te. Torniamo alla posizione: gioca ${san}, oppure scegli tu un'altra mossa.`, speech: `Dopo questa sequenza la valutazione è ${ev.speech} per te. Torniamo alla posizione: gioca ${san}, oppure scegli tu un'altra mossa.`, tag: 'Suggerimento', jump: true },
    ];
    await lesson(steps);
    resume(); restart();
  }

  return { review, hint, note, clear, close: () => tutor.close(true) };
}

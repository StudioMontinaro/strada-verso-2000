// Studio: percorso a livelli senza scadenza e lettore delle lezioni.
import { Chess } from './chess.js';
import { Board } from './board.js';
import { itSan, winPct, fmtEval } from './analysis.js';
import { LESSONS, CATS, SYLLABUS } from './lessons-data.js';
import { STAGES, rating, stageOf, markActive } from './path.js';
import { loadDB, startPosition, addStudyItems } from './puzzles.js';
import { sound, buzz, confetti } from './fx.js';
import { EvalBar } from './evalbar.js';
import { Tutor, refuteLesson } from './tutor.js';

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
export const studyState = () => load('study', { done: {}, at: {} });
const DAY_CAT = { 1: 'fi', 2: 'ta', 3: 'ap', 4: 'me', 5: 'fi' };

function posOf(s) {
  const c = new Chess(s.fen || undefined);
  if (s.moves) for (const m of s.moves.split(' ').filter(Boolean)) c.move(m);
  return c;
}
const uciOf = m => m.from + m.to + (m.promotion || '');
const kingInCheck = c => { if (!c.inCheck()) return null; for (const r of c.board()) for (const p of r) if (p && p.type === 'k' && p.color === c.turn()) return p.square; return null; };
const COL = { g: '#4caf7d', r: '#e2504c', y: '#f0c060', b: '#5aa0e0' };

// Lezione consigliata oggi: la prossima non fatta del livello attuale, nella categoria del giorno se possibile.
export function todayLesson() {
  const st = studyState();
  const stage = stageOf(rating().r).n;
  const pool = LESSONS.filter(l => l.stage <= stage && !st.done[l.id]);
  const cat = DAY_CAT[new Date().getDay()];
  return pool.find(l => l.cat === cat) || pool[0] || null;
}
export function lessonDoneToday() {
  const st = studyState(), t = new Date().toDateString();
  return Object.values(st.done).some(d => new Date(d).toDateString() === t);
}

export function installStudyViews(ctx) {
  const { views, app, $, esc, go, toast, getEngine, askClaude, fmtAI, describePosition, setCleanup } = ctx;

  views.study = (opts = {}) => {
    const st = studyState();
    const cur = stageOf(rating().r).n;
    const shown = opts.stage || cur;
    const S = STAGES.find(s => s.n === shown);
    const lessons = LESSONS.filter(l => l.stage === shown);
    const done = lessons.filter(l => st.done[l.id]).length;
    const next = todayLesson();
    app.innerHTML = `
    <section class="hero">
      <div class="eyebrow">Livello ${S.n} di 4 · da ${S.from} a ${S.to}</div>
      <h1>${esc(S.title)}</h1>
      <p class="muted">${esc(S.focus)}</p>
      ${next && shown === cur ? `<button class="btn primary big" id="next">${CATS[next.cat].icon} Lezione di oggi: ${esc(next.title)}</button>` : ''}
    </section>
    <div class="row"><button class="btn" id="toPz">✦ Puzzle</button><button class="btn" id="toCo">⌖ Coordinate</button><button class="btn" id="toLib">📖 Le tue aperture</button></div>
    <div class="stagebar">${STAGES.map(s => `<button data-s="${s.n}" class="${s.n === shown ? 'on' : ''} ${s.n < cur ? 'past' : ''}"><b>${s.n}</b><span>${s.to}</span></button>`).join('')}</div>
    ${lessons.length ? `
    <section class="panel">
      <div class="phead"><h3>Lezioni</h3><span class="muted small">${done} di ${lessons.length} completate</span></div>
      <div class="meter"><i style="width:${lessons.length ? done / lessons.length * 100 : 0}%"></i></div>
      ${Object.keys(CATS).map(c => {
        const ls = lessons.filter(l => l.cat === c);
        if (!ls.length) return '';
        return `<h4 class="cath">${CATS[c].icon} ${CATS[c].name}</h4><ul class="llist">${ls.map(l => `<li data-l="${l.id}" class="${st.done[l.id] ? 'done' : ''}"><span class="lcheck">${st.done[l.id] ? '✓' : ''}</span><div><b>${esc(l.title)}</b><span class="muted small">${esc(l.goal)}</span></div></li>`).join('')}</ul>`;
      }).join('')}
    </section>` : `
    <section class="panel"><h3>Programma del livello</h3>
      <p class="muted small">Le lezioni di questo livello verranno aggiunte quando ci arrivi. Ecco gli argomenti previsti.</p>
      <ul class="syl">${(SYLLABUS[shown] || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </section>`}
    <p class="foot muted">Nessuna scadenza: passi al livello successivo quando il tuo rating Lichess blitz supera ${S.to}. Aggiornalo dalla Home.</p>`;
    $('#next')?.addEventListener('click', () => go('lesson', { id: next.id }));
    $('#toPz').onclick = () => go('puzzles');
    $('#toCo').onclick = () => go('coords');
    $('#toLib').onclick = () => go('genlist');
    app.querySelectorAll('[data-s]').forEach(b => b.onclick = () => go('study', { stage: +b.dataset.s }));
    app.querySelectorAll('[data-l]').forEach(li => li.onclick = () => go('lesson', { id: li.dataset.l }));
  };

  views.genlist = () => {
    const all = load('gen-lessons', []);
    const st = studyState();
    app.innerHTML = `<section class="panel"><h2>Le tue aperture</h2>
      <p class="muted small">Lezioni costruite sulle tue partite. Si creano dalla revisione di una partita con il pulsante della lezione sull'apertura.</p>
      ${all.length ? `<ul class="llist">${all.map(l => `<li data-l="${l.id}" class="${st.done[l.id] ? 'done' : ''}"><span class="lcheck">${st.done[l.id] ? '✓' : ''}</span><div><b>${esc(l.title)}</b><span class="muted small">${l.side === 'w' ? 'con il Bianco' : 'con il Nero'}</span></div></li>`).join('')}</ul>` : '<p>Nessuna lezione ancora.</p>'}
    </section>`;
    app.querySelectorAll('[data-l]').forEach(li => li.onclick = () => go('lesson', { id: li.dataset.l }));
  };

  views.lesson = async ({ id, step = null, lesson = null, daily }) => {
    const L = lesson || LESSONS.find(l => l.id === id) || load('gen-lessons', []).find(l => l.id === id);
    if (!L) return go('study');
    id = L.id;
    const st = studyState();
    let k = step ?? (st.done[id] ? 0 : (st.at[id] || 0));
    let alive = true;
    const timers = [];
    setCleanup(() => { alive = false; timers.forEach(clearTimeout); });
    const wait = ms => new Promise(r => timers.push(setTimeout(r, ms)));
    app.innerHTML = `
    <section class="lesson">
      <div class="lhead"><button class="iconbtn" id="back" aria-label="Indietro">‹</button><div><div class="muted small">${CATS[L.cat].icon} ${CATS[L.cat].name}</div><b>${esc(L.title)}</b></div></div>
      <div class="dots" id="dots">${L.steps.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>
      <div class="bwrap"><div class="evalbar" id="eb"><div></div><span></span></div><div id="board"></div></div>
      <div class="lcard" id="card"></div>
      <div class="row" id="ctl"></div>
      <details class="ask"><summary>💬 Fai una domanda a Claude su questa posizione</summary>
        <textarea id="q" rows="2" placeholder="Per esempio: perché non posso giocare subito d4?"></textarea>
        <button class="btn small" id="askb">Chiedi</button><div class="ai" id="ans"></div></details>
    </section>`;
    $('#back').onclick = () => go(daily !== undefined ? 'today' : 'study', { stage: L.stage });
    const board = new Board($('#board'));
    const bar = new EvalBar($('#eb'));
    let showEval = load('settings', {}).lessonEval === true;
    let curFen = null, evalTok = 0;
    const evalPos = async fen => {
      curFen = fen;
      if (!showEval) { bar.hide(); return; }
      const tok = ++evalTok;
      try {
        const eng = await getEngine();
        await eng.configure({ 'UCI_LimitStrength': 'false', 'Skill Level': 20 });
        const s = fen.split(' ')[1] === 'w' ? 1 : -1;
        await eng.search(fen, 'go depth 14 movetime 2500', { onInfo: i => { if (tok === evalTok && alive && i.depth >= 3) bar.set(s * i.cp, i.mate === null ? null : s * i.mate); } });
      } catch { /* motore non disponibile */ }
    };
    const setPos = (opts, animate = true) => {
      const c = new Chess(opts.fen);
      const o = { arrows: [], marks: null, last: null, sel: null, dests: [], hintSq: null, check: kingInCheck(c), ...opts };
      if (animate) board.set(o); else board.jump(o);
      evalPos(opts.fen);
    };
    const card = $('#card'), ctl = $('#ctl');
    const dots = () => $('#dots').querySelectorAll('i').forEach((d, i) => d.className = i < k ? 'ok' : i === k ? 'cur' : '');
    const orientOf = (s, c) => s.orient || (s.fen ? c.turn() : (L.side || 'w'));
    const arrowsOf = s => (s.arrows || []).map(([f, t, c]) => ({ from: f, to: t, color: COL[c] || COL.g }));

    async function runStep() {
      if (!alive) return;
      dots();
      const s0 = studyState(); s0.at[id] = k; save('study', s0);
      if (k >= L.steps.length) return finishLesson();
      const s = L.steps[k];
      board.interactive = false; board.onMove = null;
      if (s.t === 'text') return stepText(s);
      if (s.t === 'line') return stepLine(s);
      if (s.t === 'find') return stepFind(s);
      if (s.t === 'puzzle') return stepPuzzle(s);
      if (s.t === 'practice') return stepPractice(s);
    }
    const nextBtn = (label = 'Avanti') => {
      ctl.innerHTML = `${k > 0 ? '<button class="btn" id="prev">‹</button>' : ''}<button class="btn primary" id="nx">${label}</button>`;
      $('#nx').onclick = () => { k++; runStep(); };
      $('#prev')?.addEventListener('click', () => { k--; runStep(); });
    };

    function stepText(s) {
      const c = posOf(s);
      board.orient = orientOf(s, c);
      setPos({ fen: c.fen(), arrows: arrowsOf(s), marks: s.marks }, false);
      card.innerHTML = `<p>${esc(s.text)}</p>`;
      nextBtn();
    }

    function stepLine(s) {
      const c0 = posOf(s);
      const moves = s.line.split(' ');
      const fens = [c0.fen()], played = [];
      const c = new Chess(c0.fen());
      for (const m of moves) { const mv = c.move(m); played.push(mv); fens.push(c.fen()); }
      board.orient = orientOf(s, c0);
      let i = 0;
      const show = anim => {
        const m = played[i - 1];
        setPos({ fen: fens[i], last: m ? { from: m.from, to: m.to } : null }, anim);
        const num = j => { const ply = fens[0].split(' ')[1] === 'w' ? j : j + 1; const n = Math.floor(ply / 2) + +fens[0].split(' ')[5]; return ply % 2 === 0 ? `${n}.` : `${n}…`; };
        const list = played.map((mv, j) => `<span class="lm ${j === i - 1 ? 'cur' : ''}" data-j="${j + 1}">${j === 0 || (num(j).endsWith('.')) ? num(j) + ' ' : ''}${esc(itSan(mv.san))}</span>`).join(' ');
        const note = m ? (s.notes?.[i - 1] || '') : (s.text || 'Premi ▶ per vedere la prima mossa.');
        card.innerHTML = `<div class="lmoves">${list}</div><p class="note">${m ? `<b>${esc(itSan(m.san))}</b> ` : ''}${esc(note)}</p>`;
        card.querySelectorAll('.lm').forEach(x => x.onclick = () => { i = +x.dataset.j; show(true); });
        ctl.innerHTML = `<button class="btn" id="lp" ${i === 0 ? 'disabled' : ''}>◀</button><button class="btn" id="ln" ${i === moves.length ? 'disabled' : ''}>▶</button><button class="btn ${i === moves.length ? 'primary' : ''}" id="nx">Avanti</button>`;
        $('#lp').onclick = () => { i--; show(false); };
        $('#ln').onclick = () => { i++; show(true); };
        $('#nx').onclick = () => { k++; runStep(); };
      };
      show(false);
    }

    // Esercizio: trova la mossa (o la sequenza). Le risposte dell'avversario sono automatiche.
    function solve({ fen, solution, alts = [], intro = null, okText, onDone, allowEngineAlt = true }) {
      const c = new Chess(fen);
      const solver = c.turn();
      board.orient = solver;
      let j = 0, errors = 0, hint = false, over = false;
      window.__solve = () => ({ next: solution[j], over });
      const legal = sq => c.moves({ square: sq, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion }));
      const prompt = card.querySelector('.fb');
      const say = html => { if (prompt) prompt.innerHTML = html; };
      const draw = (last, extra = {}) => setPos({ fen: c.fen(), last, interactive: !over && c.turn() === solver, legal, ...extra });
      if (intro) {
        setPos({ fen: intro.fenBefore, interactive: false }, false);
        timers.push(setTimeout(() => { if (alive) draw({ from: intro.from, to: intro.to }); }, 600));
      } else draw(null);
      board.legal = legal;
      ctl.innerHTML = `<button class="btn" id="hint">💡 Suggerimento</button><button class="btn" id="sol">Soluzione</button>`;
      const finish = solved => {
        over = true; board.interactive = false;
        $('#board').classList.remove('ko'); if (solved) $('#board').classList.add('okb');
        timers.push(setTimeout(() => $('#board')?.classList.remove('okb'), 700));
        if (solved) { sound('good'); buzz(20); }
        onDone({ solved, clean: solved && !errors && !hint });
      };
      board.onMove = async mv => {
        if (over) return;
        const u = mv.from + mv.to + (mv.promotion || '');
        const before = c.fen();
        let m; try { m = c.move(mv); } catch { draw(null); return; }
        let ok = u === solution[j] || c.isCheckmate() || (j === 0 && alts.includes(u));
        if (!ok && allowEngineAlt && j === 0) {
          // Mossa diversa ma forse buona: la valuta Stockfish.
          draw({ from: m.from, to: m.to }, { interactive: false });
          say('<span class="muted">Verifico con Stockfish…</span>');
          try {
            const eng = await getEngine();
            await eng.configure({ 'UCI_LimitStrength': 'false', 'Skill Level': 20 });
            const a = await eng.search(before, 'go depth 12 movetime 2000');
            const b = await eng.search(c.fen(), 'go depth 12 movetime 2000');
            if (-b.cp >= a.cp - 25) {
              c.undo();
              say(`<b class="goodtxt">${esc(itSan(m.san))} è una buona mossa</b> <span class="muted">secondo Stockfish, ma qui l'esercizio chiede l'idea della lezione: cercane un'altra.</span>`);
              draw(null);
              return;
            }
          } catch { /* senza motore si considera sbagliata */ }
        }
        if (!ok) {
          c.undo(); errors++;
          sound('bad'); buzz(60);
          const b = $('#board'); b.classList.remove('ko'); void b.offsetWidth; b.classList.add('ko');
          say(`<b class="errtxt">✕ ${esc(itSan(m.san))} non è la mossa giusta.</b> <span class="muted">Riprova.</span> <button class="btn small" id="whyno">🎓 Perché no?</button>`);
          draw(null);
          const wrong = u;
          $('#whyno').onclick = async ev => {
            ev.target.disabled = true; ev.target.textContent = 'Il tutor sta guardando…';
            try {
              const eng = await getEngine();
              await eng.configure({ 'UCI_LimitStrength': 'false', 'Skill Level': 20 });
              const t = new Chess(before); t.move({ from: wrong.slice(0, 2), to: wrong.slice(2, 4), promotion: wrong[4] });
              const r = await eng.search(t.fen(), 'go depth 12 movetime 2000');
              const tutor = new Tutor(board.el.closest('.bwrap') || board.el, board);
              tutor.run(refuteLesson({ fenBefore: before, played: wrong, refutation: r.pv || [], me: solver }), { onClose: () => { if (alive) draw(null); } });
            } catch (e) { toast('Motore: ' + e.message); }
            ev.target.disabled = false; ev.target.textContent = '🎓 Perché no?';
          };
          return;
        }
        j++;
        draw({ from: m.from, to: m.to }, { interactive: false });
        if (j >= solution.length || c.isCheckmate()) { say(`<b class="goodtxt">✓ ${esc(okText || 'Giusto!')}</b>`); return finish(true); }
        say('<b class="goodtxt">✓ Giusto.</b> <span class="muted">Continua.</span>');
        await wait(500); if (!alive) return;
        const r = solution[j];
        const rm = c.move({ from: r.slice(0, 2), to: r.slice(2, 4), promotion: r[4] }); j++;
        draw({ from: rm.from, to: rm.to });
        if (j >= solution.length) { say(`<b class="goodtxt">✓ ${esc(okText || 'Giusto!')}</b>`); finish(true); }
      };
      $('#hint').onclick = () => { if (over) return; hint = true; board.set({ hintSq: solution[j].slice(0, 2), sel: null, dests: [] }); say('💡 Muovi il pezzo evidenziato.'); };
      $('#sol').onclick = async () => {
        if (over) return;
        over = true; errors++; board.interactive = false;
        while (j < solution.length) {
          const u = solution[j]; const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); j++;
          draw({ from: m.from, to: m.to }, { interactive: false });
          await wait(700); if (!alive) return;
        }
        say(`<span class="muted">Soluzione: </span>${esc(okText || '')}`);
        onDone({ solved: false, clean: false });
      };
    }

    // Nella lezione del giorno una soluzione mostrata non basta: l'esercizio va rifatto da solo.
    function afterSolve(r) {
      ctl.innerHTML = '';
      if (daily !== undefined && !r.solved) {
        ctl.innerHTML = '<button class="btn primary" id="redo">↺ Ora rifallo tu</button>';
        $('#redo').onclick = () => runStep();
        return;
      }
      nextBtn();
    }

    function toUci(fen, sans) {
      const c = new Chess(fen); return sans.map(sn => uciOf(c.move(sn)));
    }

    function stepFind(s) {
      const c = posOf(s);
      const fen = c.fen();
      const list = Array.isArray(s.solution) ? s.solution : null;
      const solution = list ? toUci(fen, [list[0]]) : toUci(fen, s.solution.split(' '));
      const alts = list ? list.slice(1).map(x => toUci(fen, [x])[0]) : [];
      card.innerHTML = `<p class="prompt"><span class="side ${c.turn()}"></span> ${esc(s.text)}</p><p class="fb"></p>`;
      solve({ fen, solution, alts, okText: s.ok, onDone: afterSolve });
    }

    async function stepPuzzle(s) {
      const db = await loadDB();
      const p = db.find(x => x.id === s.id);
      if (!p) { card.innerHTML = '<p class="muted">Puzzle non trovato.</p>'; return nextBtn(); }
      const start = startPosition(p);
      const side = new Chess(start.fen).turn();
      card.innerHTML = `<p class="prompt"><span class="side ${side}"></span> ${esc(s.text || `Tocca al ${side === 'w' ? 'Bianco' : 'Nero'}: trova la mossa migliore.`)}</p><p class="fb"></p>`;
      solve({ fen: start.fen, solution: start.solution, intro: start.intro, allowEngineAlt: false, okText: 'Risolto.', onDone: afterSolve });
    }

    // Gioca la posizione contro Stockfish a piena forza fino all'obiettivo.
    async function stepPractice(s) {
      const c = new Chess(s.fen);
      const me = c.turn();
      board.orient = me;
      let n = 0, over = false;
      const legal = sq => c.moves({ square: sq, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion }));
      const goalTxt = s.goal === 'mate' ? 'dai matto' : 'promuovi il pedone';
      const head = () => `<p class="prompt"><span class="side ${me}"></span> ${esc(s.text)}</p><p class="muted small">Mosse usate: <b>${n}</b> di ${s.max}</p>`;
      card.innerHTML = head();
      const draw = last => setPos({ fen: c.fen(), last, interactive: !over && c.turn() === me, legal });
      draw(null);
      ctl.innerHTML = '<button class="btn" id="restart">↺ Ricomincia</button>' + (daily !== undefined ? '' : '<button class="btn" id="skip">Salta</button>');
      $('#restart').onclick = () => runStep();
      $('#skip')?.addEventListener('click', () => { over = true; k++; runStep(); });
      let eng;
      try { eng = await getEngine(); await eng.newGame(); await eng.configure({ 'UCI_LimitStrength': 'false', 'Skill Level': 20 }); }
      catch (e) { card.innerHTML += `<p class="err">Serve il motore: ${esc(e.message)}</p>`; return; }
      const end = (win, why) => {
        over = true; board.interactive = false;
        card.innerHTML = head() + `<p class="${win ? 'goodtxt' : 'errtxt'}"><b>${win ? '✓ Obiettivo raggiunto' : '✕ ' + why}</b></p>`;
        if (win) { sound('win'); confetti(0.6); ctl.innerHTML = ''; nextBtn(); }
        else { sound('bad'); ctl.innerHTML = '<button class="btn primary" id="restart">↺ Riprova</button>' + (daily !== undefined ? '' : '<button class="btn" id="skip">Salta</button>'); $('#restart').onclick = () => runStep(); $('#skip')?.addEventListener('click', () => { k++; runStep(); }); }
      };
      board.onMove = async mv => {
        if (over) return;
        let m; try { m = c.move(mv); } catch { draw(null); return; }
        n++; card.innerHTML = head();
        draw({ from: m.from, to: m.to });
        if (s.goal === 'promote' && m.promotion) return end(true);
        if (c.isCheckmate()) return end(s.goal === 'mate', 'Matto, ma l\'obiettivo era un altro');
        if (c.isStalemate()) return end(false, 'Stallo: è patta. Lascia sempre una casa libera al re avversario.');
        if (c.isDraw()) return end(false, 'Patta: il vantaggio è sfumato.');
        if (n >= s.max) return end(false, `Hai finito le ${s.max} mosse a disposizione.`);
        const r = await eng.search(c.fen(), 'go depth 14 movetime 900');
        if (!alive || over) return;
        if (r.mate === null && r.cp > 150) return end(false, 'Stockfish dice che la posizione non è più vinta.');
        const u = r.bestmove;
        const em = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        draw({ from: em.from, to: em.to });
        if (c.isDraw()) return end(false, 'Patta: il vantaggio è sfumato.');
      };
    }

    function finishLesson() {
      const s = studyState();
      const first = !s.done[id];
      s.done[id] = s.done[id] || Date.now(); s.at[id] = 0; save('study', s);
      markActive();
      // Gli esercizi della lezione entrano nella ripetizione spaziata.
      const items = [];
      L.steps.forEach((st, i) => {
        if (st.t !== 'find') return;
        const c = posOf(st); const fen = c.fen();
        const list = Array.isArray(st.solution) ? st.solution : null;
        const line = list ? toUci(fen, [list[0]]) : toUci(fen, st.solution.split(' '));
        items.push({ id: `L:${id}:${i}`, fen, line, alts: list ? list.slice(1).map(x => toUci(fen, [x])[0]) : [], study: true, themes: ['study'], title: L.title, rating: null });
      });
      if (items.length) addStudyItems(items);
      board.interactive = false;
      card.innerHTML = `<div class="donecard"><div class="big">✓</div><h3>Lezione completata</h3><p class="muted">${items.length ? `${items.length} ${items.length === 1 ? 'esercizio entra' : 'esercizi entrano'} nel ripasso dei puzzle: li ritroverai domani e poi a intervalli crescenti.` : 'Ottimo lavoro.'}</p></div>`;
      if (daily !== undefined) ctx.markPhase(daily);
      ctl.innerHTML = daily !== undefined ? `<button class="btn primary" id="nxl">Continua la lezione del giorno ▶</button>` : `<button class="btn primary" id="nxl">Torna al percorso</button><button class="btn" id="again">Rifai</button>`;
      $('#nxl').onclick = () => go(daily !== undefined ? 'today' : 'study', { stage: L.stage });
      $('#again')?.addEventListener('click', () => { k = 0; runStep(); });
      if (first) { sound('win'); confetti(); }
    }

    $('#askb').onclick = async e => {
      const q = $('#q').value.trim();
      if (!q || !curFen) return;
      e.target.disabled = true;
      $('#ans').innerHTML = '<p class="muted">Stockfish analizza, poi Claude risponde…</p>';
      try {
        const eng = await getEngine();
        await eng.configure({ 'UCI_LimitStrength': 'false', 'Skill Level': 20, 'MultiPV': 3 });
        const raw = await eng.searchMulti(curFen, 'go depth 14 movetime 3000');
        await eng.configure({ 'MultiPV': 1 });
        const sg = curFen.split(' ')[1] === 'w' ? 1 : -1;
        const lines = raw.map(l => {
          const t = new Chess(curFen); const san = [];
          for (const u of l.pv.slice(0, 6)) { try { san.push(itSan(t.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san)); } catch { break; } }
          return { san, eval: fmtEval({ cp: sg * l.cp, mate: l.mate === null ? null : sg * l.mate }) };
        });
        const step = L.steps[Math.min(k, L.steps.length - 1)];
        const user = `Sto studiando la lezione "${L.title}" (${L.goal}).
Testo del passo: ${step?.text || ''}
Posizione (FEN ${curFen}):
${describePosition(curFen)}
Analisi di Stockfish (tre linee migliori, valutazioni dal punto di vista del Bianco):
${lines.map(l => `- ${l.san.join(' ')} (${l.eval})`).join('\n') || 'n.d.'}

Domanda: ${q}

Rispondi in 80-160 parole usando solo le linee di Stockfish indicate quando citi varianti concrete.`;
        $('#ans').innerHTML = fmtAI(await askClaude(user, 600));
      } catch (err) { $('#ans').innerHTML = `<p class="err">${esc(err.message)}</p>`; }
      e.target.disabled = false;
    };

    // Valutazione a richiesta: tocca la barra per accenderla o spegnerla.
    $('#eb').onclick = () => {
      showEval = !showEval;
      const s = load('settings', {}); s.lessonEval = showEval; save('settings', s);
      toast(showEval ? 'Valutazione di Stockfish attiva' : 'Valutazione nascosta');
      evalPos(curFen);
    };
    runStep();
  };
}

// Schermate dei puzzle (fase 2). Le funzioni di contesto arrivano da app.js.
import { dailyState } from './daily.js';
import { Chess } from './chess.js';
import { Board } from './board.js';
import { itSan, winPct } from './analysis.js';
import { sound, buzz, confetti } from './fx.js';
import { Tutor, refuteLesson } from './tutor.js';
import { stopSpeech } from './speech.js';
import { THEME_IT, TRAIN_THEMES, loadDB, pzState, pzRating, personal, addPersonalFromGame, dueCount, recordResult, themeStats, weakThemes, buildSession, startPosition } from './puzzles.js';

export function installPuzzleViews(ctx) {
  const { views, app, $, esc, go, toast, store, games, getEngine, askClaude, fmtAI, describePosition, setCleanup } = ctx;
  const tname = t => THEME_IT[t] || t;
  const SESSION_MS = 15 * 60000;

  views.puzzles = async () => {
    for (const g of games()) addPersonalFromGame(g); // recupera anche le partite analizzate prima della fase 2
    app.innerHTML = '<p class="muted">Carico l\'archivio dei puzzle…</p>';
    const db = await loadDB();
    const R = pzRating();
    const st = pzState();
    const pers = personal();
    const persNew = pers.filter(p => !st[p.id]).length;
    const ts = themeStats();
    const weak = weakThemes(games()).slice(0, 4);
    const seen = Object.keys(st).length;
    app.innerHTML = `
    <section class="hero">
      <div class="eyebrow">Tattica · ripetizione spaziata</div>
      <h1>Puzzle</h1>
      <button class="btn primary big" id="today">✦ Allenamento di oggi · 15 min</button>
    </section>
    <section class="cards">
      <div class="card"><div class="k">Rating puzzle</div><div class="v">${R.r}</div><div class="s">${R.hist.length} puzzle valutati</div></div>
      <div class="card"><div class="k">Da ripassare oggi</div><div class="v">${dueCount()}</div><div class="s">${persNew} tuoi errori nuovi</div></div>
    </section>
    <section class="panel"><h3>Coordinate</h3><p class="muted small">Riconoscere le case all'istante rende più veloce e sicuro il calcolo.</p><button class="btn" id="coords">⌖ Allenamento coordinate</button></section>
    ${weak.length ? `<section class="panel"><h3>Su cosa insistere</h3><p class="muted small">Ricavato dagli errori delle tue partite e dai puzzle sbagliati.</p><div class="chips">${weak.map(t => `<button class="chip" data-t="${t}">${esc(tname(t))}</button>`).join('')}</div></section>` : ''}
    ${pers.length ? `<section class="panel"><h3>I tuoi errori (${pers.length})</h3><p class="muted small">Ogni errore grave delle tue partite analizzate è diventato un puzzle: ritrova la mossa giusta.</p><button class="btn" id="mine">Allenati sui tuoi errori</button></section>` : ''}
    <section class="panel"><h3>Per tema</h3>
      <div class="tgrid">${TRAIN_THEMES.map(t => { const s = ts[t]; return `<button class="tcell" data-t="${t}"><b>${esc(tname(t))}</b><span>${s ? Math.round(s.ok / s.n * 100) + '% su ' + s.n : 'non ancora provato'}</span></button>`; }).join('')}</div>
    </section>
    <p class="foot muted">Archivio: ${db.length} puzzle selezionati dalla base dati pubblica di Lichess (licenza CC0), rating 1100-2050. Ne hai visti ${seen}.</p>`;
    $('#today').onclick = () => go('session');
    $('#coords').onclick = () => go('coords');
    $('#mine')?.addEventListener('click', () => go('session', { mine: true }));
    app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => go('session', { theme: b.dataset.t }));
  };

  views.session = async (opts = {}) => {
    app.innerHTML = '<p class="muted">Preparo la sessione…</p>';
    for (const g of games()) addPersonalFromGame(g);
    let queue;
    if (opts.queue) queue = opts.queue;
    else if (opts.mine) {
      const st = pzState();
      queue = personal().slice().sort((a, b) => (st[a.id]?.ok || 0) - (st[b.id]?.ok || 0));
    } else queue = await buildSession(games(), { theme: opts.theme || null, size: opts.count || 40 });
    // Ripresa delle sessioni della lezione del giorno: stessa coda, stesso puzzle, stessi conteggi.
    const PKEY = 'session-progress';
    const pday = opts.daily !== undefined ? dailyState().dayNo : null;
    let psaved = opts.daily !== undefined ? store.get(PKEY, null) : null;
    if (psaved && (psaved.day !== pday || psaved.daily !== opts.daily || !Array.isArray(psaved.queue))) psaved = null;
    if (psaved) queue = psaved.queue;
    if (!queue.length) { app.innerHTML = '<section class="panel"><p>Nessun puzzle disponibile per questa selezione.</p></section>'; return; }
    const S = { start: Date.now(), done: 0, ok: 0, idx: 0, timed: !opts.theme && !opts.mine && !opts.queue && opts.daily === undefined, results: [] };
    let resumeCur = null;
    if (psaved) { Object.assign(S, { done: psaved.done, ok: psaved.ok, idx: psaved.idx, streak: psaved.streak || 0, results: psaved.results || [] }); resumeCur = psaved.cur || null; setTimeout(() => toast('Riprendi dal punto in cui avevi interrotto'), 300); }
    const persistS = (idx, cur = null) => { if (opts.daily !== undefined) store.set(PKEY, { day: pday, daily: opts.daily, queue, idx, done: S.done, ok: S.ok, streak: S.streak || 0, results: S.results, cur }); };
    let alive = true;
    setCleanup(() => { alive = false; });
    const title = opts.title || (opts.theme ? tname(opts.theme) : opts.mine ? 'I tuoi errori' : 'Allenamento di oggi');
    app.innerHTML = `
    <section class="pz">
      <div class="pzhead"><div><b>${esc(title)}</b><div class="muted small" id="pzcount"></div></div><div class="ptime" id="ptime"></div></div>
      <div class="prompt" id="prompt"></div>
      <div id="board"></div>
      <div class="row" id="pzbtns"></div>
      <div class="info" id="pzinfo"></div>
    </section>`;
    const board = new Board($('#board'));
    const timer = setInterval(() => {
      if (!alive) return clearInterval(timer);
      const el = $('#ptime'); if (!el) return;
      if (S.timed) {
        const left = SESSION_MS - (Date.now() - S.start);
        el.textContent = left > 0 ? `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}` : 'tempo!';
        el.classList.toggle('low', left < 60000);
      } else el.textContent = '';
      $('#pzcount').innerHTML = `${S.done} risolti · ${S.ok} al primo colpo${S.streak >= 2 ? ` · <span class="streak">🔥 ${S.streak}</span>` : ''}`;
    }, 500);

    const finishSession = () => {
      alive = false; clearInterval(timer);
      const day = 'pz-done-' + new Date().toDateString();
      store.set(day, store.get(day, 0) + Math.round((Date.now() - S.start) / 60000));
      const R = pzRating();
      if (S.done >= 5 && S.ok / S.done >= 0.8) { sound('win'); confetti(); }
      app.innerHTML = `<section class="panel"><h2>Sessione finita</h2>
        <div class="cards"><div class="card"><div class="k">Puzzle</div><div class="v">${S.done}</div><div class="s">${S.ok} risolti al primo colpo</div></div>
        <div class="card"><div class="k">Rating puzzle</div><div class="v">${R.r}</div></div></div>
        ${S.results.filter(r => !r.ok).length ? `<h3>Da rivedere</h3><p class="muted small">Torneranno domani, poi a intervalli crescenti finché non li risolvi con sicurezza.</p><ul class="crit">${S.results.filter(r => !r.ok).map(r => `<li>${esc(r.themes)}</li>`).join('')}</ul>` : '<p>Tutti risolti al primo colpo.</p>'}
        <div class="row">${opts.daily !== undefined ? '<button class="btn primary" id="cont">Continua la lezione del giorno ▶</button>' : '<button class="btn primary" id="more">Altri puzzle</button><button class="btn" id="home">Home</button>'}</div></section>`;
      if (opts.daily !== undefined) { ctx.markPhase(opts.daily); localStorage.removeItem(PKEY); $('#cont').onclick = () => go('today'); return; }
      $('#more').onclick = () => go('session', opts);
      $('#home').onclick = () => go('home');
    };

    async function play(p) {
      const start = startPosition(p);
      const c = new Chess(start.fen);
      const solver = c.turn();
      let k = 0, failed = false, hint = false, over = false, recorded = null, altSan = null;
      if (resumeCur) { failed = !!resumeCur.failed; hint = !!resumeCur.hint; resumeCur = null; }
      persistS(S.idx - 1, { failed, hint });
      const sol = start.solution;
      window.__pzCurrent = () => ({ sol, k, over });
      const btns = $('#pzbtns'), info = $('#pzinfo'), prompt = $('#prompt');
      const ratingTxt = p.personal ? 'tuo errore' : p.study ? `dalla lezione ${esc(p.title || '')}` : `rating ${p.rating}`;
      prompt.innerHTML = `<span class="side ${solver}"></span> Tocca al <b>${solver === 'w' ? 'Bianco' : 'Nero'}</b>: ${p.personal ? 'trova la mossa che non hai visto in partita' : p.study ? 'ripassa l\'esercizio' : 'trova la mossa migliore'} <span class="muted small">· ${ratingTxt}</span>`;
      info.innerHTML = p.personal ? `<p class="muted small">Dalla tua partita: avevi giocato ${esc(itSan(p.san))} (${esc(p.type || 'errore')}, ${esc(p.phase)}).</p>` : '';
      btns.innerHTML = `<button class="btn" id="hint">💡 Suggerimento</button><button class="btn" id="giveup">Mostra soluzione</button>`;
      const legal = sq => c.moves({ square: sq, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion }));
      const show = (last, extra = {}) => board.set({ fen: c.fen(), orient: solver, last, interactive: !over && c.turn() === solver, legal, sel: null, dests: [], arrows: [], hintSq: null, ...extra });
      const apply = u => { const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); return m; };
      board.orient = solver;
      if (start.intro) {
        board.set({ fen: start.intro.fenBefore, interactive: false, last: null, arrows: [], legal });
        await new Promise(r => setTimeout(r, 650));
        if (!alive) return;
      }
      show(start.intro ? { from: start.intro.from, to: start.intro.to } : null);

      const finish = solved => {
        over = true;
        if (!recorded) recorded = recordResult(p, solved && !failed, hint);
        const ok = solved && !failed && !hint;
        S.done++; if (ok) { S.ok++; S.streak = (S.streak || 0) + 1; } else S.streak = 0;
        if (ok) { sound('good'); const b = $('#board'); b.classList.add('okb'); setTimeout(() => b && b.classList.remove('okb'), 700); if (S.streak && S.streak % 5 === 0) { confetti(0.5); toast(`${S.streak} di fila!`); } }
        S.results.push({ ok, themes: p.themes.filter(t => TRAIN_THEMES.includes(t) || t === 'personal').map(tname).join(', ') });
        persistS(S.idx);
        const days = Math.round((recorded.next - Date.now()) / 86400000);
        const nextTxt = days <= 1 ? 'domani' : `tra ${days} giorni`;
        const themes = p.themes.filter(t => !['short', 'long', 'veryLong', 'oneMove', 'crushing', 'advantage', 'equality', 'master', 'masterVsMaster', 'superGM', 'mix'].includes(t)).map(tname);
        info.innerHTML = `<div class="ihead"><span class="badge" style="--c:${ok ? '#4caf7d' : '#e2504c'}">${ok ? '✓' : '✕'}</span><b>${ok ? 'Risolto' : solved ? 'Risolto con aiuto' : 'Non risolto'}</b>
          ${!p.personal && recorded.delta ? `<span class="ev">${recorded.delta > 0 ? '+' : ''}${recorded.delta} · ${pzRating().r}</span>` : ''}</div>
          <div class="type">${esc(themes.join(' · '))}</div>
          <div class="small muted">${altSan ? `Anche ${esc(altSan)} va bene secondo Stockfish, che preferiva ` : 'Soluzione: '}${esc(solutionSan().join(' '))} · torna ${nextTxt}</div>
          <div class="ai" id="pzai"></div>`;
        btns.innerHTML = `<button class="btn primary" id="next">Prossimo ▶</button><button class="btn" id="why">💬 Perché</button>`;
        board.set({ interactive: false });
        $('#next').onclick = next;
        $('#why').onclick = async e => {
          e.target.disabled = true;
          $('#pzai').innerHTML = '<p class="muted">Claude sta guardando la posizione…</p>';
          try { $('#pzai').innerHTML = fmtAI(await explainPuzzle(p, start, themes)); }
          catch (err) { $('#pzai').innerHTML = `<p class="err">${esc(err.message)}</p>`; e.target.disabled = false; }
        };
      };
      const solutionSan = () => {
        const t = new Chess(start.fen); const out = [];
        for (const u of sol) { try { out.push(itSan(t.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san)); } catch { break; } }
        return out;
      };
      const reveal = async () => {
        failed = true; over = true; board.set({ interactive: false }); persistS(S.idx - 1, { failed, hint });
        while (k < sol.length) {
          const m = apply(sol[k]); k++;
          show({ from: m.from, to: m.to }, { interactive: false });
          await new Promise(r => setTimeout(r, 700));
          if (!alive) return;
        }
        finish(false);
      };
      board.onMove = async mv => {
        if (over) return;
        const u = mv.from + mv.to + (mv.promotion || '');
        const fenBefore = c.fen();
        let m;
        try { m = c.move(mv); } catch { show(null); return; }
        let correct = u === sol[k] || c.isCheckmate() || (k === 0 && (p.alts || []).includes(u));
        if (!correct && p.personal) {
          // Mossa diversa da quella di Stockfish: la si accetta se vale quasi quanto la migliore.
          show({ from: m.from, to: m.to }, { interactive: false });
          prompt.innerHTML = '<span class="muted">Verifico la tua mossa con Stockfish…</span>';
          try {
            const eng = await getEngine();
            await eng.configure({ 'UCI_LimitStrength': 'false', 'Skill Level': 20 });
            const r = await eng.search(c.fen(), 'go depth 12 movetime 3000');
            const mine = -r.cp;
            correct = winPct(mine) >= winPct(p.cp) - 5;
            if (correct) altSan = itSan(m.san);
          } catch { correct = false; }
        }
        if (!correct) {
          c.undo(); failed = true; persistS(S.idx - 1, { failed, hint });
          sound('bad'); buzz(60);
          { const b = $('#board'); b.classList.remove('ko'); void b.offsetWidth; b.classList.add('ko'); }
          show(null, { arrows: [] });
          prompt.innerHTML = `<b class="errtxt">✕ Non è questa.</b> <span class="muted">${esc(itSan(m.san))} non funziona: riprova o guarda la soluzione.</span> <button class="btn small" id="whyno">🎓 Perché no?</button>`;
          board.set({ fen: fenBefore, interactive: true });
          const wrong = m.from + m.to + (m.promotion || '');
          $('#whyno').onclick = () => whyNot(board, fenBefore, wrong, solver, () => { board.jump({ fen: fenBefore, interactive: !over, arrows: [], last: null, sel: null, dests: [] }); });
          return;
        }
        k++;
        show({ from: m.from, to: m.to }, { interactive: false });
        prompt.innerHTML = '<b class="goodtxt">✓ Giusto!</b>';
        if (k >= sol.length || c.isCheckmate()) return finish(true);
        await new Promise(r => setTimeout(r, 450));
        if (!alive) return;
        const reply = apply(sol[k]); k++;
        show({ from: reply.from, to: reply.to });
        prompt.innerHTML = `<b class="goodtxt">✓ Giusto!</b> <span class="muted">Continua.</span>`;
        if (k >= sol.length) finish(true);
      };
      $('#hint').onclick = () => {
        if (over) return;
        hint = true; persistS(S.idx - 1, { failed, hint });
        const u = sol[k];
        board.set({ sel: null, dests: [], hintSq: u.slice(0, 2) });
        prompt.innerHTML = `💡 Muovi il pezzo evidenziato. <span class="muted small">(il puzzle conterà come non risolto)</span>`;
      };
      $('#giveup').onclick = () => { if (!over) reveal(); };
    }

    function next() {
      if (!alive) return;
      if (S.timed && Date.now() - S.start >= SESSION_MS) return finishSession();
      if (S.idx >= queue.length) return finishSession();
      play(queue[S.idx++]);
    }
    next();
  };

  // Il tutor mostra sulla scacchiera perché la mossa sbagliata non funziona.
  async function whyNot(board, fenBefore, uci, me, restore) {
    const btn = $('#whyno'); if (btn) { btn.disabled = true; btn.textContent = 'Il tutor sta guardando…'; }
    try {
      const eng = await getEngine();
      await eng.configure({ 'UCI_LimitStrength': 'false', 'Skill Level': 20 });
      const t = new Chess(fenBefore); t.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      const r = await eng.search(t.fen(), 'go depth 12 movetime 2000');
      const steps = refuteLesson({ fenBefore, played: uci, refutation: r.pv || [], me });
      const tutor = new Tutor(board.el.closest('.bwrap') || board.el, board);
      tutor.run(steps, { onClose: restore });
    } catch (e) { toast('Motore: ' + e.message); }
    if (btn) { btn.disabled = false; btn.textContent = '🎓 Perché no?'; }
  }

  function explainPuzzle(p, start, themes) {
    const t = new Chess(start.fen); const line = [];
    for (const u of start.solution) { try { line.push(itSan(t.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san)); } catch { break; } }
    const user = `Puzzle di tattica${p.personal ? ' tratto da un errore di una mia partita' : ''}. Temi: ${themes.join(', ') || 'n.d.'}.
Posizione (FEN ${start.fen}):
${describePosition(start.fen)}
${start.intro ? `L'ultima mossa dell'avversario è stata ${start.intro.from}-${start.intro.to}.` : ''}
${p.personal ? `In partita avevo giocato ${itSan(p.san)}, classificata da Stockfish come ${p.type || 'errore'}.` : ''}
Soluzione corretta (verificata): ${line.join(' ')}

Spiegami in 100-150 parole qual è l'idea della soluzione, perché funziona e quale segnale nella posizione avrebbe dovuto farmela cercare. Chiudi con una regola pratica in una frase. Non aggiungere varianti diverse dalla soluzione indicata.`;
    return askClaude(user, 600);
  }
}

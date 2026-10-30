// La lezione del giorno: sei fasi in ordine obbligato, come in un corso.
// Non si passa alla fase successiva finché quella in corso non è completata.
import { Chess } from './chess.js';
import { Board } from './board.js';
import { itSan, winPct } from './analysis.js';
import { MODULES } from './repertoire-data.js';
import { LESSONS, CATS } from './lessons-data.js';
import { rating, stageOf, markActive } from './path.js';
import { loadDB, pzState, personal, studyItems, pzRating, weakThemes } from './puzzles.js';
import { weakestPhase, phaseStats, PHASE_ADVICE, buildOpeningLesson } from './coach.js';
import { loadOpenings, identify } from './openings.js';
import { sound, buzz, confetti } from './fx.js';
import { Tutor, refuteLesson } from './tutor.js';
import { speak, stopSpeech } from './speech.js';
import { explainLine, lineIntro, theoryOverview } from './opening-tutor.js';

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const todayKey = () => new Date().toDateString();
const DAY = 86400000;
const INTERVALS = [1, 3, 7, 14, 30, 60];

export const PHASE_DEFS = [
  { key: 'warm', icon: '✦', title: 'Riscaldamento', desc: 'Ripasso a intervalli: puzzle e posizioni da rivedere oggi.' },
  { key: 'open', icon: '♙', title: "Apertura della settimana", desc: '' },
  { key: 'game', icon: '♞', title: 'Tre partite del giorno', desc: 'Almeno tre partite, contro Stockfish o tue partite di oggi su Lichess. Puoi giocarne anche di più.' },
  { key: 'review', icon: '🎓', title: 'Revisione con il tutor', desc: 'Per ogni partita: prima segni tu i tuoi errori, poi il confronto con Stockfish e il tutor su ogni errore.' },
  { key: 'target', icon: '🎯', title: 'Lezione mirata', desc: 'Sulla fase di gioco in cui perdi più punti.' },
  { key: 'mine', icon: '↺', title: 'I tuoi errori di oggi', desc: 'Rifai le posizioni in cui hai sbagliato.' },
  { key: 'coord', icon: '▦', title: 'Coordinate', desc: 'Due giri da 30 secondi: le case della scacchiera devono diventare un riflesso.' },
];
export const MIN_GAMES = 3;

// ---------- stato ----------
export function plan() { return load('opening-plan', { mod: 0, days: 0, srs: {} }); }
const savePlan = p => save('opening-plan', p);
export function currentModule() { const p = plan(); return MODULES[p.mod % MODULES.length]; }

export function dailyState() {
  let d = load('daily', null);
  // Una lezione iniziata e non finita resta aperta anche il giorno dopo: si riprende da dove la si è lasciata.
  const unfinished = d && !d.finished && (d.started || d.done.some(Boolean));
  if (!d || (d.date !== todayKey() && !unfinished)) {
    d = { date: todayKey(), done: PHASE_DEFS.map(() => false), gameId: null, gameIds: [], reviewed: [], coordRounds: 0, dayNo: load('daily-count', 0) + 1 };
    save('daily', d);
  }
  // lezioni iniziate prima dell'aggiornamento: si aggiungono i campi nuovi
  if (!d.finished && d.done.length < PHASE_DEFS.length) { while (d.done.length < PHASE_DEFS.length) d.done.push(false); save('daily', d); }
  if (!d.gameIds) { d.gameIds = d.gameId ? [d.gameId] : []; d.reviewed = d.reviewed || []; d.coordRounds = d.coordRounds || 0; save('daily', d); }
  return d;
}
export function markPhase(i, extra = {}) {
  const d = dailyState();
  if (i > 0 && !d.done[i - 1]) return d; // l'ordine è obbligato
  const was = d.done[i];
  d.done[i] = true; Object.assign(d, extra);
  save('daily', d);
  markActive();
  if (!was && d.done.every(Boolean)) finishDay(d);
  return d;
}
// Partite valide della giornata: la fase "partite" si completa alla terza.
export function addDailyGame(id) {
  const d = dailyState();
  if (!d.gameIds.includes(id)) d.gameIds.push(id);
  d.gameId = d.gameIds[0];
  save('daily', d);
  if (d.gameIds.length >= MIN_GAMES) markPhase(2);
  markActive();
  return dailyState().gameIds.length;
}
// Una partita rivista fino in fondo: la fase "revisione" si completa quando sono riviste tutte.
export function reviewGameDone(id) {
  const d = dailyState();
  if (!d.reviewed.includes(id)) d.reviewed.push(id);
  save('daily', d);
  localStorage.removeItem('tutor-progress');
  localStorage.removeItem('selfrev-draft');
  const left = d.gameIds.filter(g => !d.reviewed.includes(g));
  if (!left.length) { markPhase(3); return true; }
  return false;
}
export function markStarted() { const d = dailyState(); if (!d.started) { d.started = true; save('daily', d); } }
// Punto esatto in cui è stata interrotta la fase in corso (per la Home e la pagina della lezione).
export function resumeInfo() {
  const d = dailyState();
  const i = d.done.indexOf(false);
  if (i < 0) return null;
  if (i === 1) { const s = load('drill-progress', null); if (s && s.day === d.dayNo) { const L = s.queue[s.qi]; if (L) return L.retry ? `ripetizione della linea ${L.n} di ${s.total}` : `linea ${L.n} di ${s.total}${s.k ? ', a metà' : ''}`; } }
  if (i === 0 || i === 4 || i === 5) { const s = load('session-progress', null); if (s && s.day === d.dayNo && s.daily === i) return `puzzle ${Math.min(s.idx + 1, s.queue.length)} di ${s.queue.length}`; }
  if (i === 2) { const s = load('daily-game', null); if (s && s.day === d.dayNo) return `partita ${d.gameIds.length + 1} di ${MIN_GAMES}, mossa ${Math.ceil(s.moves.length / 2)}`; if (d.gameIds.length) return `${d.gameIds.length} di ${MIN_GAMES} partite giocate`; }
  if (i === 3) { const s = load('tutor-progress', null); if (s && d.gameIds.includes(s.gid)) return `partita ${d.reviewed.length + 1} di ${d.gameIds.length}, errore ${s.k + 1} di ${s.n} con il tutor`; if (d.reviewed.length) return `${d.reviewed.length} di ${d.gameIds.length} partite riviste`; }
  if (i === 6 && d.coordRounds) return `${d.coordRounds} giro di 2`;
  return null;
}
export function nextPhase() { const d = dailyState(); const i = d.done.indexOf(false); return i; }

function finishDay(d) {
  save('daily-count', load('daily-count', 0) + 1);
  const p = plan();
  p.days++;
  // finita la settimana, le linee del modulo passano al ripasso a intervalli e si cambia apertura
  if (p.days >= 7) {
    const M = MODULES[p.mod % MODULES.length];
    for (const side of ['white', 'black']) M[side].lines.forEach((_, k) => {
      const key = `${M.id}:${side}:${k}`;
      if (!p.srs[key]) p.srs[key] = { box: 1, due: Date.now() + 3 * DAY };
    });
    p.mod++; p.days = 0;
  }
  savePlan(p);
  d.finished = true; d.date = todayKey(); save('daily', d);
  ['drill-progress', 'session-progress', 'daily-game', 'tutor-progress'].forEach(k => localStorage.removeItem(k));
}

// Linee d'apertura di oggi: tutte quelle del modulo della settimana più quelle vecchie in scadenza.
function todaysLines() {
  const p = plan();
  const M = MODULES[p.mod % MODULES.length];
  const lines = [];
  for (const side of ['white', 'black']) M[side].lines.forEach((l, k) => lines.push({ key: `${M.id}:${side}:${k}`, side: side === 'white' ? 'w' : 'b', moves: l.split(' '), title: M[side].title, current: true }));
  const now = Date.now();
  for (const [key, s] of Object.entries(p.srs)) {
    if (s.due > now) continue;
    const [mid, side, k] = key.split(':');
    const MM = MODULES.find(m => m.id === mid);
    if (!MM || MM === M) continue;
    lines.push({ key, side: side === 'white' ? 'w' : 'b', moves: MM[side].lines[+k].split(' '), title: MM[side].title, current: false });
  }
  return lines;
}
function recordLine(key, clean, current) {
  if (current) return; // le linee della settimana si ripetono tutti i giorni comunque
  const p = plan();
  const s = p.srs[key] || { box: 0 };
  s.box = clean ? Math.min(INTERVALS.length - 1, s.box + 1) : 0;
  s.due = Date.now() + INTERVALS[s.box] * DAY - 3600000;
  p.srs[key] = s; savePlan(p);
}

export function installDaily(ctx) {
  const { views, app, $, esc, go, toast, games, getGame, getEngine, settings, setCleanup } = ctx;

  views.today = () => {
    const d = dailyState();
    const p = plan();
    const M = MODULES[p.mod % MODULES.length];
    const cur = d.done.indexOf(false);
    const R = rating(); const S = stageOf(R.r);
    const isTest = p.days === 6;
    PHASE_DEFS[1].desc = `${M.white.title} (Bianco) e ${M.black.title} (Nero). Giorno ${Math.min(p.days + 1, 7)} di 7${isTest ? ': verifica finale della settimana' : ''}.`;
        const wk = weakestPhase(games());
    PHASE_DEFS[4].desc = wk.phase ? `Oggi: ${wk.phase.toLowerCase()}, la fase in cui hai perso più punti nelle ultime partite.` : 'Sulla fase di gioco in cui perdi più punti.';
    app.innerHTML = `
    <section class="hero">
      <div class="eyebrow">Giorno ${d.dayNo} · livello ${S.n}, ${esc(S.title)}</div>
      <h1>Lezione del giorno</h1>
      <p class="muted">${d.finished ? 'Lezione completata. Torna domani per la prossima.' : 'Sette fasi in ordine: ognuna si sblocca quando completi la precedente. Se ti interrompi, riprendi esattamente dal punto in cui eri.'}</p>
      ${!d.finished && d.date !== todayKey() ? '<p class="small resume">Questa è la lezione iniziata in un giorno precedente: finiscila e la prossima partirà da lì.</p>' : ''}
      <div class="dots big">${d.done.map((x, i) => `<i class="${x ? 'ok' : i === cur ? 'cur' : ''}"></i>`).join('')}</div>
    </section>
    <ol class="phases">${PHASE_DEFS.map((ph, i) => {
      const st = d.done[i] ? 'done' : i === cur ? 'cur' : 'lock';
      return `<li class="ph ${st}" data-i="${i}">
        <span class="phn">${d.done[i] ? '✓' : st === 'lock' ? '🔒' : i + 1}</span>
        <div><b>${ph.icon} ${esc(ph.title)}</b><span class="muted small">${esc(ph.desc)}</span>
        ${st === 'cur' && resumeInfo() ? `<span class="small resume">⏸ Interrotta qui: ${esc(resumeInfo())}</span>` : ''}
        ${st === 'cur' ? `<button class="btn primary small" data-go="${i}">${resumeInfo() ? 'Riprendi da qui' : i === 0 && !d.done.some(Boolean) ? 'Inizia' : 'Continua'} ▶</button>` : ''}
        ${st === 'lock' ? '<span class="lockmsg">Completa prima la fase precedente.</span>' : ''}</div>
      </li>`;
    }).join('')}</ol>
    ${d.finished ? '<div class="donecard"><div class="big">✓</div><h3>Ottimo lavoro</h3><p class="muted">Hai completato tutte le fasi di oggi.</p></div>' : ''}`;
    app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => startPhase(+b.dataset.go));
    if (d.finished && !d.celebrated) { d.celebrated = true; save('daily', d); sound('win'); confetti(1.2); speak('Lezione del giorno completata. Ottimo lavoro.'); }
  };

  async function startPhase(i) {
    const d = dailyState();
    if (i !== d.done.indexOf(false)) return toast('Completa prima la fase precedente');
    markStarted();
    if (i === 0) {
      // ripassi in scadenza (puzzle, tuoi errori, esercizi delle lezioni) e, se non bastano, puzzle nuovi
      const db = await loadDB();
      const st = pzState(), now = Date.now();
      const byId = new Map(db.map(p => [p.id, p]));
      for (const p of personal()) byId.set(p.id, p);
      for (const p of studyItems()) byId.set(p.id, p);
      const queue = Object.entries(st).filter(([, s]) => s.due <= now).sort((a, b) => a[1].due - b[1].due).map(([id]) => byId.get(id)).filter(Boolean).slice(0, 6);
      const R = pzRating().r;
      const fresh = db.filter(p => !st[p.id] && Math.abs(p.rating - R) <= 150).sort(() => Math.random() - 0.5);
      while (queue.length < 6 && fresh.length) queue.push(fresh.pop());
      return go('session', { queue, daily: 0, title: 'Riscaldamento' });
    }
    if (i === 1) return go('drill', { daily: 1 });
    if (i === 2) return go('setup', { daily: 2 });
    if (i === 3) {
      const next = d.gameIds.find(g => !d.reviewed.includes(g) && getGame(g));
      if (!next) { toast('Prima gioca le partite del giorno'); return; }
      return go('review', { id: next, auto: true, daily: 3 });
    }
    if (i === 4) return startTarget();
    if (i === 5) {
      const mine = personal().filter(p => d.gameIds.includes(p.gameId));
      if (!mine.length) {
        markPhase(5);
        toast('Nessun errore grave oggi: fase completata');
        return go('today');
      }
      return go('session', { queue: mine, daily: 5, title: 'I tuoi errori di oggi' });
    }
    if (i === 6) return go('coordsDaily');
  }
  views.dailyReview = () => startPhase(3);

  async function startTarget() {
    const d = dailyState();
    const wk = weakestPhase(games());
    const phase = wk.phase || 'Mediogioco';
    const st = load('study', { done: {} });
    const stage = stageOf(rating().r).n;
    const next = cats => LESSONS.find(l => l.stage <= stage && cats.includes(l.cat) && !st.done[l.id]);
    if (d.targetLesson) {
      const L = LESSONS.find(x => x.id === d.targetLesson) || load('gen-lessons', []).find(x => x.id === d.targetLesson);
      if (L) return go('lesson', { lesson: L, daily: 4 });
    }
    if (phase === 'Apertura') {
      const g = getGame(d.gameIds[d.gameIds.length - 1] || d.gameId);
      app.innerHTML = '<section class="panel"><h2>Lezione mirata: apertura</h2><p class="muted" id="st">Preparo una lezione sull\'apertura della partita di oggi…</p></section>';
      try {
        const L = await buildOpeningLesson(g, getEngine, t => { const el = $('#st'); if (el) el.textContent = t; });
        saveGenLesson(L);
        const d2 = dailyState(); d2.targetLesson = L.id; save('daily', d2);
        return go('lesson', { lesson: L, daily: 4 });
      } catch (e) { toast('Errore: ' + e.message); return go('today'); }
    }
    const cats = phase === 'Finale' ? ['fi'] : ['ta', 'me'];
    const L = next(cats);
    if (L) { const d2 = dailyState(); d2.targetLesson = L.id; save('daily', d2); return go('lesson', { id: L.id, daily: 4 }); }
    // lezioni del livello finite: puzzle sui temi della fase debole
    const db = await loadDB();
    const R = pzRating().r;
    const themes = phase === 'Finale' ? ['endgame', 'rookEndgame', 'pawnEndgame', 'queenEndgame'] : (weakThemes(games()).slice(0, 3).concat(['middlegame']));
    const pool = db.filter(p => p.themes.some(t => themes.includes(t)) && Math.abs(p.rating - R) <= 200 && !pzState()[p.id]).sort(() => Math.random() - 0.5).slice(0, 8);
    return go('session', { queue: pool, daily: 4, title: `Lezione mirata: ${phase.toLowerCase()}` });
  }

  function saveGenLesson(L) {
    const all = load('gen-lessons', []).filter(x => x.id !== L.id);
    all.unshift(L); save('gen-lessons', all.slice(0, 40));
  }
  ctx.saveGenLesson = saveGenLesson;

  // ---------- ripetizione delle linee d'apertura ----------
  views.drill = (opts = {}) => {
    const lines = todaysLines();
    const p = plan();
    const isTest = p.days === 6 && opts.daily !== undefined;
    let alive = true; const timers = [];
    setCleanup(() => { alive = false; timers.forEach(clearTimeout); });
    // Ripresa: se la ripetizione di oggi era stata interrotta, si riparte dalla stessa linea e dalla stessa mossa.
    const SKEY = 'drill-progress';
    const day = dailyState().dayNo;
    let saved = opts.daily !== undefined ? load(SKEY, null) : null;
    if (saved && (saved.day !== day || saved.mod !== p.mod || !Array.isArray(saved.queue))) saved = null;
    const queue = saved ? saved.queue : lines.map((l, i) => ({ ...l, n: i + 1, errors: 0 }));
    const total = saved ? saved.total : queue.length;
    const results = saved ? saved.results : [];
    let qi = saved ? saved.qi : 0;
    let resumeAt = saved && saved.k ? { k: saved.k, errs: saved.errs || 0, hint: !!saved.hint } : null;
    const persist = (k = 0, errs = 0, hint = false) => { if (opts.daily !== undefined) save(SKEY, { day, mod: p.mod, total, queue, qi, results, k, errs, hint }); };
    if (saved) setTimeout(() => toast('Riprendi dal punto in cui avevi interrotto'), 300);
    app.innerHTML = `
    <section class="drill">
      <div class="pzhead"><div><b>${isTest ? 'Verifica della settimana' : "Apertura della settimana"}</b><div class="muted small" id="dcount"></div></div></div>
      <div class="prompt" id="prompt"></div>
      <div id="board"></div>
      <div class="lcard" id="dcard"></div>
      <div class="row" id="dbtns"></div>
    </section>`;
    const board = new Board($('#board'));
    const card = $('#dcard');

    function runLine() {
      if (!alive) return;
      if (qi >= queue.length) return finish();
      const L = queue[qi];
      const done = new Set(results.filter(r => r.clean).map(r => r.key)).size;
      const left = queue.length - qi - 1;
      const retries = queue.slice(qi + 1).filter(x => x.retry).length;
      $('#dcount').textContent = `${L.retry ? `Ripetizione della linea ${L.n}` : `Linea ${L.n} di ${total}`} · ${L.side === 'w' ? 'Bianco' : 'Nero'}${L.current ? '' : ' · ripasso'} · ${done} di ${total} già pulite${left ? ` · ancora ${left} in coda${retries ? ` (di cui ${retries} da ripetere)` : ''}` : ''}`;
      const c = new Chess();
      let k = 0, errs = 0, hint = false;
      let lastMv = null;
      if (resumeAt) {
        // rimette sulla scacchiera le mosse già giocate di questa linea
        for (let j = 0; j < resumeAt.k && j < L.moves.length; j++) lastMv = c.move(L.moves[j]);
        k = Math.min(resumeAt.k, L.moves.length); errs = resumeAt.errs; hint = resumeAt.hint;
        resumeAt = null;
      }
      persist(k, errs, hint);
      board.orient = L.side;
      const intro = lineIntro({ ...L, total });
      $('#prompt').innerHTML = `<span class="side ${L.side}"></span> <b>${esc(L.title)}</b><div class="small linename">${esc(intro.text)}</div>`;
      card.innerHTML = '<p class="muted">Le mosse dell\'avversario arrivano da sole. Tocca a te giocare le tue.</p>';
      let tutor = null;
      // Spiegazione a voce della linea con il tutor: nome esatto, idea, motivo di ogni mossa. Poi si gioca a memoria.
      const explain = () => {
        board.interactive = false;
        $('#dbtns').innerHTML = '';
        card.innerHTML = '<p class="muted">Ascolta e guarda la spiegazione del tutor. Alla fine ripeti tu la linea a memoria.</p>';
        const [mid, sd, kk] = L.key.split(':');
        const MM = MODULES.find(x => x.id === mid);
        const idx = +kk;
        const prevKey = `${mid}:${sd}:${idx - 1}`;
        const prevN = queue.find(q => q.key === prevKey)?.n;
        const prev = idx > 0 && prevN && MM ? { moves: MM[sd].lines[idx - 1].split(' '), n: prevN } : null;
        const steps = explainLine({ ...L, total }, { idea: MM?.[sd].idea, withIdea: idx === 0 || !L.current, prev });
        tutor = new Tutor($('#board'), board);
        tutor.run(steps, {
          onClose: begin,
          extra: el => { el.innerHTML = '<div class="row"><button class="btn primary small" data-x="go">Ora giocala tu ▶</button></div>'; el.querySelector('[data-x=go]').onclick = () => tutor.close(); },
        });
      };
      // si (ri)parte dalla posizione iniziale della linea
      const begin = () => {
        if (!alive) return;
        stopSpeech();
        const pl = plan(); pl.explained = pl.explained || {}; pl.explained[L.key] = true; savePlan(pl);
        c.reset(); k = 0; lastMv = null;
        persist(k, errs, hint);
        board.jump({ fen: c.fen(), last: null, interactive: false, arrows: [] });
        card.innerHTML = '<p class="muted">Ora tocca a te: gioca la linea a memoria. Le mosse dell\'avversario arrivano da sole.</p>';
        advance();
      };
      window.__drill = () => ({ next: L.moves[k], fen: c.fen() });
      const legal = sq => c.moves({ square: sq, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion }));
      const draw = (last, extra = {}) => board.set({ fen: c.fen(), last, interactive: c.turn() === L.side && k < L.moves.length, legal, sel: null, dests: [], arrows: [], hintSq: null, ...extra });
      board.jump({ fen: c.fen(), last: lastMv ? { from: lastMv.from, to: lastMv.to } : null, interactive: false, arrows: [] });
      const advance = async () => {
        // mosse dell'avversario automatiche
        while (alive && k < L.moves.length && c.turn() !== L.side) {
          await new Promise(r => timers.push(setTimeout(r, 420)));
          if (!alive) return;
          const m = c.move(L.moves[k]); k++;
          draw({ from: m.from, to: m.to });
          persist(k, errs, hint);
        }
        if (k >= L.moves.length) return lineDone();
        draw(board.last);
        $('#dbtns').innerHTML = isTest ? '' : '<button class="btn" id="dh">💡 Suggerimento</button><button class="btn" id="dex">🎓 Spiegami la linea</button>';
        $('#dex')?.addEventListener('click', () => { if (k > 0) hint = true; explain(); });
        $('#dh')?.addEventListener('click', () => { hint = true; persist(k, errs, hint); const t = new Chess(c.fen()).move(L.moves[k]); board.set({ hintSq: t.from }); });
      };
      board.onMove = async mv => {
        const exp = new Chess(c.fen()).move(L.moves[k]);
        let m; try { m = c.move(mv); } catch { draw(null); return; }
        if (m.san === exp.san) {
          k++; draw({ from: m.from, to: m.to });
          persist(k, errs, hint);
          card.innerHTML = `<p class="goodtxt"><b>✓ ${esc(itSan(m.san))}</b></p>`;
          return advance();
        }
        // mossa diversa dal repertorio
        c.undo(); errs++; persist(k, errs, hint); sound('bad'); buzz(50);
        const b = $('#board'); b.classList.remove('ko'); void b.offsetWidth; b.classList.add('ko');
        draw(null, { arrows: [{ from: exp.from, to: exp.to, color: '#4caf7d' }] });
        card.innerHTML = `<p><b class="errtxt">✕ ${esc(itSan(m.san))}</b>: nel repertorio qui si gioca <b class="goodtxt">${esc(itSan(exp.san))}</b> (freccia verde). Giocala tu.</p><p class="small muted" id="dwhy">Verifico con Stockfish se la tua mossa era anche un errore…</p>`;
        try {
          const eng = await getEngine();
          await eng.configure({ 'UCI_LimitStrength': 'false', 'Skill Level': 20 });
          const before = c.fen();
          const a = await eng.search(before, 'go depth 12 movetime 1200');
          const t = new Chess(before); t.move(m.san);
          const r = await eng.search(t.fen(), 'go depth 12 movetime 1200');
          if (!alive) return;
          const lossCp = a.cp - (-r.cp);
          const el = $('#dwhy'); if (!el) return;
          if (lossCp >= 80) {
            el.innerHTML = `Non era solo fuori repertorio: secondo Stockfish perdi ${(lossCp / 100).toFixed(1)} pedoni di valore. <button class="btn small" id="dtut">🎓 Perché no?</button>`;
            $('#dtut').onclick = () => {
              const tutor = new Tutor(board.el, board);
              tutor.run(refuteLesson({ fenBefore: before, played: m.from + m.to + (m.promotion || ''), refutation: r.pv || [], me: L.side }), { onClose: () => { if (alive) draw(null, { arrows: [{ from: exp.from, to: exp.to, color: '#4caf7d' }] }); } });
            };
          } else el.textContent = 'La tua mossa non è un errore secondo Stockfish, ma conviene restare nel repertorio che stai imparando.';
        } catch { /* motore non disponibile */ }
      };
      function lineDone() {
        board.interactive = false;
        const clean = !errs && !hint;
        results.push({ key: L.key, clean });
        recordLine(L.key, clean, L.current);
        if (!clean && !isTest) queue.push({ ...L, retry: true }); // rifai la linea finché non esce pulita
        qi++; persist(); qi--; // se ti interrompi ora, riprendi dalla linea successiva
        card.innerHTML = clean ? `<p class="goodtxt"><b>✓ Linea completata senza errori.</b></p><p class="muted small">${esc(nameOf(L.moves))}</p>` : `<p><b>Linea completata con ${errs + (hint ? 1 : 0)} ${errs + (hint ? 1 : 0) === 1 ? 'aiuto o errore' : 'aiuti o errori'}.</b> ${isTest ? '' : 'La ripeterai alla fine.'}</p><p class="muted small">${esc(nameOf(L.moves))}</p>`;
        if (clean) sound('good');
        $('#dbtns').innerHTML = `<button class="btn primary" id="dnext">Avanti ▶</button>${isTest ? '' : '<button class="btn" id="dex2">🎓 Rivedi la spiegazione</button>'}`;
        $('#dex2')?.addEventListener('click', () => {
          const [mid, sd, kk] = L.key.split(':'); const MM = MODULES.find(x => x.id === mid);
          const t = new Tutor($('#board'), board);
          t.run(explainLine({ ...L, total }, { idea: MM?.[sd].idea, withIdea: true }), { onClose: () => board.jump({ fen: c.fen(), last: null, interactive: false, arrows: [] }) });
        });
        $('#dnext').onclick = () => { qi++; runLine(); };
      }
      const needExplain = !isTest && k === 0 && !L.retry && !(plan().explained || {})[L.key];
      if (needExplain) explain();
      else { if (k === 0) speak(intro.speech); advance(); }
    }

    function nameOf(moves) {
      const id = identify(moves);
      return id ? id.nameIt : '';
    }

    function finish() {
      const uniq = new Map(); results.forEach(r => { if (!uniq.has(r.key)) uniq.set(r.key, r.clean); });
      const firstTry = [...uniq.values()].filter(Boolean).length;
      const pct = uniq.size ? Math.round(firstTry / uniq.size * 100) : 100;
      if (opts.daily !== undefined) { markPhase(opts.daily); localStorage.removeItem(SKEY); }
      sound(pct >= 80 ? 'win' : 'good'); if (pct >= 80) confetti(0.7);
      app.innerHTML = `<section class="panel"><h2>${isTest ? 'Verifica completata' : 'Linee completate'}</h2>
        <div class="cards"><div class="card"><div class="k">Linee</div><div class="v">${uniq.size}</div></div><div class="card"><div class="k">Giuste al primo colpo</div><div class="v">${pct}%</div></div></div>
        <p class="muted">${isTest ? (pct >= 80 ? 'Settimana superata: da domani nuova apertura. Queste linee torneranno nel ripasso a intervalli crescenti.' : 'Domani si passa comunque alla nuova apertura, ma le linee sbagliate torneranno spesso nel ripasso.') : 'Domani le ripeterai di nuovo: la ripetizione quotidiana per una settimana le fissa nella memoria.'}</p>
        <button class="btn primary big" id="cont">${opts.daily !== undefined ? 'Continua la lezione del giorno ▶' : 'Fine'}</button></section>`;
      $('#cont').onclick = () => go(opts.daily !== undefined ? 'today' : 'home');
    }

    // ---------- teoria: prima si spiega, poi si impara, poi ci si esercita ----------
    const isExplained = l => !!(plan().explained || {})[l.key];
    const prevOf = L => {
      const [mid, sd, kk] = L.key.split(':'); const MM = MODULES.find(x => x.id === mid); const idx = +kk;
      const prevN = queue.find(q => q.key === `${mid}:${sd}:${idx - 1}`)?.n;
      return idx > 0 && prevN && MM ? { moves: MM[sd].lines[idx - 1].split(' '), n: prevN } : null;
    };
    function theory(list, after) {
      const sides = ['w', 'b'].filter(sd => list.some(l => l.side === sd));
      let si = 0;
      const nextSide = () => {
        if (si >= sides.length) return after();
        const sd = sides[si]; const ls = list.filter(l => l.side === sd);
        const MM = MODULES.find(x => x.id === ls[0].key.split(':')[0]);
        const sideKey = sd === 'w' ? 'white' : 'black';
        board.orient = sd;
        $('#dcount').textContent = `Teoria · ${sd === 'w' ? 'Bianco' : 'Nero'} · ${si + 1} di ${sides.length}`;
        $('#prompt').innerHTML = `<span class="side ${sd}"></span> <b>${esc(MM?.[sideKey].title || '')}</b><div class="small linename">Prima la teoria: ascolta e guarda ogni mossa.</div>`;
        $('#dbtns').innerHTML = '';
        card.innerHTML = '<p class="muted">Il tutor ti spiega ogni mossa: pezzo, casa di partenza e di arrivo, funzione. Arriva fino all\'ultimo passo per sbloccare gli esercizi.</p>';
        const steps = theoryOverview(sd, MM?.[sideKey].title || '', MM?.[sideKey].idea || '', ls.length, MM?.[sideKey].profile, ls[0].moves);
        ls.forEach(L => steps.push(...explainLine({ ...L, total }, { idea: MM?.[sideKey].idea, withIdea: false, prev: prevOf(L), theory: true })));
        let finished = false;
        const tutor = new Tutor($('#board'), board);
        tutor.run(steps, {
          onClose: () => {
            if (!alive || finished) return;
            card.innerHTML = '<p>Teoria interrotta. Gli esercizi si sbloccano dopo aver ascoltato la spiegazione fino in fondo.</p>';
            $('#dbtns').innerHTML = '<button class="btn primary" id="tre">🎓 Riascolta la teoria</button>';
            $('#tre').onclick = nextSide;
          },
          onEnd: () => { finished = true; const b = tutor.el?.querySelector('[data-x=go]'); if (b) b.disabled = false; },
          extra: el => {
            el.innerHTML = `<div class="row"><button class="btn primary small" data-x="go" disabled>${si + 1 < sides.length ? 'Teoria capita: passa alla difesa ▶' : 'Teoria capita: passa agli esercizi ▶'}</button></div>`;
            el.querySelector('[data-x=go]').onclick = () => {
              const pl = plan(); pl.explained = pl.explained || {}; ls.forEach(L => { pl.explained[L.key] = true; }); savePlan(pl);
              si++; tutor.close(true); stopSpeech(); nextSide();
            };
          },
        });
      };
      nextSide();
    }
    function start() {
      if (!isTest && !saved) {
        const todo = queue.filter(l => !l.retry && !isExplained(l));
        if (todo.length) return theory(todo, () => { board.jump({ fen: new Chess().fen(), last: null, interactive: false, arrows: [] }); runLine(); });
        // già spiegata: si può comunque rivederla prima di cominciare
        $('#dcount').textContent = `${queue.length} linee da esercitare`;
        $('#prompt').innerHTML = '<b>Apertura della settimana</b>';
        card.innerHTML = '<p class="muted">La teoria di queste linee è già stata spiegata. Se vuoi, riascoltala prima di esercitarti.</p>';
        $('#dbtns').innerHTML = '<button class="btn primary" id="gox">Inizia gli esercizi ▶</button><button class="btn" id="rvt">🎓 Rivedi la teoria</button>';
        $('#gox').onclick = () => runLine();
        $('#rvt').onclick = () => theory(queue.filter(l => !l.retry), () => { board.jump({ fen: new Chess().fen(), last: null, interactive: false, arrows: [] }); runLine(); });
        return;
      }
      runLine();
    }

    loadOpenings().then(() => start());
  };
}

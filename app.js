import { Chess } from './chess.js';
import { Board } from './board.js';
import { getEngine, downloadEngine, engineMeta, resetEngine, importEngineFiles } from './engine.js';
import { installExtraViews, applyLook } from './extra-views.js';
import { classifyGame, whitePov, terminalEval, gameAccuracy, fmtEval, itSan, winPct, pvToSan } from './analysis.js';
import { THEME_IT, pzRating, addPersonalFromGame, dueCount, themeStats } from './puzzles.js';
import { installPuzzleViews } from './puzzle-views.js';
import { installStudyViews, todayLesson, lessonDoneToday } from './study-views.js';
import { STAGES, GOAL, START, rating, setRating, stageOf, progressPct, streak, markActive } from './path.js';
import { sound, confetti, countUp } from './fx.js';
import { EvalBar } from './evalbar.js';
import { speak, announceMove, stopSpeech, speakable, italianVoices } from './speech.js';
import { Tutor, errorLesson, closeTutors } from './tutor.js';
import { gameLesson } from './game-tutor.js';
import { SOUND_SETS, preloadSounds } from './fx.js';
import { CATS } from './lessons-data.js';
import { installDaily, dailyState, markPhase, PHASE_DEFS, currentModule, plan, resumeInfo, addDailyGame, reviewGameDone, MIN_GAMES } from './daily.js';
import { phaseStats, weakestPhase, buildOpeningLesson, PHASES, PHASE_ADVICE } from './coach.js';
const PHASE_ADVICE_TXT = PHASE_ADVICE;
import { loadOpenings, identify } from './openings.js';
import { splitGames, toGame, oppLabel } from './pgn-import.js';

const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- dati salvati sul dispositivo ----------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};
const DEFAULTS = { apiKey: '', model: 'claude-haiku-5-5', depth: 12, elo: 1450, tc: '3+2', color: 'w' };
const settings = () => ({ ...DEFAULTS, ...store.get('settings', {}) });
const saveSettings = s => store.set('settings', { ...settings(), ...s });
const games = () => store.get('games', []);
const saveGame = g => { const all = games().filter(x => x.id !== g.id); all.unshift(g); store.set('games', all.slice(0, 500)); markActive(); };
const getGame = id => games().find(g => g.id === id);

// ---------- navigazione ----------
let cleanup = null;
// Navigazione: pila delle schermate visitate. Il gesto indietro di Android (e lo scorrimento dal bordo) riporta alla schermata precedente.
const NAV = [];
let curNav = null;
function go(view, arg, opts = {}) {
  if (cleanup) { const c = cleanup; cleanup = null; if (c() === false) return false; }
  stopSpeech();
  closeTutors();
  if (opts.back) NAV.pop();
  else if (curNav && !(curNav.view === view && arg === undefined)) {
    NAV.push(curNav); if (NAV.length > 40) NAV.shift();
    try { history.pushState({ n: NAV.length }, ''); } catch {}
  } else if (curNav) { /* stessa schermata: nessun nuovo passo */ }
  if (arg && typeof arg === 'object' && arg.auto) { const { auto, ...rest } = arg; curNav = { view, arg: rest }; } else curNav = { view, arg };
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.v === view));
  window.scrollTo(0, 0);
  app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter');
  views[view](arg);
}
function goBack() {
  if (!NAV.length) return false;
  const prev = NAV[NAV.length - 1];
  const r = go(prev.view, prev.arg, { back: true });
  if (r === false) { try { history.pushState({ n: NAV.length }, ''); } catch {} }   // uscita annullata: resta dov'era
  return r !== false;
}
window.addEventListener('popstate', () => { if (NAV.length) goBack(); });
// Scorrimento dal bordo dello schermo verso l'interno = indietro, come nella navigazione a gesti di Android.
(() => {
  let sx = 0, sy = 0, t0 = 0, edge = 0, on = false, hint = null;
  const mk = () => { hint = document.createElement('div'); hint.className = 'swipehint'; hint.textContent = '‹'; document.body.append(hint); };
  const rm = () => { hint?.remove(); hint = null; on = false; };
  addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0], w = innerWidth;
    edge = t.clientX < 26 ? 1 : t.clientX > w - 26 ? -1 : 0;
    on = !!edge && NAV.length > 0; sx = t.clientX; sy = t.clientY; t0 = Date.now();
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!on) return;
    const t = e.touches[0], dx = (t.clientX - sx) * edge, dy = Math.abs(t.clientY - sy);
    if (dy > dx * 0.8 && dx < 30) { rm(); return; }
    if (dx > 12) { if (!hint) mk(); hint.style.setProperty('--d', Math.min(dx, 90) + 'px'); hint.classList.toggle('left', edge === 1); hint.classList.toggle('right', edge === -1); hint.classList.toggle('armed', dx > 70); }
  }, { passive: true });
  addEventListener('touchend', e => {
    if (!on) return;
    const t = e.changedTouches[0], dx = (t.clientX - sx) * edge, dy = Math.abs(t.clientY - sy);
    const ok = dx > 70 && dy < dx && Date.now() - t0 < 700;
    rm();
    if (ok) history.back();
  }, { passive: true });
  addEventListener('touchcancel', rm, { passive: true });
})();
document.querySelector('.nav').addEventListener('click', e => {
  const b = e.target.closest('button'); if (b) go(b.dataset.v);
});

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}

// ---------- motore ----------
async function ensureEngine(statusEl) {
  try { return await getEngine(); }
  catch (e) {
    if (e.message !== 'MOTORE_ASSENTE') throw e;
    if (!navigator.onLine) throw new Error('Serve una connessione per il primo download del motore.');
    statusEl && (statusEl.textContent = 'Preparo Stockfish (solo la prima volta)…');
    await downloadEngine(m => statusEl && (statusEl.textContent = m));
    resetEngine();
    return await getEngine();
  }
}

// ---------- HOME ----------
function stats() {
  const all = games();
  const res = { w: 0, d: 0, l: 0 };
  for (const g of all) res[g.outcome] = (res[g.outcome] || 0) + 1;
  const analysed = all.filter(g => g.analysis);
  const accs = analysed.slice(0, 10).map(g => g.analysis.accuracy).filter(x => x !== null);
  return { all, res, analysed, acc: accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null };
}

const views = {};
views.home = () => {
  const st = stats();
  const R = rating();
  const stage = stageOf(R.r);
  const today = new Date().toDateString();
  const gamesToday = st.all.filter(g => new Date(g.date).toDateString() === today);
  const D = dailyState();
  const nDone = D.done.filter(Boolean).length;
  const ring = 2 * Math.PI * 26;
  const sk = streak();
  app.innerHTML = `
  <section class="climb">
    <div class="climb-top">
      <button class="rnow" id="rEdit" aria-label="Aggiorna il rating Lichess">
        <span class="rnum" id="rnum" data-from="${START}">${R.r}</span>
        <span class="rlab">Lichess blitz ✎</span>
      </button>
      <div class="rgoal"><span>${GOAL}</span><small>obiettivo</small></div>
    </div>
    <div class="track" aria-hidden="true">
      <div class="fill" id="fill"></div>
      ${STAGES.map(s => `<i class="tick ${R.r >= s.to ? 'hit' : ''}" style="left:${progressPct(s.to)}%"><b>${s.to}</b></i>`).join('')}
      <span class="knight" id="knight">♞</span>
    </div>
    <p class="stage">Livello ${stage.n} · <b>${esc(stage.title)}</b>. ${R.r >= GOAL ? 'Obiettivo raggiunto!' : `Mancano ${stage.to - R.r} punti al prossimo traguardo.`}</p>
  </section>
  <section class="panel dailycard">
    <div class="thead">
      <svg class="ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" class="rbg"/><circle cx="32" cy="32" r="26" class="rfg" id="ringfg" style="stroke-dasharray:${ring};stroke-dashoffset:${ring}"/><text x="32" y="37">${nDone}/${PHASE_DEFS.length}</text></svg>
      <div><h3>Lezione del giorno</h3><p class="muted small">${D.finished ? 'Completata. Torna domani.' : `Fase ${nDone + 1} di ${PHASE_DEFS.length}: ${esc(PHASE_DEFS[nDone].title)}${resumeInfo() ? ` · interrotta a ${esc(resumeInfo())}` : ''}`}${sk ? ` · 🔥 ${sk} ${sk === 1 ? 'giorno' : 'giorni'} di fila` : ''}</p></div>
    </div>
    <p class="small">Settimana dell'apertura: <b>${esc(currentModule().white.title)}</b> e <b>${esc(currentModule().black.title)}</b>, giorno ${Math.min(plan().days + 1, 7)} di 7.</p>
    <button class="btn primary big" id="goToday">${D.finished ? 'Rivedi la lezione di oggi' : resumeInfo() ? 'Riprendi da dove eri ▶' : nDone ? 'Continua la lezione ▶' : 'Inizia la lezione ▶'}</button>
    <div class="row"><button class="btn" id="play">♞ Partita libera</button><button class="btn" id="goPz">✦ Puzzle liberi</button></div>
  </section>
  <section class="cards">
    <div class="card" id="toStats"><div class="k">Partite</div><div class="v">${st.all.length}</div><div class="s">${st.res.w} vinte, ${st.res.d} patte, ${st.res.l} perse</div></div>
    <div class="card" id="toStats2"><div class="k">Precisione</div><div class="v">${st.acc ?? '—'}${st.acc !== null ? '%' : ''}</div><div class="s">media ultime 10 analizzate</div></div>
  </section>`;
  // Un solo momento animato: il cavallo sale lungo il percorso fino al rating attuale.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const pct = progressPct(R.r);
    $('#fill').style.width = pct + '%';
    $('#knight').style.left = pct + '%';
    $('#ringfg').style.strokeDashoffset = ring * (1 - nDone / PHASE_DEFS.length);
    countUp($('#rnum'), R.r, 1100);
  }));
  $('#play').onclick = () => go('setup');
  $('#goToday').onclick = () => go('today');
  $('#goPz').onclick = () => go('puzzles');
  $('#toStats').onclick = $('#toStats2').onclick = () => go('stats');
  $('#rEdit').onclick = () => {
    const v = prompt('Il tuo rating Lichess blitz attuale:', R.r);
    const n = parseInt(v, 10);
    if (!n || n < 400 || n > 3500) return;
    const r = setRating(n);
    if (r.promoted) { sound('win'); confetti(1.3); toast(`Livello ${r.stage.n}: ${r.stage.title}!`); }
    views.home();
  };
};

// ---------- IMPOSTAZIONE PARTITA ----------
views.setup = (opts = {}) => {
  const s = settings();
  const daily = opts.daily;
  const dColor = daily !== undefined ? ((dailyState().dayNo + dailyState().gameIds.length) % 2 ? 'w' : 'b') : null;
  const tcs = ['1+0', '3+0', '3+2', '5+0', '5+3', '10+0'];
  const paused = daily !== undefined ? store.get('daily-game', null) : null;
  if (paused && paused.day === dailyState().dayNo && !opts.fresh) {
    app.innerHTML = `<section class="panel"><h2>Partita del giorno in pausa</h2>
      <p>Avevi interrotto la partita con il <b>${paused.color === 'w' ? 'Bianco' : 'Nero'}</b> contro Stockfish ${paused.elo} dopo ${Math.ceil(paused.moves.length / 2)} mosse. Riparte dalla stessa posizione e con gli stessi tempi sull'orologio.</p>
      <button class="btn primary big" id="res">Riprendi la partita ▶</button>
      <button class="linkbtn" id="drop">Abbandonala e iniziane un'altra</button>
      <p class="muted small" id="estatus"></p></section>`;
    $('#res').onclick = async () => {
      $('#res').disabled = true;
      try { const eng = await ensureEngine($('#estatus')); go('play', { eng, color: paused.color, elo: paused.elo, tc: paused.tc, daily, resume: paused }); }
      catch (e) { $('#estatus').textContent = 'Errore: ' + e.message; $('#res').disabled = false; }
    };
    $('#drop').onclick = () => { if (!confirm('Abbandonare la partita interrotta?')) return; localStorage.removeItem('daily-game'); views.setup({ ...opts, fresh: true }); };
    return;
  }
  app.innerHTML = `
  <section class="panel">
    <h2>${daily !== undefined ? `Partita del giorno ${Math.min(dailyState().gameIds.length + 1, MIN_GAMES)} di ${MIN_GAMES}${dailyState().gameIds.length >= MIN_GAMES ? ' (extra)' : ''}` : 'Nuova partita'}</h2>
    ${daily !== undefined ? `<p>Oggi giochi con il <b>${dColor === 'w' ? 'Bianco' : 'Nero'}</b>: prova ad applicare ${dColor === 'w' ? `l'apertura della settimana, ${esc(currentModule().white.title)}` : `la difesa della settimana, ${esc(currentModule().black.title)}`}. Ne servono almeno ${MIN_GAMES} al giorno, cambiando colore a ogni partita. Per contare, ogni partita deve durare almeno 10 tue mosse o finire con un matto.</p>` : `<label class="lbl">Colore</label>
    <div class="seg" id="color">${[['w', '♔ Bianco'], ['b', '♚ Nero'], ['r', '🎲 Casuale']].map(([v, t]) => `<button data-v="${v}" class="${s.color === v ? 'on' : ''}">${t}</button>`).join('')}</div>`}
    <label class="lbl">Cadenza</label>
    <div class="seg wrap" id="tc">${tcs.map(t => `<button data-v="${t}" class="${s.tc === t ? 'on' : ''}">${t}</button>`).join('')}</div>
    <label class="lbl">Forza di Stockfish <b id="eloV">${s.elo}</b></label>
    <input type="range" id="elo" min="1320" max="2400" step="10" value="${s.elo}">
    <p class="muted small">Il valore Elo del motore è una stima interna di Stockfish, non equivale al rating Lichess blitz. Parti da 1350-1450 e alzalo quando vinci con regolarità.</p>
    <label class="switch"><input type="checkbox" id="evb" ${s.evalbar !== false ? 'checked' : ''}><span></span>Barra della valutazione durante la partita</label>
    <button class="btn primary big" id="start">Inizia</button>
    <p class="muted small" id="estatus"></p>
    ${daily !== undefined ? '<div class="orbox"><span>oppure</span><button class="btn" id="fromLi">⇩ Usa una partita giocata oggi su Lichess</button><p class="muted small">Incolli il PGN di una tua partita di oggi: la revisione e il resto della lezione si fanno su quella.</p></div>' : ''}
  </section>`;
  $('#fromLi')?.addEventListener('click', () => go('import', { daily }));
  const pick = (id, key) => $(id).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    saveSettings({ [key]: b.dataset.v });
  });
  if (daily === undefined) pick('#color', 'color');
  pick('#tc', 'tc');
  $('#evb').onchange = e => saveSettings({ evalbar: e.target.checked });
  $('#elo').oninput = e => { $('#eloV').textContent = e.target.value; saveSettings({ elo: +e.target.value }); };
  $('#start').onclick = async () => {
    const btn = $('#start'); btn.disabled = true;
    try {
      const eng = await ensureEngine($('#estatus'));
      const st = settings();
      const color = dColor || (st.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : st.color);
      go('play', { eng, color, elo: st.elo, tc: st.tc, daily });
    } catch (e) { $('#estatus').textContent = 'Errore: ' + e.message; btn.disabled = false; }
  };
};

// ---------- PARTITA ----------
const fmtClock = ms => {
  ms = Math.max(0, ms);
  const s = Math.ceil(ms / 1000);
  if (ms < 10000) return (ms / 1000).toFixed(1);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

views.play = async ({ eng, color, elo, tc, daily, resume }) => {
  const [base, inc] = tc.split('+').map(Number);
  const G = {
    id: Date.now().toString(36), date: new Date().toISOString(), color, elo, tc,
    chess: new Chess(), clocks: { w: base * 60000, b: base * 60000 }, inc: inc * 1000,
    times: [], turnStart: null, over: false, engineBusy: false,
  };
  // Partita del giorno: lo stato si salva a ogni mossa, così un'interruzione la mette in pausa invece di perderla.
  if (resume) {
    G.id = resume.id; G.date = resume.date; G.clocks = { ...resume.clocks }; G.times = resume.times.slice();
    for (const san of resume.moves) G.chess.move(san);
  }
  const persistGame = () => {
    if (daily === undefined || G.over || !G.chess.history().length) return;
    const clocks = { ...G.clocks };
    if (G.turnStart !== null) { const t = G.chess.turn(); clocks[t] = Math.max(1000, clocks[t] - (performance.now() - G.turnStart)); }
    store.set('daily-game', { day: dailyState().dayNo, id: G.id, date: G.date, color, elo, tc, moves: G.chess.history(), clocks, times: G.times });
  };
  const opp = color === 'w' ? 'b' : 'w';
  app.innerHTML = `
  <section class="game">
    <div class="player top"><span class="name">Stockfish ${elo}</span><span class="clock" id="ck-${opp}">${fmtClock(G.clocks[opp])}</span></div>
    <div class="bwrap"><div class="evalbar ${settings().evalbar === false ? 'gone' : ''}" id="eb"><div></div><span></span></div><div id="board"></div></div>
    <div class="player bottom"><span class="name">Tu</span><span class="clock" id="ck-${color}">${fmtClock(G.clocks[color])}</span></div>
    <div class="moves" id="mv"></div>
    <label class="switch slim"><input type="checkbox" id="spk" ${settings().speakMoves ? 'checked' : ''}><span></span>Leggi ad alta voce la casella di ogni mossa</label>
    <div class="row"><button class="btn" id="flip">⇅ Gira</button><button class="btn danger" id="resign">⚑ Abbandona</button></div>
  </section>`;
  const board = new Board($('#board'));
  const bar = new EvalBar($('#eb'));
  $('#spk').onchange = e => { saveSettings({ speakMoves: e.target.checked }); if (e.target.checked) speak('Lettura delle mosse attiva', { force: true }); };
  // Barra della valutazione: si aggiorna mentre il motore calcola, quindi subito dopo ogni mossa.
  const setBar = (fen, i) => {
    if (settings().evalbar === false || !i || i.depth < 3) return;
    const sg = fen.split(' ')[1] === 'w' ? 1 : -1;
    bar.set(sg * i.cp, i.mate === null ? null : sg * i.mate);
  };
  const cancelBg = () => { if (G.bg) { G.bg.cancelled = true; G.bg = null; eng.stop(); } };
  // Durante il tuo turno il motore analizza la posizione solo per la barra.
  const startBg = () => {
    if (G.over || settings().evalbar === false) return;
    const fen = G.chess.fen(); const token = { cancelled: false }; G.bg = token;
    eng.search(fen, 'go depth 18 movetime 15000', { token, onInfo: i => { if (!token.cancelled && G.chess.fen() === fen) setBar(fen, i); } }).catch(() => {});
  };
  $('#eb').classList.toggle('flip', color === 'b');
  bar.set(20, null);
  board.orient = color;
  board.legal = sq => G.chess.moves({ square: sq, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion }));
  board.onMove = m => { try { G.chess.move(m); } catch { board.render(); return; } after(); };

  await eng.newGame();
  await eng.configure({ 'UCI_LimitStrength': 'true', 'UCI_Elo': elo, 'Skill Level': 20 });

  const kingSq = () => {
    if (!G.chess.inCheck()) return null;
    const t = G.chess.turn();
    for (const row of G.chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === t) return p.square;
    return null;
  };
  const renderMoves = () => {
    const h = G.chess.history();
    let s = '';
    for (let i = 0; i < h.length; i += 2) s += `<span class="n">${i / 2 + 1}.</span>${esc(itSan(h[i]))} ${h[i + 1] ? esc(itSan(h[i + 1])) : ''} `;
    $('#mv').innerHTML = s; $('#mv').scrollLeft = 1e6;
  };
  const refresh = () => {
    const hist = G.chess.history({ verbose: true });
    const lm = hist[hist.length - 1];
    board.set({
      fen: G.chess.fen(), last: lm ? { from: lm.from, to: lm.to } : null, check: kingSq(),
      interactive: !G.over && G.chess.turn() === color, sel: null, dests: [],
    });
    renderMoves();
  };

  function after() {
    const now = performance.now();
    const mover = G.chess.turn() === 'w' ? 'b' : 'w';
    // L'orologio parte dopo la prima mossa di entrambi, come su Lichess.
    if (G.turnStart !== null) G.clocks[mover] += G.inc - (now - G.turnStart);
    G.times.push(Math.round(G.clocks[mover]));
    G.turnStart = G.chess.history().length >= 2 ? now : null;
    const ck = $('#ck-' + mover); if (ck) ck.textContent = fmtClock(G.clocks[mover]);
    refresh();
    const hv = G.chess.history({ verbose: true }); announceMove(hv[hv.length - 1]);
    cancelBg();
    if (G.chess.isGameOver()) return finish();
    persistGame();
    if (G.chess.turn() !== color) engineMove(); else startBg();
  }
  async function engineMove() {
    G.engineBusy = true;
    const left = G.clocks[opp];
    const mt = Math.round(Math.max(150, Math.min(2500, left / 40 + G.inc * 0.6)));
    const fen = G.chess.fen();
    let r;
    try { r = await eng.search(fen, `go movetime ${mt}`, { onInfo: i => setBar(fen, i) }); } catch (e) { toast('Motore: ' + e.message); return; }
    G.engineBusy = false;
    if (G.over || G.chess.fen() !== fen) return;
    // La valutazione arriva gratis dalla ricerca del motore (dal suo punto di vista).
    const sg = fen.split(' ')[1] === 'w' ? 1 : -1;
    if (settings().evalbar !== false) bar.set(sg * r.real.cp, r.real.mate === null ? null : sg * r.real.mate);
    const u = r.bestmove;
    try { G.chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { return; }
    after();
  }
  const tick = setInterval(() => {
    if (G.over || G.turnStart === null) return;
    const t = G.chess.turn();
    const ms = G.clocks[t] - (performance.now() - G.turnStart);
    const el = $('#ck-' + t);
    if (el) { el.textContent = fmtClock(ms); el.classList.toggle('low', ms < 20000); }
    document.querySelectorAll('.clock').forEach(c => c.classList.toggle('run', c.id === 'ck-' + t));
    if (ms <= 0) { G.clocks[t] = 0; finish(t === color ? 'tempo-tu' : 'tempo-motore'); }
  }, 100);

  function finish(reason) {
    if (G.over) return;
    G.over = true;
    if (daily !== undefined) localStorage.removeItem('daily-game');
    clearInterval(tick);
    cancelBg();
    if (G.engineBusy) eng.stop();
    let result, why;
    const c = G.chess;
    if (reason === 'abbandono') { result = color === 'w' ? '0-1' : '1-0'; why = 'Hai abbandonato'; }
    else if (reason === 'tempo-tu') { result = color === 'w' ? '0-1' : '1-0'; why = 'Tempo scaduto'; }
    else if (reason === 'tempo-motore') { result = color === 'w' ? '1-0' : '0-1'; why = 'Tempo scaduto a Stockfish'; }
    else if (c.isCheckmate()) { result = c.turn() === 'w' ? '0-1' : '1-0'; why = 'Scacco matto'; }
    else if (c.isStalemate()) { result = '½-½'; why = 'Stallo'; }
    else if (c.isThreefoldRepetition()) { result = '½-½'; why = 'Triplice ripetizione'; }
    else if (c.isInsufficientMaterial()) { result = '½-½'; why = 'Materiale insufficiente'; }
    else { result = '½-½'; why = 'Patta'; }
    const outcome = result === '½-½' ? 'd' : ((result === '1-0') === (color === 'w') ? 'w' : 'l');
    const g = { id: G.id, date: G.date, color, elo, tc, result, why, outcome, moves: c.history(), times: G.times };
    if (g.moves.length >= 2) saveGame(g);
    refresh();
    if (outcome === 'w') { sound('win'); confetti(); } else sound(outcome === 'l' ? 'bad' : 'good');
    const ov = document.createElement('div');
    ov.className = 'over';
    const myMoves = Math.floor((g.moves.length + (color === 'w' ? 1 : 0)) / 2);
    const counts = daily !== undefined && (myMoves >= 10 || c.isCheckmate());
    const nGames = counts ? addDailyGame(g.id) : dailyState().gameIds.length;
    const reviewOpen = !dailyState().done[3];
    ov.innerHTML = `<div class="res ${outcome}">${outcome === 'w' ? 'Vittoria' : outcome === 'l' ? 'Sconfitta' : 'Patta'}</div>
      <div class="muted">${esc(why)} · ${esc(result)}</div>
      ${daily !== undefined && !counts ? '<p class="small">Partita troppo breve per la lezione: ne serve una di almeno 10 tue mosse.</p>' : ''}
      ${counts ? `<p class="small">${nGames < MIN_GAMES ? `Partita ${nGames} di ${MIN_GAMES} completata: ne mancano ${MIN_GAMES - nGames}.` : `Hai completato le ${MIN_GAMES} partite richieste${nGames > MIN_GAMES ? ` (${nGames} giocate)` : ''}.`}</p>` : ''}
      <div class="row">${counts ? `${nGames < MIN_GAMES ? '<button class="btn primary" id="next">Prossima partita ▶</button>' : '<button class="btn primary" id="cont">Vai alla revisione con il tutor ▶</button>'}${nGames >= MIN_GAMES && reviewOpen ? '<button class="btn" id="next">Gioca un\'altra partita</button>' : ''}<button class="btn" id="home">Lezione</button>` : `${g.moves.length >= 2 && daily === undefined ? '<button class="btn primary" id="an">Analizza</button>' : ''}<button class="btn" id="again">${daily !== undefined ? 'Gioca di nuovo' : 'Rivincita'}</button><button class="btn" id="home">Home</button>`}</div>`;
    $('.game').append(ov);
    ov.querySelector('#cont')?.addEventListener('click', () => go('dailyReview'));
    ov.querySelector('#next')?.addEventListener('click', () => go('setup', { daily }));
    ov.querySelector('#an')?.addEventListener('click', () => go('review', { id: g.id, auto: true }));
    if (counts) { ov.querySelector('#home').onclick = () => go('today'); return; }
    ov.querySelector('#again').onclick = () => go('play', { eng, color: daily !== undefined ? color : (settings().color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : color), elo: settings().elo, tc: settings().tc, daily });
    ov.querySelector('#home').onclick = () => go('home');
  }

  $('#flip').onclick = () => { board.orient = board.orient === 'w' ? 'b' : 'w'; board.render(); };
  $('#resign').onclick = () => { if (!G.over && confirm('Abbandonare la partita?')) finish('abbandono'); };
  const unload = e => { if (daily !== undefined) { persistGame(); return; } if (!G.over && G.chess.history().length) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', unload);
  const onHide = () => { if (document.visibilityState === 'hidden') persistGame(); };
  document.addEventListener('visibilitychange', onHide);
  cleanup = () => {
    document.removeEventListener('visibilitychange', onHide);
    if (daily !== undefined && !G.over && G.chess.history().length) {
      // nella lezione del giorno uscire non è un abbandono: la partita resta in pausa
      persistGame(); toast('Partita in pausa: la riprendi dalla lezione del giorno');
    } else if (!G.over && G.chess.history().length >= 2) {
      if (!confirm('La partita è in corso. Uscendo conta come abbandonata. Continuare?')) { cleanup = cl; return false; }
      finish('abbandono');
    }
    G.over = true; clearInterval(tick); window.removeEventListener('beforeunload', unload);
    cancelBg();
    if (G.engineBusy) eng.stop();
  };
  const cl = cleanup;
  if (resume) { G.turnStart = G.chess.history().length >= 2 ? performance.now() : null; renderMoves(); setTimeout(() => toast('Partita ripresa dal punto in cui l\'avevi lasciata'), 200); }
  refresh();
  if (G.chess.turn() !== color) engineMove(); else startBg();
};

// ---------- ELENCO PARTITE ----------
views.games = () => {
  const all = games();
  app.innerHTML = `<section class="panel"><div class="phead"><h2>Le mie partite</h2><button class="btn small" id="toSt">▥ Statistiche</button></div>
  <button class="btn primary" id="toImp">⇩ Importa una partita da Lichess</button>
  ${all.length ? '' : '<p class="muted">Nessuna partita ancora.</p>'}
  <ul class="glist">${all.map(g => `<li data-id="${g.id}">
    <span class="dot ${g.outcome}"></span>
    <div class="gi"><b>${g.color === 'w' ? 'Bianco' : 'Nero'} vs ${esc(oppLabel(g))}${g.source ? ' <span class="tag li">Lichess</span>' : ''}</b><span class="muted small">${new Date(g.date).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${g.tc} · ${Math.ceil(g.moves.length / 2)} mosse · ${esc(g.why)}</span></div>
    <span class="acc">${g.analysis ? g.analysis.accuracy + '%' : '<span class="tag">da analizzare</span>'}</span></li>`).join('')}</ul></section>`;
  app.querySelectorAll('.glist li').forEach(li => li.onclick = () => go('review', { id: li.dataset.id }));
  $('#toSt').onclick = () => go('stats');
  $('#toImp').onclick = () => go('import');
};

// ---------- IMPORTAZIONE PGN (partite giocate su Lichess) ----------
views.import = (opts = {}) => {
  const daily = opts.daily;
  const s = settings();
  app.innerHTML = `<section class="panel"><h2>${daily !== undefined ? 'Partita del giorno da Lichess' : 'Importa da Lichess'}</h2>
    <p class="muted small">Apri la partita su Lichess, copia il suo PGN (dalla funzione di condivisione o esportazione) e incollalo qui. Puoi anche scegliere un file .pgn, anche con più partite. L'app non si collega a Lichess: legge solo il testo.</p>
    ${daily !== undefined ? '<p class="small">Per la lezione servono partite giocate nelle ultime 24 ore (una alla volta, ne servono ${MIN_GAMES} in tutto tra giocate qui e importate), con almeno 10 tue mosse (o finita con un matto).</p>' : ''}
    <label class="lbl">Il tuo nome utente Lichess</label>
    <input id="lu" value="${esc(s.lichessUser || '')}" placeholder="serve per capire con che colore giocavi" autocomplete="off" autocapitalize="off">
    <label class="lbl">PGN</label>
    <textarea id="pgn" class="pgnbox" rows="7" placeholder='[Event "Rated Blitz game"] … 1. e4 e5 2. Cf3 …'></textarea>
    <div class="row"><button class="btn small" id="paste">📋 Incolla dagli appunti</button><label class="btn small filebtn">📂 File .pgn<input type="file" id="pf" accept=".pgn,text/plain,application/x-chess-pgn" hidden></label></div>
    <div id="colAsk" hidden><label class="lbl" id="colQ">Con che colore giocavi?</label><div class="seg" id="icol"><button data-v="w">♔ Bianco</button><button data-v="b">♚ Nero</button></div></div>
    <button class="btn primary big" id="imp">Importa e rivedi</button>
    <p class="small" id="ist"></p></section>`;
  let color = null;
  $('#icol').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; color = b.dataset.v; $('#icol').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#paste').onclick = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) $('#pgn').value = t; else toast('Gli appunti sono vuoti'); }
    catch { toast('Il telefono non permette la lettura degli appunti: tieni premuto nel riquadro e scegli Incolla'); }
  };
  $('#pf').onchange = async e => { const f = e.target.files[0]; if (f) $('#pgn').value = await f.text(); };
  const msg = (t, err) => { const el = $('#ist'); el.textContent = t; el.className = 'small' + (err ? ' err' : ''); };
  $('#imp').onclick = () => {
    const username = $('#lu').value.trim();
    if (username !== (s.lichessUser || '')) saveSettings({ lichessUser: username });
    const pgs = splitGames($('#pgn').value);
    if (!pgs.length) return msg('Non trovo nessuna partita nel testo incollato.', true);
    if (daily !== undefined && pgs.length > 1) return msg('Per la lezione del giorno incolla una sola partita.', true);
    const ok = [], bad = [];
    for (const pg of pgs) {
      try { ok.push(toGame(pg, { username, color: pgs.length === 1 ? color : null })); }
      catch (e) {
        if (e.code === 'COLORE' && pgs.length === 1) {
          $('#colAsk').hidden = false;
          $('#colQ').textContent = `Con che colore giocavi? (${e.headers.White || 'Bianco'} contro ${e.headers.Black || 'Nero'})`;
          return msg('Non riconosco il tuo nome tra i giocatori: scegli il colore o correggi il nome utente.', true);
        }
        bad.push(e.code === 'COLORE' ? `${pg.headers.White || '?'} - ${pg.headers.Black || '?'}: il tuo nome utente non compare tra i giocatori` : `${pg.headers.White || '?'} - ${pg.headers.Black || '?'}: ${e.message}`);
      }
    }
    if (!ok.length) return msg('Nessuna partita importata. ' + bad.join('; '), true);
    // le partite già presenti non si duplicano (si conserva l'analisi già fatta)
    const fresh = ok.map(g => getGame(g.id) || g);
    for (const g of fresh.slice().reverse()) if (!getGame(g.id)) saveGame(g);
    if (daily !== undefined) {
      const g = fresh[0];
      const myMoves = g.moves.filter((_, k) => (k % 2 === 0) === (g.color === 'w')).length;
      const mate = /#$/.test(g.moves[g.moves.length - 1]);
      if (Date.now() - new Date(g.date).getTime() > 86400000) return msg('Questa partita non è delle ultime 24 ore: per la lezione serve una partita di oggi.', true);
      if (myMoves < 10 && !mate) return msg('Partita troppo breve per la lezione: ne serve una con almeno 10 tue mosse.', true);
      const n = addDailyGame(g.id);
      if (n < MIN_GAMES) { toast(`Partita ${n} di ${MIN_GAMES} registrata`); return go('today'); }
      return go('dailyReview');
    }
    if (fresh.length === 1) return go('review', { id: fresh[0].id, auto: true });
    toast(`Importate ${fresh.length} partite${bad.length ? `, ${bad.length} scartate` : ''}`);
    go('games');
  };
};

// ---------- ANALISI ----------
async function runAnalysis(g, onProg, cancelled) {
  const eng = await ensureEngine({ set textContent(v) { onProg(v); } });
  const depth = +settings().depth || 12;
  await eng.newGame();
  await eng.configure({ 'UCI_LimitStrength': 'false', 'Skill Level': 20 });
  const c = new Chess();
  const fens = [c.fen()];
  for (const san of g.moves) { c.move(san); fens.push(c.fen()); }
  const evals = [];
  for (let i = 0; i < fens.length; i++) {
    if (cancelled()) throw new Error('annullata');
    onProg(`Analisi posizione ${i + 1} di ${fens.length}…`, i / fens.length);
    const t = terminalEval(fens[i]);
    if (t) { evals.push(t); continue; }
    const info = await eng.search(fens[i], `go depth ${depth} movetime 4000`);
    evals.push(whitePov(info, fens[i]));
  }
  let moves = classifyGame(g, evals);
  // Verifica più profonda degli errori gravi: a bassa profondità il motore può non vedere
  // un sacrificio vincente (es. un matto in 3) e scambiare una mossa forte per un errore.
  const toCheck = new Set();
  for (const m of moves) if (m.mover === g.color && (m.cls === 'mistake' || m.cls === 'blunder')) { toCheck.add(m.i); toCheck.add(m.i + 1); }
  let k = 0;
  for (const i of [...toCheck].sort((a, b) => a - b)) {
    if (cancelled()) throw new Error('annullata');
    onProg(`Verifica approfondita degli errori (${++k} di ${toCheck.size})…`, 0.97);
    if (terminalEval(fens[i])) continue;
    const info = await eng.search(fens[i], `go depth ${depth + 6} movetime 4000`);
    if ((info.depth || 0) >= (evals[i].depth || 0)) evals[i] = whitePov(info, fens[i]);
  }
  if (toCheck.size) moves = classifyGame(g, evals);
  g.analysis = { depth, engine: eng.name, moves, accuracy: gameAccuracy(moves, g.color), date: new Date().toISOString(), expl: {} };
  saveGame(g);
  const n = addPersonalFromGame(g);
  if (n) toast(`${n} ${n === 1 ? 'tuo errore è diventato un puzzle' : 'tuoi errori sono diventati puzzle'}`);
  return g;
}

const CLS_COLOR = { best: '#4caf7d', good: '#8fbf9f', inacc: '#e3c34a', mistake: '#ef8a3c', blunder: '#e2504c' };

// Motivi che l'utente può indicare quando segna un proprio errore (prima di vedere il motore).
const REASONS = ['Pezzo lasciato in presa', 'Tattica non vista', "Minaccia dell'avversario non vista", 'Piano sbagliato', 'Fretta o poco tempo', 'Non so il perché'];

views.review = async ({ id, auto, daily }) => {
  let g = getGame(id);
  if (!g) return go('games');
  let cancel = false;
  cleanup = () => { cancel = true; };
  // "Prima pensi tu": la partita nuova si ripercorre senza motore, mentre l'analisi gira in sottofondo.
  if (!g.analysis && !g.selfReview) return selfReview(g, daily, () => cancel);
  if (!g.analysis) {
    app.innerHTML = `<section class="panel"><h2>Analisi</h2>
      <p class="muted">Stockfish valuta ogni posizione della partita (profondità ${settings().depth}). Sul telefono servono circa 1-2 minuti.</p>
      <div class="prog"><div id="pb"></div></div><p class="small muted" id="ps"></p>
      <button class="btn primary" id="go">Avvia analisi</button></section>`;
    const startA = async () => {
      $('#go').disabled = true;
      try {
        g = await runAnalysis(g, (msg, f) => { $('#ps') && ($('#ps').textContent = msg); if (f !== undefined && $('#pb')) $('#pb').style.width = (f * 100) + '%'; }, () => cancel);
        if (!cancel) renderReview(g, daily, true);
      } catch (e) { if (!cancel) { $('#ps').textContent = 'Errore: ' + e.message; $('#go').disabled = false; } }
    };
    $('#go').onclick = startA;
    if (auto) startA();
    return;
  }
  renderReview(g, daily);
};

function selfReview(g, daily, cancelled) {
  const marks = {}; // indice semimossa -> { reason, alt, altSan }
  // bozza: i segni messi finora e la mossa in cui eri restano salvati se ti interrompi
  const draft = store.get('selfrev-draft', null);
  const fromDraft = draft && draft.gid === g.id;
  if (fromDraft) Object.assign(marks, draft.marks || {});
  const c0 = new Chess();
  const fens = [c0.fen()], ucis = [];
  for (const san of g.moves) { const m = c0.move(san); ucis.push(m.from + m.to + (m.promotion || '')); fens.push(c0.fen()); }
  const isMine = i => (i % 2 === 0) === (g.color === 'w');
  app.innerHTML = `
  <section class="review selfrev">
    <div class="rhead"><div><b>Prima pensi tu</b><div class="muted small">${g.color === 'w' ? 'Bianco' : 'Nero'} vs ${esc(oppLabel(g))} · ${esc(g.why)} · ${esc(g.result)}</div></div></div>
    <p class="small">Ripercorri la partita <b>senza il motore</b>. Su ogni tua mossa che secondo te è un errore tocca <b>«Qui ho sbagliato»</b>, scegli il motivo e, se puoi, gioca sulla scacchiera la mossa giusta. Poi confronti il tuo giudizio con quello di Stockfish: è così che si allena l'occhio.</p>
    <div class="bwrap"><div id="board"></div></div>
    <div class="row nav2"><button class="btn" data-n="first">⏮</button><button class="btn" data-n="prev">◀</button><button class="btn" data-n="next">▶</button><button class="btn" data-n="last">⏭</button></div>
    <div class="info" id="sinfo"></div>
    <div class="moves list" id="mv"></div>
    <div class="panel"><h3>Le tue mosse segnate <span class="muted small" id="nmk">(0)</span></h3><ul class="crit" id="mk"></ul>
      <div class="prog"><div id="pb"></div></div><p class="small muted" id="ps">Stockfish analizza la partita in sottofondo…</p>
      <button class="btn primary big" id="cmp" disabled>Confronta con Stockfish ▶</button>
      ${daily === undefined ? '<button class="linkbtn" id="skip">Salta questo passaggio</button>' : ''}</div>
  </section>`;
  const board = new Board($('#board'));
  board.orient = g.color;
  let cur = -1, proposing = false;
  const mvEl = $('#mv');
  const num = i => `${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'}`;
  const drawMoves = () => {
    store.set('selfrev-draft', { gid: g.id, marks, cur });
    mvEl.innerHTML = g.moves.map((san, i) => `${i % 2 === 0 ? `<span class="n">${i / 2 + 1}.</span>` : ''}<span class="m ${marks[i] ? 'flag' : ''} ${i === cur ? 'cur' : ''}" data-i="${i}">${esc(itSan(san))}${marks[i] ? ' 🚩' : ''}</span>`).join(' ');
    mvEl.querySelector('.m.cur')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const ks = Object.keys(marks).map(Number).sort((a, b) => a - b);
    $('#nmk').textContent = `(${ks.length})`;
    $('#mk').innerHTML = ks.map(i => `<li data-i="${i}">🚩 ${num(i)} ${esc(itSan(g.moves[i]))} <span class="muted small">${esc(marks[i].reason || 'motivo non indicato')}${marks[i].altSan ? ' · meglio secondo te: ' + esc(itSan(marks[i].altSan)) : ''}</span></li>`).join('') || '<li class="muted">Nessuna mossa segnata.</li>';
    $('#mk').querySelectorAll('li[data-i]').forEach(li => li.onclick = () => show(+li.dataset.i));
  };
  const clockTxt = i => { const t = g.times?.[i]; if (t === null || t === undefined) return ''; const sec = Math.round(t / 1000); return ` · ti restavano ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  function show(i) {
    proposing = false; board.interactive = false; board.onMove = null;
    cur = Math.max(-1, Math.min(g.moves.length - 1, i));
    const c = new Chess(fens[cur + 1]);
    let check = null;
    if (c.inCheck()) for (const row of c.board()) for (const p of row) if (p && p.type === 'k' && p.color === c.turn()) check = p.square;
    board.set({ fen: fens[cur + 1], last: cur >= 0 ? { from: ucis[cur].slice(0, 2), to: ucis[cur].slice(2, 4) } : null, arrows: [], check });
    drawMoves(); info();
  }
  function info() {
    const el = $('#sinfo');
    if (cur < 0) { el.innerHTML = '<p class="muted">Posizione iniziale. Usa ▶ per scorrere la partita.</p>'; return; }
    if (!isMine(cur)) { el.innerHTML = `<p><b>${num(cur)} ${esc(itSan(g.moves[cur]))}</b> <span class="muted">mossa dell'avversario${clockTxt(cur)}</span></p>`; return; }
    const mk = marks[cur];
    el.innerHTML = `<p><b>${num(cur)} ${esc(itSan(g.moves[cur]))}</b> <span class="muted">tua mossa${clockTxt(cur)}</span></p>
      <div class="row"><button class="btn small ${mk ? '' : 'primary'}" id="flag">${mk ? '✕ Togli il segno' : '🚩 Qui ho sbagliato'}</button></div>
      ${mk ? `<p class="small">Perché secondo te?</p><div class="chips" id="rs">${REASONS.map(r => `<button class="chip ${mk.reason === r ? 'on' : ''}">${esc(r)}</button>`).join('')}</div>
      <p class="small">Quale mossa andava giocata? ${mk.altSan ? `Hai proposto <b>${esc(itSan(mk.altSan))}</b>.` : ''}</p>
      <div class="row"><button class="btn small" id="prop">${mk.altSan ? '↺ Cambia proposta' : '♟ Gioca la mossa giusta sulla scacchiera'}</button>${mk.altSan ? '<button class="btn small" id="unprop">Togli proposta</button>' : ''}</div>` : ''}`;
    $('#flag').onclick = () => { if (marks[cur]) delete marks[cur]; else marks[cur] = {}; drawMoves(); info(); };
    $('#rs')?.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; marks[cur].reason = b.textContent; info(); drawMoves(); });
    $('#unprop')?.addEventListener('click', () => { delete marks[cur].alt; delete marks[cur].altSan; show(cur); });
    $('#prop')?.addEventListener('click', () => {
      // si torna alla posizione prima della mossa: l'utente gioca l'alternativa
      const i = cur, fen = fens[i];
      const c = new Chess(fen);
      const legal = {};
      for (const m of c.moves({ verbose: true })) (legal[m.from] = legal[m.from] || []).push({ to: m.to, promotion: m.promotion });
      board.set({ fen, last: i > 0 ? { from: ucis[i - 1].slice(0, 2), to: ucis[i - 1].slice(2, 4) } : null, arrows: [], check: null });
      board.legal = sq => legal[sq] || [];
      board.interactive = true; proposing = true;
      $('#sinfo').insertAdjacentHTML('beforeend', '<p class="small hint">Posizione prima della tua mossa: gioca quella che secondo te era migliore.</p>');
      board.onMove = mv => {
        let m; try { m = new Chess(fen).move(mv); } catch { return; }
        marks[i].alt = m.from + m.to + (m.promotion || ''); marks[i].altSan = m.san;
        board.interactive = false; proposing = false;
        board.set({ fen: new Chess(fen).fen(), last: null, arrows: [{ from: m.from, to: m.to, color: '#e3c34a' }, { from: ucis[i].slice(0, 2), to: ucis[i].slice(2, 4), color: '#e2504c' }], check: null });
        sound('move');
        drawMoves(); info();
      };
    });
  }
  document.querySelector('.nav2').addEventListener('click', e => {
    const n = e.target.closest('button')?.dataset.n;
    if (n === 'first') show(-1); else if (n === 'prev') show(cur - 1); else if (n === 'next') show(cur + 1); else if (n === 'last') show(g.moves.length - 1);
  });
  mvEl.addEventListener('click', e => { const x = e.target.closest('.m'); if (x) show(+x.dataset.i); });
  let sx = null;
  $('#board').addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  $('#board').addEventListener('touchend', e => { if (sx === null || proposing) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); sx = null; });
  show(fromDraft ? draft.cur : -1);
  if (fromDraft && Object.keys(marks).length) toast('Riprendi: i segni che avevi messo sono ancora lì');

  // analisi in sottofondo
  let analysed = null, failed = null;
  const prog = (msg, f) => { $('#ps') && ($('#ps').textContent = msg); if (f !== undefined && $('#pb')) $('#pb').style.width = (f * 100) + '%'; };
  const run = () => runAnalysis(g, prog, cancelled).then(x => {
    analysed = x;
    prog('Analisi pronta: quando hai finito di segnare i tuoi errori, confronta.', 1);
    $('#cmp') && ($('#cmp').disabled = false);
  }).catch(e => { if (!cancelled()) { failed = e; prog('Errore nell\'analisi: ' + e.message + ' (tocca Confronta per riprovare)'); $('#cmp') && ($('#cmp').disabled = false); } });
  run();
  const finishSelf = async skipped => {
    if (failed) { failed = null; $('#cmp').disabled = true; return run(); }
    const g2 = analysed;
    if (skipped) { g2.selfReview = { skipped: true }; saveGame(g2); localStorage.removeItem('selfrev-draft'); return renderReview(g2, daily, true); }
    const ks = Object.keys(marks);
    if (!ks.length && !confirm('Non hai segnato nessuna mossa: secondo te non hai commesso errori? Confermi?')) return;
    $('#cmp').disabled = true;
    // valuta le mosse proposte con il motore
    const props = ks.filter(k => marks[k].alt);
    if (props.length) {
      const eng = await ensureEngine(null);
      await eng.configure({ 'UCI_LimitStrength': 'false', 'Skill Level': 20 });
      for (const [n, k] of props.entries()) {
        prog(`Valuto le mosse che hai proposto (${n + 1} di ${props.length})…`);
        const M = g2.analysis.moves[+k], mk = marks[k];
        if (mk.alt === M.best) { mk.altLoss = 0; continue; }
        const c = new Chess(M.fenBefore); c.move({ from: mk.alt.slice(0, 2), to: mk.alt.slice(2, 4), promotion: mk.alt[4] });
        const E = terminalEval(c.fen()) || whitePov(await eng.search(c.fen(), `go depth ${Math.min(12, +settings().depth || 12)} movetime 2500`), c.fen());
        const sg = M.mover === 'w' ? 1 : -1;
        mk.altLoss = Math.round(Math.max(0, winPct(sg * M.evalBefore.cp) - winPct(sg * E.cp)) * 10) / 10;
      }
    }
    g2.selfReview = { marks, date: new Date().toISOString() };
    saveGame(g2);
    localStorage.removeItem('selfrev-draft');
    renderReview(g2, daily, true);
  };
  $('#cmp').onclick = () => finishSelf(false);
  $('#skip')?.addEventListener('click', () => {
    if (!analysed && !failed) return toast('Attendi la fine dell\'analisi');
    finishSelf(true);
  });
}

// Confronto tra le mosse che l'utente ha segnato da solo e il giudizio del motore.
function compareSelf(A, marks, critical) {
  const found = [], near = [], missed = [], falseAlarm = [];
  const markedIdx = Object.keys(marks).map(Number);
  const used = new Set();
  for (const m of critical) {
    if (marks[m.i]) { found.push({ m, mk: marks[m.i] }); used.add(m.i); continue; }
    // segno sulla tua mossa precedente o successiva: ci sei andato vicino
    const nb = [m.i - 2, m.i + 2].find(j => marks[j] && !used.has(j) && !critical.some(c => c.i === j));
    if (nb !== undefined) { near.push({ m, j: nb }); used.add(nb); }
    missed.push(m);
  }
  for (const i of markedIdx) if (!used.has(i)) falseAlarm.push(A.moves[i]);
  return { found, near, missed, falseAlarm, total: critical.length };
}
function altVerdict(mk, m) {
  if (mk.altLoss === undefined) return '';
  if (mk.alt === m.best || mk.altLoss <= 2) return 'è la mossa giusta (o equivalente alla migliore).';
  if (mk.altLoss < 5) return 'buona, quasi come la migliore.';
  if (mk.altLoss < 10) return 'meglio di quella giocata, ma non la migliore.';
  return 'anche questa perdeva molto: la migliore era ' + itSan(m.bestSan) + '.';
}
function selfPanel(c, critical) {
  const num = m => `${Math.floor(m.i / 2) + 1}${m.mover === 'w' ? '.' : '…'} ${esc(itSan(m.san))}`;
  const nearOf = m => c.near.find(x => x.m === m);
  const pct = c.total ? Math.round(c.found.length / c.total * 100) : null;
  return `<div class="panel selfcmp"><h3>Il tuo giudizio contro Stockfish</h3>
    ${c.total ? `<p class="scoreline"><b>${c.found.length} su ${c.total}</b> errori gravi riconosciuti da solo${pct !== null ? ` (${pct}%)` : ''}.</p>` : '<p>Stockfish non ha trovato errori gravi in questa partita.</p>'}
    ${c.found.length ? `<h4>✓ Visti da te</h4><ul class="crit">${c.found.map(({ m, mk }) => `<li data-i="${m.i}"><span class="badge" style="--c:${CLS_COLOR[m.cls]}">${m.sym}</span> ${num(m)} <span class="muted small">tu: ${esc((mk.reason || 'motivo non indicato').toLowerCase())} · Stockfish: ${esc((m.type || m.label).toLowerCase())}${mk.altSan ? ` · la tua proposta ${esc(itSan(mk.altSan))} ${esc(altVerdict(mk, m))}` : ''}</span></li>`).join('')}</ul>` : ''}
    ${c.missed.length ? `<h4>✕ Sfuggiti</h4><ul class="crit">${c.missed.map(m => `<li data-i="${m.i}"><span class="badge" style="--c:${CLS_COLOR[m.cls]}">${m.sym}</span> ${num(m)} <span class="muted small">${esc(m.type || m.label)} · ${m.phase}${nearOf(m) ? ' · avevi segnato la mossa ' + (nearOf(m).j < m.i ? 'prima' : 'dopo') + ': ci sei andato vicino' : ''}</span></li>`).join('')}</ul><p class="small">Questi sono i più importanti: il tutor parte da qui.</p>` : ''}
    ${c.falseAlarm.length ? `<h4>Falsi allarmi</h4><ul class="crit">${c.falseAlarm.map(m => `<li data-i="${m.i}"><span class="badge" style="--c:${CLS_COLOR[m.cls]}">${m.sym || '✓'}</span> ${num(m)} <span class="muted small">${m.cls === 'inacc' ? 'solo una piccola imprecisione' : 'la mossa andava bene (' + m.label.toLowerCase() + ')'}</span></li>`).join('')}</ul>` : ''}
  </div>`;
}

function renderReview(g, daily, autoTutor = false) {
  const A = g.analysis;
  const mine = A.moves.filter(m => m.mover === g.color);
  const count = k => mine.filter(m => m.cls === k).length;
  const critical = mine.filter(m => m.cls === 'blunder' || m.cls === 'mistake');
  const SR = g.selfReview && !g.selfReview.skipped ? g.selfReview : null;
  const marks = SR ? SR.marks : {};
  const cmp = SR ? compareSelf(A, marks, critical) : null;
  // il tutor parte dagli errori che non avevi visto da solo
  const tutorList = cmp ? [...cmp.missed, ...cmp.found.map(x => x.m)].sort((a, b) => (cmp.missed.includes(b) - cmp.missed.includes(a)) || a.i - b.i) : critical;
  app.innerHTML = `
  <section class="review">
    <div class="rhead"><div><b>${g.color === 'w' ? 'Bianco' : 'Nero'} vs ${esc(oppLabel(g))}</b><div class="muted small">${esc(g.why)} · ${esc(g.result)} · ${g.tc}</div></div>
      <div class="accbig">${A.accuracy ?? '—'}%<span>precisione</span></div></div>
    <div class="counts"><span style="--c:${CLS_COLOR.inacc}">?! ${count('inacc')}</span><span style="--c:${CLS_COLOR.mistake}">? ${count('mistake')}</span><span style="--c:${CLS_COLOR.blunder}">?? ${count('blunder')}</span></div>
    <div class="bwrap"><div class="evalbar"><div id="ebw"></div></div><div id="board"></div></div>
    <div class="row nav2"><button class="btn" data-n="first">⏮</button><button class="btn" data-n="prev">◀</button><button class="btn" data-n="next">▶</button><button class="btn" data-n="last">⏭</button><button class="btn" id="nextErr">Prossimo errore ⚠</button></div>
    ${critical.length ? `<button class="btn primary big tutorbtn" id="tutorAll">🎓 Rivedi ${critical.length === 1 ? "l'errore" : `i ${critical.length} errori`} con il tutor</button>` : (daily !== undefined ? '<button class="btn primary big tutorbtn" id="dailyCont">Nessun errore grave: continua la lezione del giorno ▶</button>' : '')}
    ${daily !== undefined && critical.length ? '<p class="muted small center" id="dailyHint">Per completare la fase rivedi tutti gli errori con il tutor fino alla fine.</p>' : ''}
    ${daily === undefined ? '<button class="btn big tutorbtn" id="tutorGame">🎓 Il tutor commenta tutta la partita</button>' : ''}
    ${cmp ? selfPanel(cmp, critical) : ''}
    <div class="panel diag" id="diag"></div>
    <div class="info" id="info"></div>
    <div class="moves list" id="mv"></div>
    <div class="panel"><h3>Momenti critici (${critical.length})</h3>
      <ul class="crit">${critical.map(m => `<li data-i="${m.i}"><span class="badge" style="--c:${CLS_COLOR[m.cls]}">${m.sym}</span> ${Math.floor(m.i / 2) + 1}${m.mover === 'w' ? '.' : '…'} ${esc(itSan(m.san))} <span class="muted small">${esc(m.type || '')} · ${m.phase}${m.zeit ? ' · zeitnot' : ''}</span></li>`).join('') || '<li class="muted">Nessun errore grave. Ottimo.</li>'}</ul>
      <button class="btn" id="summary">💬 Commento della partita con Claude</button>
      <div class="ai" id="sumOut">${A.summary ? fmtAI(A.summary) : ''}</div>
    </div>
    <p class="muted small">Analisi: ${esc(A.engine || 'Stockfish')}, profondità ${A.depth}. <button class="linkbtn" id="redo">Rianalizza</button></p>
  </section>`;
  const board = new Board($('#board'));
  board.orient = g.color;
  let cur = A.moves.length - 1;
  const mvEl = $('#mv');
  mvEl.innerHTML = A.moves.map(m => `${m.mover === 'w' ? `<span class="n">${m.i / 2 + 1}.</span>` : ''}<span class="m ${m.cls}" data-i="${m.i}" style="--c:${CLS_COLOR[m.cls]}">${esc(itSan(m.san))}${m.sym}${marks[m.i] ? '🚩' : ''}</span>`).join(' ');
  const show = i => {
    cur = Math.max(-1, Math.min(A.moves.length - 1, i));
    const m = A.moves[cur];
    const fen = m ? m.fenAfter : new Chess().fen();
    const E = m ? m.evalAfter : A.moves[0]?.evalBefore;
    const arrows = [];
    if (m && m.cls !== 'best' && m.cls !== 'good' && m.best) arrows.push({ from: m.best.slice(0, 2), to: m.best.slice(2, 4), color: '#4caf7d' });
    const c = new Chess(fen);
    let check = null;
    if (c.inCheck()) for (const row of c.board()) for (const p of row) if (p && p.type === 'k' && p.color === c.turn()) check = p.square;
    board.set({ fen, last: m ? { from: m.uci.slice(0, 2), to: m.uci.slice(2, 4) } : null, arrows, check });
    const wp = E ? winPct(E.cp) : 50;
    $('#ebw').style.height = wp + '%';
    $('#ebw').parentElement.classList.toggle('flip', g.color === 'b');
    mvEl.querySelectorAll('.m').forEach(x => x.classList.toggle('cur', +x.dataset.i === cur));
    mvEl.querySelector('.m.cur')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    renderInfo(g, m);
  };
  const info = $('#info');
  function renderInfo(g, m) {
    if (!m) { info.innerHTML = '<p class="muted">Posizione iniziale. Usa ▶ o tocca una mossa.</p>'; return; }
    const mine = m.mover === g.color;
    const pov = s => (m.mover === 'w' ? s : s); // valutazioni mostrate dal punto di vista del bianco
    const bad = m.cls === 'inacc' || m.cls === 'mistake' || m.cls === 'blunder';
    info.innerHTML = `
      <div class="ihead"><span class="badge" style="--c:${CLS_COLOR[m.cls]}">${m.sym || '✓'}</span>
        <b>${Math.floor(m.i / 2) + 1}${m.mover === 'w' ? '.' : '…'} ${esc(itSan(m.san))}</b> <span>${m.label}</span>
        <span class="ev">${pov(fmtEval(m.evalBefore))} → ${pov(fmtEval(m.evalAfter))}</span></div>
      ${m.type ? `<div class="type">${esc(m.type)} · ${m.phase}${m.zeit ? ' · giocata con meno di 15 secondi' : ''}</div>` : ''}
      ${marks[m.i] ? `<div class="selfnote">🚩 Tu avevi segnato questa mossa${marks[m.i].reason ? ': ' + esc(marks[m.i].reason.toLowerCase()) : ''}.${marks[m.i].altSan ? ` Proponevi ${esc(itSan(marks[m.i].altSan))}: ${esc(altVerdict(marks[m.i], m))}` : ''}</div>` : (mine && bad && SR && (m.cls === 'mistake' || m.cls === 'blunder') ? '<div class="selfnote miss">Da solo non l\'avevi visto: è l\'errore più utile da capire.</div>' : '')}
      ${bad && m.bestSan ? `<div>Migliore: <b class="goodtxt">${esc(itSan(m.bestSan))}</b> <span class="muted small">${esc(m.bestLine.map(itSan).join(' '))}</span></div>` : ''}
      ${bad && m.refutation.length ? `<div class="small">Risposta del motore alla tua mossa: <span class="muted">${esc(m.refutation.map(itSan).join(' '))}</span></div>` : ''}
      <div class="row">${mine && bad ? '<button class="btn small primary" id="tutor1">🎓 Il tutor spiega</button>' : ''}${mine ? `<button class="btn small" id="explain">💬 Approfondisci con Claude</button>` : ''}</div>
      <div class="ai" id="aiOut">${A.expl?.[m.i] ? fmtAI(A.expl[m.i]) : ''}</div>`;
    info.querySelector('#tutor1')?.addEventListener('click', () => runTutor([m]));
    info.querySelector('#explain')?.addEventListener('click', async e => {
      e.target.disabled = true;
      const out = info.querySelector('#aiOut');
      out.innerHTML = '<p class="muted">Claude sta ragionando sulla posizione…</p>';
      try {
        const txt = await explainMove(g, m);
        A.expl = A.expl || {}; A.expl[m.i] = txt; saveGame(g);
        if (cur === m.i) out.innerHTML = fmtAI(txt);
        speak(speakable(txt));
      } catch (err) { out.innerHTML = `<p class="err">${esc(err.message)}</p>`; e.target.disabled = false; }
    });
  }
  // Tutor: rivede uno o più errori, con la sequenza delle mosse sulla scacchiera e la voce.
  const tutor = new Tutor(document.querySelector('.nav2'), board);
  function runTutor(list, k = 0) {
    const m = list[k];
    if (daily !== undefined && list === tutorList) store.set('tutor-progress', { gid: g.id, k, n: list.length });
    const steps = errorLesson({
      fenBefore: m.fenBefore, played: m.uci, best: m.best, refutation: m.evalAfter.pv || [], bestLine: m.evalBefore.pv || [],
      label: m.label, type: m.type, me: g.color, evalBefore: m.evalBefore, evalAfter: m.evalAfter,
    });
    cur = m.i;
    mvEl.querySelectorAll('.m').forEach(x => x.classList.toggle('cur', +x.dataset.i === cur));
    renderInfo(g, m);
    tutor.run(steps, {
      onClose: () => show(cur),
      // la spiegazione è arrivata in fondo: si sblocca l'errore successivo (o la fase, se era l'ultimo)
      onEnd: () => {
        const nb = tutor.el?.querySelector('[data-x=next]'); if (nb) nb.disabled = false;
        if (daily !== undefined && list === tutorList && k === list.length - 1) {
          const all = reviewGameDone(g.id);
          const x = tutor.el?.querySelector('.textra');
          if (x) x.insertAdjacentHTML('afterbegin', `<button class="btn primary" data-x="cont">${all ? 'Revisione completata: continua la lezione del giorno ▶' : 'Partita rivista: passa alla prossima ▶'}</button>`);
          x?.querySelector('[data-x=cont]')?.addEventListener('click', () => go(all ? 'today' : 'dailyReview'));
          $('#dailyHint') && ($('#dailyHint').textContent = all ? 'Revisione completata.' : 'Partita rivista: ne restano altre.');
        }
      },
      extra: el => {
        el.innerHTML = `<div class="row">${k + 1 < list.length ? `<button class="btn small primary" data-x="next" ${daily !== undefined ? 'disabled' : ''}>Prossimo errore (${k + 2}/${list.length}) ▶</button>` : ''}<button class="btn small" data-x="claude">💬 Approfondisci con Claude</button></div><div class="ai"></div>`;
        el.querySelector('[data-x=next]')?.addEventListener('click', () => runTutor(list, k + 1));
        el.querySelector('[data-x=claude]').addEventListener('click', async e => {
          e.target.disabled = true; const out = el.querySelector('.ai');
          out.innerHTML = '<p class="muted">Claude sta ragionando sulla posizione…</p>';
          try { const txt = A.expl?.[m.i] || await explainMove(g, m); A.expl = A.expl || {}; A.expl[m.i] = txt; saveGame(g); out.innerHTML = fmtAI(txt); tutor.playing = false; speak(speakable(txt)); }
          catch (err) { out.innerHTML = `<p class="err">${esc(err.message)}</p>`; e.target.disabled = false; }
        });
      },
    });
  }
  async function runGameTutor() {
    const steps = await gameLesson(g, oppLabel(g));
    tutor.run(steps, { onClose: () => show(cur), extra: el => { el.innerHTML = '<div class="row"><button class="btn small" data-x="errs">Rivedi gli errori uno per uno ▶</button></div>'; el.querySelector('[data-x=errs]').onclick = () => critical.length ? runTutor(critical, 0) : toast('Nessun errore grave'); } });
    A.tutorSeen = true; saveGame(g);
  }
  $('#tutorGame')?.addEventListener('click', runGameTutor);
  if (autoTutor && daily === undefined && !A.tutorSeen) setTimeout(runGameTutor, 400);
  const tp = daily !== undefined ? store.get('tutor-progress', null) : null;
  const tk = tp && tp.gid === g.id && tp.k < tutorList.length ? tp.k : 0;
  if (tk && $('#tutorAll')) $('#tutorAll').textContent = `🎓 Riprendi dall'errore ${tk + 1} di ${tutorList.length} ▶`;
  $('#tutorAll')?.addEventListener('click', () => runTutor(tutorList, tk));
  app.querySelectorAll('.selfcmp li[data-i]').forEach(li => li.onclick = () => { show(+li.dataset.i); $('#board').scrollIntoView({ behavior: 'smooth' }); });
  $('#dailyCont')?.addEventListener('click', () => { const all = reviewGameDone(g.id); go(all ? 'today' : 'dailyReview'); });
  // Diagnosi: dove hai perso punti, quale apertura hai giocato, lezione su misura.
  (async () => {
    const st = phaseStats(g);
    await loadOpenings();
    const op = identify(g.moves);
    const valid = PHASES.filter(p => st[p].n >= 3);
    const worst = valid.sort((a, b) => st[b].avg - st[a].avg)[0];
    const el = $('#diag'); if (!el) return;
    const max = Math.max(1, ...PHASES.map(p => st[p].avg));
    el.innerHTML = `<h3>Diagnosi della partita</h3>
      ${op ? `<p>Apertura: <b>${esc(op.nameIt)}</b> <span class="muted small">(${op.eco})</span></p>` : ''}
      <p class="muted small">Perdita media per mossa in ciascuna fase (più la barra è lunga, più punti hai perso).</p>
      ${PHASES.map(p => `<div class="bar ${p === worst ? 'worst' : ''}"><span>${p}</span><div><i style="width:${st[p].n ? st[p].avg / max * 100 : 0}%"></i></div><b>${st[p].n ? st[p].avg.toFixed(1) : '—'}</b></div>`).join('')}
      ${worst ? `<p>La fase più debole di questa partita è ${({ Apertura: "l'apertura", Mediogioco: 'il mediogioco', Finale: 'il finale' })[worst]}. ${esc(PHASE_ADVICE_TXT[worst])}</p>` : ''}
      ${op ? `<button class="btn" id="opLesson">📖 Lezione su ${g.color === 'w' ? 'questa apertura' : 'questa difesa'}</button><p class="small muted" id="opSt"></p>` : ''}`;
    $('#opLesson')?.addEventListener('click', async e => {
      e.target.disabled = true;
      try {
        const L = await buildOpeningLesson(g, () => ensureEngine(null), t => { const x = $('#opSt'); if (x) x.textContent = t; });
        const all = store.get('gen-lessons', []).filter(x => x.id !== L.id); all.unshift(L); store.set('gen-lessons', all.slice(0, 40));
        go('lesson', { lesson: L });
      } catch (err) { $('#opSt').textContent = 'Errore: ' + err.message; e.target.disabled = false; }
    });
  })();
  cleanup = () => { stopSpeech(); };
  document.querySelector('.nav2').addEventListener('click', e => {
    const n = e.target.closest('button')?.dataset.n;
    if (n === 'first') show(-1); else if (n === 'prev') show(cur - 1); else if (n === 'next') show(cur + 1); else if (n === 'last') show(A.moves.length - 1);
  });
  $('#nextErr').onclick = () => {
    const nx = A.moves.find(m => m.i > cur && m.mover === g.color && (m.cls === 'mistake' || m.cls === 'blunder'))
      || A.moves.find(m => m.mover === g.color && (m.cls === 'mistake' || m.cls === 'blunder'));
    if (nx) show(nx.i); else toast('Nessun errore grave in questa partita');
  };
  mvEl.addEventListener('click', e => { const s = e.target.closest('.m'); if (s) show(+s.dataset.i); });
  app.querySelectorAll('.crit li[data-i]').forEach(li => li.onclick = () => { show(+li.dataset.i); $('#board').scrollIntoView({ behavior: 'smooth' }); });
  $('#summary').onclick = async e => {
    e.target.disabled = true;
    $('#sumOut').innerHTML = '<p class="muted">Claude sta preparando il commento…</p>';
    try { const t = await summarizeGame(g); A.summary = t; saveGame(g); $('#sumOut').innerHTML = fmtAI(t); }
    catch (err) { $('#sumOut').innerHTML = `<p class="err">${esc(err.message)}</p>`; }
    e.target.disabled = false;
  };
  $('#redo').onclick = () => { if (confirm('Rifare l\'analisi con la profondità impostata?')) { delete g.analysis; saveGame(g); go('review', { id: g.id, auto: true }); } };
  // Apre sul primo errore grave, altrimenti sull'ultima mossa.
  const first = critical[0];
  show(first ? first.i : A.moves.length - 1);
  let sx = null;
  $('#board').addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  $('#board').addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); sx = null; });
}

// ---------- Claude ----------
function fmtAI(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

function describePosition(fen) {
  const c = new Chess(fen);
  const names = { k: 'Re', q: 'Donna', r: 'Torre', b: 'Alfiere', n: 'Cavallo', p: 'pedone' };
  const side = { w: [], b: [] };
  for (const row of c.board()) for (const p of row) if (p) side[p.color].push(`${names[p.type]} ${p.square}`);
  return `Bianco: ${side.w.join(', ')}.\nNero: ${side.b.join(', ')}.\nTocca al ${c.turn() === 'w' ? 'Bianco' : 'Nero'}.`;
}

const SYSTEM = `Sei un istruttore di scacchi che allena un adulto italiano che gioca blitz su Lichess, con l'obiettivo di arrivare a 2000.
Regole ferree:
- Basati ESCLUSIVAMENTE sui dati del motore Stockfish forniti (valutazioni e varianti). Non inventare mosse, varianti o valutazioni che non compaiono nei dati. Se una spiegazione richiederebbe di calcolare linee non fornite, dillo invece di inventarle.
- Usa la notazione algebrica italiana (R re, D donna, T torre, A alfiere, C cavallo; i pedoni senza lettera).
- Scrivi in italiano, in prosa chiara e concreta, senza elenchi puntati, senza preamboli.
- Sii onesto e diretto sugli errori, ma riconosci ciò che è stato fatto bene.`;

window.__askClaude = (...a) => askClaude(...a); // usato solo dai test
async function askClaude(user, maxTokens = 700) {
  const s = settings();
  if (!s.apiKey) throw new Error('Inserisci la chiave API di Anthropic nelle Impostazioni per usare le spiegazioni.');
  if (!navigator.onLine) throw new Error('Le spiegazioni di Claude richiedono la connessione.');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-api-key': s.apiKey,
      'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
    },
    // Haiku 5.5 ha il ragionamento adattivo attivo di default: qui lo spegniamo (risposte rapide ed economiche).
    body: JSON.stringify({ model: s.model, max_tokens: maxTokens, system: SYSTEM, messages: [{ role: 'user', content: user }], ...(/^claude-haiku-5/.test(s.model) ? { thinking: { type: 'disabled' } } : {}) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Errore API: ' + (j.error?.message || r.status));
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

function pgnUpTo(g, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push((i % 2 === 0 ? `${i / 2 + 1}. ` : '') + itSan(g.moves[i]));
  return out.join(' ');
}

function explainMove(g, m) {
  const ev = E => fmtEval(E) + ' (dal punto di vista del Bianco)';
  const bad = ['inacc', 'mistake', 'blunder'].includes(m.cls);
  const mk = g.selfReview?.marks?.[m.i];
  const selfTxt = !g.selfReview || g.selfReview.skipped ? '' : mk
    ? `\nPrima di vedere il motore avevo segnato da solo questa mossa come errore${mk.reason ? ', pensando: «' + mk.reason + '»' : ''}${mk.altSan ? ', e proponevo ' + itSan(mk.altSan) + (mk.altLoss !== undefined ? ` (secondo Stockfish questa proposta perde ${mk.altLoss} punti percentuali di probabilità di vittoria rispetto alla migliore)` : '') : ''}. Dimmi in una frase se la mia diagnosi era giusta.`
    : (['mistake', 'blunder'].includes(m.cls) ? '\nPrima di vedere il motore NON mi ero accorto che questa mossa fosse un errore: aiutami a capire quale segnale nella posizione avrei dovuto notare.' : '');
  const user = `Partita ${g.tc} contro ${g.source ? 'un avversario umano' : 'Stockfish'}. Io gioco con il ${g.color === 'w' ? 'Bianco' : 'Nero'}.
Mosse fin qui: ${pgnUpTo(g, m.i) || '(posizione iniziale)'}

Posizione prima della mia mossa (FEN ${m.fenBefore}):
${describePosition(m.fenBefore)}

Ho giocato: ${itSan(m.san)}. Classificazione del motore: ${m.label}${m.type ? ', tipo: ' + m.type : ''}. Fase: ${m.phase}.${m.zeit ? ' L\'ho giocata con meno di 15 secondi sull\'orologio.' : ''}
Valutazione prima: ${ev(m.evalBefore)}. Valutazione dopo: ${ev(m.evalAfter)}.
Mossa migliore secondo Stockfish: ${itSan(m.bestSan) || 'n.d.'}. Variante principale: ${m.bestLine.map(itSan).join(' ') || 'n.d.'}
Migliore risposta dell'avversario alla mossa che ho giocato: ${m.refutation.map(itSan).join(' ') || 'n.d.'}${selfTxt}

${bad ? `Spiegami in 120-180 parole perché la mia mossa è ${m.label.toLowerCase()} (che cosa concede, usando la variante di risposta del motore), che cosa chiedeva la posizione e perché la mossa migliore funziona. Chiudi con una regola pratica da ricordare in partita, in una frase.`
      : `Spiegami in 80-120 parole perché questa mossa va bene e quale idea realizza. Chiudi con una regola pratica in una frase.`}`;
  return askClaude(user);
}

function summarizeGame(g) {
  const A = g.analysis;
  const errs = A.moves.filter(m => m.mover === g.color && ['inacc', 'mistake', 'blunder'].includes(m.cls));
  const SR = g.selfReview && !g.selfReview.skipped ? g.selfReview : null;
  const crit = A.moves.filter(m => m.mover === g.color && ['mistake', 'blunder'].includes(m.cls));
  const selfTxt = SR ? `\n\nPrima dell'analisi ho segnato da solo come errori queste mosse: ${Object.keys(SR.marks).map(Number).sort((a, b) => a - b).map(i => `${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'} ${itSan(g.moves[i])}${SR.marks[i].reason ? ' (' + SR.marks[i].reason + ')' : ''}`).join(', ') || 'nessuna'}. Errori gravi secondo Stockfish che non avevo visto: ${crit.filter(m => !SR.marks[m.i]).map(m => `${Math.floor(m.i / 2) + 1}${m.mover === 'w' ? '.' : '…'} ${itSan(m.san)}`).join(', ') || 'nessuno'}.` : '';
  const user = `Partita ${g.tc} contro ${g.source ? `un avversario umano${g.oppElo ? ' di rating ' + g.oppElo : ''} (partita giocata su Lichess)` : `Stockfish limitato a ${g.elo}`}. Io gioco con il ${g.color === 'w' ? 'Bianco' : 'Nero'}. Risultato: ${g.result} (${g.why}). Precisione: ${A.accuracy}%.
Partita: ${pgnUpTo(g, g.moves.length)}

Le mie mosse imprecise o sbagliate secondo Stockfish:
${errs.map(m => `- ${Math.floor(m.i / 2) + 1}${m.mover === 'w' ? '.' : '…'} ${itSan(m.san)} (${m.label}${m.type ? ', ' + m.type : ''}, ${m.phase}${m.zeit ? ', zeitnot' : ''}); valutazione ${fmtEval(m.evalBefore)} → ${fmtEval(m.evalAfter)}; migliore ${itSan(m.bestSan)} (${m.bestLine.slice(0, 5).map(itSan).join(' ')})`).join('\n') || 'nessuna'}

${selfTxt}

Scrivi un commento della partita in 200-280 parole, in tre paragrafi: il filo della partita e il momento in cui si è decisa; gli errori ricorrenti e la loro causa (per esempio pezzi lasciati in presa, minacce non controllate, fretta)${SR ? ", confrontando la mia autovalutazione con quella del motore (che cosa tendo a non vedere)" : ''}; le una o due cose concrete da allenare nei prossimi giorni.`;
  return askClaude(user, 900);
}

// ---------- STATISTICHE ----------
views.stats = () => {
  const st = stats();
  const all = st.analysed.flatMap(g => g.analysis.moves.filter(m => m.mover === g.color));
  const bad = all.filter(m => m.cls === 'mistake' || m.cls === 'blunder');
  const by = k => Object.entries(bad.reduce((o, m) => (o[m[k]] = (o[m[k]] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1]);
  const bars = rows => { const max = Math.max(1, ...rows.map(r => r[1])); return rows.map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><div><i style="width:${v / max * 100}%"></i></div><b>${v}</b></div>`).join(''); };
  const zeit = bad.filter(m => m.zeit).length;
  const perGame = st.analysed.length ? (bad.length / st.analysed.length).toFixed(1) : '—';
  app.innerHTML = `
  <section class="panel"><h2>Statistiche</h2>
    <div class="cards"><div class="card"><div class="k">Analizzate</div><div class="v">${st.analysed.length}</div></div>
    <div class="card"><div class="k">Errori gravi a partita</div><div class="v">${perGame}</div></div>
    ${(() => { const sr = st.analysed.filter(g => g.selfReview && !g.selfReview.skipped).slice(0, 10); let f = 0, t = 0;
      for (const g of sr) for (const m of g.analysis.moves) if (m.mover === g.color && (m.cls === 'mistake' || m.cls === 'blunder')) { t++; if (g.selfReview.marks[m.i]) f++; }
      return sr.length ? `<div class="card"><div class="k">Errori visti da solo</div><div class="v">${t ? Math.round(f / t * 100) + '%' : '—'}</div><div class="muted small">${f} su ${t}, ultime ${sr.length} partite</div></div>` : ''; })()}</div>
    <h3>Dove perdi punti</h3>${bad.length ? bars(by('type').filter(r => r[0] !== 'null')) : '<p class="muted">Analizza qualche partita per vedere i tuoi errori ricorrenti.</p>'}
    <h3>In quale fase</h3>${bad.length ? bars(by('phase')) : ''}
    ${bad.length ? `<p class="muted small">${zeit} errori gravi su ${bad.length} sono stati giocati con meno di 15 secondi.</p>` : ''}
    <h3>Puzzle</h3>${(() => { const R = pzRating(); const ts = Object.entries(themeStats()).filter(([, v]) => v.n >= 3).map(([t, v]) => [THEME_IT[t] || t, Math.round(v.ok / v.n * 100)]).sort((a, b) => a[1] - b[1]).slice(0, 6);
      return `<p>Rating puzzle <b>${R.r}</b> dopo ${R.hist.length} puzzle.</p>` + (ts.length ? '<p class="muted small">Temi con la percentuale di successo più bassa</p>' + ts.map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><div><i style="width:${v}%"></i></div><b>${v}%</b></div>`).join('') : ''); })()}
    <h3>Precisione nelle ultime partite</h3>
    <div class="spark">${st.analysed.slice(0, 20).reverse().map(g => `<i title="${g.analysis.accuracy}%" class="${g.outcome}" style="height:${g.analysis.accuracy}%"></i>`).join('')}</div>
  </section>`;
};

// ---------- IMPOSTAZIONI ----------
views.settings = () => {
  const s = settings();
  const meta = engineMeta();
  app.innerHTML = `
  <section class="panel"><h2>Impostazioni</h2>
    <label class="lbl">Chiave API Anthropic (per le spiegazioni)</label>
    <input id="key" type="password" placeholder="sk-ant-…" value="${esc(s.apiKey)}" autocomplete="off">
    <p class="muted small">Resta salvata solo su questo telefono.</p>
    <label class="lbl">Modello Claude</label>
    <input id="model" value="${esc(s.model)}">
    <label class="lbl">Profondità di analisi</label>
    <div class="seg" id="depth">${[10, 12, 14, 16, 18].map(d => `<button data-v="${d}" class="${+s.depth === d ? 'on' : ''}">${d}</button>`).join('')}</div>
    <p class="muted small">12 è veloce e basta per trovare gli errori di una partita blitz. 16-18 è più preciso ma più lento.</p>
    <button class="btn primary" id="save">Salva</button>
    <h3>Aspetto ed effetti</h3>
    <button class="btn" id="look">♞ Pezzi e scacchiera</button>
    <button class="btn" id="tutors">🎓 Scegli il tutor</button>
    <label class="switch"><input type="checkbox" id="snd" ${s.sound !== false ? 'checked' : ''}><span></span>Suoni</label>
    <label class="lbl">Suono delle mosse (tocca per ascoltare)</label>
    <div class="seg wrap soundsets" id="sset">${SOUND_SETS.map(([k, t]) => `<button data-v="${k}" class="${(s.soundSet || 'torneo') === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <h3>Voce</h3>
    <label class="switch"><input type="checkbox" id="vtu" ${s.voice !== false ? 'checked' : ''}><span></span>Il tutor parla ad alta voce</label>
    <label class="switch"><input type="checkbox" id="vmv" ${s.speakMoves ? 'checked' : ''}><span></span>Leggi la casella di ogni mossa in partita</label>
    <label class="lbl">Voce</label>
    <select id="vsel" class="sel"></select>
    <p class="muted small" id="vnote"></p>
    <label class="lbl">Velocità della voce <b id="vrV">${(+(s.voiceRate || 1.3)).toFixed(2)}×</b></label>
    <input type="range" id="vrate" min="0.8" max="2" step="0.05" value="${s.voiceRate || 1.3}">
    <button class="btn small" id="vtest">🔊 Prova la voce</button>
    <label class="switch"><input type="checkbox" id="hap" ${s.haptics !== false ? 'checked' : ''}><span></span>Vibrazione sugli errori</label>
    <h3>Repertorio</h3>
    <p class="small muted">Bianco: 1.e4 con la Partita Italiana, l'Alapin contro la Siciliana e la spinta e5 contro Francese e Caro-Kann. Nero: 1...e5 contro 1.e4 e il Gambetto di Donna Rifiutato contro 1.d4.</p>
    <h3>Motore</h3>
    <p>${meta ? `Stockfish ${esc(meta.version)} · ${esc(meta.file)} · ${(meta.size / 1048576).toFixed(1)} MB` : 'Non ancora scaricato.'}</p>
    <button class="btn" id="dl">${meta ? 'Controlla aggiornamenti e riscarica' : 'Scarica ora'}</button>
    <p class="small muted" id="dls"></p>
    <details class="small"><summary>Carica il motore da file</summary>
      <p class="muted">Scarica <b>stockfish-19-lite-single.js</b> e <b>stockfish-19-lite-single.wasm</b> dalla pagina dei rilasci di stockfish.js su GitHub, poi selezionali qui insieme.</p>
      <label class="btn file">Scegli i due file<input type="file" id="sffiles" multiple hidden></label>
    </details>
    <h3>Dati</h3>
    <div class="row"><button class="btn" id="exp">Esporta partite (PGN)</button><button class="btn" id="bak">Backup completo</button></div>
    <label class="btn file">Ripristina backup<input type="file" id="res" accept=".json" hidden></label>
  </section>`;
  $('#depth').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#depth').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#save').onclick = () => {
    saveSettings({ apiKey: $('#key').value.trim(), model: $('#model').value.trim() || 'claude-haiku-5-5', depth: +($('#depth .on')?.dataset.v || 12) });
    toast('Salvato');
  };
  $('#look').onclick = () => go('look');
  $('#tutors').onclick = () => go('tutors');
  $('#snd').onchange = e => { saveSettings({ sound: e.target.checked }); if (e.target.checked) sound('good'); };
  $('#sset').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#sset').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    saveSettings({ soundSet: b.dataset.v }); preloadSounds();
    sound('move'); setTimeout(() => sound('capture'), 450); setTimeout(() => sound('check'), 900);
  });
  $('#vtu').onchange = e => saveSettings({ voice: e.target.checked });
  $('#vmv').onchange = e => saveSettings({ speakMoves: e.target.checked });
  const fillVoices = () => {
    const vs = italianVoices(), cur = settings().voiceName;
    $('#vsel').innerHTML = vs.length ? vs.map(v => `<option value="${esc(v.name)}" ${v.name === cur ? 'selected' : ''}>${esc(v.name)}${v.localService ? '' : ' (online, più naturale)'}</option>`).join('') : '<option>Nessuna voce italiana trovata</option>';
    $('#vnote').textContent = vs.length ? `${vs.length} ${vs.length === 1 ? 'voce italiana disponibile' : 'voci italiane disponibili'} su questo telefono. Per voci più naturali installa altre voci in Android: Impostazioni, Sintesi vocale, Google, Installa dati vocali, Italiano.` : 'Installa la voce italiana in Android: Impostazioni, Sintesi vocale, Google, Installa dati vocali.';
  };
  fillVoices();
  if (window.speechSynthesis) speechSynthesis.addEventListener('voiceschanged', fillVoices);
  $('#vsel').onchange = e => { saveSettings({ voiceName: e.target.value }); speak('Ecco la nuova voce del tutor.', { force: true }); };
  $('#vrate').oninput = e => { $('#vrV').textContent = (+e.target.value).toFixed(2) + '×'; saveSettings({ voiceRate: +e.target.value }); };
  $('#vrate').onchange = () => speak('Cavallo effe tre, alfiere ci quattro.', { force: true });
  $('#vtest').onclick = () => speak('Ciao Mino. Hai giocato cavallo prende in e cinque. È un errore: il Nero risponde donna gi cinque, con un doppio attacco.', { force: true });
  $('#hap').onchange = e => saveSettings({ haptics: e.target.checked });
  $('#sffiles').onchange = async e => {
    const fs = [...e.target.files];
    const js = fs.find(f => /\.js$/i.test(f.name)), wasm = fs.find(f => /\.wasm$/i.test(f.name));
    if (!js || !wasm) { $('#dls').textContent = 'Seleziona entrambi i file, il .js e il .wasm.'; return; }
    try { const m = await importEngineFiles(js, wasm); resetEngine(); await getEngine(); $('#dls').textContent = `Pronto: Stockfish ${m.version} caricato da file`; }
    catch (err) { $('#dls').textContent = 'Errore: ' + err.message; }
  };
  $('#dl').onclick = async () => {
    $('#dl').disabled = true;
    try { const m = await downloadEngine(t => $('#dls').textContent = t); resetEngine(); $('#dls').textContent = `Pronto: Stockfish ${m.version}`; }
    catch (e) { $('#dls').textContent = 'Errore: ' + e.message; }
    $('#dl').disabled = false;
  };
  const dlFile = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); };
  $('#exp').onclick = () => {
    const pgn = games().map(g => {
      const c = new Chess();
      for (const m of g.moves) c.move(m);
      c.setHeader('Event', (g.source ? 'Partita Lichess ' : 'Allenamento ') + g.tc); c.setHeader('Date', g.date.slice(0, 10).replace(/-/g, '.'));
      if (g.source) { c.setHeader('White', g.white || '?'); c.setHeader('Black', g.black || '?'); if (g.site) c.setHeader('Site', g.site); }
      else { c.setHeader('White', g.color === 'w' ? 'Mino' : 'Stockfish ' + g.elo); c.setHeader('Black', g.color === 'b' ? 'Mino' : 'Stockfish ' + g.elo); }
      c.setHeader('Result', g.result.replace('½-½', '1/2-1/2'));
      return c.pgn().replace(/ \*$/, ' ' + g.result.replace('½-½', '1/2-1/2'));
    }).join('\n\n');
    dlFile('partite.pgn', pgn, 'application/x-chess-pgn');
  };
  $('#bak').onclick = () => dlFile('scacchi-backup.json', JSON.stringify({ games: games(), settings: { ...settings(), apiKey: '' } }), 'application/json');
  $('#res').onchange = async e => {
    try { const d = JSON.parse(await e.target.files[0].text()); if (!Array.isArray(d.games)) throw 0; store.set('games', d.games); toast(`Ripristinate ${d.games.length} partite`); }
    catch { toast('File di backup non valido'); }
  };
};

// ---------- avvio ----------
installDaily({ views, app, $, esc, go, toast, games, getGame, getEngine: () => ensureEngine(null), settings, setCleanup: f => { cleanup = f; } });
installStudyViews({ views, app, $, esc, go, toast, markPhase, getEngine: () => ensureEngine(null), askClaude, fmtAI, describePosition, setCleanup: f => { cleanup = f; } });
installExtraViews({ views, app, $, esc, go, store, settings, saveSettings, dailyState, markPhase, setCleanup: f => { cleanup = f; } });
applyLook(settings());
preloadSounds();
{ const st = store.get('settings', {}); if (!st.migHaiku) { if (!st.model || st.model === 'claude-sonnet-5-5') st.model = 'claude-haiku-5-5'; st.migHaiku = true; store.set('settings', st); } }
installPuzzleViews({ views, app, $, esc, go, toast, store, games, markPhase, askClaude, fmtAI, describePosition, getEngine: () => ensureEngine(null), setCleanup: f => { cleanup = f; } });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
go('home');

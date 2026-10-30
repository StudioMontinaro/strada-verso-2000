// Allenamento sulle coordinate e scelta dell'aspetto (pezzi e scacchiera).
import { Board, setPieceSet, pieceHtml } from './board.js';
import { sound, confetti, buzz } from './fx.js';
import { markActive } from './path.js';
import { AVATARS, avatarId, getAvatar, avatarHtml, avatarInner } from './avatars.js';
import { speak } from './speech.js';

export const PIECE_SETS = [
  ['cburnett', 'Classici (cburnett)'], ['merida', 'Merida'], ['alpha', 'Alpha'], ['california', 'California'],
  ['staunty', 'Staunty'], ['maestro', 'Maestro'], ['chessnut', 'Chessnut'], ['fantasy', 'Fantasy'], ['simboli', 'Simboli'],
];
export const BOARDS = [
  ['verde', 'Verde', '#ebe5cf', '#7a9a6c'], ['marrone', 'Marrone', '#f0d9b5', '#b58863'], ['blu', 'Blu', '#dee3e6', '#8ca2ad'],
  ['grigio', 'Grigio', '#e6e6e6', '#9e9e9e'], ['viola', 'Viola', '#e8e0f0', '#9b80b5'], ['corallo', 'Corallo', '#f4e4d4', '#d08770'],
  ['wood', 'Legno', null, null], ['wood4', 'Legno scuro', null, null], ['maple', 'Acero', null, null],
  ['marble', 'Marmo', null, null], ['blue2', 'Blu texture', null, null], ['olive', 'Oliva', null, null],
];

export function applyLook(s) {
  setPieceSet(s.pieces || 'cburnett');
  const b = BOARDS.find(x => x[0] === s.board) || BOARDS[0];
  const root = document.documentElement;
  if (b[2]) {
    document.body.classList.remove('tex');
    root.style.setProperty('--light', b[2]); root.style.setProperty('--dark', b[3]);
    root.style.removeProperty('--boardimg');
  } else {
    document.body.classList.add('tex');
    root.style.setProperty('--boardimg', `url(boards/${b[0]}.jpg)`);
    root.style.setProperty('--light', '#e8dcc0'); root.style.setProperty('--dark', '#8a6a48');
  }
}

export function installExtraViews(ctx) {
  const { views, app, $, esc, go, store, settings, saveSettings, setCleanup, dailyState, markPhase } = ctx;
  const FILES = 'abcdefgh';
  const randSq = () => FILES[Math.floor(Math.random() * 8)] + (1 + Math.floor(Math.random() * 8));
  const DURATION = 30000;

  views.coords = () => {
    const c = store.get('coords', { mode: 'find', side: 'w', best: {}, hist: [] });
    const key = (m, s) => `${m}-${s}`;
    app.innerHTML = `
    <section class="hero"><div class="eyebrow">Visione della scacchiera</div><h1>Coordinate</h1>
      <p class="muted">30 secondi: più case giuste possibile. Serve a leggere e calcolare le varianti senza esitazioni.</p></section>
    <section class="panel">
      <label class="lbl">Esercizio</label>
      <div class="seg" id="cmode">${[['find', 'Trova la casa'], ['name', 'Nomina la casa']].map(([v, t]) => `<button data-v="${v}" class="${c.mode === v ? 'on' : ''}">${t}</button>`).join('')}</div>
      <label class="lbl">Lato</label>
      <div class="seg" id="cside">${[['w', 'Bianco'], ['b', 'Nero'], ['r', 'Casuale']].map(([v, t]) => `<button data-v="${v}" class="${c.side === v ? 'on' : ''}">${t}</button>`).join('')}</div>
      <button class="btn primary big" id="cgo">Inizia</button>
      <div class="cards">
        ${[['find', 'w', 'Trova · Bianco'], ['find', 'b', 'Trova · Nero'], ['name', 'w', 'Nomina · Bianco'], ['name', 'b', 'Nomina · Nero']].map(([m, s, t]) => `<div class="card"><div class="k">${t}</div><div class="v">${c.best[key(m, s)] ?? '—'}</div><div class="s">record</div></div>`).join('')}
      </div>
    </section>`;
    const pick = (id, k) => $(id).addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      c[k] = b.dataset.v; store.set('coords', c);
    });
    pick('#cmode', 'mode'); pick('#cside', 'side');
    $('#cgo').onclick = () => run(c.mode, c.side === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : c.side);
  };

  // Coordinate nella lezione del giorno: due giri da 30 secondi, un giorno si cerca la casa, il giorno dopo la si nomina.
  views.coordsDaily = () => {
    const d = dailyState();
    const round = Math.min(d.coordRounds || 0, 1);
    const mode = d.dayNo % 2 ? 'find' : 'name';
    const side = round === 0 ? 'w' : 'b';
    app.innerHTML = `<section class="hero"><div class="eyebrow">Lezione del giorno · coordinate</div><h1>Giro ${round + 1} di 2</h1>
      <p class="muted">${mode === 'find' ? 'Ti viene dato il nome di una casa e la tocchi sulla scacchiera.' : 'Una casa è evidenziata e devi scegliere il suo nome.'} Scacchiera vista dal lato del ${side === 'w' ? 'Bianco' : 'Nero'}, 30 secondi. Obiettivo: almeno 20 case giuste, senza esitare.</p>
      <button class="btn primary big" id="cgo">Inizia ▶</button></section>`;
    $('#cgo').onclick = () => run(mode, side, true);
  };

  function run(mode, side, daily = false) {
    let alive = true;
    setCleanup(() => { alive = false; });
    let score = 0, errors = 0, target = randSq();
    app.innerHTML = `
    <section class="coords">
      <div class="pzhead"><div><b>${mode === 'find' ? 'Trova la casa' : 'Nomina la casa'}</b><div class="muted small">dal lato del ${side === 'w' ? 'Bianco' : 'Nero'}</div></div>
        <div class="cscore"><span id="cs">0</span><small id="ce"></small></div></div>
      <div class="tbar"><i id="tb"></i></div>
      <div class="ctarget" id="ct"></div>
      <div id="board"></div>
      <div class="opts" id="opts"></div>
    </section>`;
    const board = new Board($('#board'));
    board.set({ orient: side, hideCoords: true, interactive: false, sound: false, fen: '8/8/8/8/8/8/8/8 w - - 0 1' });
    const t0 = Date.now();
    const show = () => {
      if (mode === 'find') { $('#ct').textContent = target; board.set({ markSq: null }); }
      else {
        $('#ct').innerHTML = '<span class="small muted">Che casa è quella evidenziata?</span>';
        board.set({ markSq: target });
        const opts = new Set([target]);
        while (opts.size < 4) {
          // distrattori vicini: stessa colonna o stessa traversa, così l'esercizio non è banale
          const r = Math.random();
          const sq = r < 0.4 ? target[0] + (1 + Math.floor(Math.random() * 8)) : r < 0.8 ? FILES[Math.floor(Math.random() * 8)] + target[1] : randSq();
          opts.add(sq);
        }
        $('#opts').innerHTML = [...opts].sort(() => Math.random() - 0.5).map(o => `<button class="btn" data-o="${o}">${o}</button>`).join('');
      }
    };
    const answer = ok => {
      if (ok) { score++; sound('tick'); } else { errors++; sound('bad'); buzz(40); }
      $('#cs').textContent = score; $('#ce').textContent = errors ? ` · ${errors} errori` : '';
      $('#ct').classList.remove('ok', 'ko'); void $('#ct').offsetWidth; $('#ct').classList.add(ok ? 'ok' : 'ko');
      let n; do { n = randSq(); } while (n === target); target = n;
      show();
    };
    board.onSquare = sq => {
      if (!alive || mode !== 'find') return;
      const ok = sq === target;
      board.flash(sq, ok ? 'flash-ok' : 'flash-ko');
      if (!ok) board.flash(target, 'flash-ok');
      answer(ok);
    };
    $('#opts').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !alive) return;
      const ok = b.dataset.o === target;
      if (!ok) board.flash(target, 'flash-ko');
      answer(ok);
    });
    show();
    const tick = setInterval(() => {
      if (!alive) return clearInterval(tick);
      const left = DURATION - (Date.now() - t0);
      $('#tb').style.width = Math.max(0, left / DURATION * 100) + '%';
      if (left <= 0) { clearInterval(tick); end(); }
    }, 100);
    function end() {
      alive = false;
      const c = store.get('coords', { mode, side: 'w', best: {}, hist: [] });
      const k = `${mode}-${side}`;
      const rec = score > (c.best[k] || 0);
      if (rec) c.best[k] = score;
      markActive();
      if (rec && score > 0) { sound('win'); confetti(0.8); }
      c.hist.push([Date.now(), k, score, errors]); if (c.hist.length > 500) c.hist.shift();
      store.set('coords', c);
      const last = c.hist.filter(h => h[1] === k).slice(-10).map(h => h[2]);
      const avg = Math.round(last.reduce((a, b) => a + b, 0) / last.length);
      app.innerHTML = `<section class="panel"><h2>${rec ? 'Nuovo record!' : 'Tempo scaduto'}</h2>
        <div class="cards"><div class="card"><div class="k">Punteggio</div><div class="v">${score}</div><div class="s">${errors} errori</div></div>
        <div class="card"><div class="k">Record</div><div class="v">${c.best[k] ?? 0}</div><div class="s">media ultime 10: ${avg}</div></div></div>
        <p class="muted small">Un buon traguardo è superare stabilmente 20 case in 30 secondi da entrambi i lati.</p>
        <div class="row"><button class="btn primary" id="again">Ancora</button><button class="btn" id="back">Indietro</button></div></section>`;
      if (daily) {
        const d = dailyState();
        d.coordRounds = (d.coordRounds || 0) + 1; localStorage.setItem('daily', JSON.stringify(d));
        const fin = d.coordRounds >= 2;
        if (fin) markPhase(6);
        $('.row').innerHTML = `<button class="btn primary" id="nx">${fin ? 'Continua la lezione del giorno ▶' : 'Secondo giro ▶'}</button>`;
        $('#nx').onclick = () => go(fin ? 'today' : 'coordsDaily');
        return;
      }
      $('#again').onclick = () => run(mode, side);
      $('#back').onclick = () => go('coords');
    }
  }

  // Sezione "Aspetto" per le impostazioni.
  views.look = () => {
    const s = settings();
    app.innerHTML = `
    <section class="panel"><h2>Aspetto</h2>
      <h3>Pezzi</h3>
      <div class="sets">${PIECE_SETS.map(([k, t]) => { setPieceSet(k); return `<button class="setb ${s.pieces === k || (!s.pieces && k === 'cburnett') ? 'on' : ''}" data-k="${k}"><span class="pv">${pieceHtml('w', 'n')}${pieceHtml('b', 'q')}</span><span>${esc(t)}</span></button>`; }).join('')}</div>
      <h3>Scacchiera</h3>
      <div class="sets">${BOARDS.map(([k, t, l, d]) => `<button class="setb ${(s.board || 'verde') === k ? 'on' : ''}" data-b="${k}"><span class="sw" style="${l ? `background:linear-gradient(135deg, ${l} 50%, ${d} 50%)` : `background-image:url(boards/${k}.jpg);background-size:200%`}"></span><span>${esc(t)}</span></button>`).join('')}</div>
      <h3>Anteprima</h3>
      <div id="board"></div>
      <div class="row"><button class="btn" id="back">↩ Impostazioni</button></div>
    </section>`;
    applyLook(s);
    const board = new Board($('#board'));
    board.set({ fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', last: { from: 'f8', to: 'f6' }, interactive: false });
    app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      saveSettings({ pieces: b.dataset.k }); applyLook(settings());
      app.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); board.render();
    });
    app.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
      saveSettings({ board: b.dataset.b }); applyLook(settings());
      app.querySelectorAll('[data-b]').forEach(x => x.classList.toggle('on', x === b)); board.render();
    });
    $('#back').onclick = () => go('settings');
  };

  // Scelta del tutor: busti animati, anteprima con voce, reazione all'errore e alla mossa giusta.
  views.tutors = () => {
    const cur = avatarId();
    app.innerHTML = `
    <section class="panel"><h2>Scegli il tuo tutor</h2>
      <div class="avgrid">${AVATARS.map(a => `<button class="avpick ${a.id === cur ? 'on' : ''}" data-id="${a.id}"><div class="avbg" style="background:linear-gradient(160deg, ${a.bg[0]}, ${a.bg[1]})">${avatarInner(a)}</div><b>${esc(a.name)}</b><small>${esc(a.role)}</small></button>`).join('')}</div>
      <h3>Anteprima</h3>
      <div class="tutor demo"><div class="tav" id="demoAv"></div><div class="tbody"><div class="tbubble"><p class="ttext" id="demoTxt"></p></div>
        <div class="row"><button class="btn small" id="dSay">🗣 Parla</button><button class="btn small" id="dBad">😬 Errore</button><button class="btn small" id="dGood">👍 Mossa giusta</button></div></div></div>
      <div class="row"><button class="btn" id="back">↩ Impostazioni</button></div>
    </section>`;
    const demo = app.querySelector('.demo');
    const paint = () => { const a = getAvatar(avatarId()); $('#demoAv').innerHTML = avatarHtml(a.id) + `<div class="tname">${esc(a.name)}</div>`; $('#demoTxt').textContent = `Ciao, sono ${a.name}. Ti rivedo le partite e ti spiego gli errori.`; };
    const mood = m => { demo.classList.remove('mood'); delete demo.dataset.mood; void demo.offsetWidth; demo.dataset.mood = m; demo.classList.add('mood'); setTimeout(() => demo.classList.remove('mood'), 2600); };
    const say = async t => { $('#demoTxt').textContent = t; demo.classList.add('talking'); try { await speak(t); } catch {} demo.classList.remove('talking'); };
    paint();
    app.querySelectorAll('.avpick').forEach(b => b.onclick = () => {
      saveSettings({ tutorAvatar: b.dataset.id });
      app.querySelectorAll('.avpick').forEach(x => x.classList.toggle('on', x === b));
      paint(); say($('#demoTxt').textContent);
    });
    $('#dSay').onclick = () => say($('#demoTxt').textContent);
    $('#dBad').onclick = () => { mood('bad'); say('Attenzione: questa mossa lascia il pezzo in presa.'); };
    $('#dGood').onclick = () => { mood('good'); say('Ottima mossa! Era proprio quella giusta.'); };
    $('#back').onclick = () => go('settings');
  };
}

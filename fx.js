// Effetti: suoni sintetizzati, coriandoli, vibrazione. Rispettano le preferenze dell'utente.
const pref = () => { try { return JSON.parse(localStorage.getItem('settings')) || {}; } catch { return {}; } };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let ctx = null;
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, t0, dur, type = 'sine', gain = 0.18) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, a.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + 0.02);
}
// Colpo di legno: breve rumore filtrato.
function knock(t0, freq, gain) {
  const a = ac(); if (!a) return;
  const len = Math.floor(a.sampleRate * 0.06);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2.5;
  const g = a.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + t0);
}
// Pezzo di legno appoggiato sulla scacchiera: clic secco più la risonanza del tavolo.
function wood(t0, pitch = 1, gain = 1) {
  const a = ac(); if (!a) return;
  const T = a.currentTime + t0, v = 0.94 + Math.random() * 0.12;
  const len = Math.floor(a.sampleRate * 0.03);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const n = a.createBufferSource(); n.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2300 * pitch * v; f.Q.value = 1.3;
  const gn = a.createGain(); gn.gain.value = 0.55 * gain;
  n.connect(f).connect(gn).connect(a.destination); n.start(T);
  const o = a.createOscillator(), go = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(170 * pitch * v, T); o.frequency.exponentialRampToValueAtTime(95 * pitch, T + 0.09);
  go.gain.setValueAtTime(0.0001, T); go.gain.exponentialRampToValueAtTime(0.5 * gain, T + 0.004); go.gain.exponentialRampToValueAtTime(0.0001, T + 0.11);
  o.connect(go).connect(a.destination); o.start(T); o.stop(T + 0.13);
  const r = a.createOscillator(), gr = a.createGain();
  r.type = 'triangle'; r.frequency.value = 520 * pitch * v;
  gr.gain.setValueAtTime(0.0001, T); gr.gain.exponentialRampToValueAtTime(0.12 * gain, T + 0.003); gr.gain.exponentialRampToValueAtTime(0.0001, T + 0.05);
  r.connect(gr).connect(a.destination); r.start(T); r.stop(T + 0.06);
}

// Materiali sintetizzati con modi di risonanza: pezzo che colpisce la scacchiera.
// thump = colpo sordo del corpo, modes = risonanze [frequenza, durata in s, volume], noise = clic iniziale.
const MAT = {
  torneo:   { thump: [105, 0.10, 0.60], modes: [[430, 0.06, 0.22], [1180, 0.035, 0.12], [2650, 0.016, 0.07]], noise: [2100, 1.2, 0.35, 0.004] },
  boxwood:  { thump: [150, 0.07, 0.45], modes: [[640, 0.045, 0.20], [1700, 0.025, 0.14], [3500, 0.012, 0.07]], noise: [2600, 1.3, 0.40, 0.003] },
  marmo:    { thump: [210, 0.05, 0.35], modes: [[1900, 0.14, 0.15], [3150, 0.10, 0.10], [4700, 0.07, 0.07], [6300, 0.045, 0.04]], noise: [5000, 1.0, 0.30, 0.002] },
  vetro:    { thump: [320, 0.03, 0.15], modes: [[2650, 0.38, 0.12], [4200, 0.26, 0.08], [6150, 0.18, 0.05]], noise: [6500, 1.5, 0.15, 0.0015] },
  plastica: { thump: [135, 0.06, 0.40], modes: [[920, 0.022, 0.14], [2350, 0.013, 0.10]], noise: [3200, 0.8, 0.60, 0.004] },
  feltro:   { thump: [92, 0.075, 0.70], modes: [[340, 0.03, 0.12], [780, 0.02, 0.05]], noise: [900, 0.7, 0.25, 0.006] },
  ebano:    { thump: [120, 0.09, 0.55], modes: [[520, 0.07, 0.22], [1350, 0.05, 0.13], [2900, 0.025, 0.08], [4300, 0.012, 0.04]], noise: [2400, 1.1, 0.30, 0.003] },
  digitale: { thump: [0, 0, 0], modes: [[1850, 0.028, 0.16], [3700, 0.014, 0.06]], noise: [0, 1, 0, 0] },
  bolla:    { sweep: true },
  campana:  { thump: [0, 0, 0], modes: [[880, 0.45, 0.12], [1760, 0.30, 0.05], [2640, 0.2, 0.03], [3960, 0.12, 0.02]], noise: [0, 1, 0, 0] },
};
function impact(t0, mat, pitch = 1, gain = 1) {
  const a = ac(); if (!a) return;
  const T = a.currentTime + t0, v = 0.97 + Math.random() * 0.06;
  const M = MAT[mat];
  if (M.sweep) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(950 * pitch * v, T); o.frequency.exponentialRampToValueAtTime(320 * pitch, T + 0.07);
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(0.3 * gain, T + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, T + 0.09);
    o.connect(g).connect(a.destination); o.start(T); o.stop(T + 0.1); return;
  }
  const [tf, td, tg] = M.thump;
  if (tg) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(tf * 1.6 * pitch * v, T); o.frequency.exponentialRampToValueAtTime(tf * pitch, T + td * 0.6);
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(tg * gain, T + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, T + td);
    o.connect(g).connect(a.destination); o.start(T); o.stop(T + td + 0.02);
  }
  for (const [f, d, gm] of M.modes) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.value = f * pitch * v * (0.99 + Math.random() * 0.02);
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(gm * gain, T + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, T + d);
    o.connect(g).connect(a.destination); o.start(T); o.stop(T + d + 0.02);
  }
  const [nf, nq, ng, nd] = M.noise;
  if (ng) {
    const len = Math.max(32, Math.floor(a.sampleRate * nd * 4));
    const buf = a.createBuffer(1, len, a.sampleRate); const dd = buf.getChannelData(0);
    for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * nd));
    const src = a.createBufferSource(); src.buffer = buf;
    const fl = a.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = nf * pitch; fl.Q.value = nq;
    const g = a.createGain(); g.gain.value = ng * gain;
    src.connect(fl).connect(g).connect(a.destination); src.start(T);
  }
}

// Set di suoni: sintetizzati (materiali) e registrati (Lichess AGPL / CC BY-NC-SA, PyChess GPL).
export const SOUND_SETS = [
  ['torneo', 'Torneo (legno pesante)'], ['ebano', 'Ebano'], ['boxwood', 'Bosso chiaro'], ['legno', 'Legno morbido'],
  ['legno-secco', 'Legno secco'], ['feltro', 'Feltro'], ['plastica', 'Plastica da club'], ['marmo', 'Marmo'],
  ['vetro', 'Vetro'], ['campana', 'Campanella'], ['bolla', 'Bolla'], ['digitale', 'Clic digitale'],
  ['pychess', 'PyChess'], ['piano', 'Pianoforte'], ['sfx', 'Effetti'], ['nes', 'Retrò 8 bit'], ['futuristic', 'Futuristico'], ['lisp', 'Lisp'],
];
const SYNTH = new Set(['torneo', 'ebano', 'boxwood', 'feltro', 'plastica', 'marmo', 'vetro', 'campana', 'bolla', 'digitale', 'legno', 'legno-secco']);
const FILE = { move: 'Move', capture: 'Capture', check: 'Check', good: 'Confirmation', bad: 'Error', win: 'Victory', lose: 'Defeat' };
const buffers = {};
async function loadBuf(set, name) {
  const key = set + '/' + name;
  if (!(key in buffers)) {
    buffers[key] = null;
    try {
      const a = ac(); const r = await fetch(`sounds/${set}/${name}.mp3`);
      buffers[key] = await a.decodeAudioData(await r.arrayBuffer());
    } catch { delete buffers[key]; }
  }
  return buffers[key];
}
export function preloadSounds() {
  const set = pref().soundSet || 'torneo';
  if (SYNTH.has(set)) return;
  Object.values(FILE).forEach(n => loadBuf(set, n));
}
function playFile(set, kind) {
  const name = FILE[kind] || 'Move';
  const b = buffers[set + '/' + name];
  if (!b) { loadBuf(set, name); return false; }
  const a = ac(); const src = a.createBufferSource(); src.buffer = b;
  const g = a.createGain(); g.gain.value = 0.9; src.connect(g).connect(a.destination); src.start();
  return true;
}

function synth(set, kind) {
  if (MAT[set]) {
    if (kind === 'move') return impact(0, set);
    if (kind === 'capture') { impact(0, set, 0.88, 1.1); impact(0.05, set, 1.12, 0.75); return; }
    if (kind === 'check') { impact(0, set, 1.05); tone(880, 0.03, 0.2, 'triangle', 0.07); return; }
  }
  const soft = set !== 'legno-secco';
  if (kind === 'move') soft ? wood(0) : knock(0, 1400, 0.9);
  else if (kind === 'capture') { if (soft) { wood(0, 0.85, 1.1); wood(0.045, 1.15, 0.7); } else { knock(0, 900, 1); knock(0.05, 1300, 0.7); } }
  else if (kind === 'check') { soft ? wood(0, 1.05) : knock(0, 1400, 0.8); tone(880, 0.02, 0.18, 'triangle', 0.08); }
  else if (kind === 'good') { tone(660, 0, 0.14, 'triangle'); tone(990, 0.09, 0.22, 'triangle'); }
  else if (kind === 'bad') { tone(220, 0, 0.22, 'sawtooth', 0.06); }
  else if (kind === 'win') { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.12)); }
  else if (kind === 'lose') { [392, 330, 262].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.1)); }
}

export function sound(kind, setOverride) {
  if (pref().sound === false) return;
  try {
    if (kind === 'tick') return tone(1200, 0, 0.04, 'square', 0.03);
    const set = setOverride || pref().soundSet || 'torneo';
    if (SYNTH.has(set) || !playFile(set, kind)) synth(SYNTH.has(set) ? set : 'torneo', kind);
  } catch { /* audio non disponibile */ }
}

export function buzz(ms = 40) {
  if (pref().haptics === false) return;
  try { navigator.vibrate && navigator.vibrate(ms); } catch { /* */ }
}

export function confetti(intensity = 1) {
  if (reduced()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.append(c);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr;
  const g = c.getContext('2d');
  const colors = ['#f0c060', '#e8efe9', '#4caf7d', '#d9a63c', '#9fd4b5'];
  const N = Math.round(140 * intensity);
  const P = Array.from({ length: N }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.42,
    vx: (Math.random() - 0.5) * 16 * dpr, vy: (-Math.random() * 15 - 6) * dpr,
    w: (5 + Math.random() * 6) * dpr, h: (3 + Math.random() * 4) * dpr,
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, col: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  const step = t => {
    const k = (t - t0) / 1800;
    g.clearRect(0, 0, W, H);
    for (const p of P) {
      p.vy += 0.45 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      g.save(); g.globalAlpha = Math.max(0, 1 - k * k); g.translate(p.x, p.y); g.rotate(p.r);
      g.fillStyle = p.col; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
    }
    if (k < 1) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}

// Numero che scorre fino al valore finale.
export function countUp(el, to, ms = 900) {
  if (!el) return;
  const from = +el.dataset.from || 0;
  if (reduced()) { el.textContent = to; return; }
  const t0 = performance.now();
  const f = t => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}

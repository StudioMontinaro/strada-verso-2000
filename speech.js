// Sintesi vocale in italiano: lettura delle caselle e voce del tutor.
const pref = () => { try { return JSON.parse(localStorage.getItem('settings')) || {}; } catch { return {}; } };
const synth = window.speechSynthesis;
let voice = null;
// Voci italiane disponibili sul dispositivo (quelle "online" o "avanzate" sono le più naturali).
export function italianVoices() {
  if (!synth) return [];
  return synth.getVoices().filter(v => /^it/i.test(v.lang)).sort((a, b) => score(b) - score(a));
}
function score(v) { return (/natural|neural|enhanced|premium|online|network/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (!v.localService ? 1 : 0); }
function pickVoice() {
  if (!synth) return null;
  const vs = italianVoices();
  const want = pref().voiceName;
  voice = (want && vs.find(v => v.name === want)) || vs[0] || null;
  return voice;
}
if (synth) { pickVoice(); synth.addEventListener ? synth.addEventListener('voiceschanged', pickVoice) : (synth.onvoiceschanged = pickVoice); }
export const voiceRate = () => +(pref().voiceRate || 1.3);
export const canSpeak = () => !!synth;

const FILE_NAME = { a: 'a', b: 'bi', c: 'ci', d: 'di', e: 'e', f: 'effe', g: 'gi', h: 'acca' };
const NUM = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto'];
export const PIECE_IT = { p: 'pedone', n: 'cavallo', b: 'alfiere', r: 'torre', q: 'donna', k: 're' };
const SAN_PIECE = { K: 're', Q: 'donna', R: 'torre', B: 'alfiere', N: 'cavallo' };

export function spokenSquare(sq) { return `${FILE_NAME[sq[0]]} ${NUM[+sq[1]]}`; }

// Mossa in parole: "cavallo effe tre", "alfiere prende in bi cinque, scacco".
export function spokenMove(m) {
  if (!m) return '';
  let t;
  if (m.san.startsWith('O-O-O')) t = 'arrocco lungo';
  else if (m.san.startsWith('O-O')) t = 'arrocco corto';
  else {
    const piece = PIECE_IT[m.piece];
    t = m.captured ? `${piece} prende in ${spokenSquare(m.to)}` : `${piece} ${spokenSquare(m.to)}`;
    if (m.promotion) t += `, promuove a ${PIECE_IT[m.promotion]}`;
  }
  if (m.san.includes('#')) t += ', scacco matto';
  else if (m.san.includes('+')) t += ', scacco';
  return t;
}

// Trasforma la notazione italiana scritta (Cf3, Axb5+, e8=D) in parole pronunciabili.
const IT_PIECE = { R: 're', D: 'donna', T: 'torre', A: 'alfiere', C: 'cavallo' };
export function speakable(text) {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/\?\?|\?!|!\?/g, '')
    .replace(/\b(\d+)\s*\.\.\.\s*/g, '')
    .replace(/\b(\d+)\.\s*/g, '')
    .replace(/(?<![A-Za-z])([RDTAC])?([a-h1-8])?(x)?([a-h][1-8])(=([DTAC]))?([+#])?(?![A-Za-z0-9])/g, (all, p, dis, x, sq, _pr, prom, ck) => {
      let t = (p ? IT_PIECE[p] + ' ' : '') + (x ? 'prende in ' : '') + spokenSquare(sq);
      if (prom) t += ', promuove a ' + IT_PIECE[prom];
      if (ck === '#') t += ', scacco matto'; else if (ck === '+') t += ', scacco';
      return t;
    })
    .replace(/O-O-O/g, 'arrocco lungo').replace(/O-O/g, 'arrocco corto');
}

let cur = null;
export function stopSpeech() { if (synth) synth.cancel(); cur = null; }

// Pronuncia un testo; la promessa si risolve a fine lettura (o subito se la voce è spenta).
export function speak(text, { force = false, rate = 1, interrupt = true, voiceName = null, rateOverride = null } = {}) {
  return new Promise(res => {
    if (!synth || !text || (!force && pref().voice === false)) return res();
    if (interrupt) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    pickVoice();
    const v = voiceName ? italianVoices().find(x => x.name === voiceName) : voice;
    u.lang = 'it-IT'; if (v) u.voice = v;
    u.rate = Math.min(3, (rateOverride || voiceRate()) * rate); u.pitch = 1;
    let done = false;
    const end = () => { if (!done) { done = true; res(); } };
    u.onend = end; u.onerror = end;
    // Alcuni Android non chiamano onend: rete di sicurezza in base alla lunghezza.
    setTimeout(end, 1500 + text.length * 85 / Math.max(0.6, voiceRate()));
    cur = u;
    synth.speak(u);
  });
}

// Lettura della casella a ogni mossa (allenamento alla visione della scacchiera).
export function announceMove(m) {
  if (!synth || !m || !pref().speakMoves) return;
  speak(spokenMove(m), { force: true, rate: 1.1 });
}

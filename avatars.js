// Tutor illustrati (stile 3D, creati con Canva). Ogni tutor ha le immagini nella cartella avatars/:
// <id>-neutral.png (obbligatoria), <id>-talk.png (bocca aperta), <id>-bad.png (errore), <id>-good.png (mossa giusta).
// Se un'immagine manca, il tutor usa quella neutra con animazioni e effetti; per migliorare un tutor basta sostituire i file con la stessa denominazione.
const SETTINGS = () => { try { return JSON.parse(localStorage.getItem('settings') || '{}'); } catch { return {}; } };
export const AVATARS = [
  { id: 'arturo', name: 'Professor Arturo', role: 'Il professore di una volta', bg: ['#cfe3d1', '#9cc3a2'], hand: '#f1c7a1', frames: ['neutral', 'talk', 'bad', 'good'] },
  { id: 'livia', name: 'Professoressa Livia', role: 'Rigorosa e paziente', bg: ['#f4cfd8', '#e49aae'], hand: '#f3cfae', frames: ['neutral'] },
  { id: 'marco', name: 'Coach Marco', role: "L'allenatore giovane", bg: ['#c7dcf5', '#90b6e6'], hand: '#e8b88e', frames: ['neutral'] },
  { id: 'giulia', name: 'Maestra Giulia', role: 'La maestra solare', bg: ['#f8e8cd', '#efcd93'], hand: '#f3cfae', frames: ['neutral'] },
  { id: 'zork', name: 'Zork', role: 'Alieno venuto a studiare gli scacchi', bg: ['#4b2c86', '#2d1a5c'], hand: '#7ed36a', frames: ['neutral'] },
];
export function avatarId() { const id = SETTINGS().tutorAvatar; return AVATARS.some(a => a.id === id) ? id : AVATARS[0].id; }
export function getAvatar(id) { return AVATARS.find(a => a.id === id) || AVATARS[0]; }
// Immagini sovrapposte: la neutra sempre visibile, le altre compaiono con CSS (parla / errore / mossa giusta).
export function avatarInner(a) {
  const img = f => `<img class="fr fr-${f}" src="avatars/${a.id}-${f}.png" alt="" draggable="false">`;
  return `<div class="frs">${a.frames.map(img).join('')}</div>`;
}
export const FX_HTML = `
  <div class="fx fx-bad" aria-hidden="true">
    <svg class="sweat" viewBox="0 0 20 28"><path d="M10 2 Q3 13 3 18 A7 7 0 0 0 17 18 Q17 13 10 2Z" fill="#6ec6ff" stroke="#2a8fd6" stroke-width="1.4"/><path d="M7 17 Q7 21 10 21.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>
    <span class="qm">?!</span>
    <svg class="dizzy" viewBox="0 0 60 20"><g fill="#ffd54a" stroke="#d99a00" stroke-width="1"><path d="M10 2 l2 5 5 .5 -4 3.5 1.3 5 -4.3 -2.8 -4.3 2.8 1.3 -5 -4 -3.5 5 -.5z"/><path d="M30 2 l2 5 5 .5 -4 3.5 1.3 5 -4.3 -2.8 -4.3 2.8 1.3 -5 -4 -3.5 5 -.5z"/><path d="M50 2 l2 5 5 .5 -4 3.5 1.3 5 -4.3 -2.8 -4.3 2.8 1.3 -5 -4 -3.5 5 -.5z"/></g></svg>
  </div>
  <div class="fx fx-good" aria-hidden="true">
    <svg class="thumb" viewBox="0 0 44 44"><path d="M3 20 h9 v20 h-9z" fill="#3b7bd6" stroke="#25589e" stroke-width="1.4" stroke-linejoin="round"/><path d="M13 21 L19 8 Q21 4 25 6 Q28 8 27 12 L25 18 H37 Q41 18 41 22 Q41 24 39.5 25 Q41 27 39.5 29.5 Q41 31.5 39 34 Q39 37.5 35 38 H17 Q13 38 13 35Z" style="fill:var(--hand,#ffd9a8)" stroke="#8a5a2b" stroke-opacity=".55" stroke-width="1.4" stroke-linejoin="round"/></svg>
    <svg class="spark s1" viewBox="0 0 20 20"><path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8Z" fill="#ffe27a"/></svg>
    <svg class="spark s2" viewBox="0 0 20 20"><path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8Z" fill="#fff"/></svg>
    <svg class="spark s3" viewBox="0 0 20 20"><path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8Z" fill="#ffe27a"/></svg>
  </div>`;
export function avatarHtml(id) {
  const a = getAvatar(id);
  return `<div class="tavw${a.frames.includes('good') ? ' hasgood' : ''}" style="--hand:${a.hand}"><div class="avbg" style="background:linear-gradient(160deg, ${a.bg[0]}, ${a.bg[1]})">${avatarInner(a)}</div>${FX_HTML}</div>`;
}

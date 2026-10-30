// Percorso senza scadenza: si avanza di livello quando il rating Lichess blitz supera il traguardo.
export const GOAL = 2000;
export const START = 1450;
export const STAGES = [
  { n: 1, from: 1450, to: 1600, title: 'Basi solide', focus: 'Niente pezzi regalati, tattica elementare, finali di base, repertorio minimo.' },
  { n: 2, from: 1600, to: 1750, title: 'Tattica e calcolo', focus: 'Combinazioni di 2-3 mosse, finali di torre, piani nel mediogioco.' },
  { n: 3, from: 1750, to: 1900, title: 'Strategia', focus: 'Strutture pedonali, pezzi buoni e cattivi, profilassi, gestione del tempo.' },
  { n: 4, from: 1900, to: 2000, title: 'Rifinitura', focus: 'Repertorio più profondo, finali complessi, correzione dei difetti ricorrenti.' },
];

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export function rating() { return load('lichess', { r: START, hist: [] }); }
export function setRating(r) {
  const R = rating();
  const prevStage = stageOf(R.r).n;
  R.r = r; R.hist.push([Date.now(), r]);
  save('lichess', R);
  return { promoted: stageOf(r).n > prevStage, stage: stageOf(r) };
}
export function stageOf(r) { return STAGES.find(s => r < s.to) || STAGES[STAGES.length - 1]; }
export function progressPct(r) { return Math.max(0, Math.min(100, (r - START) / (GOAL - START) * 100)); }

// Giorni consecutivi con almeno un'attività.
const day = d => new Date(d).toDateString();
export function markActive() {
  const a = load('activity', []);
  const t = day(Date.now());
  if (a[a.length - 1] !== t) { a.push(t); if (a.length > 800) a.shift(); save('activity', a); }
}
export function streak() {
  const a = new Set(load('activity', []));
  let n = 0, d = new Date();
  if (!a.has(d.toDateString())) d.setDate(d.getDate() - 1); // la serie resta viva fino a fine giornata
  while (a.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

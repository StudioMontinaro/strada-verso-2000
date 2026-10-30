// Riconoscimento delle aperture (database aperture di Lichess, CC0) e nomi in italiano.
import { Chess } from './chess.js';

let DB = null, BY = null;
export async function loadOpenings() {
  if (!DB) {
    DB = await (await fetch('openings.json')).json();
    BY = new Map(DB.map(r => [r[2], r]));
  }
  return DB;
}

const FAMILY = {
  "Sicilian Defense": 'Difesa Siciliana', 'Ruy Lopez': 'Partita Spagnola', "Queen's Gambit Declined": 'Gambetto di Donna Rifiutato',
  'French Defense': 'Difesa Francese', 'Italian Game': 'Partita Italiana', 'English Opening': 'Apertura Inglese',
  "King's Gambit Accepted": 'Gambetto di Re accettato', "King's Gambit Declined": 'Gambetto di Re rifiutato', "King's Gambit": 'Gambetto di Re',
  "King's Indian Defense": 'Difesa Est-Indiana', 'Caro-Kann Defense': 'Difesa Caro-Kann', 'Nimzo-Indian Defense': 'Difesa Nimzo-Indiana',
  "Queen's Pawn Game": 'Partita di Donna', 'Semi-Slav Defense': 'Difesa Semi-Slava', 'Dutch Defense': 'Difesa Olandese',
  'Benoni Defense': 'Difesa Benoni', "Queen's Gambit Accepted": 'Gambetto di Donna accettato', 'Grünfeld Defense': 'Difesa Grünfeld',
  "Queen's Indian Defense": 'Difesa Ovest-Indiana', 'Alekhine Defense': 'Difesa Alekhine', 'Scotch Game': 'Partita Scozzese',
  'Indian Defense': 'Difesa Indiana', 'Slav Defense': 'Difesa Slava', "Petrov's Defense": 'Difesa Russa (Petrov)',
  'Four Knights Game': 'Partita dei Quattro cavalli', 'Zukertort Opening': 'Apertura Zukertort', 'Scandinavian Defense': 'Difesa Scandinava',
  'Philidor Defense': 'Difesa Philidor', 'Réti Opening': 'Apertura Réti', 'Nimzowitsch Defense': 'Difesa Nimzowitsch',
  'Vienna Game': 'Partita Viennese', "Bishop's Opening": "Apertura d'alfiere", 'Modern Defense': 'Difesa Moderna',
  "King's Pawn Game": 'Partita di Re', 'Catalan Opening': 'Apertura Catalana', 'Pirc Defense': 'Difesa Pirc', 'Bird Opening': 'Apertura Bird',
  'Tarrasch Defense': 'Difesa Tarrasch', 'Polish Opening': 'Apertura Polacca', 'Bogo-Indian Defense': 'Difesa Bogo-Indiana',
  "King's Indian Attack": 'Attacco Est-Indiano', 'Hungarian Opening': 'Apertura Ungherese', 'Center Game': 'Partita del Centro',
  'Ponziani Opening': 'Apertura Ponziani', 'Old Indian Defense': 'Difesa Vecchia Indiana', 'Trompowsky Attack': 'Attacco Trompowsky',
  'Benko Gambit': 'Gambetto Benko', 'Owen Defense': 'Difesa Owen', 'Torre Attack': 'Attacco Torre', 'Three Knights Opening': 'Apertura dei Tre cavalli',
  'Latvian Gambit': 'Gambetto Lettone', 'Englund Gambit': 'Gambetto Englund', 'Blackmar-Diemer Gambit': 'Gambetto Blackmar-Diemer',
  'Elephant Gambit': "Gambetto dell'Elefante", 'Rat Defense': 'Difesa Rat', 'English Defense': 'Difesa Inglese',
};
const WORDS = [[/\bVariations\b/g, 'varianti'], [/\bVariation\b/g, 'variante'], [/\bEnglish\b/g, 'inglese'], [/\bSpanish\b/g, 'spagnola'], [/\bScotch\b/g, 'scozzese'], [/\bFrench\b/g, 'francese'], [/\bRussian\b/g, 'russa'], [/\bQueen's\b/g, 'di donna'], [/\bKing's\b/g, 'di re'], [/\bAdvance\b/g, 'di spinta'], [/\bItalian\b/g, 'italiana'],
  [/\bKing's Knight\b/g, 'del cavallo di re'], [/\bBishop's\b/g, "d'alfiere"], [/\bKnight\b/g, 'di cavallo'], [/\bAccelerated\b/g, 'accelerata'], [/\bAttack\b/g, 'attacco'], [/\bGambit\b/g, 'gambetto'], [/\bDefense\b/g, 'difesa'],
  [/\bAccepted\b/g, 'accettato'], [/\bDeclined\b/g, 'rifiutato'], [/\bMain Line\b/g, 'linea principale'], [/\bSystem\b/g, 'sistema'],
  [/\bOpening\b/g, 'apertura'], [/\bExchange\b/g, 'di cambio'], [/\bAdvance\b/g, 'di spinta'], [/\bClassical\b/g, 'classica'],
  [/\bClosed\b/g, 'chiusa'], [/\bOpen\b/g, 'aperta'], [/\bModern\b/g, 'moderna'], [/\bNormal\b/g, 'normale'], [/\bLine\b/g, 'linea'],
  [/\bTwo Knights\b/g, 'dei due cavalli'], [/\bFour Knights\b/g, 'dei quattro cavalli'], [/\bwith\b/g, 'con'], [/\bSymmetrical\b/g, 'simmetrica']];
// "variante X" invece di "X variante": l'aggettivo segue in italiano.
function itPart(p) {
  let s = p.trim();
  const m = s.match(/^(.*) (Variations|Variation|Attack|Gambit|Defense|System|Line|Opening|Game)$/);
  if (m && !/^(Main)$/.test(m[1])) {
    const head = { Variations: 'varianti', Variation: 'variante', Attack: 'attacco', Gambit: 'gambetto', Defense: 'difesa', System: 'sistema', Line: 'linea', Opening: 'apertura', Game: 'partita' }[m[2]];
    s = `${head} ${m[1]}`;
  }
  for (const [re, w] of WORDS) s = s.replace(re, w);
  return s;
}
// Traduzioni curate delle parti dei nomi (famiglie e varianti) usate nel repertorio: la traduzione automatica
// parola per parola le storpiava (per esempio "difesa Hungarian" o "sistema accelerata London").
const PART_IT = {
  "King's Pawn Game": 'Apertura di pedone di re', "Queen's Pawn Game": 'Apertura di pedone di donna', "King's Knight Opening": 'Apertura del cavallo di re',
  'Ruy Lopez': 'Partita Spagnola', 'Scotch Game': 'Partita Scozzese', 'Vienna Game': 'Partita Viennese', 'Four Knights Game': 'Partita dei quattro cavalli',
  'Three Knights Opening': 'Apertura dei tre cavalli', "Petrov's Defense": 'Difesa Petrov', 'English Opening': 'Apertura Inglese', 'Réti Opening': 'Apertura Réti',
  'Zukertort Opening': 'Apertura Zukertort', "King's Indian Attack": 'Attacco Est-Indiano', 'Modern Defense': 'Difesa Moderna',
  'Normal Variation': 'variante normale', 'Normal': 'linea normale', 'Main Line': 'linea principale', 'Classical Variation': 'variante classica',
  'Center Attack': 'attacco centrale', 'Giuoco Piano': 'Giuoco Piano', 'Giuoco Pianissimo': 'Giuoco Pianissimo', 'Greco Gambit': 'gambetto Greco',
  'Modern Line': 'linea moderna', 'Evans Gambit': 'gambetto Evans', 'Evans Gambit Accepted': 'gambetto Evans accettato', 'Bronstein Defense': 'difesa Bronstein',
  'Hungarian Defense': 'difesa ungherese', 'Two Knights Defense': 'difesa dei due cavalli', "Modern Bishop's Opening": "apertura d'alfiere moderna",
  'Blackburne-Kostić Gambit': 'gambetto Blackburne-Kostić', 'Alapin Variation': 'variante Alapin', 'Barmen Defense': 'difesa Barmen',
  'Smith-Morra Declined': 'gambetto Smith-Morra rifiutato', 'Morphy Defense': 'difesa Morphy', 'Closed': 'variante chiusa', 'Exchange Variation': 'variante di cambio',
  'Gligoric Variation': 'variante Gligoric', 'Anderssen Variation': 'variante Anderssen', 'Advance Variation': 'variante di spinta', 'Paulsen Attack': 'attacco Paulsen',
  'Euwe Variation': 'variante Euwe', 'Wade Variation': 'variante Wade', "Queen's Knight Variation": 'variante del cavallo di donna', 'Normal Defense': 'difesa normale',
  'Modern Variation': 'variante moderna', 'Short Variation': 'variante Short', 'Botvinnik-Carls Defense': 'difesa Botvinnik-Carls',
  'Accelerated London System': 'sistema Londra accelerato', 'London System': 'sistema Londra', 'Colle System': 'sistema Colle', 'Zukertort Variation': 'variante Zukertort',
  'Symmetrical Variation': 'variante simmetrica', 'Mieses-Kotroc Variation': 'variante Mieses-Kotroc', 'Mieses Variation': 'variante Mieses', 'Marshall Variation': 'variante Marshall',
  'Richter Variation': 'variante Richter', 'Classical Attack': 'attacco classico', 'Schmidt Variation': 'variante Schmidt', 'Spanish Variation': 'variante spagnola',
  'Double Spanish': 'doppia spagnola', 'Falkbeer Variation': 'variante Falkbeer', 'Vienna Gambit': 'gambetto viennese', 'Breyer Variation': 'variante Breyer',
  'Quiet System': 'sistema tranquillo', 'Standard Line': 'linea standard', 'Standard Defense': 'difesa standard', 'Two Knights Variation': 'variante dei due cavalli',
  "King's English Variation": 'variante inglese del re (1...e5)', 'Reversed Sicilian': 'Siciliana rovesciata', 'Four Knights Variation': 'variante dei quattro cavalli',
  'Fianchetto Line': 'linea del fianchetto', 'with Nb6': 'con Cb6', 'Alburt Variation': 'variante Alburt',
};
export function italianName(name) {
  const [fam, rest] = name.split(/:(.*)/s);
  let f = PART_IT[fam] || FAMILY[fam] || Object.entries(FAMILY).find(([k]) => fam.startsWith(k))?.[1] || itPart(fam);
  f = f.charAt(0).toUpperCase() + f.slice(1);
  if (!rest) return f;
  return f + ': ' + rest.split(',').map(x => PART_IT[x.trim()] || itPart(x)).join(', ');
}
// Tutte le voci del database lungo una sequenza di mosse: [{ ply, eco, name, nameIt }].
export function namesAlong(sanMoves) {
  if (!BY) return [];
  const out = [];
  for (let i = 1; i <= sanMoves.length; i++) {
    const r = BY.get(sanMoves.slice(0, i).join(' '));
    if (r) out.push({ ply: i, eco: r[0], name: r[1], nameIt: italianName(r[1]) });
  }
  return out;
}

// Riconosce l'apertura di una partita: la voce più lunga del database che coincide con le mosse giocate.
export function identify(sanMoves) {
  if (!BY) return null;
  let best = null;
  for (let i = 1; i <= Math.min(sanMoves.length, 30); i++) {
    const r = BY.get(sanMoves.slice(0, i).join(' '));
    if (r) best = { eco: r[0], name: r[1], nameIt: italianName(r[1]), ply: i };
  }
  return best;
}

// Varianti del database che proseguono una sequenza di mosse (per lezioni su misura).
export function variations(sanMoves, maxExtra = 6, limit = 6) {
  if (!DB) return [];
  const pref = sanMoves.join(' ');
  const out = [];
  const seenNext = new Set();
  const cands = DB.filter(r => r[2].startsWith(pref + ' ') && r[2].split(' ').length - sanMoves.length <= maxExtra)
    .sort((a, b) => a[2].length - b[2].length);
  for (const r of cands) {
    const mv = r[2].split(' ');
    const next = mv[sanMoves.length];
    if (seenNext.has(next + '|' + mv.length)) continue;
    seenNext.add(next + '|' + mv.length);
    out.push({ eco: r[0], name: r[1], nameIt: italianName(r[1]), moves: mv });
    if (out.length >= limit) break;
  }
  return out;
}

export function sanFromStart(sans) { const c = new Chess(); for (const s of sans) c.move(s); return c; }

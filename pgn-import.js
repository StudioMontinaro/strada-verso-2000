// Importazione di partite in formato PGN (per esempio esportate da Lichess).
// Nessun collegamento a Lichess: si incolla il testo o si sceglie un file .pgn.
import { Chess } from './chess.js';

// Divide un testo PGN in partite: intestazioni [Chiave "valore"] + testo delle mosse.
export function splitGames(text) {
  text = String(text || '').replace(/^﻿/, '').replace(/\r/g, '');
  const out = [];
  let cur = null, inMoves = false;
  for (const line of text.split('\n')) {
    const t = line.trim();
    const h = t.match(/^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]$/);
    if (h) {
      if (!cur || inMoves) { cur = { headers: {}, movetext: '' }; out.push(cur); inMoves = false; }
      cur.headers[h[1]] = h[2].replace(/\\(.)/g, '$1');
      continue;
    }
    if (!t) continue;
    if (!cur) { cur = { headers: {}, movetext: '' }; out.push(cur); }
    cur.movetext += t + '\n';
    inMoves = true;
  }
  return out.filter(g => g.movetext.trim());
}

// Estrae le mosse della linea principale (senza varianti, commenti, simboli) e i tempi [%clk].
export function parseMovetext(s) {
  const sans = [], clocks = [];
  let i = 0, depth = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '{') {
      const j = s.indexOf('}', i);
      const body = s.slice(i + 1, j < 0 ? s.length : j);
      if (depth === 0 && sans.length) {
        const m = body.match(/\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/);
        if (m) clocks[sans.length - 1] = Math.round(((+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])) * 1000);
      }
      i = j < 0 ? s.length : j + 1; continue;
    }
    if (ch === ';') { const j = s.indexOf('\n', i); i = j < 0 ? s.length : j + 1; continue; }
    if (ch === '(') { depth++; i++; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); i++; continue; }
    if (/\s/.test(ch)) { i++; continue; }
    let j = i;
    while (j < s.length && !/[\s{}();]/.test(s[j])) j++;
    const tok = s.slice(i, j); i = j;
    if (depth > 0) continue;
    if (/^(1-0|0-1|1\/2-1\/2|½-½|\*)$/.test(tok) || /^\$\d+$/.test(tok)) continue;
    let t = tok.replace(/^\d+\.+/, '');
    if (!t || /^\d+$/.test(t)) continue;
    t = t.replace(/[!?]+$/, '').replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O');
    if (t) sans.push(t);
  }
  return { sans, clocks };
}

// "180+2" -> "3+2"; "30+0" -> "½+0"
export function tcLabel(tc) {
  const m = String(tc || '').match(/^(\d+)\+(\d+)$/);
  if (!m) return tc === '-' ? 'senza orologio' : (tc || '?');
  const mins = +m[1] / 60;
  const mm = Number.isInteger(mins) ? String(mins) : mins === 0.5 ? '½' : mins === 0.25 ? '¼' : mins.toFixed(1).replace('.', ',');
  return `${mm}+${m[2]}`;
}

function dateOf(h) {
  const d = (h.UTCDate || h.Date || '').replace(/\./g, '-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = /^\d{2}:\d{2}:\d{2}$/.test(h.UTCTime || '') ? h.UTCTime : '12:00:00';
  return new Date(`${d}T${t}${h.UTCDate ? 'Z' : ''}`).toISOString();
}

function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }

// Converte una partita PGN nel formato delle partite dell'app.
// color: 'w' | 'b' | null (se null si prova a riconoscerlo dal nome utente).
export function toGame(pg, { username = '', color = null } = {}) {
  const h = pg.headers;
  if (h.Variant && !/^(standard|from position)?$/i.test(h.Variant)) throw new Error(`variante «${h.Variant}» non supportata: solo scacchi classici`);
  if (h.FEN || h.SetUp === '1') throw new Error('la partita non parte dalla posizione iniziale');
  const { sans, clocks } = parseMovetext(pg.movetext);
  const c = new Chess();
  for (let k = 0; k < sans.length; k++) {
    try { c.move(sans[k]); }
    catch { throw new Error(`mossa non valida alla ${Math.floor(k / 2) + 1}${k % 2 ? '…' : '.'} ${sans[k]}`); }
  }
  const moves = c.history();
  if (moves.length < 2) throw new Error('la partita è troppo corta');
  const u = username.trim().toLowerCase();
  let me = color;
  if (!me && u) { if ((h.White || '').toLowerCase() === u) me = 'w'; else if ((h.Black || '').toLowerCase() === u) me = 'b'; }
  if (!me) { const e = new Error('COLORE'); e.code = 'COLORE'; e.headers = h; throw e; }
  const res = (h.Result || '*').replace('1/2-1/2', '½-½');
  const outcome = res === '½-½' ? 'd' : res === '1-0' ? (me === 'w' ? 'w' : 'l') : res === '0-1' ? (me === 'b' ? 'w' : 'l') : 'd';
  const term = (h.Termination || '').toLowerCase();
  let why;
  if (c.isCheckmate()) why = 'Scacco matto';
  else if (c.isStalemate()) why = 'Stallo';
  else if (term.includes('time')) why = outcome === 'w' ? "Tempo scaduto all'avversario" : outcome === 'l' ? 'Tempo scaduto' : 'Patta (tempo)';
  else if (term.includes('abandon')) why = 'Partita abbandonata';
  else if (res === '½-½') why = c.isThreefoldRepetition() ? 'Triplice ripetizione' : c.isInsufficientMaterial() ? 'Materiale insufficiente' : 'Patta';
  else if (res === '*') why = 'Partita non conclusa';
  else why = outcome === 'w' ? "L'avversario ha abbandonato" : 'Hai abbandonato';
  const opp = me === 'w' ? h.Black : h.White;
  const oppElo = +(me === 'w' ? h.BlackElo : h.WhiteElo) || null;
  const site = /^https?:\/\//.test(h.Site || '') ? h.Site : null;
  const lid = site && site.match(/lichess\.org\/(\w{8})/)?.[1];
  const hasClk = clocks.filter(x => x !== undefined).length >= Math.min(4, moves.length);
  return {
    id: lid ? 'li-' + lid : 'pgn-' + hash(moves.join(' ') + (h.UTCDate || h.Date || '') + (h.UTCTime || '') + (h.White || '')),
    date: dateOf(h) || new Date().toISOString(),
    color: me, elo: oppElo, tc: tcLabel(h.TimeControl), result: res, why, outcome, moves,
    times: hasClk ? moves.map((_, k) => clocks[k] ?? null) : undefined,
    source: site && site.includes('lichess') ? 'lichess' : 'pgn', opp: opp || 'Avversario', oppElo,
    myElo: +(me === 'w' ? h.WhiteElo : h.BlackElo) || null, white: h.White || '', black: h.Black || '', site,
  };
}

export function oppLabel(g) {
  if (g.source) return `${g.opp || 'Avversario'}${g.oppElo ? ' (' + g.oppElo + ')' : ''}`;
  return `Stockfish ${g.elo}`;
}

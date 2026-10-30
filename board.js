// Scacchiera con mossa a tocco (tocca il pezzo, poi la casa di arrivo), con pezzi animati.
import { sound } from './fx.js';
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const FILES = 'abcdefgh';
let PIECE_SET = 'cburnett';
export function setPieceSet(s) { PIECE_SET = s; }
export function pieceHtml(color, type) {
  if (PIECE_SET === 'simboli') return `<span class="pc ${color}">${GLYPH[type]}\uFE0E</span>`;
  return `<img class="pi" alt="" draggable="false" src="pieces/${PIECE_SET}/${color}${type.toUpperCase()}.svg">`;
}

export function parsePlacement(fen) {
  const map = {};
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += +ch; continue; }
      map[FILES[f] + (8 - r)] = { type: ch.toLowerCase(), color: ch === ch.toLowerCase() ? 'b' : 'w' };
      f++;
    }
  });
  return map;
}

export class Board {
  constructor(el) {
    this.el = el;
    this.orient = 'w';
    this.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    this.sel = null;
    this.dests = [];
    this.last = null;
    this.check = null;
    this.arrows = [];
    this.interactive = false;
    this.onMove = null;   // ({from,to,promotion})
    this.legal = null;    // sq => [{to, promotion?}]
    el.classList.add('board');
    el.innerHTML = '';
    this.grid = document.createElement('div');
    this.grid.className = 'grid';
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', '0 0 8 8');
    this.svg.classList.add('arrows');
    el.append(this.grid, this.svg);
    this.cells = [];
    for (let i = 0; i < 64; i++) {
      const d = document.createElement('div');
      d.className = 'sq';
      this.grid.append(d);
      this.cells.push(d);
    }
    this.grid.addEventListener('pointerdown', e => {
      const c = e.target.closest('.sq');
      if (c) { e.preventDefault(); this.tap(c.dataset.sq); }
    });
  }
  sqAt(i) {
    const row = i >> 3, col = i & 7;
    const f = this.orient === 'w' ? col : 7 - col;
    const r = this.orient === 'w' ? 7 - row : row;
    return FILES[f] + (r + 1);
  }
  xy(sq) {
    const f = FILES.indexOf(sq[0]), r = +sq[1] - 1;
    return this.orient === 'w' ? [f + 0.5, 7 - r + 0.5] : [7 - f + 0.5, r + 0.5];
  }
  set(opts) { Object.assign(this, opts); this.render(); }
  render() {
    const pos = parsePlacement(this.fen);
    const prev = this.prevPos;
    const key = p => p ? p.color + p.type : '';
    // Pezzi arrivati e case lasciate libere rispetto al disegno precedente: servono per animare.
    let moves = [];
    if (prev && this.animate !== false) {
      const arrived = [], vacated = [];
      for (const f of FILES) for (let r = 1; r <= 8; r++) {
        const sq = f + r;
        if (pos[sq] && key(pos[sq]) !== key(prev[sq])) arrived.push(sq);
        if (prev[sq] && key(pos[sq]) !== key(prev[sq])) vacated.push(sq);
      }
      if (arrived.length && arrived.length <= 4) {
        const free = [...vacated];
        for (const a of arrived) {
          let best = -1, bd = 99;
          free.forEach((v, k) => {
            if (key(prev[v]) !== key(pos[a])) return;
            const d = Math.abs(v.charCodeAt(0) - a.charCodeAt(0)) + Math.abs(+v[1] - +a[1]);
            if (d < bd) { bd = d; best = k; }
          });
          if (best >= 0) { moves.push([free[best], a, !!prev[a]]); free.splice(best, 1); }
        }
      }
      if (moves.length && moves.length <= 2 && this.sound !== false) {
        const captured = Object.keys(prev).length > Object.keys(pos).length;
        sound(this.check ? 'check' : captured ? 'capture' : 'move');
      }
    }
    this.prevPos = pos;
    const destSet = new Set(this.dests.map(d => d.to));
    for (let i = 0; i < 64; i++) {
      const sq = this.sqAt(i);
      const c = this.cells[i];
      const f = FILES.indexOf(sq[0]), r = +sq[1] - 1;
      const cls = ['sq', (f + r) % 2 === 0 ? 'dark' : 'light'];
      if (this.last && (this.last.from === sq || this.last.to === sq)) cls.push('last');
      if (this.sel === sq) cls.push('sel');
      if (this.check === sq) cls.push('check');
      if (this.hintSq === sq) cls.push('hint');
      if (this.markSq === sq) cls.push('mark');
      if (this.marks && this.marks.includes(sq)) cls.push('mk');
      const p = pos[sq];
      if (destSet.has(sq)) cls.push(p ? 'dest-cap' : 'dest');
      c.className = cls.join(' ');
      c.dataset.sq = sq;
      const row = i >> 3, col = i & 7;
      let html = p ? pieceHtml(p.color, p.type) : '';
      if (col === 0 && !this.hideCoords) html += `<span class="co rk">${sq[1]}</span>`;
      if (row === 7 && !this.hideCoords) html += `<span class="co fl">${sq[0]}</span>`;
      c.innerHTML = html;
    }
    for (const [from, to, cap] of moves) {
      const cell = this.cells.find(x => x.dataset.sq === to);
      const piece = cell && cell.querySelector('.pi, .pc');
      if (!piece) continue;
      const [x1, y1] = this.xy(from), [x2, y2] = this.xy(to);
      piece.style.transition = 'none';
      piece.style.transform = `translate(${(x1 - x2) * 100}%, ${(y1 - y2) * 100}%)`;
      piece.style.zIndex = 4;
      piece.getBoundingClientRect();
      piece.style.transition = 'transform 190ms cubic-bezier(.2,.7,.25,1)';
      piece.style.transform = '';
      if (cap) cell.classList.add('cap');
      setTimeout(() => { piece.style.zIndex = ''; cell.classList.remove('cap'); }, 260);
    }
    this.drawArrows();
  }
  drawArrows() {
    let s = '<defs>' + this.arrows.map((a, k) => `<marker id="ah${k}" markerWidth="3" markerHeight="3" refX="1.6" refY="1.5" orient="auto"><path d="M0,0 L3,1.5 L0,3 z" fill="${a.color}"/></marker>`).join('') + '</defs>';
    for (const [k, a] of this.arrows.entries()) {
      const [x1, y1] = this.xy(a.from), [x2, y2] = this.xy(a.to);
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      const ex = x2 - dx / len * 0.35, ey = y2 - dy / len * 0.35;
      s += `<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="${a.color}" stroke-width="0.16" stroke-linecap="round" marker-end="url(#ah${k})" opacity="0.85"/>`;
    }
    this.svg.innerHTML = s;
  }
  // Ridisegna senza animazione (cambio di posizione non legato a una mossa).
  jump(opts) { this.animate = false; this.set(opts); this.animate = true; }
  flash(sq, cls) {
    const c = this.cells.find(x => x.dataset.sq === sq);
    if (!c) return;
    c.classList.add(cls);
    setTimeout(() => c.classList.remove(cls), 350);
  }
  tap(sq) {
    if (this.onSquare) return this.onSquare(sq);
    if (!this.interactive) return;
    const pos = parsePlacement(this.fen);
    const turn = this.fen.split(' ')[1];
    if (this.sel) {
      const opts = this.dests.filter(d => d.to === sq);
      if (opts.length) {
        const from = this.sel;
        this.sel = null; this.dests = [];
        if (opts.some(o => o.promotion)) this.askPromotion(turn).then(pr => { if (pr) this.onMove({ from, to: sq, promotion: pr }); else this.render(); });
        else this.onMove({ from, to: sq });
        return;
      }
    }
    if (pos[sq] && pos[sq].color === turn && this.sel !== sq) {
      this.sel = sq;
      this.dests = this.legal ? this.legal(sq) : [];
    } else { this.sel = null; this.dests = []; }
    this.render();
  }
  askPromotion(color) {
    return new Promise(res => {
      const m = document.createElement('div');
      m.className = 'promo';
      m.innerHTML = ['q', 'r', 'b', 'n'].map(p => `<button data-p="${p}">${pieceHtml(color, p)}</button>`).join('') + '<button data-p="" class="x">✕</button>';
      m.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        m.remove(); res(b.dataset.p || null);
      });
      this.el.append(m);
    });
  }
}

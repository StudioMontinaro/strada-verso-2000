// Barra laterale della valutazione (dal punto di vista del Bianco).
import { winPct } from './analysis.js';
export class EvalBar {
  constructor(el) { this.el = el; this.fill = el.querySelector('div'); this.lab = el.querySelector('span'); this.hide(); }
  set(cp, mate = null) {
    this.el.classList.remove('off');
    const v = mate !== null && mate !== undefined ? (mate > 0 ? 100000 : -100000) : cp;
    this.fill.style.height = winPct(v) + '%';
    const txt = mate !== null && mate !== undefined ? `M${Math.abs(mate)}` : Math.abs(cp / 100).toFixed(1);
    this.lab.textContent = txt;
    this.lab.className = v >= 0 ? 'w' : 'b';
  }
  hide() { this.el.classList.add('off'); this.fill.style.height = '50%'; this.lab.textContent = ''; }
}

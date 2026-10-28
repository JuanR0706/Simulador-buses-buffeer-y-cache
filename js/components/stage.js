/* Vista HTML/CSS para escenarios sin bus: actores con estado visible y filas de celdas (lineales o en anillo). */
(function (A) {
  const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };
  class Stage {
    constructor(root) { this.root = root; this.actors = {}; this.groups = {}; }
    clear() { this.root.replaceChildren(); this.actors = {}; this.groups = {}; }
    row(title, cls = '') { const r = mk('div', 'stage-row ' + cls); if (title) r.append(mk('h4', '', title)); this.root.append(r); return r; }
    actor(id, label, icon, parent = this.root) {
      const a = mk('div', 'actor s-idle'); a.append(mk('strong', '', `${icon} ${label}`), mk('span', 'st'), mk('small', 'sub'));
      parent.append(a); this.actors[id] = a; this.setState(id, 'idle'); return a;
    }
    setState(id, st) { const a = this.actors[id]; if (a) { a.className = 'actor s-' + st; a.querySelector('.st').textContent = `${A.STATES[st][0]} ${A.STATES[st][1]}`; } }
    sub(id, t) { const a = this.actors[id]; if (a) a.querySelector('.sub').textContent = t; }
    cells(id, n, parent = this.root, ring = false) {
      const box = mk('div', 'cells' + (ring ? ' ring' : '')), list = [];
      for (let i = 0; i < n; i++) {
        const c = mk('div', 'cell empty'); c.append(mk('span', 'idx', i), mk('span', 'val'), mk('span', 'tags'));
        if (ring) { const a = (i / n) * 2 * Math.PI - Math.PI / 2; c.style.left = 50 + 40 * Math.cos(a) + '%'; c.style.top = 50 + 40 * Math.sin(a) + '%'; }
        box.append(c); list.push(c);
      }
      parent.append(box); this.groups[id] = list; return box;
    }
    setCell(id, i, { v = '', cls = 'empty', tags = '' } = {}) { const c = this.groups[id] && this.groups[id][i]; if (c) { c.className = 'cell ' + cls; c.querySelector('.val').textContent = v; c.querySelector('.tags').textContent = tags; } }
    flash(id, i) { const c = this.groups[id] && this.groups[id][i]; if (c) { c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); } }
    text(id, parent = this.root) { const p = mk('p', 'stage-text'); p.dataset.id = id; parent.append(p); return p; }
    setText(id, t) { const p = this.root.querySelector(`[data-id="${id}"]`); if (p) p.textContent = t; }
    movePacket() {}
    resetAll() {}
  }
  A.Components = A.Components || {}; A.Components.Stage = Stage;
})((window.ArqSim = window.ArqSim || {}));

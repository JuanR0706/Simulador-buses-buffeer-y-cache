/* Vista SVG reutilizable: nodos con estado visible (icono + texto + color), bus y paquete animado. */
(function (A) {
  const NS = 'http://www.w3.org/2000/svg';
  const STATES = {
    idle: ['○', 'Inactivo'], off: ['–', 'No participa'], requesting: ['⏳', 'Solicitando acceso'],
    waiting: ['⏸', 'Esperando'], transferring: ['⇄', 'Transfiriendo'], busy: ['⚙', 'Ejecutando'],
    other: ['↻', 'Otra tarea'], critical: ['🔒', 'Sección crítica'], blocked: ['⛔', 'Bloqueado'], hit: ['✔', 'Acierto (hit)'], miss: ['✖', 'Fallo (miss)'], done: ['✔', 'Completado'], error: ['⚠', 'Bloqueado'],
  };
  A.STATES = STATES;
  const el = (tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (text !== undefined) e.textContent = text;
    return e;
  };

  class Diagram {
    constructor(svg, layout) {
      this.svg = svg; this.layout = layout; this.nodes = {}; this.anim = null;
      svg.replaceChildren();
      svg.setAttribute('viewBox', '0 0 800 410');
      const b = layout.bus;
      svg.append(el('rect', { class: 'bus', x: b.x, y: b.y, width: b.w, height: 26, rx: 6 }),
                 el('text', { class: 'bus-label', x: b.x + b.w / 2, y: b.y + 18, 'text-anchor': 'middle' }, 'Bus del sistema'));
      layout.nodes.forEach((n) => {
        const cx = n.x + n.w / 2, top = n.y < b.y;
        svg.append(el('line', { class: 'link', x1: cx, x2: cx, y1: top ? n.y + n.h : n.y, y2: top ? b.y : b.y + 26 }));
        const g = el('g', { class: 'node s-idle', 'data-id': n.id });
        g.append(el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 10 }),
                 el('text', { class: 'n-label', x: cx, y: n.y + 28, 'text-anchor': 'middle' }, `${n.icon} ${n.label}`),
                 el('text', { class: 'n-state', x: cx, y: n.y + 54, 'text-anchor': 'middle' }));
        svg.append(g);
        this.nodes[n.id] = { g, n, state: g.querySelector('.n-state') };
      });
      this.packet = el('rect', { class: 'packet', width: 22, height: 22, rx: 4, visibility: 'hidden' });
      svg.append(this.packet);
      this.resetAll();
    }
    setState(id, st) {
      const t = this.nodes[id]; if (!t) return;
      t.g.setAttribute('class', `node s-${st}`);
      t.state.textContent = `${STATES[st][0]} ${STATES[st][1]}`;
    }
    resetAll() {
      Object.keys(this.nodes).forEach((id) => this.setState(id, 'idle'));
      if (this.anim) this.anim.cancel();
      this.packet.setAttribute('visibility', 'hidden');
    }
    movePacket(from, to, ms) {
      const a = this.nodes[from].n, b = this.nodes[to].n, by = this.layout.bus.y + 2;
      const c = (n) => ({ x: n.x + n.w / 2 - 11, y: n.y + n.h / 2 - 11 });
      const pts = [c(a), { x: c(a).x, y: by }, { x: c(b).x, y: by }, c(b)];
      if (this.anim) this.anim.cancel();
      this.packet.setAttribute('visibility', 'visible');
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) ms = 0;
      this.anim = this.packet.animate(pts.map((p) => ({ transform: `translate(${p.x}px,${p.y}px)` })), { duration: ms, fill: 'forwards' });
      this.anim.onfinish = () => this.packet.setAttribute('visibility', 'hidden');
    }
  }
  A.Components = A.Components || {};
  A.Components.Diagram = Diagram;
})((window.ArqSim = window.ArqSim || {}));

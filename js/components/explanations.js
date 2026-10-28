/* Panel de explicación, estadísticas y registro de eventos. Solo muestra datos; no contiene lógica de simulación. */
(function (A) {
  A.LOG_LIMIT = 150;
  const ROWS = [['what', 'Qué ocurre'], ['who', 'Componente'], ['why', 'Por qué'], ['ifChanged', 'Si cambiara un parámetro'], ['result', 'Resultado'], ['concept', 'Concepto de arquitectura']];
  const BASIC = ['what', 'who', 'result'];
  const ICON = { info: '•', ok: '✔', wait: '⏸', error: '⚠' };

  class Explanations {
    constructor(panel, logEl) { this.panel = panel; this.logEl = logEl; this.detail = true; this.last = null; }
    show(e) {
      this.last = e;
      this.panel.replaceChildren(...ROWS.filter(([k]) => e[k] && (this.detail || BASIC.includes(k))).map(([k, label]) => {
        const d = document.createElement('div'); d.className = 'ex-row ex-' + k;
        const h = document.createElement('dt'); h.textContent = label;
        const v = document.createElement('dd'); v.textContent = e[k];
        d.append(h, v); return d;
      }));
    }
    setDetail(on) { this.detail = on; if (this.last) this.show(this.last); }
    log(n, text, status = 'info', meta = {}) {
      const li = document.createElement('li'); li.className = 'log-' + status + ' recent';
      li.textContent = `${ICON[status]} ${n ? '#' + n : ''}${meta.time ? ' · ' + meta.time : ''}${meta.who ? ' · ' + meta.who : ''}: ${text}`;
      this.logEl.querySelector('.recent')?.classList.remove('recent');
      li.classList.add('recent');
      this.logEl.append(li);
      while (this.logEl.children.length > A.LOG_LIMIT) this.logEl.firstElementChild.remove();   // evita crecimiento indefinido
      this.logEl.scrollTop = this.logEl.scrollHeight;
    }
    clearLog() { this.logEl.replaceChildren(); }
    error(msg) { this.show({ what: 'No se puede iniciar', result: msg }); this.log(0, msg, 'error'); }
  }

  class Stats {
    constructor(el) { this.el = el; }
    render(rows, compare, note) {
      this.el.replaceChildren();
      const dl = document.createElement('dl'); dl.className = 'stat-list';
      rows.forEach(([k, v]) => { const d = document.createElement('div'); const a = document.createElement('dt'); a.textContent = k; const b = document.createElement('dd'); b.textContent = v; d.append(a, b); dl.append(d); });
      this.el.append(dl);
      if (compare) {
        const t = document.createElement('table'); t.className = 'compare';
        compare.forEach((r, i) => { const tr = t.insertRow(); r.forEach((c) => { const cell = document.createElement(i === 0 ? 'th' : 'td'); cell.textContent = c; tr.append(cell); }); });
        this.el.append(t);
      }
      if (note) { const p = document.createElement('p'); p.className = 'note'; p.textContent = note; this.el.append(p); }
    }
  }
  A.Components = A.Components || {};
  A.Components.Explanations = Explanations; A.Components.Stats = Stats;
})((window.ArqSim = window.ArqSim || {}));

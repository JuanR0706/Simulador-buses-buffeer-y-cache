/* Buffer simple frente a doble buffering con las mismas velocidades y cantidad de bloques. */
(function (A) {
  const NOTE = 'El doble buffering puede mejorar el solapamiento entre producción y consumo, pero no garantiza que desaparezcan todas las esperas. Los resultados surgen de las reglas y parámetros definidos aquí, no de mejoras universales.';
  const LBL = { empty: 'vacío', filling: 'llenando', full: 'lleno', processing: 'procesando' }, CLS = { empty: 'empty', filling: 'busy', full: 'filled', processing: 'busy' };
  class BufferCompareSimulation extends A.Simulation {
    static get view() { return 'stage'; }
    constructor(ctx) {
      super(ctx); this.results = {};
      this.schema = [
        { key: 'mode', label: 'Modelo', type: 'select', options: [['simple', 'Buffer simple'], ['double', 'Doble buffering']], value: 'simple' },
        { key: 'blocks', label: 'Bloques a procesar', min: 1, max: 30, value: 8 },
        { key: 'pp', label: 'Producir un bloque (intervalos)', min: 1, max: 10, value: 3 },
        { key: 'cp', label: 'Procesar un bloque (intervalos)', min: 1, max: 10, value: 4 },
      ];
      this.config = Object.fromEntries(this.schema.map((f) => [f.key, f.value])); this.s = this.blank();
    }
    blank() { return { steps: 0, time: 0, started: 0, produced: 0, consumed: 0, pWait: 0, cWait: 0, pBusy: 0, cBusy: 0, bufs: Array.from({ length: this.config.mode === 'double' ? 2 : 1 }, () => ({ st: 'empty' })) }; }
    validate() { const c = this.config; return ['blocks', 'pp', 'cp'].every((k) => Number.isInteger(c[k]) && c[k] >= 1) && c.blocks <= 30 && c.pp <= 10 && c.cp <= 10 ? null : 'Escribe enteros: bloques 1–30 y tiempos 1–10.'; }
    name(b) { return this.config.mode === 'double' ? 'Buffer ' + 'AB'[b] : 'Buffer único'; }
    onReset(starting) {
      this.s = this.blank(); const st = this.ctx.stage; st.clear(); const r = st.row('', 'flow');
      st.actor('prod', 'Productor', '🏭', r); st.cells('buf', this.s.bufs.length, r); st.actor('cons', 'Consumidor', '🖥', r); st.text('info'); this.draw();
      if (!starting) this.ctx.expl.show({ what: 'Elige el modelo y ejecútalo; luego ejecuta el otro con los mismos valores.', who: 'Productor, buffer(s) y consumidor', why: 'Con un solo buffer, producir y procesar compiten por el mismo espacio; con dos pueden solaparse.', ifChanged: 'Si procesar es mucho más lento que producir, las esperas del productor seguirán apareciendo con dos buffers.', result: 'Simulación lista.', concept: NOTE });
      this.renderStats();
    }
    draw() { this.s.bufs.forEach((b, i) => this.ctx.stage.setCell('buf', i, { v: (this.config.mode === 'double' ? 'AB'[i] + ': ' : '') + LBL[b.st], cls: 'wide ' + CLS[b.st] })); this.ctx.stage.setText('info', `Producidos ${this.s.produced} · consumidos ${this.s.consumed} de ${this.config.blocks}`); }
    apply(o) { super.apply(o); this.draw(); }
    text(k, b) {
      const n = this.name(b), dbl = this.config.mode === 'double';
      return ({
        pstart: { what: `Productor: empieza a llenar ${n}`, who: 'Productor', why: 'Hay un espacio vacío que puede recibir el siguiente bloque.', ifChanged: dbl ? 'El otro buffer puede procesarse a la vez.' : 'Con un solo buffer, el consumidor no puede procesar mientras se llena.', result: `${n}: llenando.`, concept: 'Producción de un bloque.' },
        pwait: { what: 'Productor: espera, no hay buffer vacío', who: 'Productor', why: dbl ? 'Ambos buffers están llenos o en procesamiento.' : 'El único buffer está lleno o siendo procesado.', ifChanged: 'Un consumidor más rápido o un buffer adicional reducirían esta espera.', result: 'Productor detenido.', concept: 'Periodo de espera del productor.' },
        cstart: { what: `Consumidor: empieza a procesar ${n}`, who: 'Consumidor', why: 'Hay un bloque lleno disponible.', ifChanged: dbl ? 'Mientras procesa, el productor puede llenar el otro buffer.' : 'Mientras procesa, el productor no puede usar el buffer.', result: `${n}: procesando.`, concept: dbl ? 'Solapamiento entre producción y consumo.' : 'Espacio compartido: una operación a la vez.' },
        cwait: { what: 'Consumidor: espera, no hay bloque lleno', who: 'Consumidor', why: 'Todavía no se terminó de llenar ningún buffer.', ifChanged: 'Producir más rápido reduciría esta espera.', result: 'Consumidor detenido.', concept: 'Periodo de espera del consumidor.' },
        pend: { what: `Productor: ${n} quedó lleno`, who: 'Productor', why: 'Terminó de producir el bloque.', ifChanged: 'Con otro tiempo de producción cambiaría el instante.', result: `Bloques producidos: ${this.s.produced}.`, concept: 'Cambio de estado del buffer: lleno.' },
        cend: { what: `Consumidor: terminó de procesar ${n}; queda vacío`, who: 'Consumidor', why: 'Completó el procesamiento del bloque.', ifChanged: 'Con otro tiempo de procesamiento cambiaría el instante.', result: `Bloques consumidos: ${this.s.consumed}.`, concept: 'Liberación del buffer.' },
      })[k];
    }
    *script() {
      const c = this.config, s = this.s, q = []; let tick = 0, pSt = null, cSt = null, pw = false, cw = false;
      while (s.consumed < c.blocks) {
        tick++; const ev = [];
        if (!pSt && s.started < c.blocks) { const b = s.bufs.findIndex((x) => x.st === 'empty'); if (b >= 0) { s.bufs[b].st = 'filling'; pSt = { b, rem: c.pp }; s.started++; pw = false; ev.push(['pstart', b]); } else if (!pw) { pw = true; ev.push(['pwait', 0]); } }
        if (!cSt) { if (q.length) { const b = q.shift(); s.bufs[b].st = 'processing'; cSt = { b, rem: c.cp }; cw = false; ev.push(['cstart', b]); } else if (!cw) { cw = true; ev.push(['cwait', 0]); } }
        if (pSt) { s.pBusy++; pSt.rem--; } else if (s.started < c.blocks) s.pWait++;
        if (cSt) { s.cBusy++; cSt.rem--; } else s.cWait++;
        if (pSt && pSt.rem === 0) { s.bufs[pSt.b].st = 'full'; q.push(pSt.b); s.produced++; ev.push(['pend', pSt.b]); pSt = null; }
        if (cSt && cSt.rem === 0) { s.bufs[cSt.b].st = 'empty'; s.consumed++; ev.push(['cend', cSt.b]); cSt = null; }
        s.time = tick;
        for (let i = 0; i < ev.length; i++) yield* this.go({ end: s.consumed === c.blocks && i === ev.length - 1, status: /wait/.test(ev[i][0]) ? 'wait' : 'info', states: { prod: pSt ? 'busy' : s.started >= c.blocks ? 'done' : 'waiting', cons: cSt ? 'busy' : s.consumed === c.blocks ? 'done' : 'waiting' }, e: this.text(ev[i][0], ev[i][1]) });
      }
    }
    finish() { const s = this.s; this.results[this.config.mode] = { ...s, pu: s.pBusy / s.time, cu: s.cBusy / s.time }; this.renderStats(); }
    renderStats() {
      const s = this.s, c = this.config, r = this.results, pc = (x) => (x * 100).toFixed(1) + ' %', cell = (m, f) => (r[m] ? f(r[m]) : '—');
      const cmp = [['Métrica', 'Buffer simple', 'Doble buffering'], ['Bloques producidos', ...['simple', 'double'].map((m) => cell(m, (x) => x.produced))], ['Bloques consumidos', ...['simple', 'double'].map((m) => cell(m, (x) => x.consumed))], ['Tiempo simulado', ...['simple', 'double'].map((m) => cell(m, (x) => x.time + ' int.'))], ['Espera productor', ...['simple', 'double'].map((m) => cell(m, (x) => x.pWait))], ['Espera consumidor', ...['simple', 'double'].map((m) => cell(m, (x) => x.cWait))], ['Utilización productor', ...['simple', 'double'].map((m) => cell(m, (x) => pc(x.pu)))], ['Utilización consumidor', ...['simple', 'double'].map((m) => cell(m, (x) => pc(x.cu)))]];
      this.ctx.stats.render([['Modelo', c.mode === 'double' ? 'Doble buffering' : 'Buffer simple'], ['Tiempo simulado', s.time + ' intervalos'], ['Producidos / consumidos', `${s.produced} / ${s.consumed} de ${c.blocks}`], ['Espera productor / consumidor', `${s.pWait} / ${s.cWait}`]], cmp, NOTE);
    }
  }
  A.Simulations = A.Simulations || {}; A.Simulations.BufferCompare = BufferCompareSimulation;
})((window.ArqSim = window.ArqSim || {}));

/* Buffer simple: productor, buffer y consumidor. Cada paso es un evento; el tiempo avanza en intervalos simulados. */
(function (A) {
  const NOTE = 'Intervalo = unidad de tiempo simulada. Los ritmos se expresan en «intervalos por dato» (menor número = más rápido). En cada intervalo actúa primero el productor y después el consumidor.';
  class ProducerConsumerSimulation extends A.Simulation {
    static get view() { return 'stage'; }
    constructor(ctx) {
      super(ctx);
      this.schema = [
        { key: 'cap', label: 'Capacidad del buffer', min: 1, max: 16, value: 4 },
        { key: 'pp', label: 'Productor: intervalos por dato', min: 1, max: 10, value: 2 },
        { key: 'cp', label: 'Consumidor: intervalos por dato', min: 1, max: 10, value: 3 },
        { key: 'total', label: 'Datos a producir', min: 1, max: 40, value: 12 },
        { key: 'policy', label: 'Si el buffer se llena', type: 'select', options: [['block', 'Bloquear al productor'], ['discard', 'Descartar el dato']], value: 'block' },
      ];
      this.config = Object.fromEntries(this.schema.map((f) => [f.key, f.value])); this.s = this.blank();
    }
    blank() { return { steps: 0, time: 0, buf: [], produced: 0, consumed: 0, dropped: 0, pBlocked: 0, cBlocked: 0, pWait: 0, cWait: 0 }; }
    validate() {
      const c = this.config;
      if (!['cap', 'pp', 'cp', 'total'].every((k) => Number.isInteger(c[k]) && c[k] >= 1)) return 'Escribe enteros mayores que cero.';
      return c.cap > 16 || c.pp > 10 || c.cp > 10 || c.total > 40 ? 'Máximos: capacidad 16, ritmos 10 y datos 40.' : null;
    }
    build() {
      const st = this.ctx.stage; st.clear(); const r = st.row('', 'flow');
      st.actor('prod', 'Productor', '🏭', r); st.cells('buf', this.config.cap, r); st.actor('cons', 'Consumidor', '🖥', r); st.text('info');
      this.draw();
    }
    draw() {
      const st = this.ctx.stage, s = this.s, cap = this.config.cap;
      for (let i = 0; i < cap; i++) st.setCell('buf', i, { v: s.buf[i] || '', cls: s.buf[i] ? 'filled' : 'empty', tags: i === 0 && s.buf.length ? 'sale' : '' });
      st.setText('info', `Ocupación ${s.buf.length}/${cap} · espacios libres ${cap - s.buf.length}`);
    }
    onReset(starting) {
      this.s = this.blank(); this.build();
      if (!starting) this.ctx.expl.show({ what: 'Configura los ritmos y la política del buffer, y pulsa Iniciar o Paso siguiente.', who: 'Productor, buffer y consumidor', why: 'El buffer absorbe las diferencias de velocidad entre quien genera y quien procesa los datos.', ifChanged: 'Con un productor más rápido la ocupación crece; con un consumidor más rápido el buffer tiende a vaciarse.', result: 'Simulación lista.', concept: NOTE });
      this.renderStats();
    }
    apply(o) { super.apply(o); this.draw(); }
    ev(k, d) {
      const c = this.config, s = this.s, n = s.buf.length;
      const E = {
        store: { what: `Productor: se almacenó el dato ${d.d}`, who: 'Productor y buffer', why: d.wasB ? 'El consumidor liberó espacio y el productor pudo continuar.' : 'El productor generó un dato y había espacio disponible.', ifChanged: 'Si el productor fuera más rápido que el consumidor, la ocupación seguiría subiendo hasta llenar el buffer.', result: `Ocupación ${n}/${c.cap}; espacios libres ${c.cap - n}.`, concept: 'El buffer absorbe diferencias de velocidad entre productor y consumidor.' },
        drop: { what: `Productor: dato ${d.d} descartado, el buffer está lleno`, who: 'Productor y buffer', why: 'La política configurada descarta el dato en lugar de esperar.', ifChanged: 'Con la política «Bloquear» el dato no se perdería, pero el productor esperaría.', result: `${s.dropped} dato(s) perdido(s) hasta ahora.`, concept: 'Política de buffer lleno: descartar evita esperas pero pierde datos.' },
        pblock: { what: 'Productor: bloqueado porque el buffer está lleno', who: 'Productor', why: 'No hay espacio libre; debe esperar a que el consumidor retire un dato.', ifChanged: 'Un consumidor más rápido o más capacidad reducirían este bloqueo.', result: `Buffer lleno (${c.cap}/${c.cap}).`, concept: 'Bloqueo del productor: sincronización por falta de espacio.' },
        take: { what: `Consumidor: procesó el dato ${d.d}`, who: 'Consumidor y buffer', why: 'Había datos disponibles y le tocaba procesar.', ifChanged: 'Si el consumidor fuera más lento, el buffer acumularía más datos.', result: `Ocupación ${n}/${c.cap}; consumidos ${s.consumed}.`, concept: 'El consumidor extrae datos cuando puede procesarlos.' },
        cwait: { what: 'Consumidor: espera porque no hay datos disponibles', who: 'Consumidor', why: 'El buffer está vacío; no puede procesar datos que no existen.', ifChanged: 'Un productor más rápido reduciría esta espera.', result: 'Buffer vacío (0 datos).', concept: 'Espera del consumidor: sincronización por falta de datos.' },
      };
      return E[k];
    }
    *script() {
      const c = this.config, s = this.s; let tick = 0, pDue = 1, cDue = 1, pBlk = false, cBlk = false;
      while (s.produced < c.total || s.buf.length) {
        tick++; const evs = [];
        if (s.produced < c.total && pDue <= tick) {
          if (s.buf.length < c.cap) { const d = 'D' + (s.produced + 1); s.produced++; s.buf.push(d); pDue = tick + c.pp; evs.push(['store', { d, wasB: pBlk }]); pBlk = false; }
          else if (c.policy === 'discard') { const d = 'D' + (s.produced + 1); s.produced++; s.dropped++; pDue = tick + c.pp; evs.push(['drop', { d }]); }
          else { s.pBlocked++; s.pWait++; if (!pBlk) { pBlk = true; evs.push(['pblock', {}]); } }
        }
        if (cDue <= tick && (s.produced < c.total || s.buf.length)) {
          if (s.buf.length) { const d = s.buf.shift(); s.consumed++; cDue = tick + c.cp; cBlk = false; evs.push(['take', { d }]); }
          else { s.cBlocked++; s.cWait++; if (!cBlk) { cBlk = true; evs.push(['cwait', {}]); } }
        }
        s.time = tick;
        const done = !(s.produced < c.total || s.buf.length);
        for (let i = 0; i < evs.length; i++) {
          const [k, d] = evs[i];
          yield* this.go({ end: done && i === evs.length - 1, status: k === 'pblock' || k === 'cwait' || k === 'drop' ? 'wait' : 'info', states: { prod: pBlk ? 'blocked' : 'busy', cons: cBlk ? 'waiting' : 'busy' }, e: this.ev(k, d) });
        }
      }
    }
    renderStats() {
      const s = this.s, c = this.config;
      this.ctx.stats.render([['Capacidad total', c.cap], ['Ocupación actual', `${s.buf.length}/${c.cap}`], ['Espacios disponibles', c.cap - s.buf.length], ['Datos producidos', s.produced], ['Datos consumidos', s.consumed], ['Datos descartados', s.dropped], ['Operaciones bloqueadas', s.pBlocked + s.cBlocked], ['Espera del productor / consumidor', `${s.pWait} / ${s.cWait} intervalos`], ['Tiempo simulado', `${s.time} intervalos`]], null, NOTE);
    }
  }
  A.Simulations = A.Simulations || {}; A.Simulations.Buffer = ProducerConsumerSimulation;
})((window.ArqSim = window.ArqSim || {}));

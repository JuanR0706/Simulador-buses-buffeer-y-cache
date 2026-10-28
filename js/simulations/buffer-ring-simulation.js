/* Buffer circular. El estado (vacío / parcial / lleno) se decide con un contador, no comparando los índices. */
(function (A) {
  const NOTE = 'writeIndex = siguiente posición de escritura; readIndex = siguiente posición de lectura. Pueden coincidir tanto con el buffer vacío como con el lleno: por eso se usa un contador de elementos.';
  class RingSimulation extends A.Simulation {
    static get view() { return 'stage'; }
    constructor(ctx) {
      super(ctx);
      this.schema = [
        { key: 'cap', label: 'Capacidad (posiciones)', min: 2, max: 16, value: 8 },
        { key: 'ops', label: 'Operaciones aleatorias', min: 1, max: 60, value: 20 },
        { key: 'pw', label: 'Probabilidad de escritura (%)', min: 0, max: 100, value: 55 },
        { key: 'seed', label: 'Semilla (repite la misma secuencia)', min: 1, max: 9999, value: 7 },
      ];
      this.actions = [{ label: 'Escribir un dato', run: () => this.manual('W') }, { label: 'Leer un dato', run: () => this.manual('R') }];
      this.config = Object.fromEntries(this.schema.map((f) => [f.key, f.value])); this.s = this.blank();
    }
    blank() { const cap = this.config.cap; return { cap, steps: 0, time: 0, buf: Array(cap).fill(null), w: 0, r: 0, count: 0, next: 1, writes: 0, reads: 0, rejW: 0, rejR: 0, wraps: 0 }; }
    validate() {
      const c = this.config;
      if (!['cap', 'ops', 'pw', 'seed'].every((k) => Number.isInteger(c[k]))) return 'Escribe números enteros.';
      return c.cap < 2 || c.cap > 16 || c.ops < 1 || c.ops > 60 || c.pw < 0 || c.pw > 100 || c.seed < 1 ? 'Capacidad 2–16, operaciones 1–60, probabilidad 0–100 y semilla ≥ 1.' : null;
    }
    state() { const s = this.s; return s.count === 0 ? 'vacío' : s.count === s.cap ? 'lleno' : 'parcialmente ocupado'; }
    build() { const st = this.ctx.stage; st.clear(); const r = st.row('Anillo de posiciones'); st.cells('ring', this.s.cap, r, true); st.text('info'); this.draw(); }
    draw() {
      const st = this.ctx.stage, s = this.s;
      for (let i = 0; i < s.cap; i++) st.setCell('ring', i, { v: s.buf[i] || '', cls: s.buf[i] ? 'filled' : 'empty', tags: (i === s.w ? 'W ' : '') + (i === s.r ? 'R' : '') });
      st.setText('info', `Estado: ${this.state()} · contador = ${s.count}/${s.cap} · writeIndex = ${s.w} · readIndex = ${s.r}   (W = escritura, R = lectura)`);
    }
    onReset(starting) {
      this.s = this.blank(); this.build();
      if (!starting) this.ctx.expl.show({ what: 'Usa «Escribir un dato» y «Leer un dato», o pulsa Iniciar para operaciones aleatorias.', who: 'Buffer circular', why: 'Los índices avanzan y vuelven al inicio, así que las posiciones se reutilizan.', ifChanged: 'Con menos capacidad el buffer se llena antes y los índices vuelven al inicio más a menudo.', result: 'Buffer vacío.', concept: NOTE });
      this.renderStats();
    }
    configure() { const e = this.validate(); if (e) { this.ctx.expl.error(e); return false; } if (this.config.cap !== this.s.cap) this.onReset(false); return true; }
    manual(k) { if (this.status === 'running' || !this.configure()) return; this.apply(this.op(k)); }
    apply(o) { super.apply(o); this.draw(); }
    op(k) {
      const s = this.s, cap = s.cap;
      if (k === 'W') {
        if (s.count === cap) { s.rejW++; return { cost: 1, status: 'wait', e: { what: 'Escritura rechazada: el buffer está lleno', who: 'Buffer circular', why: `El contador (${s.count}) iguala la capacidad; escribir sobrescribiría un dato sin leer.`, ifChanged: 'Si el consumidor leyera antes, habría espacio.', result: 'No se modificó ningún índice.', concept: 'Buffer lleno: el productor debe esperar (en este ejemplo, se bloquea).' } }; }
        const pos = s.w, v = 'd' + s.next++; s.buf[pos] = v; s.w = (s.w + 1) % cap; s.count++; s.writes++; const wrap = s.w === 0; if (wrap) s.wraps++;
        this.ctx.stage.flash('ring', pos);
        return { cost: 1, e: { what: `Escritura: dato ${v} guardado en la posición ${pos}`, who: 'Buffer circular (escritura)', why: `Había espacio: el contador (${s.count - 1}) era menor que la capacidad (${cap}).`, ifChanged: 'Con el buffer lleno esta operación se rechazaría.', result: `writeIndex: ${pos} → ${s.w}${wrap ? ' (volvió al inicio)' : ''}; contador = ${s.count}.${s.w === s.r ? ` Ahora writeIndex = readIndex = ${s.w}: el contador indica que el buffer está ${s.count === 0 ? 'vacío' : 'lleno'}.` : ''}`, concept: 'Índice circular: (índice + 1) MOD capacidad.' } };
      }
      if (s.count === 0) { s.rejR++; return { cost: 1, status: 'wait', e: { what: 'Lectura rechazada: el buffer está vacío', who: 'Buffer circular', why: 'El contador es 0: no hay datos que leer.', ifChanged: 'Si el productor escribiera antes, habría un dato disponible.', result: 'No se modificó ningún índice.', concept: 'Buffer vacío: el consumidor debe esperar.' } }; }
      const pos = s.r, v = s.buf[pos]; s.buf[pos] = null; s.r = (s.r + 1) % cap; s.count--; s.reads++; const wrap = s.r === 0; if (wrap) s.wraps++;
      this.ctx.stage.flash('ring', pos);
      return { cost: 1, e: { what: `Lectura: dato ${v} recuperado de la posición ${pos}`, who: 'Buffer circular (lectura)', why: `Había datos disponibles: el contador (${s.count + 1}) era mayor que 0.`, ifChanged: 'Con el buffer vacío esta operación se rechazaría.', result: `readIndex: ${pos} → ${s.r}${wrap ? ' (volvió al inicio)' : ''}; contador = ${s.count}.${s.w === s.r ? ` Ahora writeIndex = readIndex = ${s.r}: el contador indica que el buffer está ${s.count === 0 ? 'vacío' : 'lleno'}.` : ''}`, concept: 'La posición se libera para reutilizarse al dar la vuelta.' } };
    }
    *script() {
      const { ops, pw, seed } = this.config, rnd = A.Utils.mulberry32(seed);
      for (let i = 0; i < ops; i++) yield* this.go({ ...this.op(rnd() * 100 < pw ? 'W' : 'R'), end: i === ops - 1 });
    }
    renderStats() {
      const s = this.s;
      this.ctx.stats.render([['Capacidad total', s.cap], ['Ocupación actual', `${s.count}/${s.cap}`], ['Espacios disponibles', s.cap - s.count], ['Estado', this.state()], ['Escrituras / lecturas', `${s.writes} / ${s.reads}`], ['Operaciones rechazadas (lleno / vacío)', `${s.rejW} / ${s.rejR}`], ['Vueltas al inicio de los índices', s.wraps]], null, NOTE);
    }
  }
  A.Simulations = A.Simulations || {}; A.Simulations.Ring = RingSimulation;
})((window.ArqSim = window.ArqSim || {}));

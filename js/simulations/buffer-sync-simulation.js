/* Productor-consumidor con mutex y dos semáforos. Un planificador didáctico por turnos alterna las acciones:
   la concurrencia es conceptual (un solo hilo de JavaScript), no una ejecución paralela real. */
(function (A) {
  const NOTE = 'Concurrencia conceptual: un planificador didáctico alterna acciones del productor y del consumidor (no hay hilos paralelos reales). Cada participante ejecuta hasta su cuota de acciones por turno o hasta quedar bloqueado.';
  const PRESETS = { prodFast: { cap: 3, items: 8, prefill: 0, qp: 4, qc: 1 }, consFast: { cap: 4, items: 8, prefill: 0, qp: 1, qc: 4 }, full: { cap: 2, items: 6, prefill: 2, qp: 4, qc: 1 }, empty: { cap: 3, items: 6, prefill: 0, qp: 1, qc: 4 }, mutex: { cap: 4, items: 6, prefill: 2, qp: 4, qc: 2 } };
  const who = (m) => (m === 'P' ? 'el Productor' : 'el Consumidor');
  /* Microacciones de cada participante: need() = condición para poder ejecutarse; run() = efecto sobre el estado compartido. */
  const PROD = [
    { code: 'P1 · producir un dato (local)', cs: false, run: (s) => { s.P.item = 'D' + (s.P.cnt + 1); return `Dato ${s.P.item} listo.`; }, why: 'Antes de insertar hay que tener un dato.', concept: 'Trabajo local: no toca datos compartidos.' },
    { code: 'P2 · wait(espacios)', need: (s) => s.sem.empty > 0, block: () => 'el semáforo de espacios vale 0: el buffer está lleno', run: (s) => { s.sem.empty--; return `Semáforo de espacios: ${s.sem.empty}.`; }, why: 'Reserva un espacio libre; impide escribir con el buffer lleno.', concept: 'Semáforo de espacios disponibles.' },
    { code: 'P3 · lock(mutex)', need: (s) => s.mutex === null, block: (s) => `el mutex está ocupado por ${who(s.mutex)}`, run: (s) => { s.mutex = 'P'; return 'Mutex adquirido.'; }, why: 'Solo un participante puede modificar índices y contador a la vez.', concept: 'Mutex: protege el estado compartido.' },
    { code: 'P4 · buffer[in] = dato; in++; count++', cs: true, run: (s, c) => { if (s.count >= c.cap) throw new Error('escritura sobre buffer lleno'); const pos = s.in; s.buf[pos] = s.P.item; s.in = (s.in + 1) % c.cap; s.count++; return `${s.P.item} en la posición ${pos}; in = ${s.in}; count = ${s.count}.`; }, why: 'Modifica el estado compartido, por eso solo se hace con el mutex.', concept: 'Sección crítica.' },
    { code: 'P5 · unlock(mutex)', run: (s) => { s.mutex = null; return 'Mutex liberado.'; }, why: 'Permite que el otro participante use el estado compartido.', concept: 'Liberación del mutex.' },
    { code: 'P6 · signal(datos)', run: (s) => { s.sem.full++; return `Semáforo de datos: ${s.sem.full}.`; }, why: 'Avisa al consumidor de que hay un dato más.', concept: 'Semáforo de datos disponibles.' },
  ];
  const CONS = [
    { code: 'C1 · wait(datos)', need: (s) => s.sem.full > 0, block: () => 'el semáforo de datos vale 0: el buffer está vacío', run: (s) => { s.sem.full--; return `Semáforo de datos: ${s.sem.full}.`; }, why: 'Reserva un dato; impide leer con el buffer vacío.', concept: 'Semáforo de datos disponibles.' },
    { code: 'C2 · lock(mutex)', need: (s) => s.mutex === null, block: (s) => `el mutex está ocupado por ${who(s.mutex)}`, run: (s) => { s.mutex = 'C'; return 'Mutex adquirido.'; }, why: 'Necesita acceso exclusivo al estado compartido.', concept: 'Mutex: protege el estado compartido.' },
    { code: 'C3 · dato = buffer[out]; out++; count--', cs: true, run: (s, c) => { if (s.count <= 0) throw new Error('lectura de un dato inexistente'); const pos = s.out; s.C.item = s.buf[pos]; s.buf[pos] = null; s.out = (s.out + 1) % c.cap; s.count--; return `Leyó ${s.C.item} de la posición ${pos}; out = ${s.out}; count = ${s.count}.`; }, why: 'Modifica el estado compartido bajo el mutex.', concept: 'Sección crítica.' },
    { code: 'C4 · unlock(mutex)', run: (s) => { s.mutex = null; return 'Mutex liberado.'; }, why: 'Permite que el otro participante continúe.', concept: 'Liberación del mutex.' },
    { code: 'C5 · signal(espacios)', run: (s) => { s.sem.empty++; return `Semáforo de espacios: ${s.sem.empty}.`; }, why: 'Avisa al productor de que hay un espacio libre.', concept: 'Semáforo de espacios disponibles.' },
    { code: 'C6 · consumir el dato (local)', run: (s) => { s.out_list.push(s.C.item); return `${s.C.item} procesado.`; }, why: 'Procesa el dato fuera de la sección crítica.', concept: 'Trabajo local.' },
  ];

  class SyncSimulation extends A.Simulation {
    static get view() { return 'stage'; }
    constructor(ctx) {
      super(ctx);
      this.schema = [
        { key: 'scenario', label: 'Escenario', type: 'select', options: [['custom', 'Personalizado'], ['prodFast', 'Productor más rápido'], ['consFast', 'Consumidor más rápido'], ['full', 'Buffer lleno'], ['empty', 'Buffer vacío'], ['mutex', 'Espera por el mutex']], value: 'custom', presets: PRESETS },
        { key: 'cap', label: 'Capacidad', min: 1, max: 8, value: 4 }, { key: 'items', label: 'Datos a producir', min: 1, max: 20, value: 8 },
        { key: 'prefill', label: 'Datos iniciales en el buffer', min: 0, max: 8, value: 0 },
        { key: 'qp', label: 'Productor: acciones por turno', min: 1, max: 6, value: 2 }, { key: 'qc', label: 'Consumidor: acciones por turno', min: 1, max: 6, value: 2 },
      ];
      this.config = Object.fromEntries(this.schema.map((f) => [f.key, f.value])); this.s = this.blank();
    }
    blank() {
      const c = this.config, pre = Math.min(c.prefill || 0, c.cap);
      return { steps: 0, time: 0, buf: Array.from({ length: c.cap }, (_, i) => (i < pre ? 'I' + (i + 1) : null)), in: pre % c.cap, out: 0, count: pre, sem: { empty: c.cap - pre, full: pre }, mutex: null, turn: 'P', q: c.qp,
        P: { pc: 0, cnt: 0, total: c.items, done: false, blocked: null, blocks: 0 }, C: { pc: 0, cnt: 0, total: c.items + pre, done: false, blocked: null, blocks: 0 }, out_list: [] };
    }
    validate() {
      const c = this.config;
      if (!['cap', 'items', 'prefill', 'qp', 'qc'].every((k) => Number.isInteger(c[k]))) return 'Escribe números enteros.';
      if (c.cap < 1 || c.cap > 8 || c.items < 1 || c.items > 20 || c.qp < 1 || c.qp > 6 || c.qc < 1 || c.qc > 6) return 'Capacidad 1–8, datos 1–20 y acciones por turno 1–6.';
      return c.prefill < 0 || c.prefill > c.cap ? 'Los datos iniciales deben estar entre 0 y la capacidad.' : null;
    }
    onReset(starting) {
      this.s = this.blank(); const st = this.ctx.stage; st.clear();
      const r = st.row('', 'flow'); st.actor('prod', 'Productor', '🏭', r); st.cells('buf', this.config.cap, r); st.actor('cons', 'Consumidor', '🖥', r);
      st.text('sem'); st.text('info'); this.draw();
      if (!starting) this.ctx.expl.show({ what: 'Elige un escenario y pulsa Iniciar o Paso siguiente.', who: 'Productor, consumidor, mutex y semáforos', why: 'Los semáforos cuentan espacios y datos; el mutex protege el estado compartido.', ifChanged: 'Cambia las acciones por turno para ver bloqueos distintos.', result: 'Simulación lista.', concept: NOTE });
      this.renderStats();
    }
    states() {
      const s = this.s, f = (m, other) => (m.done ? 'done' : m.blocked ? 'blocked' : s.mutex === (m === s.P ? 'P' : 'C') ? 'critical' : s.turn === (m === s.P ? 'P' : 'C') ? 'busy' : 'waiting');
      return { prod: f(s.P), cons: f(s.C) };
    }
    draw() {
      const st = this.ctx.stage, s = this.s, c = this.config;
      for (let i = 0; i < c.cap; i++) st.setCell('buf', i, { v: s.buf[i] || '', cls: s.buf[i] ? 'filled' : 'empty', tags: (i === s.in ? 'in ' : '') + (i === s.out ? 'out' : '') });
      st.setText('sem', `Semáforo de espacios = ${s.sem.empty} · Semáforo de datos = ${s.sem.full} · Mutex: ${s.mutex ? 'ocupado por ' + who(s.mutex) : 'libre'}`);
      st.setText('info', `count = ${s.count}/${c.cap} · turno: ${s.done ? '—' : who(s.turn)}`);
      st.sub('prod', s.P.done ? 'Terminó' : 'Siguiente: ' + PROD[s.P.pc].code); st.sub('cons', s.C.done ? 'Terminó' : 'Siguiente: ' + CONS[s.C.pc].code);
    }
    apply(o) { super.apply(o); Object.entries(this.states()).forEach(([k, v]) => this.ctx.stage.setState(k, v)); this.draw(); }
    swap() { const s = this.s; s.turn = s.turn === 'P' ? 'C' : 'P'; s.q = s.turn === 'P' ? this.config.qp : this.config.qc; }
    exec() {
      const s = this.s, c = this.config, isP = s.turn === 'P', pr = isP ? s.P : s.C, m = (isP ? PROD : CONS)[pr.pc], name = isP ? 'Productor' : 'Consumidor';
      if (m.need && !m.need(s)) {
        pr.blocked = m.code; pr.blocks++; const reason = m.block(s); this.swap();
        return { cost: 1, status: 'wait', e: { what: `${name} intenta ${m.code} y queda bloqueado`, who: name, why: `No puede continuar: ${reason}.`, ifChanged: 'Más capacidad o distintas acciones por turno cambiarían cuándo ocurre este bloqueo.', result: 'No avanza; el planificador cede el turno al otro participante.', concept: m.concept } };
      }
      pr.blocked = null; const result = m.run(s, c); pr.pc++; let fin = false;
      if (pr.pc === 6) { pr.pc = 0; pr.cnt++; if (pr.cnt === pr.total) { pr.done = true; fin = true; } }
      if (s.count < 0 || s.count > c.cap || s.sem.empty < 0 || s.sem.full < 0) throw new Error('invariante violado');
      s.q--; if (s.q <= 0 || pr.done) this.swap();
      return { cost: 1, e: { what: `${name}: ${m.code}`, who: name + (m.cs ? ' (en sección crítica)' : ''), why: m.why, ifChanged: m.cs ? 'Sin el mutex, dos participantes podrían modificar índices y contador a la vez y dejarlos inconsistentes.' : 'Si el otro participante fuera más rápido, este paso se retrasaría o bloquearía.', result: result + (fin ? ` ${name} completó todo su trabajo.` : ''), concept: m.concept } };
    }
    *script() {
      const s = this.s; let guard = 0;
      while (!(s.P.done && s.C.done)) {
        if (++guard > 5000) throw new Error('sin progreso');
        if (s[s.turn].done) { this.swap(); continue; }
        const o = this.exec(); yield* this.go({ ...o, end: s.P.done && s.C.done });
      }
    }
    renderStats() {
      const s = this.s, c = this.config;
      this.ctx.stats.render([['Capacidad total', c.cap], ['Ocupación actual', `${s.count}/${c.cap}`], ['Espacios disponibles (semáforo)', s.sem.empty], ['Datos disponibles (semáforo)', s.sem.full], ['Mutex', s.mutex ? 'ocupado por ' + who(s.mutex) : 'libre'], ['Datos producidos', s.P.cnt], ['Datos consumidos', s.C.cnt], ['Operaciones bloqueadas (prod. / cons.)', `${s.P.blocks} / ${s.C.blocks}`], ['Pasos', s.steps]], null, NOTE);
    }
  }
  A.Simulations = A.Simulations || {}; A.Simulations.Sync = SyncSimulation;
})((window.ArqSim = window.ArqSim || {}));

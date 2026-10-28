/* Localidad temporal y espacial sobre una caché de un nivel con LRU. */
(function (A) {
  const { LruCache } = A.Utils;
  class Temporal extends A.Simulation {
    static get view() { return 'stage'; }
    constructor(ctx) {
      super(ctx);
      this.schema = [{ key: 'cap', label: 'Capacidad de la caché', min: 1, max: 8, value: 3 }, { key: 'reps', label: 'Veces que se accede a X', min: 1, max: 10, value: 5 }, { key: 'gap', label: 'Otros datos entre accesos a X', min: 0, max: 10, value: 1 }];
      this.config = Object.fromEntries(this.schema.map((f) => [f.key, f.value])); this.s = this.blank();
    }
    seq() { const { reps, gap } = this.config, q = []; let k = 0; for (let r = 0; r < reps; r++) { q.push('X'); for (let g = 0; g < gap; g++) q.push('Y' + ++k); } return q; }
    blank() { return { steps: 0, time: 0, acc: 0, hit: 0, xAcc: 0, xHit: 0, repl: 0, cache: new LruCache(this.config.cap) }; }
    validate() { const c = this.config; return ['cap', 'reps', 'gap'].every((k) => Number.isInteger(c[k])) && c.cap >= 1 && c.cap <= 8 && c.reps >= 1 && c.reps <= 10 && c.gap >= 0 && c.gap <= 10 ? null : 'Capacidad 1–8, accesos a X 1–10 y otros datos 0–10 (enteros).'; }
    onReset(starting) {
      this.s = this.blank(); const st = this.ctx.stage, q = this.seq(); st.clear();
      st.cells('cache', this.config.cap, st.row('Caché (más reciente → menos reciente)')); st.cells('hist', q.length, st.row('Historial de accesos')); st.text('info');
      q.forEach((_, i) => st.setCell('hist', i, { cls: 'mini empty' })); this.draw();
      if (!starting) this.ctx.expl.show({ what: 'Pulsa Iniciar: se accede varias veces al dato X con otros datos entre medias.', who: 'CPU y caché', why: 'Tras el primer acceso, X queda almacenado y los siguientes pueden ser hits.', ifChanged: 'Si entre dos accesos a X hay tantos datos distintos como la capacidad, X se reemplaza y vuelve el miss.', result: 'Simulación lista.', concept: 'Localidad temporal: un dato usado recientemente puede volver a usarse pronto.' });
      this.renderStats();
    }
    draw() { const l = this.s.cache; for (let i = 0; i < l.cap; i++) this.ctx.stage.setCell('cache', i, { v: l.items[i] || '', cls: l.items[i] ? 'filled lv1' : 'empty' }); }
    apply(o) { super.apply(o); this.draw(); }
    *script() {
      const s = this.s, q = this.seq(), cap = this.config.cap, gap = this.config.gap;
      for (let i = 0; i < q.length; i++) {
        const x = q[i], isX = x === 'X', hit = s.cache.has(x); s.acc++; if (isX) s.xAcc++;
        const out = hit ? (s.cache.touch(x), null) : s.cache.insert(x); if (hit) { s.hit++; if (isX) s.xHit++; } if (out) s.repl++;
        this.ctx.stage.setCell('hist', i, { v: x, cls: 'mini ' + (hit ? 'hit' : 'miss') });
        const why = hit ? 'X se usó antes y sigue en la caché: localidad temporal en acción.' : isX && s.xAcc === 1 ? 'Primer acceso a X: todavía no está en la caché (miss inicial); se guarda una copia.' : isX ? `X fue reemplazado: entre dos accesos hubo ${gap} dato(s) distintos y la capacidad es ${cap}.` : 'Dato nuevo: no estaba en la caché.';
        s.time = s.acc;
        yield* this.go({ end: i === q.length - 1, status: hit ? 'ok' : 'wait', e: { what: `Acceso a ${x}: ${hit ? 'hit' : 'miss'}`, who: 'CPU y caché', why, ifChanged: isX ? 'Aumentar la capacidad o reducir los datos intermedios haría más probables los hits de X.' : 'Más capacidad retendría más datos recientes.', result: `${out ? `Se reemplazó ${out} (LRU). ` : ''}Hits de X: ${s.xHit} de ${s.xAcc}.`, concept: 'La mejora depende de que el dato no haya sido reemplazado antes de reutilizarse.' } });
      }
    }
    renderStats() { const s = this.s, pc = (a, b) => (b ? (a * 100 / b).toFixed(1) + ' %' : '—'); this.ctx.stats.render([['Accesos totales', s.acc], ['Hits', s.hit], ['Misses', s.acc - s.hit], ['Tasa de aciertos', pc(s.hit, s.acc)], ['Accesos a X', s.xAcc], ['Hits en X', s.xHit], ['Tasa de aciertos en X', pc(s.xHit, s.xAcc)], ['Reemplazos', s.repl]], null, 'Modelo simplificado con una caché de un nivel y LRU.'); }
  }

  class Spatial extends A.Simulation {
    static get view() { return 'stage'; }
    constructor(ctx) {
      super(ctx); this.results = {};
      this.schema = [
        { key: 'pattern', label: 'Patrón de acceso', type: 'select', options: [['seq', 'Direcciones consecutivas'], ['stride', 'Saltos grandes (stride)']], value: 'seq' },
        { key: 'bs', label: 'Tamaño de bloque (direcciones)', type: 'select', options: [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8']], value: '4' },
        { key: 'cap', label: 'Capacidad (bloques)', min: 1, max: 8, value: 2 }, { key: 'stride', label: 'Salto (para stride)', min: 2, max: 16, value: 8 }, { key: 'n', label: 'Número de accesos', min: 4, max: 32, value: 16 },
      ];
      this.config = Object.fromEntries(this.schema.map((f) => [f.key, f.value])); this.s = this.blank();
    }
    get bs() { return Number(this.config.bs); }
    addr(i) { return this.config.pattern === 'seq' ? i % 32 : (i * this.config.stride) % 32; }
    blank() { return { steps: 0, time: 0, acc: 0, hit: 0, loads: 0, cur: -1, cache: new LruCache(this.config.cap) }; }
    validate() { const c = this.config; return ['cap', 'stride', 'n'].every((k) => Number.isInteger(c[k])) && c.cap >= 1 && c.cap <= 8 && c.stride >= 2 && c.stride <= 16 && c.n >= 4 && c.n <= 32 ? null : 'Capacidad 1–8, salto 2–16 y accesos 4–32 (enteros).'; }
    onReset(starting) {
      this.s = this.blank(); const st = this.ctx.stage; st.clear();
      st.cells('mem', 32, st.row('Memoria: direcciones 0–31 (resaltadas si su bloque está en la caché)')); st.cells('cache', this.config.cap, st.row('Caché: bloques cargados (más reciente → menos reciente)')); st.text('info'); this.draw();
      if (!starting) this.ctx.expl.show({ what: 'Elige el patrón y el tamaño de bloque, ejecuta y compara con otros tamaños.', who: 'CPU, memoria y caché', why: 'Un fallo carga un bloque entero; las direcciones vecinas pasan a estar en la caché.', ifChanged: 'Con bloque de 1 dirección no hay beneficio espacial; con bloques mayores, el patrón consecutivo mejora.', result: 'Simulación lista.', concept: 'Localidad espacial: es probable acceder a direcciones cercanas. Solo ayuda si el bloque y el patrón lo permiten.' });
      this.renderStats();
    }
    draw() {
      const st = this.ctx.stage, bs = this.bs, items = this.s.cache.items;
      for (let a = 0; a < 32; a++) st.setCell('mem', a, { v: a, cls: 'mini ' + (a === this.s.cur ? 'busy' : items.includes(Math.floor(a / bs)) ? 'filled' : 'empty'), tags: a % bs === 0 ? '│' : '' });
      for (let i = 0; i < this.config.cap; i++) { const b = items[i]; st.setCell('cache', i, { v: b === undefined ? '' : `B${b} [${b * bs}–${b * bs + bs - 1}]`, cls: 'wide ' + (b === undefined ? 'empty' : 'filled lv1') }); }
    }
    apply(o) { super.apply(o); this.draw(); }
    *script() {
      const c = this.config, s = this.s, bs = this.bs;
      for (let i = 0; i < c.n; i++) {
        const a = this.addr(i), b = Math.floor(a / bs), hit = s.cache.has(b); s.acc++; s.cur = a; s.time = s.acc;
        const out = hit ? (s.cache.touch(b), null) : (s.loads++, s.cache.insert(b)); if (hit) s.hit++;
        const why = hit ? `La dirección ${a} pertenece al bloque B${b}, que ya estaba cargado por un acceso anterior: localidad espacial.` : `La dirección ${a} (bloque B${b}) no estaba en la caché; se carga el bloque completo [${b * bs}–${b * bs + bs - 1}].`;
        yield* this.go({ end: i === c.n - 1, status: hit ? 'ok' : 'wait', e: { what: `Acceso a la dirección ${a}: ${hit ? 'hit' : 'miss'}`, who: 'CPU y caché', why, ifChanged: bs === 1 ? 'Con bloques de varias direcciones, los accesos consecutivos serían hits.' : 'Con otro patrón de saltos, cada acceso podría caer en un bloque distinto.', result: `${out !== null && out !== undefined ? `Se reemplazó el bloque B${out} (LRU). ` : ''}Hits: ${s.hit} de ${s.acc}.`, concept: 'Los accesos cercanos solo se benefician si el tamaño de bloque y el patrón de acceso lo permiten.' } });
      }
      this.results[`${c.pattern}-${bs}`] = { pattern: c.pattern === 'seq' ? 'Consecutivo' : `Salto ${c.stride}`, bs, rate: s.hit / s.acc }; this.renderStats();
    }
    renderStats() {
      const s = this.s, pc = (x) => (x * 100).toFixed(1) + ' %', rows = Object.values(this.results).sort((a, b) => a.pattern.localeCompare(b.pattern) || a.bs - b.bs);
      this.ctx.stats.render([['Accesos', s.acc], ['Hits', s.hit], ['Misses (bloques cargados)', s.loads], ['Tasa de aciertos', s.acc ? pc(s.hit / s.acc) : '—']], rows.length ? [['Patrón', 'Bloque', 'Tasa de aciertos'], ...rows.map((r) => [r.pattern, r.bs, pc(r.rate)])] : null, 'Modelo simplificado: una caché de un nivel con LRU y direcciones 0–31.');
    }
  }
  A.Simulations = A.Simulations || {}; A.Simulations.Temporal = Temporal; A.Simulations.Spatial = Spatial;
})((window.ArqSim = window.ArqSim || {}));

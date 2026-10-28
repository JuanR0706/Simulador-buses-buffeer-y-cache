/* Jerarquía de memoria: L1, L2, L3 y RAM con reemplazo LRU y política inclusiva simplificada. */
(function (A) {
  const { LruCache } = A.Utils;
  const NOTE = 'Modelo educativo simplificado: cada nivel usa LRU y, tras un hit en un nivel inferior o en la RAM, se guarda una copia en los niveles superiores. Las organizaciones y políticas reales varían entre arquitecturas. Cada tiempo es el tiempo total de acceso cuando el dato se encuentra en ese nivel.';
  const parse = (t) => String(t).split(/[\s,;]+/).filter(Boolean);

  class HierarchySimulation extends A.Simulation {
    static get view() { return 'stage'; }
    constructor(ctx) {
      super(ctx);
      this.schema = [
        { key: 'seq', label: 'Secuencia de accesos (separados por comas)', type: 'text', value: 'A, B, A, C, A, B, D, A' },
        { key: 'c1', label: 'Capacidad L1 (entradas)', min: 1, max: 16, value: 2 }, { key: 'c2', label: 'Capacidad L2', min: 1, max: 16, value: 3 }, { key: 'c3', label: 'Capacidad L3', min: 1, max: 16, value: 4 },
        { key: 't1', label: 'Tiempo L1 (ns)', min: 1, max: 1000, value: 2 }, { key: 't2', label: 'Tiempo L2 (ns)', min: 1, max: 1000, value: 6 },
        { key: 't3', label: 'Tiempo L3 (ns)', min: 1, max: 1000, value: 20 }, { key: 'tm', label: 'Tiempo RAM (ns)', min: 1, max: 1000, value: 60 },
      ];
      this.config = Object.fromEntries(this.schema.map((f) => [f.key, f.value])); this.s = this.blank();
    }
    blank() { const c = this.config; return { steps: 0, time: 0, acc: 0, hit: [0, 0, 0], ram: 0, repl: 0, ns: 0, L: [new LruCache(c.c1), new LruCache(c.c2), new LruCache(c.c3)] }; }
    validate() {
      const c = this.config, seq = parse(c.seq);
      if (!seq.length || seq.length > 40) return 'La secuencia debe tener entre 1 y 40 accesos.';
      if (seq.some((x) => !/^[A-Za-z0-9]{1,4}$/.test(x))) return 'Cada dato debe tener 1 a 4 letras o números (por ejemplo A, B, X1).';
      if (!['c1', 'c2', 'c3', 't1', 't2', 't3', 'tm'].every((k) => Number.isInteger(c[k]) && c[k] >= 1 && c[k] <= (k[0] === 'c' ? 16 : 1000))) return 'Capacidades 1–16 y tiempos 1–1000 ns, todos enteros.';
      return c.t1 <= c.t2 && c.t2 <= c.t3 && c.t3 <= c.tm ? null : 'Los tiempos deben cumplir L1 ≤ L2 ≤ L3 ≤ RAM.';
    }
    build() {
      const st = this.ctx.stage, c = this.config; st.clear(); st.actor('cpu', 'CPU', '🧠', st.row('', ''));
      [1, 2, 3].forEach((n) => { const r = st.row('', 'flow'); st.actor('l' + n, `Caché L${n}`, '⚡', r); st.sub('l' + n, `${c['t' + n]} ns · ${c['c' + n]} entradas`); st.cells('l' + n, c['c' + n], r); });
      st.actor('ram', 'Memoria RAM', '🧩', st.row('', '')); st.sub('ram', `${c.tm} ns · capacidad grande`); st.text('info'); this.draw();
    }
    draw() { this.s.L.forEach((l, k) => { for (let i = 0; i < l.cap; i++) this.ctx.stage.setCell('l' + (k + 1), i, { v: l.items[i] || '', cls: l.items[i] ? 'filled lv' + (k + 1) : 'empty', tags: l.items[i] ? (i === 0 ? 'MRU' : i === l.cap - 1 ? 'LRU' : '') : '' }); }); }
    onReset(starting) {
      this.s = this.blank(); this.build();
      if (!starting) this.ctx.expl.show({ what: 'Escribe una secuencia de accesos y pulsa Iniciar o Paso siguiente.', who: 'CPU, L1, L2, L3 y RAM', why: 'Cada acceso busca el dato nivel por nivel; los datos recientes quedan cerca de la CPU.', ifChanged: 'Con L1 más pequeña habrá más fallos en L1 y más reemplazos.', result: 'Simulación lista.', concept: NOTE });
      this.renderStats();
    }
    apply(o) { super.apply(o); this.draw(); }
    *script() {
      const c = this.config, s = this.s, seq = parse(c.seq), T = [c.t1, c.t2, c.t3, c.tm], idle = { cpu: 'busy', l1: 'idle', l2: 'idle', l3: 'idle', ram: 'idle' };
      for (let i = 0; i < seq.length; i++) {
        const x = seq[i], last = i === seq.length - 1; s.acc++;
        yield* this.go({ states: idle, e: { what: `La CPU solicita el dato ${x} (acceso ${i + 1} de ${seq.length})`, who: 'CPU', why: 'Necesita el dato; primero lo busca en la caché más cercana.', ifChanged: 'Repetir el dato pronto aumenta la probabilidad de un hit.', result: 'Búsqueda en L1.', concept: 'El procesador consulta primero el nivel más rápido.' } });
        let found = -1;
        for (let L = 0; L < 3 && found < 0; L++) {
          if (s.L[L].has(x)) {
            s.L[L].touch(x); found = L; s.hit[L]++; s.ns += T[L]; s.time = s.ns;
            yield* this.go({ end: last && L === 0, status: 'ok', states: { ['l' + (L + 1)]: 'hit' }, e: { what: `L${L + 1}: hit para el dato ${x}`, who: `Caché L${L + 1}`, why: 'El dato ya estaba almacenado en este nivel; no hace falta consultar los siguientes.', ifChanged: `Con un tiempo de L${L + 1} menor, el acceso sería aún más rápido.`, result: `Dato entregado en ${T[L]} ns.${L > 0 ? ' Se copiará a los niveles superiores.' : ''}`, concept: 'Hit: el dato solicitado se encuentra en la caché consultada.' } });
          } else {
            const nxt = L < 2 ? `L${L + 2}` : 'la RAM';
            yield* this.go({ status: 'wait', states: { ['l' + (L + 1)]: 'miss' }, e: { what: `L${L + 1}: miss para el dato ${x}`, who: `Caché L${L + 1}`, why: 'El dato no está en este nivel (nunca se cargó o fue reemplazado).', ifChanged: `Con mayor capacidad en L${L + 1}, el dato podría seguir almacenado.`, result: `Se consulta ${nxt}.`, concept: 'Miss: el dato no está en esa caché y se busca en otro nivel del modelo, no necesariamente en la RAM.' } });
          }
        }
        if (found < 0) { s.ram++; s.ns += T[3]; s.time = s.ns; yield* this.go({ states: { ram: 'hit' }, e: { what: `RAM: dato ${x} obtenido tras fallar en L1, L2 y L3`, who: 'Memoria RAM', why: 'Ninguna caché lo tenía; solo la RAM conserva el dato.', ifChanged: 'Con una RAM más lenta, cada fallo completo costaría más.', result: `Dato entregado en ${T[3]} ns.`, concept: 'Un fallo completo es el caso más costoso de la jerarquía.' } }); }
        const upto = found < 0 ? 3 : found, ev = [], lv = [];
        for (let L = upto - 1; L >= 0; L--) { const out = s.L[L].insert(x); lv.push('L' + (L + 1)); if (out) { s.repl++; ev.push(`L${L + 1}: se reemplaza ${out} (el menos recientemente usado, LRU)`); } }
        if (upto > 0) yield* this.go({ end: last, states: Object.fromEntries(lv.map((n) => [n.toLowerCase(), 'done'])), e: { what: `Se guarda una copia de ${x} en ${lv.reverse().join(', ')}`, who: 'Jerarquía de cachés', why: 'Un acceso futuro al mismo dato podría resolverse en un nivel más rápido (localidad temporal).', ifChanged: 'Si no se guardara la copia, cada acceso repetido volvería a ser lento.', result: ev.length ? ev.join('. ') + '.' : 'Había espacio libre: no se reemplazó nada.', concept: 'Reemplazo LRU: sale el dato usado hace más tiempo cuando el nivel está lleno.' } });
      }
    }
    renderStats() {
      const s = this.s, c = this.config, a = s.acc, hits = s.hit[0] + s.hit[1] + s.hit[2], pc = (x) => (a ? (x * 100 / a).toFixed(1) + ' %' : '—');
      this.ctx.stats.render([['Accesos totales', a], ['Hits (en alguna caché)', hits], ['Misses (llegaron a la RAM)', s.ram], ['Hits por nivel L1 / L2 / L3', s.hit.join(' / ')], ['Tasa de aciertos (cachés)', pc(hits)], ['Tasa de fallos', pc(s.ram)], ['Tasa de aciertos solo en L1', pc(s.hit[0])], ['Reemplazos', s.repl], ['Tiempo efectivo de acceso estimado', a ? (s.ns / a).toFixed(2) + ' ns' : '—'], ['Sin cachés (solo RAM)', c.tm + ' ns']], null, NOTE);
    }
  }
  A.Simulations = A.Simulations || {}; A.Simulations.Hierarchy = HierarchySimulation;
})((window.ArqSim = window.ArqSim || {}));

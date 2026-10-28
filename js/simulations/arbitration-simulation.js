/* Arbitraje: varios dispositivos compiten por un recurso compartido. La exclusión mutua se verifica en la lógica. */
(function (A) {
  const { fmt } = A.Utils; const GRANT = 5, STARVE = 3;
  const NOTE = 'Modelo didáctico simplificado: no representa un protocolo de arbitraje real concreto. El arbitraje evita que dos participantes usen a la vez el mismo recurso de forma incompatible (por ejemplo, escrituras que se mezclarían).';
  const NAMES = [1, 2, 3, 4];

  class ArbitrationSimulation extends A.Simulation {
    static get layout() {
      return { bus: { x: 30, y: 192, w: 740 }, nodes: [
        { id: 'arbiter', label: 'Árbitro del bus', icon: '⚖', x: 90, y: 30, w: 200, h: 70 },
        { id: 'ram', label: 'Recurso compartido', icon: '🧩', x: 510, y: 30, w: 200, h: 70 },
        ...NAMES.map((i) => ({ id: 'd' + i, label: 'Disp. ' + i, icon: '🎛', x: 30 + (i - 1) * 195, y: 310, w: 155, h: 70 }))] };
    }
    constructor(ctx) {
      super(ctx);
      this.schema = [
        { key: 'mode', label: 'Tipo de arbitraje', type: 'select', options: [['central', 'Centralizado'], ['dist', 'Distribuido (modelo simplificado)']], value: 'central' },
        { key: 'policy', label: 'Política', type: 'select', options: [['priority', 'Prioridad fija'], ['rr', 'Turno rotativo (equidad)']], value: 'priority' },
        ...NAMES.map((i) => ({ key: 'p' + i, label: `Prioridad Disp. ${i} (mayor = más prioritario)`, min: 1, max: 9, value: 5 - i })),
        { key: 'demand', label: 'Solicitudes por dispositivo', min: 1, max: 6, value: 3 },
      ];
      this.config = Object.fromEntries(this.schema.map((f) => [f.key, f.value])); this.s = this.blank();
    }
    blank() { return { steps: 0, time: 0, grants: 0, round: 0, holder: null, rem: NAMES.map(() => this.config.demand), waitNow: [0, 0, 0, 0], waitTot: [0, 0, 0, 0], history: [], warn: '' }; }
    validate() {
      const c = this.config;
      if (![c.p1, c.p2, c.p3, c.p4, c.demand].every(Number.isInteger)) return 'Las prioridades y las solicitudes deben ser enteros.';
      if ([c.p1, c.p2, c.p3, c.p4].some((p) => p < 1 || p > 9)) return 'Las prioridades van de 1 a 9.';
      return c.demand < 1 || c.demand > 6 ? 'Las solicitudes por dispositivo van de 1 a 6.' : null;
    }
    onReset(starting) {
      this.s = this.blank();
      if (!starting) this.ctx.expl.show({ what: 'Configura prioridades y política, y pulsa Iniciar.', who: 'Árbitro y dispositivos', why: 'Cuatro dispositivos solicitarán el bus a la vez; solo uno puede usarlo cada vez.', ifChanged: 'Con prioridad fija y alta demanda, un dispositivo de baja prioridad puede esperar mucho (inanición).', result: 'Simulación lista.', concept: NOTE });
      this.renderStats();
    }
    pick(req, rr) {                                // reglas de decisión (separadas de la presentación)
      const p = [this.config.p1, this.config.p2, this.config.p3, this.config.p4];
      if (this.config.policy === 'rr') { for (let k = 1; k <= 4; k++) { const i = (rr + k) % 4; if (req.includes(i)) return i; } }
      return req.reduce((b, i) => (p[i] > p[b] ? i : b), req[0]);
    }
    *script() {
      const c = this.config, s = this.s, central = c.mode === 'central', d = this.ctx.diagram; let rr = -1;
      s.rem = NAMES.map(() => c.demand);
      if (!central) d.setState('arbiter', 'off');
      while (s.rem.some((r) => r > 0)) {
        s.round++;
        const req = [0, 1, 2, 3].filter((i) => s.rem[i] > 0), st = {};
        [0, 1, 2, 3].forEach((i) => { st['d' + (i + 1)] = s.rem[i] > 0 ? 'requesting' : 'done'; });
        yield* this.go({ states: st, e: { what: `Ronda ${s.round}: ${req.length} dispositivos solicitan el bus a la vez`, who: req.map((i) => 'Disp. ' + (i + 1)).join(', '), why: 'Cada uno tiene datos pendientes, pero el recurso admite un solo usuario.', ifChanged: 'Con menos solicitantes habría menos competencia.', result: `${req.length} solicitudes simultáneas pendientes.`, concept: 'Solicitudes simultáneas sobre un recurso compartido' } });
        const w = this.pick(req, rr), losers = req.filter((i) => i !== w);
        if (central) yield* this.go({ states: { arbiter: 'busy' }, e: { what: `El árbitro evalúa las solicitudes (${c.policy === 'rr' ? 'turno rotativo' : 'prioridad fija'})`, who: 'Árbitro del bus', why: 'Un único punto central decide a quién se concede el recurso.', ifChanged: 'Cambiar las prioridades cambia al ganador.', result: `Elegido: Disp. ${w + 1}.`, concept: 'Arbitraje centralizado' } });
        else for (const l of losers) yield* this.go({ states: { ['d' + (l + 1)]: 'waiting' }, e: { what: `Disp. ${l + 1} compara su criterio con el de los demás y cede el turno`, who: 'Disp. ' + (l + 1), why: 'En este modelo, los participantes determinan entre sí quién usa el recurso.', ifChanged: 'Con otra prioridad podría ser él quien siga compitiendo.', result: `Disp. ${l + 1} queda en espera.`, concept: 'Arbitraje distribuido (modelo didáctico simplificado)' } });
        if (s.holder !== null) throw new Error('Violación de exclusión mutua');
        s.holder = w; rr = w;
        losers.forEach((l) => { s.waitNow[l]++; s.waitTot[l]++; });
        const starving = losers.filter((l) => s.waitNow[l] >= STARVE);
        s.warn = starving.length ? `Posible inanición: ${starving.map((l) => `Disp. ${l + 1} (${s.waitNow[l]} rondas)`).join(', ')}.` : '';
        const ls = {}; losers.forEach((l) => { ls['d' + (l + 1)] = 'waiting'; });
        yield* this.go({ cost: GRANT, packet: ['d' + (w + 1), 'ram'], states: { ...ls, ['d' + (w + 1)]: 'transferring', ram: 'transferring', ...(central ? { arbiter: 'busy' } : {}) }, status: s.warn ? 'wait' : 'info', e: { what: `Se concede el bus a Disp. ${w + 1}`, who: central ? `Árbitro y Disp. ${w + 1}` : `Disp. ${w + 1} y los demás participantes`, why: c.policy === 'rr' ? 'El turno rotativo reparte el recurso por igual.' : 'Tiene la mayor prioridad entre los solicitantes.', ifChanged: 'Con turno rotativo nadie esperaría indefinidamente.', result: `Solo Disp. ${w + 1} usa el recurso; ${losers.length} esperan.${s.warn ? ' ADVERTENCIA: ' + s.warn : ''}`, concept: 'Exclusión mutua: un único usuario autorizado a la vez' } });
        s.rem[w]--; s.waitNow[w] = 0; s.grants++; s.history.push('D' + (w + 1));
        const last = s.rem.every((r) => r === 0);
        if (s.holder !== w) throw new Error('Violación de exclusión mutua'); s.holder = null;
        yield* this.go({ end: last, status: last ? 'ok' : 'info', states: { ['d' + (w + 1)]: s.rem[w] ? 'idle' : 'done', ram: 'idle', ...(central ? { arbiter: 'idle' } : {}) }, e: { what: `Disp. ${w + 1} libera el bus`, who: 'Disp. ' + (w + 1), why: 'Al liberar, otro solicitante puede ser autorizado.', ifChanged: 'Si no liberara, los demás quedarían bloqueados.', result: last ? `Todas las solicitudes fueron atendidas (${s.grants} concesiones).` : `Quedan ${s.rem.reduce((a, b) => a + b, 0)} solicitudes pendientes.`, concept: 'Liberación del recurso' } });
      }
    }
    renderStats() {
      const s = this.s, pend = s.rem.reduce((a, b) => a + b, 0);
      this.ctx.stats.render([['Ronda', s.round], ['Concesiones', s.grants], ['Solicitudes pendientes', pend], ['Dispositivo autorizado', s.holder === null ? 'ninguno' : 'Disp. ' + (s.holder + 1)], ['Espera acumulada (rondas)', s.waitTot.map((w, i) => `D${i + 1}: ${w}`).join(' · ')], ['Tiempo simulado', fmt.ms(s.time)], ['Historial de concesiones', s.history.slice(-12).join(', ') || '—'], ['Advertencia', s.warn || 'ninguna']], null, NOTE);
    }
  }
  A.Simulations = A.Simulations || {}; A.Simulations.Arbitration = ArbitrationSimulation;
})((window.ArqSim = window.ArqSim || {}));

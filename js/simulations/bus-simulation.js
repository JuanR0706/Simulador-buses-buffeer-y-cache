/* Módulo 1: E/S programada frente a DMA. Costes en milisegundos simulados. */
(function (A) {
  const { fmt } = A.Utils; const C = 2; // coste de un paso de control
  const NOTE = 'Los tiempos son estimaciones didácticas, no mediciones de hardware. DMA reduce la intervención directa de la CPU en el movimiento de los datos, pero el resultado depende del dispositivo, la configuración y la contención por los recursos compartidos: no siempre es más rápido.';
  const LAYOUT = {
    bus: { x: 30, y: 192, w: 740 },
    nodes: [
      { id: 'cpu', label: 'CPU', icon: '🧠', x: 40, y: 30, w: 170, h: 70 },
      { id: 'arbiter', label: 'Árbitro del bus', icon: '⚖', x: 315, y: 30, w: 170, h: 70 },
      { id: 'ram', label: 'Memoria RAM', icon: '🧩', x: 590, y: 30, w: 170, h: 70 },
      { id: 'io', label: 'Dispositivo E/S', icon: '💾', x: 40, y: 310, w: 170, h: 70 },
      { id: 'dma', label: 'Controlador DMA', icon: '🔁', x: 315, y: 310, w: 170, h: 70 },
    ],
  };

  class BusSimulation extends A.Simulation {
    constructor(ctx) {
      super(ctx); this.results = {};
      this.schema = [
        { key: 'mode', label: 'Modalidad', type: 'select', options: [['prog', 'E/S programada (CPU)'], ['dma', 'DMA']], value: 'prog' },
        { key: 'total', label: 'Datos totales (KB)', min: 1, max: 256, value: 8 },
        { key: 'block', label: 'Tamaño de bloque (KB)', min: 1, max: 64, value: 2 },
        { key: 'rate', label: 'Tiempo simulado por bloque (ms)', min: 1, max: 1000, value: 50 },
      ];
      this.config = Object.fromEntries(this.schema.map((f) => [f.key, f.value]));
      this.s = this.blank();
    }
    static get layout() { return LAYOUT; }
    blank() { return { steps: 0, time: 0, cpuBusy: 0, cpuFree: 0, tasks: 0, done: 0 }; }
    validate() {
      const { total, block, rate } = this.config;
      if (![total, block, rate].every(Number.isInteger)) return 'Escribe números enteros en todos los campos.';
      if (total < 1 || block < 1 || rate < 1) return 'Los valores deben ser mayores que cero.';
      if (block > total) return 'El bloque no puede ser mayor que los datos totales.';
      if (Math.ceil(total / block) > 64) return 'Hay más de 64 bloques: aumenta el tamaño de bloque o reduce los datos.';
      return null;
    }
    onReset(starting) {
      this.s = this.blank();
      if (!starting) this.ctx.expl.show({ what: 'Elige la modalidad y pulsa Iniciar o Paso siguiente.', who: 'Bus del sistema', why: 'El bus es el camino compartido por el que viajan solicitudes, concesiones y datos.', ifChanged: 'Prueba la misma configuración en E/S programada y en DMA, y compara los resultados.', result: 'Simulación lista.', concept: 'Mecanismos de transferencia de datos' });
      this.renderStats();
    }
    apply(o) {
      if (o.cpu) this.s.cpuBusy += o.cost || 0;
      if (o.free) { this.s.cpuFree += o.cost || 0; this.s.tasks++; }
      super.apply(o);
    }
    finish(mode = this.config.mode) {
      const s = this.s;
      this.results[mode] = { steps: s.steps, time: s.time, cpu: s.time ? s.cpuBusy / s.time : 0, free: s.cpuFree, transfers: s.done };
      this.renderStats();
    }
    *script() {
      const { mode, total, block, rate: t } = this.config, n = Math.ceil(total / block), d = this.ctx.diagram;
      if (mode === 'prog') {
        d.setState('dma', 'off'); d.setState('arbiter', 'off');
        yield* this.go({ cost: C, cpu: true, states: { io: 'requesting', cpu: 'waiting' }, e: { what: 'El dispositivo solicita una transferencia', who: 'Dispositivo de E/S', why: 'Tiene datos listos y necesita que el sistema los atienda.', ifChanged: 'Con más datos habrá más bloques que la CPU deberá copiar.', result: 'Solicitud pendiente.', concept: 'E/S programada: la CPU gestiona cada operación' } });
        yield* this.go({ cost: C, cpu: true, states: { cpu: 'busy', io: 'waiting' }, e: { what: 'La CPU atiende la operación', who: 'CPU', why: 'En E/S programada la CPU dirige y ejecuta la copia.', ifChanged: 'Una CPU más ocupada tardaría más en atender la solicitud.', result: 'La CPU queda dedicada a la transferencia.', concept: 'Participación de la CPU' } });
        for (let i = 1; i <= n; i++) {
          yield* this.go({ cost: t, cpu: true, packet: ['io', 'cpu'], states: { io: 'transferring', cpu: 'busy' }, e: { what: `La CPU lee el bloque ${i} de ${n} del dispositivo`, who: 'CPU y dispositivo', why: 'Los datos deben pasar por la CPU antes de llegar a la memoria.', ifChanged: 'Con bloques más grandes habría menos pasos, pero cada uno costaría más.', result: `Bloque ${i} en un registro de la CPU.`, concept: 'Copia dato a dato por la CPU' } });
          yield* this.go({ cost: t, cpu: true, packet: ['cpu', 'ram'], states: { ram: 'transferring', io: 'waiting' }, e: { what: `La CPU escribe el bloque ${i} en la RAM`, who: 'CPU y memoria RAM', why: 'Completa la copia hacia su destino.', ifChanged: 'Si la RAM fuera más lenta, la CPU esperaría más en cada escritura.', result: `${i} de ${n} bloques almacenados.`, concept: 'La CPU ocupada mientras dura la transferencia' } });
          this.s.done = i;
        }
        yield* this.go({ cost: C, cpu: true, states: { ram: 'done', io: 'done', cpu: 'busy' }, e: { what: 'Se actualiza el estado de la transferencia', who: 'CPU', why: 'El sistema registra que los datos ya están en memoria.', ifChanged: 'Sin este registro, el programa no sabría que puede usar los datos.', result: 'Estado: transferencia completa.', concept: 'Sincronización con el dispositivo' } });
        yield* this.go({ cost: C, cpu: true, states: { cpu: 'done' }, status: 'ok', end: true, e: { what: 'La operación finaliza', who: 'CPU', why: 'Todos los bloques fueron copiados.', ifChanged: 'Repite en modo DMA con los mismos datos para comparar.', result: `${total} KB transferidos en ${fmt.ms(this.s.time + C)} simulados.`, concept: 'La CPU no pudo hacer otras tareas útiles durante el proceso' } });
        return;
      }
      yield* this.go({ cost: C, cpu: true, states: { cpu: 'busy', dma: 'waiting' }, e: { what: 'La CPU configura la transferencia DMA', who: 'CPU', why: 'El DMA necesita saber origen, destino y cantidad.', ifChanged: 'Más datos no cambian la configuración, solo el trabajo del DMA.', result: `Origen: dispositivo · Destino: RAM · ${total} KB en ${n} bloques de ${block} KB.`, concept: 'Delegar la transferencia en un controlador' } });
      yield* this.go({ cost: C, free: true, states: { cpu: 'other', dma: 'requesting', arbiter: 'waiting' }, e: { what: 'El DMA solicita acceso al bus', who: 'Controlador DMA', why: 'El bus es un recurso compartido; hay que pedirlo.', ifChanged: 'Con más dispositivos solicitando, la espera sería mayor.', result: 'Solicitud enviada al árbitro. La CPU pasa a otra tarea.', concept: 'Solicitud de acceso al bus' } });
      yield* this.go({ cost: C, free: true, states: { arbiter: 'busy', dma: 'transferring', io: 'waiting' }, e: { what: 'El árbitro concede el bus al DMA', who: 'Árbitro del bus', why: 'Decide qué solicitud se atiende cuando varias compiten.', ifChanged: 'Una política de prioridades distinta podría atender antes a otro dispositivo.', result: 'Acceso concedido.', concept: 'Arbitraje del bus' } });
      for (let i = 1; i <= n; i++) {
        yield* this.go({ cost: t, free: true, packet: ['io', 'ram'], states: { io: 'transferring', ram: 'transferring', dma: 'transferring', cpu: 'other' }, e: { what: `El DMA transfiere el bloque ${i} de ${n} a la RAM`, who: 'Controlador DMA, dispositivo y RAM', why: 'Mueve los datos sin pasar por la CPU.', ifChanged: 'Un tiempo por bloque mayor alargaría la transferencia, pero la CPU seguiría libre.', result: `Bloque ${i} almacenado. La CPU completó otra tarea.`, concept: 'Procesamiento paralelo con DMA' } });
        this.s.done = i;
      }
      yield* this.go({ cost: C, cpu: true, states: { dma: 'done', arbiter: 'idle', cpu: 'busy', io: 'done', ram: 'done' }, e: { what: 'El DMA indica que la operación terminó', who: 'Controlador DMA', why: 'La CPU debe enterarse de que los datos ya están listos.', ifChanged: 'Sin interrupción, la CPU tendría que consultar el estado periódicamente.', result: 'Interrupción enviada a la CPU.', concept: 'Interrupción de finalización' } });
      yield* this.go({ cost: C, cpu: true, states: { cpu: 'done' }, status: 'ok', end: true, e: { what: 'La CPU atiende la interrupción y cierra la operación', who: 'CPU', why: 'Confirma el resultado y libera el recurso.', ifChanged: 'Ejecuta el modo programado con los mismos datos para comparar.', result: `${total} KB transferidos; la CPU tuvo ${fmt.ms(this.s.cpuFree)} libres.`, concept: 'La CPU participa al inicio y al final, no en cada dato' } });
    }
    renderStats() {
      const s = this.s, c = this.config, n = Math.ceil(c.total / c.block) || 0, r = this.results;
      const rows = [['Modalidad', c.mode === 'dma' ? 'DMA' : 'E/S programada'], ['Pasos', s.steps], ['Tiempo simulado', fmt.ms(s.time)], ['Bloques transferidos', `${s.done} de ${n}`], ['CPU ocupada en la transferencia', s.time ? fmt.pct(s.cpuBusy / s.time) : '—'], ['CPU libre', fmt.ms(s.cpuFree)], ['Tareas de la CPU durante la transferencia', s.tasks]];
      const cell = (m, f) => (r[m] ? f(r[m]) : '—');
      const cmp = [['Métrica', 'E/S programada', 'DMA'], ['Pasos', cell('prog', (x) => x.steps), cell('dma', (x) => x.steps)], ['Transferencias realizadas', cell('prog', (x) => x.transfers), cell('dma', (x) => x.transfers)], ['Participación de la CPU', cell('prog', (x) => fmt.pct(x.cpu)), cell('dma', (x) => fmt.pct(x.cpu))], ['Tiempo simulado', cell('prog', (x) => fmt.ms(x.time)), cell('dma', (x) => fmt.ms(x.time))]];
      this.ctx.stats.render(rows, cmp, NOTE);
    }
  }
  A.Simulations = A.Simulations || {}; A.Simulations.Bus = BusSimulation;
})((window.ArqSim = window.ArqSim || {}));

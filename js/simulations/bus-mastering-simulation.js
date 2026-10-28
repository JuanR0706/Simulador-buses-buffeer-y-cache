/* Bus mastering: un dispositivo autorizado inicia transacciones. No es lo mismo que DMA (técnica de transferencia). */
(function (A) {
  const { fmt } = A.Utils; const C = 2;
  const DEV = [['disk', 'Controlador de disco'], ['net', 'Tarjeta de red'], ['gpu', 'Tarjeta gráfica']];
  const TERM = 'Terminología: iniciador es el componente que comienza la transacción y destino el que responde; otras fuentes los llaman «maestro» y «esclavo».';
  const NOTE = 'DMA es una técnica de transferencia de datos; bus mastering es la capacidad de un componente de iniciar transacciones en el bus. Están relacionados, pero no son equivalentes.';

  class MasteringSimulation extends A.Simulation {
    static get layout() {
      return { bus: { x: 30, y: 192, w: 740 }, nodes: [
        { id: 'cpu', label: 'CPU', icon: '🧠', x: 40, y: 30, w: 170, h: 70 },
        { id: 'arbiter', label: 'Árbitro del bus', icon: '⚖', x: 315, y: 30, w: 170, h: 70 },
        { id: 'ram', label: 'Destino: RAM', icon: '🧩', x: 590, y: 30, w: 170, h: 70 },
        { id: 'dev', label: 'Iniciador', icon: '🎛', x: 315, y: 310, w: 170, h: 70 }] };
    }
    constructor(ctx) {
      super(ctx);
      this.schema = [
        { key: 'device', label: 'Dispositivo iniciador', type: 'select', options: DEV, value: 'disk' },
        { key: 'n', label: 'Transacciones a iniciar', min: 1, max: 16, value: 4 },
        { key: 'rate', label: 'Tiempo simulado por transacción (ms)', min: 1, max: 1000, value: 50 },
      ];
      this.config = Object.fromEntries(this.schema.map((f) => [f.key, f.value])); this.s = this.blank();
    }
    blank() { return { steps: 0, time: 0, tx: 0, cpuTime: 0, phase: '—' }; }
    validate() {
      const { n, rate } = this.config;
      if (![n, rate].every(Number.isInteger) || n < 1 || rate < 1) return 'Escribe enteros mayores que cero.';
      return n > 16 ? 'El máximo es 16 transacciones.' : null;
    }
    onReset(starting) {
      this.s = this.blank();
      if (!starting) this.ctx.expl.show({ what: 'Elige el dispositivo iniciador y pulsa Iniciar o Paso siguiente.', who: 'Dispositivo, árbitro y RAM', why: 'Se verán cuatro fases: solicitar, obtener autorización, iniciar y finalizar.', ifChanged: 'Más transacciones alargan la fase 3; las fases 1, 2 y 4 no cambian.', result: 'Simulación lista.', concept: TERM });
      this.renderStats();
    }
    apply(o) { if (o.cpu) this.s.cpuTime += o.cost || 0; if (o.phase) this.s.phase = o.phase; super.apply(o); }
    *script() {
      const { device, n, rate: t } = this.config, name = DEV.find((d) => d[0] === device)[1];
      yield* this.go({ cost: C, cpu: true, phase: 'Preparación', states: { cpu: 'busy', dev: 'waiting' }, e: { what: `La CPU habilita a «${name}» para actuar como iniciador`, who: 'CPU', why: 'Un dispositivo solo debe escribir en memoria si el sistema lo autoriza y le delimita la zona.', ifChanged: 'Sin esta autorización, el acceso a la RAM sería un riesgo para el sistema.', result: 'Dispositivo autorizado a competir por el bus.', concept: 'Autorización y control de acceso a memoria' } });
      yield* this.go({ cost: C, phase: '1 de 4 · Solicitar', states: { cpu: 'other', dev: 'requesting', arbiter: 'waiting' }, e: { what: 'Fase 1 de 4 · El dispositivo solicita una transferencia', who: name, why: 'Quiere iniciar transacciones, pero el bus es compartido: primero debe pedirlo.', ifChanged: 'Si otro componente tuviera el bus, esta solicitud tendría que esperar.', result: 'Solicitud registrada; todavía no puede usar el bus.', concept: 'Solicitar no es lo mismo que estar autorizado. ' + TERM } });
      yield* this.go({ cost: C, phase: '2 de 4 · Autorización', states: { arbiter: 'busy', dev: 'transferring' }, e: { what: 'Fase 2 de 4 · El árbitro concede la autorización', who: 'Árbitro del bus', why: 'Garantiza que un solo iniciador use el bus a la vez.', ifChanged: 'Con otro iniciador de mayor prioridad, la concesión llegaría más tarde.', result: 'El dispositivo es ahora el iniciador del bus.', concept: 'Obtener autorización es distinto de iniciar la transferencia' } });
      for (let i = 1; i <= n; i++) {
        this.s.tx = i - 1;
        yield* this.go({ cost: t, phase: '3 de 4 · Iniciar', packet: ['dev', 'ram'], states: { dev: 'transferring', ram: 'transferring' }, e: { what: `Fase 3 de 4 · El iniciador comienza la transacción ${i} de ${n}`, who: `${name} (iniciador) y RAM (destino)`, why: 'Escribe directamente en memoria sin que la CPU dirija cada dato.', ifChanged: 'Un tiempo mayor por transacción alarga esta fase, no la intervención de la CPU.', result: `La RAM, como destino, aceptó la transacción ${i}.`, concept: 'Bus mastering: la capacidad de iniciar transacciones' } });
        this.s.tx = i;
      }
      yield* this.go({ cost: C, cpu: true, end: true, status: 'ok', phase: '4 de 4 · Finalizar', states: { dev: 'done', ram: 'done', arbiter: 'idle', cpu: 'busy' }, e: { what: 'Fase 4 de 4 · La operación finaliza y el bus se libera', who: 'Dispositivo y CPU', why: 'El iniciador libera el recurso para que otros puedan usarlo y avisa a la CPU.', ifChanged: 'Sin liberar el bus, los demás componentes quedarían bloqueados.', result: `${n} transacciones completadas en ${fmt.ms(this.s.time + C)} simulados.`, concept: NOTE } });
    }
    renderStats() {
      const s = this.s, n = this.config.n;
      this.ctx.stats.render([['Fase actual', s.phase], ['Pasos', s.steps], ['Tiempo simulado', fmt.ms(s.time)], ['Transacciones iniciadas', `${s.tx} de ${n}`], ['Intervención de la CPU', fmt.ms(s.cpuTime)], ['Participación de la CPU', s.time ? fmt.pct(s.cpuTime / s.time) : '—']], null, NOTE);
    }
  }
  A.Simulations = A.Simulations || {}; A.Simulations.Mastering = MasteringSimulation;
})((window.ArqSim = window.ArqSim || {}));

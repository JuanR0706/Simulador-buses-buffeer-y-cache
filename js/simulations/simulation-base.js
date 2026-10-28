/* Motor genérico: ciclo de vida, velocidad y paso a paso. Cada módulo implementa *script() como generador:
   cada `yield` es exactamente una transición. La velocidad solo cambia el intervalo, nunca el resultado. */
(function (A) {
  const SPEEDS = { slow: 3500, normal: 2000, fast: 1000 }; // ms entre pasos
  class Simulation {
    constructor(ctx) { this.ctx = ctx; this.status = 'idle'; this.speed = SPEEDS.normal; this.timer = null; this.gen = null; this.listeners = []; this.schema = []; this.config = {}; }
    on(fn) { this.listeners.push(fn); }
    emit() { this.listeners.forEach((f) => f(this.status)); }
    setSpeed(k) { this.speed = SPEEDS[k] || SPEEDS.normal; }
    setConfig(values) { this.config = { ...this.config, ...values }; }
    validate() { return null; }
    *script() {}
    finish() {}
    renderStats() {}
    get packetMs() { return this.speed * 0.7; }
    /* Transición genérica: cuenta paso y tiempo, y delega la presentación. Los módulos extienden apply() para sus métricas. */
    apply(o) { this.s.steps++; this.s.time += o.cost || 0; this.emitStep(o); }
    emitStep({ states = {}, packet, e, status = 'info' }) {
      const s = this.s, d = this.ctx.diagram;
      Object.entries(states).forEach(([id, st]) => d.setState(id, st));
      if (packet) d.movePacket(packet[0], packet[1], this.packetMs);
      this.ctx.expl.show(e); this.ctx.expl.log(s.steps, e.what, status, { time: A.Utils.fmt.ms(s.time), who: e.who }); this.renderStats();
    }
    *go(o) { this.apply(o); if (o.end) this.finish(); yield o.end ? 'end' : undefined; }
    onReset() {}
    prepare() {
      const err = this.validate();
      if (err) { this.ctx.expl.error(err); return false; }
      this.ctx.expl.clearLog(); this.ctx.diagram.resetAll(); this.onReset(true);
      this.gen = this.script(); return true;
    }
    start() {                                  // no admite ejecuciones simultáneas
      if (this.status !== 'idle' || !this.prepare()) return;
      this.status = 'running'; this.emit(); this.loop();
    }
    loop() {
      clearTimeout(this.timer);
      if (this.status !== 'running') return;
      this.tick();
      if (this.status === 'running') this.timer = setTimeout(() => this.loop(), this.speed);
    }
    tick() { const r = this.gen.next(); if (r.done || r.value === 'end') { this.status = 'finished'; this.emit(); } }
    step() {
      if (this.status === 'idle') { if (!this.prepare()) return; this.status = 'paused'; }
      if (this.status !== 'paused') return;
      this.tick(); this.emit();
    }
    pause() { if (this.status === 'running') { clearTimeout(this.timer); this.status = 'paused'; this.emit(); } }
    resume() { if (this.status === 'paused') { this.status = 'running'; this.emit(); this.loop(); } }
    reset() { clearTimeout(this.timer); this.gen = null; this.status = 'idle'; this.ctx.diagram.resetAll(); this.ctx.expl.clearLog(); this.onReset(false); this.emit(); }
  }
  A.Simulation = Simulation; A.SPEEDS = SPEEDS;
})((window.ArqSim = window.ArqSim || {}));

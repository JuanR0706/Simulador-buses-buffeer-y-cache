/* Calculadora del tiempo efectivo de acceso (EAT). Las fórmulas están en funciones puras. */
(function (A) {
  const FIELDS = [['hit', 'Tasa de aciertos (%)', 96], ['tc', 'Tiempo de acceso con acierto (ns)', 2], ['tm', 'Tiempo total de acceso con fallo (ns)', 60]];
  /* h en [0,1]. simple: el fallo cuesta tm en total. sumado: el fallo cuesta tc + tm (consulta a caché + acceso a RAM). */
  const eat = (h, tc, tm, model = 'simple') => h * tc + (1 - h) * (model === 'simple' ? tm : tc + tm);
  const fmt = (x) => x.toLocaleString('es', { maximumFractionDigits: 2 });

  class EatCalculator {
    static get calculator() { return true; }
    static eat(h, tc, tm, model) { return eat(h, tc, tm, model); }
    constructor(ctx) { this.ctx = ctx; this.inputs = {}; }
    mount(root) {
      root.replaceChildren(); const f = document.createElement('fieldset'); f.className = 'config'; f.innerHTML = '<legend>Parámetros</legend>';
      FIELDS.forEach(([k, label, v]) => { const l = document.createElement('label'); l.append(label + ' '); const i = document.createElement('input'); i.type = 'number'; i.step = 'any'; i.min = 0; i.value = v; i.addEventListener('input', () => this.update()); this.inputs[k] = i; l.append(i); f.append(l); });
      const l = document.createElement('label'); l.append('Modelo de fallo '); const m = document.createElement('select');
      m.add(new Option('Simplificado: el fallo cuesta el tiempo total indicado', 'simple')); m.add(new Option('La consulta a la caché se suma al acceso a RAM', 'sum'));
      m.addEventListener('change', () => this.update()); this.inputs.model = m; l.append(m); f.append(l);
      this.bars = document.createElement('div'); this.bars.className = 'bars'; this.bars.setAttribute('aria-hidden', 'true'); root.append(f, this.bars); this.update();
    }
    update() {
      const pct = Number(this.inputs.hit.value), tc = Number(this.inputs.tc.value), tm = Number(this.inputs.tm.value), model = this.inputs.model.value;
      if (![pct, tc, tm].every(Number.isFinite) || pct < 0 || pct > 100 || tc <= 0 || tm <= 0) { this.ctx.expl.error('La tasa de aciertos debe estar entre 0 y 100 %, y los tiempos deben ser mayores que cero.'); return; }
      const h = pct / 100, miss = 1 - h, e = eat(h, tc, tm, model), red = (1 - e / tm) * 100, mt = model === 'simple' ? tm : tc + tm;
      this.ctx.expl.show({ what: 'El EAT se recalcula con cada cambio.', who: 'Jerarquía de memoria (modelo)', why: 'Es un promedio ponderado: los aciertos son rápidos y los fallos son lentos, y cada uno pesa según su frecuencia.', ifChanged: 'Bajar la tasa de aciertos aumenta el EAT rápidamente, porque los fallos cuestan mucho más que los aciertos.', result: `EAT = (${fmt(h)} × ${fmt(tc)} ns) + (${fmt(miss)} × ${fmt(mt)} ns) = ${fmt(e)} ns`, concept: model === 'simple' ? 'Modelo simplificado: el tiempo de fallo es el tiempo total del caso de fallo. Si la búsqueda en la caché se suma al acceso a RAM, usa el otro modelo: el resultado cambia.' : 'Modelo con búsqueda sumada: un fallo cuesta tiempo de caché + tiempo de RAM, por eso el EAT es algo mayor.' });
      this.ctx.stats.render([['Tasa de aciertos h', fmt(h)], ['Tasa de fallos (1 − h)', fmt(miss)], ['EAT', fmt(e) + ' ns'], ['Referencia: tiempo total de fallo', fmt(tm) + ' ns'], ['Reducción frente a la referencia', fmt(red) + ' %']], null, 'EAT = (tasa de aciertos × tiempo con acierto) + (tasa de fallos × tiempo total con fallo).');
      const mx = Math.max(tm, e); this.bars.innerHTML = '';
      [['Solo RAM / fallo', tm, 'var(--red)'], ['EAT con caché', e, 'var(--green)']].forEach(([t, v, c]) => { const d = document.createElement('div'); d.className = 'bar'; d.innerHTML = `<span>${t}: ${fmt(v)} ns</span><i style="width:${Math.max(1, (v / mx) * 60)}%;background:${c}"></i>`; this.bars.append(d); });
    }
    reset() { FIELDS.forEach(([k, , v]) => { if (this.inputs[k]) this.inputs[k].value = v; }); if (this.inputs.model) { this.inputs.model.value = 'simple'; this.update(); } }
  }
  A.Simulations = A.Simulations || {}; A.Simulations.Eat = EatCalculator;
})((window.ArqSim = window.ArqSim || {}));

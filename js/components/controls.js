/* Barra de controles y formulario de configuración, generados a partir de sim.schema. */
(function (A) {
  class Controls {
    constructor(root, sim, expl) {
      this.sim = sim; this.root = root; root.replaceChildren();
      const bar = document.createElement('div'); bar.className = 'btn-row';
      this.btn = {};
      [['start', 'Iniciar'], ['pause', 'Pausar'], ['resume', 'Continuar'], ['step', 'Paso siguiente'], ['reset', 'Reiniciar']].forEach(([k, t]) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.dataset.act = k; this.btn[k] = b; bar.append(b);
      });
      (sim.actions || []).forEach((a, k) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = a.label; b.dataset.act = 'x' + k; b.className = 'manual'; this.btn['x' + k] = b; bar.append(b); });
      const opts = document.createElement('div'); opts.className = 'opt-row';
      opts.innerHTML = '<label>Velocidad <select data-k="speed"><option value="slow">Lenta</option><option value="normal" selected>Normal</option><option value="fast">Rápida</option></select></label>' +
        '<label class="chk"><input type="checkbox" data-k="detail" checked> Explicaciones detalladas</label>';
      this.form = document.createElement('fieldset'); this.form.className = 'config';
      this.form.innerHTML = '<legend>Configuración</legend>';
      sim.schema.forEach((f) => {
        const l = document.createElement('label'); l.append(f.label + ' ');
        const i = f.type === 'select' ? document.createElement('select') : document.createElement('input');
        if (f.presets) i.addEventListener('change', () => Object.entries(f.presets[i.value] || {}).forEach(([k, v]) => { if (this.form.elements[k]) this.form.elements[k].value = v; }));
        i.name = f.key;
        if (f.type === 'select') f.options.forEach(([v, t]) => i.add(new Option(t, v)));
        else if (f.type === 'text') i.type = 'text';
        else { i.type = 'number'; i.min = f.min; i.max = f.max; i.step = 1; }
        i.value = f.value; l.append(i); this.form.append(l);
      });
      root.append(bar, opts, this.form);
      bar.addEventListener('click', (e) => this.onAction(e.target.dataset.act));
      opts.addEventListener('change', (e) => {
        if (e.target.dataset.k === 'speed') sim.setSpeed(e.target.value);
        if (e.target.dataset.k === 'detail') expl.setDetail(e.target.checked);
      });
      sim.on((s) => this.refresh(s)); this.refresh(sim.status);
    }
    read() {
      const v = {};
      [...this.form.elements].forEach((i) => { if (i.name) v[i.name] = i.tagName === 'SELECT' || i.type === 'text' ? i.value : Number(i.value); });
      return v;
    }
    onAction(a) {
      const s = this.sim;
      if (a && a[0] === 'x') { if (s.status === 'idle') s.setConfig(this.read()); s.actions[+a.slice(1)].run(); return; }
      if (a === 'start' || (a === 'step' && s.status === 'idle')) s.setConfig(this.read());
      ({ start: () => s.start(), pause: () => s.pause(), resume: () => s.resume(), step: () => s.step(), reset: () => s.reset() })[a]?.();
    }
    refresh(st) {
      const { start, pause, resume, step } = this.btn;
      start.disabled = st !== 'idle'; pause.disabled = st !== 'running'; resume.disabled = st !== 'paused';
      step.disabled = !(st === 'idle' || st === 'paused');
      this.form.disabled = st !== 'idle';
      Object.entries(this.btn).forEach(([k, b]) => { if (k[0] === 'x') b.disabled = st === 'running'; });
    }
  }
  A.Components = A.Components || {};
  A.Components.Controls = Controls;
})((window.ArqSim = window.ArqSim || {}));

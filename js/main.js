/* Orquestación: navegación, creación de escenarios y conexión de componentes. No contiene lógica de simulación. */
(function (A) {
  const $ = (s) => document.querySelector(s);
  const S = () => A.Simulations;
  const MODULES = [
    { id: 'bus', name: 'Buses inteligentes', icon: '🔀', desc: 'Transferencia y DMA, bus mastering, arbitraje y ancho de banda.', scenarios: [
      { name: 'Transferencia y DMA', cls: () => S().Bus }, { name: 'Bus mastering', cls: () => S().Mastering },
      { name: 'Arbitraje', cls: () => S().Arbitration }, { name: 'Ancho de banda', cls: () => S().Bandwidth }] },
    { id: 'buffer', name: 'Buffers', icon: '📦', desc: 'Buffer simple, doble y circular con productor y consumidor.', scenarios: [{ name: 'Buffer simple', cls: () => S().Buffer }, { name: 'Simple frente a doble', cls: () => S().BufferCompare }, { name: 'Buffer circular', cls: () => S().Ring }, { name: 'Productor-consumidor', cls: () => S().Sync }] },
    { id: 'cache', name: 'Cachés de memoria', icon: '⚡', desc: 'Aciertos, fallos, niveles L1/L2/L3 y tiempo medio de acceso.', scenarios: [{ name: 'Jerarquía y hit/miss', cls: () => S().Hierarchy }, { name: 'Localidad temporal', cls: () => S().Temporal }, { name: 'Localidad espacial', cls: () => S().Spatial }, { name: 'Calculadora EAT', cls: () => S().Eat }] },
  ];

  class App {
    init() {
      this.expl = new A.Components.Explanations($('#explanation'), $('#log'));
      this.stats = new A.Components.Stats($('#stats'));
      const menu = $('#module-menu'), cards = $('#home-cards');
      MODULES.forEach((m) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'tab'; b.dataset.id = m.id; b.textContent = `${m.icon} ${m.name}`;
        b.onclick = () => this.open(m.id, 0); menu.append(b);
        const c = document.createElement('button'); c.type = 'button'; c.className = 'home-card';
        c.innerHTML = `<strong>${m.icon} ${m.name}</strong><span>${m.desc}</span>`; c.onclick = () => this.open(m.id, 0); cards.append(c);
      });
      $('#btn-home').onclick = () => this.home();
      $('#btn-reset').onclick = () => this.sim && this.sim.reset();
      $('#btn-clear-log').onclick = () => this.expl.clearLog();
      this.home();
    }
    dispose() { if (this.sim) this.sim.reset(); this.sim = null; }      // detiene temporizadores del escenario anterior
    home() { this.dispose(); $('#home').hidden = false; $('#workspace').hidden = true; $('#btn-reset').disabled = true; this.mark(null); }
    mark(id) { document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-current', String(t.dataset.id === id))); }
    open(id, idx) {
      const mod = MODULES.find((m) => m.id === id), sc = mod.scenarios[idx], Cls = sc.cls();
      this.dispose();
      $('#home').hidden = true; $('#workspace').hidden = false; this.mark(id);
      $('#module-title').textContent = `${mod.icon} ${mod.name}`;
      const sub = $('#scenario-menu'); sub.replaceChildren(); sub.hidden = mod.scenarios.length < 2;
      mod.scenarios.forEach((s, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'subtab'; b.textContent = s.name; b.setAttribute('aria-current', String(i === idx)); b.onclick = () => this.open(id, i); sub.append(b); });
      const svg = $('#diagram'), controls = $('#controls'), calc = $('#calc'), stage = $('#stage');
      this.expl.clearLog(); this.stats.render([]); svg.replaceChildren(); controls.replaceChildren(); calc.replaceChildren(); stage.replaceChildren();
      const isCalc = Cls && Cls.calculator, isStage = Cls && Cls.view === 'stage';
      svg.toggleAttribute('hidden', !Cls || !!isCalc || !!isStage);   // SVGElement no tiene la propiedad .hidden
      stage.hidden = !isStage; controls.hidden = !Cls || !!isCalc; calc.hidden = !isCalc;
      if (!Cls) { $('#btn-reset').disabled = true; this.expl.show({ what: 'Este módulo está en preparación.', result: 'Se implementará en la siguiente etapa del proyecto.' }); return; }
      if (isCalc) { this.sim = new Cls({ expl: this.expl, stats: this.stats }); this.sim.mount(calc); }
      else {
        const view = isStage ? new A.Components.Stage(stage) : new A.Components.Diagram(svg, Cls.layout);
        this.sim = new Cls({ expl: this.expl, stats: this.stats, diagram: view, stage: view });
        new A.Components.Controls(controls, this.sim, this.expl); this.sim.reset();
      }
      $('#btn-reset').disabled = false;
    }
  }
  document.addEventListener('DOMContentLoaded', () => new App().init());
})((window.ArqSim = window.ArqSim || {}));

/* Calculadora de ancho de banda teórico (sin pasos de simulación). Los cálculos viven en funciones puras. */
(function (A) {
  const FIELDS = [['mhz', 'Frecuencia (MHz)', 250], ['bytes', 'Bytes por transferencia', 8], ['tpc', 'Transferencias por ciclo', 1]];
  const compute = (mhz, bytes, tpc) => mhz * 1e6 * bytes * tpc;               // bytes por segundo
  const unit = (bps) => (bps >= 1e9 ? [bps / 1e9, 'GB/s'] : bps >= 1e6 ? [bps / 1e6, 'MB/s'] : [bps / 1e3, 'KB/s']);

  class BandwidthCalculator {
    static get calculator() { return true; }
    static compute(mhz, bytes, tpc) { return compute(mhz, bytes, tpc); }
    constructor(ctx) { this.ctx = ctx; this.inputs = {}; }
    mount(root) {
      root.replaceChildren();
      const form = document.createElement('fieldset'); form.className = 'config'; form.innerHTML = '<legend>Parámetros del bus</legend>';
      FIELDS.forEach(([k, label, v]) => {
        const l = document.createElement('label'); l.append(label + ' ');
        const i = document.createElement('input'); i.type = 'number'; i.min = 0; i.step = 'any'; i.value = v; i.name = k;
        i.addEventListener('input', () => this.update()); this.inputs[k] = i; l.append(i); form.append(l);
      });
      const card = document.createElement('div'); card.className = 'concept-card';
      card.innerHTML = '<h4>PCIe y NVMe no son equivalentes</h4><p><strong>PCIe</strong> es una interconexión de alta velocidad (el «camino», con líneas o carriles). <strong>NVMe</strong> es un protocolo de acceso a almacenamiento que suele utilizar PCIe (el «lenguaje»). Un SSD NVMe PCIe x4 usa cuatro líneas, pero su rendimiento real depende de la generación de PCIe, el número de líneas, el protocolo y el dispositivo.</p>';
      root.append(form, card); this.update();
    }
    read() { return FIELDS.map(([k]) => Number(this.inputs[k].value)); }
    update() {
      const [f, b, t] = this.read();
      if (![f, b, t].every((x) => Number.isFinite(x) && x > 0)) { this.ctx.expl.error('Todos los parámetros deben ser números mayores que cero.'); return; }
      const bps = compute(f, b, t), [v, u] = unit(bps), fmtN = (x) => x.toLocaleString('es', { maximumFractionDigits: 3 });
      this.ctx.expl.show({ what: 'El resultado se recalcula con cada cambio de parámetros.', who: 'Bus de datos', why: 'La frecuencia indica cuántos ciclos ocurren por segundo; cada ciclo mueve bytes por transferencia × transferencias por ciclo.', ifChanged: 'Duplicar la frecuencia, el ancho de datos o las transferencias por ciclo duplica el ancho de banda teórico.', result: `${fmtN(f)} MHz × ${fmtN(b)} bytes × ${fmtN(t)} = ${fmtN(bps)} bytes/s ≈ ${fmtN(v)} ${u}`, concept: 'Es un valor teórico máximo: el rendimiento real depende de protocolos, esperas, contención y del dispositivo. Unidades decimales: 1 MHz = 10⁶ ciclos/s; 1 GB = 10⁹ bytes.' });
      this.ctx.stats.render([['Bytes por segundo', fmtN(bps)], ['MB/s (decimal)', fmtN(bps / 1e6)], ['GB/s (decimal)', fmtN(bps / 1e9)]], null, 'Ancho de banda teórico = frecuencia × bytes por transferencia × transferencias por ciclo.');
    }
    reset() { FIELDS.forEach(([k, , v]) => { if (this.inputs[k]) this.inputs[k].value = v; }); if (this.inputs.mhz) this.update(); }
    on() {}
  }
  A.Simulations = A.Simulations || {}; A.Simulations.Bandwidth = BandwidthCalculator;
})((window.ArqSim = window.ArqSim || {}));

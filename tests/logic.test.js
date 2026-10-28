/* Pruebas de lógica sin navegador: node tests/logic.test.js */
const fs = require('fs'), vm = require('vm'), path = require('path');
const w = { clearTimeout, setTimeout, matchMedia: () => ({ matches: true }), document: { createElement: () => ({}) } }; w.window = w; vm.createContext(w);
['utils/formatters', 'utils/structures', 'simulations/simulation-base', 'simulations/bus-simulation', 'simulations/bus-mastering-simulation', 'simulations/arbitration-simulation', 'simulations/bandwidth-calculator', 'simulations/buffer-simulation', 'simulations/buffer-compare-simulation', 'simulations/buffer-ring-simulation', 'simulations/buffer-sync-simulation', 'simulations/cache-simulation', 'simulations/cache-locality-simulation', 'simulations/eat-calculator']
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), w));
const A = w.ArqSim; let fails = 0, maxBusy = 0, errs = [];
const check = (name, ok) => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + name); if (!ok) fails++; };
const states = {};
const ctx = { diagram: { resetAll() {}, setState(id, st) { states[id] = st; maxBusy = Math.max(maxBusy, Object.values(states).filter((s) => s === 'transferring' && true).length); }, movePacket() {} },
  expl: { show() {}, log() {}, clearLog() {}, error(m) { errs.push(m); } }, stats: { render() {} } };
const runAll = (sim, cfg) => { sim.reset(); sim.setConfig(cfg); let k = 0; do { sim.step(); k++; if (k > 500) throw new Error('bucle'); } while (sim.status !== 'finished' && sim.status !== 'idle'); return k; };

let sim = new A.Simulations.Bus(ctx);
check('E/S programada: 4 bloques → 12 pasos', runAll(sim, { mode: 'prog', total: 8, block: 2, rate: 50 }) === 12);
check('DMA transfiere los 4 bloques configurados', (runAll(sim, { mode: 'dma', total: 8, block: 2, rate: 50 }), sim.results.dma.transfers === 4 && sim.results.dma.steps === 9));
check('Comparación disponible al terminar (ambas modalidades)', !!sim.results.prog && !!sim.results.dma && sim.results.prog.cpu === 1 && sim.results.dma.cpu < 1);
sim.reset(); sim.setConfig({ mode: 'dma', total: 2, block: 5, rate: 50 }); sim.step();
check('Validación: bloque mayor que el total', errs.length === 1 && sim.status === 'idle');
sim.reset(); sim.setConfig({ mode: 'dma', total: 8, block: 2, rate: 50 }); sim.start(); sim.start();
check('No admite ejecuciones simultáneas', sim.status === 'running'); sim.pause(); sim.resume(); sim.reset();
check('Reiniciar vuelve a idle', sim.status === 'idle');

const m = new A.Simulations.Mastering(ctx);
check('Bus mastering inicia las transacciones configuradas', (runAll(m, { device: 'net', n: 5, rate: 20 }), m.s.tx === 5));

const arb = new A.Simulations.Arbitration(ctx);
for (const mode of ['central', 'dist']) {
  maxBusy = 0; Object.keys(states).forEach((k) => delete states[k]);
  runAll(arb, { mode, policy: 'priority', p1: 4, p2: 3, p3: 2, p4: 1, demand: 3 });
  check(`Arbitraje ${mode}: nunca más de un dispositivo autorizado a la vez`, maxBusy <= 2 /* dispositivo + recurso */);
  check(`Arbitraje ${mode}: 12 concesiones y 0 pendientes`, arb.s.grants === 12 && arb.s.rem.every((r) => r === 0));
  check(`Arbitraje ${mode}: prioridad fija genera advertencia de inanición`, arb.s.waitTot[3] >= 3 && arb.s.history.slice(0, 3).join() === 'D1,D1,D1');
}
runAll(arb, { mode: 'central', policy: 'rr', p1: 4, p2: 3, p3: 2, p4: 1, demand: 3 });
check('Turno rotativo reparte equitativamente', arb.s.history.slice(0, 4).join() === 'D1,D2,D3,D4' && arb.s.warn === '');

check('Ancho de banda: 250 MHz × 8 B × 1 = 2 GB/s', A.Simulations.Bandwidth.compute(250, 8, 1) / 1e9 === 2);

// ---------- Módulo 2: buffers ----------
const stub = new Proxy({}, { get: () => () => {} });
const seen = [];
const sctx = { diagram: stub, stage: stub, expl: { ...ctx.expl, show(e) { seen.push(e); } }, stats: ctx.stats };
let maxLen = 0;
const pc = new A.Simulations.Buffer(sctx); const origDraw = pc.draw.bind(pc); pc.draw = function () { maxLen = Math.max(maxLen, this.s.buf.length); origDraw(); };
runAll(pc, { cap: 2, pp: 1, cp: 3, total: 10, policy: 'block' });
check('Buffer simple: nunca supera su capacidad', maxLen <= 2);
check('Buffer simple: el productor se bloquea cuando no hay espacio', pc.s.pBlocked > 0 && pc.s.consumed === 10);
runAll(pc, { cap: 2, pp: 1, cp: 3, total: 10, policy: 'discard' });
check('Buffer simple: con descarte se pierden datos y consumidos + descartados = total', pc.s.dropped > 0 && pc.s.consumed + pc.s.dropped === 10);
runAll(pc, { cap: 4, pp: 4, cp: 1, total: 6, policy: 'block' });
check('Buffer simple: el consumidor espera cuando no hay datos', pc.s.cBlocked > 0 && pc.s.consumed === 6);

const cmp = new A.Simulations.BufferCompare(sctx);
runAll(cmp, { mode: 'simple', blocks: 8, pp: 3, cp: 4 }); runAll(cmp, { mode: 'double', blocks: 8, pp: 3, cp: 4 });
check('Doble buffering: procesa todos los bloques y respeta sus dos espacios', cmp.results.double.consumed === 8 && cmp.results.simple.consumed === 8 && cmp.s.bufs.length === 2);
check('Doble buffering: con estos parámetros el solapamiento reduce el tiempo (resultado de las reglas)', cmp.results.double.time < cmp.results.simple.time);

const rg = new A.Simulations.Ring(sctx); rg.setConfig({ cap: 3, ops: 1, pw: 50, seed: 1 }); rg.reset(); rg.configure();
const W = () => rg.manual('W'), R = () => rg.manual('R');
R(); check('Anillo: no se lee con el buffer vacío', rg.s.rejR === 1 && rg.s.count === 0);
W(); W(); W();
check('Anillo: índice de escritura vuelve al inicio y el estado «lleno» sale del contador', rg.s.w === 0 && rg.s.r === 0 && rg.s.count === 3 && rg.state() === 'lleno' && rg.s.wraps === 1);
W(); check('Anillo: no se escribe con el buffer lleno', rg.s.rejW === 1 && rg.s.count === 3);
R(); R(); R(); check('Anillo: vacío con índices iguales, distinguido por el contador', rg.s.count === 0 && rg.s.w === rg.s.r && rg.state() === 'vacío');
rg.reset(); runAll(rg, { cap: 4, ops: 40, pw: 50, seed: 3 }); check('Anillo: el contador queda siempre entre 0 y la capacidad', rg.s.count >= 0 && rg.s.count <= 4);

const sy = new A.Simulations.Sync(sctx); let bad = false; const oa = sy.apply.bind(sy);
sy.apply = function (o) { oa(o); if (this.s.count < 0 || this.s.count > this.config.cap || this.s.sem.empty < 0 || this.s.sem.full < 0) bad = true; };
const presets = { prodFast: { cap: 3, items: 8, prefill: 0, qp: 4, qc: 1 }, consFast: { cap: 4, items: 8, prefill: 0, qp: 1, qc: 4 }, full: { cap: 2, items: 6, prefill: 2, qp: 4, qc: 1 }, empty: { cap: 3, items: 6, prefill: 0, qp: 1, qc: 4 }, mutex: { cap: 4, items: 6, prefill: 2, qp: 4, qc: 2 } };
for (const [n, cfg] of Object.entries(presets)) { runAll(sy, cfg); const exp = [...Array.from({ length: cfg.prefill }, (_, i) => 'I' + (i + 1)), ...Array.from({ length: cfg.items }, (_, i) => 'D' + (i + 1))];
  check(`Sincronización «${n}»: completa, respeta límites y entrega los datos en orden`, !bad && sy.s.P.done && sy.s.C.done && sy.s.out_list.join() === exp.join() && sy.s.mutex === null); }
runAll(sy, presets.full); check('Sincronización: productor bloqueado con buffer lleno', sy.s.P.blocks > 0);
runAll(sy, presets.empty); check('Sincronización: consumidor bloqueado con buffer vacío', sy.s.C.blocks > 0);
seen.length = 0; runAll(sy, presets.mutex); check('Sincronización: el consumidor espera por el mutex ocupado por el productor', seen.some((e) => /Consumidor intenta C2/.test(e.what) && /mutex está ocupado por el Productor/.test(e.why)));

// ---------- Módulo 3: cachés ----------
const lru = new A.Utils.LruCache(2); lru.insert('A'); lru.insert('B'); lru.touch('A');
check('LRU: reemplaza el menos recientemente usado', lru.insert('C') === 'B' && lru.items.join() === 'C,A');
const hi = new A.Simulations.Hierarchy(sctx);
runAll(hi, { seq: 'A, B, A, C', c1: 2, c2: 3, c3: 4, t1: 2, t2: 6, t3: 20, tm: 60 });
check('Jerarquía: hits y misses corresponden a los datos almacenados (L1 hit = 1, RAM = 3)', hi.s.hit[0] === 1 && hi.s.ram === 3 && hi.s.acc === 4);
check('Jerarquía: LRU reemplazó B en L1 y L1 conserva C y A', hi.s.repl >= 1 && hi.s.L[0].items.join() === 'C,A');
runAll(hi, { seq: 'A, B, A, C, A, B, D, A' });
check('Jerarquía: tasa de aciertos = hits / accesos y los fallos no se cuentan como hits', hi.s.hit.reduce((a, b) => a + b, 0) + hi.s.ram === hi.s.acc && Math.abs(hi.s.ns / hi.s.acc - (hi.s.hit[0] * 2 + hi.s.hit[1] * 6 + hi.s.hit[2] * 20 + hi.s.ram * 60) / hi.s.acc) < 1e-9);
check('Jerarquía: un nivel intermedio resuelve fallos de L1 (no todo va a RAM)', hi.s.hit[1] + hi.s.hit[2] > 0);
hi.reset(); hi.setConfig({ seq: 'A, 1234567' }); hi.step(); check('Jerarquía: valida la secuencia', errs.some((m) => /1 a 4/.test(m)));
check('EAT: 96 %, 2 ns, 60 ns = 4,32 ns y reducción del 92,8 %', Math.abs(A.Simulations.Eat.eat(0.96, 2, 60) - 4.32) < 1e-9 && Math.abs((1 - 4.32 / 60) * 100 - 92.8) < 1e-9);
check('EAT: el modelo con búsqueda sumada ajusta el resultado', Math.abs(A.Simulations.Eat.eat(0.96, 2, 60, 'sum') - 4.4) < 1e-9);
const tp = new A.Simulations.Temporal(sctx);
runAll(tp, { cap: 3, reps: 5, gap: 1 }); check('Localidad temporal: X acierta tras el primer acceso si no es reemplazado', tp.s.xHit === 4);
runAll(tp, { cap: 3, reps: 5, gap: 3 }); check('Localidad temporal: si X es reemplazado, vuelve el miss', tp.s.xHit === 0);
const sp = new A.Simulations.Spatial(sctx);
runAll(sp, { pattern: 'seq', bs: '4', cap: 2, stride: 8, n: 16 }); check('Localidad espacial: bloque de 4 y accesos consecutivos → 12 hits de 16', sp.s.hit === 12);
runAll(sp, { pattern: 'seq', bs: '1', cap: 2, stride: 8, n: 16 }); check('Localidad espacial: bloque de 1 dirección → sin beneficio', sp.s.hit === 0);
runAll(sp, { pattern: 'stride', bs: '4', cap: 2, stride: 8, n: 16 }); check('Localidad espacial: saltos grandes no aprovechan el bloque', sp.s.hit === 0);

console.log(fails ? `\n${fails} prueba(s) fallaron` : '\nTodas las pruebas pasaron'); process.exit(fails ? 1 : 0);

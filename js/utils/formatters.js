(function (A) {
  A.Utils = A.Utils || {};
  A.Utils.fmt = {
    ms: (v) => (v >= 1000 ? (v / 1000).toFixed(2) + ' s' : Math.round(v) + ' ms'),
    pct: (v) => (v * 100).toFixed(1) + ' %',
    kb: (v) => v + ' KB',
  };
})((window.ArqSim = window.ArqSim || {}));

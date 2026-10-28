/* Estructuras puras (sin DOM): caché LRU y generador pseudoaleatorio reproducible. */
(function (A) {
  class LruCache {
    constructor(cap) { this.cap = cap; this.items = []; }          // items[0] = más reciente (MRU), último = LRU
    has(k) { return this.items.includes(k); }
    touch(k) { const i = this.items.indexOf(k); if (i < 0) return false; this.items.splice(i, 1); this.items.unshift(k); return true; }
    insert(k) {                                                    // devuelve el elemento reemplazado (o null)
      if (this.touch(k)) return null;
      const out = this.items.length >= this.cap ? this.items.pop() : null;
      this.items.unshift(k); return out;
    }
  }
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  A.Utils = A.Utils || {}; A.Utils.LruCache = LruCache; A.Utils.mulberry32 = mulberry32;
})((window.ArqSim = window.ArqSim || {}));

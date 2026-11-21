(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TextUtils = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function normalize(text) { return String(text || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^a-z0-9\s'"!?-]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function words(text) { return new Set(normalize(text).split(/\s+/).filter(Boolean)); }
  function overlap(a, b) { const aa = words(a), bb = words(b); return [...aa].filter(w => w.length > 3 && bb.has(w)).length; }
  function distinct(items, key = item => normalize(item.text || item)) { return [...new Map(items.map(item => [key(item), item])).values()]; }
  return { normalize, words, overlap, distinct };
});

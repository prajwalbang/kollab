/* ============================================================
   HEEPSY SCRAPER — OPTION 1: XHR / fetch capture  (BEST)
   ------------------------------------------------------------
   1. Open go.heepsy.com search page
   2. F12 -> Console -> paste this WHOLE file -> Enter
   3. Now interact with the page: change a filter, hit "Show results",
      scroll, or click page 2. Every JSON response gets captured.
   4. Run   __heepsy.list()   to see what endpoints were caught
   5. Run   __heepsy.save()   to download all captured JSON
      or   __heepsy.csv()     to download a flattened CSV
   ============================================================ */
(() => {
  if (window.__heepsy) { console.log('already installed'); return; }
  const captures = [];

  const record = (url, text) => {
    let json; try { json = JSON.parse(text); } catch { return; }   // ignore non-JSON
    captures.push({ url, json, at: new Date().toISOString() });
    console.log('%c[heepsy] captured', 'color:#0a0', url, json);
  };

  // --- hook fetch ---
  const _fetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await _fetch.apply(this, args);
    const url = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url) || '';
    res.clone().text().then(t => record(url, t)).catch(() => {});
    return res;
  };

  // --- hook XMLHttpRequest ---
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u, ...r) { this.__url = u; return _open.call(this, m, u, ...r); };
  XMLHttpRequest.prototype.send = function (...r) {
    this.addEventListener('load', () => { try { record(this.__url, this.responseText); } catch {} });
    return _send.apply(this, r);
  };

  const dl = (name, content, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; a.click();
  };

  // Walk any nested JSON and pull out objects that look like a creator record
  const findCreators = (node, out = []) => {
    if (Array.isArray(node)) { node.forEach(n => findCreators(n, out)); return out; }
    if (node && typeof node === 'object') {
      const k = Object.keys(node).map(s => s.toLowerCase());
      const looksLikeCreator =
        (k.some(x => /username|handle|screen_name|nickname/.test(x)) &&
         k.some(x => /follower/.test(x)));
      if (looksLikeCreator) out.push(node);
      Object.values(node).forEach(v => findCreators(v, out));
    }
    return out;
  };

  const flatten = (o, pfx = '', out = {}) => {
    for (const [k, v] of Object.entries(o)) {
      const key = pfx ? `${pfx}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
      else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
    }
    return out;
  };

  window.__heepsy = {
    captures,
    list: () => console.table(captures.map((c, i) => ({ i, url: c.url.slice(0, 120) }))),
    creators: () => {
      const seen = new Set(), rows = [];
      captures.forEach(c => findCreators(c.json).forEach(r => {
        const key = JSON.stringify(r).slice(0, 300);
        if (!seen.has(key)) { seen.add(key); rows.push(r); }
      }));
      return rows;
    },
    save: () => dl('heepsy-raw.json', JSON.stringify(captures, null, 2), 'application/json'),
    csv: () => {
      const rows = window.__heepsy.creators().map(r => flatten(r));
      if (!rows.length) return console.warn('no creator-shaped objects found — use __heepsy.save() and inspect manually');
      const cols = [...new Set(rows.flatMap(Object.keys))];
      const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
      dl('heepsy-creators.csv', csv, 'text/csv');
      console.log(`exported ${rows.length} creators`);
    },
  };
  console.log('%c[heepsy] hooks installed. Now trigger a search / scroll / next page.', 'color:#08f;font-weight:bold');
})();

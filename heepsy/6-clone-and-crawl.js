/* ============================================================
   HEEPSY — clone the app's authorized request, then paginate.
   The auth token is read from the live request and reused in
   place; it is never printed or exported.

   1. paste this
   2. click page 2 (or Show results) in the UI  -> "[capt] got it"
   3. await heepsyGo()          // or heepsyGo({maxPages: 5})
   4. heepsyCSV()
   ============================================================ */
(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  window.__capt = [];

  const _f = window.fetch;
  window.fetch = function (input, init = {}) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init.method || (input && input.method) || 'GET').toUpperCase();
    if (url.includes('/api/creators/') && method === 'POST' && init.body) {
      const h = {};
      const raw = init.headers;
      if (raw) {
        if (typeof raw.forEach === 'function') raw.forEach((v, k) => h[k] = v);
        else Object.assign(h, raw);
      }
      // ignore our own replays
      if (!h['x-heepsy-replay']) {
        window.__capt.push({ url, headers: h, body: init.body });
        const authKeys = Object.keys(h).filter(k => /auth|token|session/i.test(k));
        console.log(`%c[capt] got it — ${Object.keys(h).length} headers`
          + (authKeys.length ? `, auth via: ${authKeys.join(', ')}` : ', no auth header (cookie-based)'),
          'color:#0a0;font-weight:bold');
      }
    }
    return _f.apply(this, arguments);
  };

  window.__heepsy = { rows: [], byId: new Map() };
  const idOf = r => r.profile_id || r.id || r.username || JSON.stringify(r).slice(0, 200);

  window.heepsyGo = async ({ maxPages = 500, delay = 1500 } = {}) => {
    if (!window.__capt.length) {
      console.error('[heepsy] nothing captured yet — click page 2 in the UI first, then re-run.');
      return [];
    }
    const tpl = window.__capt[window.__capt.length - 1];
    const baseBody = JSON.parse(tpl.body);
    console.log('%c[heepsy] cloning authorized request', 'color:#08f;font-weight:bold',
                { keys: Object.keys(baseBody), headerCount: Object.keys(tpl.headers).length });

    window.__stopHeepsy = false;
    for (let page = 1; page <= maxPages; page++) {
      if (window.__stopHeepsy) { console.warn('[heepsy] stopped'); break; }

      const body = { ...baseBody, page };
      if (typeof body.url === 'string') body.url = body.url.replace(/([?&]page=)\d+/, `$1${page}`);

      let res, json;
      try {
        res = await _f(tpl.url, {
          method: 'POST',
          headers: { ...tpl.headers, 'x-heepsy-replay': '1' },
          body: JSON.stringify(body),
        });
        if (!res.ok) { console.error(`[heepsy] page ${page}: HTTP ${res.status} — ${await res.text()}`); break; }
        json = await res.json();
      } catch (e) { console.error(`[heepsy] page ${page}: ${e.message}`); break; }

      const results = json.results || json.creators || [];
      if (!results.length) { console.log(`[heepsy] page ${page}: 0 results — done`); break; }

      let added = 0;
      for (const c of results) {
        const k = idOf(c);
        if (!window.__heepsy.byId.has(k)) { window.__heepsy.byId.set(k, c); added++; }
      }
      window.__heepsy.rows = [...window.__heepsy.byId.values()];
      const left = res.headers.get('X-search-results-remaining');
      console.log(`%c[heepsy] page ${page}: ${results.length} (+${added} new) | total ${window.__heepsy.rows.length}`
                  + (left ? ` | credits left ${left}` : ''), 'color:#0a0');

      if (!added) { console.warn('[heepsy] repeat page — pagination capped. stopping.'); break; }
      await sleep(delay);
    }
    console.log(`%c[heepsy] DONE — ${window.__heepsy.rows.length} creators`, 'color:#08f;font-size:14px;font-weight:bold');
    console.log('fields ->', Object.keys(window.__heepsy.rows[0] || {}));
    return window.__heepsy.rows;
  };

  const flatten = (o, pfx = '', out = {}) => {
    for (const [k, v] of Object.entries(o || {})) {
      const key = pfx ? `${pfx}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
      else out[key] = Array.isArray(v) ? v.map(x => typeof x === 'object' ? JSON.stringify(x) : x).join(' | ') : v;
    }
    return out;
  };
  const dl = (n, c, t) => { const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([c], { type: t })); a.download = n; a.click(); };

  window.heepsyCSV = () => {
    const rows = window.__heepsy.rows.map(r => flatten(r));
    if (!rows.length) return console.warn('nothing collected yet');
    const cols = [...new Set(rows.flatMap(Object.keys))];
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    dl('heepsy-creators.csv', [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n'),
       'text/csv;charset=utf-8');
    console.log(`exported ${rows.length} rows x ${cols.length} cols`);
  };
  window.heepsyJSON = () => dl('heepsy-raw.json', JSON.stringify(window.__heepsy.rows, null, 2), 'application/json');

  console.log('%c[heepsy] ready. Now click page 2 in the UI, then: await heepsyGo()', 'color:#08f;font-weight:bold');
})();

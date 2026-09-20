/* ============================================================
   HEEPSY — API CRAWLER  (the good one)
   ------------------------------------------------------------
   Calls POST https://api.heepsy.com/api/creators/ directly,
   page by page, from the page's own session. No DOM scraping,
   no clicking. Must be pasted in the Console ON go.heepsy.com
   (Cloudflare rejects the same request from curl/node).

   USAGE
     1. Be on your search results page, F12 -> Console
     2. Paste this whole file, Enter
     3. await heepsyAPI()                     // crawl all pages
        await heepsyAPI({ maxPages: 5 })      // cap it
        await heepsyAPI({ order: 'followers' })
     4. heepsyCSV()      -> download CSV
        heepsyJSON()     -> download raw JSON
        __heepsy.rows    -> array in console
   ============================================================ */
(() => {
  const API = 'https://api.heepsy.com/api/creators/';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Pull the live search params out of the current URL so the crawl
  // matches exactly what you see on screen.
  const readParams = () => {
    const p = new URLSearchParams(location.search);
    return {
      search_text: p.get('filter[search_text]') || '',
      search_type: p.get('filter[search_type]') || 'ai',
      network: p.get('network[]') || p.get('network') || 'instagram',
      order: p.get('order') || 'most_viewed',
    };
  };

  const buildBody = (page, o) => ({
    order: o.order,
    page,
    network: o.network,
    'filter[search_type]': o.search_type,
    'filter[search_text]': o.search_text,
    url: `https://go.heepsy.com/creators?filter%5Bsearch_text%5D=${encodeURIComponent(o.search_text)}`
       + `&filter%5Bsearch_type%5D=${o.search_type}&network=${o.network}`
       + `&order=${o.order}&page=${page}`,
  });

  const fetchPage = async (page, o) => {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': '*/*',
        'ab_tests': '{}',
        'x-path': '/creators',
      },
      body: JSON.stringify(buildBody(page, o)),
    });
    const plan = res.headers.get('plan');
    const remaining = res.headers.get('X-search-results-remaining');
    if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
    const json = await res.json();
    return { json, plan, remaining };
  };

  // creator objects live under .results; keep everything, dedupe by profile id
  const idOf = r => r.profile_id || r.id || r.username || JSON.stringify(r).slice(0, 200);

  window.__heepsy = window.__heepsy || { rows: [], byId: new Map(), raw: [] };

  window.heepsyAPI = async ({ maxPages = 500, delay = 1200, ...over } = {}) => {
    const o = { ...readParams(), ...over };
    console.log('%c[heepsy] params', 'color:#08f;font-weight:bold', o);
    window.__stopHeepsy = false;

    for (let page = 1; page <= maxPages; page++) {
      if (window.__stopHeepsy) { console.warn('[heepsy] stopped'); break; }

      let r;
      try { r = await fetchPage(page, o); }
      catch (e) { console.error(`[heepsy] ${e.message} — stopping`); break; }

      window.__heepsy.raw.push(r.json);
      const results = r.json.results || r.json.creators || [];
      if (!Array.isArray(results) || results.length === 0) {
        console.log(`[heepsy] page ${page} returned 0 results — done`);
        break;
      }

      let added = 0;
      for (const c of results) {
        const k = idOf(c);
        if (!window.__heepsy.byId.has(k)) { window.__heepsy.byId.set(k, c); added++; }
      }
      window.__heepsy.rows = [...window.__heepsy.byId.values()];

      console.log(
        `%c[heepsy] page ${page}: ${results.length} results (+${added} new) | total ${window.__heepsy.rows.length}`
        + (r.remaining ? ` | search credits left: ${r.remaining}` : ''),
        'color:#0a0'
      );

      if (added === 0) { console.warn('[heepsy] page repeated previous results — pagination likely capped. Stopping.'); break; }
      await sleep(delay);
    }

    console.log(`%c[heepsy] DONE — ${window.__heepsy.rows.length} unique creators`,
                'color:#08f;font-size:14px;font-weight:bold');
    console.log('sample record ->', window.__heepsy.rows[0]);
    console.log('export with:  heepsyCSV()   or   heepsyJSON()');
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

  const dl = (name, content, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; a.click();
  };

  window.heepsyCSV = () => {
    const rows = window.__heepsy.rows.map(r => flatten(r));
    if (!rows.length) return console.warn('nothing collected yet — run await heepsyAPI() first');
    const cols = [...new Set(rows.flatMap(Object.keys))];
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    dl('heepsy-creators.csv',
       [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n'),
       'text/csv;charset=utf-8');
    console.log(`exported ${rows.length} rows x ${cols.length} columns`);
  };

  window.heepsyJSON = () =>
    dl('heepsy-raw.json', JSON.stringify(window.__heepsy.rows, null, 2), 'application/json');

  console.log('%cready → await heepsyAPI()', 'color:#08f;font-weight:bold');
})();

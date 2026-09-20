/* Records the app's OWN call to /api/creators/ — headers, body, and the
   error text from our failed attempt. Paste, then click page 2 in the UI. */
(() => {
  window.__capt = [];
  const _f = window.fetch;
  window.fetch = function (input, init = {}) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.includes('/api/creators')) {
      const h = {};
      const raw = (init.headers) || (input && input.headers);
      if (raw) {
        if (typeof raw.forEach === 'function') raw.forEach((v, k) => h[k] = v);
        else Object.assign(h, raw);
      }
      const rec = { url, method: init.method || (input && input.method) || 'GET', headers: h, body: init.body };
      window.__capt.push(rec);
      console.log('%c[capt] captured', 'color:#0a0;font-weight:bold', rec);
    }
    return _f.apply(this, arguments);
  };

  // also show WHY our own request 400'd
  window.heepsyWhy = async () => {
    const p = new URLSearchParams(location.search);
    const body = {
      order: 'most_viewed', page: 1, network: 'instagram',
      'filter[search_type]': p.get('filter[search_type]') || 'ai',
      'filter[search_text]': p.get('filter[search_text]') || '',
      url: location.href,
    };
    const r = await fetch('https://api.heepsy.com/api/creators/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: '*/*', ab_tests: '{}', 'x-path': '/creators' },
      body: JSON.stringify(body),
    });
    console.log('status', r.status, 'body sent ->', body);
    console.log('server said ->', await r.text());
  };

  console.log('%c[capt] hook installed.', 'color:#08f;font-weight:bold');
  console.log('1) click page 2 (or Show results) in the UI');
  console.log('2) then run:  copy(JSON.stringify(__capt, null, 2))');
  console.log('   also run:  await heepsyWhy()   to see the 400 reason');
})();

/* ============================================================
   HEEPSY SCRAPER — OPTION 3: auto-paginate driver
   ------------------------------------------------------------
   Clicks through every page, harvesting as it goes.
   PASTE 1-xhr-capture.js AND 2-dom-scrape.js FIRST, then this.

       await heepsyCrawl()                 // all pages, default pacing
       await heepsyCrawl({ maxPages: 20 }) // safety cap
       await heepsyCrawl({ delay: 3000 })  // slower, if rate-limited

   Stop early at any time:  window.__stopCrawl = true
   Then export:  __heepsy.csv()   (JSON path)  or  heepsyRows(true)  (DOM path)
   ============================================================ */
(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();

  // --- locate the pagination bar: the container holding "1 2 3 4 5 ... >" ---
  const findPager = () => {
    const nums = [...document.querySelectorAll('button,a,li,span,div')]
      .filter(el => el.children.length === 0 && /^[1-9]\d{0,3}$/.test(clean(el.textContent)));
    if (!nums.length) return null;
    // the common ancestor of "1" and "2"
    const one = nums.find(e => clean(e.textContent) === '1');
    const two = nums.find(e => clean(e.textContent) === '2');
    if (!one) return null;
    if (!two) return one.parentElement;
    let a = one;
    while (a && !a.contains(two)) a = a.parentElement;
    return a;
  };

  const currentPage = () => {
    const pager = findPager();
    if (!pager) return null;
    // the highlighted page: aria-current, or an element with a border/active class
    const cand = [...pager.querySelectorAll('*')].filter(
      el => el.children.length === 0 && /^[1-9]\d{0,3}$/.test(clean(el.textContent))
    );
    for (const el of cand) {
      let n = el;
      for (let i = 0; i < 4 && n; i++, n = n.parentElement) {
        if (n.getAttribute?.('aria-current') ||
            /active|selected|current/i.test(n.className || '') ||
            (n.getAttribute?.('aria-selected') === 'true')) {
          return +clean(el.textContent);
        }
      }
    }
    return null;
  };

  const findNext = () => {
    const pager = findPager();
    const scope = pager || document.body;
    const cands = [...scope.querySelectorAll('button,a,[role="button"],svg,span,div')];
    return cands.find(el => {
      const t = clean(el.textContent);
      const label = (el.getAttribute?.('aria-label') || '') + ' ' + (el.getAttribute?.('title') || '');
      const hit = /^(>|›|»|→)$/.test(t) || /\bnext\b|siguiente/i.test(label);
      if (!hit) return false;
      const btn = el.closest('button,a,[role="button"]') || el;
      const dis = btn.disabled || btn.getAttribute?.('aria-disabled') === 'true' ||
                  /disabled/i.test(btn.className || '');
      return !dis;
    });
  };

  // fingerprint of the visible result set — used to detect the page actually changed
  const fingerprint = () => {
    const hs = [...document.querySelectorAll('a,span,div')]
      .filter(el => el.children.length === 0 && /^@[\w.\-]{2,}$/.test(clean(el.textContent)))
      .map(el => clean(el.textContent));
    return hs.join('|');
  };

  const harvest = () => {
    if (typeof window.heepsyRows === 'function') window.heepsyRows(); // merges into __rows
  };

  const clickExpandAll = () => {
    const b = [...document.querySelectorAll('button,a,span,div')]
      .find(el => el.children.length === 0 && /^expand all$/i.test(clean(el.textContent)));
    if (b) (b.closest('button,a,[role="button"]') || b).click();
  };

  window.heepsyCrawl = async ({ maxPages = 500, delay = 2000, expand = true } = {}) => {
    window.__stopCrawl = false;
    let pages = 0;

    for (;;) {
      if (window.__stopCrawl) { console.warn('[crawl] stopped by user'); break; }

      if (expand) { clickExpandAll(); await sleep(400); }
      harvest();
      pages++;
      const cur = currentPage();
      const jsonCount = window.__heepsy ? window.__heepsy.creators().length : 0;
      const domCount = window.__rows ? window.__rows.size : 0;
      console.log(`%c[crawl] page ${cur ?? pages} done — dom:${domCount} json:${jsonCount}`,
                  'color:#0a0;font-weight:bold');

      if (pages >= maxPages) { console.warn('[crawl] maxPages reached'); break; }

      const next = findNext();
      if (!next) { console.log('[crawl] no enabled next button — finished'); break; }

      const before = fingerprint();
      (next.closest('button,a,[role="button"]') || next).click();

      // wait for the result set to actually change
      let changed = false;
      for (let i = 0; i < 40; i++) {           // up to ~10s
        await sleep(250);
        if (fingerprint() !== before) { changed = true; break; }
      }
      if (!changed) { console.warn('[crawl] results never changed — assuming last page'); break; }

      await sleep(delay);                       // be polite / let lazy content settle
      window.scrollTo(0, 0);
    }

    const domCount = window.__rows ? window.__rows.size : 0;
    const jsonCount = window.__heepsy ? window.__heepsy.creators().length : 0;
    console.log(`%c[crawl] DONE — ${pages} pages | dom rows: ${domCount} | json rows: ${jsonCount}`,
                'color:#08f;font-size:14px;font-weight:bold');
    console.log('export →  __heepsy.csv()   or   heepsyRows(true)');
    return { pages, domCount, jsonCount };
  };

  console.log('%cready → await heepsyCrawl()', 'color:#08f;font-weight:bold');
})();

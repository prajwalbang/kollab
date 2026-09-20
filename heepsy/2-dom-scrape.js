/* ============================================================
   HEEPSY SCRAPER — OPTION 2: DOM scrape (fallback)
   ------------------------------------------------------------
   Works on whatever is rendered on screen. Click "Expand All"
   first so bios/emails are visible.
   Paste in Console, then:
       heepsyRows()          -> console.table preview
       heepsyRows(true)      -> also downloads CSV
   Paginate, re-run, and it merges into window.__rows (dedup by handle).
   ============================================================ */
(() => {
  window.__rows = window.__rows || new Map();

  const clean = s => (s || '').replace(/\s+/g, ' ').trim();

  window.heepsyRows = (download = false) => {
    // anchor on the @handle element, then climb to the row container
    const handleEls = [...document.querySelectorAll('a,span,div')]
      .filter(el => el.children.length === 0 && /^@[\w.\-]{2,}$/.test(clean(el.textContent)));

    handleEls.forEach(hEl => {
      let row = hEl;
      // climb until the container also holds a follower count AND an engagement %
      for (let i = 0; i < 12 && row.parentElement; i++) {
        row = row.parentElement;
        const t = clean(row.textContent);
        if (/[\d.]+[KMB]?\s*$|[\d.]+[KM]/.test(t) && /%/.test(t)) break;
      }
      const t = clean(row.textContent);
      const handle = clean(hEl.textContent);
      if (window.__rows.has(handle)) return;

      const followers  = (t.match(/([\d,.]+\s?[KMB])(?=\D*[\d.]+%)/) || [])[1] || '';
      const engagement = (t.match(/([\d.]+)\s?%/) || [])[1] || '';
      const img = row.querySelector('img');
      const links = [...row.querySelectorAll('a[href^="http"]')].map(a => a.href);
      const email = (t.match(/[\w.\-+]+@[\w\-]+\.[a-z]{2,}/i) || [])[0] || '';
      // name = first non-empty text line before the bio
      const name = clean((row.innerText || '').split('\n').map(clean).filter(Boolean)[0] || '');

      window.__rows.set(handle, {
        handle,
        name,
        profile_url: `https://instagram.com/${handle.replace('@', '')}`,
        followers,
        engagement_pct: engagement,
        email,
        avatar: img ? img.src : '',
        links: links.join(' | '),
        raw: t.slice(0, 500),
      });
    });

    const rows = [...window.__rows.values()];
    console.table(rows.map(({ raw, avatar, ...r }) => r));
    console.log(`total collected: ${rows.length}`);

    if (download) {
      const cols = Object.keys(rows[0] || {});
      const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'heepsy-dom.csv'; a.click();
    }
    return rows;
  };

  console.log('%cready → run heepsyRows() ... then heepsyRows(true) to download', 'color:#08f;font-weight:bold');
})();

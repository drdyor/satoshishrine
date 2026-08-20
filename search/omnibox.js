/* Local-only SatoshiShrine omnibox. It retrieves static shards; it never sends a query. */
(() => {
  const open = document.querySelector('#shrine-search-open');
  const dialog = document.querySelector('#shrine-search');
  const input = document.querySelector('#shrine-search-input');
  const close = document.querySelector('#shrine-search-close');
  const results = document.querySelector('#shrine-search-results');
  if (!open || !dialog || !input || !close || !results) return;
  const shards = {};
  let manifest;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const norm = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const dist = (left, right) => {
    const row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let index = 1; index <= left.length; index += 1) {
      let previous = row[0]; row[0] = index;
      for (let inner = 1; inner <= right.length; inner += 1) {
        const next = row[inner];
        row[inner] = Math.min(row[inner] + 1, row[inner - 1] + 1, previous + (left[index - 1] === right[inner - 1] ? 0 : 1));
        previous = next;
      }
    }
    return row[right.length];
  };
  const getManifest = async () => {
    if (!manifest) {
      manifest = await fetch('/search/manifest.json').then(response => {
        if (!response.ok) throw new Error('Local search manifest is unavailable');
        return response.json();
      });
    }
    return manifest;
  };
  const load = async () => {
    const index = await getManifest();
    const names = Object.keys(index.shards || {});
    await Promise.all(names.map(async name => {
      if (!shards[name]) {
        shards[name] = await fetch(`/search/${name}.json`).then(response => {
          if (!response.ok) throw new Error(`Local ${name} shard is unavailable`);
          return response.json();
        });
      }
    }));
    return names.flatMap(name => shards[name].entries || []);
  };
  const score = (query, entry) => {
    const target = norm(entry.search_text);
    const terms = target.split(/\s+/);
    let total = 0;
    for (const token of norm(query).split(/\s+/)) {
      if (target.includes(token)) { total += 100; continue; }
      const limit = Math.max(1, Math.floor(token.length * 0.25));
      const candidates = terms.filter(term => Math.abs(term.length - token.length) <= limit + 1).map(term => dist(token, term));
      const best = candidates.length ? Math.min(...candidates) : 99;
      if (best > limit) return -1;
      total += 40 - best;
    }
    return total;
  };
  const render = async () => {
    const query = input.value.trim();
    if (query.length < 2) {
      results.innerHTML = '<p class="shrine-search-note">Enter at least two characters to search local held-source indexes.</p>';
      return;
    }
    results.innerHTML = '<p class="shrine-search-note">Loading local held-source shards…</p>';
    try {
      const matches = (await load()).map(entry => ({ entry, score: score(query, entry) })).filter(row => row.score >= 0).sort((left, right) => right.score - left.score || left.entry.title.localeCompare(right.entry.title)).slice(0, 36);
      if (!matches.length) {
        results.innerHTML = '<p class="shrine-search-empty"><b>Not in the held corpus.</b> This search checked all 149 held MiCA articles, held DAC8 amending text, Level 2 source records, entities, jurisdictions, markets, and indexed pages. Absence from a held index is not a finding about an entity or provision.</p>';
        return;
      }
      const groups = {};
      matches.forEach(row => (groups[row.entry.group] ||= []).push(row));
      results.innerHTML = Object.entries(groups).sort(([, left], [, right]) => right[0].score - left[0].score).map(([group, rows]) => `<section class="shrine-search-group"><h2>${esc(group)}</h2>${rows.slice(0, 8).map(row => { const entry = row.entry; return `<a class="shrine-search-result" href="${esc(entry.route)}"><b>${esc(entry.title)}</b><small>${esc(entry.subtitle)}</small><code>${esc(entry.evidence.artifact)} · sha256 ${esc(entry.evidence.sha256)}</code></a>`; }).join('')}</section>`).join('');
    } catch (error) {
      results.innerHTML = '<p class="shrine-search-empty">Local held-source indexes could not be loaded. No result is inferred.</p>';
    }
  };
  const show = () => { dialog.dataset.open = 'true'; input.focus(); };
  const hide = () => { dialog.dataset.open = 'false'; open.focus(); };
  open.addEventListener('click', show);
  close.addEventListener('click', hide);
  input.addEventListener('input', render);
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); show(); }
    if (event.key === 'Escape' && dialog.dataset.open === 'true') hide();
  });
})();

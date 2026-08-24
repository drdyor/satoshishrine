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
  // Cache the PROMISE, not the result. The previous form assigned shards[name] AFTER its
  // await, so every concurrent render saw an empty cache and started its own fetch: typing a
  // 34-character question triggered ~34 downloads of every shard (observed in a browser
  // 2026-08-23, pages.json fetched 14+ times for one query). That was the 4.6-second cold
  // latency, and it is why an early render finished first and painted results for a stale
  // prefix. One in-flight fetch per shard, shared by every waiting render.
  const load = async () => {
    const index = await getManifest();
    const names = Object.keys(index.shards || {});
    const pending = names.map(name => {
      if (!shards[name]) {
        shards[name] = fetch(`/search/${name}.json`).then(response => {
          if (!response.ok) {
            shards[name] = null;  // let a later attempt retry rather than caching a failure
            throw new Error(`Local ${name} shard is unavailable`);
          }
          return response.json();
        });
      }
      return shards[name];
    });
    const loaded = await Promise.all(pending);
    return loaded.flatMap(shard => (shard && shard.entries) || []);
  };
  // How people ask for a thing, mapped to the word the Official Journal uses for it. Short on
  // purpose: every pair is a word a reader plausibly types for a term the corpus really
  // contains. A synonym can only help a query REACH held text; it never changes what the text
  // says. Measured need: "licence" returned nothing across 9,516 entries because MiCA says
  // "authorisation" (2026-08-23).
  const SYNONYMS = {
    licence: 'authorisation', license: 'authorisation', licensed: 'authorised',
    licensing: 'authorisation', permit: 'authorisation', approval: 'authorisation',
    rules: 'requirements', rule: 'requirement', duties: 'obligations', duty: 'obligation',
    must: 'shall', deadline: 'time', timeline: 'time', dates: 'application',
    report: 'reporting', reports: 'reporting', notify: 'notification',
    safe: 'safekeeping', safety: 'safeguarding', storing: 'safekeeping', store: 'custody',
    screening: 'recruitment', cv: 'recruitment', resume: 'recruitment', hiring: 'recruitment',
    outage: 'incident', breach: 'incident', downtime: 'incident', resilience: 'operational',
    transfer: 'transfers', wallet: 'crypto', exchange: 'exchange', firm: 'provider',
    company: 'provider', us: 'provider', we: 'provider', our: 'provider',
  };
  // Words that carry no discriminating power in a legal corpus; ignored rather than scored.
  const STOP = new Set(['the','a','an','and','or','of','to','in','on','for','is','are','do','does',
    'did','i','we','you','it','be','been','have','has','what','when','who','how','why','which',
    'my','your','their','there','this','that','with','from','at','by','as','if','can','could',
    'would','should','get','got','need','needs','make','makes','any','all','about','into','out']);

  const score = (query, entry) => {
    const target = norm(entry.search_text);
    const title = norm(entry.title);
    const terms = target.split(/\s+/);
    const asked = norm(query).split(/\s+/).filter(Boolean);
    const meaningful = asked.filter(token => !STOP.has(token) && token.length > 2);
    // A query of nothing but stop-words scores on what it has rather than on nothing.
    const tokens = meaningful.length ? meaningful : asked;
    let total = 0;
    let matched = 0;
    let strong = 0;
    for (const token of tokens) {
      const alias = SYNONYMS[token];
      // A title token is worth five body tokens: the title is the most concentrated statement
      // of what a provision is about, and body-only matching let a 12,708-character definitions
      // article outrank the provision actually on the subject.
      if (title.includes(token) || (alias && title.includes(alias))) {
        total += 500; matched += 1; strong += 1; continue;
      }
      if (target.includes(token) || (alias && target.includes(alias))) {
        total += 100; matched += 1; strong += 1; continue;
      }
      const limit = Math.max(1, Math.floor(token.length * 0.25));
      const candidates = terms.filter(term => Math.abs(term.length - token.length) <= limit + 1).map(term => dist(token, term));
      const best = candidates.length ? Math.min(...candidates) : 99;
      // An unmatched token costs points; it no longer discards an entry that answers most of
      // the question. The coverage floor below is what keeps this from becoming a bag of words.
      if (best > limit) { total -= 25; continue; }
      matched += 1;
      total += 40 - best;
    }
    // Coverage floor: at least half the meaningful words must be present, and at least one
    // must match outright. Without this a long question would drag in loosely-related text and
    // "nothing found" would stop meaning anything.
    if (!strong || matched * 2 < tokens.length) return -1;
    // Length normalisation. Without it the longest entries win every broad question simply by
    // containing more words. Log, not linear, so a long provision that is genuinely on-topic is
    // not punished into irrelevance.
    return Math.round(total / Math.log(120 + terms.length));
  };
  // Query shape decides which index can answer. Article and CELEX references are exact
  // lookups, which dense embeddings measurably miss -- Article 62 and Article 113 were both
  // absent from the semantic top 50 (2026-08-23). Questions go the other way: the keyword
  // scorer reached 1 of 7 natural questions at rank 1, the semantic index 2 of 7 and without
  // needing a synonym for "licence".
  const LOOKUP = /\b(art\.?|article)\s*\d+|\bannex\s+[ivxlcdm]+\b|\b\d{4}\/\d+\b|\b3\d{4}[a-z]\d+\b/i;
  const ASKING = /\b(what|when|who|why|how|which|where|do|does|did|is|are|can|could|should|must|need)\b/i;
  const classify = value => {
    const text = String(value || '').trim();
    if (LOOKUP.test(text)) return 'lookup';
    const words = text.split(/\s+/).filter(Boolean);
    if (ASKING.test(text) || words.length > 4) return 'question';
    return 'phrase';
  };

  // Renders race. `input` fires per keystroke and render awaits load(), whose FIRST call
  // downloads the shards -- so the render for the first few characters resolves LAST and
  // overwrites everything typed after it. A visitor typing a question on a cold cache saw
  // results for a stale prefix, and the hand-off link carried that prefix too (observed in a
  // browser 2026-08-23: a full question produced /pathfinder?q=is%20ou). Only the newest
  // render may write.
  let renderGeneration = 0;
  const render = async () => {
    const generation = ++renderGeneration;
    const query = input.value.trim();
    if (query.length < 2) {
      results.innerHTML = '<p class="shrine-search-note">Enter at least two characters to search local held-source indexes.</p>';
      return;
    }
    results.innerHTML = '<p class="shrine-search-note">Loading local held-source shards…</p>';
    try {
      const matches = (await load()).map(entry => ({ entry, score: score(query, entry) })).filter(row => row.score >= 0).sort((left, right) => right.score - left.score || left.entry.title.localeCompare(right.entry.title)).slice(0, 36);
      if (generation !== renderGeneration) return;
      if (!matches.length) {
        const shape = classify(query);
        if (shape === 'question') {
          results.innerHTML = `<p class="shrine-search-route"><b>That reads like a question.</b> This box matches words, so a question often finds nothing even when the corpus holds the answer. <a href="/pathfinder?q=${encodeURIComponent(query)}">Describe your situation in the source finder →</a></p>`;
          return;
        }
        results.innerHTML = '<p class="shrine-search-empty"><b>Not in the held corpus.</b> This search checked all 149 held MiCA articles, held DAC8 amending text, Level 2 source records, entities, jurisdictions, markets, indexed pages, and held funding source records. Absence from a held index is not a finding about an entity, provision, or funding program.</p>';
        return;
      }
      // Match-centered excerpt with the query highlighted, so a hit shows WHERE it hit.
      const excerptFor = (entry, rawQuery) => {
        const text = String(entry.search_text || '');
        if (text.length < 40) return '';
        // Typographic punctuation: EUR-Lex publishes ’ ‘ “ ” – —, keyboards produce ' " -.
        // Without this, searching clients' crypto-assets misses clients’ crypto-assets and the
        // reader is told the phrase is not in the corpus when it is (found 2026-08-23).
        const flat = value => String(value ?? '').toLowerCase()
          .replace(/[\u2018\u2019\u201a\u201b\u2032]/g, "'")
          .replace(/[\u201c\u201d\u201e\u2033]/g, '"')
          .replace(/[\u2010-\u2015\u2212]/g, '-')
          .replace(/\u00a0/g, ' ');
        const tokens = flat(rawQuery).split(/\s+/).filter(token => token.length > 2);
        const lower = flat(text);
        let at = -1;
        for (const token of tokens) { const hit = lower.indexOf(token); if (hit >= 0 && (at < 0 || hit < at)) at = hit; }
        if (at < 0) return '';
        const start = Math.max(0, at - 90);
        const end = Math.min(text.length, at + 170);
        let slice = (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
        slice = esc(slice);
        for (const token of tokens) { const loose = token.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&').replace(/['"-]/g, "[\u2018\u2019'\"\u201c\u201d\u2010-\u2015-]"); slice = slice.replace(new RegExp(`(${loose})`, 'ig'), '<mark>$1</mark>'); }
        return `<span class="shrine-search-excerpt">${slice}</span>`;
      };
      // A question-shaped query is handed to the semantic finder ABOVE the keyword results.
      // Placed after them it reads as an apology for a poor answer rather than as a route.
      const shape = classify(query);
      const handoff = shape === 'question'
        ? `<p class="shrine-search-route"><b>That reads like a question.</b> The keyword search
           below matches words. To describe your situation in your own words and get the
           closest held sources, <a href="/pathfinder?q=${encodeURIComponent(query)}">open the
           source finder →</a></p>`
        : '';
      const groups = {};
      matches.forEach(row => (groups[row.entry.group] ||= []).push(row));
      results.innerHTML = handoff + Object.entries(groups).sort(([, left], [, right]) => right[0].score - left[0].score).map(([group, rows]) => `<section class="shrine-search-group"><h2>${esc(group)}</h2>${rows.slice(0, 8).map(row => { const entry = row.entry; return `<a class="shrine-search-result" href="${esc(entry.route)}"><b>${esc(entry.title)}</b><small>${esc(entry.subtitle)}</small>${excerptFor(entry, query)}<code>${esc(entry.evidence.artifact)} · sha256 ${esc(entry.evidence.sha256)}</code></a>`; }).join('')}</section>`).join('');
    } catch (error) {
      results.innerHTML = '<p class="shrine-search-empty">Local held-source indexes could not be loaded. No result is inferred.</p>';
    }
  };
  const show = () => { dialog.dataset.open = 'true'; input.focus(); };
  const hide = () => { dialog.dataset.open = 'false'; open.focus(); };
  open.addEventListener('click', show);
  close.addEventListener('click', hide);
  // Debounce. The generation guard stops a stale render from PAINTING, but every keystroke
  // still scored ~10,000 entries with a Levenshtein pass per token, so a 34-character question
  // ran 34 full scans and took 84 seconds to first result in a browser (2026-08-23). Only the
  // settled query is worth scoring.
  let debounce = null;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(render, 180);
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); show(); }
    if (event.key === 'Escape' && dialog.dataset.open === 'true') hide();
  });
})();

/* SatoshiShrine semantic retrieval: source-bounded, browser-only, and no-network by design.
 * The model loading, the int8 recovery, the cosine and the floor live in semantic-core.js and
 * are IMPORTED, not repeated here. /checkup/ imports the same module. When this file held its
 * own copy, the second consumer copied it wrong and reported a false absence in production. */
import * as core from '/semantic/semantic-core.js';

(() => {
  const root = document.querySelector('#semantic-retrieval');
  if (!root) return;
  const input = root.querySelector('#semantic-query');
  const button = root.querySelector('#semantic-submit');
  const status = root.querySelector('#semantic-status');
  const results = root.querySelector('#semantic-results');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let corpus, extractor;
  // Shards already fetched, by instrument. The corpus only ever GROWS: a later query that
  // needs an instrument we have not fetched adds it, and one that needs fewer still searches
  // everything loaded. Narrowing a cached corpus would let a second question be answered
  // 'nothing close' from a shard set chosen for the first -- false absence, which is the one
  // failure this site exists to avoid.
  const fetchedShards = new Map();
  const localOnly = async () => {
    // No early return on a cached corpus: the wanted instruments are resolved first.
    const extractorPromise = core.loadExtractor();
    // Which instruments a query names. Fetching only those is the point of the split; the
    // FALLBACK is what keeps it honest -- a query naming none loads every instrument, because
    // narrowing the corpus and reporting the result as absence is the one failure this site
    // exists to avoid.
    const INSTRUMENT_HINTS = {
      mica: /\bmica\b|crypto-?asset service|casp\b|32023r1114/i,
      aiact: /\bai act\b|artificial intelligence|high[- ]risk ai|gpai|32024r1689/i,
      dora: /\bdora\b|operational resilience|ict (risk|incident)|32022r2554/i,
      tfr: /\btfr\b|transfer of funds|travel rule|unhosted|32023r1113/i,
      dac8: /\bdac ?8\b|tax report|reporting crypto-asset|32023l2226/i,
      level2: /\bguideline|\brts\b|\bits\b|technical standard|\beba\b|\besma\b/i,
    };
    const manifest = await fetch('/semantic/manifest.json')
      .then(response => response.ok ? response.json() : null).catch(() => null);
    const available = (manifest && manifest.shards || [])
      .filter(shard => shard.instrument && shard.instrument !== 'combined');
    const asked = String(input.value || '');
    let wanted = available.filter(shard => {
      const hint = INSTRUMENT_HINTS[shard.instrument];
      return hint ? hint.test(asked) : false;
    });
    if (!wanted.length) { wanted = available; }
    const paths = wanted.length
      ? wanted.map(shard => '/' + shard.path)
      : ['/semantic/shards/held-sources.json'];

    const missing = paths.filter(path => !fetchedShards.has(path));
    const [fetchedParts, extractorReady] = await Promise.all([
      Promise.all(missing.map(path => fetch(path).then(response => {
        if (!response.ok) throw new Error('The local held-source vector shard is unavailable.');
        return response.json();
      }))),
      extractor || extractorPromise,
    ]);
    missing.forEach((path, index) => fetchedShards.set(path, fetchedParts[index]));
    const active = [...fetchedShards.values()];
    corpus = active.length === 1 ? active[0] : {
      schema_version: active[0].schema_version,
      vector_dimensions: active[0].vector_dimensions,
      chunks: active.flatMap(part => part.chunks),
      vectors: active.flatMap(part => part.vectors),
    };
    corpus.instruments_loaded = [...fetchedShards.keys()];
    extractor = extractorReady;
    return { corpus, extractor };
  };
  const rank = (query, source) => core.rank(query, core.recover(source.vectors));
  const render = rows => {
    results.innerHTML = rows.map(({index, score}) => {
      const chunk = corpus.chunks[index], p = chunk.provenance;
      return `<article class="citation-card semantic-result"><p class="eyebrow">Held source · local semantic rank</p><h3>${esc(chunk.title)}</h3><p class="quote">${esc(chunk.text)}</p><p class="citation-meta">${esc(p.artifact)} · sha256 ${esc(p.sha256)}<br>${esc(p.locator)} · held ${esc(p.retrieved_at)}<br><a href="${esc(p.official_url)}" target="_blank" rel="noopener">Open official source →</a></p><p class="citation-meta">${esc(chunk.method_boundary)}</p></article>`;
    }).join('');
  };
  const search = async () => {
    const text = input.value.trim();
    if (text.length < 4) { status.textContent = 'Describe the topic in at least four characters. No source is ranked yet.'; results.innerHTML = ''; return; }
    button.disabled = true; status.textContent = 'Loading the local open model and held-source vectors. Your text remains in this browser.';
    try {
      const loaded = await localOnly();
      const output = await loaded.extractor(text, { pooling: 'mean', normalize: true });
      const ranked = rank(Array.from(output.data), loaded.corpus);
      const threshold = core.FLOOR;
      if (!ranked.length || ranked[0].score < threshold) {
        status.textContent = 'The held corpus contains nothing close to this. Searched: held legislative and source-surface records in this browser’s local semantic index. Review those held records above; this does not establish an absence beyond that held index or a conclusion about the described situation.';
        results.innerHTML = '';
        return;
      }
      status.textContent = 'Held sources are ranked locally by similarity. Ranking does not determine whether a source applies.';
      render(ranked.filter(row => row.score >= threshold).slice(0, 5));
    } catch (error) {
      status.textContent = `Local semantic retrieval is unavailable: ${error.message} No remote fallback or result is used.`;
      results.innerHTML = '';
    } finally { button.disabled = false; }
  };
  // Arrive from the omnibox hand-off with the question already asked. Landing on an empty
  // box after being told to come here is a dead end, not a route.
  const handed = new URLSearchParams(location.search).get('q');
  if (handed) { input.value = handed; }

  button.addEventListener('click', search);
  if (handed) { search(); }
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); search(); } });
})();

/* SatoshiShrine semantic retrieval: source-bounded, browser-only, and no-network by design. */
(() => {
  const root = document.querySelector('#semantic-retrieval');
  if (!root) return;
  const input = root.querySelector('#semantic-query');
  const button = root.querySelector('#semantic-submit');
  const status = root.querySelector('#semantic-status');
  const results = root.querySelector('#semantic-results');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let corpus, extractor, api;
  const localOnly = async () => {
    if (corpus && extractor) return { corpus, extractor };
    api ??= await import('/semantic/vendor/transformers.min.js');
    if (!api?.pipeline || !api?.env) throw new Error('The local semantic runtime did not load. No remote fallback is used.');
    api.env.allowRemoteModels = false;
    api.env.allowLocalModels = true;
    api.env.useBrowserCache = false;
    api.env.localModelPath = '/semantic/models/';
    api.env.backends.onnx.wasm.wasmPaths = '/semantic/vendor/';
    api.env.backends.onnx.wasm.numThreads = 1;
    [corpus, extractor] = await Promise.all([
      fetch('/semantic/shards/held-sources.json').then(response => { if (!response.ok) throw new Error('The local held-source vector shard is unavailable.'); return response.json(); }),
      api.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true }),
    ]);
    return { corpus, extractor };
  };
  const rank = (query, source) => {
    const recovered = source.vectors.map(vector => vector.q8.map(value => value * vector.scale));
    return recovered.map((vector, index) => ({ index, score: vector.reduce((sum, value, position) => sum + value * query[position], 0) / Math.max(Math.hypot(...vector), 1e-12) })).sort((a, b) => b.score - a.score);
  };
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
      const threshold = 0.43;
      if (!ranked.length || ranked[0].score < threshold) {
        status.textContent = 'The held corpus contains nothing close to this. Review the held legislative and source-surface records above; this is not a conclusion about the described situation.';
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
  button.addEventListener('click', search);
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); search(); } });
})();

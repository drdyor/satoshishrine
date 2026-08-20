/* SatoshiShrine Task 3: browser-local watchlists only. No account or server write exists. */
(() => {
  const KEY = 'satoshishrine.watchlist.v1';
  const CATALOG = '/watchlist/catalog.json';
  const MANIFEST = '/watchlist/manifest.json';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const now = () => new Date().toISOString();
  let catalogPromise;
  const read = () => { try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string') : []; } catch { return []; } };
  const write = items => localStorage.setItem(KEY, JSON.stringify(items));
  const localCatalog = () => catalogPromise ??= fetch(CATALOG).then(r => { if (!r.ok) throw new Error('The static watchlist catalog is unavailable.'); return r.json(); });
  const buttonText = (watched, kind) => watched ? `Remove ${kind} watch` : `Watch this ${kind}`;
  const watched = id => read().some(item => item.id === id);
  const count = () => read().length;
  const updateNav = () => document.querySelectorAll('[data-watch-count]').forEach(node => { node.textContent = String(count()); });
  const resolve = async control => {
    const catalog = await localCatalog();
    if (control.dataset.watchId) return catalog.items.find(item => item.id === control.dataset.watchId) || null;
    return catalog.items.find(item => item.kind === control.dataset.watchKind && item.title === control.dataset.watchTitle && (!control.dataset.watchSha || item.provenance.sha256 === control.dataset.watchSha)) || null;
  };
  const refreshControls = async () => {
    let catalog;
    try { catalog = await localCatalog(); } catch { return; }
    document.querySelectorAll('[data-watch-kind]').forEach(control => {
      const item = control.dataset.watchId ? catalog.items.find(row => row.id === control.dataset.watchId) : catalog.items.find(row => row.kind === control.dataset.watchKind && row.title === control.dataset.watchTitle && (!control.dataset.watchSha || row.provenance.sha256 === control.dataset.watchSha));
      if (!item) { control.disabled = true; control.title = 'This source record is unavailable in the current local watchlist catalog.'; return; }
      control.dataset.watchId = item.id;
      const label = buttonText(watched(item.id), item.kind);
      if (control.textContent !== label) control.textContent = label;
    });
  };
  const addNav = () => document.querySelectorAll('.topnav').forEach(nav => {
    if (nav.querySelector('[data-watchlist-nav]')) return;
    const link = document.createElement('a'); link.href = '/watchlist.html'; link.dataset.watchlistNav = 'true'; link.innerHTML = 'Watchlist <span data-watch-count>0</span>'; nav.append(link);
  });
  const renderWatchlist = async () => {
    const root = document.querySelector('#watchlist-root'); if (!root) return;
    const status = document.querySelector('#watchlist-status');
    try {
      const [catalog, manifest] = await Promise.all([localCatalog(), fetch(MANIFEST).then(r => r.json())]);
      const records = read(), known = new Map(catalog.items.map(item => [item.id, item]));
      const live = records.map(record => known.get(record.id)).filter(Boolean);
      const archive = catalog.latest_weekly_archive;
      const mention = item => `No literal label mention for “${item.title}” was found in the latest ${archive.week || 'available'} source-comparison record. That is not a finding about the item.`;
      if (!live.length) {
        root.innerHTML = `<section class="watch-empty" data-watch-zero-state="true"><h2>No local watches in this browser.</h2><p>Checked localStorage key <code>${KEY}</code> and the current static catalog <code>${esc(manifest.catalog.path)}</code> · sha256 ${esc(manifest.catalog.sha256)}. Latest archive checked: <a href="${esc(archive.route)}">${esc(archive.route)}</a>.</p><p>${esc(catalog.boundary)}</p></section>`;
        status.textContent = 'Zero-watch state shown from this browser’s local storage and the current static evidence catalog.'; return;
      }
      root.innerHTML = live.map(item => `<article class="watch-card"><p class="eyebrow">${esc(item.kind)} · browser-local watch</p><h2><a href="${esc(item.route)}">${esc(item.title)}</a></h2><p class="sub">${esc(item.current_state)}</p><p class="citation-meta">${esc(item.provenance.artifact)} · sha256 ${esc(item.provenance.sha256)}<br>${esc(item.provenance.locator)} · held ${esc(item.provenance.retrieved_at)}<br><a href="${esc(item.provenance.official_url)}" target="_blank" rel="noopener">Open official source →</a></p><p class="sub"><b>Latest /week source-diff mention.</b> ${esc(mention(item))} <a href="${esc(archive.route)}">Open archived record →</a></p><button type="button" data-watch-kind="${esc(item.kind)}" data-watch-id="${esc(item.id)}">Remove ${esc(item.kind)} watch</button></article>`).join('');
      status.textContent = `${live.length} local watch${live.length === 1 ? '' : 'es'} rendered from the current static catalog. No account or server storage is used.`;
      updateNav();
    } catch (error) { status.textContent = `Local watchlist is unavailable: ${error.message} No watch state is inferred.`; root.innerHTML = ''; }
  };
  const exportItems = () => {
    const body = JSON.stringify({schema_version:'satoshishrine-watchlist-v1', exported_at:now(), items:read(), boundary:'Browser-local watch references only; export does not establish a record state.'}, null, 2);
    const url = URL.createObjectURL(new Blob([body], {type:'application/json'})); const link = document.createElement('a'); link.href = url; link.download = 'satoshishrine-watchlist.json'; link.click(); URL.revokeObjectURL(url);
  };
  const importItems = async file => {
    const payload = JSON.parse(await file.text()); if (payload?.schema_version !== 'satoshishrine-watchlist-v1' || !Array.isArray(payload.items)) throw new Error('The selected file is not a SatoshiShrine watchlist export.');
    const catalog = await localCatalog(), allowed = new Set(catalog.items.map(item => item.id)); const valid = payload.items.filter(item => item && allowed.has(item.id));
    if (!valid.length && payload.items.length) throw new Error('The export contains no watch IDs in the current static catalog.');
    const merged = new Map(read().map(item => [item.id, item])); valid.forEach(item => merged.set(item.id, {id:item.id, added_at:item.added_at || now()})); write([...merged.values()]); updateNav(); await refreshControls(); await renderWatchlist();
  };
  document.addEventListener('click', async event => {
    const control = event.target.closest('[data-watch-kind]'); if (!control || control.disabled) return;
    event.preventDefault();
    try { const item = await resolve(control); if (!item) throw new Error('This held record is unavailable in the current watchlist catalog.'); const values = read(); write(watched(item.id) ? values.filter(row => row.id !== item.id) : [...values, {id:item.id, added_at:now()}]); updateNav(); await refreshControls(); await renderWatchlist(); } catch (error) { control.title = error.message; }
  });
  document.addEventListener('DOMContentLoaded', () => {
    addNav(); updateNav(); refreshControls();
    const exportButton = document.querySelector('#watch-export'); if (exportButton) exportButton.addEventListener('click', exportItems);
    const importInput = document.querySelector('#watch-import'); if (importInput) importInput.addEventListener('change', async event => { const status = document.querySelector('#watchlist-status'); try { if (event.target.files?.[0]) await importItems(event.target.files[0]); } catch (error) { status.textContent = `Import rejected: ${error.message}`; } finally { event.target.value = ''; } });
    renderWatchlist(); new MutationObserver(() => refreshControls()).observe(document.body, {childList:true,subtree:true});
  });
})();

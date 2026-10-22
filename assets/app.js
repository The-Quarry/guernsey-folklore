(() => {
  'use strict';

  const CATS = {
    fairies: { label: 'Fairies', fr: 'Les pouques' },
    witches: { label: 'Witches', fr: 'Les sorciers' },
    beasts:  { label: 'The Devil and his beasts', fr: 'Lé Diable' },
    ghosts:  { label: 'Ghosts', fr: 'Les revenants' },
    stones:  { label: 'Old stones and customs', fr: 'Les vieilles pierres' }
  };
  const GLYPH = {
    fairies: '<path d="M15 9.5 L16.3 13.7 L20.5 15 L16.3 16.3 L15 20.5 L13.7 16.3 L9.5 15 L13.7 13.7 Z" fill="var(--sea)"/>',
    witches: '<path d="M17.8 10.4 A5 5 0 1 0 17.8 19.6 A4 4 0 1 1 17.8 10.4 Z" fill="var(--sea)"/>',
    beasts:  '<circle cx="12.2" cy="12.6" r="1.3" fill="var(--sea)"/><circle cx="15" cy="11.4" r="1.3" fill="var(--sea)"/><circle cx="17.8" cy="12.6" r="1.3" fill="var(--sea)"/><ellipse cx="15" cy="17" rx="3.2" ry="2.6" fill="var(--sea)"/>',
    ghosts:  '<path d="M11.5 20 V14.5 A3.5 3.5 0 0 1 18.5 14.5 V20 L17.3 18.8 L16.2 20 L15 18.8 L13.8 20 L12.7 18.8 Z" fill="var(--sea)"/>',
    stones:  '<path d="M13 20.5 L13.4 11.5 Q15 9 16.6 11.5 L17 20.5 Z" fill="var(--sea)"/>'
  };
  const GUERNSEY = [[49.405, -2.685], [49.515, -2.50]];
  const NUMBERS = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const $ = id => document.getElementById(id);
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const words = n => n <= 20 ? NUMBERS[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + NUMBERS[n % 10].toLowerCase() : '') : String(n);
  const fmt = (v, pos, neg) => Math.abs(v).toFixed(4) + '° ' + (v >= 0 ? pos : neg);
  const km = (a, b) => {
    const R = 6371, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const pinHtml = (cat, num) => `<svg viewBox="0 0 30 30" aria-hidden="true">
    <circle class="halo" cx="15" cy="15" r="14" fill="none" stroke="var(--c-${cat})" stroke-opacity=".55" stroke-width="1.5"/>
    <circle cx="15" cy="15" r="9.5" fill="var(--c-${cat})" stroke="var(--sea)" stroke-width="1.5"/>
    ${num ? `<text class="num" x="15" y="19.3" text-anchor="middle" fill="var(--sea)">${num}</text>` : GLYPH[cat]}
  </svg>`;
  const pinIcon = (cat, num) => L.divIcon({ className: 'pin', html: pinHtml(cat, num), iconSize: [30, 30], iconAnchor: [15, 15] });

  const map = L.map('map', { zoomControl: true, attributionControl: true, minZoom: 10, maxZoom: 18 });
  map.fitBounds(GUERNSEY);
  // Basemap: CARTO Dark Matter. The key is restricted to *.thequarry.media in the CARTO dashboard.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_4rrh_1_787f5809ade6f105fa27d8a3', {
    subdomains: 'abcd', maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map);

  const cluster = L.markerClusterGroup({
    maxClusterRadius: 22, disableClusteringAtZoom: 15, showCoverageOnHover: false, spiderfyOnMaxZoom: true,
    iconCreateFunction: c => L.divIcon({ className: '', html: `<div class="cluster">${c.getChildCount()}</div>`, iconSize: [34, 34] })
  }).addTo(map);
  const walkLayer = L.layerGroup();

  let SITES = [], WALKS = [], byId = {}, markers = {}, current = null, currentWalk = null, view = 'sites';
  const active = new Set(Object.keys(CATS));

  Promise.all([
    fetch('data/sites.geojson').then(r => r.json()),
    fetch('data/routes.json').then(r => r.json())
  ]).then(([gj, routes]) => {
    SITES = gj.features.map(f => ({ ...f.properties, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
    SITES.forEach(s => { byId[s.id] = s; });
    WALKS = routes.map(w => ({ ...w, stops: w.stops.filter(id => byId[id]) }));
    $('count').textContent = words(SITES.length);
    buildMarkers();
    buildFilters();
    buildList();
    buildWalks();
    openFromHash();
  }).catch(() => {
    $('list').innerHTML = '<li class="fine">The map data could not be loaded. Please refresh the page.</li>';
  });

  function buildMarkers() {
    SITES.forEach(s => {
      const m = L.marker([s.lat, s.lon], { icon: pinIcon(s.category), title: s.name, riseOnHover: true, keyboard: true });
      m.bindTooltip(`${esc(s.name)}<small>${esc(s.parish.toUpperCase())}</small>`, { className: 'tip', direction: 'top', offset: [0, -14] });
      m.on('click', () => select(s.id, false));
      markers[s.id] = m;
    });
    syncMarkers();
  }

  function syncMarkers() {
    cluster.clearLayers();
    cluster.addLayers(SITES.filter(s => active.has(s.category)).map(s => markers[s.id]));
  }

  function buildFilters() {
    const box = $('filters');
    Object.entries(CATS).forEach(([key, c]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.cat = key;
      b.style.setProperty('--c', `var(--c-${key})`);
      b.setAttribute('aria-pressed', 'true');
      b.innerHTML = `<span class="dot"></span>${c.label} <span class="n">${SITES.filter(s => s.category === key).length}</span>`;
      b.onclick = () => {
        active.has(key) ? active.delete(key) : active.add(key);
        if (!active.size) Object.keys(CATS).forEach(k => active.add(k));
        box.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', active.has(x.dataset.cat)));
        SITES.forEach(s => { $('li-' + s.id).hidden = !active.has(s.category); });
        if (current && !active.has(byId[current].category)) select(null);
        syncMarkers();
      };
      box.appendChild(b);
    });
  }

  function buildList() {
    const list = $('list');
    [...SITES].sort((a, b) => b.lat - a.lat).forEach(s => {
      const li = document.createElement('li'); li.id = 'li-' + s.id;
      li.innerHTML = `<button type="button" style="--c:var(--c-${s.category})"><span class="dot"></span><span class="nm">${esc(s.name)}</span><span class="ps">${esc(s.parish.toUpperCase())}</span></button>`;
      li.firstChild.onclick = () => select(s.id, true);
      list.appendChild(li);
    });
  }

  function walkLength(w) {
    let d = 0;
    for (let i = 1; i < w.stops.length; i++) d += km(byId[w.stops[i - 1]], byId[w.stops[i]]);
    return d;
  }

  function buildWalks() {
    const ul = $('walks');
    WALKS.forEach(w => {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button"><span class="nm">${esc(w.name)}</span><span class="ps">${w.stops.length} STOPS</span><span class="sm">${esc(w.summary)}</span></button>`;
      li.firstChild.onclick = () => selectWalk(w.id);
      ul.appendChild(li);
    });
  }

  function setView(v) {
    view = v;
    $('tab-sites').setAttribute('aria-selected', v === 'sites');
    $('tab-walks').setAttribute('aria-selected', v === 'walks');
    $('filters').hidden = v !== 'sites';
    $('list').hidden = v !== 'sites' || !!current;
    $('walks').hidden = v !== 'walks' || !!currentWalk;
    if (v === 'sites') clearWalk();
  }
  const reset = () => { if (current && markers[current] && markers[current].getElement()) L.DomUtil.removeClass(markers[current].getElement(), 'on'); current = null; clearWalk(); $('card').hidden = true; setHash(''); };
  $('tab-sites').onclick = () => { reset(); setView('sites'); };
  $('tab-walks').onclick = () => { reset(); setView('walks'); };

  function setHash(h) {
    try { history.replaceState(null, '', h ? '#' + h : location.pathname + location.search); } catch (e) { /* ignore */ }
  }

  function siteCard(s, backLabel) {
    const c = CATS[s.category];
    const osm = `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=17/${s.lat}/${s.lon}`;
    const plates = (s.images || []).map(im => `
      <figure class="plate"><a href="${esc(im.src)}" target="_blank" rel="noopener"><img src="${esc(im.src)}" alt="${esc(im.caption)}" loading="lazy"></a>
      <figcaption><b>${im.year || ''}</b>${esc(im.caption)}. ${esc(im.credit || '')}</figcaption></figure>`).join('');
    return `<button type="button" class="back" id="back">&larr; ${backLabel}</button>
      <div class="cat">${c.label.toUpperCase()} · ${esc(c.fr)}</div>
      <h2>${esc(s.name)}</h2>
      <p class="gloss">${esc(s.gloss)}</p>
      <div class="meta"><span><b>PARISH</b>${esc(s.parish)}</span><span><b>LOCATION</b>${s.location_precision === 'site' ? 'Site' : 'Approximate'}</span><span class="coord"><b>COORDINATES</b><a href="${osm}" target="_blank" rel="noopener">${fmt(s.lat, 'N', 'S')}, ${fmt(s.lon, 'E', 'W')}</a></span></div>
      ${s.access ? `<div class="notes"><b>VISITING</b>${esc(s.access)}</div>` : ''}
      ${plates ? `<div class="plates">${plates}</div>` : ''}
      <div class="story">${s.story.map(p => `<p>${esc(p)}</p>`).join('')}</div>
      <div class="src"><b>SOURCES</b><ul>${s.sources.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></li>`).join('')}</ul></div>`;
  }

  function select(id, fly) {
    if (current && markers[current]) L.DomUtil.removeClass(markers[current].getElement() || document.createElement('i'), 'on');
    current = id;
    const card = $('card');
    if (!id) {
      card.hidden = true;
      if (currentWalk) { showWalkCard(currentWalk); return; }
      setView(view);
      setHash('');
      return;
    }
    const s = byId[id]; if (!s) return;
    const inWalk = currentWalk && byId[id] && WALKS.find(w => w.id === currentWalk).stops.includes(id);
    if (!inWalk) {
      clearWalk();
      if (!active.has(s.category)) { active.add(s.category); $('filters').querySelector(`[data-cat="${s.category}"]`).setAttribute('aria-pressed', 'true'); $('li-' + s.id).hidden = false; syncMarkers(); }
      if (view !== 'sites') setView('sites');
    }
    card.style.setProperty('--c', `var(--c-${s.category})`);
    card.innerHTML = siteCard(s, inWalk ? 'BACK TO THE WALK' : 'ALL SITES');
    card.hidden = false; $('list').hidden = true; $('walks').hidden = true;
    $('back').onclick = () => select(null);
    setHash(id);
    if (inWalk) {
      if (fly) map.flyTo([s.lat, s.lon], Math.max(map.getZoom(), 16), { duration: .6 });
    } else {
      const go = () => cluster.zoomToShowLayer(markers[id], () => {
        const el = markers[id].getElement(); if (el) L.DomUtil.addClass(el, 'on');
        if (fly) map.flyTo([s.lat, s.lon], Math.max(map.getZoom(), 15), { duration: .6 });
      });
      go();
    }
    scrollPanel();
  }

  function scrollPanel() {
    if (matchMedia('(max-width:820px)').matches) $('panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    else $('panel').scrollTop = 0;
  }

  function clearWalk() {
    if (!currentWalk) return;
    currentWalk = null;
    walkLayer.clearLayers(); map.removeLayer(walkLayer);
    if (!map.hasLayer(cluster)) map.addLayer(cluster);
  }

  function selectWalk(id) {
    const w = WALKS.find(x => x.id === id); if (!w) return;
    current = null;
    currentWalk = id;
    if (view !== 'walks') { view = 'walks'; $('tab-sites').setAttribute('aria-selected', 'false'); $('tab-walks').setAttribute('aria-selected', 'true'); $('filters').hidden = true; }
    map.removeLayer(cluster);
    walkLayer.clearLayers();
    const pts = w.stops.map(sid => [byId[sid].lat, byId[sid].lon]);
    L.polyline(pts, { color: '#ece6d8', weight: 2, opacity: .7, dashArray: '4 7' }).addTo(walkLayer);
    w.stops.forEach((sid, i) => {
      const s = byId[sid];
      const m = L.marker([s.lat, s.lon], { icon: pinIcon(s.category, i + 1), title: s.name, zIndexOffset: 1000 });
      m.bindTooltip(`${i + 1}. ${esc(s.name)}<small>${esc(s.parish.toUpperCase())}</small>`, { className: 'tip', direction: 'top', offset: [0, -14] });
      m.on('click', () => select(sid, false));
      m.addTo(walkLayer);
    });
    walkLayer.addTo(map);
    map.flyToBounds(L.latLngBounds(pts).pad(0.25), { duration: .6, maxZoom: 16 });
    showWalkCard(id);
    setHash(id);
    scrollPanel();
  }

  function showWalkCard(id) {
    const w = WALKS.find(x => x.id === id);
    const card = $('card');
    card.style.removeProperty('--c');
    card.innerHTML = `<button type="button" class="back" id="back">&larr; ALL WALKS</button>
      <div class="cat" style="--c:var(--c-witches)">WALK · ${w.stops.length} STOPS</div>
      <h2>${esc(w.name)}</h2>
      <p class="gloss">${esc(w.summary)}</p>
      <div class="meta"><span><b>BETWEEN STOPS</b>About ${walkLength(w).toFixed(1)} km in straight lines</span></div>
      <div class="stops"><b>STOPS IN ORDER</b><ol>${w.stops.map((sid, i) => { const s = byId[sid]; return `<li><button type="button" data-id="${sid}" style="--c:var(--c-${s.category})"><span class="k">${i + 1}</span><span class="nm">${esc(s.name)}</span><span class="ps">${esc(s.parish.toUpperCase())}</span></button></li>`; }).join('')}</ol></div>
      ${w.notes.length ? `<div class="notes"><b>BEFORE YOU GO</b><ul>${w.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
      <p class="fine">The dashed line joins the stops in order. It does not follow roads or paths, and the walking distance will be longer. Many sites are on private land; keep to public roads and paths.</p>`;
    card.hidden = false; $('list').hidden = true; $('walks').hidden = true;
    $('back').onclick = () => { clearWalk(); card.hidden = true; setView('walks'); setHash(''); map.flyToBounds(GUERNSEY, { duration: .6 }); };
    card.querySelectorAll('.stops button').forEach(b => { b.onclick = () => select(b.dataset.id, true); });
  }

  function openFromHash() {
    const h = decodeURIComponent((location.hash || '').slice(1));
    if (!h) return;
    if (byId[h]) select(h, true);
    else if (WALKS.some(w => w.id === h)) selectWalk(h);
  }
  window.addEventListener('hashchange', openFromHash);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && (current || currentWalk)) { if (current) select(null); else $('back') && $('back').click(); } });
})();

/* LNMusic: tambahan tab Playlist (web + APK)
   1) Kolom cari di dalam playlist: ketik judul atau artis, daftar lagu langsung tersaring.
   2) Cover otomatis untuk lagu hasil impor (CSV / Spotify / Apple Music) yang belum punya gambar.
      Cover dicari lewat server (POST /api/import -> Deezer, cadangan iTunes), disimpan di perangkat, dan ikut tersimpan di playlist. */
(function () {
  if (typeof window.renderPlaylists !== 'function') return;

  var BATCH = 24;
  var bar = null, inp = null, cnt = null, wrap = null;
  var q = '', lastPl = null, timer = 0;
  var cov = {}, tried = {}, busy = {}, status = '';
  try { cov = JSON.parse(localStorage.getItem('ln_cov_map') || '{}') || {}; } catch (e) { cov = {}; }

  function api(p) { try { return typeof lnApiUrl === 'function' ? lnApiUrl(p) : p; } catch (e) { return p; } }
  function cur() { try { return playlists.filter(function (p) { return p.id === selectedPlaylistId; })[0] || null; } catch (e) { return null; } }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
  function ckey(t) { return norm((t.artist || '') + ' ' + (t.title || '')); }

  // ---------- kolom cari ----------
  var ICO_SEARCH = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
  var ICO_X = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  function mount() {
    var list = document.getElementById('detail-playlist-tracks');
    if (!list || !list.parentNode) return false;
    if (wrap && wrap.isConnected) return true;
    wrap = document.createElement('div'); wrap.className = 'pg-search-wrap'; wrap.id = 'pl-search-wrap';
    bar = document.createElement('div'); bar.className = 'pg-search';
    var ic = document.createElement('span'); ic.className = 'pg-search-ic'; ic.innerHTML = ICO_SEARCH;
    inp = document.createElement('input');
    inp.id = 'pl-search'; inp.type = 'search'; inp.placeholder = 'Cari lagu atau artis di playlist…';
    inp.setAttribute('autocomplete', 'off'); inp.setAttribute('autocorrect', 'off'); inp.setAttribute('autocapitalize', 'off');
    inp.setAttribute('spellcheck', 'false'); inp.setAttribute('enterkeyhint', 'search'); inp.setAttribute('aria-label', 'Cari lagu di playlist');
    var x = document.createElement('button'); x.type = 'button'; x.className = 'pg-search-x'; x.innerHTML = ICO_X; x.setAttribute('aria-label', 'Hapus pencarian');
    cnt = document.createElement('div'); cnt.className = 'pg-search-n';
    bar.appendChild(ic); bar.appendChild(inp); bar.appendChild(x);
    wrap.appendChild(bar); wrap.appendChild(cnt);
    list.parentNode.insertBefore(wrap, list);

    inp.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { q = inp.value; apply(); }, 70); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { inp.value = ''; q = ''; apply(); }
      else if (e.key === 'Enter') { try { inp.blur(); } catch (x2) {} }      // tutup keyboard HP, hasil tetap tersaring
    });
    x.addEventListener('click', function () { inp.value = ''; q = ''; apply(); try { inp.focus(); } catch (e) {} });
    return true;
  }

  function apply() {
    var box = document.getElementById('detail-playlist-tracks'); if (!box || !wrap) return;
    var pl = cur(), rows = box.querySelectorAll('.pg-track'), total = rows.length;
    var words = norm(q).split(' ').filter(Boolean), shown = 0;
    for (var i = 0; i < rows.length; i++) {
      var t = pl && pl.tracks[i], ok = !words.length;
      if (!ok && t) { var h = norm((t.title || '') + ' ' + (t.artist || '')); ok = words.every(function (w) { return h.indexOf(w) >= 0; }); }
      rows[i].style.display = ok ? '' : 'none';
      if (ok) shown++;
    }
    var nr = box.querySelector('.pg-noresult');
    if (words.length && total && !shown) {
      if (!nr) { nr = document.createElement('div'); nr.className = 'pg-empty pg-noresult'; box.appendChild(nr); }
      nr.innerHTML = '<p></p>'; nr.firstChild.textContent = 'Tidak ada lagu yang cocok dengan “' + q.trim() + '”.';
    } else if (nr) nr.remove();
    wrap.style.display = total ? '' : 'none';
    bar.classList.toggle('has-q', !!q);
    cnt.textContent = (words.length ? shown + ' dari ' + total + ' lagu' : total + ' lagu') + (status ? ' · ' + status : '');
  }

  // ---------- cover otomatis ----------
  function needs(t) { return t && (!t.type || t.type === 'youtube') && !t.thumb; }
  function saveCov() {
    try {
      var ks = Object.keys(cov);
      if (ks.length > 3000) ks.slice(0, ks.length - 2500).forEach(function (k) { delete cov[k]; });
      localStorage.setItem('ln_cov_map', JSON.stringify(cov));
    } catch (e) {}
  }
  function persist() {   // sama seperti savePlaylists(), tapi tanpa render ulang supaya layar tidak berkedip
    try {
      var clean = playlists.map(function (p) { return Object.assign({}, p, { tracks: p.tracks.map(function (t) { var o = Object.assign({}, t); delete o.blob; return o; }) }); });
      persistPlaylistsLocal(clean);
      if (dbPrivate()) DBX.set('playlists', clean, 600);
    } catch (e) { try { savePlaylists(); } catch (x) {} }
  }
  function paint(pl) {
    try {
      var box = document.getElementById('detail-playlist-tracks');
      if (!pl || !box || pl.id !== selectedPlaylistId) return;
      var rows = box.querySelectorAll('.pg-track');
      for (var i = 0; i < rows.length; i++) {
        var t = pl.tracks[i], img = rows[i].querySelector('img.pg-track-img');
        if (t && t.thumb && img && img.getAttribute('src') !== t.thumb) img.src = t.thumb;
      }
    } catch (e) {}
  }
  function post(batch) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null, tm = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : 0;
    var body = JSON.stringify({ items: batch.map(function (t) { return { t: t.title, a: t.artist }; }) });
    return fetch(api('/api/import'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json().then(function (j) { return r.ok && j && Array.isArray(j.covers) ? j.covers : null; }, function () { return null; }); })
      .then(function (x) { clearTimeout(tm); return x; }, function () { clearTimeout(tm); return null; });
  }
  function livePl(id) { try { return playlists.filter(function (p) { return p.id === id; })[0] || null; } catch (e) { return null; } }

  async function run(plId, todo, key, full) {
    var done = 0;
    for (var i = 0; i < todo.length; i += BATCH) {
      var batch = todo.slice(i, i + BATCH);
      status = full && plId === selectedPlaylistId ? 'mencari cover ' + Math.min(i, todo.length) + '/' + todo.length : ''; apply();
      var res = await post(batch);
      if (!res) { batch.forEach(function (t) { tried[ckey(t)] = 1; }); break; }          // server tak terjangkau: berhenti, coba lagi nanti
      batch.forEach(function (t, j) {
        var u = res[j], k = ckey(t);
        if (/^https:\/\//.test(u || '')) { cov[k] = u; t.thumb = u; done++; } else tried[k] = 1;
      });
      saveCov(); paint(livePl(plId)); decorate();
    }
    // salin ke playlist yang aktif (objek lagu bisa sudah berganti kalau data dimuat ulang dari server), lalu simpan
    var pl = livePl(plId);
    if (pl) pl.tracks.forEach(function (t) { if (needs(t) && cov[ckey(t)]) t.thumb = cov[ckey(t)]; });
    status = ''; busy[key] = false;
    if (done) persist();
    paint(pl); decorate(); apply();
  }

  function fillCovers(pl, limit) {
    var key = pl && pl.id + (limit ? ':h' : '');
    if (!pl || busy[key]) return;
    var todo = [], changed = false;
    pl.tracks.forEach(function (t, idx) {
      if (!needs(t)) return;
      if (!t.lazy && /^[\w-]{11}$/.test(t.id || '')) { t.thumb = 'https://i.ytimg.com/vi/' + t.id + '/hqdefault.jpg'; changed = true; return; }
      var k = ckey(t);
      if (cov[k]) { t.thumb = cov[k]; changed = true; return; }
      if (!tried[k] && t.title && (!limit || idx < limit)) todo.push(t);
    });
    if (changed) { paint(pl); persist(); decorate(); }
    if (!todo.length) return;
    busy[key] = true;
    run(pl.id, todo, key, !limit).catch(function () { busy[key] = false; status = ''; try { apply(); } catch (e) {} });
  }

  // ---------- cover mix, header, tombol acak ----------
  var ICO_NOTE = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  var ICO_SHUF = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/></svg>';
  function attr(u) { return String(u).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function uniqCovers(pl, n) {
    var out = [], seen = {};
    (pl.tracks || []).forEach(function (t) { if (out.length < n && t && /^https?:\/\//.test(t.thumb || '') && !seen[t.thumb]) { seen[t.thumb] = 1; out.push(t.thumb); } });
    return out;
  }
  function mixInfo(pl) {
    var c = uniqCovers(pl, 4), im = function (u) { return '<img src="' + attr(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility=\'hidden\'">'; };
    if (!c.length) return { kind: 'empty', html: ICO_NOTE, first: '' };
    if (c.length === 1) return { kind: 'one', html: im(c[0]), first: c[0] };
    var h = ''; for (var i = 0; i < 4; i++) h += im(c[i % c.length]);
    return { kind: 'four', html: h, first: c[0] };
  }
  function setMix(el, base, info) {
    var sig = info.kind + '|' + info.html;
    if (el.getAttribute('data-sig') === sig) return;
    el.className = base + ' pg-mix ' + info.kind; el.innerHTML = info.html; el.setAttribute('data-sig', sig);
  }
  function shuffleCur() {
    var pl = cur();
    if (!pl || !pl.tracks.length) { try { showToast('Playlist masih kosong'); } catch (e) {} return; }
    var a = pl.tracks.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; }
    try { playTrackFromList(a, 0, true); } catch (e) {}
  }
  function decorate() {
    try {
      var cards = document.querySelectorAll('#playlists-container .pg-card');
      for (var i = 0; i < cards.length; i++) {
        var pl = playlists[i], cv = cards[i].querySelector('.pg-cover');
        if (pl && cv) setMix(cv, 'pg-cover', mixInfo(pl));
      }
      var head = document.querySelector('#playlist-detail-box .pg-detail-h'), pc = cur();
      if (!head || !pc) return;
      var hc = head.querySelector('.pg-hero-cover');
      if (!hc) { hc = document.createElement('div'); hc.className = 'pg-hero-cover'; head.insertBefore(hc, head.firstChild); }
      var info = mixInfo(pc);
      setMix(hc, 'pg-hero-cover', info);
      if (info.first) head.style.setProperty('--hero', 'url("' + info.first.replace(/"/g, '%22') + '")'); else head.style.removeProperty('--hero');
      var tt = head.querySelector('.pg-detail-t'), meta = head.querySelector('.pg-detail-meta');
      if (tt && !meta) { meta = document.createElement('span'); meta.className = 'pg-detail-meta'; tt.appendChild(meta); }
      if (meta) meta.textContent = pc.tracks.length + ' lagu';
      var act = head.querySelector('.pg-detail-a');
      if (act && !act.querySelector('#pl-shuffle')) {
        var b = document.createElement('button'); b.type = 'button'; b.id = 'pl-shuffle'; b.className = 'pg-btn pg-btn-ghost pg-btn-sm';
        b.innerHTML = ICO_SHUF + '<span>Acak</span>'; b.onclick = shuffleCur;
        act.insertBefore(b, act.lastElementChild);
      }
    } catch (e) {}
  }

  // ---------- pasang ke renderPlaylists ----------
  function after() {
    mount();
    var pl = cur();
    if (!pl || pl.id !== lastPl) { lastPl = pl ? pl.id : null; q = ''; if (inp) inp.value = ''; }
    apply();
    decorate();
    fillCovers(pl);
    try { playlists.forEach(function (p) { if (p !== pl) fillCovers(p, 4); }); } catch (e) {}   // cover mix playlist lain: cukup 4 lagu pertama
  }
  var orig = window.renderPlaylists;
  window.renderPlaylists = function () {
    var r = orig.apply(this, arguments);
    try { after(); } catch (e) {}
    return r;
  };
  function init() { try { after(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.lnPlaylistPlus = { _test: { norm: norm, ckey: ckey } };
})();

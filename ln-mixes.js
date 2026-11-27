/* LNMusic — "Pilihan Lagu hari ini" jadi rak Mix (Pop, Rock, Jazz, Metal) dengan sampul kolase ala Spotify.
   Data dari /api/mixes (tangga lagu harian per genre). Daftar hasil pencarian tetap tampil saat mengetik. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var grid = $('online-tracks-grid');
  if (!grid || !grid.parentNode) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var KEY = 'ln_mixes_v1', FRESH = 30 * 60 * 1000, STALE = 12 * 3600 * 1000;
  var mixes = [], ready = false, openKey = null;

  var I = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"/></svg>',
    shuf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  };

  // ---------- gaya ----------
  var st = document.createElement('style');
  st.textContent =
    '#ln-mixes{margin-top:2px}' +
    '.mx-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 14px}' +
    '@media(min-width:768px){.mx-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:24px 20px}}' +
    '.mx-card{display:block;text-align:left;width:100%;min-width:0;padding:0;background:none;border:0;color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .14s}' +
    '.mx-card:active{transform:scale(.97)}' +
    '.mx-cover{position:relative;aspect-ratio:1;border-radius:14px;overflow:hidden;background:var(--c);box-shadow:0 10px 26px rgba(0,0,0,.45)}' +
    '.mx-mosaic{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}' +
    '.mx-mosaic img{width:100%;height:100%;object-fit:cover;display:block;background:#1d1d24}' +
    '.mx-cover::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,var(--c) 0%,transparent 64%)}' +
    '.mx-tag{position:absolute;left:12px;bottom:11px;z-index:2;display:flex;flex-direction:column;line-height:1;text-shadow:0 2px 12px rgba(0,0,0,.35)}' +
    '.mx-tag b{font-size:clamp(22px,6.4vw,30px);font-weight:900;letter-spacing:-.03em;text-transform:capitalize}' +
    '.mx-tag i{font-style:normal;font-size:10px;font-weight:800;letter-spacing:.22em;opacity:.92;margin-top:5px}' +
    '.mx-logo{position:absolute;left:11px;top:10px;z-index:2;width:22px;height:22px;border-radius:7px;background:rgba(0,0,0,.42);display:grid;place-items:center;font-size:11px;font-weight:900}' +
    '.mx-play{position:absolute;right:10px;bottom:10px;z-index:3;width:44px;height:44px;border-radius:50%;background:#22d36a;color:#04210f;display:grid;place-items:center;box-shadow:0 6px 18px rgba(0,0,0,.45);transition:transform .14s}' +
    '.mx-play:active{transform:scale(.9)}.mx-play svg{width:20px;height:20px;margin-left:2px}' +
    '.mx-t{display:block;margin-top:10px;font-size:15px;font-weight:700;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.mx-s{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:3px;font-size:12.5px;line-height:1.35;color:#a1a1ab}' +
    '.mx-sk .mx-cover{background:linear-gradient(100deg,#1b1b21 30%,#26262f 50%,#1b1b21 70%);background-size:200% 100%;animation:mxSh 1.2s linear infinite}.mx-sk .mx-cover::after{display:none}' +
    '@keyframes mxSh{to{background-position:-200% 0}}' +
    /* detail */
    '#ln-mixd{position:fixed;inset:0;z-index:39;display:none;flex-direction:column;background:#0b0b0e;overflow-y:auto;overscroll-behavior:contain;padding-bottom:calc(var(--sn-h,68px) + 96px + env(safe-area-inset-bottom))}' +
    '#ln-mixd.on{display:flex;animation:mxIn .2s ease-out}@keyframes mxIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}' +
    '.mxd-hero{position:relative;padding:calc(env(safe-area-inset-top) + 12px) 18px 22px;background:linear-gradient(to bottom,var(--c) 0%,rgba(11,11,14,0) 100%)}' +
    '.mxd-back{width:42px;height:42px;border-radius:50%;background:rgba(0,0,0,.35);color:#fff;display:grid;place-items:center;border:0}.mxd-back svg{width:22px;height:22px}' +
    '.mxd-art{width:min(58vw,230px);aspect-ratio:1;margin:6px auto 0;border-radius:14px;overflow:hidden;box-shadow:0 18px 44px rgba(0,0,0,.55);display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}' +
    '.mxd-art img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.mxd-h{padding:0 18px}.mxd-h h2{font-size:28px;font-weight:900;letter-spacing:-.03em;color:#fff;line-height:1.1}.mxd-h p{margin-top:6px;color:#b3b3b3;font-size:13.5px;line-height:1.4}' +
    '.mxd-act{display:flex;align-items:center;gap:14px;padding:16px 18px 8px}' +
    '.mxd-go{width:58px;height:58px;border-radius:50%;background:#22d36a;color:#04210f;display:grid;place-items:center;border:0;box-shadow:0 8px 22px rgba(34,211,106,.3)}.mxd-go svg{width:26px;height:26px;margin-left:3px}.mxd-go:active{transform:scale(.93)}' +
    '.mxd-sh{width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;display:grid;place-items:center;border:0}.mxd-sh svg{width:22px;height:22px}.mxd-sh:active{transform:scale(.93)}' +
    '.mxd-row{display:flex;align-items:center;gap:12px;padding:8px 18px;-webkit-tap-highlight-color:transparent;cursor:pointer}.mxd-row:active{background:rgba(255,255,255,.06)}' +
    '.mxd-row img{width:50px;height:50px;border-radius:8px;object-fit:cover;flex:none;background:#1d1d24}' +
    '.mxd-row .i{min-width:0;flex:1}.mxd-row b{display:block;font-size:15px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mxd-row small{display:block;margin-top:2px;font-size:13px;color:#a1a1ab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.mxd-add{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:#b3b3b3;background:none;border:0;flex:none}.mxd-add svg{width:20px;height:20px}' +
    '@media(min-width:768px){#ln-mixd{left:16rem;padding-bottom:140px}.mxd-art{width:210px;margin:6px 0 0}.mxd-hero{padding-bottom:10px}}' +
    '@media(prefers-reduced-motion:reduce){#ln-mixd.on{animation:none}.mx-sk .mx-cover{animation:none}}';
  document.head.appendChild(st);

  var host = document.createElement('div'); host.id = 'ln-mixes';
  grid.parentNode.insertBefore(host, grid);
  var panel = document.createElement('div'); panel.id = 'ln-mixd'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Mix');
  document.body.appendChild(panel);

  // ---------- util ----------
  function searching() { var i = $('yt-search-input'); return !!(i && i.value.trim()); }
  function artists(m) {
    var seen = {}, out = [];
    m.tracks.forEach(function (t) { var a = String(t.artist || '').split(/,|&| feat\.?| ft\.?/i)[0].trim(); if (a && !seen[a]) { seen[a] = 1; out.push(a); } });
    return out.slice(0, 3).join(', ') + ' dan lainnya';
  }
  function covers(m, n) { return m.tracks.slice(0, n).map(function (t) { return '<img src="' + esc(t.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'; }).join(''); }
  function find(k) { for (var i = 0; i < mixes.length; i++) if (mixes[i].key === k) return mixes[i]; return null; }
  function playList(list, i, full) { try { playTrackFromList(list, i, full); } catch (e) {} }
  function shuffled(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---------- rak ----------
  function skeleton() {
    var h = ''; for (var i = 0; i < 4; i++) h += '<div class="mx-card mx-sk"><div class="mx-cover"></div><span class="mx-t" style="width:60%;height:14px;border-radius:6px;background:#1d1d24"></span></div>';
    host.innerHTML = '<div class="mx-grid">' + h + '</div>';
  }
  function render() {
    host.innerHTML = '<div class="mx-grid">' + mixes.map(function (m) {
      var short = m.title.replace(/ Mix$/i, '');
      return '<button class="mx-card" data-k="' + esc(m.key) + '" style="--c:' + esc(m.color) + '" aria-label="' + esc(m.title) + '">' +
        '<div class="mx-cover"><div class="mx-mosaic">' + covers(m, 4) + '</div><span class="mx-logo">LN</span>' +
        '<span class="mx-tag"><b>' + esc(short) + '</b><i>MIX</i></span>' +
        '<span class="mx-play" data-play="1" role="button" aria-label="Putar ' + esc(m.title) + '">' + I.play + '</span></div>' +
        '<span class="mx-t">' + esc(m.title) + '</span><span class="mx-s">' + esc(artists(m)) + '</span></button>';
    }).join('') + '</div>';
  }
  host.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.mx-card[data-k]'); if (!c) return;
    var m = find(c.dataset.k); if (!m) return;
    if (e.target.closest('[data-play]')) { e.stopPropagation(); playList(m.tracks, 0, false); try { showToast('Memutar ' + m.title); } catch (x) {} return; }
    openMix(m);
  });

  // ---------- detail ----------
  function openMix(m) {
    openKey = m.key;
    panel.style.setProperty('--c', m.color);
    panel.innerHTML =
      '<div class="mxd-hero"><button class="mxd-back" aria-label="Kembali">' + I.back + '</button><div class="mxd-art">' + covers(m, 4) + '</div></div>' +
      '<div class="mxd-h"><h2>' + esc(m.title) + '</h2><p>' + esc(artists(m)) + '<br>' + m.tracks.length + ' lagu \u00b7 Diperbarui hari ini</p></div>' +
      '<div class="mxd-act"><button class="mxd-go" aria-label="Putar semua">' + I.play + '</button><button class="mxd-sh" aria-label="Acak">' + I.shuf + '</button></div>' +
      m.tracks.map(function (t, i) {
        return '<div class="mxd-row" data-i="' + i + '"><img src="' + esc(t.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="i"><b>' + esc(t.title) + '</b><small>' + esc(t.artist) + '</small></span>' +
          '<button class="mxd-add" data-add="' + i + '" aria-label="Tambah ke playlist">' + I.plus + '</button></div>';
      }).join('');
    panel.scrollTop = 0; panel.classList.add('on');
  }
  function closeMix() { openKey = null; panel.classList.remove('on'); }
  panel.addEventListener('click', function (e) {
    var m = find(openKey); if (!m) return;
    if (e.target.closest('.mxd-back')) return closeMix();
    if (e.target.closest('.mxd-go')) return playList(m.tracks, 0, true);
    if (e.target.closest('.mxd-sh')) return playList(shuffled(m.tracks), 0, true);
    var add = e.target.closest('[data-add]');
    if (add) { e.stopPropagation(); var t = m.tracks[+add.dataset.add]; try { openAddToPlaylistModal({ id: t.id, title: t.title, artist: t.artist, thumb: t.thumb, type: 'youtube', lazy: true, appleId: t.appleId }); } catch (x) {} return; }
    var row = e.target.closest('.mxd-row'); if (row) playList(m.tracks, +row.dataset.i, true);
  });
  // dipakai tombol Back (ln-nav.js): true = ditangani
  window.lnMixBack = function () { if (openKey) { closeMix(); return true; } return false; };

  // ---------- tampilkan rak / daftar hasil cari ----------
  function sync() {
    var s = searching(), on = ready && !s;
    host.style.display = on ? '' : 'none';
    grid.style.display = on ? 'none' : '';
    if (s && openKey) closeMix();
    if (on) { var t = $('search-status-text'); if (t) t.textContent = 'Diperbarui hari ini'; }
  }
  var origHRS = window.handleRealtimeSearch;
  if (typeof origHRS === 'function') window.handleRealtimeSearch = function () { var r = origHRS.apply(this, arguments); sync(); return r; };
  var inp = $('yt-search-input'); if (inp) inp.addEventListener('input', function () { setTimeout(sync, 0); });

  // ---------- data: tampilkan cache dulu, segarkan di latar ----------
  function url(p) { try { return typeof lnApiUrl === 'function' ? lnApiUrl(p) : p; } catch (e) { return p; } }
  function load() {
    var cached = null; try { cached = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    var age = cached ? Date.now() - cached.t : Infinity;
    if (cached && cached.d && cached.d.length && age < STALE) { mixes = cached.d; ready = true; render(); sync(); if (age < FRESH) return; }
    else { skeleton(); host.style.display = ''; grid.style.display = 'none'; }
    fetch(url('/api/mixes?region=ID&b=' + Math.floor(Date.now() / 18e5)))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.mixes && j.mixes.length) {
          mixes = j.mixes; ready = true; render();
          try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: mixes })); } catch (e) {}
        } else if (!ready) { host.innerHTML = ''; }   // gagal & belum ada cache -> kembali ke daftar lama
        sync();
      })
      .catch(function () { if (!ready) host.innerHTML = ''; sync(); });
  }
  load();
  setInterval(function () { if (!document.hidden && ready && Date.now() - (JSON.parse(localStorage.getItem(KEY) || '{"t":0}').t || 0) > FRESH) load(); }, 10 * 60 * 1000);
})();

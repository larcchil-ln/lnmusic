/* LNMusic Offline v2 (khusus APK): Library ala referensi — Semua Lagu, Favorit, Playlist, Album, Artis,
   terakhir diputar, layar Sedang Diputar, Daftar Berikutnya, Timer Tidur. Memakai pemindai/pemutar native yang ada. */
(function () {
  'use strict';
  var D = document, R = D.documentElement, base = window.lnOfflineUI || { sync: function () {}, setLib: function () {}, status: function () {} };
  if (!R.classList.contains('ln-android')) return;
  var $ = function (id) { return D.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (ms) { var n = Math.max(0, Math.floor((+ms || 0) / 1000)); return Math.floor(n / 60) + ':' + ('0' + (n % 60)).slice(-2); };
  var toast = function (m) { try { showToast(m); } catch (e) {} };
  var P = function () { return window.lnLocal && lnLocal.plugin && lnLocal.plugin(); };
  function I(p, f) { return '<svg viewBox="0 0 24 24" fill="' + (f ? 'currentColor' : 'none') + '" stroke="' + (f ? 'none' : 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  var ic = {
    back: I('<path d="M15 18l-6-6 6-6"/>'), search: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    scan: I('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'), gear: I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
    heart: I('<path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/>'), note: I('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    star: I('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'), list: I('<path d="M4 6h11M4 12h11M4 18h6"/><circle cx="18" cy="17" r="3"/>'),
    disc: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>'), user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
    more: I('<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>', 1), down: I('<path d="M6 9l6 6 6-6"/>'),
    moon: I('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'), queue: I('<path d="M3 6h14M3 12h14M3 18h8"/><path d="M19 15l3 2-3 2z"/>'), plus: I('<path d="M12 5v14M5 12h14"/>'),
    trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    play: I('<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.5-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/>', 1), pause: I('<rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/>', 1),
    prev: I('<path d="M6 5h2v14H6zM19 5.7v12.6a1 1 0 0 1-1.6.8L8.5 13a1.2 1.2 0 0 1 0-2l8.9-6.1A1 1 0 0 1 19 5.7z"/>', 1), next: I('<path d="M16 5h2v14h-2zM5 5.7v12.6a1 1 0 0 0 1.6.8L15.5 13a1.2 1.2 0 0 0 0-2L6.6 4.9A1 1 0 0 0 5 5.7z"/>', 1),
    shuffle: I('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'), repeat: I('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
    eq: I('<path d="M5 20V10M12 20V4M19 20v-7"/>')
  };
  function load(k, d) { try { return JSON.parse(localStorage.getItem('lnv2_' + k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem('lnv2_' + k, JSON.stringify(v)); } catch (e) {} }
  var lib = [], bySig = {}, st = {}, nav = [{ k: 'home' }], q = '', shown = [], curQ = [], statusMsg = '', npOpen = false, dragging = false, lastId = null;
  var fav = load('fav', []), pls = load('pl', {}), rec = load('rec', []), timerEnd = 0, timerH = null, sheetItem = null;
  var sig = function (s) { return (s.title || '') + '|' + (s.artist || '') + '|' + Math.round((s.dur || 0) / 1000); };
  var resolve = function (a) { return a.map(function (k) { return bySig[k]; }).filter(Boolean); };
  function tint(s) { var t = String(s.album || s.title || ''), h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; h %= 360; return 'linear-gradient(135deg,hsl(' + h + ',55%,34%),hsl(' + ((h + 50) % 360) + ',60%,18%))'; }
  function groupBy(key, empty) { var m = {}; lib.forEach(function (s) { var n = s[key] || empty; (m[n] = m[n] || []).push(s); }); return m; }
  function listOf(s) {
    if (s.list === 'fav') return resolve(fav); if (s.list === 'pl') return resolve(pls[s.key] || []);
    if (s.list === 'album') return lib.filter(function (x) { return (x.album || 'Album tidak dikenal') === s.key; });
    if (s.list === 'artist') return lib.filter(function (x) { return (x.artist || 'Artis tidak dikenal') === s.key; });
    return lib;
  }
  var cur = function () { for (var i = 0; i < lib.length; i++) if (String(lib[i].id) === String(st.id)) return lib[i]; return null; };

  var artCache = {}, artWait = {}, artQ = [], artBusy = 0, artObs = null, byId = {}, npId = null, miniId = null;
  function artKey(s) { return s.album ? 'a:' + s.album : 'i:' + s.id; }
  function paintArt(el, url) { if (!url || !el) return; el.style.background = 'center/cover no-repeat url("' + url + '")'; el.classList.add('has'); }
  function fetchArt(s, cb) { var m = P(); if (!m || !m.getArtwork) return cb(''); try { m.getArtwork({ id: s.id }).then(function (r) { cb((r && r.dataUrl) || ''); }).catch(function () { cb(''); }); } catch (e) { cb(''); } }
  function thumb(u, cb) {
    var im = new Image(); im.onload = function () { try { var c = D.createElement('canvas'); c.width = c.height = 112; var m = Math.min(im.width, im.height); c.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, 112, 112); cb(c.toDataURL('image/jpeg', .82)); } catch (e) { cb(''); } };
    im.onerror = function () { cb(''); }; im.src = u;
  }
  function artDone(k, t) { artBusy--; artCache[k] = t; (artWait[k] || []).forEach(function (el) { if (el.isConnected) paintArt(el, t); }); delete artWait[k]; artPump(); }
  function artPump() { while (artBusy < 2 && artQ.length) { artBusy++; (function (j) { fetchArt(j.s, function (u) { if (!u) return artDone(j.k, ''); thumb(u, function (t) { artDone(j.k, t); }); }); })(artQ.shift()); } }
  function wantArt(el, s) {
    var k = artKey(s), c = artCache[k]; if (c !== undefined) { if (c) paintArt(el, c); return; }
    (artWait[k] = artWait[k] || []).push(el); if (artWait[k].length === 1) { artQ.push({ s: s, k: k }); artPump(); }
  }
  function hydrate(root) {
    var els = root.querySelectorAll('[data-aid]'); if (!els.length) return;
    var go = function (e) { var s = byId[e.getAttribute('data-aid')]; if (s) wantArt(e, s); };
    if (!('IntersectionObserver' in window)) { for (var i = 0; i < els.length; i++) go(els[i]); return; }
    if (!artObs) artObs = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { artObs.unobserve(en.target); go(en.target); } }); }, { rootMargin: '300px' });
    for (var j = 0; j < els.length; j++) artObs.observe(els[j]);
  }

  function css() {
    if ($('ln-v2-css')) return; var s = D.createElement('style'); s.id = 'ln-v2-css';
    s.textContent = [
      'html.ln-android #tab-offline:not(.hidden){display:block!important;padding:0!important}html.ln-android #tab-offline>*:not(#ln-v2){display:none!important}',
      '#ln-v2{--v:#8b5cf6;--v2:#6d28d9;--acc:#a78bfa;--np:#2b1d52;--c1:#13101c;--c2:#1c1829;color:#f4f4f6;padding:2px 0 8px;font-family:inherit}',
      '#ln-v2 button{border:0;background:none;color:inherit;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '#ln-v2 svg{width:22px;height:22px;display:block}',
      '.v2-head{display:flex;align-items:center;gap:8px;margin:4px 0 14px}.v2-head h1{flex:1;margin:0;font-size:28px;font-weight:800;letter-spacing:-.02em}',
      '.v2-ib{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:#d4d4dd}.v2-ib:active{background:rgba(139,92,246,.2)}',
      '.v2-stat{margin:-6px 0 12px;font-size:12.5px;color:var(--acc)}',
      '.v2-q{width:100%;height:46px;border-radius:23px;border:1px solid rgba(255,255,255,.1)!important;background:var(--c1)!important;color:#fff;padding:0 18px;margin-bottom:12px;font-size:15px;outline:none;box-sizing:border-box}.v2-q:focus{border-color:var(--v)!important}',
      '.v2-card{display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;margin-bottom:10px;border-radius:18px;background:var(--c1);text-align:left}.v2-card:active{background:var(--c2)}',
      '.v2-card svg{width:26px;height:26px;flex:none}.v2-card b{display:block;font-size:15.5px}.v2-card small{color:#9a96ab;font-size:12.5px}.v2-card .s{flex:1;min-width:0}',
      '.v2-h2{display:flex;align-items:center;margin:22px 0 8px}.v2-h2 h3{flex:1;margin:0;font-size:18px;font-weight:800}',
      '.v2-act{display:flex;gap:10px;margin:2px 0 12px}.v2-pill{flex:1;height:48px;border-radius:24px;display:flex!important;align-items:center;justify-content:center;gap:8px;font-weight:800;font-size:14.5px;background:var(--c2)}',
      '.v2-pill.p{background:var(--v);color:#fff}.v2-pill svg{width:20px;height:20px}',
      '.v2-row{display:flex;align-items:center;gap:12px;padding:8px 4px;border-radius:14px}.v2-row:active{background:var(--c1)}.v2-row.on b{color:var(--acc)}',
      '.v2-art.has svg,.np-cover i.has svg{display:none}.v2-art{flex:none;width:48px;height:48px;border-radius:12px;display:grid;place-items:center;color:rgba(255,255,255,.85);background:#241f35}.v2-art svg{width:22px;height:22px}',
      '.v2-ri{flex:1;min-width:0}.v2-ri b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v2-ri small{display:block;margin-top:2px;font-size:12.5px;color:#9a96ab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.v2-row em{font-style:normal;font-size:12px;color:#7d7990}.v2-empty{padding:40px 12px;text-align:center;color:#9a96ab;font-size:14px;line-height:1.5}',
      '.v2-mini{position:fixed;left:10px;right:10px;bottom:calc(var(--a-nav-h,72px) + env(safe-area-inset-bottom) + 8px);z-index:41;display:none;align-items:center;gap:4px;padding:8px 8px 10px 10px;border-radius:22px;background:#241d3a;box-shadow:0 6px 22px rgba(0,0,0,.55);overflow:hidden}',
      '.v2-mini.on{display:flex}.v2-mini-main{flex:1;min-width:0;display:flex;align-items:center;gap:10px;cursor:pointer}.v2-mini .v2-art{width:42px;height:42px}',
      '.v2-mini .v2-ri b{font-size:14px}.v2-mini button{width:42px;height:42px;display:grid;place-items:center;border-radius:50%}.v2-mini #ln-v2-mp{background:var(--v);color:#fff}',
      '.v2-bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.1)}.v2-bar u{display:block;height:100%;width:0;background:var(--v)}',
      '#ln-v2-np{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top) + 10px) 22px calc(env(safe-area-inset-bottom) + 18px);background:radial-gradient(120% 60% at 50% 0%,var(--np) 0%,#0a0713 60%);transform:translateY(100%);transition:transform .32s cubic-bezier(.2,0,0,1);visibility:hidden}',
      '#ln-v2-np.on{transform:none;visibility:visible}.np-top{display:flex;align-items:center;justify-content:space-between;color:#cfc8ea;font-size:12px;font-weight:800;letter-spacing:.16em}',
      '.np-cover{flex:1;min-height:0;display:grid;place-items:center;padding:18px 0}.np-cover i{width:min(100%,360px);aspect-ratio:1;border-radius:28px;display:grid;place-items:center;color:rgba(255,255,255,.8);box-shadow:0 20px 60px rgba(109,40,217,.35)}.np-cover svg{width:34%;height:34%}',
      '.np-meta{display:flex;align-items:center;gap:10px}.np-meta .s{flex:1;min-width:0}.np-meta h2{margin:0;font-size:22px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.np-meta p{margin:4px 0 0;color:#a9a3c0;font-size:14.5px}',
      '#ln-v2 .np-fav.on{color:var(--acc)}#ln-v2 .np-fav.on svg{fill:currentColor}',
      '.np-seek{margin-top:18px}.np-seek input{width:100%;accent-color:var(--v);height:4px}.np-t{display:flex;justify-content:space-between;font-size:12px;color:#9a96ab;margin-top:4px}',
      '.np-ctl{display:flex;align-items:center;justify-content:space-between;margin:14px 0 8px}.np-ctl button{width:48px;height:48px;display:grid;place-items:center;border-radius:50%;color:#e8e4f7}',
      '.np-ctl .big{width:70px;height:70px;background:var(--v);color:#fff;box-shadow:0 8px 26px rgba(139,92,246,.5)}.np-ctl .big svg{width:30px;height:30px}.np-ctl button.on{color:var(--acc)}',
      '.np-bot{display:flex;justify-content:space-around;margin-top:6px;color:#bdb6d6;font-size:11px}.np-bot button{display:flex!important;flex-direction:column;align-items:center;gap:4px;padding:6px 14px}',
      '#ln-v2-eq{position:fixed;inset:0;z-index:70;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top) + 10px) 18px calc(env(safe-area-inset-bottom) + 16px);background:#09070f;transform:translateY(100%);transition:transform .3s cubic-bezier(.2,0,0,1);visibility:hidden;overflow:auto}#ln-v2-eq.on{transform:none;visibility:visible}',
      '.eq-h{display:flex;align-items:center;gap:8px;margin-bottom:12px}.eq-h h2{flex:1;margin:0;font-size:22px;font-weight:800}',
      '.eq-sw{width:52px;height:30px;border-radius:15px;background:#2c2840;position:relative;transition:.2s}.eq-sw::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:.2s}.eq-sw.on{background:var(--v)}.eq-sw.on::after{left:25px}',
      '.eq-chips{display:flex;gap:8px;overflow-x:auto;padding:2px 0 12px}.eq-chip{flex:none;padding:9px 16px;border-radius:20px;background:var(--c2);font-weight:700;font-size:13.5px}.eq-chip.on{background:var(--v);color:#fff}',
      '.eq-bands{display:flex;justify-content:space-between;align-items:flex-end;height:210px;padding:10px 4px 8px;background:var(--c1);border-radius:20px;margin-bottom:12px}.eq-b{display:flex;flex-direction:column;align-items:center;gap:6px;width:20%}.eq-b .r{position:relative;width:34px;height:150px}.eq-b input{position:absolute;left:50%;top:50%;width:150px;height:34px;margin:-17px 0 0 -75px;transform:rotate(-90deg);accent-color:var(--v)}.eq-b small{color:#9a96ab;font-size:11.5px}.eq-b em{font-style:normal;color:var(--acc);font-size:11px;font-weight:800}',
      '.eq-row{display:flex;align-items:center;gap:12px;padding:12px 4px}.eq-row b{width:104px;font-size:14.5px}.eq-row input{flex:1;accent-color:var(--v)}.eq-row em{width:42px;text-align:right;font-style:normal;color:#9a96ab;font-size:12.5px}',
      '.eq-note{color:#8a85a0;font-size:12.5px;line-height:1.5;margin-top:6px}.eq-reset{margin-top:14px;height:48px;border-radius:24px;background:var(--c2);font-weight:800;width:100%}',
      '.np-lyr{flex:1;min-height:0;overflow:auto;padding:22px 4px;text-align:center;-webkit-mask-image:linear-gradient(transparent,#000 10%,#000 90%,transparent);mask-image:linear-gradient(transparent,#000 10%,#000 90%,transparent)}',
      '.np-lyr p{margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:800;color:rgba(255,255,255,.34);transition:color .25s,transform .25s}.np-lyr p.on{color:#fff;transform:scale(1.04)}.np-lyr p.n{font-size:14px;font-weight:600;color:#9a96ab;margin-top:40px}.np-lyr p.pl{font-size:16px;font-weight:600;color:rgba(255,255,255,.8)}',
      '#ln-v2-np.lyr .np-cover{display:none}#ln-v2-np:not(.lyr) .np-lyr{display:none}.np-bot button.on{color:var(--acc)}',
      '.v2-sheet{position:fixed;inset:0;z-index:80;display:none}.v2-sheet.on{display:block}.v2-scrim{position:absolute;inset:0;background:rgba(0,0,0,.6)}',
      '.v2-panel{position:absolute;left:0;right:0;bottom:0;max-height:78%;overflow:auto;background:#17132a;border-radius:26px 26px 0 0;padding:20px 18px calc(env(safe-area-inset-bottom) + 18px);box-shadow:0 -10px 40px rgba(0,0,0,.5)}',
      '.v2-panel h3{margin:0 0 2px;font-size:18px;font-weight:800}.v2-panel>small{display:block;color:#9a96ab;margin-bottom:10px}',
      '.v2-opt{display:flex!important;align-items:center;gap:14px;width:100%;padding:14px 6px;font-size:15.5px;text-align:left;border-radius:12px}.v2-opt:active{background:rgba(139,92,246,.18)}.v2-opt.on{color:var(--acc);font-weight:800}.v2-opt .s{flex:1}.v2-opt em{font-style:normal;color:#9a96ab;font-size:13px}'
    ].join('');
    D.head.appendChild(s);
  }

  function homeH() {
    var al = Object.keys(groupBy('album', 'Album tidak dikenal')).length, ar = Object.keys(groupBy('artist', 'Artis tidak dikenal')).length;
    var C = [['all', 'Semua Lagu', ic.note, 'var(--acc)', lib.length], ['fav', 'Favorit', ic.star, '#facc15', resolve(fav).length], ['pl', 'Playlist', ic.list, '#fb923c', Object.keys(pls).length], ['album', 'Album', ic.disc, '#818cf8', al], ['artist', 'Artis', ic.user, '#c084fc', ar]];
    var h = '<div class="v2-head"><h1>Library</h1><button class="v2-ib" data-act="gsearch" aria-label="Cari">' + ic.search + '</button><button class="v2-ib" data-act="scan" aria-label="Pindai">' + ic.scan + '</button><button class="v2-ib" data-act="settings" aria-label="Pengaturan">' + ic.gear + '</button></div>';
    if (statusMsg) h += '<div class="v2-stat">' + esc(statusMsg) + '</div>';
    if (!lib.length) h += '<div class="v2-empty">Belum ada lagu. Ketuk ikon pindai di kanan atas untuk mencari musik di HP-mu.</div>';
    h += C.map(function (c) { return '<button class="v2-card" data-act="cat" data-c="' + c[0] + '"><span style="color:' + c[3] + '">' + c[2] + '</span><span class="s"><b>' + c[1] + '</b><small>' + c[4] + (c[0] === 'pl' ? ' playlist' : ' ' + (c[0] === 'album' ? 'album' : c[0] === 'artist' ? 'artis' : 'lagu')) + '</small></span></button>'; }).join('');
    var rc = resolve(rec).slice(0, 6); shown = rc;
    if (rc.length) h += '<div class="v2-h2"><h3>Musik Terakhir Diputar</h3></div>' + rc.map(rowH).join('');
    return h;
  }
  function rowH(s, i) {
    var on = st.active && String(s.id) === String(st.id);
    return '<div class="v2-row' + (on ? ' on' : '') + '" data-act="play" data-i="' + i + '"><span class="v2-art" data-aid="' + s.id + '" style="background:' + tint(s) + '">' + (on ? ic.eq : ic.note) + '</span><span class="v2-ri"><b>' + esc(s.title) + '</b><small>' + esc(s.artist) + '</small></span><em>' + fmt(s.dur) + '</em><button class="v2-ib" data-act="more" data-i="' + i + '" aria-label="Opsi">' + ic.more + '</button></div>';
  }
  function head(t, extra) { return '<div class="v2-head"><button class="v2-ib" data-act="back" aria-label="Kembali">' + ic.back + '</button><h1 style="font-size:22px">' + esc(t) + '</h1>' + (extra || '') + '</div>'; }
  function groupsH(s) {
    var h;
    if (s.kind === 'pl') {
      var ns = Object.keys(pls); h = head('Playlist', '<button class="v2-ib" data-act="newpl" aria-label="Playlist baru">' + ic.plus + '</button>');
      if (!ns.length) h += '<div class="v2-empty">Belum ada playlist. Ketuk + untuk membuat, atau pilih "Tambah ke playlist" dari menu lagu.</div>';
      return h + ns.map(function (n) { return '<button class="v2-card" data-act="grp" data-n="' + esc(n) + '"><span style="color:#fb923c">' + ic.list + '</span><span class="s"><b>' + esc(n) + '</b><small>' + resolve(pls[n]).length + ' lagu</small></span></button>'; }).join('');
    }
    var key = s.kind, m = groupBy(key, key === 'album' ? 'Album tidak dikenal' : 'Artis tidak dikenal'), names = Object.keys(m).sort(function (a, b) { return a.localeCompare(b); });
    h = head(s.title);
    return h + names.map(function (n) { return '<button class="v2-card" data-act="grp" data-n="' + esc(n) + '">' + (key === 'album' ? '<span class="v2-art" data-aid="' + m[n][0].id + '" style="background:' + tint(m[n][0]) + '">' + ic.disc + '</span>' : '<span style="color:var(--acc)">' + ic.user + '</span>') + '<span class="s"><b>' + esc(n) + '</b><small>' + m[n].length + ' lagu</small></span></button>'; }).join('');
  }
  function tracksH(s) {
    var items = listOf(s), ql = q.trim().toLowerCase();
    if (ql) items = items.filter(function (x) { return (x.title + ' ' + x.artist + ' ' + x.album).toLowerCase().indexOf(ql) >= 0; });
    shown = items;
    var h = head(s.title, '<button class="v2-ib" data-act="tsearch" aria-label="Cari">' + ic.search + '</button>');
    if (s.search) h += '<input id="ln-v2-q" class="v2-q" type="search" placeholder="Cari di ' + esc(s.title) + '…" value="' + esc(q) + '">';
    if (items.length) h += '<div class="v2-act"><button class="v2-pill p" data-act="playall">' + ic.play + 'Putar</button><button class="v2-pill" data-act="shuf">' + ic.shuffle + 'Acak</button></div>';
    return h + '<div id="ln-v2-list">' + listH(items) + '</div>';
  }
  function listH(items) { return items.length ? items.map(rowH).join('') : '<div class="v2-empty">' + (q ? 'Tidak ada hasil.' : 'Belum ada lagu di sini.') + '</div>'; }

  function render() {
    var b = $('ln-v2-body'); if (!b) return; var s = nav[nav.length - 1];
    b.innerHTML = s.k === 'home' ? homeH() : s.k === 'groups' ? groupsH(s) : tracksH(s); hydrate(b);
    if (s.search) { var i = $('ln-v2-q'); if (i) { i.addEventListener('input', function () { q = i.value; var it = listOf(s), ql = q.trim().toLowerCase(); if (ql) it = it.filter(function (x) { return (x.title + ' ' + x.artist + ' ' + x.album).toLowerCase().indexOf(ql) >= 0; }); shown = it; $('ln-v2-list').innerHTML = listH(it); hydrate($('ln-v2-list')); }); }
    }
  }
  function go(s) { q = ''; nav.push(s); render(); try { scrollTo(0, 0); } catch (e) {} }

  function playList(items, i) { if (!items || !items[i] || !window.lnLocal) return; curQ = items.slice(); var p = lnLocal.play(curQ, i); if (p && p.catch) p.catch(function () {}); }
  function sheet(h) { var s = $('ln-v2-sheet'); var pn = s.querySelector('.v2-panel'); pn.innerHTML = h; s.classList.add('on'); hydrate(pn); }
  function closeSheet() { var s = $('ln-v2-sheet'); if (s) s.classList.remove('on'); }
  function toggleFav(s) { var k = sig(s), i = fav.indexOf(k); if (i >= 0) fav.splice(i, 1); else fav.unshift(k); save('fav', fav); }
  function setTimer(min) {
    clearTimeout(timerH); timerEnd = 0;
    if (min > 0) { timerEnd = Date.now() + min * 6e4; timerH = setTimeout(function () { timerEnd = 0; var m = P(); if (m && st.playing) m.toggle(); toast('Timer tidur selesai — musik dijeda'); }, min * 6e4); toast('Timer tidur ' + min + ' menit'); } else toast('Timer tidur dimatikan');
    closeSheet();
  }
  function timerSheet() {
    var left = timerEnd ? Math.max(1, Math.round((timerEnd - Date.now()) / 6e4)) : 0;
    sheet('<h3>Timer Tidur</h3><small>' + (left ? 'Sisa sekitar ' + left + ' menit' : 'Musik dijeda otomatis setelah waktu habis') + '</small>' + [0, 15, 30, 45, 60].map(function (m) { return '<button class="v2-opt" data-act="tset" data-m="' + m + '"><span class="s">' + (m ? m + ' menit' : 'Nonaktif') + '</span></button>'; }).join(''));
  }
  function queueSheet() {
    var at = -1; curQ.forEach(function (s, i) { if (String(s.id) === String(st.id)) at = i; });
    var nx = curQ.slice(at + 1, at + 41); window.__v2nx = nx;
    sheet('<h3>Daftar Berikutnya</h3><small>' + (nx.length ? nx.length + ' lagu' : 'Tidak ada lagu berikutnya') + '</small>' + nx.map(function (s, i) { return '<button class="v2-opt" data-act="qplay" data-i="' + (at + 1 + i) + '"><span class="v2-art" data-aid="' + s.id + '" style="width:40px;height:40px;background:' + tint(s) + '">' + ic.note + '</span><span class="s v2-ri"><b>' + esc(s.title) + '</b><small>' + esc(s.artist) + '</small></span><em>' + fmt(s.dur) + '</em></button>'; }).join(''));
  }
  var THEMES = { ungu: ['Gelap Ungu', '#8b5cf6', '#6d28d9', '#a78bfa', '#2b1d52', '#13101c', '#1c1829'], hijau: ['Gelap Hijau', '#22c55e', '#15803d', '#4ade80', '#123a24', '#101712', '#18231b'], biru: ['Gelap Biru', '#3b82f6', '#1d4ed8', '#60a5fa', '#14305e', '#0f1420', '#18202f'], amoled: ['AMOLED Hitam', '#8b5cf6', '#6d28d9', '#a78bfa', '#000000', '#0a0a0a', '#141414'] };
  var QUAL = { hemat: ['Hemat data', 'tiny'], normal: ['Normal', 'large'], tinggi: ['Tinggi', 'hd1080'] };
  var theme = load('theme', 'ungu'), qual = load('q', 'tinggi');
  function applyTheme() { var r = $('ln-v2'); if (!r) return; var t = THEMES[theme] || THEMES.ungu; ['--v', '--v2', '--acc', '--np', '--c1', '--c2'].forEach(function (k, i) { r.style.setProperty(k, t[i + 1]); }); }
  function applyQuality() { window.__lnQ = (QUAL[qual] || QUAL.tinggi)[1]; try { if (window.ytPlayer && ytPlayer.setPlaybackQuality) ytPlayer.setPlaybackQuality(window.__lnQ); } catch (e) {} }
  function optList(title, sub, map, curK, act) { return '<h3>' + title + '</h3><small>' + sub + '</small>' + Object.keys(map).map(function (k) { return '<button class="v2-opt' + (k === curK ? ' on' : '') + '" data-act="' + act + '" data-k="' + k + '"><span class="s">' + map[k][0] + '</span>' + (k === curK ? '<em>Dipakai</em>' : '') + '</button>'; }).join(''); }
  function settingsSheet() {
    sheet('<h3>Pengaturan</h3><small>LNMusic Offline</small>' +
      '<button class="v2-opt" data-act="theme"><span style="color:var(--acc)">' + ic.disc + '</span><span class="s">Tema</span><em>' + THEMES[theme][0] + '</em></button>' +
      '<button class="v2-opt" data-act="quality"><span style="color:var(--acc)">' + ic.note + '</span><span class="s">Kualitas Audio</span><em>' + QUAL[qual][0] + '</em></button>' +
      '<button class="v2-opt" data-act="eq"><span style="color:var(--acc)">' + ic.eq + '</span><span class="s">Equalizer</span><em>' + (fxS.on ? 'Aktif' : 'Nonaktif') + '</em></button>' +
      '<button class="v2-opt" data-act="timer"><span style="color:var(--acc)">' + ic.moon + '</span><span class="s">Timer Tidur</span><em>' + (timerEnd ? 'Aktif' : 'Nonaktif') + '</em></button>' +
      '<button class="v2-opt" data-act="scan"><span style="color:var(--acc)">' + ic.scan + '</span><span class="s">Pindai ulang musik</span><em>' + lib.length + ' lagu</em></button>');
  }

  // ===== Equalizer (efek audio native, berlaku untuk lagu offline) =====
  var PRE = { normal: [0, 0, 0, 0, 0], rock: [4, 2, -1, 2, 4], pop: [-1, 2, 4, 2, -1], jazz: [3, 1, -2, 2, 4], klasik: [4, 3, -1, 3, 4], bass: [6, 4, 0, -1, -1], vokal: [-2, 0, 4, 3, 1], dance: [5, 3, 0, 2, 4] };
  var FQ = ['60', '230', '910', '3,6k', '14k'];
  var fxS = load('fx', { on: false, preset: 'normal', lv: [0, 0, 0, 0, 0], bass: 0, virt: 0 }), fxI = null, fxT = null, fxInit = false;
  function fxLevels() {
    var n = (fxI && fxI.bands) || 5, mn = (fxI && fxI.min != null) ? fxI.min : -1500, mx = (fxI && fxI.max != null) ? fxI.max : 1500, a = fxS.lv, out = [];
    for (var i = 0; i < n; i++) { var p = n > 1 ? i * (a.length - 1) / (n - 1) : 0, lo = Math.floor(p), hi = Math.min(a.length - 1, lo + 1), v = a[lo] + (a[hi] - a[lo]) * (p - lo); out.push(Math.max(mn, Math.min(mx, Math.round(v * 100)))); }
    return out;
  }
  function fxPush() { clearTimeout(fxT); fxT = setTimeout(function () { save('fx', fxS); var m = P(); if (m && m.fxSet) m.fxSet({ enabled: !!fxS.on, levels: fxLevels(), bass: fxS.bass * 10, virt: fxS.virt * 10 }).catch(function () {}); }, 90); }
  function eqRender() {
    var e = $('ln-v2-eq'); if (!e) return;
    e.innerHTML = '<div class="eq-h"><button class="v2-ib" data-eq="close" aria-label="Kembali">' + ic.back + '</button><h2>Equalizer</h2><button class="eq-sw' + (fxS.on ? ' on' : '') + '" data-eq="tog" aria-label="Aktifkan"></button></div>' +
      '<div class="eq-chips">' + Object.keys(PRE).map(function (k) { return '<button class="eq-chip' + (fxS.preset === k ? ' on' : '') + '" data-eq="pre" data-k="' + k + '">' + k.charAt(0).toUpperCase() + k.slice(1) + '</button>'; }).join('') + '</div>' +
      '<div class="eq-bands">' + FQ.map(function (f, i) { return '<div class="eq-b"><em>' + (fxS.lv[i] > 0 ? '+' : '') + fxS.lv[i] + '</em><span class="r"><input type="range" min="-12" max="12" step="1" value="' + fxS.lv[i] + '" data-eq="band" data-i="' + i + '"></span><small>' + f + '</small></div>'; }).join('') + '</div>' +
      '<div class="eq-row"><b>Bass Boost</b><input type="range" min="0" max="100" value="' + fxS.bass + '" data-eq="bass"><em id="eq-bv">' + fxS.bass + '%</em></div>' +
      '<div class="eq-row"><b>Virtualizer</b><input type="range" min="0" max="100" value="' + fxS.virt + '" data-eq="virt"><em id="eq-vv">' + fxS.virt + '%</em></div>' +
      '<div class="eq-note">' + (fxI && fxI.ok === false ? 'Equalizer tidak didukung di perangkat ini.' : 'Efek berlaku untuk lagu offline. Audio YouTube diputar oleh browser dan tidak bisa diproses.') + '</div>' +
      '<button class="eq-reset" data-eq="reset">Reset</button>';
  }
  function eqOpen() { closeSheet(); var m = P(); if (m && m.fxInfo && !fxI) m.fxInfo().then(function (r) { fxI = r; eqRender(); }).catch(function () { fxI = { ok: false }; eqRender(); }); eqRender(); $('ln-v2-eq').classList.add('on'); }
  function eqClose() { var e = $('ln-v2-eq'); if (e) e.classList.remove('on'); }
  function eqClick(ev) {
    var el = ev.target.closest && ev.target.closest('[data-eq]'); if (!el) return; var a = el.dataset.eq;
    if (a === 'close') eqClose();
    else if (a === 'tog') { fxS.on = !fxS.on; fxPush(); eqRender(); }
    else if (a === 'pre') { fxS.lv = PRE[el.dataset.k].slice(); fxS.preset = el.dataset.k; fxS.on = true; fxPush(); eqRender(); }
    else if (a === 'reset') { fxS = { on: fxS.on, preset: 'normal', lv: [0, 0, 0, 0, 0], bass: 0, virt: 0 }; fxPush(); eqRender(); }
  }
  function eqInput(ev) {
    var el = ev.target, a = el.dataset && el.dataset.eq; if (!a) return;
    if (a === 'band') { fxS.lv[+el.dataset.i] = +el.value; fxS.preset = 'custom'; var em = el.parentNode.parentNode.querySelector('em'); if (em) em.textContent = (+el.value > 0 ? '+' : '') + el.value; D.querySelectorAll('.eq-chip.on').forEach(function (c) { c.classList.remove('on'); }); }
    else if (a === 'bass') { fxS.bass = +el.value; $('eq-bv').textContent = el.value + '%'; } else if (a === 'virt') { fxS.virt = +el.value; $('eq-vv').textContent = el.value + '%'; } else return;
    if (!fxS.on) fxS.on = true; fxPush();
  }

  // ===== Lirik (LRCLIB), tampil di layar penuh dan di baris artis mini player =====
  var lyr = { k: '', lines: [], plain: '', state: 'idle' }, lyrOn = false, lyrIdx = -1;
  function lrcParse(t) { var out = []; String(t || '').split('\n').forEach(function (l) { var m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/); if (m && m[3]) out.push({ t: (+m[1]) * 6e4 + Math.round(parseFloat(m[2]) * 1000), s: m[3] }); }); return out; }
  function lyrRender() {
    var e = $('np-lyr'); if (!e) return; lyrIdx = -1;
    if (lyr.state === 'load') e.innerHTML = '<p class="n">Mencari lirik…</p>';
    else if (lyr.lines.length) e.innerHTML = lyr.lines.map(function (l, i) { return '<p data-i="' + i + '">' + esc(l.s) + '</p>'; }).join('');
    else if (lyr.plain) e.innerHTML = lyr.plain.split('\n').map(function (l) { return l.trim() ? '<p class="pl">' + esc(l) + '</p>' : ''; }).join('');
    else e.innerHTML = '<p class="n">Lirik tidak ditemukan untuk lagu ini.</p>';
    lyrTick();
  }
  function lyrGet(u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function loadLyrics(c) {
    if (!c) return; var k = sig(c); if (lyr.k === k) return; lyr = { k: k, lines: [], plain: '', state: 'load' }; lyrRender();
    var ar = c.artist === 'Artis tidak dikenal' ? '' : c.artist, base = 'https://lrclib.net/api/', qs = 'track_name=' + encodeURIComponent(c.title) + (ar ? '&artist_name=' + encodeURIComponent(ar) : '');
    lyrGet(base + 'get?' + qs + (c.album ? '&album_name=' + encodeURIComponent(c.album) : '') + '&duration=' + Math.round((c.dur || 0) / 1000)).then(function (j) {
      if (j && (j.syncedLyrics || j.plainLyrics)) return j;
      return lyrGet(base + 'search?' + qs).then(function (arr) { return (arr || []).filter(function (x) { return x.syncedLyrics || x.plainLyrics; })[0] || null; });
    }).then(function (j) { if (lyr.k !== k) return; if (j) { lyr.lines = lrcParse(j.syncedLyrics); lyr.plain = j.plainLyrics || ''; } lyr.state = 'done'; lyrRender(); });
  }
  function lyrTick() {
    if (!lyr.lines.length) return; var pos = (+st.pos || 0) + 350, idx = -1;
    for (var i = 0; i < lyr.lines.length; i++) { if (lyr.lines[i].t <= pos) idx = i; else break; }
    if (idx === lyrIdx) return; lyrIdx = idx;
    var ma = $('ln-v2-ma'); if (ma) ma.textContent = idx >= 0 ? lyr.lines[idx].s : (st.artist || '');
    var box = $('np-lyr'); if (!box) return; var on = box.querySelector('.on'); if (on) on.classList.remove('on');
    var el = idx >= 0 ? box.querySelector('[data-i="' + idx + '"]') : null; if (el) { el.classList.add('on'); if (lyrOn) try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }
  }

  function npEl() { return $('ln-v2-np'); }
  function npShow(on) { npOpen = on; var n = npEl(); if (n) n.classList.toggle('on', on); if (on) npUpdate(); }
  function npUpdate() {
    var n = npEl(); if (!n) return; var c = cur(), f = c && fav.indexOf(sig(c)) >= 0;
    $('np-t').textContent = st.title || 'Belum ada lagu'; $('np-a').textContent = st.artist || '';
    if (String(npId) !== String(st.id)) { npId = st.id; var ci = n.querySelector('.np-cover i'); ci.style.background = c ? tint(c) : '#241f35'; ci.classList.remove('has'); if (c) fetchArt(c, function (u) { if (u && String(npId) === String(c.id)) paintArt(ci, u); }); }
    $('np-fav').classList.toggle('on', !!f); $('np-pp').innerHTML = st.playing ? ic.pause : ic.play;
    $('np-sh').classList.toggle('on', !!st.shuffle); $('np-rp').classList.toggle('on', !!st.repeat);
    $('np-d').textContent = fmt(st.dur); var sk = $('np-seek'); sk.max = Math.max(1, +st.dur || 1);
    if (!dragging) { sk.value = Math.min(+st.pos || 0, +sk.max); $('np-p').textContent = fmt(st.pos); }
  }
  function miniUpdate() {
    var m = $('ln-v2-mini'); if (!m) return; var on = !!st.active; m.classList.toggle('on', on); if (!on) return;
    var c = cur(); $('ln-v2-mt').textContent = st.title || ''; $('ln-v2-ma').textContent = (lyr.lines.length && lyrIdx >= 0 && lyr.lines[lyrIdx]) ? lyr.lines[lyrIdx].s : (st.artist || '');
    if (String(miniId) !== String(st.id)) { miniId = st.id; var me = $('ln-v2-mart'); me.style.background = c ? tint(c) : '#241f35'; me.classList.remove('has'); if (c) wantArt(me, c); } $('ln-v2-mp').innerHTML = st.playing ? ic.pause : ic.play;
    $('ln-v2-mb').style.width = (st.dur > 0 ? Math.min(100, (st.pos || 0) / st.dur * 100) : 0) + '%';
  }
  function sync(s) {
    var prev = lastId; st = s || st; miniUpdate(); if (npOpen) npUpdate(); lyrTick(); if (!fxInit && st.active) { fxInit = true; if (fxS.on) fxPush(); }
    if (st.active && st.id != null && String(st.id) !== String(prev)) {
      lastId = st.id; var c = cur(); loadLyrics(c);
      if (c) { var k = sig(c); rec = [k].concat(rec.filter(function (x) { return x !== k; })).slice(0, 30); save('rec', rec); }
      if (nav.length && !D.activeElement.matches('input')) render();
    }
    if (!st.active && npOpen) npShow(false);
  }

  function onClick(e) {
    var el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; var a = el.dataset.act, i = +el.dataset.i, m = P();
    if (a === 'back') { if (nav.length > 1) { nav.pop(); q = ''; render(); } }
    else if (a === 'scan') { closeSheet(); if (window.lnLocal) lnLocal.scan(); }
    else if (a === 'settings') settingsSheet(); else if (a === 'timer') timerSheet(); else if (a === 'tset') setTimer(+el.dataset.m);
    else if (a === 'gsearch') go({ k: 'tracks', list: 'all', title: 'Semua Lagu', search: true });
    else if (a === 'tsearch') { var s = nav[nav.length - 1]; s.search = !s.search; q = ''; render(); var inp = $('ln-v2-q'); if (inp) inp.focus(); }
    else if (a === 'cat') { var c = el.dataset.c; if (c === 'pl' || c === 'album' || c === 'artist') go({ k: 'groups', kind: c, title: c === 'pl' ? 'Playlist' : c === 'album' ? 'Album' : 'Artis' }); else go({ k: 'tracks', list: c, title: c === 'fav' ? 'Favorit' : 'Semua Lagu' }); }
    else if (a === 'grp') { var p = nav[nav.length - 1].kind; go({ k: 'tracks', list: p, key: el.dataset.n, title: el.dataset.n }); }
    else if (a === 'play') playList(shown, i);
    else if (a === 'playall') playList(shown, 0);
    else if (a === 'shuf') { var x = shown.slice(); for (var j = x.length - 1; j > 0; j--) { var r = Math.floor(Math.random() * (j + 1)), t = x[j]; x[j] = x[r]; x[r] = t; } playList(x, 0); }
    else if (a === 'more') { sheetItem = shown[i]; var inPl = nav[nav.length - 1].list === 'pl', isF = fav.indexOf(sig(sheetItem)) >= 0;
      sheet('<h3>' + esc(sheetItem.title) + '</h3><small>' + esc(sheetItem.artist) + '</small><button class="v2-opt" data-act="tfav"><span style="color:var(--acc)">' + ic.star + '</span><span class="s">' + (isF ? 'Hapus dari Favorit' : 'Tambah ke Favorit') + '</span></button><button class="v2-opt" data-act="addpl"><span style="color:var(--acc)">' + ic.list + '</span><span class="s">Tambah ke playlist</span></button>' + (inPl ? '<button class="v2-opt" data-act="rmpl"><span style="color:#fb7185">' + ic.trash + '</span><span class="s">Hapus dari playlist ini</span></button>' : '')); }
    else if (a === 'tfav') { toggleFav(sheetItem); closeSheet(); render(); }
    else if (a === 'addpl') { var ns = Object.keys(pls); sheet('<h3>Tambah ke playlist</h3><small>' + esc(sheetItem.title) + '</small>' + ns.map(function (n) { return '<button class="v2-opt" data-act="pladd" data-n="' + esc(n) + '"><span class="s">' + esc(n) + '</span><em>' + resolve(pls[n]).length + '</em></button>'; }).join('') + '<button class="v2-opt" data-act="newpl2"><span style="color:var(--acc)">' + ic.plus + '</span><span class="s">Playlist baru…</span></button>'); }
    else if (a === 'pladd') { var k = sig(sheetItem), n = el.dataset.n; pls[n] = pls[n] || []; if (pls[n].indexOf(k) < 0) pls[n].push(k); save('pl', pls); closeSheet(); toast('Ditambahkan ke ' + n); render(); }
    else if (a === 'newpl' || a === 'newpl2') { var nm = (window.prompt('Nama playlist baru') || '').trim(); if (!nm) return; if (!pls[nm]) pls[nm] = []; if (a === 'newpl2' && sheetItem) { pls[nm].push(sig(sheetItem)); toast('Ditambahkan ke ' + nm); } save('pl', pls); closeSheet(); render(); }
    else if (a === 'rmpl') { var sc = nav[nav.length - 1], k2 = sig(sheetItem); pls[sc.key] = (pls[sc.key] || []).filter(function (z) { return z !== k2; }); save('pl', pls); closeSheet(); render(); }
    else if (a === 'np') { if (st.active) npShow(true); } else if (a === 'npx') npShow(false);
    else if (a === 'mplay' || a === 'toggle') { if (m) m.toggle(); } else if (a === 'next') { if (m) m.next(); } else if (a === 'prev') { if (m) m.prev(); }
    else if (a === 'shuffle') { if (m) m.setMode({ shuffle: !st.shuffle, repeat: st.repeat || 0 }); } else if (a === 'repeat') { if (m) m.setMode({ shuffle: !!st.shuffle, repeat: ((st.repeat || 0) + 1) % 3 }); }
    else if (a === 'nfav') { var cc = cur(); if (cc) { toggleFav(cc); npUpdate(); render(); } }
    else if (a === 'queue') queueSheet(); else if (a === 'qplay') { closeSheet(); playList(curQ, i); }
    else if (a === 'lyr') { lyrOn = !lyrOn; npEl().classList.toggle('lyr', lyrOn); $('np-ly').classList.toggle('on', lyrOn); if (lyrOn) { loadLyrics(cur()); lyrIdx = -1; lyrTick(); } }
    else if (a === 'eq') eqOpen();
    else if (a === 'theme') sheet(optList('Tema', 'Warna tab Offline', THEMES, theme, 'tpick'));
    else if (a === 'quality') sheet(optList('Kualitas Audio', 'Berlaku untuk lagu YouTube (video/audio streaming)', QUAL, qual, 'qpick'));
    else if (a === 'tpick') { theme = el.dataset.k; save('theme', theme); applyTheme(); settingsSheet(); }
    else if (a === 'qpick') { qual = el.dataset.k; save('q', qual); applyQuality(); settingsSheet(); toast('Kualitas: ' + QUAL[qual][0]); }
    else if (a === 'scrim') closeSheet();
  }

  function build() {
    var tab = $('tab-offline'); if (!tab || $('ln-v2')) return; css();
    var r = D.createElement('div'); r.id = 'ln-v2';
    r.innerHTML = '<div id="ln-v2-body"></div>' +
      '<div id="ln-v2-mini" class="v2-mini"><div class="v2-mini-main" data-act="np"><span class="v2-art" id="ln-v2-mart">' + ic.note + '</span><span class="v2-ri"><b id="ln-v2-mt"></b><small id="ln-v2-ma"></small></span></div><button data-act="prev" aria-label="Sebelumnya">' + ic.prev + '</button><button id="ln-v2-mp" data-act="mplay" aria-label="Putar/jeda"></button><button data-act="next" aria-label="Berikutnya">' + ic.next + '</button><i class="v2-bar"><u id="ln-v2-mb"></u></i></div>' +
      '<div id="ln-v2-np"><div class="np-top"><button class="v2-ib" data-act="npx" aria-label="Tutup">' + ic.down + '</button><span>SEDANG DIPUTAR</span><span style="width:40px"></span></div><div class="np-cover"><i>' + ic.note + '</i></div><div class="np-lyr" id="np-lyr"></div>' +
      '<div class="np-meta"><span class="s"><h2 id="np-t"></h2><p id="np-a"></p></span><button class="v2-ib np-fav" id="np-fav" data-act="nfav" aria-label="Favorit">' + ic.heart + '</button></div>' +
      '<div class="np-seek"><input id="np-seek" type="range" min="0" max="1" value="0"><div class="np-t"><span id="np-p">0:00</span><span id="np-d">0:00</span></div></div>' +
      '<div class="np-ctl"><button id="np-sh" data-act="shuffle" aria-label="Acak">' + ic.shuffle + '</button><button data-act="prev" aria-label="Sebelumnya">' + ic.prev + '</button><button class="big" id="np-pp" data-act="toggle" aria-label="Putar/jeda"></button><button data-act="next" aria-label="Berikutnya">' + ic.next + '</button><button id="np-rp" data-act="repeat" aria-label="Ulangi">' + ic.repeat + '</button></div>' +
      '<div class="np-bot"><button data-act="timer">' + ic.moon + 'Timer</button><button id="np-ly" data-act="lyr">' + ic.note + 'Lirik</button><button data-act="eq">' + ic.eq + 'Equalizer</button><button data-act="queue">' + ic.queue + 'Berikutnya</button></div></div><div id="ln-v2-eq"></div>' +
      '<div id="ln-v2-sheet" class="v2-sheet"><div class="v2-scrim" data-act="scrim"></div><div class="v2-panel"></div></div>';
    tab.appendChild(r); r.addEventListener('click', onClick); applyTheme(); applyQuality(); var eqe = $('ln-v2-eq'); eqe.addEventListener('click', eqClick); eqe.addEventListener('input', eqInput);
    var sk = $('np-seek'); sk.addEventListener('input', function () { dragging = true; $('np-p').textContent = fmt(sk.value); });
    sk.addEventListener('change', function () { dragging = false; var m = P(); if (m) m.seek({ ms: +sk.value || 0 }); });
    render(); if (window.lnLocal) { try { setLib(lnLocal.items()); } catch (e) {} }
  }
  function setLib(l) { lib = l || []; bySig = {}; byId = {}; artCache = {}; npId = miniId = null; lib.forEach(function (s) { bySig[sig(s)] = s; byId[s.id] = s; }); render(); }
  function back() {
    var sh = $('ln-v2-sheet'); if (sh && sh.classList.contains('on')) { closeSheet(); return true; }
    var eqo = $('ln-v2-eq'); if (eqo && eqo.classList.contains('on')) { eqClose(); return true; }
    if (npOpen) { npShow(false); return true; }
    var t = $('tab-offline'); if (!t || t.classList.contains('hidden')) return false;
    if (nav.length > 1) { nav.pop(); q = ''; render(); return true; }
    return false;
  }

  window.lnOfflineUI = Object.assign({}, base, {
    sync: function (s) { try { base.sync(s); } catch (e) {} sync(s); },
    setLib: function (l) { try { base.setLib && base.setLib(l); } catch (e) {} setLib(l); },
    status: function (m) { statusMsg = m || ''; if (nav.length === 1 && !D.activeElement.matches('input')) render(); },
    back: back
  });
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', build, { once: true }); else build();
})();

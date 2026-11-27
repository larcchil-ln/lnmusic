/* LNMusic — beranda trending (APK, web HP, dan desktop).
   Mengganti isi #hits-shelves dengan: carousel hero (Top 5), rak lagu, dan tangga lagu.
   Data memakai yang sudah ada di index.html (top50 / topTab / setTopTab / playTrackFromList). */
(function () {
  if (!document.documentElement.classList.contains('ln-ui')) return;

  var L = { cur: [], oth: [] };
  var lastSig = '', lastTouch = 0, tints = {};
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cssUrl = function (u) { return String(u || '').replace(/['"()\s\\]/g, function (c) { return encodeURIComponent(c); }); };
  var toast = function (m) { try { showToast(m); } catch (e) {} };
  var logo = function () { try { return DEFAULT_LOGO; } catch (e) { return ''; } };

  function curList() { try { return topList() || []; } catch (e) { return []; } }
  function othList() { try { return (top50[topTab === 'id' ? 'west' : 'id'] || []); } catch (e) { return []; } }
  function tabKey() { try { return topTab; } catch (e) { return 'id'; } }
  function regionName(k) { return k === 'id' ? 'Indonesia' : 'Global'; }

  var I = {
    trend: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.3 19.5c.6-3.3 2.9-5.2 5.7-5.2s5.1 1.9 5.7 5.2"/><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.6c1.8.6 3 2.3 3.4 4.9"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 20h15"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M4 6.5h11M4 11.5h11M4 16.5h6"/><circle cx="17.5" cy="17" r="2.6"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2.6"/><path d="M11 18h2"/></svg>',
    more: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>'
  };

  // ---- Warna latar kartu: ambil dari sampul (kalau diizinkan CORS), cadangan: warna dari hash judul ----
  function hashTint(t) {
    var s = String(t.title || t.id || ''), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 'hsl(' + (h % 360) + ',34%,21%)';
  }
  function sample(url, cb) {
    if (tints[url]) return cb(tints[url]);
    var im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = function () {
      try {
        var c = document.createElement('canvas'); c.width = c.height = 8;
        var x = c.getContext('2d'); x.drawImage(im, 0, 0, 8, 8);
        var d = x.getImageData(0, 0, 8, 8).data, r = 0, g = 0, b = 0, w = 0;
        for (var i = 0; i < d.length; i += 4) {
          var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
          var wt = .2 + (mx - mn) / (mx || 1);
          r += d[i] * wt; g += d[i + 1] * wt; b += d[i + 2] * wt; w += wt;
        }
        var k = .5 / w;
        tints[url] = 'rgb(' + Math.round(r * k) + ',' + Math.round(g * k) + ',' + Math.round(b * k) + ')';
        cb(tints[url]);
      } catch (e) {}
    };
    im.src = url;
  }

  // ---- Potongan HTML ----
  function quick() {
    // Upload lagu & Musik HP hanya ada di APK; di web tab Offline sudah dihapus
    var apk = document.documentElement.classList.contains('ln-android');
    return '<div class="lnh-quick no-scrollbar">' +
      '<button class="lnh-chip" data-go="together">' + I.users + 'Nonton bareng</button>' +
      (apk ? '<label class="lnh-chip">' + I.up + 'Upload lagu<input type="file" accept="audio/*" multiple class="hidden" onchange="handleOfflineUpload(event)"></label>' : '') +
      '<button class="lnh-chip" data-go="playlists">' + I.list + 'Playlist</button>' +
      (apk ? '<button class="lnh-chip" data-go="offline">' + I.phone + 'Musik HP</button>' : '') +
      '</div>';
  }
  function heroCard(t, i, key) {
    var th = t.thumb || logo(), sq = !!t.lazy;
    return '<article class="lnh-card" data-i="' + i + '" style="--c:' + hashTint(t) + '">' +
      '<div class="lnh-art' + (sq ? ' sq' : '') + '">' + (sq ? '<div class="bgi" style="background-image:url(\'' + cssUrl(th) + '\')"></div>' : '') +
      '<img src="' + esc(th) + '" alt=""' + (i ? ' loading="lazy"' : '') + ' referrerpolicy="no-referrer"></div>' +
      '<div class="lnh-meta"><span class="lnh-eyebrow">' + I.trend + 'Trending #' + (i + 1) + ' · ' + regionName(key) + '</span>' +
      '<div class="lnh-seg"><button class="lnh-seg-b' + (key === 'id' ? ' on' : '') + '" data-r="id">Indonesia</button>' +
      '<button class="lnh-seg-b' + (key === 'west' ? ' on' : '') + '" data-r="west">Global</button></div></div>' +
      '<h2 class="lnh-title">' + esc(t.title) + '</h2><p class="lnh-artist">' + esc(t.artist) + '</p>' +
      '<div class="lnh-actions"><button class="lnh-btn p" data-act="play" data-i="' + i + '">' + I.play + 'Putar sekarang</button>' +
      '<button class="lnh-btn s" data-act="queue" data-i="' + i + '">' + I.plus + 'Antrean</button></div></article>';
  }
  function railCard(t, i, l) {
    return '<button class="lnh-rcard" data-l="' + l + '" data-i="' + i + '"><img src="' + esc(t.thumb || logo()) + '" loading="lazy" alt="" referrerpolicy="no-referrer"><b>' + esc(t.title) + '</b><small>' + esc(t.artist) + '</small></button>';
  }
  function row(t, i, l) {
    return '<button class="lnh-row" data-l="' + l + '" data-i="' + i + '"><i class="rk">' + (i + 1) + '</i><img src="' + esc(t.thumb || logo()) + '" loading="lazy" alt="" referrerpolicy="no-referrer"><span><b>' + esc(t.title) + '</b><small>' + esc(t.artist) + '</small></span>' + I.play.replace('<svg', '<svg style="fill:#8b8b96;stroke:none"') + '</button>';
  }

  function render() {
    var box = $('hits-shelves'); if (!box) return;
    var list = curList(), oth = othList(), key = tabKey();
    var sig = key + '|' + list.slice(0, 25).map(function (t) { return t.id; }).join(',') + '|' + oth.slice(0, 15).map(function (t) { return t.id; }).join(',');
    if (sig === lastSig && box.querySelector('.lnh')) return;     // tidak ada perubahan -> jangan gambar ulang
    L.cur = list; L.oth = oth;
    if (!list.length) {
      box.innerHTML = '<div class="lnh">' + quick() + '<div class="lnh-skel"></div><p class="lnh-note">Memuat lagu trending…</p></div>';
      return;
    }
    lastSig = sig;
    var hero = list.slice(0, 5), h = '<div class="lnh">' + quick();
    h += '<div class="lnh-hero"><div class="lnh-track no-scrollbar" id="lnh-track">' + hero.map(function (t, i) { return heroCard(t, i, key); }).join('') + '</div>' +
      '<button class="lnh-nav l" data-nav="-1" aria-label="Sebelumnya"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button><button class="lnh-nav r" data-nav="1" aria-label="Berikutnya"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button><div class="lnh-dots" id="lnh-dots">' + hero.map(function (_, i) { return '<i' + (i ? '' : ' class="on"') + '></i>'; }).join('') + '</div></div>';
    var railList = oth.length ? oth : list, railKey = oth.length ? (key === 'id' ? 'west' : 'id') : key, railL = oth.length ? 'oth' : 'cur';
    h += '<section class="lnh-sec"><div class="lnh-sh"><h3>' + (oth.length ? 'Lagi ramai di ' + regionName(railKey) : 'Lagu trending') + '</h3><button class="lnh-more" data-l="' + railL + '">Putar semua</button></div>' +
      '<div class="lnh-rail no-scrollbar">' + railList.slice(0, 15).map(function (t, i) { return railCard(t, i, railL); }).join('') + '</div></section>';
    var rest = list.slice(5, 25);
    if (rest.length) {
      h += '<section class="lnh-sec"><div class="lnh-sh"><h3>Tangga lagu<small>' + regionName(key) + '</small></h3></div><div class="lnh-list">' +
        rest.map(function (t, j) { return row(t, j + 5, 'cur'); }).join('') + '</div></section>';
    }
    box.innerHTML = h + '</div>';
    paintTints();
  }

  function paintTints() {
    document.querySelectorAll('#lnh-track .lnh-card').forEach(function (card) {
      var t = L.cur[+card.dataset.i]; if (!t || !t.thumb) return;
      sample(t.thumb, function (c) { card.style.setProperty('--c', c); });
    });
  }

  // ---- Interaksi ----
  function addQueue(t) {
    if (!t) return;
    try {
      if (queue.some(function (x) { return x.id === t.id; })) return toast('Sudah ada di antrean');
      queue.push(t);
      try { lnRenderQD(); } catch (e) {}
      toast('Ditambahkan ke antrean');
    } catch (e) {}
  }
  function playList(l, i) {
    var list = L[l] || []; if (!list[i]) return;
    try { playTrackFromList(list, i, true); } catch (e) {}
  }
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('#hits-shelves [data-nav],#hits-shelves [data-go],#hits-shelves [data-r],#hits-shelves [data-act],#hits-shelves .lnh-rcard,#hits-shelves .lnh-row,#hits-shelves .lnh-more') : null;
    if (!el) return;
    if (el.dataset.nav) { var tr = trackEl(); if (tr) { lastTouch = Date.now(); tr.scrollBy({ left: (+el.dataset.nav) * tr.clientWidth, behavior: 'smooth' }); } return; }
    if (el.dataset.go) { try { switchTab(el.dataset.go); } catch (x) {} return; }
    if (el.dataset.r) { try { if (tabKey() !== el.dataset.r) setTopTab(el.dataset.r); } catch (x) {} return; }
    if (el.dataset.act === 'play') return playList('cur', +el.dataset.i);
    if (el.dataset.act === 'queue') return addQueue(L.cur[+el.dataset.i]);
    if (el.classList.contains('lnh-more')) return playList(el.dataset.l, 0);
    if (el.dataset.l) playList(el.dataset.l, +el.dataset.i);
  });

  // titik indikator + geser otomatis
  function trackEl() { return $('lnh-track'); }
  document.addEventListener('scroll', function (e) {
    var t = e.target; if (!t || t.id !== 'lnh-track') return;
    var i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
    var dots = $('lnh-dots'); if (!dots) return;
    Array.prototype.forEach.call(dots.children, function (d, k) { d.classList.toggle('on', k === i); });
  }, true);
  document.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('#lnh-track')) lastTouch = Date.now(); }, { passive: true, capture: true });
  setInterval(function () {
    var t = trackEl(); if (!t || document.hidden || Date.now() - lastTouch < 9000) return;
    var tab = $('tab-online'); if (!tab || tab.classList.contains('hidden')) return;
    var r = t.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    var n = t.children.length; if (n < 2) return;
    var i = (Math.round(t.scrollLeft / Math.max(1, t.clientWidth)) + 1) % n;
    t.scrollTo({ left: i * t.clientWidth, behavior: 'smooth' });
  }, 6000);

  // efek sentuh (ripple) khas Material
  document.addEventListener('pointerdown', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('.lnh-row,.lnh-btn,.lnh-chip,.lnh-rcard,.yt-row') : null;
    if (!el) return;
    var r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = document.createElement('span');
    s.className = 'lna-rip';
    s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    el.appendChild(s); setTimeout(function () { s.remove(); }, 600);
  }, { passive: true });

  // ---- Pasang: ganti renderShelves bawaan ----
  var orig = window.renderShelves;
  window.renderShelves = function () {
    try { render(); } catch (e) { console.error('ln-android render', e); if (typeof orig === 'function') return orig.apply(this, arguments); }
  };
  render();
})();

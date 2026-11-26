/* LNMusic redesign web: menyisipkan ikon, sidebar, pil mobile, dan hero Bareng. Tidak aktif di APK. */
(function () {
  if (document.documentElement.classList.contains('ln-android')) return;
  var P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
    together: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="2"/><rect x="16.5" y="14" width="4.5" height="7" rx="2"/>',
    video: '<rect x="3" y="6" width="12.5" height="12" rx="3"/><path d="m15.5 10.5 5.5-3v9l-5.5-3z"/>',
    list: '<path d="M3 6h11M3 11h11M3 16h6"/><circle cx="16.5" cy="17" r="2.5"/><path d="M19 17V8l3 1"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8M5.3 5.3l2 2M16.7 16.7l2 2M5.3 18.7l2-2M16.7 7.3l2-2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17.5 14.2c2.4.2 3.9 1.7 4.3 4.3"/>'
  };
  var TABS = [['online', 'Beranda', 'home'], ['together', 'Bareng', 'together'], ['videocall', 'Call', 'video'], ['playlists', 'Playlist', 'list']];
  var svg = function (k) { return '<svg class="lr-ic" viewBox="0 0 24 24" aria-hidden="true">' + P[k] + '</svg>'; };
  var $ = function (id) { return document.getElementById(id); };
  var cur = function () { try { return curTab; } catch (e) { return 'online'; } };

  function topIcons() {
    TABS.forEach(function (t) {
      var b = $('nav-' + t[0]);
      if (!b || b.querySelector('.lr-ic')) return;
      b.insertAdjacentHTML('afterbegin', svg(t[2]));
      b.setAttribute('aria-label', t[1]);
    });
  }

  function sidebar() {
    if ($('lr-side')) return;
    var s = document.createElement('aside');
    s.id = 'lr-side';
    s.setAttribute('aria-label', 'Menu utama');
    s.innerHTML = '<div class="lr-brand"><span id="lr-logo"></span><span>LNMusic</span></div>' +
      '<button type="button" class="lr-sb" data-q="1">' + svg('search') + '<span>Cari</span></button>' + TABS.map(function (t) {
      return '<button type="button" class="lr-sb" data-t="' + t[0] + '">' + svg(t[2]) + '<span>' + t[1] + '</span></button>';
    }).join('') + '<div class="lr-sb-gap"></div><button type="button" class="lr-sb" data-pf="1">' + svg('user') + '<span>Profil Saya</span></button><button type="button" class="lr-sb" data-set="1">' + svg('gear') + '<span>Pengaturan</span></button>';
    s.addEventListener('click', function (e) {
      var b = e.target.closest('.lr-sb'); if (!b) return;
      if (b.dataset.q) { switchTab('online'); setTimeout(function () { var q = $('yt-search-input'); if (q) { q.scrollIntoView({ block: 'center' }); q.focus(); } }, 350); }
      else if (b.dataset.pf) { try { openMyProfile(); } catch (x) {} }
      else if (b.dataset.set) { try { openSettingsModal(); } catch (x) {} } else { switchTab(b.dataset.t); }
    });
    document.body.appendChild(s);
    var lg = document.querySelector('#ln-top img[data-ln-logo]');
    if (lg) $('lr-logo').appendChild(lg.cloneNode(true));
  }

  function art() {
    return '<svg viewBox="0 0 320 300" fill="none"><defs><linearGradient id="lrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#16a34a"/></linearGradient>' +
      '<radialGradient id="lrr" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#22d36a" stop-opacity=".55"/><stop offset="1" stop-color="#22d36a" stop-opacity="0"/></radialGradient></defs>' +
      '<circle cx="160" cy="150" r="140" fill="url(#lrr)"/>' +
      '<ellipse cx="160" cy="170" rx="135" ry="46" stroke="#4ade80" stroke-opacity=".45" stroke-width="2" transform="rotate(-18 160 170)"/>' +
      '<ellipse cx="160" cy="170" rx="110" ry="32" stroke="#86efac" stroke-opacity=".35" stroke-width="1.5" transform="rotate(-18 160 170)"/>' +
      '<path d="M70 190v-28a90 90 0 0 1 180 0v28" stroke="url(#lrg)" stroke-width="16" stroke-linecap="round"/>' +
      '<rect x="52" y="178" width="44" height="78" rx="22" fill="#07140c" stroke="url(#lrg)" stroke-width="5"/>' +
      '<rect x="224" y="178" width="44" height="78" rx="22" fill="#07140c" stroke="url(#lrg)" stroke-width="5"/>' +
      '<rect x="62" y="194" width="24" height="46" rx="12" fill="#22d36a" fill-opacity=".55"/><rect x="234" y="194" width="24" height="46" rx="12" fill="#22d36a" fill-opacity=".55"/>' +
      '<path d="M270 70v44" stroke="#bbf7d0" stroke-width="5" stroke-linecap="round"/><circle cx="259" cy="116" r="11" fill="#bbf7d0"/>' +
      '<path d="M40 96v30" stroke="#4ade80" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="128" r="8" fill="#4ade80"/></svg>';
  }

  function hero() {
    var tab = $('tab-together'), glass = tab && tab.firstElementChild;
    if (!glass || $('lr-hero')) return;
    var h = document.createElement('div');
    h.id = 'lr-hero';
    h.innerHTML = '<div class="lr-h-t"><span class="lr-h-ic">' + svg('users') + '</span><h2>Bareng</h2></div>' +
      '<p>Buat room, ajak teman, dan nikmati musik bareng dalam satu ruang!</p>' +
      '<button type="button" class="lr-cta" id="lr-cta">' + svg('users') + 'Buat Room</button><div class="lr-art">' + art() + '</div>';
    glass.insertBefore(h, glass.firstChild);
    $('lr-cta').onclick = function () {
      var f = $('lr-name'), box = $('lr-start');
      if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 400);
    };
    watchSetup();
  }

  function watchSetup() {
    var h = $('lr-hero'), a = $('room-setup-area');
    if (!h || !a) return;
    var wasOff = a.classList.contains('hidden');
    var sync = function () {
      var off = a.classList.contains('hidden') || !!a.closest('.hidden');
      h.classList.toggle('lr-off', off);
      // Baru masuk room: naikkan tampilan ke awal tab Bareng supaya room terlihat penuh
      if (off && !wasOff) { var t = $('tab-together'); if (t) setTimeout(function () { try { t.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {} }, 60); }
      wasOff = off;
    };
    new MutationObserver(sync).observe(a, { attributes: true, attributeFilter: ['class'] });
    sync();
  }


  // ---------- Layar awal Bareng: satu keputusan, minim teks ----------
  function startBox() {
    var area = $('room-setup-area');
    if (!area || $('lr-start')) return;
    var box = document.createElement('div');
    box.id = 'lr-start';
    box.innerHTML =
      '<div id="lr-last"></div>' +
      '<input id="lr-name" type="text" maxlength="20" autocomplete="nickname" placeholder="Namamu" aria-label="Namamu">' +
      '<button type="button" id="lr-create" class="lr-big">' + svg('plus') + 'Buat Room</button>' +
      '<div class="lr-or"><i></i><span>atau gabung</span><i></i></div>' +
      '<div class="lr-join"><span class="lr-pre">LN-</span><input id="lr-code" type="text" maxlength="8" inputmode="text" autocapitalize="characters" autocomplete="off" placeholder="8492" aria-label="Kode room">' +
      '<button type="button" id="lr-go" disabled aria-label="Gabung">' + svg('arrow') + '</button></div>' +
      '<p id="lr-err" role="alert" hidden></p>' +
      '<div class="lr-foot"><button type="button" id="lr-info" aria-label="Info room" aria-expanded="false">i</button></div>' +
      '<p id="lr-note" hidden>Pembuat room jadi Host: bisa atur antrean, peserta, dan izin putar bareng.</p>';
    area.insertBefore(box, area.firstChild);
    var last = $('last-room-card');
    if (last) $('lr-last').appendChild(last);

    // Room Kita (Nuki, Nana, tamu): kartu asli dipindah ke bawah kolom kode, tanpa klik tambahan
    var kita = $('login-user') && $('login-user').closest('#room-setup-area > div');
    if (kita) {
      kita.id = 'lr-kita-card';
      var dv = document.createElement('div'); dv.className = 'lr-or'; dv.innerHTML = '<i></i><span>Masuk ke Room Kita</span><i></i>';
      var foot = box.querySelector('.lr-foot');
      box.insertBefore(dv, foot); box.insertBefore(kita, foot);
    }

    var name = $('lr-name'), code = $('lr-code'), go = $('lr-go'), err = $('lr-err');
    try {
      var c = JSON.parse(localStorage.getItem('lnmusic_custom_room') || 'null') || JSON.parse(localStorage.getItem('lnmusic_last_room') || 'null');
      if (c && c.name) name.value = c.name;
    } catch (e) {}

    function say(msg) { err.textContent = msg; err.hidden = !msg; }
    function nm() { var v = name.value.trim(); if (v.length < 2) { say('Isi namamu dulu, minimal 2 huruf'); name.focus(); return null; } say(''); return v; }
    function relay(id) { var e = $(id); if (e && !e.classList.contains('hidden') && e.textContent) say(e.textContent); }
    function create() {
      var v = nm(); if (!v) return;
      $('croom-host-name').value = v; if ($('croom-title')) $('croom-title').value = '';
      doCreateCustomRoom(); relay('croom-create-error');
    }
    function join() {
      var c = code.value;
      if (c.length < 4) { say('Kode room minimal 4 karakter'); code.focus(); return; }
      var v = nm(); if (!v) return;
      $('jroom-guest-name').value = v; $('jroom-code').value = 'LN-' + c;
      doJoinCustomRoom(); relay('croom-join-error');
    }
    function clean() { code.value = code.value.toUpperCase().replace(/^LN-?/, '').replace(/[^A-Z0-9]/g, ''); go.disabled = code.value.length < 4; say(''); }
    code.addEventListener('input', clean);
    code.addEventListener('paste', function () { setTimeout(clean, 0); });
    code.addEventListener('keydown', function (e) { if (e.key === 'Enter') join(); });
    name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { if (code.value.length >= 4) join(); else create(); } });
    name.addEventListener('input', function () { say(''); });
    $('lr-create').onclick = create; go.onclick = join;
    $('lr-info').onclick = function () { var n = $('lr-note'); n.hidden = !n.hidden; this.setAttribute('aria-expanded', String(!n.hidden)); };

    // Link undangan (?room=...) mengisi kode otomatis
    function sync() {
      var jc = $('jroom-code');
      if (jc && jc.value && !code.value) { code.value = jc.value; clean(); if (!name.value) name.focus(); }
    }
    sync(); setTimeout(sync, 600);
  }


  // ---------- Tampilan dalam room ----------
  function roomView() {
    var area = $('room-active-area');
    if (!area || area.dataset.lr) return;
    area.dataset.lr = '1';
    area.classList.add('lr-room', 'lr-pane-chat');

    // Header: Undang tetap terlihat, aksi lain masuk menu "..."
    var head = area.firstElementChild, acts = head && head.lastElementChild;
    if (acts && acts.children.length > 1) {
      acts.classList.add('lr-actions');
      var wrap = document.createElement('div'); wrap.className = 'lr-more-wrap';
      var more = document.createElement('button'); more.type = 'button'; more.id = 'lr-more'; more.setAttribute('aria-label', 'Menu room'); more.setAttribute('aria-expanded', 'false');
      more.innerHTML = '<svg class="lr-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';
      var menu = document.createElement('div'); menu.className = 'lr-menu'; menu.hidden = true;
      Array.prototype.slice.call(acts.children, 1).forEach(function (b) { menu.appendChild(b); });
      wrap.appendChild(more); wrap.appendChild(menu); acts.appendChild(wrap);
      more.onclick = function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; more.setAttribute('aria-expanded', String(!menu.hidden)); };
      document.addEventListener('click', function (e) { if (!menu.hidden && !wrap.contains(e.target) || (e.target.closest && e.target.closest('.lr-menu button'))) { menu.hidden = true; more.setAttribute('aria-expanded', 'false'); } });
    }

    // Tab Chat / Lagu (layar < 1024px)
    var voice = $('tg-voice');
    if (voice) {
      var tabs = document.createElement('div'); tabs.id = 'lr-tabs'; tabs.setAttribute('role', 'tablist');
      tabs.innerHTML = '<button type="button" role="tab" data-p="chat" aria-selected="true">Chat</button><button type="button" role="tab" data-p="queue" aria-selected="false">Lagu &amp; Antrean</button>';
      tabs.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-p]'); if (!b) return;
        area.classList.toggle('lr-pane-chat', b.dataset.p === 'chat'); area.classList.toggle('lr-pane-queue', b.dataset.p === 'queue');
        tabs.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      });
      voice.parentNode.insertBefore(tabs, voice);
    }

    // Latar blur dari cover lagu + avatar berdenyut saat lagu diputar
    var th = $('player-thumb');
    function cover() {
      var s = th && th.getAttribute('src');
      if (s && !/^data:/.test(s)) area.style.setProperty('--lr-cover', 'url("' + s.replace(/"/g, '%22') + '")'); else area.style.removeProperty('--lr-cover');
      area.classList.toggle('lr-has-cover', !!(s && !/^data:/.test(s)));
    }
    if (th) { new MutationObserver(cover).observe(th, { attributes: true, attributeFilter: ['src'] }); cover(); }
    setInterval(function () { var p = false; try { p = !!isPlaying; } catch (e) {} area.classList.toggle('lr-playing', p); }, 500);
  }

  function mark() {
    var c = cur();
    document.querySelectorAll('.lr-sb[data-t],.lr-pill[data-t]').forEach(function (b) {
      var on = b.dataset.t === c;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  // Saat mengetik di tab Bareng: sembunyikan bar bawah (class lr-typing) & gulir kolom ke tengah layar
  function typingGuard() {
    if (window.__lrTyping) return; window.__lrTyping = true;
    var root = document.documentElement, t;
    var isText = function (el) {
      return !!(el && el.matches && el.matches('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button]):not([type=submit]):not([type=hidden]),textarea') && el.closest('#tab-together'));
    };
    document.addEventListener('focusin', function (e) {
      var el = e.target; if (!isText(el)) return;
      clearTimeout(t); root.classList.add('lr-typing');
      setTimeout(function () { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} }, 320);
    });
    document.addEventListener('focusout', function () {
      clearTimeout(t);
      t = setTimeout(function () { if (!isText(document.activeElement)) root.classList.remove('lr-typing'); }, 200);
    });
  }

  // Respons cepat: siapkan server TURN lebih awal (supaya masuk room tidak menunggu) + umpan balik saat tombol ditekan
  function snappy() {
    if (window.__lrSnappy) return; window.__lrSnappy = true;
    setTimeout(function () { try { if (typeof getIceServers === 'function') getIceServers(); } catch (e) {} }, 800);
    function busy(btn, txt) {
      if (!btn || btn.dataset.lrBusy) return;
      var old = btn.innerHTML; btn.dataset.lrBusy = '1'; btn.disabled = true; btn.textContent = txt;
      setTimeout(function () { btn.disabled = false; btn.innerHTML = old; delete btn.dataset.lrBusy; }, 3500);
    }
    document.addEventListener('submit', function (e) {
      var f = e.target; if (!f || !f.closest || !f.closest('#lr-kita-card')) return;
      busy(f.querySelector('button[type=submit]'), 'Memproses...');
    }, true);
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('#lr-create, #lr-go');
      if (!b || b.disabled) return;
      if (b.id === 'lr-create') { var n = $('lr-name'); if (!n || n.value.trim().length < 2) return; }
      b.classList.add('lr-press');
      setTimeout(function () { b.classList.remove('lr-press'); }, 600);
    }, true);
  }

  function init() {
    snappy(); typingGuard(); topIcons(); sidebar(); hero(); startBox(); roomView(); mark();
    if (window.switchTab && !window.switchTab.__lr) {
      var o = window.switchTab;
      window.switchTab = function () {
        var r = o.apply(this, arguments);
        mark();
        // Desktop lebar tidak punya header atas lagi: rapatkan posisi scroll
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            var t = cur(), el = $('tab-' + t);
            if (!el || t === 'videocall' || innerWidth < 1024) return;
            window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 24), behavior: 'smooth' });
          });
        });
        return r;
      };
      window.switchTab.__lr = true;
    }
    try { if (window.lucide) lucide.createIcons(); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', function () { setTimeout(init, 300); });
})();
